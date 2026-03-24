import type { FastifyInstance } from "fastify";
import { randomUUID } from "crypto";
import { db } from "../db/client";
import { redisClient } from "../redis";
import type { Room, RoomStateSnapshot, VibePreset } from "@partyglue/shared-types";
import { DEFAULT_CROWD_STATE } from "@partyglue/shared-types";

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
      name: name.trim(),
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

  // ─── DELETE /rooms/:id — End a room (HOST only) ───────────────────────────
  fastify.delete<{ Params: { id: string }; Body: { hostGuestId: string } }>("/rooms/:id", async (request, reply) => {
    const { id } = request.params;
    const { hostGuestId } = request.body;

    const raw = await redisClient.get(ROOM_KEY(id));
    if (!raw) return reply.code(404).send({ error: "ROOM_NOT_FOUND" });

    const room: Room = JSON.parse(raw);
    if (room.hostGuestId !== hostGuestId) {
      return reply.code(403).send({ error: "UNAUTHORIZED" });
    }

    // Expire Redis keys immediately
    await Promise.all([
      redisClient.del(ROOM_KEY(id)),
      redisClient.del(`room:${id}:state`),
      redisClient.del(`room:code:${room.code}`),
    ]);

    // Mark session as ended in PostgreSQL — optional
    db.query("UPDATE sessions SET ended_at = NOW() WHERE id = $1", [id])
      .catch((err) => console.warn("[api] session end write skipped:", err.message));

    return reply.send({ success: true });
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
