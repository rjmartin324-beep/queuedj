import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import {
  type UnpopularOpinionsState,
  scoreUnpopularOpinionsGuess,
  UNPOPULAR_OPINIONS_PROMPTS,
} from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";
import { awardGameWin } from "../../lib/credits";

const KEY = (roomId: string) => `experience:opinions:${roomId}`;
const REVEAL_DELAY_MS   = 3000;  // 3s after last guess before auto-reveal
const JUDGE_TIMEOUT_MS  = 30000; // 30s — auto-skip if judge never submits
const GUESS_TIMEOUT_MS  = 45000; // 45s — auto-reveal if not all guests guess

export class UnpopularOpinionsExperience implements ExperienceModule {
  readonly type = "unpopular_opinions" as const;
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  async onActivate(roomId: string, hostGuestId: string): Promise<void> {
    // Build judge rotation from current members
    const membersRaw = await redisClient.sMembers(`room:${roomId}:members`);
    const shuffled = membersRaw.sort(() => Math.random() - 0.5);

    const state: UnpopularOpinionsState = {
      phase: "waiting",
      roundNumber: 0,
      totalRounds: Math.min(shuffled.length, 6), // One round per person, max 6
      currentJudgeId: null,
      judgeOrder: shuffled,
      currentPrompt: null,
      judgeScore: null,
      guesses: {},
      bets: {},
      scores: {},
    };
    await this._save(roomId, state);
  }

  async onDeactivate(roomId: string): Promise<void> {
    const t = this.timers.get(roomId);
    if (t) { clearTimeout(t); this.timers.delete(roomId); }
  }

  async handleAction({ action, payload, roomId, guestId, role, io }: {
    action: string; payload: unknown; roomId: string;
    guestId: string; role: "HOST" | "CO_HOST" | "GUEST"; io: Server;
  }): Promise<void> {
    const p = payload as any;

    switch (action) {
      // HOST starts the next round
      case "start_round":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._startRound(roomId, io);
        break;

      // JUDGE submits their secret score
      case "submit_judge_score":
        await this._submitJudgeScore(roomId, guestId, p.score, io);
        break;

      // GUEST submits a guess + optional bet
      case "submit_guess":
        await this._submitGuess(roomId, guestId, p.guess, p.bet ?? false, io);
        break;

      // HOST manually triggers reveal (auto-reveal also fires after timeout)
      case "reveal":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._reveal(roomId, io);
        break;

      case "next_round":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._startRound(roomId, io);
        break;

      case "show_scores":
        await this._showScores(roomId, io);
        break;
    }
  }

  async getGuestViewDescriptor(roomId: string): Promise<GuestViewDescriptor> {
    const state = await this._load(roomId);
    if (!state) return { type: "intermission" };
    switch (state.phase) {
      case "judging":   return { type: "opinions_judging",  data: { prompt: state.currentPrompt } };
      case "guessing":  return { type: "opinions_guessing", data: { prompt: state.currentPrompt } };
      case "reveal":    return { type: "opinions_reveal",   data: state.lastRoundResults };
      case "scores":    return { type: "leaderboard",       data: state.scores };
      default:          return { type: "intermission" };
    }
  }

