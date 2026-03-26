import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";

// ─────────────────────────────────────────────────────────────────────────────
// Vibe Check Experience
//
// Live rating of the current track. Guests slide 1–10.
// Results shown as a live average + distribution bar.
// Low vibe triggers a "Skip this?" prompt to the host.
// ─────────────────────────────────────────────────────────────────────────────

const KEY = (roomId: string) => `experience:vibe_check:${roomId}`;

interface VibeCheckState {
  phase: "rating" | "revealed";
  isrc: string | null;
  trackTitle: string | null;
  trackArtist: string | null;
  ratings: Record<string, number>;  // guestId → 1-10
  average: number;
  distribution: number[];           // index 0-9 = ratings 1-10
}

export class VibeCheckExperience implements ExperienceModule {
  readonly type = "vibe_check" as const;

  async onActivate(roomId: string): Promise<void> {
    const state: VibeCheckState = {
      phase: "rating",
      isrc: null,
      trackTitle: null,
      trackArtist: null,
      ratings: {},
      average: 0,
      distribution: new Array(10).fill(0),
    };
    await this._save(roomId, state);
  }

  async onDeactivate(roomId: string): Promise<void> {}

  async handleAction({ action, payload, roomId, guestId, role, io }: {
    action: string; payload: unknown; roomId: string;
    guestId: string; role: "HOST" | "CO_HOST" | "GUEST"; io: Server;
  }): Promise<void> {
    const p = payload as any;

    switch (action) {
      case "set_track":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._setTrack(roomId, p.isrc, p.title, p.artist, io);
        break;

      case "submit_rating":
        await this._submitRating(roomId, guestId, Math.min(10, Math.max(1, p.rating)), io);
        break;

      case "reveal":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._reveal(roomId, io);
        break;

      case "reset":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this.onActivate(roomId);
        io.to(roomId).emit("experience:state_updated", { phase: "rating", ratings: {}, average: 0, distribution: new Array(10).fill(0) });
        break;
    }
  }

  async getGuestViewDescriptor(roomId: string): Promise<GuestViewDescriptor> {
    const state = await this._load(roomId);
    return {
      view: "vibe_check",
      data: {
        phase: state.phase,
        trackTitle: state.trackTitle,
        trackArtist: state.trackArtist,
        average: state.average,
        distribution: state.distribution,
        ratingCount: Object.keys(state.ratings).length,
      },
    };
  }

  private async _setTrack(roomId: string, isrc: string, title: string, artist: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    state.isrc = isrc;
    state.trackTitle = title;
    state.trackArtist = artist;
    state.ratings = {};
    state.average = 0;
    state.distribution = new Array(10).fill(0);
    state.phase = "rating";
    await this._save(roomId, state);
    io.to(roomId).emit("experience:state_updated", { phase: "rating", trackTitle: title, trackArtist: artist, average: 0, distribution: state.distribution, ratingCount: 0 });
  }

  private async _submitRating(roomId: string, guestId: string, rating: number, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (state.phase !== "rating") return;

    // Remove old rating from distribution
    const old = state.ratings[guestId];
    if (old !== undefined) state.distribution[old - 1]--;

    state.ratings[guestId] = rating;
    state.distribution[rating - 1]++;

    const vals = Object.values(state.ratings);
    state.average = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;

    await this._save(roomId, state);

    // Broadcast live update (no individual ratings revealed)
    io.to(roomId).emit("vibe_check:updated", {
      average: Math.round(state.average * 10) / 10,
      distribution: state.distribution,
      ratingCount: vals.length,
    });

    // Warn host if vibe is low
    if (state.average < 4 && vals.length >= 3) {
      io.to(roomId).emit("vibe_check:low_vibe_alert", { average: state.average });
    }
  }

  private async _reveal(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    state.phase = "revealed";
    await this._save(roomId, state);
    io.to(roomId).emit("experience:state_updated", {
      phase: "revealed",
      average: Math.round(state.average * 10) / 10,
      distribution: state.distribution,
      ratingCount: Object.keys(state.ratings).length,
    });
  }

  private async _load(roomId: string): Promise<VibeCheckState> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : { phase: "rating", isrc: null, trackTitle: null, trackArtist: null, ratings: {}, average: 0, distribution: new Array(10).fill(0) };
  }

  private async _save(roomId: string, state: VibeCheckState): Promise<void> {
    await redisClient.set(KEY(roomId), JSON.stringify(state), { EX: 14400 });
  }
}
