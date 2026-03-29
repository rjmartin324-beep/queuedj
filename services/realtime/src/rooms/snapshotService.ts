import { db } from "../db";
import { redisClient } from "../redis";
import { getRoomSnapshot, storeRoomSnapshot } from "./stateReconciliation";
import type { RoomStateSnapshot } from "@queuedj/shared-types";

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot Service — Crash Recovery
//
// Problem: Redis is ephemeral. If the server crashes, all room state is lost.
//          Guests trying to rejoin get ROOM_NOT_FOUND.
//
// Solution: Every 60 seconds, write the current Redis room snapshot to
//           PostgreSQL sessions.room_snapshot. On Redis miss, restore from PG.
//
// Guarantees:
//   - Max data loss: 60 seconds of room state
//   - Guests can always rejoin after server restart
//   - Clean shutdown (SIGTERM) triggers immediate full snapshot
// ─────────────────────────────────────────────────────────────────────────────

const SNAPSHOT_INTERVAL_MS = 60_000;
const ACTIVE_ROOMS_KEY = "active_rooms";

let snapshotTimer: NodeJS.Timer | null = null;

// ─── Track active rooms ───────────────────────────────────────────────────────

const ACTIVE_ROOMS_TTL_S = 12 * 3600; // 12h — refreshed on every room activation

export async function registerActiveRoom(roomId: string): Promise<void> {
  await redisClient.sAdd(ACTIVE_ROOMS_KEY, roomId);
  // Refresh TTL on every activation so the set survives as long as rooms are active.
  // If no room registers for 12h straight, the key expires and self-cleans.
  await redisClient.expire(ACTIVE_ROOMS_KEY, ACTIVE_ROOMS_TTL_S);
}

export async function unregisterActiveRoom(roomId: string): Promise<void> {
  await redisClient.sRem(ACTIVE_ROOMS_KEY, roomId);
}

async function getActiveRoomIds(): Promise<string[]> {
  return redisClient.sMembers(ACTIVE_ROOMS_KEY);
}

// ─── Snapshot a single room ───────────────────────────────────────────────────

export async function snapshotRoom(roomId: string): Promise<void> {
  try {
    const snapshot = await getRoomSnapshot(roomId);
    if (!snapshot) {
      // Room gone from Redis (expired or cleaned up) — remove stale active_rooms entry
      await unregisterActiveRoom(roomId);
      return;
    }

    await db.query(
      `UPDATE sessions
       SET room_snapshot = $1, snapshot_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(snapshot), roomId],
    );
  } catch (err: any) {
    console.warn(`[snapshot] Failed to snapshot room ${roomId}:`, err.message);
  }
}

// ─── Snapshot all active rooms ────────────────────────────────────────────────

export async function snapshotAllActiveRooms(): Promise<void> {
  const roomIds = await getActiveRoomIds();
  if (roomIds.length === 0) return;
  console.log(`[snapshot] Snapshotting ${roomIds.length} active rooms to PostgreSQL`);
  await Promise.allSettled(roomIds.map(snapshotRoom));
}

// ─── Restore from PostgreSQL if Redis is empty ────────────────────────────────

export async function restoreRoomIfNeeded(roomId: string): Promise<RoomStateSnapshot | null> {
  // Already in Redis — nothing to restore
  const existing = await getRoomSnapshot(roomId);
  if (existing) return existing;

  try {
    const result = await db.query<{ room_snapshot: RoomStateSnapshot }>(
      `SELECT room_snapshot FROM sessions WHERE id = $1 AND room_snapshot IS NOT NULL`,
      [roomId],
    );

    if (result.rows.length === 0 || !result.rows[0].room_snapshot) return null;

    const snapshot = result.rows[0].room_snapshot;
    console.log(`[snapshot] Restored room ${roomId} from PostgreSQL after Redis miss`);

    // Restore into Redis with fresh TTL
    const ttl = parseInt(process.env.ROOM_TTL_SECONDS ?? "14400");
    await Promise.all([
      redisClient.set(`room:${roomId}:state`, JSON.stringify(snapshot), { EX: ttl }),
      redisClient.set(`room:${roomId}:meta`, JSON.stringify(snapshot.room), { EX: ttl }),
      redisClient.set(`room:code:${snapshot.room.code}`, roomId, { EX: ttl }),
    ]);

    await registerActiveRoom(roomId);
    return snapshot;
  } catch (err: any) {
    console.warn(`[snapshot] Failed to restore room ${roomId}:`, err.message);
    return null;
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

export function startPeriodicSnapshots(): void {
  snapshotTimer = setInterval(snapshotAllActiveRooms, SNAPSHOT_INTERVAL_MS);
  console.log(`[snapshot] Periodic snapshots every ${SNAPSHOT_INTERVAL_MS / 1000}s`);
}

export function stopPeriodicSnapshots(): void {
  if (snapshotTimer) {
    clearInterval(snapshotTimer);
    snapshotTimer = null;
  }
}
