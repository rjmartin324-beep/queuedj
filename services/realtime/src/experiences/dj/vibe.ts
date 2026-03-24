import type { Server } from "socket.io";
import type { CrowdState, VibePreset } from "@partyglue/shared-types";
import { CROWD_STATE_BPM_RANGES, DEFAULT_CROWD_STATE, COLD_START_ENERGY_TARGET } from "@partyglue/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";

const DJ_STATE_KEY = (roomId: string) => `experience:dj:${roomId}`;

// ─── Crowd State ──────────────────────────────────────────────────────────────

export async function getCrowdState(roomId: string): Promise<CrowdState> {
  const raw = await redisClient.get(DJ_STATE_KEY(roomId));
  return raw ? JSON.parse(raw).crowdState ?? DEFAULT_CROWD_STATE : DEFAULT_CROWD_STATE;
}

export async function setCrowdState(roomId: string, state: CrowdState, io: Server): Promise<void> {
  const raw = await redisClient.get(DJ_STATE_KEY(roomId));
  if (!raw) return;
  const djState = JSON.parse(raw);
  djState.crowdState = state;
  await redisClient.set(DJ_STATE_KEY(roomId), JSON.stringify(djState));

  const seq = await getNextSequenceId(roomId);
  io.to(roomId).emit("room:crowd_state_changed" as any, { crowdState: state, sequenceId: seq });
}

// ─── Vibe Preset Handler ──────────────────────────────────────────────────────

export async function handleVibeCast(
  roomId: string,
  preset: VibePreset,
  io: Server,
): Promise<void> {
  // Map preset to a logical crowd state
  const presetToCrowdState: Record<VibePreset, CrowdState> = {
    open:      "RISING",
    classy:    "WARMUP",
    hype:      "PEAK",
    chill:     "COOLDOWN",
    throwback: "RISING",
    family:    "WARMUP",
  };

  const newState = presetToCrowdState[preset] ?? "RISING";
  await setCrowdState(roomId, newState, io);
}

// ─── Inferred Activity (no votes = stagnant check) ────────────────────────────
// If no interactions in X minutes, trigger a "safety set" signal.
// Called by a periodic check, not on every event.

const STAGNANT_THRESHOLD_MS = 5 * 60 * 1000; // 5 min
const LAST_INTERACTION_KEY  = (roomId: string) => `experience:dj:last_interaction:${roomId}`;

export async function recordInteraction(roomId: string): Promise<void> {
  await redisClient.set(LAST_INTERACTION_KEY(roomId), Date.now().toString());
}

export async function checkForStagnation(roomId: string, io: Server): Promise<void> {
  const lastRaw = await redisClient.get(LAST_INTERACTION_KEY(roomId));
  if (!lastRaw) return;

  const elapsed = Date.now() - parseInt(lastRaw);
  if (elapsed > STAGNANT_THRESHOLD_MS) {
    // Tell host the vibe is stagnant — suggest a safety set
    io.to(`host:${roomId}`).emit("experience:state" as any, {
      experienceType: "dj",
      state: { alert: "stagnant_vibe", suggestion: "safety_set" },
      view: { type: "dj_queue" },
    });
  }
}

// ─── Push Poll Scheduler ─────────────────────────────────────────────────────
// Every 30 minutes, auto-fire a vibe direction poll.
// Stored as a room-level interval — cleared when DJ experience deactivates.

const pollIntervals = new Map<string, ReturnType<typeof setInterval>>();

export function startPollScheduler(roomId: string, io: Server): void {
  if (pollIntervals.has(roomId)) return;

  const interval = setInterval(async () => {
    const poll = {
      id: Math.random().toString(36).slice(2),
      roomId,
      question: "Where should the vibe go next?",
      options: [
        { id: "higher", label: "Turn it up", emoji: "🔥", vibeTarget: "PEAK" as CrowdState },
        { id: "same",   label: "Keep it here", emoji: "✨", vibeTarget: undefined },
        { id: "lower",  label: "Bring it down", emoji: "🌊", vibeTarget: "RECOVERY" as CrowdState },
      ],
      expiresAt: Date.now() + 60_000, // 1 min to vote
      triggeredBy: "ai_scheduled" as const,
    };
    io.to(roomId).emit("poll:started" as any, poll);
  }, 30 * 60 * 1000);

  pollIntervals.set(roomId, interval);
}

export function stopPollScheduler(roomId: string): void {
  const interval = pollIntervals.get(roomId);
  if (interval) {
    clearInterval(interval);
    pollIntervals.delete(roomId);
  }
}
