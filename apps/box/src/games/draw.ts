import { nanoid } from "nanoid";
import type { PlayMode } from "../types";
import wordData from "../seed/draw-words.json";

export interface DrawScore { guestId: string; displayName: string; score: number; }
export type DrawPhase = "drawing" | "reveal" | "game_over";

export interface DrawState {
  sessionId: string;
  roundIndex: number;
  totalRounds: number;
  phase: DrawPhase;
  drawerId: string;
  word: string | null;
  wordForGuessers: null; // always null — word is secret
  deadline: number | null;
  timeLimit: number;
  guessedBy: string[]; // guestIds who guessed correctly this round
  scores: DrawScore[];
  mode: PlayMode;
  passOrder: string[];
  drawerOrder: string[]; // who draws each round
}

const WORDS: string[] = [
  ...wordData.easy,
  ...wordData.medium,
  ...wordData.hard,
  ...wordData.impossible,
];

const TIME_LIMIT = 60;
const sessions = new Map<string, DrawState>();
const wordBanks = new Map<string, string[]>();

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function startGame(roomId: string, mode: PlayMode, members: Array<{ guestId: string; displayName: string }>): DrawState {
  const sessionId = nanoid(12);
  const drawerOrder = shuffle(members.map(m => m.guestId));
  wordBanks.set(roomId, shuffle([...WORDS]));
  const state: DrawState = {
    sessionId,
    roundIndex: 0,
    totalRounds: drawerOrder.length,
    phase: "drawing",
    drawerId: drawerOrder[0],
    word: wordBanks.get(roomId)![0],
    wordForGuessers: null,
    deadline: Date.now() + TIME_LIMIT * 1000,
    timeLimit: TIME_LIMIT,
    guessedBy: [],
    scores: members.map(m => ({ guestId: m.guestId, displayName: m.displayName, score: 0 })),
    mode,
    passOrder: members.map(m => m.guestId),
    drawerOrder,
  };
  sessions.set(roomId, state);
  return state;
}

export function getState(roomId: string): DrawState | null { return sessions.get(roomId) ?? null; }

// Returns the state to send — strips the word for non-drawers on the server side at broadcast time
export function getStateForPlayer(roomId: string, guestId: string): DrawState | null {
  const state = sessions.get(roomId);
  if (!state) return null;
  if (guestId === state.drawerId) return state;
  return { ...state, word: null }; // hide word from guessers
}

export function submitGuess(roomId: string, guestId: string, guess: string): { correct: boolean; state: DrawState } | null {
  const state = sessions.get(roomId);
  if (!state || state.phase !== "drawing" || guestId === state.drawerId) return null;
  if (state.guessedBy.includes(guestId)) return null;
  if (!state.word) return null;
  const correct = guess.trim().toLowerCase() === state.word.toLowerCase();
  if (correct) {
    state.guessedBy.push(guestId);
    const s = state.scores.find(s => s.guestId === guestId);
    if (s) s.score += Math.max(100, 500 - state.guessedBy.length * 100);
    // Drawer also gets points per guesser
    const drawer = state.scores.find(s => s.guestId === state.drawerId);
    if (drawer) drawer.score += 100;
    // If everyone guessed, auto-reveal
    const guessers = state.passOrder.filter(id => id !== state.drawerId);
    if (guessers.every(id => state.guessedBy.includes(id))) revealRound(roomId);
  }
  return { correct, state: sessions.get(roomId)! };
}

export function revealRound(roomId: string): DrawState | null {
  const state = sessions.get(roomId);
  if (!state) return null;
  state.phase = "reveal";
  state.scores.sort((a, b) => b.score - a.score);
  return state;
}

export function advance(roomId: string): { state: DrawState; done: boolean } | null {
  const state = sessions.get(roomId);
  if (!state) return null;
  state.roundIndex++;
  if (state.roundIndex >= state.totalRounds) { state.phase = "game_over"; return { state, done: true }; }
  const words = wordBanks.get(roomId) ?? [];
  state.phase = "drawing";
  state.drawerId = state.drawerOrder[state.roundIndex];
  state.word = words[state.roundIndex] ?? "banana";
  state.deadline = Date.now() + TIME_LIMIT * 1000;
  state.guessedBy = [];
  return { state, done: false };
}

export function cleanup(roomId: string): void { sessions.delete(roomId); wordBanks.delete(roomId); }
