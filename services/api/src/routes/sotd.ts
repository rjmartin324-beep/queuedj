import type { FastifyInstance } from "fastify";
import { redisClient } from "../redis";

// ─────────────────────────────────────────────────────────────────────────────
// Song of the Day — GET /sotd
//
// Returns today's curated track.  The data is stored manually (or by a cron)
// in Redis at key  sotd:<YYYY-MM-DD>.
//
// If no manual entry exists we fall back to a static seed track so the card
// always has *something* to show during early dev.
// ─────────────────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// Lightweight seed — rotate by day-of-year so it at least changes
const SEED_TRACKS = [
  {
    isrc: "USRC11703959", title: "Blinding Lights",       artist: "The Weeknd",
    artworkUrl: null, previewUrl: null,
    genre: "Synth-pop", bpm: 171, energy: 0.73,
    curatedNote: "The ultimate midnight drive anthem. Pure 80s energy.",
  },
  {
    isrc: "GBUM71507078", title: "Uptown Funk",           artist: "Mark Ronson ft. Bruno Mars",
    artworkUrl: null, previewUrl: null,
    genre: "Funk", bpm: 115, energy: 0.93,
    curatedNote: "Zero percent chance this doesn't make you move.",
  },
  {
    isrc: "USUM71402833", title: "Happy",                 artist: "Pharrell Williams",
    artworkUrl: null, previewUrl: null,
    genre: "Neo-soul", bpm: 160, energy: 0.81,
    curatedNote: "The literal definition of good vibes.",
  },
  {
    isrc: "GBUM71600102", title: "Shape of You",          artist: "Ed Sheeran",
    artworkUrl: null, previewUrl: null,
    genre: "Pop", bpm: 96, energy: 0.83,
    curatedNote: "Still a banger. Don't @ us.",
  },
  {
    isrc: "USRC11700282", title: "Starboy",               artist: "The Weeknd ft. Daft Punk",
    artworkUrl: null, previewUrl: null,
    genre: "Synthwave", bpm: 186, energy: 0.66,
    curatedNote: "Daft Punk on a Weeknd track. Need we say more?",
  },
  {
    isrc: "USSM10702991", title: "Mr. Brightside",        artist: "The Killers",
    artworkUrl: null, previewUrl: null,
    genre: "Indie Rock", bpm: 148, energy: 0.88,
    curatedNote: "The crowd knows every word. Every single time.",
  },
  {
    isrc: "GBCEJ0300099", title: "Somebody That I Used To Know", artist: "Gotye ft. Kimbra",
    artworkUrl: null, previewUrl: null,
    genre: "Indie Pop", bpm: 129, energy: 0.54,
    curatedNote: "Haunting, beautiful, and still bittersweet.",
  },
];

export async function sotdRoutes(fastify: FastifyInstance) {

  // ─── GET /sotd ──────────────────────────────────────────────────────────────
  fastify.get("/sotd", async (_request, reply) => {
    const dateStr = today();

    // Check Redis for a manually set SOTD
    try {
      const raw = await redisClient.get(`sotd:${dateStr}`);
      if (raw) {
        const data = JSON.parse(raw);
        return reply.send({ ...data, date: dateStr });
      }
    } catch { /* redis miss — fall through */ }

    // Deterministic seed fallback based on day-of-year
    const doy = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000,
    );
    const track = SEED_TRACKS[doy % SEED_TRACKS.length];

    return reply.send({ ...track, date: dateStr });
  });

  // ─── PUT /sotd (admin/cron only — sets tomorrow's or today's SOTD) ──────────
  fastify.put<{
    Body: {
      date?: string;
      isrc: string; title: string; artist: string;
      artworkUrl?: string | null; previewUrl?: string | null;
      genre?: string | null; bpm?: number | null; energy?: number | null;
      curatedNote?: string | null;
    };
  }>("/sotd", {
    config: { rateLimit: { max: 5, timeWindow: "1m" } },
  }, async (request, reply) => {
    const { date = today(), ...rest } = request.body;
    const payload = JSON.stringify(rest);
    // Store for 48 hours so tomorrow's can be pre-loaded
    await redisClient.setEx(`sotd:${date}`, 48 * 3600, payload);
    return reply.send({ ok: true, date });
  });
}
