import type { FastifyInstance } from "fastify";
import { createHash } from "crypto";
import { db } from "../db/client";

// ─────────────────────────────────────────────────────────────────────────────
// Recommendations Route — GET /recommendations/:guestId
//
// Returns scored track recommendations based on:
//   1. Host's style_profile (avg BPM, genre weights built from session history)
//   2. RLHF signals (skip, play_extended, vote_up/down) for this host
//   3. Crowd state + hour-of-day target BPM/energy tuning
//   4. Fallback: trending tracks (most played last 30 days) when no profile
//
// Also handles:
//   POST /recommendations/:guestId/feedback — thumbs up/down training signal
// ─────────────────────────────────────────────────────────────────────────────

// BPM targets per crowd state
const CROWD_BPM: Record<string, { target: number; range: number }> = {
  WARMUP:  { target: 100, range: 20 },
  PEAK:    { target: 128, range: 14 },
  COOL:    { target: 90,  range: 18 },
  DEFAULT: { target: 112, range: 24 },
};

// Energy targets per crowd state (0–1)
const CROWD_ENERGY: Record<string, number> = {
  WARMUP:  0.55,
  PEAK:    0.85,
  COOL:    0.40,
  DEFAULT: 0.65,
};

function hashGuestId(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

const ML_SERVICE_URL   = process.env.ML_SERVICE_URL ?? "http://localhost:8000";
const REBUILD_THRESHOLD = 5; // new signals since last rebuild before we retrain

// Fire-and-forget: call the ML service to rebuild this host's taste profile
async function triggerTasteGraphRebuild(fingerprint: string, log: any): Promise<void> {
  try {
    const resp = await fetch(`${ML_SERVICE_URL}/taste-graph/rebuild`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ host_fingerprint: fingerprint }),
      signal:  AbortSignal.timeout(10_000),
    });
    if (!resp.ok) log.warn("[recommendations] taste-graph rebuild non-OK", { status: resp.status });
  } catch (e: any) {
    log.warn("[recommendations] taste-graph rebuild unreachable", { error: e.message });
  }
}

// Camelot wheel: keys 1–12, types A/B. Distance wraps around (12→1).
export function camelotDistance(k1: number, k2: number): number {
  const diff = Math.abs(k1 - k2);
  return Math.min(diff, 12 - diff);
}

export function camelotScore(
  trackKey:     number | null,
  trackType:    string | null,
  preferredKeys: Array<{ key: number; type: string; weight: number }>,
): number {
  if (!trackKey || !trackType || !preferredKeys.length) return 0.5;
  for (const pk of preferredKeys.slice(0, 4)) {
    const dist     = camelotDistance(pk.key, trackKey);
    const sameMode = pk.type === trackType;
    if (dist === 0 && sameMode) return Math.min(1, 0.5 + pk.weight);
    if (dist <= 1 && sameMode) return Math.min(0.8, 0.3 + pk.weight * 0.7);
  }
  return 0.2;
}

