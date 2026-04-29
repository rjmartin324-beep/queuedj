import { nanoid } from "nanoid";
import type { PlayMode } from "../types";
import puzzleData from "../seed/connections-puzzles.json";

export interface ConnGroup { category: string; color: "yellow" | "green" | "blue" | "purple"; items: string[]; }
interface ConnPuzzle { id: number; groups: ConnGroup[]; }

export interface ConnPlayerState {
  found: string[]; // colors of groups found
  attempts: number; // wrong attempts
  done: boolean;
}

export interface ConnScore { guestId: string; displayName: string; score: number; }
export type ConnPhase = "question" | "reveal" | "game_over";
const COLOR_POINTS = { yellow: 100, green: 200, blue: 300, purple: 400 };

export interface ConnectionsState {
  sessionId: string;
  puzzleIndex: number;
  totalPuzzles: number;
  phase: ConnPhase;
  tiles: string[]; // 16 shuffled tiles
  puzzle: ConnPuzzle | null;
  players: Record<string, ConnPlayerState>; // guestId → progress
  scores: ConnScore[];
  mode: PlayMode;
  passOrder: string[];
}

const PUZZLES: ConnPuzzle[] = puzzleData.puzzles.map((p, i) => ({
  id: i + 1,
  groups: p.groups.map(g => ({ color: g.color as ConnGroup["color"], category: g.category, items: g.items })),
}));

// A puzzle is "good" only if every item is unique across all 4 groups.
// Otherwise duplicate tiles render twice and the answer key is ambiguous.
const GOOD_PUZZLES = PUZZLES.filter(p =>
  new Set(p.groups.flatMap(g => g.items)).size === 16
);

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const sessions = new Map<string, ConnectionsState>();

export function startGame(roomId: string, mode: PlayMode, members: Array<{ guestId: string; displayName: string }>): ConnectionsState {
  const sessionId = nanoid(12);
  const puzzle = shuffle(GOOD_PUZZLES)[0];
  const tiles = shuffle(puzzle.groups.flatMap(g => g.items));
  const players: Record<string, ConnPlayerState> = {};
  for (const m of members) players[m.guestId] = { found: [], attempts: 0, done: false };
  const state: ConnectionsState = {
    sessionId,
    puzzleIndex: 0,
    totalPuzzles: 1,
    phase: "question",
    tiles,
    puzzle,
    players,
    scores: members.map(m => ({ guestId: m.guestId, displayName: m.displayName, score: 0 })),
    mode,
    passOrder: members.map(m => m.guestId),
  };
  sessions.set(roomId, state);
  return state;
}

export function getState(roomId: string): ConnectionsState | null { return sessions.get(roomId) ?? null; }

// Returns { correct: boolean, color?: string } and mutates state
export function submitGroup(roomId: string, guestId: string, tiles: string[]): { correct: boolean; color?: string } | null {
  const state = sessions.get(roomId);
  if (!state || state.phase !== "question" || !state.puzzle) return null;
  const player = state.players[guestId];
  if (!player || player.done || player.attempts >= 4) return null;
  if (tiles.length !== 4) return null;

  const sorted = [...tiles].sort();
  for (const group of state.puzzle.groups) {
    if (player.found.includes(group.color)) continue;
    const gsorted = [...group.items].sort();
    if (sorted.every((t, i) => t === gsorted[i])) {
      player.found.push(group.color);
      const score = state.scores.find(s => s.guestId === guestId);
      if (score) score.score += COLOR_POINTS[group.color];
      if (player.found.length === 4) player.done = true;
      // Check if all players done
      const allDone = Object.values(state.players).every(p => p.done || p.attempts >= 4);
      if (allDone) state.phase = "reveal";
      return { correct: true, color: group.color };
    }
  }
  player.attempts++;
  if (player.attempts >= 4) player.done = true;
  const allDone = Object.values(state.players).every(p => p.done || p.attempts >= 4);
  if (allDone) state.phase = "reveal";
  return { correct: false };
}

export function forceReveal(roomId: string): ConnectionsState | null {
  const state = sessions.get(roomId);
  if (!state) return null;
  state.phase = "reveal";
  state.scores.sort((a, b) => b.score - a.score);
  return state;
}

export function endGame(roomId: string): ConnectionsState | null {
  const state = sessions.get(roomId);
  if (!state) return null;
  state.phase = "game_over";
  state.scores.sort((a, b) => b.score - a.score);
  return state;
}

export function cleanup(roomId: string): void { sessions.delete(roomId); }
