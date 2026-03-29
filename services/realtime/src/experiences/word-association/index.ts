import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";

// ─────────────────────────────────────────────────────────────────────────────
// Word Association Experience
//
// Players take turns adding a word to a chain. Each word must be associated
// with the previous one. Points for valid entries, penalty for timeouts.
//
// Actions:
//   HOST/CO_HOST: start, timeout, end_game
//   GUEST:        submit_word (only the currentTurn player)
// ─────────────────────────────────────────────────────────────────────────────

const KEY = (roomId: string) => `experience:word_association:${roomId}`;

interface WordAssociationState {
  phase: "waiting" | "playing" | "finished";
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
  chain: string[];
  currentTurn: string | null; // guestId whose turn it is
  timerStart: number;
}

export class WordAssociationExperience implements ExperienceModule {
  readonly type = "word_association" as const;

  async onActivate(roomId: string): Promise<void> {
    const state: WordAssociationState = {
      phase: "waiting",
      round: 0,
      totalRounds: 15,
      scores: {},
      chain: [],
      currentTurn: null,
      timerStart: 0,
    };
    await redisClient.set(KEY(roomId), JSON.stringify(state), { EX: 14400 });
  }

  async onDeactivate(roomId: string): Promise<void> {
    await redisClient.del(KEY(roomId));
  }

  async handleAction({ action, payload, roomId, guestId, role, io }: {
    action: string;
    payload: unknown;
    roomId: string;
    guestId: string;
    role: "HOST" | "CO_HOST" | "GUEST";
    io: Server;
  }): Promise<void> {
    const p = payload as any;

    switch (action) {

      // ─── HOST: Start the game ──────────────────────────────────────────
      case "start": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        const state = await this._load(roomId);
        if (!state) return;

        const guestIds: string[] = p.guestIds ?? [];
        const seedWord: string = p.seedWord || "Music";

        state.phase = "playing";
        state.round = 1;
        state.chain = [seedWord];
        state.currentTurn = guestIds[0] ?? null;
        state.timerStart = Date.now();
        state.scores = {};

        await this._save(roomId, state);
        await this._broadcast(roomId, state, io);
        break;
      }

      // ─── GUEST: Submit a word ──────────────────────────────────────────
      case "submit_word": {
        const state = await this._load(roomId);
        if (!state || state.phase !== "playing") return;
        if (state.currentTurn !== guestId) return; // Not your turn

        const word: string = (p.word ?? "").trim();
        if (!word) return;

        const guestIds: string[] = p.guestIds ?? [];

        // Award points and add to chain
        state.scores[guestId] = (state.scores[guestId] ?? 0) + 100;
        state.chain.push(word);
        state.round += 1;

        if (state.round > state.totalRounds) {
          state.phase = "finished";
          state.currentTurn = null;
        } else {
          state.currentTurn = this._nextGuest(guestId, guestIds);
          state.timerStart = Date.now();
        }

        await this._save(roomId, state);
        await this._broadcast(roomId, state, io);
        break;
      }

      // ─── HOST: Timeout — penalise current player and advance turn ─────
      case "timeout": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        const state = await this._load(roomId);
        if (!state || state.phase !== "playing") return;

        const guestIds: string[] = p.guestIds ?? [];

        if (state.currentTurn) {
          state.scores[state.currentTurn] = (state.scores[state.currentTurn] ?? 0) - 50;
          state.currentTurn = this._nextGuest(state.currentTurn, guestIds);
          state.timerStart = Date.now();
          state.round += 1;
        }

        if (state.round > state.totalRounds) {
          state.phase = "finished";
          state.currentTurn = null;
        }

        await this._save(roomId, state);
        await this._broadcast(roomId, state, io);
        break;
      }

      // ─── HOST: End game ────────────────────────────────────────────────
      case "end_game": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        const state = await this._load(roomId);
        if (!state) return;

        state.phase = "finished";
        state.currentTurn = null;
        await this._save(roomId, state);
        await this._broadcast(roomId, state, io);
        break;
      }

      // ─── HOST: End experience and return to DJ ─────────────────────────
      case "end": {
        if (role !== "HOST" && role !== "CO_HOST") return;
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
  }

  async getGuestViewDescriptor(roomId: string): Promise<GuestViewDescriptor> {
    const state = await this._load(roomId);
    if (!state) return { type: "intermission" };
    return { type: "word_association" as any, data: state };
  }

  async getBootstrapState(roomId: string): Promise<unknown> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  /** Return the next guestId in the cycling list after currentId */
  private _nextGuest(currentId: string, guestIds: string[]): string | null {
    if (guestIds.length === 0) return null;
    const idx = guestIds.indexOf(currentId);
    return guestIds[(idx + 1) % guestIds.length];
  }

  private async _broadcast(roomId: string, state: WordAssociationState, io: Server): Promise<void> {
    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "word_association",
      state,
      view: { type: "word_association" as any, data: state },
      sequenceId: seq,
    });
  }

  private async _load(roomId: string): Promise<WordAssociationState | null> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }

  private async _save(roomId: string, state: WordAssociationState): Promise<void> {
    await redisClient.set(KEY(roomId), JSON.stringify(state), { EX: 14400 });
  }
}