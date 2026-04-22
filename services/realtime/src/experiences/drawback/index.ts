import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";
import { DRAWBACK_PROMPTS } from "./prompts";
import { awardGameWin } from "../../lib/credits";

// ─────────────────────────────────────────────────────────────────────────────
// Drawback Experience
//
// Flow: waiting → drawing (30s) → voting (20s) → reveal
// Everyone draws the same prompt. Crowd votes for best. 1pt per vote.
// ─────────────────────────────────────────────────────────────────────────────

const STATE_KEY  = (roomId: string) => `experience:drawback:${roomId}`;
const DRAW_SECS  = 30;
const VOTE_SECS  = 20;

interface DrawbackState {
  phase: "waiting" | "drawing" | "voting" | "reveal" | "finished";
  prompt: string;
  roundNumber: number;
  totalRounds: number;
  drawings: Record<string, string>;  // guestId → JSON-serialised strokes
  votes: Record<string, string>;     // guestId → targetGuestId
  scores: Record<string, number>;
  usedPrompts: string[];
  timeLimit: number;
}

export class DrawbackExperience implements ExperienceModule {
  readonly type = "drawback" as const;
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  async onActivate(roomId: string): Promise<void> {
    const existing = await redisClient.get(STATE_KEY(roomId));
    if (existing) {
      const s: DrawbackState = JSON.parse(existing);
      if (s.phase !== "waiting" && s.phase !== "finished") return; // mid-game — don't reset
    }
    const state: DrawbackState = {
      phase: "waiting",
      prompt: "",
      roundNumber: 0,
      totalRounds: 5,
      drawings: {},
      votes: {},
      scores: {},
      usedPrompts: [],
      timeLimit: DRAW_SECS,
    };
    await redisClient.set(STATE_KEY(roomId), JSON.stringify(state));
  }

