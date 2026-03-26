import type { FastifyInstance } from "fastify"
import { db } from "../db/client"

// ─────────────────────────────────────────────────────────────────────────────
// AcoustID Fingerprinting Route
//
// POST /acoustid/lookup
//   Accepts a chromaprint fingerprint + duration from the mobile app.
//   Looks up the ISRC via AcoustID → MusicBrainz, caches result in tracks table.
//
// The mobile app records ~10s of audio, runs chromaprint (via expo-av or
// a native module), and sends the fingerprint here. We resolve the ISRC
// and return full track metadata so the guest can queue it by ISRC.
// ─────────────────────────────────────────────────────────────────────────────

const ACOUSTID_API_KEY = process.env.ACOUSTID_API_KEY ?? ""
const ACOUSTID_URL     = "https://api.acoustid.org/v2/lookup"
const MUSICBRAINZ_URL  = "https://musicbrainz.org/ws/2"
const MB_USER_AGENT    = process.env.MUSICBRAINZ_USER_AGENT ?? "QueueDJ/0.1.0"

interface AcoustIDResult {
  isrc:       string | null
  title:      string | null
  artist:     string | null
  album:      string | null
  duration_ms: number | null
  confidence: number
}

async function lookupAcoustID(fingerprint: string, duration: number): Promise<AcoustIDResult> {
  const params = new URLSearchParams({
    client:      ACOUSTID_API_KEY,
    fingerprint,
    duration:    String(Math.round(duration)),
    meta:        "recordings releasegroups",
    format:      "json",
  })

  const res  = await fetch(`${ACOUSTID_URL}?${params.toString()}`)
  if (!res.ok) throw new Error(`AcoustID error: ${res.status}`)

  const data = await res.json() as {
    status: string
    results?: Array<{
      score: number
      recordings?: Array<{
        id: string
        title?: string
        duration?: number
        artists?: Array<{ name: string }>
        releasegroups?: Array<{ title: string }>
        isrcs?: string[]
      }>
    }>
  }

  if (data.status !== "ok" || !data.results?.length) {
    return { isrc: null, title: null, artist: null, album: null, duration_ms: null, confidence: 0 }
  }

  // Take the highest-scoring result
  const best       = data.results[0]
  const confidence = best.score ?? 0
  const recording  = best.recordings?.[0]

  if (!recording) {
    return { isrc: null, title: null, artist: null, album: null, duration_ms: null, confidence }
  }

  const isrc      = recording.isrcs?.[0] ?? null
  const title     = recording.title ?? null
  const artist    = recording.artists?.[0]?.name ?? null
  const album     = recording.releasegroups?.[0]?.title ?? null
  const duration_ms = recording.duration ? recording.duration * 1000 : null

  return { isrc, title, artist, album, duration_ms, confidence }
}

async function enrichFromMusicBrainz(isrc: string): Promise<{ bpm?: number; artworkUrl?: string }> {
  try {
    const res = await fetch(
      `${MUSICBRAINZ_URL}/recording?query=isrc:${isrc}&fmt=json`,
      { headers: { "User-Agent": MB_USER_AGENT } },
    )
    if (!res.ok) return {}
    // MusicBrainz doesn't directly give BPM — return empty, ML fills it later
    return {}
  } catch {
    return {}
  }
}

export async function acoustidRoutes(fastify: FastifyInstance) {

  // POST /acoustid/lookup
  fastify.post<{
    Body: { fingerprint: string; duration: number }
  }>("/acoustid/lookup", {
    schema: {
      body: {
        type: "object",
        required: ["fingerprint", "duration"],
        properties: {
          fingerprint: { type: "string", minLength: 10 },
          duration:    { type: "number", minimum: 1, maximum: 600 },
        },
      },
    },
  }, async (request, reply) => {
    const { fingerprint, duration } = request.body

    // 1. Look up via AcoustID
    let result: AcoustIDResult
    try {
      result = await lookupAcoustID(fingerprint, duration)
    } catch (err) {
      fastify.log.error({ err }, "AcoustID lookup failed")
      return reply.code(502).send({ error: "ACOUSTID_UNAVAILABLE" })
    }

    if (!result.isrc) {
      return reply.code(404).send({
        error:      "TRACK_NOT_FOUND",
        confidence: result.confidence,
        message:    "Could not identify this track. Try searching manually.",
      })
    }

    if (result.confidence < 0.5) {
      return reply.code(422).send({
        error:      "LOW_CONFIDENCE",
        confidence: result.confidence,
        message:    "Match confidence too low. Try recording a longer clip.",
      })
    }

    // 2. Check if already in our DB
    const existing = await db.query(
      `SELECT isrc, title, artist, album, album_art_url, duration_ms, bpm, energy
       FROM tracks WHERE isrc = $1`,
      [result.isrc],
    )

    if (existing.rows.length > 0) {
      return reply.send({
        track:      existing.rows[0],
        confidence: result.confidence,
        source:     "cache",
      })
    }

    // 3. Not in DB — enrich from MusicBrainz and save
    const enriched = await enrichFromMusicBrainz(result.isrc)

    await db.query(
      `INSERT INTO tracks (isrc, title, artist, album, duration_ms, analysis_source, analysis_confidence, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'acoustid', $6, NOW())
       ON CONFLICT (isrc) DO UPDATE SET
         title               = COALESCE(EXCLUDED.title, tracks.title),
         artist              = COALESCE(EXCLUDED.artist, tracks.artist),
         album               = COALESCE(EXCLUDED.album, tracks.album),
         duration_ms         = COALESCE(EXCLUDED.duration_ms, tracks.duration_ms),
         analysis_confidence = GREATEST(EXCLUDED.analysis_confidence, tracks.analysis_confidence),
         updated_at          = NOW()`,
      [result.isrc, result.title, result.artist, result.album, result.duration_ms, result.confidence],
    )

    return reply.send({
      track: {
        isrc:         result.isrc,
        title:        result.title,
        artist:       result.artist,
        album:        result.album,
        album_art_url: enriched.artworkUrl ?? null,
        duration_ms:  result.duration_ms,
        bpm:          enriched.bpm ?? null,
        energy:       null,
      },
      confidence: result.confidence,
      source:     "acoustid",
    })
  })
}
