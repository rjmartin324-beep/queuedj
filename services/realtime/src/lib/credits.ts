/**
 * Vibe Credits — earn/spend ledger helpers for the realtime service.
 *
 * Earn amounts:
 *   vote_cast      +1   (voting a track up or down)
 *   track_request  +2   (requesting a track that gets accepted)
 *   game_win       +10  (winning a game round)
 *   full_session   +5   (staying for the full session)
 *
 * Spend is handled through the API service (wardrobe + emote purchase).
 * Realtime service only awards credits — never spends them.
 */

import { db } from "../db";
import { redisClient } from "../redis";

export type CreditReason =
  | "vote_cast"
  | "track_request"
  | "game_win"
  | "full_session"
  | "wardrobe_unlock"
  | "emote_purchase"
  | "admin_grant"
  | "refund";

const EARN_AMOUNTS: Partial<Record<CreditReason, number>> = {
  vote_cast:     1,
  track_request: 2,
  game_win:      10,
  full_session:  5,
};

/**
 * Award credits to a guest. Fire-and-forget — never throws.
 * Returns the new balance, or null on failure.
 */
export async function awardCredits(
  guestFingerprint: string,
  reason: CreditReason,
  sessionId?: string,
  customAmount?: number,
): Promise<number | null> {
  const amount = customAmount ?? EARN_AMOUNTS[reason];
  if (!amount || amount <= 0) return null;
  if (!guestFingerprint) return null;

  try {
    const result = await db.query<{ award_vibe_credits: number }>(
      "SELECT award_vibe_credits($1, $2, $3, $4)",
      [guestFingerprint, amount, reason, sessionId ?? null],
    );
    const balance = result.rows[0]?.award_vibe_credits ?? null;
    return balance;
  } catch (err) {
    // Credits are non-critical — log but never block the main flow
    console.warn("[credits] award failed", { guestFingerprint: guestFingerprint.slice(0, 8), reason, err });
    return null;
  }
}

/**
 * Award credits AND push a real-time  credits:awarded  event to the guest's socket room.
 * Pass the raw guestId (not fingerprint) — this function hashes it internally.
 */
export async function awardCreditsAndNotify(
  io: import("socket.io").Server,
  guestId: string,
  reason: CreditReason,
  sessionId?: string,
  customAmount?: number,
): Promise<void> {
  const fingerprint = fingerprintGuest(guestId);
  const amount      = customAmount ?? EARN_AMOUNTS[reason] ?? 0;
  const balance     = await awardCredits(fingerprint, reason, sessionId, customAmount);
  if (balance === null) return;
  // Emit directly to the guest's personal socket room (guests join `guest:<guestId>`)
  io.to(`guest:${guestId}`).emit("credits:awarded" as any, { guestId, delta: amount, balance });
}

/**
 * Get the current credit balance for a guest.
 */
export async function getBalance(guestFingerprint: string): Promise<number> {
  try {
    const result = await db.query<{ get_vibe_balance: number }>(
      "SELECT get_vibe_balance($1)",
      [guestFingerprint],
    );
    return result.rows[0]?.get_vibe_balance ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Hash a raw guestId into an anonymous fingerprint for the credits ledger.
 * Same algorithm as TasteGraphWorker.fingerprint() in Python.
 */
import { createHash } from "crypto";
export function fingerprintGuest(guestId: string): string {
  return createHash("sha256").update(guestId).digest("hex");
}

// ─── Per-session leaderboard stats (stored in Redis, ephemeral) ───────────────

export type SessionStat = "votes" | "requests" | "game_wins";

const SESSION_STATS_KEY  = (roomId: string, guestId: string) => `session:${roomId}:stats:${guestId}`;
const SESSION_NAMES_KEY  = (roomId: string)                  => `session:${roomId}:guest_names`;
const SESSION_GUESTS_KEY = (roomId: string)                  => `session:${roomId}:guests`;

const SESSION_TTL = 6 * 60 * 60; // 6 hours

/**
 * Increment a per-session stat counter for a guest.
 * Also records their display name for the leaderboard.
 * Fire-and-forget — never throws.
 */
export async function incrementSessionStat(
  roomId: string,
  guestId: string,
  stat: SessionStat,
  displayName?: string,
): Promise<void> {
  if (!roomId || !guestId) return;
  try {
    const statsKey = SESSION_STATS_KEY(roomId, guestId);
    await Promise.all([
      redisClient.hIncrBy(statsKey, stat, 1),
      redisClient.expire(statsKey, SESSION_TTL),
      redisClient.sAdd(SESSION_GUESTS_KEY(roomId), guestId),
      redisClient.expire(SESSION_GUESTS_KEY(roomId), SESSION_TTL),
      displayName
        ? redisClient.hSet(SESSION_NAMES_KEY(roomId), guestId, displayName)
        : Promise.resolve(),
      displayName
        ? redisClient.expire(SESSION_NAMES_KEY(roomId), SESSION_TTL)
        : Promise.resolve(),
    ]);
  } catch {
    // Non-critical — leaderboard is best-effort
  }
}
