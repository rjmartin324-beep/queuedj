import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";
import { shuffledIndices } from "../../lib/shuffle";

// ─────────────────────────────────────────────────────────────────────────────
// Mind Reading Experience
//
// Number pattern puzzles — figure out the rule and pick the next number.
// Speed bonus awarded for quick correct answers.
//
// Actions:
//   HOST:  start, reveal, next, end
//   GUEST: answer
// ─────────────────────────────────────────────────────────────────────────────

const KEY = (roomId: string) => `experience:mind_reading:${roomId}`;
const ANSWER_WINDOW_MS = 20_000; // 20s window for speed bonus

interface NumberPuzzle {
  sequence: number[];
  options: number[];  // 4 multiple-choice answers
  correct: number;    // index into options[]
  rule: string;       // explanation shown at reveal
}

interface MindReadingState {
  phase: "waiting" | "question" | "reveal" | "finished";
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
  currentPuzzle: NumberPuzzle | null;
  answers: Record<string, number>; // guestId -> chosen option index (server only)
  questionStartedAt: number;
  queue: number[];
}

const PUZZLES: NumberPuzzle[] = [
  {
    sequence: [2, 4, 8, 16, 32],
    options: [48, 60, 64, 72],
    correct: 2, // 64
    rule: "Each number doubles the previous one (×2).",
  },
  {
    sequence: [1, 4, 9, 16, 25],
    options: [30, 36, 40, 42],
    correct: 1, // 36
    rule: "These are perfect squares: 1², 2², 3², 4², 5², 6²...",
  },
  {
    sequence: [3, 6, 9, 12, 15],
    options: [16, 17, 18, 19],
    correct: 2, // 18
    rule: "Multiples of 3 (+3 each time).",
  },
  {
    sequence: [1, 1, 2, 3, 5, 8],
    options: [11, 12, 13, 14],
    correct: 2, // 13
    rule: "The Fibonacci sequence — each number is the sum of the two before it.",
  },
  {
    sequence: [100, 50, 25, 12.5],
    options: [5, 6, 6.25, 7],
    correct: 2, // 6.25
    rule: "Each number is halved (÷2).",
  },
  {
    sequence: [5, 10, 20, 40, 80],
    options: [120, 140, 160, 180],
    correct: 2, // 160
    rule: "Each number doubles the previous one (×2).",
  },
  {
    sequence: [7, 14, 21, 28, 35],
    options: [38, 40, 42, 44],
    correct: 2, // 42
    rule: "Multiples of 7 (+7 each time).",
  },
  {
    sequence: [1, 3, 7, 15, 31],
    options: [47, 55, 63, 71],
    correct: 2, // 63
    rule: "Each number is double the previous number plus 1.",
  },
];

export class MindReadingExperience implements ExperienceModule {
  readonly type = "mind_reading" as const;

  async onActivate(roomId: string, _hostGuestId: string): Promise<void> {
    const state: MindReadingState = {
      phase: "waiting",
      round: 0,
      totalRounds: 8,
      scores: {},
      currentPuzzle: null,
      answers: {},
      questionStartedAt: 0,
      queue: shuffledIndices(PUZZLES.length),
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

      case "answer":
        await this._answer(roomId, guestId, p.index, io);
        break;

      case "reveal":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._reveal(roomId, io);
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
    return { type: "mind_reading" as any, data: this._safeState(state) };
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private async _start(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;

    state.round = 1;
    state.answers = {};
    state.questionStartedAt = Date.now();
    state.queue = shuffledIndices(PUZZLES.length);
    state.currentPuzzle = PUZZLES[state.queue[0]];
    state.phase = "question";

    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  private async _answer(roomId: string, guestId: string, index: number, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || state.phase !== "question") return;
    if (state.answers[guestId] !== undefined) return; // Already answered
    if (typeof index !== "number" || index < 0 || index > 3) return;

    state.answers[guestId] = index;
    await this._save(roomId, state);
    // No broadcast — answers revealed at reveal phase
  }

  private async _reveal(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || !state.currentPuzzle || state.phase !== "question") return;

    const correctIndex = state.currentPuzzle.correct;
    const now = Date.now();

    for (const [gId, chosenIndex] of Object.entries(state.answers)) {
      if (chosenIndex === correctIndex) {
        const elapsed = Math.max(0, now - state.questionStartedAt);
        const speedBonus = Math.round(Math.max(0, (ANSWER_WINDOW_MS - elapsed) / ANSWER_WINDOW_MS) * 100);
        state.scores[gId] = (state.scores[gId] ?? 0) + 100 + speedBonus;
      }
    }

    state.phase = "reveal";
    await this._save(roomId, state);

    // Full state with correct index broadcast at reveal
    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "mind_reading",
      state,
      view: { type: "mind_reading" as any, data: state },
      sequenceId: seq,
    });
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

    state.round = nextRound;
    state.answers = {};
    state.questionStartedAt = Date.now();
    state.currentPuzzle = PUZZLES[state.queue[(nextRound - 1) % state.queue.length]];
    state.phase = "question";

    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  /** Strip answers + correct index during question phase */
  private _safeState(state: MindReadingState): unknown {
    if (state.phase !== "question" || !state.currentPuzzle) return state;

    const { answers, ...restState } = state;
    const { correct, ...safePuzzle } = state.currentPuzzle;
    return {
      ...restState,
      currentPuzzle: safePuzzle,
      answerCount: Object.keys(answers).length,
    };
  }

  private async _broadcast(roomId: string, state: MindReadingState, io: Server): Promise<void> {
    const seq = await getNextSequenceId(roomId);
    const safe = this._safeState(state);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "mind_reading",
      state: safe,
      view: { type: "mind_reading" as any, data: safe },
      sequenceId: seq,
    });
  }

  private async _load(roomId: string): Promise<MindReadingState | null> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }

  private async _save(roomId: string, state: MindReadingState): Promise<void> {
    await redisClient.set(KEY(roomId), JSON.stringify(state));
  }
}
