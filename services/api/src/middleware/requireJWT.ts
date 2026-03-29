import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from "fastify";
import { jwtVerify, importSPKI } from "jose";
import { db } from "../db/client";

// ─────────────────────────────────────────────────────────────────────────────
// requireJWT — Fastify preHandler hook for user auth
//
// Verifies the Bearer JWT from the Authorization header, checks the session
// hasn't been revoked, and attaches decoded payload to request.user.
// ─────────────────────────────────────────────────────────────────────────────

export interface JWTPayload {
  sub:     string;   // account.id
  jti:     string;   // account_sessions.jti
  guestId: string;   // account.primary_guest_id
  iat:     number;
  exp:     number;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: JWTPayload;
  }
}

let _secret: Uint8Array | null = null;
function getSecret(): Uint8Array {
  if (!_secret) {
    const raw = process.env.JWT_SECRET ?? "dev-secret-change-in-production";
    _secret = new TextEncoder().encode(raw);
  }
  return _secret;
}

export async function requireJWT(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const auth = request.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    reply.code(401).send({ error: "UNAUTHORIZED", message: "Bearer token required" });
    return;
  }

  const token = auth.slice(7);
  let payload: JWTPayload;

  try {
    const { payload: p } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    payload = p as unknown as JWTPayload;
  } catch {
    reply.code(401).send({ error: "UNAUTHORIZED", message: "Invalid or expired token" });
    return;
  }

  // Check the session hasn't been revoked
  try {
    const result = await db.query<{ revoked_at: Date | null }>(
      "SELECT revoked_at FROM account_sessions WHERE jti = $1",
      [payload.jti],
    );
    if (!result.rows.length || result.rows[0].revoked_at !== null) {
      reply.code(401).send({ error: "UNAUTHORIZED", message: "Session revoked" });
      return;
    }
  } catch {
    // DB error — fail open in dev, closed in prod
    if (process.env.NODE_ENV === "production") {
      reply.code(503).send({ error: "SERVICE_UNAVAILABLE" });
      return;
    }
  }

  request.user = payload;
}
