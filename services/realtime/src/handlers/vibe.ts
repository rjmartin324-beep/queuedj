// Re-export vibe handlers from the DJ experience module
export { handleVibeCast, checkForStagnation, recordInteraction } from "../experiences/dj/vibe";

// Poll response handler — shared across all experiences
import type { Server } from "socket.io";
import { redisClient } from "../redis";
import { getNextSequenceId } from "../rooms/stateReconciliation";
import type { CrowdState } from "@queuedj/shared-types";
import { setCrowdState } from "../experiences/dj/vibe";

export async function handlePollRespond(
  payload: { roomId: string; pollId: string; optionId: string },
  io: Server,
): Promise<void> {
  const { roomId, pollId, optionId } = payload;
  const votesKey = `poll:${roomId}:${pollId}:votes`;

  await redisClient.hIncrBy(votesKey, optionId, 1);
  await redisClient.expire(votesKey, 3600);
}

// Tap-to-sync: aggregate beat taps from the crowd, correct BPM
const tapBuffers = new Map<string, number[]>();

export async function handleTapBeat(
  payload: { roomId: string; guestId: string; timestamp: number },
  io: Server,
): Promise<void> {
  const { roomId, timestamp } = payload;

  if (!tapBuffers.has(roomId)) tapBuffers.set(roomId, []);
  const taps = tapBuffers.get(roomId)!;
  taps.push(timestamp);

  // Keep last 8 taps
  if (taps.length > 8) taps.shift();

  // Need at least 4 taps to calculate BPM
  if (taps.length >= 4) {
    const intervals: number[] = [];
    for (let i = 1; i < taps.length; i++) {
      intervals.push(taps[i] - taps[i - 1]);
    }
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const bpm = Math.round(60000 / avgInterval);

    if (bpm > 60 && bpm < 200) {
      // Broadcast corrected BPM to host
      io.to(`host:${roomId}`).emit("experience:state" as any, {
        experienceType: "dj",
        state: { tapBpm: bpm, tapCount: taps.length },
        view: { type: "dj_queue" },
      });
    }
  }
}
