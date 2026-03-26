import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";

// ─────────────────────────────────────────────────────────────────────────────
// Emoji Story Experience
//
// A sequence of emojis represents a famous movie, song, or phrase.
// First guest to guess correctly earns 200 pts. Using a hint costs 100 pts.
//
// Actions:
//   HOST/CO_HOST: start, next, end_game, end
//   GUEST:        guess, use_hint
// ─────────────────────────────────────────────────────────────────────────────

const KEY = (roomId: string) => `experience:emoji_story:${roomId}`;

// ─── Content ─────────────────────────────────────────────────────────────────

interface EmojiPuzzle {
  emojis: string;
  answer: string;
  hint: string;
}

const PUZZLES: EmojiPuzzle[] = [
  { emojis: "🦁👑", answer: "The Lion King", hint: "Animated Disney classic" },
  { emojis: "🕷️🕸️👨", answer: "Spider-Man", hint: "Marvel superhero" },
  { emojis: "🧊❄️👸", answer: "Frozen", hint: "Disney movie with Let It Go" },
  { emojis: "🔫🌊🕵️", answer: "James Bond", hint: "British secret agent" },
  { emojis: "🍕🐢🥷", answer: "Teenage Mutant Ninja Turtles", hint: "Pizza-loving heroes in a half shell" },
  { emojis: "🧙‍♂️💍🗻", answer: "Lord of the Rings", hint: "J.R.R. Tolkien epic" },
  { emojis: "🚂⏰🔙", answer: "Back to the Future", hint: "Great Scott!" },
  { emojis: "🦈🎵😱", answer: "Jaws", hint: "Steven Spielberg thriller" },
];

// ─── State ────────────────────────────────────────────────────────────────────

interface EmojiStoryState {
  phase: "waiting" | "question" | "reveal" | "finished";
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
  currentPuzzle: { emojis: string; answer: string; hint?: string } | null;
  guesses: Record<string, string>;        // guestId → their guess text
  hintUsed: Record<string, boolean>;      // guestId → whether they bought the hint
  winner: string | null;                  // guestId of first correct guesser
}

export class EmojiStoryExperience implements ExperienceModule {
  readonly type = "emoji_story" as const;

  async onActivate(roomId: string): Promise<void> {
    const state: EmojiStoryState = {
      phase: "waiting",
      round: 0,
      totalRounds: 8,
      scores: {},
      currentPuzzle: null,
      guesses: {},
      hintUsed: {},
      winner: null,
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

      // ─── HOST: Start the game ──────────────────────────────────────────
      case "start": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        const state = await this._load(roomId);
        if (!state) return;

        const puzzle = PUZZLES[0];
        state.phase = "question";
        state.round = 1;
        state.scores = {};
        state.currentPuzzle = { emojis: puzzle.emojis, answer: puzzle.answer, hint: puzzle.hint };
        state.guesses = {};
        state.hintUsed = {};
        state.winner = null;

        await this._save(roomId, state);
        await this._broadcastSafe(roomId, state, io);
        break;
      }

      // ─── GUEST: Submit a guess ─────────────────────────────────────────
      case "guess": {
        const state = await this._load(roomId);
        if (!state || state.phase !== "question" || !state.currentPuzzle) return;

        const guess: string = (p.guess ?? "").trim();
        state.guesses[guestId] = guess;

        const isCorrect = guess.toLowerCase().includes(state.currentPuzzle.answer.toLowerCase())
          || state.currentPuzzle.answer.toLowerCase().includes(guess.toLowerCase());

        if (isCorrect && !state.winner) {
          state.winner = guestId;
          state.scores[guestId] = (state.scores[guestId] ?? 0) + 200;
        }

        await this._save(roomId, state);

        // Broadcast the full state (without answer) so everyone can see guess count
        await this._broadcastSafe(roomId, state, io);
        break;
      }

      // ─── GUEST: Use a hint (costs 100 pts) ────────────────────────────
      case "use_hint": {
        const state = await this._load(roomId);
        if (!state || state.phase !== "question") return;
        if (state.hintUsed[guestId]) return; // Already used hint this round

        state.hintUsed[guestId] = true;
        state.scores[guestId] = (state.scores[guestId] ?? 0) - 100;
        await this._save(roomId, state);

        // Send hint only to the requesting guest
        const seq = await getNextSequenceId(roomId);
        io.to(guestId).emit("experience:state" as any, {
          experienceType: "emoji_story",
          state: { ...this._safeState(state), hint: state.currentPuzzle?.hint ?? "" },
          view: { type: "emoji_story" as any, data: state },
          sequenceId: seq,
        });
        break;
      }

      // ─── HOST: Advance to next round ───────────────────────────────────
      case "next": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        const state = await this._load(roomId);
        if (!state) return;

        state.round += 1;

        if (state.round > state.totalRounds) {
          state.phase = "finished";
          state.currentPuzzle = null;
        } else {
          const puzzleIdx = (state.round - 1) % PUZZLES.length;
          const puzzle = PUZZLES[puzzleIdx];
          state.phase = "question";
          state.currentPuzzle = { emojis: puzzle.emojis, answer: puzzle.answer, hint: puzzle.hint };
          state.guesses = {};
          state.hintUsed = {};
          state.winner = null;
        }

        await this._save(roomId, state);
        await this._broadcastSafe(roomId, state, io);
        break;
      }

      // ─── HOST: End game ────────────────────────────────────────────────
      case "end_game": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        const state = await this._load(roomId);
        if (!state) return;

        state.phase = "finished";
        state.currentPuzzle = null;
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
    return { type: "emoji_story" as any, data: this._safeState(state) };
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  /** Strip the answer from currentPuzzle so guests cannot cheat */
  private _safeState(state: EmojiStoryState): Omit<EmojiStoryState, "currentPuzzle"> & {
    currentPuzzle: { emojis: string } | null;
  } {
    const { currentPuzzle, ...rest } = state;
    return {
      ...rest,
      currentPuzzle: currentPuzzle ? { emojis: currentPuzzle.emojis } : null,
    };
  }

  /** Broadcast without answer */
  private async _broadcastSafe(roomId: string, state: EmojiStoryState, io: Server): Promise<void> {
    const seq = await getNextSequenceId(roomId);
    const safe = this._safeState(state);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "emoji_story",
      state: safe,
      view: { type: "emoji_story" as any, data: safe },
      sequenceId: seq,
    });
  }

  /** Broadcast full state (reveal phase, host) */
  private async _broadcast(roomId: string, state: EmojiStoryState, io: Server): Promise<void> {
    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "emoji_story",
      state,
      view: { type: "emoji_story" as any, data: state },
      sequenceId: seq,
    });
  }

  private async _load(roomId: string): Promise<EmojiStoryState | null> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }

  private async _save(roomId: string, state: EmojiStoryState): Promise<void> {
    await redisClient.set(KEY(roomId), JSON.stringify(state), { EX: 14400 });
  }
}
