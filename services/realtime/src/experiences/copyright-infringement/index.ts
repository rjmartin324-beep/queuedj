import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import {
  type CopyrightState,
  type DrawingData,
  COPYRIGHT_PROMPTS,
} from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";

const KEY        = (roomId: string) => `experience:copyright:${roomId}`;
const VIEW_MS    = 3000;   // Logo shown for 3 seconds
const DRAWING_MS = 60000;  // 60 seconds to draw

export class CopyrightInfringementExperience implements ExperienceModule {
  readonly type = "copyright_infringement" as const;
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private deactivated: Set<string> = new Set();

  async onActivate(roomId: string): Promise<void> {
    this.deactivated.delete(roomId); // Clear any stale guard from a prior deactivation
    const existing = await this._load(roomId);
    if (existing && existing.phase !== "waiting" && existing.phase !== "scores") return; // mid-game — don't reset
    const state: CopyrightState = {
      phase: "waiting",
      roundNumber: 0,
      totalRounds: 5,
      currentPrompt: null,
      promptRevealedAt: null,
      drawings: {},
      votes: {},
      voteCategory: "most_sued",
      scores: {},
    };
    await this._save(roomId, state);
  }

  async onDeactivate(roomId: string): Promise<void> {
    this.deactivated.add(roomId); // persists until next onActivate — guards any async callbacks still in flight
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
        await this._startRound(roomId, io);
        break;

      // Guest submits their drawing in real-time strokes
      case "drawing_stroke":
        await this._updateDrawing(roomId, guestId, p.drawing, io);
        break;

      // HOST: close drawing, open gallery
      case "close_drawing":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._openGallery(roomId, io);
        break;

      // GUEST: vote on a drawing
      case "submit_vote":
        await this._submitVote(roomId, guestId, p.targetGuestId, io);
        break;

      case "reveal_results":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._revealResults(roomId, io);
        break;

      case "next_round":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._startRound(roomId, io);
        break;

      case "skip_round":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._skipPhase(roomId, io);
        break;

      case "resume":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._resumeIfStuck(roomId, io);
        break;
    }
  }

  async getGuestViewDescriptor(roomId: string): Promise<GuestViewDescriptor> {
    const state = await this._load(roomId);
    if (!state) return { type: "intermission" };
    switch (state.phase) {
      case "viewing":  return { type: "copyright_viewing",  data: { prompt: state.currentPrompt, revealedAt: state.promptRevealedAt, viewMs: VIEW_MS } };
      case "drawing":  return { type: "copyright_drawing",  data: { prompt: state.currentPrompt?.name, drawingMs: DRAWING_MS } };
      case "gallery":  return { type: "copyright_gallery",  data: { drawings: state.drawings, voteCategory: state.voteCategory } };
      case "results":  return { type: "copyright_results",  data: state };
      case "scores":   return { type: "leaderboard",        data: state.scores };
      default:         return { type: "intermission" };
    }
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async _startRound(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;

    if (state.roundNumber >= state.totalRounds) {
      state.phase = "scores";
      await this._save(roomId, state);
      await this._broadcast(roomId, state, io);
      return;
    }

    const prompt = COPYRIGHT_PROMPTS[state.roundNumber % COPYRIGHT_PROMPTS.length];

    state.roundNumber += 1;
    state.currentPrompt = prompt;
    state.promptRevealedAt = Date.now();
    state.drawings = {};
    state.votes = {};
    // Alternate vote category each round
    state.voteCategory = state.roundNumber % 2 === 0 ? "nailed_it" : "most_sued";
    state.phase = "viewing";

    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);

    // Auto-hide logo after VIEW_MS, start drawing phase
    this._setTimer(roomId, VIEW_MS + 200, () => this._startDrawing(roomId, io));
  }

  private async _startDrawing(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || state.phase !== "viewing") return;
    state.phase = "drawing";
    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);

    // Auto-close drawing after DRAWING_MS
    this._setTimer(roomId, DRAWING_MS, () => this._openGallery(roomId, io));
  }

  private async _updateDrawing(roomId: string, guestId: string, drawing: DrawingData, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || state.phase !== "drawing") return;

    state.drawings[guestId] = drawing;
    await this._save(roomId, state);

    // Broadcast live drawing to HOST only (so host can see progress)
    io.to(`host:${roomId}`).emit("experience:state" as any, {
      experienceType: "copyright_infringement",
      state: { drawings: state.drawings, phase: "drawing" },
      view: { type: "copyright_drawing" },
    });
  }

  private async _openGallery(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;
    state.phase = "gallery";
    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  private async _submitVote(roomId: string, guestId: string, targetGuestId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || state.phase !== "gallery") return;
    if (guestId === targetGuestId) return;
    if (state.votes[guestId]) return;

    state.votes[guestId] = targetGuestId;
    await this._save(roomId, state);
    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "copyright_infringement",
      partial: true, state: { votedGuestIds: Object.keys(state.votes) },
      view: { type: "copyright_gallery" },
      sequenceId: seq,
    });
  }

  private async _revealResults(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;

    // Tally votes
    const voteCounts: Record<string, number> = {};
    for (const target of Object.values(state.votes)) {
      voteCounts[target] = (voteCounts[target] ?? 0) + 1;
    }
    const winner = Object.entries(voteCounts).sort(([, a], [, b]) => b - a)[0]?.[0];
    if (winner) {
      const bonus = state.voteCategory === "nailed_it" ? 200 : 150;
      state.scores[winner] = (state.scores[winner] ?? 0) + bonus;
    }

    // Everyone who participated gets base points
    for (const guestId of Object.keys(state.drawings)) {
      state.scores[guestId] = (state.scores[guestId] ?? 0) + 50;
    }

    state.phase = "results";
    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  private async _skipPhase(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;
    if (state.phase === "viewing") await this._startDrawing(roomId, io);
    else if (state.phase === "drawing") await this._openGallery(roomId, io);
    else if (state.phase === "gallery") await this._revealResults(roomId, io);
  }

  private async _broadcast(roomId: string, state: CopyrightState, io: Server): Promise<void> {
    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "copyright_infringement",
      state,
      view: await this.getGuestViewDescriptor(roomId),
      sequenceId: seq,
    });
  }

  async getBootstrapState(roomId: string): Promise<unknown> {
    return this._load(roomId);
  }

  private _setTimer(roomId: string, ms: number, fn: () => void): void {
    if (this.deactivated.has(roomId)) return; // guard against race on deactivate
    const existing = this.timers.get(roomId);
    if (existing) clearTimeout(existing);
    this.timers.set(roomId, setTimeout(fn, ms));
  }

  private async _resumeIfStuck(roomId: string, io: Server): Promise<void> {
    if (this.timers.has(roomId)) return;
    const state = await this._load(roomId);
    if (!state) return;
    if (state.phase === "viewing") {
      this._setTimer(roomId, VIEW_MS + 200, () => this._startDrawing(roomId, io));
      await this._broadcast(roomId, state, io);
    } else if (state.phase === "drawing") {
      this._setTimer(roomId, DRAWING_MS, () => this._openGallery(roomId, io));
      await this._broadcast(roomId, state, io);
    }
  }

  private async _load(roomId: string): Promise<CopyrightState | null> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }

  private async _save(roomId: string, state: CopyrightState): Promise<void> {
    await redisClient.set(KEY(roomId), JSON.stringify(state));
  }
}
