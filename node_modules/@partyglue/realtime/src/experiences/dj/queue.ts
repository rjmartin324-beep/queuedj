import type { Server } from "socket.io";
import type { QueueItem, QueueRequestPayload, QueueRequestAck, VibeGuardrailResult } from "@partyglue/shared-types";
import { VIBE_GUARDRAIL_THRESHOLDS } from "@partyglue/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId, storeEvent } from "../../rooms/stateReconciliation";

const QUEUE_KEY = (roomId: string) => `experience:dj:queue:${roomId}`;

// ─── Queue Storage ────────────────────────────────────────────────────────────

export async function getQueue(roomId: string): Promise<QueueItem[]> {
  const raw = await redisClient.get(QUEUE_KEY(roomId));
  return raw ? JSON.parse(raw) : [];
}

async function saveQueue(roomId: string, queue: QueueItem[]): Promise<void> {
  await redisClient.set(QUEUE_KEY(roomId), JSON.stringify(queue));
}

// ─── Queue Request + Vibe Guardrail ──────────────────────────────────────────

export async function handleQueueRequest(
  payload: QueueRequestPayload,
  io: Server,
): Promise<QueueRequestAck> {
  const { roomId, guestId, isrc, title, artist, durationMs, sourcePlatform, artworkUrl } = payload;

  const queue = await getQueue(roomId);

  // ─── Vibe Guardrail Check ─────────────────────────────────────────────────
  const nowPlayingIsrc = await getNowPlayingIsrc(roomId);
  let vibeDistanceScore = 0.3; // Neutral default

  if (nowPlayingIsrc) {
    try {
      const mlResult = await callMLCompatibility(nowPlayingIsrc, isrc, roomId);
      vibeDistanceScore = mlResult.vibe_distance_score ?? 0.3;
    } catch {
      // ML unavailable — allow track with neutral score
    }
  }

  // Hard reject: vibe distance too high
  if (vibeDistanceScore >= VIBE_GUARDRAIL_THRESHOLDS.hardReject) {
    const guardrailResult: VibeGuardrailResult = {
      vibeDistanceScore,
      camelotCompatible: false,
      bpmCompatible: false,
      rejected: true,
      alternativePositionSuggestion: "Save this for later when the energy shifts",
    };
    return { accepted: false, guardrailResult };
  }

  // ─── Add to Queue ─────────────────────────────────────────────────────────
  const position = queue.length;

  const newItem: QueueItem = {
    id: generateId(),
    roomId,
    track: {
      isrc,
      title,
      artist,
      durationMs,
      sourcePlatform,
      artworkUrl,
    },
    requestedBy: guestId,
    requestedAt: Date.now(),
    votes: 0,
    position,
    vibeDistanceScore,
  };

  queue.push(newItem);
  queue.forEach((item, i) => { item.position = i; });

  await saveQueue(roomId, queue);

  const seq = await getNextSequenceId(roomId);
  await storeEvent(roomId, { sequenceId: seq, type: "queue_item_added", payload: newItem, timestamp: Date.now() });

  io.to(roomId).emit("queue:item_added", newItem);
  io.to(roomId).emit("queue:updated", queue, seq);

  // Trigger ML audio analysis in background (fire and forget)
  triggerAudioAnalysis(isrc);

  return {
    accepted: true,
    queuePosition: position,
    guardrailResult: vibeDistanceScore >= VIBE_GUARDRAIL_THRESHOLDS.softWarn
      ? { vibeDistanceScore, camelotCompatible: true, bpmCompatible: true, rejected: false, alternativePositionSuggestion: "This track has an unusual energy shift" }
      : undefined,
  };
}

export async function handleQueueReorder(
  roomId: string,
  itemId: string,
  newPosition: number,
  io: Server,
): Promise<void> {
  const queue = await getQueue(roomId);
  const idx = queue.findIndex((i) => i.id === itemId);
  if (idx === -1) return;

  const [item] = queue.splice(idx, 1);
  queue.splice(Math.min(newPosition, queue.length), 0, item);
  queue.forEach((i, pos) => { i.position = pos; });

  await saveQueue(roomId, queue);

  const seq = await getNextSequenceId(roomId);
  await storeEvent(roomId, { sequenceId: seq, type: "queue_reordered", payload: { itemId, newPosition }, timestamp: Date.now() });
  io.to(roomId).emit("queue:updated", queue, seq);
}

export async function handleQueueRemove(
  roomId: string,
  itemId: string,
  io: Server,
): Promise<void> {
  let queue = await getQueue(roomId);
  queue = queue.filter((i) => i.id !== itemId);
  queue.forEach((i, pos) => { i.position = pos; });

  await saveQueue(roomId, queue);

  const seq = await getNextSequenceId(roomId);
  io.to(roomId).emit("queue:updated", queue, seq);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getNowPlayingIsrc(roomId: string): Promise<string | null> {
  const raw = await redisClient.get(`experience:dj:${roomId}`);
  if (!raw) return null;
  return JSON.parse(raw).nowPlaying ?? null;
}

async function callMLCompatibility(isrcA: string, isrcB: string, roomId: string): Promise<any> {
  const ML_URL = process.env.ML_URL ?? "http://localhost:8000";
  const crowdRaw = await redisClient.get(`experience:dj:${roomId}`);
  const crowdState = crowdRaw ? JSON.parse(crowdRaw).crowdState : "PEAK";

  const res = await fetch(`${ML_URL}/compatibility`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isrc_a: isrcA, isrc_b: isrcB, crowd_state: crowdState }),
    signal: AbortSignal.timeout(3000),
  });
  return res.json();
}

async function triggerAudioAnalysis(isrc: string): Promise<void> {
  try {
    const API_URL = process.env.API_URL ?? "http://localhost:3001";
    await fetch(`${API_URL}/internal/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isrc, priority: "bpm_key_only" }),
    });
  } catch {
    // Non-critical — analysis will happen when track loads on device
  }
}

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
