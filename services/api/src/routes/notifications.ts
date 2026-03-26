import type { FastifyInstance } from "fastify"
import { redisClient } from "../redis"

// ─────────────────────────────────────────────────────────────────────────────
// Notification Registration Routes
//
// POST /notifications/register   — store push token for a room participant
// POST /notifications/unregister — remove push token when leaving a room
//
// Tokens are stored in Redis under:
//   push:host:{roomId}        → single host token (string)
//   push:guests:{roomId}      → set of guest tokens
//
// TTL matches ROOM_TTL_SECONDS so tokens auto-expire with the room.
// ─────────────────────────────────────────────────────────────────────────────

const ROOM_TTL    = parseInt(process.env.ROOM_TTL_SECONDS ?? "14400")
const GLOBAL_TTL  = 30 * 24 * 60 * 60  // 30 days — persists across rooms

// Global token registry keys
const GLOBAL_HASH = "push:global:tokens"  // hash: guestId → pushToken

export async function notificationRoutes(fastify: FastifyInstance) {

  // POST /notifications/register
  fastify.post<{
    Body: { roomId: string; pushToken: string; role: "host" | "guest" }
  }>("/notifications/register", {
    schema: {
      body: {
        type: "object",
        required: ["roomId", "pushToken", "role"],
        properties: {
          roomId:    { type: "string" },
          pushToken: { type: "string" },
          role:      { type: "string", enum: ["host", "guest"] },
        },
      },
    },
  }, async (request, reply) => {
    const { roomId, pushToken, role } = request.body

    if (role === "host") {
      await redisClient.set(`push:host:${roomId}`, pushToken, { EX: ROOM_TTL })
    } else {
      await redisClient.sAdd(`push:guests:${roomId}`, pushToken)
      await redisClient.expire(`push:guests:${roomId}`, ROOM_TTL)
    }

    return reply.code(204).send()
  })

  // POST /notifications/register-global
  // Stores token persistently (30 days) so daily SOTD + streak jobs can reach the guest.
  fastify.post<{
    Body: { guestId: string; pushToken: string }
  }>("/notifications/register-global", {
    schema: {
      body: {
        type: "object",
        required: ["guestId", "pushToken"],
        properties: {
          guestId:   { type: "string" },
          pushToken: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    const { guestId, pushToken } = request.body
    // Store in the global hash — overwrites stale token for this guest
    await redisClient.hSet(GLOBAL_HASH, guestId, pushToken)
    return reply.code(204).send()
  })

  // POST /notifications/unregister
  fastify.post<{
    Body: { roomId: string; pushToken: string }
  }>("/notifications/unregister", {
    schema: {
      body: {
        type: "object",
        required: ["roomId", "pushToken"],
        properties: {
          roomId:    { type: "string" },
          pushToken: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    const { roomId, pushToken } = request.body

    // Remove from both sets (don't need to know which role)
    await Promise.allSettled([
      redisClient.del(`push:host:${roomId}`),
      redisClient.sRem(`push:guests:${roomId}`, pushToken),
    ])

    return reply.code(204).send()
  })
}

// ─── Helpers for other routes to look up tokens ───────────────────────────────

export async function getHostToken(roomId: string): Promise<string | null> {
  return redisClient.get(`push:host:${roomId}`)
}

export async function getGuestTokens(roomId: string): Promise<string[]> {
  return redisClient.sMembers(`push:guests:${roomId}`)
}

/** All globally registered push tokens — used for daily SOTD + streak jobs. */
export async function getAllGlobalTokens(): Promise<string[]> {
  const map = await redisClient.hGetAll(GLOBAL_HASH)
  return Object.values(map).filter(Boolean)
}

/** Token for a single guest — used for targeted streak reminders. */
export async function getGlobalToken(guestId: string): Promise<string | null> {
  return redisClient.hGet(GLOBAL_HASH, guestId)
}
