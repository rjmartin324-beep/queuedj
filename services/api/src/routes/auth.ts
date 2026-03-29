import type { FastifyInstance } from "fastify";
import { jwtVerify, SignJWT, createRemoteJWKSet } from "jose";
import { randomUUID } from "crypto";
import { db } from "../db/client";
import { requireJWT, type JWTPayload } from "../middleware/requireJWT";

// ─────────────────────────────────────────────────────────────────────────────
// Auth Routes
//
// POST /auth/apple    — Sign in with Apple
// POST /auth/google   — Sign in with Google
// GET  /auth/me       — Get current account (requires JWT)
// POST /auth/link     — Link an anonymous guestId to the signed-in account
// DELETE /auth/signout — Revoke current session
// ─────────────────────────────────────────────────────────────────────────────

// ─── JWKS endpoints ──────────────────────────────────────────────────────────

const APPLE_JWKS  = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

// ─── JWT signing ─────────────────────────────────────────────────────────────

function getSecret(): Uint8Array {
  return new TextEncoder().encode(
    process.env.JWT_SECRET ?? "dev-secret-change-in-production",
  );
}

async function signJWT(accountId: string, jti: string, guestId: string): Promise<string> {
  return new SignJWT({ guestId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(accountId)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime("90d")
    .sign(getSecret());
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface AccountRow {
  id:               string;
  provider:         "apple" | "google";
  provider_id:      string;
  email:            string | null;
  display_name:     string | null;
  primary_guest_id: string;
  created_at:       Date;
}

async function upsertAccount(
  provider: "apple" | "google",
  providerId: string,
  email: string | null,
  displayName: string | null,
  deviceGuestId: string,
): Promise<{ account: AccountRow; isNew: boolean }> {
  // Check if account exists
  const existing = await db.query<AccountRow>(
    "SELECT * FROM accounts WHERE provider = $1 AND provider_id = $2",
    [provider, providerId],
  );

  if (existing.rows.length) {
    // Update name/email if provided and changed
    const row = existing.rows[0];
    if (displayName && displayName !== row.display_name) {
      await db.query(
        "UPDATE accounts SET display_name = $1, updated_at = NOW() WHERE id = $2",
        [displayName, row.id],
      );
      row.display_name = displayName;
    }
    return { account: row, isNew: false };
  }

  // New account — canonical guestId is the device's current anon ID
  const result = await db.query<AccountRow>(
    `INSERT INTO accounts (provider, provider_id, email, display_name, primary_guest_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [provider, providerId, email, displayName, deviceGuestId],
  );
  return { account: result.rows[0], isNew: true };
}

async function createSession(accountId: string): Promise<string> {
  const jti = randomUUID();
  await db.query(
    `INSERT INTO account_sessions (account_id, jti)
     VALUES ($1, $2)`,
    [accountId, jti],
  );
  return jti;
}

// ─── Route handlers ───────────────────────────────────────────────────────────

export async function authRoutes(fastify: FastifyInstance) {

  // ─── POST /auth/apple ─────────────────────────────────────────────────────
  fastify.post<{
    Body: { identityToken: string; deviceGuestId: string; displayName?: string }
  }>("/apple", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    schema: {
      body: {
        type: "object",
        required: ["identityToken", "deviceGuestId"],
        properties: {
          identityToken: { type: "string" },
          deviceGuestId: { type: "string" },
          displayName:   { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    const { identityToken, deviceGuestId, displayName } = request.body;

    let sub: string;
    let email: string | null = null;

    try {
      const { payload } = await jwtVerify(identityToken, APPLE_JWKS, {
        issuer:   "https://appleid.apple.com",
        audience: process.env.APPLE_APP_BUNDLE_ID ?? "com.partyglue.app",
      });
      sub   = payload.sub as string;
      email = (payload.email as string | undefined) ?? null;
    } catch (err) {
      return reply.code(401).send({ error: "INVALID_TOKEN", message: "Apple identity token invalid" });
    }

    const { account, isNew } = await upsertAccount("apple", sub, email, displayName ?? null, deviceGuestId);

    // If returning user on a different device, guestId in account differs — client must update locally
    const jti = await createSession(account.id);
    const jwt = await signJWT(account.id, jti, account.primary_guest_id);

    return reply.send({
      jwt,
      guestId:      account.primary_guest_id,
      isNewAccount: isNew,
      account: {
        id:          account.id,
        provider:    account.provider,
        email:       account.email,
        displayName: account.display_name,
        createdAt:   account.created_at,
      },
    });
  });

  // ─── POST /auth/google ────────────────────────────────────────────────────
  fastify.post<{
    Body: { idToken: string; deviceGuestId: string }
  }>("/google", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    schema: {
      body: {
        type: "object",
        required: ["idToken", "deviceGuestId"],
        properties: {
          idToken:       { type: "string" },
          deviceGuestId: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    const { idToken, deviceGuestId } = request.body;

    let sub: string;
    let email: string | null = null;
    let displayName: string | null = null;

    try {
      const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
        issuer:   ["accounts.google.com", "https://accounts.google.com"],
        audience: process.env.GOOGLE_CLIENT_ID ?? "",
      });
      sub         = payload.sub as string;
      email       = (payload.email as string | undefined) ?? null;
      displayName = (payload.name as string | undefined) ?? null;
    } catch {
      return reply.code(401).send({ error: "INVALID_TOKEN", message: "Google ID token invalid" });
    }

    const { account, isNew } = await upsertAccount("google", sub, email, displayName, deviceGuestId);

    const jti = await createSession(account.id);
    const jwt = await signJWT(account.id, jti, account.primary_guest_id);

    return reply.send({
      jwt,
      guestId:      account.primary_guest_id,
      isNewAccount: isNew,
      account: {
        id:          account.id,
        provider:    account.provider,
        email:       account.email,
        displayName: account.display_name,
        createdAt:   account.created_at,
      },
    });
  });

  // ─── GET /auth/me ─────────────────────────────────────────────────────────
  fastify.get("/me", {
    preHandler: requireJWT,
  }, async (request, reply) => {
    const user = request.user!;

    const result = await db.query<AccountRow>(
      "SELECT * FROM accounts WHERE id = $1",
      [user.sub],
    );
    if (!result.rows.length) {
      return reply.code(404).send({ error: "ACCOUNT_NOT_FOUND" });
    }
    const account = result.rows[0];

    return reply.send({
      guestId: account.primary_guest_id,
      account: {
        id:          account.id,
        provider:    account.provider,
        email:       account.email,
        displayName: account.display_name,
        createdAt:   account.created_at,
      },
    });
  });

  // ─── POST /auth/link ──────────────────────────────────────────────────────
  // Links an anonymous guestId to the signed-in account so its credits are
  // accessible. The account's primary_guest_id is NOT changed — the anon ID
  // just gets recognized as "also belongs to this account".
  fastify.post<{
    Body: { anonGuestId: string }
  }>("/link", {
    preHandler: requireJWT,
    schema: {
      body: {
        type: "object",
        required: ["anonGuestId"],
        properties: { anonGuestId: { type: "string" } },
      },
    },
  }, async (request, reply) => {
    const { anonGuestId } = request.body;
    const user = request.user!;

    if (anonGuestId === user.guestId) {
      return reply.send({ merged: true, aliasesCreated: 0 });
    }

    // Store alias so future credit lookups for anonGuestId resolve to primary
    await db.query(
      `INSERT INTO account_guest_aliases (anon_guest_id, canonical_guest_id, account_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (anon_guest_id) DO NOTHING`,
      [anonGuestId, user.guestId, user.sub],
    ).catch(() => {}); // table may not exist yet — non-critical

    return reply.send({ merged: true, aliasesCreated: 1 });
  });

  // ─── DELETE /auth/signout ──────────────────────────────────────────────────
  fastify.delete("/signout", {
    preHandler: requireJWT,
  }, async (request, reply) => {
    const user = request.user!;
    await db.query(
      "UPDATE account_sessions SET revoked_at = NOW() WHERE jti = $1",
      [user.jti],
    );
    return reply.send({ ok: true });
  });
}
