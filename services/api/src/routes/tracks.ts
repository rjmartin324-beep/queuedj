import type { FastifyInstance } from "fastify";
import { db } from "../db/client";
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { stemsExist, getPresignedStemUrls } from "../lib/r2";
import { queueManager } from "../queue/bullmq";

const ITUNES_SEARCH_URL = "https://itunes.apple.com/search";

interface NormalizedTrack {
  isrc:          string;
  title:         string;
  artist:        string;
  album:         string | null;
  album_art_url: string | null;
  duration_ms:   number | null;
  bpm:           number | null;
  energy:        number | null;
  preview_url:   string | null;
  source:        "db" | "itunes";
}

async function searchItunes(query: string, limit: number): Promise<NormalizedTrack[]> {
  try {
    const params = new URLSearchParams({
      term:   query,
      entity: "song",
      media:  "music",
      limit:  String(limit),
    });
    const res  = await fetch(`${ITUNES_SEARCH_URL}?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json() as { results?: any[] };
    return (data.results ?? [])
      .filter((r: any) => r.previewUrl)
      .map((r: any) => ({
        isrc:          `itunes:${r.trackId}`,
        title:         r.trackName     ?? "",
        artist:        r.artistName    ?? "",
        album:         r.collectionName ?? null,
        album_art_url: (r.artworkUrl100 as string | undefined)?.replace("100x100", "300x300") ?? null,
        duration_ms:   r.trackTimeMillis ?? null,
        bpm:           null,
        energy:        null,
        preview_url:   r.previewUrl,
        source:        "itunes" as const,
      }));
  } catch {
    return [];
  }
}

const execFileAsync = promisify(execFile);

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

    // ── 1. Search Postgres (tracks we've already analyzed — have BPM/key) ────
    let dbTracks: NormalizedTrack[] = [];
    try {
      const result = await db.query<{
        isrc: string; title: string; artist: string;
        album: string | null; album_art_url: string | null;
        duration_ms: number | null; bpm: number | null; energy: number | null;
      }>(
        `SELECT isrc, title, artist, album, album_art_url, duration_ms, bpm, energy
         FROM tracks
         WHERE title % $1 OR artist % $1
         ORDER BY GREATEST(similarity(title, $1), similarity(artist, $1)) DESC
         LIMIT $2`,
        [query, limit],
      );
      dbTracks = result.rows.map((r) => ({ ...r, preview_url: null, source: "db" as const }));
    } catch {
      // pg_trgm not available — LIKE fallback
      try {
        const result = await db.query<{
          isrc: string; title: string; artist: string;
          album: string | null; album_art_url: string | null;
          duration_ms: number | null; bpm: number | null; energy: number | null;
        }>(
          `SELECT isrc, title, artist, album, album_art_url, duration_ms, bpm, energy
           FROM tracks WHERE title ILIKE $1 OR artist ILIKE $1 ORDER BY title LIMIT $2`,
          [`%${query}%`, limit],
        );
        dbTracks = result.rows.map((r) => ({ ...r, preview_url: null, source: "db" as const }));
      } catch { /* DB unavailable — iTunes only */ }
    }

    // ── 2. Supplement with iTunes when DB has fewer results than requested ───
    // iTunes runs in parallel only when needed, adds preview URLs for tracks
    // not yet in the local cache. De-duped by normalised title+artist pair.
    const remaining = limit - dbTracks.length;
    let merged: NormalizedTrack[] = dbTracks;

    if (remaining > 0) {
      const itunesTracks = await searchItunes(query, Math.min(remaining + 5, 20));

      // Build a set of "title|artist" keys already covered by DB results
      const dbKeys = new Set(
        dbTracks.map((t) => `${t.title.toLowerCase()}|${t.artist.toLowerCase()}`)
      );

      const novel = itunesTracks.filter(
        (t) => !dbKeys.has(`${t.title.toLowerCase()}|${t.artist.toLowerCase()}`)
      ).slice(0, remaining);

      merged = [...dbTracks, ...novel];
    }

    return reply.send({ tracks: merged });
  });

  // ─── GET /tracks/:isrc ────────────────────────────────────────────────────
  // Returns full track metadata including audio features.
  // Used by the mobile app to show track details and compatibility info.
  fastify.get<{ Params: { isrc: string } }>("/tracks/:isrc", async (request, reply) => {
    const { isrc } = request.params;

    const result = await db.query(
      `SELECT
         isrc, title, artist, album, album_art_url, duration_ms,
         bpm, camelot_key, camelot_type, energy, danceability, valence, genre,
         mood, artist_bio, artist_image_url, release_date, similar_tracks,
         no_derivative, analysis_confidence, analysis_source,
         intro_end_ms, first_drop_ms, outro_start_ms
       FROM tracks WHERE isrc = $1`,
      [isrc],
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({ error: "TRACK_NOT_FOUND" });
    }

    return reply.send(result.rows[0]);
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

  // ─── GET /tracks/:isrc/similar — BPM/key/energy-compatible recommendations ─
  // Returns up to `limit` tracks with compatible Camelot key, similar BPM,
  // and matching energy. Excludes ISRCs in the optional `exclude` list.
  // Falls back to genre/mood match when camelot data is unavailable.
  fastify.get<{
    Params: { isrc: string };
    Querystring: { limit?: string; exclude?: string };
  }>("/tracks/:isrc/similar", async (request, reply) => {
    const { isrc } = request.params;
    const limit    = Math.min(parseInt(request.query.limit ?? "10"), 30);
    const exclude  = request.query.exclude ? request.query.exclude.split(",") : [];
    exclude.push(isrc); // never return the seed track

    // Get source track features
    const src = await db.query<{
      bpm: number | null; camelot_key: number | null; camelot_type: string | null;
      energy: number | null; genre: string | null; mood: string | null;
    }>(
      "SELECT bpm, camelot_key, camelot_type, energy, genre, mood FROM tracks WHERE isrc = $1",
      [isrc],
    );

    if (src.rows.length === 0) {
      return reply.code(404).send({ error: "TRACK_NOT_FOUND" });
    }

    const { bpm, camelot_key, camelot_type, energy, genre, mood } = src.rows[0];

    let tracks: unknown[];

    if (camelot_key != null && bpm != null) {
      // Compatible Camelot keys: same key, +1/-1 key in same type, parallel type
      const compatKeys: number[] = [
        camelot_key,
        ((camelot_key) % 12) + 1,
        camelot_key === 1 ? 12 : camelot_key - 1,
      ];
      const compatTypes = camelot_type === "A" ? ["A", "B"] : ["B", "A"];

      const result = await db.query<{
        isrc: string; title: string; artist: string;
        bpm: number | null; camelot_key: number | null; camelot_type: string | null;
        energy: number | null; album_art_url: string | null;
      }>(
        `SELECT isrc, title, artist, bpm, camelot_key, camelot_type, energy, album_art_url
         FROM tracks
         WHERE
           camelot_key = ANY($1::int[])
           AND camelot_type = ANY($2::text[])
           AND bpm BETWEEN $3 AND $4
           AND isrc <> ALL($5::text[])
           AND analysis_confidence > 0.5
         ORDER BY ABS(COALESCE(bpm, $6) - $6), ABS(COALESCE(energy, 0.5) - $7)
         LIMIT $8`,
        [
          compatKeys,
          compatTypes,
          bpm * 0.92,
          bpm * 1.08,
          exclude,
          bpm,
          energy ?? 0.5,
          limit,
        ],
      );
      tracks = result.rows;
    } else {
      // Fallback: genre/mood match
      const result = await db.query(
        `SELECT isrc, title, artist, bpm, camelot_key, camelot_type, energy, album_art_url
         FROM tracks
         WHERE
           (genre = $1 OR mood = $2)
           AND isrc <> ALL($3::text[])
           AND analysis_confidence > 0.3
         ORDER BY RANDOM()
         LIMIT $4`,
        [genre ?? "", mood ?? "", exclude, limit],
      );
      tracks = result.rows;
    }

    return reply.send({ tracks, seed: isrc });
  });

  // ─── POST /tracks/fingerprint — file upload → AcoustID → resolved track ──
  // Accepts a multipart audio file, runs fpcalc to generate a chromaprint
  // fingerprint, then resolves the ISRC via AcoustID. Returns track metadata
  // or an error if fingerprinting fails.
  fastify.post("/tracks/fingerprint", async (request, reply) => {
    const data = await (request as any).file() as {
      filename: string;
      mimetype: string;
      toBuffer: () => Promise<Buffer>;
    } | undefined;

    if (!data) {
      return reply.code(400).send({ error: "No file uploaded" });
    }

    const tmpPath = join(tmpdir(), `queuedj_${randomUUID()}_${data.filename ?? "track.mp3"}`);

    try {
      const buffer = await data.toBuffer();
      await writeFile(tmpPath, buffer);

      // Run fpcalc (chromaprint) to generate fingerprint
      const { stdout } = await execFileAsync("fpcalc", ["-json", tmpPath], { timeout: 30_000 });
      const fpResult = JSON.parse(stdout) as { duration: number; fingerprint: string };

      const duration    = fpResult.duration;
      const fingerprint = fpResult.fingerprint;

      // Resolve via AcoustID
      const ACOUSTID_API_KEY = process.env.ACOUSTID_API_KEY ?? "";
      const params = new URLSearchParams({
        client:      ACOUSTID_API_KEY,
        fingerprint,
        duration:    String(Math.round(duration)),
        meta:        "recordings releasegroups",
        format:      "json",
      });

      const acoustRes = await fetch(`https://api.acoustid.org/v2/lookup?${params.toString()}`);
      if (!acoustRes.ok) throw new Error(`AcoustID HTTP ${acoustRes.status}`);

      const acoustData = await acoustRes.json() as {
        status: string;
        results?: Array<{
          score: number;
          recordings?: Array<{
            title?: string;
            duration?: number;
            artists?: Array<{ name: string }>;
            releasegroups?: Array<{ title: string }>;
            isrcs?: string[];
          }>;
        }>;
      };

      if (acoustData.status !== "ok" || !acoustData.results?.length) {
        return reply.code(404).send({ error: "TRACK_NOT_FOUND" });
      }

      const best       = acoustData.results[0];
      const confidence = best.score ?? 0;
      const recording  = best.recordings?.[0];

      if (!recording || !recording.isrcs?.length || confidence < 0.5) {
        return reply.code(404).send({ error: "TRACK_NOT_FOUND", confidence });
      }

      const isrc   = recording.isrcs[0];
      const title  = recording.title  ?? "Unknown";
      const artist = recording.artists?.[0]?.name ?? "Unknown Artist";
      const bpm    = null as number | null; // ML fills this async

      // Upsert into tracks table
      await db.query(
        `INSERT INTO tracks (isrc, title, artist, analysis_source, analysis_confidence, updated_at)
         VALUES ($1, $2, $3, 'acoustid', $4, NOW())
         ON CONFLICT (isrc) DO UPDATE SET
           title               = COALESCE(EXCLUDED.title, tracks.title),
           artist              = COALESCE(EXCLUDED.artist, tracks.artist),
           analysis_confidence = GREATEST(EXCLUDED.analysis_confidence, tracks.analysis_confidence),
           updated_at          = NOW()`,
        [isrc, title, artist, confidence],
      );

      // Trigger async BPM analysis (fire and forget)
      const ML_URL = process.env.ML_URL ?? "http://localhost:8000";
      fetch(`${ML_URL}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isrc, priority: "bpm_key_only" }),
      }).catch(() => {});

      return reply.send({ isrc, title, artist, bpm, confidence });
    } catch (err: any) {
      fastify.log.warn({ err }, "[tracks/fingerprint] error");
      if (err.code === "ENOENT" || err.message?.includes("fpcalc")) {
        return reply.code(503).send({ error: "FPCALC_UNAVAILABLE", message: "fpcalc not installed on server" });
      }
      return reply.code(500).send({ error: "FINGERPRINT_FAILED" });
    } finally {
      unlink(tmpPath).catch(() => {});
    }
  });

  // ─── POST /internal/stems ─────────────────────────────────────────────────
  // Called by the realtime service (fire-and-forget) when a track is loaded
  // onto a deck that supports stem mixing. Enqueues a Demucs separation job.
  //
  // Idempotent — safe to call multiple times for the same ISRC.
  // Job deduplication in BullMQ ensures only one job runs per ISRC.
  //
  // Responses:
  //   200  { jobId }             — job enqueued (or already in queue)
  //   200  { cached: true }      — stems already in R2, nothing to do
  //   403  { error: "NO_DERIVATIVE" }  — no_derivative flag set
  //   404  { error: "TRACK_NOT_FOUND" }
  fastify.post<{
    Body: { isrc: string; audioUrl: string }
  }>("/internal/stems", {
    schema: {
      body: {
        type: "object",
        required: ["isrc", "audioUrl"],
        properties: {
          isrc:     { type: "string", minLength: 10, maxLength: 12 },
          audioUrl: { type: "string", minLength: 1 },
        },
      },
    },
  }, async (request, reply) => {
    const { isrc, audioUrl } = request.body;

    const row = await db.query<{ no_derivative: boolean }>(
      "SELECT no_derivative FROM tracks WHERE isrc = $1",
      [isrc],
    );

    if (row.rows.length === 0) {
      return reply.code(404).send({ error: "TRACK_NOT_FOUND" });
    }

    if (row.rows[0].no_derivative) {
      return reply.code(403).send({ error: "NO_DERIVATIVE" });
    }

    // Skip enqueue if stems already done
    if (process.env.R2_ACCOUNT_ID && await stemsExist(isrc)) {
      return reply.send({ cached: true });
    }

    const jobId = await queueManager.addStemSeparation(isrc, audioUrl);
    return reply.send({ jobId });
  });

  // ─── GET /tracks/:isrc/stems ───────────────────────────────────────────────
  // Returns presigned R2 URLs for the four stem files (vocals/drums/bass/other).
  //
  // Responses:
  //   200  { vocals, drums, bass, other }  — stems ready, URLs valid for 1 hour
  //   202  { status: "pending" }           — stems not yet separated (job in queue)
  //   403  { error: "NO_DERIVATIVE" }      — no_derivative flag blocks stem use
  //   404  { error: "TRACK_NOT_FOUND" }    — ISRC unknown
  //   503  { error: "R2_NOT_CONFIGURED" }  — R2 env vars missing (dev/local)
  fastify.get<{ Params: { isrc: string } }>("/tracks/:isrc/stems", async (request, reply) => {
    const { isrc } = request.params;

    const row = await db.query<{ no_derivative: boolean }>(
      "SELECT no_derivative FROM tracks WHERE isrc = $1",
      [isrc],
    );

    if (row.rows.length === 0) {
      return reply.code(404).send({ error: "TRACK_NOT_FOUND" });
    }

    if (row.rows[0].no_derivative) {
      return reply.code(403).send({ error: "NO_DERIVATIVE" });
    }

    if (!process.env.R2_ACCOUNT_ID) {
      return reply.code(503).send({ error: "R2_NOT_CONFIGURED" });
    }

    const ready = await stemsExist(isrc);
    if (!ready) {
      return reply.code(202).send({ status: "pending" });
    }

    const urls = await getPresignedStemUrls(isrc);
    return reply.send(urls);
  });
}
