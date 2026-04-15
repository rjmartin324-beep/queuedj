import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? "",
  environment: process.env.NODE_ENV ?? "development",
  enabled: !!process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
});

import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import { redisReady, redisClient } from "./redis";
import { db } from "./db/client";
import { runMigrations } from "./db/migrate";
import { roomRoutes } from "./routes/rooms";
import { trackRoutes } from "./routes/tracks";
import { spotifyRoutes } from "./routes/spotify";
import { acoustidRoutes } from "./routes/acoustid";
import { notificationRoutes } from "./routes/notifications";
import { historyRoutes } from "./routes/history";
import { creditRoutes } from "./routes/credits";
import { sotdRoutes } from "./routes/sotd";
import { tasteReportRoutes } from "./routes/tasteReport";
import { recommendationRoutes } from "./routes/recommendations";
import { authRoutes } from "./routes/auth";
import { statsRoutes } from "./routes/stats";
import { startScheduledJobs } from "./lib/scheduledJobs";

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
  // ─── Run DB migrations (idempotent — safe on every boot) ───────────────────
  await runMigrations();

  // ─── Wait for Redis before accepting traffic ────────────────────────────────
  await redisReady;

  // ─── Plugins ───────────────────────────────────────────────────────────────
  await fastify.register(cors, {
    origin: process.env.ALLOWED_ORIGINS?.split(",") ?? true,
    methods: ["GET", "POST", "DELETE", "OPTIONS", "PATCH"],
  });

  await fastify.register(rateLimit, {
    global: false, // Per-route limits only (rooms.ts sets its own)
    // redis: redisClient — node-redis v4 is not compatible with @fastify/rate-limit (needs ioredis)
    // Using in-memory store for dev. For production, swap redis package for ioredis.
    keyGenerator: (req) => req.ip,
  });

  // Multipart file uploads (used by /tracks/fingerprint)
  await fastify.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024,  // 50 MB max
      files: 1,
    },
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
  await fastify.register(spotifyRoutes, { prefix: "/" });
  await fastify.register(acoustidRoutes, { prefix: "/" });
  await fastify.register(notificationRoutes, { prefix: "/" });
  await fastify.register(historyRoutes, { prefix: "/" });
  await fastify.register(creditRoutes, { prefix: "/" });
  await fastify.register(sotdRoutes, { prefix: "/" });
  await fastify.register(tasteReportRoutes, { prefix: "/" });
  await fastify.register(recommendationRoutes, { prefix: "/" });
  await fastify.register(authRoutes,           { prefix: "/auth" });
  await fastify.register(statsRoutes,          { prefix: "/" });

  // ─── Start ─────────────────────────────────────────────────────────────────
  await fastify.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`[api] Fastify listening on :${PORT}`);

  // ─── Daily scheduled jobs (SOTD push + streak reminders) ───────────────────
  startScheduledJobs();
}

start().catch((err) => {
  console.error("[api] Fatal startup error", err);
  process.exit(1);
});
