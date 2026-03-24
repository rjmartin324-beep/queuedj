import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@partyglue/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";

// ─────────────────────────────────────────────────────────────────────────────
// Scavenger Snap Experience
//
// Flow: waiting → snapping (30s) → gallery (voting) → results
// Host sets challenge. Everyone snaps a photo. Crowd votes for best.
// ─────────────────────────────────────────────────────────────────────────────

const STATE_KEY = (roomId: string) => `experience:snap:${roomId}`;
const SNAP_SECS = 30;
const VOTE_SECS = 25;

const SNAP_CHALLENGES = [
  "Find something red",
  "Show us the messiest spot near you",
  "Find something older than you",
  "Show your best 'I own the place' face",
  "Find something that shouldn't exist",
  "Show us your most useless possession",
  "Find something that represents your mood right now",
  "Show the weirdest thing in the room",
  "Find something that tells a story",
  "Show your best party trick (photo version)",
  "Find the most suspicious object near you",
  "Show us what's in your pocket RIGHT NOW",
  "Find something blue AND weird",
  "Show the most dramatic lighting in the room",
  "Find something that could be a weapon (harmless version)",
  "Show us the ugliest thing nearby",
  "Find something that makes no sense",
  "Show your best 'album cover' pose",
  "Find something that belongs in a museum",
  "Show us something that sparks joy (Marie Kondo rules)",
];

interface SnapState {
  phase: "waiting" | "snapping" | "gallery" | "results";
  challenge: string;
  roundNumber: number;
  totalRounds: number;
  photos: Record<string, string>;   // guestId → base64 data URI
  votes: Record<string, string>;    // guestId → targetGuestId
  scores: Record<string, number>;
  winner: string | null;
  usedChallenges: string[];
}

export class ScavengerSnapExperience implements ExperienceModule {
  readonly type = "scavenger_snap" as const;
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  async onActivate(roomId: string): Promise<void> {
    const state: SnapState = {
      phase: "waiting",
      challenge: "",
      roundNumber: 0,
      totalRounds: 4,
      photos: {},
      votes: {},
      scores: {},
      winner: null,
      usedChallenges: [],
    };
    await redisClient.set(STATE_KEY(roomId), JSON.stringify(state));
  }

  async onDeactivate(roomId: string): Promise<void> {
    const timer = this.timers.get(roomId);
    if (timer) { clearTimeout(timer); this.timers.delete(roomId); }
  }

  async handleAction({ action, payload, roomId, guestId, role, io }: {
    action: string; payload: unknown; roomId: string;
    guestId: string; role: "HOST" | "CO_HOST" | "GUEST"; io: Server;
  }): Promise<void> {
    switch (action) {
      case "start_round":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._startRound(roomId, io);
        break;

      case "submit_photo":
        await this._submitPhoto(roomId, guestId, (payload as any).photo, io);
        break;

      case "cast_vote":
        await this._castVote(roomId, guestId, (payload as any).targetGuestId, io);
        break;

      case "next_round":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._startRound(roomId, io);
        break;

      case "end_game":
        if (role !== "HOST") return;
        await this.onDeactivate(roomId);
        await redisClient.set(`room:${roomId}:experience`, "dj");
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:changed" as any, {
          experienceType: "dj",
          view: { type: "dj_queue" },
          sequenceId: seq,
        });
        break;
    }
  }

  async getGuestViewDescriptor(roomId: string): Promise<GuestViewDescriptor> {
    const state = await this._getState(roomId);
    if (!state) return { type: "intermission" };
    switch (state.phase) {
      case "waiting":  return { type: "intermission" };
      case "snapping": return { type: "snap_challenge", data: { challenge: state.challenge, timeLimit: SNAP_SECS } };
      case "gallery":  return { type: "snap_gallery",   data: { photos: state.photos, challenge: state.challenge } };
      case "results":  return { type: "snap_results",   data: state };
      default:         return { type: "intermission" };
    }
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private async _startRound(roomId: string, io: Server): Promise<void> {
    const state = await this._getState(roomId);
    if (!state) return;

    const remaining = SNAP_CHALLENGES.filter(c => !state.usedChallenges.includes(c));
    const pool = remaining.length > 0 ? remaining : SNAP_CHALLENGES;
    const challenge = pool[Math.floor(Math.random() * pool.length)];

    state.phase = "snapping";
    state.challenge = challenge;
    state.roundNumber += 1;
    state.photos = {};
    state.votes = {};
    state.winner = null;
    state.usedChallenges = [...state.usedChallenges, challenge];
    await this._saveState(roomId, state);

    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "scavenger_snap",
      state,
      view: { type: "snap_challenge", data: { challenge, timeLimit: SNAP_SECS } },
      sequenceId: seq,
    });

    this._setTimer(roomId, SNAP_SECS * 1000, () => this._startGallery(roomId, io));
  }

  private async _submitPhoto(roomId: string, guestId: string, photo: string, io: Server): Promise<void> {
    const state = await this._getState(roomId);
    if (!state || state.phase !== "snapping") return;
    state.photos[guestId] = photo;
    await this._saveState(roomId, state);
    // No broadcast — let timer handle gallery phase
  }

  private async _startGallery(roomId: string, io: Server): Promise<void> {
    const state = await this._getState(roomId);
    if (!state || state.phase !== "snapping") return;

    // Need at least 1 photo to show gallery
    if (Object.keys(state.photos).length === 0) {
      await this._startRound(roomId, io); // Skip and retry
      return;
    }

    state.phase = "gallery";
    await this._saveState(roomId, state);

    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "scavenger_snap",
      state,
      view: { type: "snap_gallery", data: { photos: state.photos, challenge: state.challenge } },
      sequenceId: seq,
    });

    this._setTimer(roomId, VOTE_SECS * 1000, () => this._showResults(roomId, io));
  }

  private async _castVote(roomId: string, guestId: string, targetGuestId: string, io: Server): Promise<void> {
    const state = await this._getState(roomId);
    if (!state || state.phase !== "gallery") return;
    if (state.votes[guestId]) return;
    if (targetGuestId === guestId) return;

    state.votes[guestId] = targetGuestId;
    await this._saveState(roomId, state);
  }

  private async _showResults(roomId: string, io: Server): Promise<void> {
    const state = await this._getState(roomId);
    if (!state || state.phase !== "gallery") return;

    // Tally votes
    const tally: Record<string, number> = {};
    for (const targetId of Object.values(state.votes)) {
      tally[targetId] = (tally[targetId] ?? 0) + 1;
      state.scores[targetId] = (state.scores[targetId] ?? 0) + 1;
    }

    // Pick winner (most votes)
    const winner = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    state.winner = winner;
    state.phase = "results";
    await this._saveState(roomId, state);

    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "scavenger_snap",
      state,
      view: { type: "snap_results", data: state },
      sequenceId: seq,
    });
  }

  private _setTimer(roomId: string, ms: number, fn: () => void) {
    const existing = this.timers.get(roomId);
    if (existing) clearTimeout(existing);
    const t = setTimeout(fn, ms);
    this.timers.set(roomId, t);
  }

  private async _getState(roomId: string): Promise<SnapState | null> {
    const raw = await redisClient.get(STATE_KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }

  private async _saveState(roomId: string, state: SnapState): Promise<void> {
    await redisClient.set(STATE_KEY(roomId), JSON.stringify(state));
  }
}
