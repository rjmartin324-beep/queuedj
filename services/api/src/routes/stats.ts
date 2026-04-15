import type { FastifyInstance } from "fastify";
import { createHash } from "crypto";
import { db } from "../db/client";

// ─────────────────────────────────────────────────────────────────────────────
// Stats Routes
//
// GET /stats/:guestId — lifetime profile stats for a guest
// ─────────────────────────────────────────────────────────────────────────────

function fingerprint(guestId: string): string {
  return createHash("sha256").update(guestId).digest("hex");
}

export async function statsRoutes(fastify: FastifyInstance) {

  // ─── GET /stats/:guestId ──────────────────────────────────────────────────
  fastify.get<{ Params: { guestId: string } }>("/stats/:guestId", {
    config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    try {
      const fp = fingerprint(request.params.guestId);
      const hostHash = createHash("sha256").update(request.params.guestId).digest("hex");

      const [creditsResult, gameWinsResult, partiesResult, roomsHostedResult] = await Promise.all([
        // Current credit balance
        db.query<{ get_vibe_balance: number }>(
          "SELECT get_vibe_balance($1)", [fp],
        ).catch(() => ({ rows: [{ get_vibe_balance: 0 }] })),

        // Game wins from credits ledger
        db.query<{ count: string }>(
          `SELECT COUNT(*) AS count FROM vibe_credits
           WHERE guest_fingerprint = $1 AND reason = 'game_win'`,
          [fp],
        ).catch(() => ({ rows: [{ count: "0" }] })),

        // Parties joined (full_session credits = sessions where they were present)
        db.query<{ count: string }>(
          `SELECT COUNT(*) AS count FROM vibe_credits
           WHERE guest_fingerprint = $1 AND reason = 'full_session'`,
          [fp],
        ).catch(() => ({ rows: [{ count: "0" }] })),

        // Rooms hosted (sessions where this guestId was the host)
        db.query<{ count: string }>(
          `SELECT COUNT(*) AS count FROM sessions
           WHERE host_guest_id_hash = $1 AND ended_at IS NOT NULL`,
          [hostHash],
        ).catch(() => ({ rows: [{ count: "0" }] })),
      ]);

      return reply.send({
        roomsHosted:   parseInt(roomsHostedResult.rows[0]?.count ?? "0"),
        partiesJoined: parseInt(partiesResult.rows[0]?.count ?? "0"),
        gameWins:      parseInt(gameWinsResult.rows[0]?.count ?? "0"),
        totalCredits:  creditsResult.rows[0]?.get_vibe_balance ?? 0,
      });
    } catch {
      return reply.send({
        roomsHosted: 0, partiesJoined: 0, gameWins: 0, totalCredits: 0,
      });
    }
  });
}
