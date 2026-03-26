import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from "fastify";

// ─────────────────────────────────────────────────────────────────────────────
// API Key Auth Middleware
//
// Provides a simple x-api-key guard for sensitive routes (DELETE /rooms/:id,
// /internal/* routes, admin operations).
//
// Behavior:
//   - Development (NODE_ENV !== "production"): always passes through.
//     This avoids auth friction during local development and testing.
//   - Production: requires the request header "x-api-key" to match the
//     INTERNAL_API_KEY environment variable. Returns 401 if missing or wrong.
//
// Usage (per-route):
//   fastify.delete("/rooms/:id", { preHandler: requireApiKey }, handler);
//
// Usage (prefix-wide via plugin onRequest hook):
//   fastify.addHook("onRequest", requireApiKey);
// ─────────────────────────────────────────────────────────────────────────────

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY ?? "";

/**
 * Fastify preHandler / onRequest hook that enforces x-api-key authentication.
 * Skipped entirely in non-production environments.
 */
export function requireApiKey(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction,
): void {
  // Skip auth check outside of production — developer ergonomics
  if (!IS_PRODUCTION) {
    return done();
  }

  // Warn on startup if the key is not configured
  if (!INTERNAL_API_KEY) {
    request.log.warn("[auth] INTERNAL_API_KEY is not set — all requests will be rejected");
  }

  const providedKey = request.headers["x-api-key"];

  if (!providedKey || providedKey !== INTERNAL_API_KEY) {
    reply.code(401).send({ error: "UNAUTHORIZED", message: "Valid x-api-key required" });
    return;
  }

  done();
}
