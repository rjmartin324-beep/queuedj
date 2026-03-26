import type { RoomStateSnapshot, RoomEvent, RoomJoinAck, Room, QueueItem, RoomMember, Poll } from "@queuedj/shared-types";
import { MAX_EVENT_REPLAY_COUNT } from "@queuedj/shared-types";
import { redisClient } from "../redis";
import { restoreRoomIfNeeded } from "./snapshotService";

// ─────────────────────────────────────────────────────────────────────────────
// State Reconciliation
//
// Problem: Guests lose connection (bad Wi-Fi, backgrounded app, tunnel).
// When they reconnect, they may have missed events and are out of sync.
//
// Solution: Every room event gets a monotonically increasing sequenceId.
// On reconnect, guest sends their lastSequenceId.
// Server decides:
//   - Gap <= MAX_EVENT_REPLAY_COUNT: replay missed events (delta sync)
//   - Gap > MAX_EVENT_REPLAY_COUNT: send full state snapshot
//   - Guest is new (sequenceId = 0): send full state snapshot
//
// Events are stored in Redis as a capped list per room.
// TTL matches room TTL. No persistent storage needed.
// ─────────────────────────────────────────────────────────────────────────────

const EVENTS_KEY = (roomId: string) => `room:${roomId}:events`;
const STATE_KEY  = (roomId: string) => `room:${roomId}:state`;
const SEQ_KEY    = (roomId: string) => `room:${roomId}:seq`;

// Keep last 200 events in Redis per room (enough for any reasonable reconnect gap)
const MAX_STORED_EVENTS = 200;

// ─── Sequence ID ──────────────────────────────────────────────────────────────

export async function getNextSequenceId(roomId: string): Promise<number> {
  return await redisClient.incr(SEQ_KEY(roomId));
}

export async function getCurrentSequenceId(roomId: string): Promise<number> {
  const val = await redisClient.get(SEQ_KEY(roomId));
  return val ? parseInt(val) : 0;
}

// ─── Event Storage ────────────────────────────────────────────────────────────

export async function storeEvent(roomId: string, event: RoomEvent): Promise<void> {
  const key = EVENTS_KEY(roomId);
  // Store as JSON in a Redis list (newest at head)
  await redisClient.lPush(key, JSON.stringify(event));
  // Cap at MAX_STORED_EVENTS to control memory
  await redisClient.lTrim(key, 0, MAX_STORED_EVENTS - 1);
}

export async function getEventsAfterSequence(
  roomId: string,
  afterSequenceId: number,
): Promise<RoomEvent[]> {
  const key = EVENTS_KEY(roomId);
  const rawEvents = await redisClient.lRange(key, 0, MAX_STORED_EVENTS - 1);

  const events: RoomEvent[] = rawEvents
    .map((raw) => JSON.parse(raw) as RoomEvent)
    .filter((e) => e.sequenceId > afterSequenceId)
    .sort((a, b) => a.sequenceId - b.sequenceId); // Chronological order

  return events;
}

// ─── Room State Snapshot ──────────────────────────────────────────────────────

export async function storeRoomSnapshot(roomId: string, snapshot: RoomStateSnapshot): Promise<void> {
  await redisClient.set(STATE_KEY(roomId), JSON.stringify(snapshot));
}

export async function getRoomSnapshot(roomId: string): Promise<RoomStateSnapshot | null> {
  const raw = await redisClient.get(STATE_KEY(roomId));
  if (raw) return JSON.parse(raw) as RoomStateSnapshot;
  // Redis miss — attempt restore from PostgreSQL crash recovery snapshot
  return restoreRoomIfNeeded(roomId);
}

// ─── Reconciliation Decision ──────────────────────────────────────────────────

export interface ReconciliationResult {
  strategy: "full_snapshot" | "event_replay" | "already_current";
  snapshot?: RoomStateSnapshot;
  events?: RoomEvent[];
  currentSequenceId: number;
}

export async function reconcile(
  roomId: string,
  guestLastSequenceId: number,
): Promise<ReconciliationResult> {
  const currentSeq = await getCurrentSequenceId(roomId);

  // Already up to date
  if (guestLastSequenceId >= currentSeq) {
    return { strategy: "already_current", currentSequenceId: currentSeq };
  }

  const gap = currentSeq - guestLastSequenceId;

  // Gap is manageable — replay missed events
  if (gap <= MAX_EVENT_REPLAY_COUNT) {
    const events = await getEventsAfterSequence(roomId, guestLastSequenceId);
    return { strategy: "event_replay", events, currentSequenceId: currentSeq };
  }

  // Gap too large or guest is new — send full snapshot
  const snapshot = await getRoomSnapshot(roomId);
  if (!snapshot) {
    // Room state not in cache — this shouldn't happen but handle gracefully
    return { strategy: "full_snapshot", snapshot: undefined, currentSequenceId: currentSeq };
  }

  return { strategy: "full_snapshot", snapshot, currentSequenceId: currentSeq };
}

// ─── Ack Builder ─────────────────────────────────────────────────────────────

export function buildJoinAck(params: {
  success: boolean;
  role: RoomJoinAck["role"];
  guestId: string;
  currentSequenceId: number;
  guestLastSequenceId: number;
  error?: string;
}): RoomJoinAck {
  const gap = params.currentSequenceId - params.guestLastSequenceId;
  return {
    success: params.success,
    role: params.role,
    guestId: params.guestId,
    needsFullSync: gap > MAX_EVENT_REPLAY_COUNT || params.guestLastSequenceId === 0,
    currentSequenceId: params.currentSequenceId,
    error: params.error,
  };
}
