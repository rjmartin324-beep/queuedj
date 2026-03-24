import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { redisReady, redisClient } from "./redis";
import { db } from "./db/client";
import { roomRoutes } from "./routes/rooms";
import { trackRoutes } from "./routes/tracks";

// ─────────────────────────────────────────────────────────────────────────────
// API Service — Fastify HTTP server
//
// Handles: room create/lookup, ISRC metadata, BullMQ job submission
// Does NOT handle: real-time events (that's the realtime service on port 3002)
// ─────────────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.API_PORT ?? "3001");

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === "production" ? "warn" : "info",
    transport: process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
  },
});

async function start() {
  // ─── Wait for Redis before accepting traffic ────────────────────────────────
  await redisReady;

  // ─── Plugins ───────────────────────────────────────────────────────────────
  await fastify.register(cors, {
    origin: process.env.ALLOWED_ORIGINS?.split(",") ?? true,
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
  });

  await fastify.register(rateLimit, {
    global: false, // Per-route limits only (rooms.ts sets its own)
    // redis: redisClient — node-redis v4 is not compatible with @fastify/rate-limit (needs ioredis)
    // Using in-memory store for dev. For production, swap redis package for ioredis.
    keyGenerator: (req) => req.ip,
  });

  // ─── Health check ───────────────────────────────────────────────────────────
  fastify.get("/health", async () => {
    const [pgResult] = await db.query("SELECT 1").then((r) => r.rows).catch(() => [null]);
    const redisOk = await redisClient.ping().then(() => true).catch(() => false);
    return {
      status: pgResult && redisOk ? "ok" : "degraded",
      postgres: !!pgResult,
      redis: redisOk,
      timestamp: Date.now(),
    };
  });

  // ─── Routes ────────────────────────────────────────────────────────────────
  await fastify.register(roomRoutes, { prefix: "/" });
  await fastify.register(trackRoutes, { prefix: "/" });

  // ─── Start ─────────────────────────────────────────────────────────────────
  await fastify.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`[api] Fastify listening on :${PORT}`);
}

start().catch((err) => {
  console.error("[api] Fatal startup error", err);
  process.exit(1);
});
