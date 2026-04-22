import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";
import { awardGameWin } from "../../lib/credits";

// ─────────────────────────────────────────────────────────────────────────────
// Roastmaster
//
// Flow: waiting → roasting (60s) → voting (20s) → reveal
// One guest is the target each round. Everyone writes a roast. Crowd votes for
// funniest — anonymously (target included, can't vote for themselves).
// 1 pt per vote received. Most votes at game end wins.
// ─────────────────────────────────────────────────────────────────────────────

const KEY         = (roomId: string) => `experience:roastmaster:${roomId}`;
const ROAST_MS    = 60_000;
const VOTE_MS     = 20_000;

interface RoastmasterState {
  phase: "waiting" | "roasting" | "voting" | "reveal" | "finished";
  roundNumber: number;
  targetGuestId: string;
  roasts: Record<string, string>;    // guestId → roast text
  votes: Record<string, string>;     // guestId → targetGuestId (the roast author)
  scores: Record<string, number>;
  roundResults?: {
    roasts: Record<string, string>;
    votes: Record<string, string>;
    winner: string;
  };
}

export class RoastmasterExperience implements ExperienceModule {
  readonly type = "roastmaster" as const;
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  async onActivate(roomId: string): Promise<void> {
    const existing = await this._load(roomId);
    if (existing && existing.phase !== "waiting" && existing.phase !== "finished") return;
    await this._save(roomId, {
      phase: "waiting",
      roundNumber: 0,
      targetGuestId: "",
      roasts: {},
      votes: {},
      scores: {},
    });
  }

  async onDeactivate(roomId: string): Promise<void> {
    const t = this.timers.get(roomId);
    if (t) { clearTimeout(t); this.timers.delete(roomId); }
    await redisClient.del(KEY(roomId));
  }

  async handleAction({ action, payload, roomId, guestId, role, io }: {
    action: string; payload: unknown; roomId: string;
    guestId: string; role: "HOST" | "CO_HOST" | "GUEST"; io: Server;
  }): Promise<void> {
    const p = payload as any;
    switch (action) {
      case "start_round":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._startRound(roomId, String(p?.targetGuestId ?? ""), io);
        break;

      case "submit_roast":
        await this._submitRoast(roomId, guestId, String(p?.text ?? ""), io);
        break;

      case "start_voting":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._startVoting(roomId, io);
        break;

      case "cast_vote":
        await this._castVote(roomId, guestId, String(p?.authorGuestId ?? ""), io);
        break;

      case "reveal":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._reveal(roomId, io);
        break;

      case "next_round":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._nextRound(roomId, io);
        break;

      case "skip_phase":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._skipPhase(roomId, io);
        break;

      case "resume":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._resumeIfStuck(roomId, io);
        break;

      case "end_game":
        if (role !== "HOST") return;
        await this._endGame(roomId, io);
        break;
    }
  }

  async getGuestViewDescriptor(roomId: string): Promise<GuestViewDescriptor> {
    const state = await this._load(roomId);
    if (!state) return { type: "intermission" };
    return { type: "roastmaster", data: this._publicState(state) };
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async _startRound(roomId: string, targetGuestId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || !targetGuestId) return;
    state.phase = "roasting";
    state.roundNumber += 1;
    state.targetGuestId = targetGuestId;
    state.roasts = {};
    state.votes = {};
    delete state.roundResults;
    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
    this._setTimer(roomId, ROAST_MS, () => this._startVoting(roomId, io));
  }

