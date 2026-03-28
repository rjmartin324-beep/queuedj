import type { FastifyInstance } from "fastify";
import { randomUUID } from "crypto";
import { db } from "../db/client";
import { redisClient } from "../redis";
import type { Room, RoomStateSnapshot, VibePreset } from "@queuedj/shared-types";
import { DEFAULT_CROWD_STATE } from "@queuedj/shared-types";
import { sanitizeText } from "../middleware/sanitize";
import { requireApiKey } from "../middleware/auth";

// ─────────────────────────────────────────────────────────────────────────────
// Room Routes
//
// Rooms are ephemeral — state lives in Redis (DynamoDB in Phase 6).
// PostgreSQL only stores the session record for analytics/RLHF.
// Room TTL matches env ROOM_TTL_SECONDS (default 4 hours).
// ─────────────────────────────────────────────────────────────────────────────

const ROOM_TTL = parseInt(process.env.ROOM_TTL_SECONDS ?? "14400");
const ROOM_KEY = (id: string) => `room:${id}:meta`;

// Rate limit: 5 room creates per hour per IP (enforced by fastify-rate-limit plugin)
export async function roomRoutes(fastify: FastifyInstance) {

  // ─── POST /rooms — Create a room ─────────────────────────────────────────
  fastify.post<{
    Body: { hostGuestId: string; name: string; vibePreset?: VibePreset }
  }>("/rooms", {
    config: { rateLimit: { max: process.env.NODE_ENV === "production" ? 5 : 100, timeWindow: "1 hour" } },
    schema: {
      body: {
        type: "object",
        required: ["hostGuestId", "name"],
        properties: {
          hostGuestId: { type: "string", minLength: 10, maxLength: 64 },
          name: { type: "string", minLength: 1, maxLength: 60 },
          vibePreset: { type: "string", enum: ["open", "classy", "hype", "throwback", "family"] },
        },
      },
    },
  }, async (request, reply) => {
    const { hostGuestId, name, vibePreset = "open" } = request.body;

    const roomId = randomUUID();
    const code = generateRoomCode();

    const room: Room = {
      id: roomId,
      code,
      hostGuestId,
      name: sanitizeText(name, 60),
      vibePreset,
      crowdState: DEFAULT_CROWD_STATE,
      isLive: true,
      isBathroomBreakActive: false,
      createdAt: Date.now(),
      memberCount: 1,
      sequenceId: 0,
    };

    const snapshot: RoomStateSnapshot = {
      room,
      queue: [],
      members: [{
        guestId: hostGuestId,
        roomId,
        role: "HOST",
        joinedAt: Date.now(),
        isWorkerNode: false,
      }],
      sequenceId: 0,
      serverTimestamp: Date.now(),
    };

    // Store in Redis with TTL — this must succeed
    await Promise.all([
      redisClient.set(ROOM_KEY(roomId), JSON.stringify(room), { EX: ROOM_TTL }),
      redisClient.set(`room:${roomId}:state`, JSON.stringify(snapshot), { EX: ROOM_TTL }),
      redisClient.set(`room:code:${code}`, roomId, { EX: ROOM_TTL }),
    ]);

    // Add to public discovery feed
    redisClient.zAdd("public_rooms", [{ score: room.createdAt, value: roomId }]).catch(() => {});

    // Store session in PostgreSQL for analytics — optional, don't block room creation
    db.query(
      `INSERT INTO sessions (id, room_code, host_fingerprint, vibe_preset, feature_flags)
       VALUES ($1, $2, $3, $4, $5)`,
      [roomId, code, hash(hostGuestId), vibePreset, JSON.stringify(getActiveFeatureFlags())],
    ).catch((err) => {
      console.warn("[api] session write skipped (postgres unavailable):", err.message);
    });

    return reply.code(201).send({ room, hostToken: sign(roomId, hostGuestId) });
  });

  // ─── GET /rooms/:code — Look up room by display code ─────────────────────
  fastify.get<{ Params: { code: string } }>("/rooms/:code", async (request, reply) => {
    const code = request.params.code.toUpperCase();
    const roomId = await redisClient.get(`room:code:${code}`);

    if (!roomId) {
      return reply.code(404).send({ error: "ROOM_NOT_FOUND" });
    }

    const raw = await redisClient.get(ROOM_KEY(roomId));
    if (!raw) {
      return reply.code(404).send({ error: "ROOM_NOT_FOUND" });
    }

    const room: Room = JSON.parse(raw);
    // Return only public info for join screen — not full state
    return reply.send({
      id: room.id,
      code: room.code,
      name: room.name,
      vibePreset: room.vibePreset,
      memberCount: room.memberCount,
    });
  });

  // ─── GET /leaderboard/hosts — All-time host leaderboard ─────────────────
  fastify.get<{ Querystring: { limit?: string } }>("/leaderboard/hosts", async (request, reply) => {
    const limit = Math.min(parseInt(request.query.limit ?? "20"), 50);
    const result = await db.query(
      `SELECT
         host_fingerprint,
         COUNT(*)::int                    AS total_sessions,
         SUM(total_guests_joined)::int    AS total_guests,
         SUM(total_tracks_played)::int    AS total_tracks,
         MAX(peak_concurrent_guests)::int AS peak_guests,
         MAX(started_at)                  AS last_session_at
       FROM sessions
       WHERE host_fingerprint IS NOT NULL
         AND ended_at IS NOT NULL
       GROUP BY host_fingerprint
       ORDER BY total_sessions DESC, total_guests DESC
       LIMIT $1`,
      [limit],
    );
    return reply.send({ leaderboard: result.rows });
  });

  // ─── GET /rooms/:id/leaderboard — Per-session stats ─────────────────────
  fastify.get<{ Params: { id: string } }>("/rooms/:id/leaderboard", async (request, reply) => {
    const { id } = request.params;

    // Verify room exists
    const raw = await redisClient.get(ROOM_KEY(id));
    if (!raw) return reply.code(404).send({ error: "ROOM_NOT_FOUND" });

    const guestIds = await redisClient.sMembers(`session:${id}:guests`);
    if (!guestIds.length) return reply.send({ leaderboard: [] });

    const names = await redisClient.hGetAll(`session:${id}:guest_names`);

    const entries = await Promise.all(
      guestIds.map(async (guestId) => {
        const stats = await redisClient.hGetAll(`session:${id}:stats:${guestId}`);
        return {
          guestId,
          displayName: names[guestId] ?? "Guest",
          votes:     parseInt(stats.votes     ?? "0"),
          requests:  parseInt(stats.requests  ?? "0"),
          game_wins: parseInt(stats.game_wins ?? "0"),
          score:     parseInt(stats.votes ?? "0") + parseInt(stats.requests ?? "0") * 2 + parseInt(stats.game_wins ?? "0") * 10,
        };
      }),
    );

    entries.sort((a, b) => b.score - a.score);
    entries.forEach((e, i) => Object.assign(e, { rank: i + 1 }));

    return reply.send({ leaderboard: entries });
  });

  // ─── DELETE /rooms/:id — End a room (HOST only, requires x-api-key in prod) ─
  fastify.delete<{ Params: { id: string }; Body: { hostGuestId: string } }>("/rooms/:id", {
    preHandler: requireApiKey,
  }, async (request, reply) => {
    const { id } = request.params;
    const { hostGuestId } = request.body;

    const raw = await redisClient.get(ROOM_KEY(id));
    if (!raw) return reply.code(404).send({ error: "ROOM_NOT_FOUND" });

    const room: Room = JSON.parse(raw);
    if (room.hostGuestId !== hostGuestId) {
      return reply.code(403).send({ error: "UNAUTHORIZED" });
    }

    // Award full_session credits to all guests who participated
    try {
      const memberGuestIds = await redisClient.sMembers(`room:${id}:members`);
      const API_BASE = process.env.API_URL ?? `http://localhost:${process.env.API_PORT ?? 3001}`;
      memberGuestIds.forEach((gid) => {
        fetch(`${API_BASE}/credits/award`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ guestId: gid, reason: "full_session", sessionId: id }),
        }).catch(() => {});
      });
    } catch { /* non-critical */ }

    // Expire Redis keys immediately + remove from discovery feed
    await Promise.all([
      redisClient.del(ROOM_KEY(id)),
      redisClient.del(`room:${id}:state`),
      redisClient.del(`room:code:${room.code}`),
      redisClient.zRem("public_rooms", id),
    ]);

    // Mark session as ended in PostgreSQL with final stats
    const sessionGuestIds = await redisClient.sMembers(`session:${id}:guests`).catch(() => [] as string[]);
    const sessionTrackCount = await redisClient.lLen(`session:${id}:tracks`).catch(() => 0);
    db.query(
      `UPDATE sessions
       SET ended_at               = NOW(),
           total_guests_joined    = COALESCE($2, total_guests_joined),
           peak_concurrent_guests = GREATEST(COALESCE(peak_concurrent_guests, 0), $3),
           total_tracks_played    = COALESCE($4, 0)
       WHERE id = $1`,
      [id, sessionGuestIds.length || null, sessionGuestIds.length, sessionTrackCount],
    ).catch((err) => console.warn("[api] session end write skipped:", err.message));

    // Publish room:closed event so the realtime service can notify connected sockets
    redisClient.publish("room:closed", JSON.stringify({ roomId: id, code: room.code })).catch(() => {});

    // Trigger taste graph rebuild for this host (fire and forget)
    const ML_URL = process.env.ML_URL ?? "http://localhost:8000";
    fetch(`${ML_URL}/taste-graph/rebuild`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host_fingerprint: hash(hostGuestId) }),
    }).catch(() => {});

    return reply.send({ success: true });
  });

  // ─── GET /rooms/public — Discovery feed ──────────────────────────────────
  fastify.get<{ Querystring: { limit?: string } }>("/rooms/public", async (request, reply) => {
    const limit = Math.min(parseInt(request.query.limit ?? "20"), 50);

    // Newest rooms first (ZREVRANGE by score)
    const ids = await redisClient.zRange("public_rooms", 0, limit - 1, { REV: true });
    if (!ids.length) return reply.send({ rooms: [] });

    const raws = await Promise.all(ids.map((id) => redisClient.get(ROOM_KEY(id))));
    const rooms = raws
      .map((raw, i) => {
        if (!raw) return null;
        const r: Room = JSON.parse(raw);
        if (!r.isLive) return null;
        return {
          id:          r.id,
          code:        r.code,
          name:        r.name,
          vibePreset:  r.vibePreset,
          memberCount: r.memberCount,
          createdAt:   r.createdAt,
        };
      })
      .filter(Boolean);

    // Clean up stale entries that expired from Redis
    const staleIds = ids.filter((_, i) => !raws[i]);
    if (staleIds.length) {
      redisClient.zRem("public_rooms", staleIds).catch(() => {});
    }

    return reply.send({ rooms });
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generates a memorable 4-character room code. Avoids ambiguous chars (0, O, I, 1). */
function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** Lightweight HMAC sign for host token — not JWT, just tamper-proof */
function sign(roomId: string, guestId: string): string {
  const { createHmac } = require("crypto");
  const secret = process.env.HOST_TOKEN_SECRET ?? "dev_secret";
  return createHmac("sha256", secret).update(`${roomId}:${guestId}`).digest("hex");
}

/** One-way hash for guestId → host_fingerprint (GDPR: never store raw guestId) */
function hash(value: string): string {
  const { createHash } = require("crypto");
  return createHash("sha256").update(value).digest("hex");
}

function getActiveFeatureFlags(): Record<string, boolean> {
  return {
    stem_separation: process.env.FEATURE_STEM_SEPARATION === "true",
    rlhf_logging: process.env.FEATURE_RLHF_LOGGING === "true",
    haptic_sync: process.env.FEATURE_HAPTIC_SYNC === "true",
    generative_bridge: process.env.FEATURE_GENERATIVE_BRIDGE === "true",
  };
}
