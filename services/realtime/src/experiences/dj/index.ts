import type { Server } from "socket.io";
import type {
  ExperienceModule,
  GuestViewDescriptor,
  DJExperienceState,
} from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { handleQueueRequest, handleQueueReorder, handleQueueRemove, getQueue } from "./queue";
import { handleVibeCast, getCrowdState, setCrowdState } from "./vibe";

// ─────────────────────────────────────────────────────────────────────────────
// DJ Experience — Module 1
//
// Everything DJ-specific lives here.
// The platform (realtime/src/index.ts) calls these methods.
// No DJ logic leaks into the platform layer.
// ─────────────────────────────────────────────────────────────────────────────

const DJ_STATE_KEY = (roomId: string) => `experience:dj:${roomId}`;

export class DJExperience implements ExperienceModule {
  readonly type = "dj" as const;

  async onActivate(roomId: string, hostGuestId: string): Promise<void> {
    const state: DJExperienceState = {
      nowPlaying: null,
      queueLength: 0,
      crowdState: "WARMUP",
      bpm: null,
      isBathroomBreak: false,
    };
    await redisClient.set(DJ_STATE_KEY(roomId), JSON.stringify(state));
  }

  async onDeactivate(roomId: string): Promise<void> {
    // Don't delete state — host might switch back
    // State persists until room expires (TTL)
  }

  async handleAction({ action, payload, roomId, guestId, role, io }: {
    action: string;
    payload: unknown;
    roomId: string;
    guestId: string;
    role: "HOST" | "CO_HOST" | "GUEST";
    io: Server;
  }): Promise<void> {
    switch (action) {
      case "queue:request":
        await handleQueueRequest(payload as any, io);
        break;
      case "queue:reorder":
        if (role === "HOST" || role === "CO_HOST") {
          const { itemId, newPosition } = payload as any;
          await handleQueueReorder(roomId, itemId, newPosition, io);
        }
        break;
      case "queue:remove":
        if (role === "HOST" || role === "CO_HOST") {
          await handleQueueRemove(roomId, (payload as any).itemId, io);
        }
        break;
      case "vibe:set":
        if (role === "HOST" || role === "CO_HOST") {
          await handleVibeCast(roomId, (payload as any).preset, io);
        }
        break;
      case "bathroom:toggle":
        if (role === "HOST") {
          await this._toggleBathroomBreak(roomId, (payload as any).active, io);
        }
        break;

      case "vote_play_again": {
        // Any guest can vote to play again — track in a Redis set so duplicates are ignored.
        // Broadcasts the current vote count so guests see how many want to replay.
        await redisClient.sAdd(`vote_play_again:${roomId}`, guestId);
        const count = await redisClient.sCard(`vote_play_again:${roomId}`);
        io.to(roomId).emit("play_again:votes" as any, { count });
        break;
      }
      case "track:now_playing":
        if (role === "HOST") {
          await this._updateNowPlaying(roomId, (payload as any).isrc, (payload as any).bpm, io);
        }
        break;
      case "queue:skip_current":
        // Remove the first item in the queue (the next-up track) and advance now playing
        if (role === "HOST" || role === "CO_HOST") {
          const queue = await (await import("./queue")).getQueue(roomId);
          if (queue.length > 0) {
            await handleQueueRemove(roomId, queue[0].id, io);
            // Advance now playing to the next track
            const nextQueue = await (await import("./queue")).getQueue(roomId);
            if (nextQueue.length > 0) {
              await this._updateNowPlaying(roomId, nextQueue[0].track.isrc, nextQueue[0].track.bpm ?? null, io);
            }
          }
        }
        break;
    }
  }

  async getGuestViewDescriptor(roomId: string): Promise<GuestViewDescriptor> {
    return { type: "dj_queue" };
  }

  private async _toggleBathroomBreak(roomId: string, active: boolean, io: Server) {
    const raw = await redisClient.get(DJ_STATE_KEY(roomId));
    if (!raw) return;
    const state: DJExperienceState = JSON.parse(raw);
    state.isBathroomBreak = active;
    await redisClient.set(DJ_STATE_KEY(roomId), JSON.stringify(state));
    // Sync crowd state so reconnecting guests see the right energy level
    await setCrowdState(roomId, active ? "RECOVERY" : "RISING", io);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "dj",
      state,
      view: { type: "dj_queue" },
    });
  }

  private async _updateNowPlaying(roomId: string, isrc: string | null, bpm: number | null, io: Server) {
    const raw = await redisClient.get(DJ_STATE_KEY(roomId));
    if (!raw) return;
    const state: DJExperienceState = JSON.parse(raw);
    state.nowPlaying = isrc;
    state.bpm = bpm;
    const queue = await getQueue(roomId);
    state.queueLength = queue.length;
    await redisClient.set(DJ_STATE_KEY(roomId), JSON.stringify(state));
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "dj",
      state,
      view: { type: "dj_queue" },
    });

    // Re-score all queue items against new now-playing track (fire and forget)
    if (isrc && queue.length > 0) {
      this._rescoreQueue(roomId, isrc, state.crowdState ?? "PEAK", queue, io).catch(() => {});
    }
  }

  private async _rescoreQueue(
    roomId: string,
    nowPlayingIsrc: string,
    crowdState: string,
    queue: any[],
    io: Server,
  ): Promise<void> {
    const ML_URL = process.env.ML_URL ?? "http://localhost:8000";
    try {
      const res = await fetch(`${ML_URL}/compatibility/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_isrc: nowPlayingIsrc,
          queue_isrcs: queue.map((i: any) => i.track.isrc),
          crowd_state: crowdState,
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return;
      const { results } = await res.json();

      // Update vibe scores on queue items
      for (const item of queue) {
        const scored = results.find((r: any) => r.isrc === item.track.isrc);
        if (scored) item.vibeDistanceScore = scored.vibe_distance_score;
      }

      const { saveQueue } = await import("./queue");
      await saveQueue(roomId, queue);
      io.to(roomId).emit("queue:updated", queue, 0);
    } catch {
      // ML unavailable — existing scores stand
    }
  }
}