  async onDeactivate(roomId: string): Promise<void> {
    const timer = this.timers.get(roomId);
    if (timer) { clearTimeout(timer); this.timers.delete(roomId); }
    await redisClient.del(STATE_KEY(roomId));
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

      case "submit_drawing":
        await this._submitDrawing(roomId, guestId, (payload as any).strokes, io);
        break;

      case "cast_vote":
        await this._castVote(roomId, guestId, (payload as any).targetGuestId, io);
        break;

      case "next_round":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._startRound(roomId, io);
        break;

      case "show_leaderboard":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._showLeaderboard(roomId, io);
        break;

      case "skip_round":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._skipPhase(roomId, io);
        break;

      case "resume":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._resumeIfStuck(roomId, io);
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
      case "drawing":  return { type: "drawback_drawing", data: { prompt: state.prompt, timeLimit: DRAW_SECS } };
      case "voting":   return { type: "drawback_voting",  data: { drawings: state.drawings, prompt: state.prompt } };
      case "reveal":
      case "finished": return { type: "drawback_reveal",  data: state };
      default:         return { type: "intermission" };
    }
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private async _startRound(roomId: string, io: Server): Promise<void> {
    const state = await this._getState(roomId);
    if (!state) return;

    // Pick unused prompt
    const remaining = DRAWBACK_PROMPTS.filter(p => !state.usedPrompts.includes(p));
    const pool = remaining.length > 0 ? remaining : DRAWBACK_PROMPTS;
    const prompt = pool[Math.floor(Math.random() * pool.length)];

    state.phase = "drawing";
    state.prompt = prompt;
    state.roundNumber += 1;
    state.drawings = {};
    state.votes = {};
    state.usedPrompts = [...state.usedPrompts, prompt];
    state.timeLimit = DRAW_SECS;
    await this._saveState(roomId, state);

    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "drawback",
      state: { ...state, drawings: {} },
      view: { type: "drawback_drawing", data: { prompt, timeLimit: DRAW_SECS } },
      sequenceId: seq,
    });

    // Auto-advance to voting after draw time
    this._setTimer(roomId, DRAW_SECS * 1000, () => this._startVoting(roomId, io));
  }

  private async _submitDrawing(roomId: string, guestId: string, strokes: string, io: Server): Promise<void> {
    const state = await this._getState(roomId);
    if (!state || state.phase !== "drawing") return;
    state.drawings[guestId] = strokes;
    await this._saveState(roomId, state);
    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "drawback",
      partial: true, state: { submittedGuestIds: Object.keys(state.drawings) },
      view: { type: "drawback_drawing", data: { prompt: state.prompt, timeLimit: DRAW_SECS } },
      sequenceId: seq,
    });
  }

  private async _startVoting(roomId: string, io: Server): Promise<void> {
    const state = await this._getState(roomId);
    if (!state || state.phase !== "drawing") return;

    state.phase = "voting";
    await this._saveState(roomId, state);

    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "drawback",
      state,
      view: { type: "drawback_voting", data: { drawings: state.drawings, prompt: state.prompt } },
      sequenceId: seq,
    });

    this._setTimer(roomId, VOTE_SECS * 1000, () => this._reveal(roomId, io));
  }

  private async _castVote(roomId: string, guestId: string, targetGuestId: string, io: Server): Promise<void> {
    const state = await this._getState(roomId);
    if (!state || state.phase !== "voting") return;
    if (state.votes[guestId]) return;          // Already voted
    if (targetGuestId === guestId) return;      // Can't vote for yourself

    state.votes[guestId] = targetGuestId;
    await this._saveState(roomId, state);
    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "drawback",
      partial: true, state: { votedGuestIds: Object.keys(state.votes) },
      view: { type: "drawback_voting", data: { drawings: state.drawings, prompt: state.prompt } },
      sequenceId: seq,
    });
  }

  private async _reveal(roomId: string, io: Server): Promise<void> {
    const state = await this._getState(roomId);
    if (!state || state.phase !== "voting") return;

    // Tally votes
    for (const targetId of Object.values(state.votes)) {
      state.scores[targetId] = (state.scores[targetId] ?? 0) + 1;
    }

    state.phase = state.roundNumber >= state.totalRounds ? "finished" : "reveal";
    await this._saveState(roomId, state);

    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "drawback",
      state,
      view: { type: "drawback_reveal", data: state },
      sequenceId: seq,
    });

    if (state.phase === "finished") {
      await awardGameWin(io, state.scores, roomId);
    }
  }

  private async _resumeIfStuck(roomId: string, io: Server): Promise<void> {
    if (this.timers.has(roomId)) return;
    const state = await this._getState(roomId);
    if (!state) return;
    if (state.phase === "drawing") {
      this._setTimer(roomId, DRAW_SECS * 1000, () => this._startVoting(roomId, io));
      const seq = await getNextSequenceId(roomId);
      io.to(roomId).emit("experience:state" as any, {
        experienceType: "drawback", state,
        view: { type: "drawback_drawing", data: { prompt: state.prompt, timeLimit: DRAW_SECS } },
        sequenceId: seq,
      });
    } else if (state.phase === "voting") {
      this._setTimer(roomId, VOTE_SECS * 1000, () => this._reveal(roomId, io));
      const seq = await getNextSequenceId(roomId);
      io.to(roomId).emit("experience:state" as any, {
        experienceType: "drawback", state,
        view: { type: "drawback_voting", data: { drawings: state.drawings, prompt: state.prompt } },
        sequenceId: seq,
      });
    }
  }

  private async _skipPhase(roomId: string, io: Server): Promise<void> {
    const state = await this._getState(roomId);
    if (!state) return;
    if (state.phase === "drawing") await this._startVoting(roomId, io);
    else if (state.phase === "voting") await this._reveal(roomId, io);
  }

  private async _showLeaderboard(roomId: string, io: Server): Promise<void> {
    const state = await this._getState(roomId);
    if (!state) return;
    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "drawback",
      state,
      view: { type: "leaderboard", data: state.scores },
      sequenceId: seq,
    });
  }

  async getBootstrapState(roomId: string): Promise<unknown> {
    return this._getState(roomId);
  }

  private _setTimer(roomId: string, ms: number, fn: () => void) {
    const existing = this.timers.get(roomId);
    if (existing) clearTimeout(existing);
    const t = setTimeout(fn, ms);
    this.timers.set(roomId, t);
  }

  private async _getState(roomId: string): Promise<DrawbackState | null> {
    const raw = await redisClient.get(STATE_KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }

  private async _saveState(roomId: string, state: DrawbackState): Promise<void> {
    await redisClient.set(STATE_KEY(roomId), JSON.stringify(state));
  }
}
