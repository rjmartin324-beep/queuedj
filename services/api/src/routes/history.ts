import type { FastifyInstance } from "fastify";
import { createHash } from "crypto";
import { db } from "../db/client";

function hashGuestId(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

// ─────────────────────────────────────────────────────────────────────────────
// Session History Routes
//
// POST /sessions/:roomId/tracks   — record a track play during a session
// GET  /history/:hostGuestId      — fetch past sessions for a host (last 20)
// ─────────────────────────────────────────────────────────────────────────────

export async function historyRoutes(fastify: FastifyInstance) {

  // ─── POST /sessions/:roomId/tracks ─────────────────────────────────────────
  fastify.post<{
    Params: { roomId: string };
    Body: { isrc: string; title: string; artist: string; requestCount: number; voteCount: number };
  }>("/sessions/:roomId/tracks", async (request, reply) => {
    const { roomId } = request.params;
    const { isrc, title, artist, requestCount, voteCount } = request.body;

    try {
      // Upsert track metadata
      await db.query(
        `INSERT INTO tracks (isrc, title, artist)
         VALUES ($1, $2, $3)
         ON CONFLICT (isrc) DO UPDATE SET title = EXCLUDED.title, artist = EXCLUDED.artist`,
        [isrc, title, artist],
      );

      // Record session track play
      await db.query(
        `INSERT INTO session_tracks (session_id, isrc, played_at, request_count, vote_count)
         VALUES ($1, $2, NOW(), $3, $4)
         ON CONFLICT DO NOTHING`,
        [roomId, isrc, requestCount, voteCount],
      );

      // Increment session track count
      await db.query(
        `UPDATE sessions SET track_count = COALESCE(track_count, 0) + 1 WHERE id = $1`,
        [roomId],
      );

      return reply.send({ success: true });
    } catch (err: any) {
      // Session may not exist yet — silently skip
      fastify.log.warn("[history] track record skipped:", err.message);
      return reply.send({ success: false });
    }
  });

  // ─── GET /history/:hostGuestId ─────────────────────────────────────────────
  fastify.get<{ Params: { hostGuestId: string } }>("/history/:hostGuestId", async (request, reply) => {
    const { hostGuestId } = request.params;
    // Always hash before querying — never store raw guestId
    const fingerprint = hashGuestId(hostGuestId);

    try {
      // Fetch last 20 sessions for this host
      const { rows: sessions } = await db.query(
        `SELECT
           s.id, s.room_code, s.started_at, s.ended_at,
           s.total_guests_joined AS guest_count,
           s.total_tracks_played AS track_count,
           EXTRACT(EPOCH FROM (COALESCE(s.ended_at, NOW()) - s.started_at)) * 1000 AS duration_ms
         FROM sessions s
         WHERE s.host_fingerprint = $1
           AND s.started_at IS NOT NULL
         ORDER BY s.started_at DESC
         LIMIT 20`,
        [fingerprint],
      );

      if (sessions.length === 0) return reply.send({ sessions: [] });

      // Fetch top 5 tracks per session
      const sessionIds = sessions.map((s) => s.id);
      const { rows: tracks } = await db.query(
        `SELECT
           st.session_id, st.isrc, t.title, t.artist,
           st.request_count, st.vote_count, st.played_at
         FROM session_tracks st
         JOIN tracks t ON t.isrc = st.isrc
         WHERE st.session_id = ANY($1::uuid[])
         ORDER BY st.session_id, st.vote_count DESC`,
        [sessionIds],
      );

      // Group tracks by session
      const tracksBySession: Record<string, typeof tracks> = {};
      for (const track of tracks) {
        if (!tracksBySession[track.session_id]) tracksBySession[track.session_id] = [];
        if (tracksBySession[track.session_id].length < 5) {
          tracksBySession[track.session_id].push(track);
        }
      }

      const result = sessions.map((s) => ({
        id: s.id,
        roomCode: s.room_code,
        startedAt: s.started_at,
        endedAt: s.ended_at,
        guestCount: s.guest_count ?? 0,
        trackCount: s.track_count ?? 0,
        durationMs: Math.round(Number(s.duration_ms) ?? 0),
        topTracks: (tracksBySession[s.id] ?? []).map((t) => ({
          isrc: t.isrc,
          title: t.title,
          artist: t.artist,
          requestCount: t.request_count,
          voteCount: t.vote_count,
        })),
      }));

      return reply.send({ sessions: result });
    } catch (err: any) {
      fastify.log.error("[history] fetch error:", err.message);
      return reply.code(500).send({ error: "HISTORY_FETCH_FAILED" });
    }
  });

}
