import { nanoid } from "nanoid";
import type {
  TriviaGameState,
  TriviaQuestion,
  TriviaScore,
  TriviaAnswer,
  TriviaCategory,
  TournamentRound,
  PlayMode,
} from "../types";
import * as db from "../db";

// ─── Constants ────────────────────────────────────────────────────────────────

const QUESTIONS_PER_ROUND: Record<TournamentRound | "Standard", number> = {
  Standard: 10,
  Sweep: 10,
  "Draft Pick": 8,
  "Big Board": 8,
  "Hard Mode": 8,
  "Sudden Death": 10,
};

const TIME_LIMIT: Record<TournamentRound | "Standard", number> = {
  Standard: 20,
  Sweep: 20,
  "Draft Pick": 15,
  "Big Board": 20,
  "Hard Mode": 15,
  "Sudden Death": 10,
};

const POINT_MULTIPLIER: Record<TournamentRound | "Standard", number> = {
  Standard: 1,
  Sweep: 1,
  "Draft Pick": 1.2,
  "Big Board": 2,
  "Hard Mode": 1.5,
  "Sudden Death": 2,
};

// Round names are UX labels; their mechanics are in TIME_LIMIT / POINT_MULTIPLIER above.
// "Big Board" = 2x points. "Hard Mode" = hard/extreme questions only. "Sudden Death" = elimination.
const TOURNAMENT_ORDER: TournamentRound[] = [
  "Sweep",
  "Draft Pick",
  "Big Board",
  "Hard Mode",
  "Sudden Death",
];

// ─── In-memory state ──────────────────────────────────────────────────────────

const sessions = new Map<string, TriviaGameState>(); // roomId → state
const questionBanks = new Map<string, TriviaQuestion[]>(); // sessionId → pre-drawn questions

// ─── Helpers ──────────────────────────────────────────────────────────────────

function baseScore(q: TriviaQuestion): number {
  if (q.difficulty === "easy") return 600;
  if (q.difficulty === "medium") return 1000;
  if (q.difficulty === "hard") return 1400;
  return 1800; // extreme
}

function speedBonus(answeredAt: number, deadline: number, timeLimit: number): number {
  const remaining = Math.max(0, deadline - answeredAt);
  return Math.round((remaining / (timeLimit * 1000)) * 400);
}

function buildScores(guestIds: string[], displayNames: Record<string, string>): TriviaScore[] {
  return guestIds.map((guestId) => ({
    guestId,
    displayName: displayNames[guestId] ?? guestId,
    score: 0,
    correct: 0,
    wrong: 0,
    streak: 0,
    eliminated: false,
  }));
}

