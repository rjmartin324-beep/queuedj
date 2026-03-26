import type { Server } from "socket.io";
import type { QueueItem, QueueRequestPayload, QueueRequestAck, VibeGuardrailResult } from "@queuedj/shared-types";
import { VIBE_GUARDRAIL_THRESHOLDS } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId, storeEvent } from "../../rooms/stateReconciliation";
import { db } from "../../db";
import { classifyTransition, neutralResult, type TrackAudioFeatures } from "../../lib/transitionClassifier";
import { logTrackRequest, logVote, logTrackSkip, logTrackComplete } from "../../lib/rlhf";
import { awardCredits, fingerprintGuest, incrementSessionStat } from "../../lib/credits";

const QUEUE_KEY = (roomId: string) => `experience:dj:queue:${roomId}`;

// ─── Queue Storage ────────────────────────────────────────────────────────────

export async function getQueue(roomId: string): Promise<QueueItem[]> {
  const raw = await redisClient.get(QUEUE_KEY(roomId));
  return raw ? JSON.parse(raw) : [];
}

export async function saveQueue(roomId: string, queue: QueueItem[]): Promise<void> {
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
  // Strategy: rule-based classifier runs first (always available, <1ms).
  // ML service called after — if it responds, its score wins (richer signal).
  // If ML is down or times out, rule-based result is already in hand.
  const nowPlayingIsrc = await getNowPlayingIsrc(roomId);
  let vibeDistanceScore = 0.3; // Neutral default

  if (nowPlayingIsrc) {
    // Rule-based first — synchronous, zero dependency
    const ruleResult = await classifyTransitionForTracks(nowPlayingIsrc, isrc, roomId);
    vibeDistanceScore = ruleResult.vibeDistanceScore;

    // Attempt ML enhancement (fire with timeout — best effort)
    try {
      const mlResult = await callMLCompatibility(nowPlayingIsrc, isrc, roomId);
      if (typeof mlResult.vibe_distance_score === "number") {
        vibeDistanceScore = mlResult.vibe_distance_score;
      }
    } catch {
      // ML unavailable — rule-based score stands
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

  // Log RLHF signal
  const crowdState = await getRoomCrowdState(roomId);
  logTrackRequest(roomId, isrc, crowdState);

  // Award vibe credits and track session stat for requesting a track (+2)
  awardCredits(fingerprintGuest(guestId), "track_request");
  incrementSessionStat(roomId, guestId, "requests");

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

export async function handleVoteCast(
  roomId: string,
  targetItemId: string,
  vote: "up" | "down",
  io: Server,
  guestId?: string,
): Promise<void> {
  const queue = await getQueue(roomId);
  const item = queue.find(i => i.id === targetItemId);
  if (!item) return;

  item.votes += vote === "up" ? 1 : -1;

  // Re-sort by votes descending, preserving relative order for ties
  queue.sort((a, b) => b.votes - a.votes);
  queue.forEach((i, pos) => { i.position = pos; });

  await saveQueue(roomId, queue);

  const seq = await getNextSequenceId(roomId);
  io.to(roomId).emit("queue:updated", queue, seq);

  // Log RLHF signal
  const crowdState = await getRoomCrowdState(roomId);
  logVote(roomId, item.track.isrc, vote, crowdState);

  // Award vibe credits and track session stat for casting a vote (+1)
  if (guestId) {
    awardCredits(fingerprintGuest(guestId), "vote_cast");
    incrementSessionStat(roomId, guestId, "votes");
  }
}

export async function handleQueueRemove(
  roomId: string,
  itemId: string,
  io: Server,
): Promise<void> {
  const queue = await getQueue(roomId);
  const removed = queue.find((i) => i.id === itemId);

  const updated = queue.filter((i) => i.id !== itemId);
  updated.forEach((i, pos) => { i.position = pos; });

  await saveQueue(roomId, updated);

  const seq = await getNextSequenceId(roomId);
  io.to(roomId).emit("queue:updated", updated, seq);

  // Log skip signal — host removing a track from the queue is a negative signal
  if (removed?.track?.isrc) {
    const crowdState = await getRoomCrowdState(roomId);
    logTrackSkip(roomId, removed.track.isrc, crowdState);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getTrackFeatures(isrc: string): Promise<TrackAudioFeatures | null> {
  try {
    const result = await db.query<{
      bpm: number | null;
      camelot_key: number | null;
      camelot_type: string | null;
      energy: number | null;
    }>(
      "SELECT bpm, camelot_key, camelot_type, energy FROM tracks WHERE isrc = $1",
      [isrc],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      bpm:         row.bpm         ?? 120,
      camelotKey:  row.camelot_key ?? 1,
      camelotType: (row.camelot_type as "A" | "B") ?? "B",
      energy:      row.energy      ?? 0.5,
    };
  } catch {
    return null;
  }
}

async function classifyTransitionForTracks(
  isrcA: string,
  isrcB: string,
  roomId: string,
): Promise<{ vibeDistanceScore: number }> {
  const [trackA, trackB] = await Promise.all([
    getTrackFeatures(isrcA),
    getTrackFeatures(isrcB),
  ]);

  if (!trackA || !trackB) return neutralResult();

  const crowdRaw = await redisClient.get(`experience:dj:${roomId}`);
  const crowdState = crowdRaw ? JSON.parse(crowdRaw).crowdState : "PEAK";

  return classifyTransition(trackA, trackB, crowdState);
}

async function getNowPlayingIsrc(roomId: string): Promise<string | null> {
  const raw = await redisClient.get(`experience:dj:${roomId}`);
  if (!raw) return null;
  return JSON.parse(raw).nowPlaying ?? null;
}

async function getRoomCrowdState(roomId: string): Promise<string | undefined> {
  const raw = await redisClient.get(`experience:dj:${roomId}`);
  if (!raw) return undefined;
  return JSON.parse(raw).crowdState ?? undefined;
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
