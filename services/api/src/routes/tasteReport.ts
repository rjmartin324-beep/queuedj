import type { FastifyInstance } from "fastify";
import { db } from "../db/client";

// ─────────────────────────────────────────────────────────────────────────────
// Weekly Taste Report — GET /taste-report/:guestId
//
// Aggregates the tracks a guest has voted on / requested in the last N days
// (default 7) to produce a lightweight music-taste profile.
//
// Returns:
//   { topGenres, topArtists, topTracks, avgBpm, avgEnergy, totalTracks }
// ─────────────────────────────────────────────────────────────────────────────

export async function tasteReportRoutes(fastify: FastifyInstance) {

  fastify.get<{
    Params: { guestId: string };
    Querystring: { days?: string };
  }>("/taste-report/:guestId", async (request, reply) => {
    const { guestId } = request.params;
    const days = Math.min(parseInt(request.query.days ?? "7", 10) || 7, 30);

    try {
      // Tracks the guest voted on or requested in the window
      // We join session_tracks → sessions → rooms → guest_votes/requests
      // For simplicity: pull tracks from rooms the guest participated in,
      // weighted by votes + requests.
      const { rows } = await db.query<{
        isrc:    string;
        title:   string;
        artist:  string;
        genre:   string | null;
        bpm:     number | null;
        energy:  number | null;
        weight:  string;
      }>(`
        SELECT
          t.isrc,
          t.title,
          t.artist,
          t.genre,
          t.bpm,
          t.energy,
          COALESCE(rv.votes, 0) + COALESCE(rr.requests, 0) AS weight
        FROM tracks t
        -- Votes this guest cast
        LEFT JOIN (
          SELECT isrc, COUNT(*) AS votes
          FROM track_votes
          WHERE guest_id = $1
            AND voted_at >= NOW() - ($2 || ' days')::INTERVAL
          GROUP BY isrc
        ) rv ON rv.isrc = t.isrc
        -- Requests this guest made
        LEFT JOIN (
          SELECT isrc, COUNT(*) AS requests
          FROM track_requests
          WHERE guest_id = $1
            AND requested_at >= NOW() - ($2 || ' days')::INTERVAL
          GROUP BY isrc
        ) rr ON rr.isrc = t.isrc
        WHERE (rv.votes IS NOT NULL OR rr.requests IS NOT NULL)
        ORDER BY weight DESC
        LIMIT 50
      `, [guestId, String(days)]);

      if (rows.length === 0) {
        return reply.send({
          topGenres: [], topArtists: [], topTracks: [],
          avgBpm: null, avgEnergy: null, totalTracks: 0,
        });
      }

      // Aggregate genres
      const genreMap = new Map<string, number>();
      for (const r of rows) {
        if (r.genre) genreMap.set(r.genre, (genreMap.get(r.genre) ?? 0) + Number(r.weight));
      }
      const topGenres = [...genreMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([genre, count]) => ({ genre, count }));

      // Aggregate artists
      const artistMap = new Map<string, number>();
      for (const r of rows) {
        artistMap.set(r.artist, (artistMap.get(r.artist) ?? 0) + Number(r.weight));
      }
      const topArtists = [...artistMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([artist, count]) => ({ artist, count }));

      // Top tracks
      const topTracks = rows.slice(0, 5).map(r => ({
        isrc: r.isrc, title: r.title, artist: r.artist, weight: Number(r.weight),
      }));

      // Averages (only tracks with bpm/energy data)
      const withBpm    = rows.filter(r => r.bpm    != null);
      const withEnergy = rows.filter(r => r.energy != null);
      const avgBpm    = withBpm.length    ? withBpm.reduce((s, r)    => s + r.bpm!,    0) / withBpm.length    : null;
      const avgEnergy = withEnergy.length ? withEnergy.reduce((s, r) => s + r.energy!, 0) / withEnergy.length : null;

      return reply.send({
        topGenres, topArtists, topTracks,
        avgBpm:    avgBpm    !== null ? Math.round(avgBpm)    : null,
        avgEnergy: avgEnergy !== null ? Math.round(avgEnergy * 100) / 100 : null,
        totalTracks: rows.length,
      });
    } catch (err: any) {
      fastify.log.error(err, "taste-report query failed");
      return reply.status(500).send({ error: "Failed to generate taste report" });
    }
  });
}
