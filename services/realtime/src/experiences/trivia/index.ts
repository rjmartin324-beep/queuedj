import type { Server } from "socket.io";
import type {
  ExperienceModule,
  GuestViewDescriptor,
  TriviaRoundState,
  TriviaQuestion,
} from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";
import { SAMPLE_QUESTIONS } from "./questions";
import { awardGameWin } from "../../lib/credits";
import { shuffle } from "../../lib/shuffle";

// ─────────────────────────────────────────────────────────────────────────────
// Trivia Experience
//
// Same room, same phones, same QR code — just a different experience.
// Host switches to trivia mid-party. Guests see answer buttons instead of queue.
// After trivia, host switches back to DJ. Music picks up where it left off.
//
// Actions:
//   HOST:  start_round, next_question, show_leaderboard, end_trivia
//   GUEST: submit_answer
// ─────────────────────────────────────────────────────────────────────────────

const TRIVIA_STATE_KEY = (roomId: string) => `experience:trivia:${roomId}`;
const ANSWER_TIMEOUT_MS = 20_000; // 20s per question

export class TriviaExperience implements ExperienceModule {
  readonly type = "trivia" as const;
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  async onActivate(roomId: string, hostGuestId: string): Promise<void> {
    // Don't reset state if a game is already in progress — host reconnect or
    // accidental re-activation would otherwise wipe scores and kill the timer.
    const existing = await this._getState(roomId);
    if (existing && existing.phase !== "waiting" && existing.phase !== "finished") {
      return;
    }
    const state: TriviaRoundState = {
      roundNumber: 0,
      totalRounds: 10,
      scores: {},
      answers: {},
      phase: "waiting",
    };
    await redisClient.set(TRIVIA_STATE_KEY(roomId), JSON.stringify(state));
  }

  async onDeactivate(roomId: string): Promise<void> {
    const timer = this.timers.get(roomId);
    if (timer) { clearTimeout(timer); this.timers.delete(roomId); }
    await redisClient.del(TRIVIA_STATE_KEY(roomId));
  }

  async handleAction({ action, payload, roomId, guestId, role, io }: {
    action: string;
    payload: unknown;
    roomId: string;
    guestId: string;
    role: "HOST" | "CO_HOST" | "GUEST";
    io: Server;
  }): Promise<void> {
    switch (action) {

      // ─── HOST: Start the round ──────────────────────────────────────────
      case "start_round":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._startRound(roomId, io);
        break;

      // ─── HOST: Resume after server restart (re-arm timer if stuck in question) ─
      case "resume":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._resumeIfStuck(roomId, io);
        break;

      // ─── HOST: Next question ────────────────────────────────────────────
      case "next_question":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._nextQuestion(roomId, io);
        break;

      // ─── HOST: Show leaderboard ─────────────────────────────────────────
      case "show_leaderboard":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._showLeaderboard(roomId, io);
        break;

      // ─── HOST: Manually reveal answer (skip timer) ──────────────────────
      case "reveal_answer":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._revealAnswer(roomId, io);
        break;

      // ─── HOST: End trivia ───────────────────────────────────────────────
      case "end_trivia":
        if (role !== "HOST") return;
        await this.onDeactivate(roomId);
        // Switch everyone back to DJ experience
        await redisClient.set(`room:${roomId}:experience`, "dj");
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:changed" as any, {
          experienceType: "dj",
          view: { type: "dj_queue" },
          sequenceId: seq,
        });
        break;

