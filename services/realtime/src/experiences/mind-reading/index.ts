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
  // ── Added puzzles ─────────────────────────────────────────────────────────
  {
    sequence: [2, 3, 5, 8, 13],
    options: [18, 19, 20, 21],
    correct: 3, // 21
    rule: "Fibonacci-like: each number is the sum of the two before it.",
  },
  {
    sequence: [10, 20, 30, 40, 50],
    options: [55, 58, 60, 65],
    correct: 2, // 60
    rule: "Multiples of 10 (+10 each time).",
  },
  {
    sequence: [1, 2, 4, 7, 11],
    options: [14, 15, 16, 17],
    correct: 2, // 16
    rule: "The differences increase by 1 each time: +1, +2, +3, +4, +5...",
  },
  {
    sequence: [81, 27, 9, 3],
    options: [0, 1, 2, 3],
    correct: 1, // 1
    rule: "Each number is divided by 3 (÷3).",
  },
  {
    sequence: [0, 1, 3, 6, 10],
    options: [13, 14, 15, 16],
    correct: 2, // 15
    rule: "Triangle numbers: add increasing amounts (+1, +2, +3, +4, +5).",
  },
  {
    sequence: [5, 11, 17, 23, 29],
    options: [33, 35, 37, 39],
    correct: 1, // 35
    rule: "Add 6 each time.",
  },
  {
    sequence: [1000, 500, 250, 125],
    options: [60, 62.5, 65, 70],
    correct: 1, // 62.5
    rule: "Each number is halved (÷2).",
  },
  {
    sequence: [3, 9, 27, 81],
    options: [162, 216, 243, 270],
    correct: 2, // 243
    rule: "Each number is multiplied by 3 (×3).",
  },
  {
    sequence: [2, 6, 12, 20, 30],
    options: [38, 40, 42, 44],
    correct: 2, // 42
    rule: "Add consecutive even numbers: +4, +6, +8, +10, +12.",
  },
  {
    sequence: [100, 90, 81, 73, 66],
    options: [58, 60, 61, 64],
    correct: 1, // 60
    rule: "Subtract decreasing amounts: −10, −9, −8, −7, −6.",
  },
  {
    sequence: [1, 4, 9, 16, 25, 36],
    options: [42, 45, 49, 52],
    correct: 2, // 49
    rule: "Perfect squares: 1², 2², 3², 4², 5², 6², 7².",
  },
  {
    sequence: [2, 5, 10, 17, 26],
    options: [35, 37, 39, 42],
    correct: 1, // 37
    rule: "Add odd numbers: +3, +5, +7, +9, +11.",
  },
  {
    sequence: [256, 64, 16, 4],
    options: [0, 1, 2, 3],
    correct: 1, // 1
    rule: "Each number is divided by 4 (÷4).",
  },
  {
    sequence: [1, 8, 27, 64, 125],
    options: [196, 210, 216, 220],
    correct: 2, // 216
    rule: "Perfect cubes: 1³, 2³, 3³, 4³, 5³, 6³.",
  },
  {
    sequence: [4, 8, 16, 32, 64],
    options: [96, 112, 120, 128],
    correct: 3, // 128
    rule: "Each number doubles (×2).",
  },
  {
    sequence: [13, 11, 9, 7, 5],
    options: [1, 2, 3, 4],
    correct: 2, // 3
    rule: "Subtract 2 each time (−2).",
  },
  {
    sequence: [1, 2, 6, 24, 120],
    options: [600, 720, 840, 960],
    correct: 1, // 720
    rule: "Factorials: 1!, 2!, 3!, 4!, 5!, 6!",
  },
  {
    sequence: [7, 16, 25, 34, 43],
    options: [48, 50, 52, 54],
    correct: 2, // 52
    rule: "Add 9 each time (+9).",
  },
  {
    sequence: [3, 4, 6, 9, 13, 18],
    options: [22, 23, 24, 25],
    correct: 2, // 24
    rule: "The differences increase by 1 each time: +1, +2, +3, +4, +5, +6.",
  },
  {
    sequence: [1, 3, 6, 10, 15, 21],
    options: [26, 27, 28, 30],
    correct: 2, // 28
    rule: "Triangle numbers — add 2, then 3, then 4, etc.",
  },
  {
    sequence: [50, 47, 44, 41, 38],
    options: [33, 34, 35, 36],
    correct: 2, // 35
    rule: "Subtract 3 each time (−3).",
  },
  {
    sequence: [1, 5, 14, 30, 55],
    options: [72, 84, 91, 99],
    correct: 2, // 91
    rule: "Tetrahedral numbers — differences are triangular: +4, +9, +16, +25, +36.",
  },
  {
    sequence: [2, 4, 6, 8, 10],
    options: [11, 12, 13, 14],
    correct: 1, // 12
    rule: "Even numbers, adding 2 each time.",
  },
  {
    sequence: [1, 3, 9, 27, 81],
    options: [162, 243, 270, 324],
    correct: 1, // 243
    rule: "Each number is multiplied by 3 (×3).",
  },
  {
    sequence: [99, 88, 77, 66, 55],
    options: [40, 42, 44, 46],
    correct: 2, // 44
    rule: "Subtract 11 each time (−11).",
  },
  {
    sequence: [5, 15, 45, 135],
    options: [270, 360, 405, 450],
    correct: 2, // 405
    rule: "Each number is multiplied by 3 (×3).",
  },
  {
    sequence: [1, 2, 4, 8, 16, 32],
    options: [48, 56, 60, 64],
    correct: 3, // 64
    rule: "Each number doubles (×2).",
  },
  {
    sequence: [120, 60, 30, 15],
    options: [6, 7, 7.5, 8],
    correct: 2, // 7.5
    rule: "Each number is halved (÷2).",
  },
  {
    sequence: [2, 3, 5, 7, 11, 13],
    options: [15, 16, 17, 18],
    correct: 2, // 17
    rule: "Prime numbers.",
  },
  {
    sequence: [0, 3, 8, 15, 24, 35],
    options: [45, 48, 52, 55],
    correct: 1, // 48
    rule: "n² − 1 for n = 1, 2, 3... (differences: 3, 5, 7, 9, 11, 13).",
  },
  {
    sequence: [10, 9, 7, 4, 0],
    options: [-4, -5, -6, -7],
    correct: 1, // -5
    rule: "Subtract increasing amounts: −1, −2, −3, −4, −5.",
  },
  {
    sequence: [6, 11, 16, 21, 26],
    options: [29, 30, 31, 32],
    correct: 2, // 31
    rule: "Add 5 each time (+5).",
  },
  {
    sequence: [2, 10, 30, 68, 130],
    options: [200, 218, 222, 232],
    correct: 2, // 222
    rule: "n³ + n for n = 1, 2, 3, 4, 5, 6.",
  },
  {
    sequence: [1, 4, 13, 40, 121],
    options: [350, 360, 364, 370],
    correct: 2, // 364
    rule: "Each number is the previous ×3 + 1.",
  },
  {
    sequence: [48, 24, 12, 6, 3],
    options: [1, 1.5, 2, 2.5],
    correct: 1, // 1.5
    rule: "Each number is halved (÷2).",
  },
  {
    sequence: [1, 7, 19, 37, 61],
    options: [81, 89, 91, 95],
    correct: 2, // 91
    rule: "Differences increase by 6: +6, +12, +18, +24, +30.",
  },
  {
    sequence: [3, 7, 13, 21, 31],
    options: [39, 41, 43, 45],
    correct: 2, // 43
    rule: "Differences increase by 2: +4, +6, +8, +10, +12.",
  },
  {
    sequence: [2, 2, 4, 12, 48],
    options: [192, 220, 240, 260],
    correct: 2, // 240
    rule: "Multiply by increasing integers: ×1, ×2, ×3, ×4, ×5.",
  },
  {
    sequence: [8, 4, 2, 1, 0.5],
    options: [0.125, 0.25, 0.5, 0.75],
    correct: 1, // 0.25
    rule: "Each number is halved (÷2).",
  },
  {
    sequence: [1, 2, 3, 5, 8, 13, 21],
    options: [29, 31, 33, 34],
    correct: 3, // 34
    rule: "Fibonacci sequence — each number is the sum of the two before it.",
  },
  {
    sequence: [100, 81, 64, 49, 36],
    options: [21, 24, 25, 28],
    correct: 2, // 25
    rule: "Perfect squares in decreasing order: 10², 9², 8², 7², 6², 5².",
  },
  {
    sequence: [4, 7, 12, 19, 28],
    options: [37, 38, 39, 40],
    correct: 2, // 39
    rule: "Differences increase by 2: +3, +5, +7, +9, +11.",
  },
  {
    sequence: [0, 1, 1, 2, 3, 5, 8],
    options: [11, 12, 13, 14],
    correct: 2, // 13
    rule: "Fibonacci sequence.",
  },
  {
    sequence: [1000, 100, 10, 1],
    options: [0, 0.1, 0.5, 1],
    correct: 1, // 0.1
    rule: "Divide by 10 each time (÷10).",
  },
  {
    sequence: [2, 8, 18, 32, 50],
    options: [68, 70, 72, 74],
    correct: 2, // 72
    rule: "2n² for n = 1, 2, 3, 4, 5, 6.",
  },
  {
    sequence: [15, 12, 9, 6, 3],
    options: [-3, -2, -1, 0],
    correct: 3, // 0
    rule: "Subtract 3 each time (−3).",
  },
  {
    sequence: [1, 4, 10, 20, 35],
    options: [52, 55, 56, 60],
    correct: 2, // 56
    rule: "Tetrahedral numbers: n(n+1)(n+2)/6.",
  },
  {
    sequence: [6, 12, 24, 48, 96],
    options: [168, 182, 192, 208],
    correct: 2, // 192
    rule: "Each number doubles (×2).",
  },
  {
    sequence: [7, 7, 14, 42, 168],
    options: [700, 720, 840, 900],
    correct: 2, // 840
    rule: "Multiply by increasing integers: ×1, ×2, ×3, ×4, ×5.",
  },
  {
    sequence: [1, 2, 5, 14, 42],
    options: [120, 128, 132, 140],
    correct: 2, // 132
    rule: "Catalan numbers.",
  },
  {
    sequence: [3, 6, 12, 24, 48],
    options: [72, 84, 96, 108],
    correct: 2, // 96
    rule: "Each number doubles (×2).",
  },
  {
    sequence: [5, 10, 17, 26, 37],
    options: [48, 50, 52, 54],
    correct: 1, // 50
    rule: "Differences increase by 2: +5, +7, +9, +11, +13.",
  },
  {
    sequence: [64, 32, 16, 8, 4],
    options: [1, 2, 3, 4],
    correct: 1, // 2
    rule: "Each number is halved (÷2).",
  },
  {
    sequence: [1, 11, 21, 1211, 111221],
    options: [312211, 321112, 1112221, 111222],
    correct: 0, // 312211
    rule: "Look and say sequence — describe the previous number.",
  },
  {
    sequence: [4, 16, 36, 64, 100],
    options: [120, 128, 136, 144],
    correct: 3, // 144
    rule: "Squares of even numbers: 2², 4², 6², 8², 10², 12².",
  },
  {
    sequence: [9, 18, 27, 36, 45],
    options: [50, 52, 54, 56],
    correct: 2, // 54
    rule: "Multiples of 9 (+9 each time).",
  },
  {
    sequence: [1, 2, 6, 24, 120, 720],
    options: [3600, 4320, 5040, 5760],
    correct: 2, // 5040
    rule: "Factorials: 1!, 2!, 3!, 4!, 5!, 6!, 7!",
  },
  {
    sequence: [500, 400, 310, 230, 160],
    options: [95, 98, 100, 105],
    correct: 2, // 100
    rule: "Subtract decreasing amounts: −100, −90, −80, −70, −60.",
  },
  {
    sequence: [2, 6, 18, 54, 162],
    options: [384, 468, 486, 512],
    correct: 2, // 486
    rule: "Each number is multiplied by 3 (×3).",
  },
  {
    sequence: [1, 3, 8, 21, 55],
    options: [112, 130, 144, 150],
    correct: 2, // 144
    rule: "Every other Fibonacci number: 1, 3, 8, 21, 55, 144.",
  },
  {
    sequence: [16, 8, 4, 2, 1],
    options: [0, 0.5, 0.75, 1],
    correct: 1, // 0.5
    rule: "Each number is halved (÷2).",
  },
  {
    sequence: [2, 5, 11, 23, 47],
    options: [85, 90, 95, 97],
    correct: 2, // 95
    rule: "Each number is double the previous minus 1: ×2−1... wait, ×2+1.",
  },
  {
    sequence: [11, 22, 33, 44, 55],
    options: [60, 64, 66, 70],
    correct: 2, // 66
    rule: "Multiples of 11 (+11 each time).",
  },
  {
    sequence: [1, 5, 12, 22, 35],
    options: [48, 50, 51, 55],
    correct: 2, // 51
    rule: "Pentagonal numbers: n(3n−1)/2.",
  },
  {
    sequence: [400, 200, 100, 50, 25],
    options: [10, 12.5, 15, 20],
    correct: 1, // 12.5
    rule: "Each number is halved (÷2).",
  },
  {
    sequence: [3, 3, 6, 9, 15, 24],
    options: [36, 38, 39, 42],
    correct: 2, // 39
    rule: "Fibonacci-like starting 3, 3.",
  },
  {
    sequence: [10, 100, 1000, 10000],
    options: [50000, 100000, 1000000, 100001],
    correct: 1, // 100000
    rule: "Each number is multiplied by 10 (×10).",
  },
  {
    sequence: [4, 9, 20, 43, 90],
    options: [181, 183, 185, 187],
    correct: 1, // 183
    rule: "Each number is double the previous plus 2, then plus 1 alternately — actually ×2+1 and ×2+2.",
  },
  {
    sequence: [1, 2, 4, 8, 16, 32, 64],
    options: [100, 112, 120, 128],
    correct: 3, // 128
    rule: "Each number doubles (×2).",
  },
  {
    sequence: [6, 14, 30, 62, 126],
    options: [232, 238, 254, 260],
    correct: 2, // 254
    rule: "Each number is double the previous plus 2.",
  },
  {
    sequence: [25, 20, 16, 13, 11],
    options: [8, 9, 10, 11],
    correct: 2, // 10
    rule: "Subtract decreasing amounts: −5, −4, −3, −2, −1.",
  },
  {
    sequence: [0, 4, 12, 24, 40],
    options: [56, 58, 60, 64],
    correct: 2, // 60
    rule: "n² − n for n = 1, 2, 3... (differences: 4, 8, 12, 16, 20).",
  },
  {
    sequence: [1, 1, 2, 6, 24, 120],
    options: [480, 600, 720, 840],
    correct: 2, // 720
    rule: "Factorials.",
  },
  {
    sequence: [8, 16, 32, 64, 128],
    options: [192, 224, 256, 288],
    correct: 2, // 256
    rule: "Each number doubles (×2).",
  },
  {
    sequence: [21, 18, 15, 12, 9],
    options: [3, 4, 5, 6],
    correct: 3, // 6
    rule: "Subtract 3 each time (−3).",
  },
  {
    sequence: [2, 3, 7, 16, 35],
    options: [70, 72, 74, 76],
    correct: 1, // 72
    rule: "Differences are themselves the sequence: 1, 4, 9, 19...",
  },
  {
    sequence: [12, 24, 48, 96, 192],
    options: [336, 368, 384, 400],
    correct: 2, // 384
    rule: "Each number doubles (×2).",
  },
  {
    sequence: [1, 6, 15, 28, 45],
    options: [60, 64, 66, 70],
    correct: 2, // 66
    rule: "Oblong numbers: n(n+1) — 1×2, 2×3, 3×4... so 66 = 6×11.",
  },
  {
    sequence: [3, 12, 48, 192],
    options: [576, 640, 768, 800],
    correct: 2, // 768
    rule: "Each number is multiplied by 4 (×4).",
  },
  {
    sequence: [0, 1, 4, 9, 16, 25],
    options: [32, 34, 36, 38],
    correct: 2, // 36
    rule: "Perfect squares: 0², 1², 2², 3², 4², 5², 6².",
  },
  {
    sequence: [5, 8, 13, 21, 34],
    options: [50, 53, 55, 58],
    correct: 2, // 55
    rule: "Fibonacci-like starting 5, 8.",
  },
  {
    sequence: [30, 28, 25, 21, 16],
    options: [8, 9, 10, 11],
    correct: 2, // 10
    rule: "Subtract increasing amounts: −2, −3, −4, −5, −6.",
  },
  {
    sequence: [1, 2, 4, 8, 16],
    options: [24, 28, 30, 32],
    correct: 3, // 32
    rule: "Each number doubles (powers of 2).",
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
    setTimeout(() => this._next(roomId, io).catch(() => {}), 4000);
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
