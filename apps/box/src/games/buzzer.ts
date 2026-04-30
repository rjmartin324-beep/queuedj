import { nanoid } from "nanoid";
import type { TriviaAnswer, PlayMode } from "../types";
import * as db from "../db";

interface BQuestion { id: number; question: string; a: string; b: string; c: string; d: string; correct: TriviaAnswer; }

export interface BuzzerScore { guestId: string; displayName: string; score: number; correct: number; wrong: number; }
export type BuzzerPhase = "countdown" | "question" | "buzzed" | "reveal" | "game_over";

export interface BuzzerState {
  sessionId: string;
  questionIndex: number;
  totalQuestions: number;
  phase: BuzzerPhase;
  question: BQuestion | null;
  deadline: number | null;
  timeLimit: number;
  buzzedBy: string | null;
  lockedOut: string[];
  correctAnswer: TriviaAnswer | null;
  scores: BuzzerScore[];
  mode: PlayMode;
  passOrder: string[];
}

const TIME_LIMIT = 15;
const TOTAL = 10;
const sessions = new Map<string, BuzzerState>();
const banks = new Map<string, BQuestion[]>();

export function startGame(roomId: string, mode: PlayMode, members: Array<{ guestId: string; displayName: string }>): BuzzerState {
  const sessionId = nanoid(12);
  db.createSession(sessionId, roomId, "buzzer");
  const qs = db.drawQuestions(TOTAL);
  banks.set(roomId, qs.map(q => ({ id: q.id, question: q.question, a: q.a, b: q.b, c: q.c, d: q.d, correct: q.correct })));
  const state: BuzzerState = {
    sessionId,
    questionIndex: 0,
    totalQuestions: TOTAL,
    phase: "countdown",
    question: null,
    deadline: null,
    timeLimit: TIME_LIMIT,
    buzzedBy: null,
    lockedOut: [],
    correctAnswer: null,
    scores: members.map(m => ({ guestId: m.guestId, displayName: m.displayName, score: 0, correct: 0, wrong: 0 })),
    mode,
    passOrder: members.map(m => m.guestId),
  };
  sessions.set(roomId, state);
  return state;
}

export function getState(roomId: string): BuzzerState | null { return sessions.get(roomId) ?? null; }

export function showQuestion(roomId: string): BuzzerState | null {
  const state = sessions.get(roomId);
  if (!state) return null;
  const q = banks.get(roomId)?.[state.questionIndex];
  if (!q) return null;
  state.phase = "question";
  state.question = q;
  state.deadline = Date.now() + TIME_LIMIT * 1000;
  state.buzzedBy = null;
  state.lockedOut = [];
  state.correctAnswer = null;
  return state;
}

export function buzz(roomId: string, guestId: string): BuzzerState | null {
  const state = sessions.get(roomId);
  if (!state || state.phase !== "question" || state.buzzedBy || state.lockedOut.includes(guestId)) return null;
  state.buzzedBy = guestId;
  state.phase = "buzzed";
  return state;
}

export function submitAnswer(roomId: string, guestId: string, answer: TriviaAnswer): BuzzerState | null {
  const state = sessions.get(roomId);
  if (!state || state.phase !== "buzzed" || state.buzzedBy !== guestId || !state.question) return null;
  const correct = state.question.correct;
  if (answer === correct) {
    const s = state.scores.find(s => s.guestId === guestId);
    if (s) { s.score += 1000; s.correct++; }
    return revealAnswers(roomId);
  } else {
    const s = state.scores.find(s => s.guestId === guestId);
    if (s) { s.score = Math.max(0, s.score - 200); s.wrong++; }
    state.lockedOut.push(guestId);
    const remaining = state.scores.filter(s => !state.lockedOut.includes(s.guestId)).length;
    if (remaining === 0) return revealAnswers(roomId);
    state.buzzedBy = null;
    state.phase = "question";
    return state;
  }
}

export function revealAnswers(roomId: string): BuzzerState | null {
  const state = sessions.get(roomId);
  if (!state || !state.question) return null;
  state.phase = "reveal";
  state.correctAnswer = state.question.correct;
  state.scores.sort((a, b) => b.score - a.score);
  return state;
}

export function advance(roomId: string): { state: BuzzerState; done: boolean } | null {
  const state = sessions.get(roomId);
  if (!state) return null;
  state.questionIndex++;
  if (state.questionIndex >= state.totalQuestions) {
    state.phase = "game_over";
    db.persistScores(state.sessionId, state.scores.map(s => ({ guestId: s.guestId, displayName: s.displayName, score: s.score, correct: s.correct, wrong: s.wrong })));
    return { state, done: true };
  }
  state.phase = "countdown";
  state.question = null;
  state.correctAnswer = null;
  return { state, done: false };
}

export function cleanup(roomId: string): void {
  const state = sessions.get(roomId);
  if (state) {
    try {
      db.persistScores(state.sessionId, state.scores.map(s => ({
        guestId: s.guestId, displayName: s.displayName, score: s.score, correct: s.correct, wrong: s.wrong,
      })));
    } catch {}
  }
  sessions.delete(roomId);
  banks.delete(roomId);
}
