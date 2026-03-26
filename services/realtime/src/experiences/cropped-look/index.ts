import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";

// ─────────────────────────────────────────────────────────────────────────────
// Cropped Look Experience
//
// Guess what a sequence of emojis is depicting.
// Host can reveal more emoji hints (up to 3 reveals).
// Earlier correct guesses and fewer reveals used = more points.
//
// Actions:
//   HOST:  start, more_reveal, next, end
//   GUEST: guess, use_hint
// ─────────────────────────────────────────────────────────────────────────────

const KEY = (roomId: string) => `experience:cropped_look:${roomId}`;

interface EmojiPuzzle {
  emojis: string[];   // all emojis for the puzzle (shown progressively)
  answer: string;     // canonical answer (lowercase comparison)
}

interface CroppedLookState {
  phase: "waiting" | "question" | "reveal" | "finished";
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
  currentPuzzle: { emojis: string[]; answer: string } | null;
  guesses: Record<string, string>;       // guestId -> their guess text
  correctGuessers: string[];             // guestIds who guessed correctly
  revealLevel: number;                   // 0-3: how many hints shown
  hintUsed: Record<string, boolean>;     // guestId -> used a text hint
}

const PUZZLES: EmojiPuzzle[] = [
  {
    emojis: ["🚢", "🧊", "🌊", "😱", "💔"],
    answer: "titanic",
  },
  {
    emojis: ["🦁", "👑", "🌅", "🐾", "🎵"],
    answer: "the lion king",
  },
  {
    emojis: ["🕷️", "🕸️", "🏙️", "🦸", "❤️"],
    answer: "spider-man",
  },
  {
    emojis: ["🧙", "💍", "🌋", "👁️", "⚔️"],
    answer: "lord of the rings",
  },
  {
    emojis: ["🐠", "🌊", "🔍", "🐡", "💧"],
    answer: "finding nemo",
  },
  {
    emojis: ["🤖", "🌌", "⚡", "🛸", "🪐"],
    answer: "star wars",
  },
];

export class CroppedLookExperience implements ExperienceModule {
  readonly type = "cropped_look" as const;

  async onActivate(roomId: string, _hostGuestId: string): Promise<void> {
    const state: CroppedLookState = {
      phase: "waiting",
      round: 0,
      totalRounds: 6,
      scores: {},
      currentPuzzle: null,
      guesses: {},
      correctGuessers: [],
      revealLevel: 0,
      hintUsed: {},
    };
    await redisClient.set(KEY(roomId), JSON.stringify(state));
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
      case "start":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._start(roomId, io);
        break;

      case "guess":
        await this._guess(roomId, guestId, p.text, io);
        break;

      case "more_reveal":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._moreReveal(roomId, io);
        break;

      case "use_hint":
        await this._useHint(roomId, guestId, io);
        break;

      case "next":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._next(roomId, io);
        break;

      case "end":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this.onDeactivate(roomId);
        await redisClient.set(`room:${roomId}:experience`, "dj");
        io.to(roomId).emit("experience:changed" as any, {
          experienceType: "dj",
          view: { type: "dj_queue" },
          sequenceId: await getNextSequenceId(roomId),
        });
        break;
    }
  }

  async getGuestViewDescriptor(roomId: string): Promise<GuestViewDescriptor> {
    const state = await this._load(roomId);
    if (!state) return { type: "intermission" };
    return { type: "cropped_look" as any, data: this._visibleState(state) };
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private async _start(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;

    const puzzle = PUZZLES[0];
    state.round = 1;
    state.revealLevel = 0;
    state.guesses = {};
    state.correctGuessers = [];
    state.hintUsed = {};
    state.currentPuzzle = { emojis: puzzle.emojis, answer: puzzle.answer };
    state.phase = "question";

    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  private async _guess(roomId: string, guestId: string, text: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || state.phase !== "question" || !state.currentPuzzle) return;
    if (state.correctGuessers.includes(guestId)) return; // Already got it right
    if (!text || typeof text !== "string") return;

    const normalised = text.trim().toLowerCase();
    state.guesses[guestId] = normalised;

    const correct = state.currentPuzzle.answer.toLowerCase();
    if (normalised === correct) {
      state.correctGuessers.push(guestId);
      // Points: base 200, minus 30 per reveal level used
      const pts = Math.max(50, 200 - state.revealLevel * 30);
      state.scores[guestId] = (state.scores[guestId] ?? 0) + pts;
    }

    await this._save(roomId, state);
    // Broadcast updated correct-guesser count so everyone knows how many got it
    await this._broadcast(roomId, state, io);
  }

  private async _moreReveal(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || state.phase !== "question") return;

    state.revealLevel = Math.min(3, state.revealLevel + 1);
    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  private async _useHint(roomId: string, guestId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || state.phase !== "question") return;
    if (state.hintUsed[guestId]) return; // Already used hint

    state.hintUsed[guestId] = true;
    await this._save(roomId, state);
    // Hint display is client-side; just persist the flag
  }

  private async _next(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;

    const nextRound = state.round + 1;
    if (nextRound > state.totalRounds || nextRound > PUZZLES.length) {
      state.phase = "finished";
      state.currentPuzzle = null;
      await this._save(roomId, state);
      await this._broadcast(roomId, state, io);
      return;
    }

    const puzzle = PUZZLES[nextRound - 1];
    state.round = nextRound;
    state.revealLevel = 0;
    state.guesses = {};
    state.correctGuessers = [];
    state.hintUsed = {};
    state.currentPuzzle = { emojis: puzzle.emojis, answer: puzzle.answer };
    state.phase = "question";

    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  /**
   * Build the state object that is safe to broadcast.
   * During "question" phase, hide the answer and slice emojis to revealLevel+1.
   */
  private _visibleState(state: CroppedLookState): unknown {
    if (!state.currentPuzzle || state.phase !== "question") {
      return state;
    }

    const visibleCount = Math.max(1, state.revealLevel + 1);
    const { answer, emojis, ...restPuzzle } = state.currentPuzzle;
    const visiblePuzzle = { ...restPuzzle, emojis: emojis.slice(0, visibleCount) };

    const { guesses, ...restState } = state;
    return {
      ...restState,
      currentPuzzle: visiblePuzzle,
      guessCount: Object.keys(guesses).length,
    };
  }

  private async _broadcast(roomId: string, state: CroppedLookState, io: Server): Promise<void> {
    const seq = await getNextSequenceId(roomId);
    const visible = this._visibleState(state);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "cropped_look",
      state: visible,
      view: { type: "cropped_look" as any, data: visible },
      sequenceId: seq,
    });
  }

  private async _load(roomId: string): Promise<CroppedLookState | null> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }

  private async _save(roomId: string, state: CroppedLookState): Promise<void> {
    await redisClient.set(KEY(roomId), JSON.stringify(state));
  }
}
