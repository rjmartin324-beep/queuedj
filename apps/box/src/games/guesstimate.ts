import { nanoid } from "nanoid";
import type { PlayMode } from "../types";
import questionData from "../seed/guesstimate-questions.json";
import * as db from "../db";

interface GQuestion { id: number; question: string; answer: number; unit: string; }

export interface GScore { guestId: string; displayName: string; score: number; }
export type GPhase = "countdown" | "question" | "reveal" | "game_over";

export interface GuessimateState {
  sessionId: string;
  questionIndex: number;
  totalQuestions: number;
  phase: GPhase;
  question: GQuestion | null;
  deadline: number | null;
  timeLimit: number;
  guesses: Record<string, number>;
  scores: GScore[];
  mode: PlayMode;
  passOrder: string[];
  passIndex: number;
}

const QUESTIONS: GQuestion[] = questionData.questions.map((q, i) => ({ id: i + 1, ...q }));

const TIME_LIMIT = 20;
const TOTAL = 10;
const sessions = new Map<string, GuessimateState>();
const banks = new Map<string, GQuestion[]>();

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function scoreGuess(guess: number, answer: number): number {
  if (answer === 0) return guess === 0 ? 1000 : 0;
  const pct = Math.abs(guess - answer) / Math.abs(answer);
  return Math.max(0, Math.round(1000 * (1 - Math.min(pct, 1))));
}

export function startGame(roomId: string, mode: PlayMode, members: Array<{ guestId: string; displayName: string }>): GuessimateState {
  const sessionId = nanoid(12);
  db.createSession(sessionId, roomId, "guesstimate");
  banks.set(roomId, shuffle(QUESTIONS).slice(0, TOTAL));
  const state: GuessimateState = {
    sessionId,
    questionIndex: 0,
    totalQuestions: TOTAL,
    phase: "countdown",
    question: null,
    deadline: null,
    timeLimit: TIME_LIMIT,
    guesses: {},
    scores: members.map(m => ({ guestId: m.guestId, displayName: m.displayName, score: 0 })),
    mode,
    passOrder: members.map(m => m.guestId),
    passIndex: 0,
  };
  sessions.set(roomId, state);
  return state;
}

export function getState(roomId: string): GuessimateState | null { return sessions.get(roomId) ?? null; }

export function showQuestion(roomId: string): GuessimateState | null {
  const state = sessions.get(roomId);
  if (!state) return null;
  const q = banks.get(roomId)?.[state.questionIndex];
  if (!q) return null;
  state.phase = "question";
  state.question = q;
  state.deadline = Date.now() + TIME_LIMIT * 1000;
  state.guesses = {};
  if (state.mode === "pass_tablet") state.passIndex = 0;
  return state;
}

export function submitGuess(roomId: string, guestId: string, guess: number): GuessimateState | null {
  const state = sessions.get(roomId);
  if (!state || state.phase !== "question" || state.guesses[guestId] !== undefined) return null;
  state.guesses[guestId] = guess;
  return state;
}

export function revealGuesses(roomId: string): GuessimateState | null {
  const state = sessions.get(roomId);
  if (!state || !state.question) return null;
  state.phase = "reveal";
  const answer = state.question.answer;
  for (const s of state.scores) {
    if (state.guesses[s.guestId] !== undefined) s.score += scoreGuess(state.guesses[s.guestId], answer);
  }
  state.scores.sort((a, b) => b.score - a.score);
  return state;
}

export function advance(roomId: string): { state: GuessimateState; done: boolean } | null {
  const state = sessions.get(roomId);
  if (!state) return null;
  state.questionIndex++;
  if (state.questionIndex >= state.totalQuestions) {
    state.phase = "game_over";
    db.persistScores(state.sessionId, state.scores.map(s => ({ guestId: s.guestId, displayName: s.displayName, score: s.score, correct: 0, wrong: 0 })));
    return { state, done: true };
  }
  state.phase = "countdown";
  state.question = null;
  return { state, done: false };
}

export function cleanup(roomId: string): void {
  const state = sessions.get(roomId);
  if (state) {
    try {
      db.persistScores(state.sessionId, state.scores.map(s => ({
        guestId: s.guestId, displayName: s.displayName, score: s.score, correct: 0, wrong: 0,
      })));
    } catch {}
  }
  sessions.delete(roomId);
  banks.delete(roomId);
}
