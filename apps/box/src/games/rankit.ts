import { nanoid } from "nanoid";
import type { PlayMode } from "../types";
import challengeData from "../seed/rankit-challenges.json";

interface RChallenge { id: number; question: string; items: string[]; correct: string[]; }
export interface RScore { guestId: string; displayName: string; score: number; }
export type RPhase = "countdown" | "question" | "reveal" | "game_over";

export interface RankItState {
  sessionId: string;
  questionIndex: number;
  totalQuestions: number;
  phase: RPhase;
  challenge: RChallenge | null;
  deadline: number | null;
  timeLimit: number;
  submissions: Record<string, string[]>;
  scores: RScore[];
  mode: PlayMode;
  passOrder: string[];
  passIndex: number;
}

const CHALLENGES: RChallenge[] = challengeData.challenges.map((c, i) => ({
  id: i + 1,
  question: c.q,
  items: c.items,
  correct: c.correct,
}));

const TIME_LIMIT = 25;
const TOTAL = 8;
const sessions = new Map<string, RankItState>();
const banks = new Map<string, RChallenge[]>();

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function startGame(roomId: string, mode: PlayMode, members: Array<{ guestId: string; displayName: string }>): RankItState {
  const sessionId = nanoid(12);
  banks.set(roomId, shuffle(CHALLENGES).slice(0, TOTAL).map(c => ({ ...c, items: shuffle(c.items) })));
  const state: RankItState = {
    sessionId,
    questionIndex: 0,
    totalQuestions: TOTAL,
    phase: "countdown",
    challenge: null,
    deadline: null,
    timeLimit: TIME_LIMIT,
    submissions: {},
    scores: members.map(m => ({ guestId: m.guestId, displayName: m.displayName, score: 0 })),
    mode,
    passOrder: members.map(m => m.guestId),
    passIndex: 0,
  };
  sessions.set(roomId, state);
  return state;
}

export function getState(roomId: string): RankItState | null { return sessions.get(roomId) ?? null; }

export function showChallenge(roomId: string): RankItState | null {
  const state = sessions.get(roomId);
  if (!state) return null;
  const c = banks.get(roomId)?.[state.questionIndex];
  if (!c) return null;
  state.phase = "question";
  state.challenge = c;
  state.deadline = Date.now() + TIME_LIMIT * 1000;
  state.submissions = {};
  if (state.mode === "pass_tablet") state.passIndex = 0;
  return state;
}

export function submitRanking(roomId: string, guestId: string, order: string[]): RankItState | null {
  const state = sessions.get(roomId);
  if (!state || state.phase !== "question" || state.submissions[guestId]) return null;
  state.submissions[guestId] = order;
  return state;
}

export function revealResults(roomId: string): RankItState | null {
  const state = sessions.get(roomId);
  if (!state || !state.challenge) return null;
  state.phase = "reveal";
  const correct = state.challenge.correct;
  for (const s of state.scores) {
    const sub = state.submissions[s.guestId];
    if (!sub) continue;
    let pts = 0;
    for (let i = 0; i < correct.length; i++) if (sub[i] === correct[i]) pts += 250;
    s.score += pts;
  }
  state.scores.sort((a, b) => b.score - a.score);
  return state;
}

export function advance(roomId: string): { state: RankItState; done: boolean } | null {
  const state = sessions.get(roomId);
  if (!state) return null;
  state.questionIndex++;
  if (state.questionIndex >= state.totalQuestions) { state.phase = "game_over"; return { state, done: true }; }
  state.phase = "countdown";
  state.challenge = null;
  return { state, done: false };
}

export function cleanup(roomId: string): void { sessions.delete(roomId); banks.delete(roomId); }
