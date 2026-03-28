import type { FastifyInstance } from "fastify";
import { createHash } from "crypto";
import { db } from "../db/client";

// ─────────────────────────────────────────────────────────────────────────────
// Vibe Credits Routes
//
// GET  /credits/:guestId          — get current balance
// POST /credits/award             — award credits (realtime service calls this)
// POST /credits/spend             — spend credits (wardrobe / emote purchase)
// GET  /credits/:guestId/history  — ledger history
// ─────────────────────────────────────────────────────────────────────────────

function fingerprint(guestId: string): string {
  return createHash("sha256").update(guestId).digest("hex");
}

export async function creditRoutes(fastify: FastifyInstance) {

  // ─── GET /credits/:guestId ────────────────────────────────────────────────
  fastify.get<{ Params: { guestId: string } }>("/credits/:guestId", {
    config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    try {
      const fp = fingerprint(request.params.guestId);
      const result = await db.query<{ get_vibe_balance: number }>(
        "SELECT get_vibe_balance($1)", [fp],
      );
      const balance = result.rows[0]?.get_vibe_balance ?? 0;
      return reply.send({ balance });
    } catch {
      return reply.send({ balance: 0 });
    }
  });

  // ─── GET /credits/:guestId/history ────────────────────────────────────────
  fastify.get<{ Params: { guestId: string }; Querystring: { limit?: string } }>(
    "/credits/:guestId/history",
    async (request, reply) => {
      const fp  = fingerprint(request.params.guestId);
      const lim = Math.min(parseInt(request.query.limit ?? "20"), 50);
      const result = await db.query(
        `SELECT delta, balance_after, reason, created_at
         FROM vibe_credits
         WHERE guest_fingerprint = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [fp, lim],
      );
      return reply.send({ history: result.rows });
    },
  );

  // ─── POST /credits/award ──────────────────────────────────────────────────
  // Called by realtime service (internal) when earn triggers fire.
  // Also called at session end to award full_session credits to all guests.
  fastify.post<{
    Body: {
      guestId: string;
      reason: string;
      sessionId?: string;
      customAmount?: number;
    }
  }>("/credits/award", {
    config: { rateLimit: { max: 200, timeWindow: "1 minute" } },
    schema: {
      body: {
        type: "object",
        required: ["guestId", "reason"],
        properties: {
          guestId:      { type: "string" },
          reason:       { type: "string" },
          sessionId:    { type: "string" },
          customAmount: { type: "number" },
        },
      },
    },
  }, async (request, reply) => {
    const { guestId, reason, sessionId, customAmount } = request.body;
    const fp = fingerprint(guestId);

    const EARN_AMOUNTS: Record<string, number> = {
      vote_cast:     1,
      track_request: 2,
      game_win:      10,
      full_session:  5,
      admin_grant:   customAmount ?? 0,
    };

    const amount = customAmount ?? EARN_AMOUNTS[reason] ?? 0;
    if (!amount) return reply.send({ balance: 0, awarded: 0 });

    const result = await db.query<{ award_vibe_credits: number }>(
      "SELECT award_vibe_credits($1, $2, $3, $4)",
      [fp, amount, reason, sessionId ?? null],
    );
    const balance = result.rows[0]?.award_vibe_credits ?? 0;
    return reply.send({ balance, awarded: amount });
  });

  // ─── POST /credits/spend ──────────────────────────────────────────────────
  fastify.post<{
    Body: {
      guestId: string;
      amount: number;
      reason: "wardrobe_unlock" | "emote_purchase";
      itemId?: string;
      itemType?: string;
    }
  }>("/credits/spend", {
    schema: {
      body: {
        type: "object",
        required: ["guestId", "amount", "reason"],
        properties: {
          guestId:  { type: "string" },
          amount:   { type: "number", minimum: 1 },
          reason:   { type: "string", enum: ["wardrobe_unlock", "emote_purchase"] },
          itemId:   { type: "string" },
          itemType: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    const { guestId, amount, reason, itemId, itemType } = request.body;
    const fp = fingerprint(guestId);

    // Check balance
    const balResult = await db.query<{ get_vibe_balance: number }>(
      "SELECT get_vibe_balance($1)", [fp],
    );
    const current = balResult.rows[0]?.get_vibe_balance ?? 0;
    if (current < amount) {
      return reply.code(402).send({ error: "INSUFFICIENT_CREDITS", balance: current, required: amount });
    }

    // Deduct
    const spendResult = await db.query<{ award_vibe_credits: number }>(
      `INSERT INTO vibe_credits (guest_fingerprint, delta, balance_after, reason, item_id, item_type)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING balance_after`,
      [fp, -amount, current - amount, reason, itemId ?? null, itemType ?? null],
    );
    const newBalance = spendResult.rows[0]?.balance_after ?? current - amount;
    return reply.send({ success: true, balance: newBalance, spent: amount });
  });
}