      // ─── GUEST: Submit answer ───────────────────────────────────────────
      case "submit_answer":
        await this._submitAnswer(roomId, guestId, (payload as any).optionId, io);
        break;
    }
  }

  async getGuestViewDescriptor(roomId: string): Promise<GuestViewDescriptor> {
    const state = await this._getState(roomId);
    if (!state) return { type: "intermission" };

    switch (state.phase) {
      case "waiting":     return { type: "trivia_waiting" };
      case "question":    return { type: "trivia_question", data: this._safeQuestion(state.currentQuestion) };
      case "reveal":      return { type: "trivia_result",   data: state };
      case "leaderboard": return { type: "leaderboard",     data: state.scores };
      case "finished":    return { type: "leaderboard",     data: state.scores };
      default:            return { type: "intermission" };
    }
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async _startRound(roomId: string, io: Server): Promise<void> {
    const state = await this._getState(roomId);
    if (!state) return;
    state.roundNumber = 1;
    state.phase = "waiting";
    state.scores = {};
    // Build a fresh shuffled queue — no repeats until all questions used
    (state as any).questionQueue = shuffle(SAMPLE_QUESTIONS.map(q => q.id));
    (state as any).questionQueueIdx = 0;
    await this._saveState(roomId, state);

    // Broadcast 3-2-1 countdown to all guests before first question
    const countdownEndsAt = Date.now() + 3500;
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "trivia",
      state: null,
      view: { type: "trivia_countdown", data: { endsAt: countdownEndsAt } },
    });
    const existing = this.timers.get(roomId);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => this._nextQuestion(roomId, io), 3500);
    this.timers.set(roomId, t);
  }

  private async _nextQuestion(roomId: string, io: Server): Promise<void> {
    const state = await this._getState(roomId);
    if (!state) return;

    if (state.roundNumber > state.totalRounds) {
      await this._showLeaderboard(roomId, io);
      return;
    }

    // Pull next from pre-shuffled queue; re-shuffle when exhausted
    let queue: string[] = (state as any).questionQueue ?? shuffle(SAMPLE_QUESTIONS.map(q => q.id));
    let idx: number = (state as any).questionQueueIdx ?? 0;
    if (idx >= queue.length) { queue = shuffle(SAMPLE_QUESTIONS.map(q => q.id)); idx = 0; }
    const questionId = queue[idx];
    (state as any).questionQueue = queue;
    (state as any).questionQueueIdx = idx + 1;
    const question = SAMPLE_QUESTIONS.find(q => q.id === questionId) ?? SAMPLE_QUESTIONS[0];

    state.currentQuestion = question;
    state.answers = {};      // Clear previous answers
    state.phase = "question";
    await this._saveState(roomId, state);

    const seq = await getNextSequenceId(roomId);

    // Send to all — guests get question WITHOUT the correct answer
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "trivia",
      state: { ...state, answers: undefined }, // Never send answers to guests
      view: { type: "trivia_question", data: this._safeQuestion(question) },
      sequenceId: seq,
    });

    // Auto-reveal after time limit — cancel any previous timer first
    const existing = this.timers.get(roomId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.timers.delete(roomId);
      this._revealAnswer(roomId, io).catch((err) => {
        console.error("[trivia] auto-reveal failed", { roomId, err });
      });
    }, question.timeLimitSeconds * 1000);
    this.timers.set(roomId, timer);
  }

  private async _submitAnswer(
    roomId: string,
    guestId: string,
    optionId: string,
    io: Server,
  ): Promise<void> {
    const state = await this._getState(roomId);
    if (!state || state.phase !== "question") return;
    if (state.answers[guestId]) return; // Already answered

    state.answers[guestId] = optionId;
    await this._saveState(roomId, state);

    // No broadcast needed — client already shows selected state locally.
    // Broadcasting would wipe guestViewData for all guests (no question in payload).
  }

  private async _revealAnswer(roomId: string, io: Server): Promise<void> {
    // Cancel pending auto-reveal timer if host triggered this manually
    const existing = this.timers.get(roomId);
    if (existing) { clearTimeout(existing); this.timers.delete(roomId); }

    const state = await this._getState(roomId);
    if (!state || !state.currentQuestion || state.phase !== "question") return;

    const correctId = state.currentQuestion.correctOptionId;

    // Score everyone who answered correctly
    // Speed bonus: earlier answers get more points (Phase 5 enhancement)
    for (const [guestId, answerId] of Object.entries(state.answers)) {
      if (answerId === correctId) {
        state.scores[guestId] = (state.scores[guestId] ?? 0) + 100;
      }
    }

    state.phase = "reveal";
    state.roundNumber += 1;
    await this._saveState(roomId, state);

    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "trivia",
      state,                    // Full state with correct answer for reveal
      view: { type: "trivia_result", data: state },
      sequenceId: seq,
    });
  }

  private async _showLeaderboard(roomId: string, io: Server): Promise<void> {
    const state = await this._getState(roomId);
    if (!state) return;

    state.phase = state.roundNumber > state.totalRounds ? "finished" : "leaderboard";
    await this._saveState(roomId, state);

    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "trivia",
      state,
      view: { type: "leaderboard", data: state.scores },
      sequenceId: seq,
    });

    if (state.phase === "finished") {
      await awardGameWin(io, state.scores, roomId);
    }
  }

  // Re-arm the auto-reveal timer if the server restarted mid-question.
  // Safe to call any time — only acts when phase is "question" and no timer is running.
  private async _resumeIfStuck(roomId: string, io: Server): Promise<void> {
    const state = await this._getState(roomId);
    if (!state || state.phase !== "question") return;
    if (this.timers.has(roomId)) return; // Timer already running

    const question = state.currentQuestion;
    if (!question) return;

    // Re-arm with a short grace window so guests aren't waiting the full duration again
    const GRACE_MS = 10_000;
    const timer = setTimeout(() => {
      this.timers.delete(roomId);
      this._revealAnswer(roomId, io).catch((err) => {
        console.error("[trivia] resume auto-reveal failed", { roomId, err });
      });
    }, GRACE_MS);
    this.timers.set(roomId, timer);

    // Re-broadcast current question so any reconnected guests see it
    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "trivia",
      state: { ...state, answers: undefined },
      view: { type: "trivia_question", data: this._safeQuestion(question) },
      sequenceId: seq,
    });
  }

  async getBootstrapState(roomId: string): Promise<unknown> {
    const state = await this._getState(roomId);
    if (!state) return null;
    // Strip the correct answer during active question phase — guests shouldn't see it
    if (state.phase === "question") {
      return { ...state, answers: undefined };
    }
    return state;
  }

  private async _getState(roomId: string): Promise<TriviaRoundState | null> {
    const raw = await redisClient.get(TRIVIA_STATE_KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }

  private async _saveState(roomId: string, state: TriviaRoundState): Promise<void> {
    await redisClient.set(TRIVIA_STATE_KEY(roomId), JSON.stringify(state));
  }

  /** Strip correct answer before sending to guests */
  private _safeQuestion(q?: TriviaQuestion): Omit<TriviaQuestion, "correctOptionId"> | undefined {
    if (!q) return undefined;
    const { correctOptionId, ...safe } = q;
    return safe;
  }
}