function drawBank(state: TriviaGameState): TriviaQuestion[] {
  const roundName = state.roundName;
  const count = QUESTIONS_PER_ROUND[roundName];
  // Over-fetch then filter out already-asked, so cross-round dedup works
  const fetchCount = count * 3;
  const asked = new Set(state.askedQuestionIds);
  let candidates: TriviaQuestion[];
  if (roundName === "Hard Mode")        candidates = db.drawQuestions(fetchCount, undefined, true);
  else if (roundName === "Draft Pick" && state.draftCategory) candidates = db.drawQuestions(fetchCount, state.draftCategory);
  else                                  candidates = db.drawQuestions(fetchCount);
  const fresh = candidates.filter(q => !asked.has(q.id)).slice(0, count);
  // If we're scraping the bottom of the barrel (small DB), top up with repeats rather than starve
  const final = fresh.length >= count ? fresh : [...fresh, ...candidates.filter(q => asked.has(q.id)).slice(0, count - fresh.length)];
  for (const q of final) state.askedQuestionIds.push(q.id);
  return final;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function startGame(
  roomId: string,
  mode: PlayMode,
  tournament: boolean,
  members: Array<{ guestId: string; displayName: string }>
): TriviaGameState {
  const sessionId = nanoid(12);
  db.createSession(sessionId, roomId, "trivia");

  const roundName: TournamentRound | "Standard" = tournament ? "Sweep" : "Standard";
  const passOrder = members.map((m) => m.guestId);
  const displayNames: Record<string, string> = {};
  for (const m of members) displayNames[m.guestId] = m.displayName;

  const state: TriviaGameState = {
    sessionId,
    round: 1,
    roundName,
    questionIndex: 0,
    totalInRound: QUESTIONS_PER_ROUND[roundName],
    phase: "countdown",
    question: null,
    timeLimit: TIME_LIMIT[roundName],
    deadline: null,
    answers: {},
    answeredAt: {},
    scores: buildScores(passOrder, displayNames),
    mode,
    tournament,
    passOrder,
    passIndex: 0,
    draftCategory: null,
    pointMultiplier: POINT_MULTIPLIER[roundName],
    askedQuestionIds: [],
  };

  const bank = drawBank(state);
  questionBanks.set(sessionId, bank);
  sessions.set(roomId, state);
  return state;
}

export function getState(roomId: string): TriviaGameState | null {
  return sessions.get(roomId) ?? null;
}

// Called after the countdown finishes — loads the next question and opens answers
export function showQuestion(roomId: string): TriviaGameState | null {
  const state = sessions.get(roomId);
  if (!state) return null;

  const bank = questionBanks.get(state.sessionId) ?? [];
  const q = bank[state.questionIndex];
  if (!q) return null;

  const timeLimit = TIME_LIMIT[state.roundName];
  const deadline = Date.now() + timeLimit * 1000;

  state.phase = "question";
  state.question = q;
  state.timeLimit = timeLimit;
  state.deadline = deadline;
  state.answers = {};
  state.answeredAt = {};

  // In pass_tablet mode, reset pass index to first non-eliminated player
  if (state.mode === "pass_tablet") {
    state.passIndex = state.passOrder.findIndex((id) => !state.scores.find((s) => s.guestId === id)?.eliminated);
    if (state.passIndex === -1) state.passIndex = 0;
  }

  return state;
}

// Record a player's answer. Returns updated state.
export function submitAnswer(
  roomId: string,
  guestId: string,
  answer: TriviaAnswer
): { state: TriviaGameState; allAnswered: boolean } | null {
  const state = sessions.get(roomId);
  if (!state || state.phase !== "question") return null;

  // Don't overwrite — first answer counts
  if (state.answers[guestId]) return { state, allAnswered: false };

  state.answers[guestId] = answer;
  state.answeredAt[guestId] = Date.now();

  const activePlayers = state.scores.filter((s) => !s.eliminated).map((s) => s.guestId);
  const allAnswered = activePlayers.every((id) => state.answers[id]);

  return { state, allAnswered };
}

// Reveal answers and compute score deltas. Returns updated state.
export function revealAnswers(roomId: string): TriviaGameState | null {
  const state = sessions.get(roomId);
  if (!state || !state.question) return null;

  state.phase = "reveal";
  const q = state.question;
  const multiplier = state.pointMultiplier;

  for (const score of state.scores) {
    if (score.eliminated) continue;
    const answer = state.answers[score.guestId];
    if (!answer) {
      // No answer = wrong
      score.wrong++;
      score.streak = 0;
      if (state.roundName === "Sudden Death") score.eliminated = true;
      continue;
    }

    if (answer === q.correct) {
      const base = baseScore(q);
      const speed = state.deadline ? speedBonus(state.answeredAt[score.guestId], state.deadline, state.timeLimit) : 0;
      const streakBonus = score.streak * 100;
      score.score += Math.round((base + speed + streakBonus) * multiplier);
      score.correct++;
      score.streak++;
    } else {
      score.wrong++;
      score.streak = 0;
      if (state.roundName === "Sudden Death") score.eliminated = true;
    }
  }

  // Sort by score descending
  state.scores.sort((a, b) => b.score - a.score);

  // Sudden Death terminator: if everyone (or all but one) is eliminated, end the game now
  if (state.roundName === "Sudden Death") {
    const alive = state.scores.filter(s => !s.eliminated);
    if (alive.length <= 1) {
      state.phase = "game_over";
      db.persistScores(state.sessionId, state.scores.map(s => ({
        guestId: s.guestId, displayName: s.displayName, score: s.score, correct: s.correct, wrong: s.wrong,
      })));
    }
  }

  return state;
}

// Advance to next question or end the round/game
export function advance(roomId: string): { state: TriviaGameState; done: boolean; roundOver: boolean } | null {
  const state = sessions.get(roomId);
  if (!state) return null;

  state.questionIndex++;

  const bank = questionBanks.get(state.sessionId) ?? [];
  const roundOver = state.questionIndex >= state.totalInRound || state.questionIndex >= bank.length;

  if (!roundOver) {
    // Next question countdown
    state.phase = "countdown";
    state.question = null;
    return { state, done: false, roundOver: false };
  }

  // Round over
  const isDone = !state.tournament || state.round >= 5;

  if (isDone) {
    state.phase = "game_over";
    db.persistScores(
      state.sessionId,
      state.scores.map((s) => ({
        guestId: s.guestId,
        displayName: s.displayName,
        score: s.score,
        correct: s.correct,
        wrong: s.wrong,
      }))
    );
    // Keep session in memory until room closes so reconnecting players can see final state.
    // cleanup() handles deletion.
    return { state, done: true, roundOver: true };
  }

  // Next tournament round
  const nextRound = TOURNAMENT_ORDER[state.round]; // state.round is 1-indexed, array is 0-indexed
  state.round++;
  state.roundName = nextRound;
  state.questionIndex = 0;
  state.totalInRound = QUESTIONS_PER_ROUND[nextRound];
  state.timeLimit = TIME_LIMIT[nextRound];
  state.pointMultiplier = POINT_MULTIPLIER[nextRound];
  state.phase = "round_end";
  state.draftCategory = null;

  // Re-draw bank for new round
  const newBank = drawBank(state);
  questionBanks.set(state.sessionId, newBank);

  return { state, done: false, roundOver: true };
}

// Draft Pick round: host picks category before round starts
export function pickCategory(roomId: string, category: TriviaCategory): TriviaGameState | null {
  const state = sessions.get(roomId);
  if (!state || state.roundName !== "Draft Pick") return null;

  state.draftCategory = category;
  // Use drawBank so askedQuestionIds dedup applies to Draft Pick round too
  const bank = drawBank(state);
  questionBanks.set(state.sessionId, bank);
  return state;
}

// pass_tablet: advance whose turn it is
export function nextPassTurn(roomId: string): TriviaGameState | null {
  const state = sessions.get(roomId);
  if (!state || state.mode !== "pass_tablet") return null;

  let next = (state.passIndex + 1) % state.passOrder.length;
  // Skip eliminated players
  let tries = 0;
  while (state.scores.find((s) => s.guestId === state.passOrder[next])?.eliminated && tries < state.passOrder.length) {
    next = (next + 1) % state.passOrder.length;
    tries++;
  }
  state.passIndex = next;
  return state;
}

export function cleanup(roomId: string): void {
  const state = sessions.get(roomId);
  if (state) {
    // Best-effort score persistence — catches force-end / room-close paths
    // that don't reach natural game_over. UPSERT-safe if game_over already persisted.
    try {
      db.persistScores(state.sessionId, state.scores.map(s => ({
        guestId: s.guestId, displayName: s.displayName, score: s.score, correct: s.correct, wrong: s.wrong,
      })));
    } catch {}
    questionBanks.delete(state.sessionId);
  }
  sessions.delete(roomId);
}