  async getBootstrapState(roomId: string): Promise<unknown> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }

  // ─── Private ────────────────────────────────────────────────────────────

  private async _startRound(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;

    state.roundNumber += 1;
    if (state.roundNumber > state.totalRounds) {
      state.phase = "scores";
      await this._save(roomId, state);
      await this._broadcast(roomId, state, io);
      return;
    }

    // Next judge in rotation
    state.currentJudgeId = state.judgeOrder[(state.roundNumber - 1) % state.judgeOrder.length];
    state.currentPrompt = UNPOPULAR_OPINIONS_PROMPTS[
      Math.floor(Math.random() * UNPOPULAR_OPINIONS_PROMPTS.length)
    ];
    state.judgeScore = null;
    state.guesses = {};
    state.bets = {};
    state.phase = "judging";

    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);

    // Safety net: if judge goes AFK, auto-submit a neutral score after 30s
    const t = setTimeout(async () => {
      const s = await this._load(roomId);
      if (s && s.phase === "judging" && s.currentJudgeId === state.currentJudgeId) {
        await this._submitJudgeScore(roomId, state.currentJudgeId!, 5, io);
      }
    }, JUDGE_TIMEOUT_MS);
    const existing = this.timers.get(roomId);
    if (existing) clearTimeout(existing);
    this.timers.set(roomId, t);
  }

  private async _submitJudgeScore(roomId: string, guestId: string, score: number, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || state.phase !== "judging" || state.currentJudgeId !== guestId) return;

    const t = this.timers.get(roomId);
    if (t) { clearTimeout(t); this.timers.delete(roomId); }

    state.judgeScore = Math.max(1, Math.min(10, Math.round(score)));
    state.phase = "guessing";
    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);

    // Auto-reveal if not all guests guess within timeout
    const existing2 = this.timers.get(roomId);
    if (existing2) clearTimeout(existing2);
    const guessTimer = setTimeout(async () => {
      const s = await this._load(roomId);
      if (s && s.phase === "guessing") {
        await this._reveal(roomId, io);
      }
    }, GUESS_TIMEOUT_MS);
    this.timers.set(roomId, guessTimer);
  }

  private async _submitGuess(roomId: string, guestId: string, guess: number, bet: boolean, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || state.phase !== "guessing" || guestId === state.currentJudgeId) return;
    if (state.guesses[guestId] !== undefined) return; // Already guessed

    state.guesses[guestId] = Math.max(1, Math.min(10, Math.round(guess)));
    state.bets[guestId] = bet;
    await this._save(roomId, state);

    // Check if everyone has guessed
    const memberCount = await redisClient.sCard(`room:${roomId}:members`);
    const expectedGuessers = memberCount - 1; // Everyone except the judge
    if (Object.keys(state.guesses).length >= expectedGuessers) {
      // Clear the guess timeout, then delay reveal so guests see "all guessed" briefly
      const t = this.timers.get(roomId);
      if (t) { clearTimeout(t); this.timers.delete(roomId); }
      const revealTimer = setTimeout(() => this._reveal(roomId, io), REVEAL_DELAY_MS);
      this.timers.set(roomId, revealTimer);
    } else {
      // Broadcast updated guess count (not the guesses themselves)
      await this._broadcast(roomId, state, io);
    }
  }

  private async _reveal(roomId: string, io: Server): Promise<void> {
    const t = this.timers.get(roomId);
    if (t) { clearTimeout(t); this.timers.delete(roomId); }
    const state = await this._load(roomId);
    if (!state || state.judgeScore === null) return;

    // Score everyone
    const pointsEarned: Record<string, number> = {};
    for (const [gId, guess] of Object.entries(state.guesses)) {
      const pts = scoreUnpopularOpinionsGuess(guess, state.judgeScore, state.bets[gId] ?? false);
      pointsEarned[gId] = pts;
      state.scores[gId] = (state.scores[gId] ?? 0) + pts;
    }

    state.lastRoundResults = {
      prompt: state.currentPrompt!,
      judgeId: state.currentJudgeId!,
      judgeScore: state.judgeScore,
      guesses: state.guesses,
      bets: state.bets,
      pointsEarned,
    };
    state.phase = "reveal";
    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  private async _showScores(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;
    state.phase = "scores";
    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
    await awardGameWin(io, state.scores, roomId);
  }

  private async _broadcast(roomId: string, state: UnpopularOpinionsState, io: Server): Promise<void> {
    const seq = await getNextSequenceId(roomId);
    // Never send judgeScore during guessing phase
    const safeState = state.phase === "guessing" || state.phase === "judging"
      ? { ...state, judgeScore: null, guesses: {} } // Hide guesses too until reveal
      : state;

    io.to(roomId).emit("experience:state" as any, {
      experienceType: "unpopular_opinions",
      state: safeState,
      view: await this.getGuestViewDescriptor(roomId),
      sequenceId: seq,
    });
  }

  private async _load(roomId: string): Promise<UnpopularOpinionsState | null> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }

  private async _save(roomId: string, state: UnpopularOpinionsState): Promise<void> {
    await redisClient.set(KEY(roomId), JSON.stringify(state));
  }
}