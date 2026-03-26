import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";

// ─────────────────────────────────────────────────────────────────────────────
// Chain Reaction Experience
//
// Players build a word chain where each word must START with the last LETTER
// of the previous word, within a chosen category.
//
// Actions:
//   HOST/CO_HOST: start, end_game, end
//   GUEST:        submit_word (currentTurn only)
// ─────────────────────────────────────────────────────────────────────────────

const KEY = (roomId: string) => `experience:chain_reaction:${roomId}`;

// ─── Content ─────────────────────────────────────────────────────────────────

const CATEGORIES = ["Animals", "Countries", "Foods", "Movies", "Cities", "Sports", "Colors"] as const;

const SEED_WORDS: Record<string, string> = {
  Animals:   "Elephant",
  Countries: "Argentina",
  Foods:     "Apple",
  Movies:    "Avatar",
  Cities:    "Amsterdam",
  Sports:    "Archery",
  Colors:    "Amber",
};

// ─── State ────────────────────────────────────────────────────────────────────

interface ChainReactionState {
  phase: "waiting" | "playing" | "finished";
  scores: Record<string, number>;
  chain: string[];
  category: string;
  currentTurn: string | null;
  round: number;
  totalRounds: number;
  timerStart: number;
}

export class ChainReactionExperience implements ExperienceModule {
  readonly type = "chain_reaction" as const;

  async onActivate(roomId: string): Promise<void> {
    const state: ChainReactionState = {
      phase: "waiting",
      scores: {},
      chain: [],
      category: "",
      currentTurn: null,
      round: 0,
      totalRounds: 12,
      timerStart: 0,
    };
    await this._save(roomId, state);
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

      // ─── HOST: Start ───────────────────────────────────────────────────
      case "start": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        const state = await this._load(roomId);
        if (!state) return;

        const category: string = CATEGORIES.includes(p.category) ? p.category : "Animals";
        const guestIds: string[] = p.guestIds ?? [];

        state.phase = "playing";
        state.round = 1;
        state.category = category;
        state.chain = [SEED_WORDS[category]];
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
        if (state.currentTurn !== guestId) return;

        const word: string = (p.word ?? "").trim();
        if (!word) return;

        const guestIds: string[] = p.guestIds ?? [];
        const lastWord = state.chain[state.chain.length - 1] ?? "";
        const lastChar = lastWord.slice(-1).toLowerCase();
        const firstChar = word.charAt(0).toLowerCase();
        const isValid = firstChar === lastChar;

        if (!isValid) {
          // Broadcast error only to the submitter — turn still advances
          const errorSeq = await getNextSequenceId(roomId);
          io.to(guestId).emit("experience:state" as any, {
            experienceType: "chain_reaction",
            state: { ...state, lastError: `"${word}" must start with "${lastChar.toUpperCase()}"` },
            view: { type: "chain_reaction" as any, data: state },
            sequenceId: errorSeq,
          });
        } else {
          // Valid word: award base points + time bonus (max 50 pts in first 5s)
          const elapsed = (Date.now() - state.timerStart) / 1000;
          const timeBonus = Math.max(0, Math.round(50 * (1 - elapsed / 5)));
          state.scores[guestId] = (state.scores[guestId] ?? 0) + 100 + timeBonus;
          state.chain.push(word);
        }

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

      // ─── HOST: Return to DJ experience ────────────────────────────────
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
    return { type: "chain_reaction" as any, data: state };
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private _nextGuest(currentId: string, guestIds: string[]): string | null {
    if (guestIds.length === 0) return null;
    const idx = guestIds.indexOf(currentId);
    return guestIds[(idx + 1) % guestIds.length];
  }

  private async _broadcast(roomId: string, state: ChainReactionState, io: Server): Promise<void> {
    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "chain_reaction",
      state,
      view: { type: "chain_reaction" as any, data: state },
      sequenceId: seq,
    });
  }

  private async _load(roomId: string): Promise<ChainReactionState | null> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }

  private async _save(roomId: string, state: ChainReactionState): Promise<void> {
    await redisClient.set(KEY(roomId), JSON.stringify(state), { EX: 14400 });
  }
}
