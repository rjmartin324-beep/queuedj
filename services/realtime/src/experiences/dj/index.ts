import type { Server } from "socket.io";
import type {
  ExperienceModule,
  GuestViewDescriptor,
  DJExperienceState,
} from "@partyglue/shared-types";
import { redisClient } from "../../redis";
import { handleQueueRequest, handleQueueReorder, handleQueueRemove, getQueue } from "./queue";
import { handleVibeCast, getCrowdState } from "./vibe";

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
      case "track:now_playing":
        if (role === "HOST") {
          await this._updateNowPlaying(roomId, (payload as any).isrc, (payload as any).bpm, io);
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
  }
}
