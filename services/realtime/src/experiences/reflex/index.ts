import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";
import { awardGameWin } from "../../lib/credits";

// ─────────────────────────────────────────────────────────────────────────────
// Reflex — Sub-50ms Reaction Game
//
// Flow: waiting → countdown (2-5s random delay) → go! → locked (300ms window)
// Server records receipt order. First guest socket message in = fastest finger.
// Host awards point. First to WIN_TARGET wins.
//
// Note: timestamps from clients are informational only — order of server receipt
// is authoritative to avoid clock-skew cheating.
// ─────────────────────────────────────────────────────────────────────────────

const KEY        = (roomId: string) => `experience:reflex:${roomId}`;
const WIN_TARGET = 5;
const GO_WINDOW  = 300; // ms — window after GO during which taps are valid

interface BuzzEntry { guestId: string; serverTs: number; clientTs?: number; }

interface ReflexState {
  phase: "waiting" | "countdown" | "go" | "locked" | "finished";
  roundNumber: number;
  goServerTs: number;
  buzzOrder: BuzzEntry[];
  scores: Record<string, number>;
  winTarget: number;
  lastWinner?: string;
}

export class ReflexExperience implements ExperienceModule {
  readonly type = "reflex" as const;
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  async onActivate(roomId: string): Promise<void> {
    const existing = await this._load(roomId);
    if (existing && existing.phase !== "waiting" && existing.phase !== "finished") return;
    await this._save(roomId, {
      phase: "waiting",
      roundNumber: 0,
      goServerTs: 0,
      buzzOrder: [],
      scores: {},
      winTarget: WIN_TARGET,
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
      case "arm":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._arm(roomId, io);
        break;

      case "tap":
        await this._tap(roomId, guestId, typeof p?.ts === "number" ? p.ts : undefined, io);
        break;

      case "next_round":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._nextRound(roomId, io);
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
    return { type: "reflex", data: state };
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async _arm(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;
    state.phase = "countdown";
    state.roundNumber += 1;
    state.buzzOrder = [];
    state.goServerTs = 0;
    delete state.lastWinner;
    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);

    // Random delay 1800–4200ms, then fire GO
    const delay = 1800 + Math.floor(Math.random() * 2400);
    this._setTimer(roomId, delay, () => this._fireGo(roomId, io));
  }

  private async _fireGo(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || state.phase !== "countdown") return;
    const now = Date.now();
    state.phase = "go";
    state.goServerTs = now;
    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);

    // After the tap window, lock regardless
    this._setTimer(roomId, GO_WINDOW + 500, () => this._lock(roomId, io));
  }

  private async _tap(roomId: string, guestId: string, clientTs: number | undefined, io: Server): Promise<void> {
    const state = await this._load(roomId);
    // Accept taps only during "go" phase within the window
    if (!state || state.phase !== "go") return;
    const serverTs = Date.now();
    if (serverTs - state.goServerTs > GO_WINDOW) return; // Too late
    if (state.buzzOrder.some(b => b.guestId === guestId)) return; // Already tapped

    state.buzzOrder.push({ guestId, serverTs, clientTs });

    // Award point to first tap immediately
    if (state.buzzOrder.length === 1) {
      state.scores[guestId] = (state.scores[guestId] ?? 0) + 1;
      state.lastWinner = guestId;

      if (state.scores[guestId] >= state.winTarget) {
        state.phase = "finished";
        await this._save(roomId, state);
        await this._broadcast(roomId, state, io);
        await awardGameWin(io, state.scores, roomId);
        return;
      }

      state.phase = "locked";
    }

    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  private async _lock(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || state.phase !== "go") return;
    // Nobody tapped in time
    state.phase = "locked";
    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  private async _nextRound(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;
    state.phase = "waiting";
    state.buzzOrder = [];
    delete state.lastWinner;
    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
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

  private async _broadcast(roomId: string, state: ReflexState, io: Server): Promise<void> {
    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "reflex",
      state,
      view: { type: "reflex", data: state },
      sequenceId: seq,
    });
  }

  async getBootstrapState(roomId: string): Promise<unknown> {
    return this._load(roomId);
  }

  private _setTimer(roomId: string, ms: number, fn: () => void) {
    const existing = this.timers.get(roomId);
    if (existing) clearTimeout(existing);
    this.timers.set(roomId, setTimeout(fn, ms));
  }

  private async _load(roomId: string): Promise<ReflexState | null> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }

  private async _save(roomId: string, state: ReflexState): Promise<void> {
    await redisClient.set(KEY(roomId), JSON.stringify(state));
  }
}
