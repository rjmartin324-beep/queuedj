/**
 * Cross-game session leaderboard.
 *
 * Maintains a running tally of scores across all games played in a session.
 * Stored as a Redis hash: session:{roomId}:scores → { guestId: totalPoints }
 *
 * TTL mirrors the session stats TTL (6 hours).
 */

import { redisClient } from "../redis";

const SESSION_SCORE_KEY = (roomId: string) => `session:${roomId}:scores`;
const SESSION_TTL = 6 * 60 * 60; // 6 hours, same as session stats

/**
 * Add points to a guest's session total for a room.
 * Idempotent — safe to call multiple times; values accumulate.
 */
export async function addSessionScore(roomId: string, guestId: string, points: number): Promise<void> {
  if (!roomId || !guestId || points === 0) return;
  try {
    const key = SESSION_SCORE_KEY(roomId);
    await redisClient.hIncrByFloat(key, guestId, points);
    await redisClient.expire(key, SESSION_TTL);
  } catch (err) {
    console.warn("[sessionLeaderboard] addSessionScore failed", { roomId: roomId.slice(0, 8), guestId: guestId.slice(0, 8), err });
  }
}

/**
 * Get all session scores for a room as a plain object: { guestId → totalPoints }.
 * Returns {} on error or when no data exists.
 */
export async function getSessionScores(roomId: string): Promise<Record<string, number>> {
  if (!roomId) return {};
  try {
    const raw = await redisClient.hGetAll(SESSION_SCORE_KEY(roomId));
    const out: Record<string, number> = {};
    for (const [guestId, val] of Object.entries(raw)) {
      out[guestId] = parseFloat(val) || 0;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Reset all session scores for a room. Call when a session ends or restarts.
 */
export async function resetSessionScores(roomId: string): Promise<void> {
  if (!roomId) return;
  try {
    await redisClient.del(SESSION_SCORE_KEY(roomId));
  } catch {
    // Non-critical
  }
}