export async function recommendationRoutes(fastify: FastifyInstance) {

  // ─── GET /recommendations/:guestId ──────────────────────────────────────────
  fastify.get<{
    Params: { guestId: string };
    Querystring: { crowd_state?: string; hour_of_day?: string; limit?: string };
  }>("/recommendations/:guestId", async (request, reply) => {
    const { guestId }  = request.params;
    const crowdState   = (request.query.crowd_state ?? "DEFAULT").toUpperCase();
    const limit        = Math.min(parseInt(request.query.limit ?? "15"), 30);
    const fingerprint  = hashGuestId(guestId);

    const bpmTarget   = CROWD_BPM[crowdState]    ?? CROWD_BPM.DEFAULT;
    let targetEnergy = CROWD_ENERGY[crowdState] ?? CROWD_ENERGY.DEFAULT;

    try {
      // ── 1. Load host style profile ───────────────────────────────────────────
      const { rows: profileRows } = await db.query<{
        avg_bpm:        number | null;
        bpm_variance:   number | null;
        genre_weights:  Record<string, number> | null;
        preferred_keys: Array<{ key: number; type: string; weight: number }> | null;
        energy_curve:   Record<string, number | null> | null;
        session_count:  number;
        updated_at:     string;
      }>(
        `SELECT avg_bpm, bpm_variance, genre_weights, preferred_keys, energy_curve, session_count, updated_at
         FROM style_profiles WHERE host_fingerprint = $1`,
        [fingerprint],
      );

      const profile       = profileRows[0] ?? null;
      const hasProfile    = !!profile && (profile.session_count ?? 0) > 0;
      const genreWeights  = (profile?.genre_weights  ?? {}) as Record<string, number>;
      const preferredKeys = (profile?.preferred_keys ?? []) as Array<{ key: number; type: string; weight: number }>;
      const energyCurve   = (profile?.energy_curve   ?? {}) as Record<string, number | null>;
      const bpmVariance   = profile?.bpm_variance ? Number(profile.bpm_variance) : null;
      const topGenres     = Object.entries(genreWeights)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([g]) => g);

      // Blend personal BPM with crowd-state target (30/70 personal/crowd)
      const targetBpm = hasProfile && profile!.avg_bpm != null
        ? Math.round(Number(profile!.avg_bpm) * 0.30 + bpmTarget.target * 0.70)
        : bpmTarget.target;

      // Use personal energy_curve for time-of-day if available, else crowd-state default
      const hourOfDay  = parseInt(request.query.hour_of_day ?? String(new Date().getUTCHours()));
      const timeBucket =
        hourOfDay >= 18 && hourOfDay < 21 ? "early" :
        hourOfDay >= 21 && hourOfDay < 24 ? "mid"   :
        hourOfDay >= 0  && hourOfDay < 3  ? "peak"  :
        hourOfDay >= 3  && hourOfDay < 6  ? "late"  :
        "day";
      const personalEnergy = energyCurve[timeBucket] ?? null;
      if (hasProfile && personalEnergy != null) targetEnergy = personalEnergy;

      // ── 2. Fetch time-decayed RLHF reward averages per track for this host ───
      // Decay constant: 30 days (2 592 000 s) — a 30-day-old signal has 37% the
      // weight of today's. Recent feedback dominates; old signals fade gracefully.
      const { rows: rlhfRows } = await db.query<{
        isrc: string; weighted_reward: number;
      }>(
        `SELECT r.isrc,
           SUM(r.reward * EXP(-EXTRACT(EPOCH FROM (NOW() - r.created_at)) / 2592000.0)) /
           NULLIF(SUM(EXP(-EXTRACT(EPOCH FROM (NOW() - r.created_at)) / 2592000.0)), 0)
             AS weighted_reward
         FROM rlhf_signals r
         JOIN sessions s ON s.id = r.session_id
         WHERE s.host_fingerprint = $1
           AND r.isrc IS NOT NULL
           AND r.created_at >= NOW() - INTERVAL '90 days'
         GROUP BY r.isrc`,
        [fingerprint],
      );
      const rlhfMap = new Map(rlhfRows.map(r => [r.isrc, Number(r.weighted_reward)]));

      // ── 3. Candidate tracks: BPM-filtered, excluding recently played ─────────
      const { rows: candidates } = await db.query<{
        isrc:         string;
        title:        string;
        artist:       string;
        bpm:          number | null;
        energy:       number | null;
        genre:        string | null;
        camelot_key:  number | null;
        camelot_type: string | null;
      }>(
        `SELECT t.isrc, t.title, t.artist, t.bpm, t.energy, t.genre, t.camelot_key, t.camelot_type
         FROM tracks t
         WHERE t.title IS NOT NULL
           AND (t.bpm IS NULL OR ABS(t.bpm - $2) < $3)
           AND t.isrc NOT IN (
             SELECT DISTINCT st.isrc
             FROM session_tracks st
             JOIN sessions s ON s.id = st.session_id
             WHERE s.host_fingerprint = $1
               AND st.played_at >= NOW() - INTERVAL '7 days'
           )
         LIMIT 300`,
        [fingerprint, targetBpm, bpmTarget.range * 2.5],
      );

      // ── 4. Score each candidate ──────────────────────────────────────────────
      const scored = candidates.map(t => {
        // BPM — tighten window using personal variance when available
        const bpmRange = bpmVariance ?? bpmTarget.range;
        const bpmScore = t.bpm != null
          ? Math.max(0, 1 - Math.abs(Number(t.bpm) - targetBpm) / bpmRange)
          : 0.5;

        const energyScore = t.energy != null
          ? Math.max(0, 1 - Math.abs(Number(t.energy) - targetEnergy) / 0.4)
          : 0.5;

        const genreScore = t.genre
          ? genreWeights[t.genre]
            ? Math.min(1, genreWeights[t.genre] * 2)
            : topGenres.includes(t.genre) ? 0.5 : 0.15
          : 0.2;

        // Time-decayed RLHF: recent skips/completions matter most
        const rlhfRaw   = rlhfMap.get(t.isrc);
        const rlhfScore = rlhfRaw != null ? (rlhfRaw + 1) / 2 : 0.5; // [-1,1] → [0,1]

        // Camelot key compatibility with host's preferred keys
        const keyScore = camelotScore(t.camelot_key, t.camelot_type, preferredKeys);

        // Weights: RLHF raised to 22% (was 10%), keys added at 5%, BPM/energy/genre trimmed
        const score = Math.round((
          bpmScore    * 0.30 +
          energyScore * 0.25 +
          genreScore  * 0.18 +
          rlhfScore   * 0.22 +
          keyScore    * 0.05
        ) * 1000) / 1000;

        return { isrc: t.isrc, title: t.title, artist: t.artist, bpm: t.bpm, energy: t.energy, genre: t.genre, score };
      });

      scored.sort((a, b) => b.score - a.score);
      let recs = scored.slice(0, limit);

      // ── 5. Fallback: trending tracks globally when nothing matched ────────────
      if (recs.length < 5) {
        const exclude = recs.map(r => r.isrc);
        const { rows: trending } = await db.query<{
          isrc: string; title: string; artist: string;
          bpm: number | null; energy: number | null; genre: string | null;
        }>(
          `SELECT t.isrc, t.title, t.artist, t.bpm, t.energy, t.genre
           FROM tracks t
           JOIN (
             SELECT isrc, COUNT(*) AS plays
             FROM session_tracks
             WHERE played_at >= NOW() - INTERVAL '30 days'
             GROUP BY isrc
             ORDER BY plays DESC
             LIMIT $1
           ) pop ON pop.isrc = t.isrc
           WHERE t.title IS NOT NULL
             AND ($2::varchar[] IS NULL OR t.isrc <> ALL($2::varchar[]))
           ORDER BY pop.plays DESC`,
          [limit - recs.length, exclude.length > 0 ? exclude : null],
        );

        const trendingScored = trending.map((t, i) => ({
          ...t,
          score: Math.max(0.30, 0.60 - i * (0.30 / limit)),
        }));

        recs = [...recs, ...trendingScored];
      }

      return reply.send({
        recommendations:    recs,
        profile_updated_at: profile?.updated_at ?? null,
        source: hasProfile ? "personal" : "trending",
      });

    } catch (err: any) {
      fastify.log.error(err, "[recommendations] query failed");
      return reply.status(500).send({ error: "Failed to generate recommendations" });
    }
  });

  // ─── POST /recommendations/:guestId/feedback ─────────────────────────────────
  // Stores a thumbs-up/down signal that improves future recommendations.
  // Maps to an rlhf_signals row so it feeds back into the scoring pipeline.
  fastify.post<{
    Params: { guestId: string };
    Body:   { isrc: string; signal: "up" | "down" };
  }>("/recommendations/:guestId/feedback", {
    schema: {
      body: {
        type: "object",
        required: ["isrc", "signal"],
        properties: {
          isrc:   { type: "string", minLength: 1, maxLength: 20 },
          signal: { type: "string", enum: ["up", "down"] },
        },
      },
    },
  }, async (request, reply) => {
    const { guestId }    = request.params;
    const { isrc, signal } = request.body;
    const fingerprint    = hashGuestId(guestId);
    const reward         = signal === "up" ? 0.8 : -0.8;

    try {
      // Find the most recent session for this host to attach the signal
      const { rows: sessionRows } = await db.query<{ id: string }>(
        `SELECT id FROM sessions WHERE host_fingerprint = $1
         ORDER BY started_at DESC LIMIT 1`,
        [fingerprint],
      );

      const sessionId = sessionRows[0]?.id;
      if (!sessionId) return reply.send({ ok: false, reason: "no_session" });

      await db.query(
        `INSERT INTO rlhf_signals (session_id, signal_type, reward, isrc, crowd_state)
         VALUES ($1, $2, $3, $4, 'MANUAL')`,
        [sessionId, signal === "up" ? "vote_up" : "vote_down", reward, isrc],
      );

      // ── RLHF training loop: rebuild taste profile once enough new signals pile up ─
      // Count signals logged since the last profile rebuild for this host.
      // When the threshold is reached, fire an async rebuild — future recommendation
      // calls will pick up the updated profile automatically.
      const { rows: pendingRows } = await db.query<{ count: string }>(
        `SELECT COUNT(*) AS count
         FROM rlhf_signals r
         JOIN sessions s ON s.id = r.session_id
         WHERE s.host_fingerprint = $1
           AND r.created_at > COALESCE(
             (SELECT updated_at FROM style_profiles WHERE host_fingerprint = $1),
             NOW() - INTERVAL '90 days'
           )`,
        [fingerprint],
      );
      if (parseInt(pendingRows[0]?.count ?? "0") >= REBUILD_THRESHOLD) {
        void triggerTasteGraphRebuild(fingerprint, fastify.log);
      }

      return reply.send({ ok: true });
    } catch (err: any) {
      fastify.log.error(err, "[recommendations/feedback] failed");
      return reply.status(500).send({ error: "Failed to record feedback" });
    }
  });
}
