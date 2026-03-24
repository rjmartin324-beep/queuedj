import { createClient } from "redis";

// ─────────────────────────────────────────────────────────────────────────────
// Redis client for the API service.
// Used for room metadata TTL and rate-limit counters.
// (The realtime service has its own client + pub/sub pair.)
// ─────────────────────────────────────────────────────────────────────────────

export const redisClient = createClient({
  url: process.env.REDIS_URL ?? "redis://localhost:6379",
});

redisClient.on("error", (err) => console.error("[redis:api]", err));

// Connect immediately on module load — Fastify awaits this before serving traffic.
export const redisReady = redisClient.connect();
