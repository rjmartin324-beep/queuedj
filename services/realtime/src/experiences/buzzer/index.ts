import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";
import { awardGameWin } from "../../lib/credits";

// ─────────────────────────────────────────────────────────────────────────────
// Zero-Latency Buzzer
//
// Flow: waiting → armed (press as soon as host says go!) → locked (first buzz wins)
// Host awards point to whoever buzzed first. First to N points wins.
// ─────────────────────────────────────────────────────────────────────────────

const KEY          = (roomId: string) => `experience:buzzer:${roomId}`;
const WIN_TARGET   = 5;

interface BuzzEntry { guestId: string; ts: number; }

interface BuzzerState {
  phase: "waiting" | "armed" | "locked" | "finished";
  roundNumber: number;
  buzzOrder: BuzzEntry[];   // First entry = fastest finger
  scores: Record<string, number>;
  winTarget: number;
}

export class BuzzerExperience implements ExperienceModule {
  readonly type = "buzzer" as const;

  async onActivate(roomId: string): Promise<void> {
    const existing = await this._load(roomId);
    if (existing && existing.phase !== "waiting" && existing.phase !== "finished") return;
    await this._save(roomId, {
      phase: "waiting",
      roundNumber: 0,
      buzzOrder: [],
      scores: {},
      winTarget: WIN_TARGET,
    });
  }

  async onDeactivate(roomId: string): Promise<void> {
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

      case "buzz":
        await this._buzz(roomId, guestId, typeof p?.ts === "number" ? p.ts : Date.now(), io);
        break;

      case "award_point": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        const targetId = String(p?.guestId ?? "");
        if (!targetId) return;
        await this._awardPoint(roomId, targetId, io);
        break;
      }

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
    return { type: "buzzer", data: state };
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async _arm(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;
    state.phase = "armed";
    state.buzzOrder = [];
    state.roundNumber += 1;
    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  private async _buzz(roomId: string, guestId: string, ts: number, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || state.phase !== "armed") return;
    // Only record first buzz per guest
    if (state.buzzOrder.some(b => b.guestId === guestId)) return;

    state.buzzOrder.push({ guestId, ts });

    // Lock after first buzz
    if (state.buzzOrder.length === 1) {
      state.phase = "locked";
    }

    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  private async _awardPoint(roomId: string, targetGuestId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;
    state.scores[targetGuestId] = (state.scores[targetGuestId] ?? 0) + 1;

    if (state.scores[targetGuestId] >= state.winTarget) {
      state.phase = "finished";
      await this._save(roomId, state);
      await this._broadcast(roomId, state, io);
      await awardGameWin(io, state.scores, roomId);
    } else {
      state.phase = "waiting";
      await this._save(roomId, state);
      await this._broadcast(roomId, state, io);
    }
  }

  private async _nextRound(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;
    state.phase = "waiting";
    state.buzzOrder = [];
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

  private async _broadcast(roomId: string, state: BuzzerState, io: Server): Promise<void> {
    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "buzzer",
      state,
      view: { type: "buzzer", data: state },
      sequenceId: seq,
    });
  }

  async getBootstrapState(roomId: string): Promise<unknown> {
    return this._load(roomId);
  }

  private async _load(roomId: string): Promise<BuzzerState | null> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }

  private async _save(roomId: string, state: BuzzerState): Promise<void> {
    await redisClient.set(KEY(roomId), JSON.stringify(state));
  }
}
