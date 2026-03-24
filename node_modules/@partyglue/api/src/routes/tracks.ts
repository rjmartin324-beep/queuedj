import type { FastifyInstance } from "fastify";
import { db } from "../db/client";

// ─────────────────────────────────────────────────────────────────────────────
// Track Routes
//
// /tracks/search  — fuzzy search by title + artist (powered by pg_trgm)
// /tracks/:isrc   — lookup a single track by ISRC
// /internal/analyze — called by realtime service to trigger audio analysis
//                     for a newly queued track
// ─────────────────────────────────────────────────────────────────────────────

export async function trackRoutes(fastify: FastifyInstance) {

  // ─── GET /tracks/search?q=...&limit=20 ───────────────────────────────────
  // Returns tracks matching the query. Used by the mobile queue request UI.
  // Falls back gracefully if pg_trgm is unavailable (LIKE search).
  fastify.get<{
    Querystring: { q: string; limit?: string }
  }>("/tracks/search", {
    schema: {
      querystring: {
        type: "object",
        required: ["q"],
        properties: {
          q:     { type: "string", minLength: 1, maxLength: 100 },
          limit: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    const query = request.query.q.trim();
    const limit = Math.min(parseInt(request.query.limit ?? "20"), 50);

    if (!query) return reply.send({ tracks: [] });

    try {
      // Trigram similarity search across title + artist
      // Similarity threshold 0.2 keeps results relevant without being too strict
      const result = await db.query<{
        isrc: string;
        title: string;
        artist: string;
        album: string | null;
        album_art_url: string | null;
        duration_ms: number | null;
        bpm: number | null;
        energy: number | null;
        similarity: number;
      }>(
        `SELECT
           isrc, title, artist, album, album_art_url, duration_ms, bpm, energy,
           GREATEST(
             similarity(title, $1),
             similarity(artist, $1)
           ) AS similarity
         FROM tracks
         WHERE
           title % $1 OR artist % $1
         ORDER BY similarity DESC
         LIMIT $2`,
        [query, limit],
      );

      return reply.send({ tracks: result.rows });
    } catch {
      // pg_trgm not available — fallback to LIKE
      const result = await db.query<{
        isrc: string;
        title: string;
        artist: string;
        album: string | null;
        album_art_url: string | null;
        duration_ms: number | null;
        bpm: number | null;
        energy: number | null;
      }>(
        `SELECT isrc, title, artist, album, album_art_url, duration_ms, bpm, energy
         FROM tracks
         WHERE
           title ILIKE $1 OR artist ILIKE $1
         ORDER BY title
         LIMIT $2`,
        [`%${query}%`, limit],
      );
      return reply.send({ tracks: result.rows });
    }
  });

  // ─── GET /tracks/:isrc ────────────────────────────────────────────────────
  // Returns full track metadata including audio features.
  // Used by the mobile app to show track details and compatibility info.
  fastify.get<{ Params: { isrc: string } }>("/tracks/:isrc", async (request, reply) => {
    const { isrc } = request.params;

    const result = await db.query(
      `SELECT
         isrc, title, artist, album, album_art_url, duration_ms,
         bpm, camelot_key, camelot_type, energy, valence, genre,
         no_derivative, analysis_confidence, analysis_source,
         intro_end_ms, first_drop_ms, outro_start_ms
       FROM tracks WHERE isrc = $1`,
      [isrc],
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({ error: "TRACK_NOT_FOUND" });
    }

    return reply.send({ track: result.rows[0] });
  });

  // ─── POST /internal/analyze ───────────────────────────────────────────────
  // Called by the realtime service (fire-and-forget) when a guest requests
  // a track. Triggers ML audio analysis if the track is missing data.
  //
  // Priority levels:
  //   bpm_key_only — fast analysis (BPM + Camelot key, ~2s)
  //   full         — full analysis (all features, ~15s)
  fastify.post<{
    Body: { isrc: string; priority?: "bpm_key_only" | "full" }
  }>("/internal/analyze", {
    schema: {
      body: {
        type: "object",
        required: ["isrc"],
        properties: {
          isrc:     { type: "string", minLength: 10, maxLength: 12 },
          priority: { type: "string", enum: ["bpm_key_only", "full"] },
        },
      },
    },
  }, async (request, reply) => {
    const { isrc, priority = "bpm_key_only" } = request.body;

    // Check if we already have good analysis data
    const existing = await db.query<{ analysis_confidence: number }>(
      "SELECT analysis_confidence FROM tracks WHERE isrc = $1",
      [isrc],
    );

    const confidence = existing.rows[0]?.analysis_confidence ?? 0;

    // Skip if we already have sufficient data for this priority level
    const sufficientThreshold = priority === "bpm_key_only" ? 0.5 : 0.8;
    if (confidence >= sufficientThreshold) {
      return reply.send({ queued: false, reason: "already_analyzed", confidence });
    }

    // Forward to ML service (fire and forget — don't block the response)
    const ML_URL = process.env.ML_URL ?? "http://localhost:8000";
    fetch(`${ML_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isrc, priority }),
      signal: AbortSignal.timeout(2000),
    }).catch(() => {
      // ML unavailable — track will be analyzed on next opportunity
      // Rule-based classifier in realtime service handles missing data gracefully
    });

    return reply.send({ queued: true, priority });
  });

  // ─── POST /tracks — Upsert a track record ────────────────────────────────
  // Used by the ML worker to write back analysis results.
  // Also used when a guest requests a track we haven't seen before.
  fastify.post<{
    Body: {
      isrc: string;
      title: string;
      artist: string;
      album?: string;
      artworkUrl?: string;
      durationMs?: number;
      bpm?: number;
      camelotKey?: number;
      camelotType?: "A" | "B";
      energy?: number;
      analysisSource?: string;
      analysisConfidence?: number;
    }
  }>("/tracks", {
    schema: {
      body: {
        type: "object",
        required: ["isrc", "title", "artist"],
        properties: {
          isrc:               { type: "string", minLength: 10, maxLength: 12 },
          title:              { type: "string", minLength: 1, maxLength: 255 },
          artist:             { type: "string", minLength: 1, maxLength: 255 },
          album:              { type: "string" },
          artworkUrl:         { type: "string" },
          durationMs:         { type: "number" },
          bpm:                { type: "number" },
          camelotKey:         { type: "number", minimum: 1, maximum: 12 },
          camelotType:        { type: "string", enum: ["A", "B"] },
          energy:             { type: "number", minimum: 0, maximum: 1 },
          analysisSource:     { type: "string" },
          analysisConfidence: { type: "number", minimum: 0, maximum: 1 },
        },
      },
    },
  }, async (request, reply) => {
    const {
      isrc, title, artist, album, artworkUrl, durationMs,
      bpm, camelotKey, camelotType, energy,
      analysisSource = "unknown", analysisConfidence = 0,
    } = request.body;

    await db.query(
      `INSERT INTO tracks (
         isrc, title, artist, album, album_art_url, duration_ms,
         bpm, camelot_key, camelot_type, energy,
         analysis_source, analysis_confidence, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
       ON CONFLICT (isrc) DO UPDATE SET
         title              = EXCLUDED.title,
         artist             = EXCLUDED.artist,
         album              = COALESCE(EXCLUDED.album, tracks.album),
         album_art_url      = COALESCE(EXCLUDED.album_art_url, tracks.album_art_url),
         duration_ms        = COALESCE(EXCLUDED.duration_ms, tracks.duration_ms),
         bpm                = COALESCE(EXCLUDED.bpm, tracks.bpm),
         camelot_key        = COALESCE(EXCLUDED.camelot_key, tracks.camelot_key),
         camelot_type       = COALESCE(EXCLUDED.camelot_type, tracks.camelot_type),
         energy             = COALESCE(EXCLUDED.energy, tracks.energy),
         analysis_source    = CASE
           WHEN EXCLUDED.analysis_confidence > tracks.analysis_confidence
           THEN EXCLUDED.analysis_source
           ELSE tracks.analysis_source
         END,
         analysis_confidence = GREATEST(EXCLUDED.analysis_confidence, tracks.analysis_confidence),
         updated_at         = NOW()`,
      [isrc, title, artist, album ?? null, artworkUrl ?? null, durationMs ?? null,
       bpm ?? null, camelotKey ?? null, camelotType ?? null, energy ?? null,
       analysisSource, analysisConfidence],
    );

    return reply.code(201).send({ isrc });
  });
}