  private async _submitRoast(roomId: string, guestId: string, text: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || state.phase !== "roasting") return;
    if (guestId === state.targetGuestId) return; // Target can't roast themselves
    state.roasts[guestId] = text.trim().slice(0, 280);
    await this._save(roomId, state);
    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "roastmaster",
      partial: true,
      state: { submittedGuestIds: Object.keys(state.roasts) },
      view: { type: "roastmaster", data: { phase: "roasting" } },
      sequenceId: seq,
    });
  }

  private async _startVoting(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || state.phase === "voting") return;
    state.phase = "voting";
    state.votes = {};
    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
    this._setTimer(roomId, VOTE_MS, () => this._reveal(roomId, io));
  }

  private async _castVote(roomId: string, guestId: string, authorGuestId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || state.phase !== "voting") return;
    if (state.votes[guestId]) return;  // Already voted
    if (authorGuestId === guestId) return; // Can't vote for own roast
    if (!state.roasts[authorGuestId]) return; // Author must have submitted
    state.votes[guestId] = authorGuestId;
    await this._save(roomId, state);
    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "roastmaster",
      partial: true,
      state: { votedGuestIds: Object.keys(state.votes) },
      view: { type: "roastmaster", data: { phase: "voting" } },
      sequenceId: seq,
    });
  }

  private async _reveal(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;
    // Tally
    for (const authorId of Object.values(state.votes)) {
      state.scores[authorId] = (state.scores[authorId] ?? 0) + 1;
    }
    const sorted = Object.entries(state.votes).reduce<Record<string, number>>((acc, [, a]) => {
      acc[a] = (acc[a] ?? 0) + 1; return acc;
    }, {});
    const winner = Object.entries(sorted).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "";
    state.roundResults = { roasts: state.roasts, votes: state.votes, winner };
    state.phase = "reveal";
    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  private async _nextRound(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;
    state.phase = "waiting";
    state.roasts = {};
    state.votes = {};
    delete state.roundResults;
    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  private async _skipPhase(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;
    if (state.phase === "roasting") await this._startVoting(roomId, io);
    else if (state.phase === "voting") await this._reveal(roomId, io);
  }

  private async _resumeIfStuck(roomId: string, io: Server): Promise<void> {
    if (this.timers.has(roomId)) return;
    const state = await this._load(roomId);
    if (!state) return;
    if (state.phase === "roasting") {
      this._setTimer(roomId, ROAST_MS, () => this._startVoting(roomId, io));
      await this._broadcast(roomId, state, io);
    } else if (state.phase === "voting") {
      this._setTimer(roomId, VOTE_MS, () => this._reveal(roomId, io));
      await this._broadcast(roomId, state, io);
    }
  }

  private async _endGame(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;
    state.phase = "finished";
    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
    if (Object.keys(state.scores).length > 0) {
      await awardGameWin(io, state.scores, roomId);
    }
  }

  /** Strip server-only fields before broadcasting */
  private _publicState(state: RoastmasterState): Omit<RoastmasterState, "roasts"> & { roasts?: Record<string, string>; anonymizedRoasts?: Array<{ id: string; text: string }> } {
    if (state.phase === "voting") {
      // Shuffle roasts — don't reveal authorship during voting
      const entries = Object.entries(state.roasts).map(([id, text]) => ({ id, text }));
      entries.sort(() => Math.random() - 0.5);
      return { ...state, roasts: undefined, anonymizedRoasts: entries };
    }
    return state;
  }

  private async _broadcast(roomId: string, state: RoastmasterState, io: Server): Promise<void> {
    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "roastmaster",
      state: this._publicState(state),
      view: { type: "roastmaster", data: this._publicState(state) },
      sequenceId: seq,
    });
  }

  async getBootstrapState(roomId: string): Promise<unknown> {
    const state = await this._load(roomId);
    return state ? this._publicState(state) : null;
  }

  private _setTimer(roomId: string, ms: number, fn: () => void) {
    const existing = this.timers.get(roomId);
    if (existing) clearTimeout(existing);
    this.timers.set(roomId, setTimeout(fn, ms));
  }

  private async _load(roomId: string): Promise<RoastmasterState | null> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }

  private async _save(roomId: string, state: RoastmasterState): Promise<void> {
    await redisClient.set(KEY(roomId), JSON.stringify(state));
  }
}
