import { nanoid } from "nanoid";
import type { PlayMode } from "../types";
import manifest from "../seed/geo-manifest.json";
import * as db from "../db";

interface GeoEntry {
  id: number;
  file: string;
  location: string;
  country: string;
  lat: number;
  lng: number;
  difficulty: "easy" | "medium" | "hard";
  region: string;
}

// Photo-mode question — what the client renders
export interface GeoQuestion {
  id: number;
  photoUrl: string;       // /geo-photos/geo_NNN.jpg, served by the box-client
  location: string;       // shown only on reveal
  country: string;
  lat: number;
  lng: number;
  difficulty: GeoEntry["difficulty"];
  region: string;
}

export interface GeoScore {
  guestId: string;
  displayName: string;
  score: number;
  totalDistanceKm: number;   // sum across rounds — lower is better
  bestRound: { distanceKm: number; questionId: number } | null;
}

// Each player's pin for the current question
export interface GeoPin { lat: number; lng: number; }

export type GeoPhase = "countdown" | "question" | "reveal" | "game_over";

export interface GeoGuesserState {
  sessionId: string;
  questionIndex: number;
  totalQuestions: number;
  phase: GeoPhase;
  question: GeoQuestion | null;
  deadline: number | null;
  timeLimit: number;
  pins: Record<string, GeoPin>;          // guestId → where they pinned
  distances: Record<string, number>;     // guestId → km from correct (set on reveal)
  scores: GeoScore[];
  mode: PlayMode;
  passOrder: string[];
  passIndex: number;
}

const TIME_LIMIT = 30;     // seconds per photo
const TOTAL = 8;           // photos per game

// Haversine distance between two lat/lng points (km)
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const aLatRad = (a.lat * Math.PI) / 180;
  const bLatRad = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(aLatRad) * Math.cos(bLatRad);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

// Score curve: 0 km = 5000 pts, 20,000 km = 0 pts. Quadratic falloff so close pins are rewarded.
export function scoreFromDistance(km: number): number {
  const pct = Math.max(0, 1 - km / 20000);
  return Math.round(5000 * pct * pct);
}

const sessions = new Map<string, GeoGuesserState>();
const banks = new Map<string, GeoQuestion[]>();

const ENTRIES: GeoEntry[] = (manifest as GeoEntry[]);

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function entryToQuestion(e: GeoEntry): GeoQuestion {
  return {
    id: e.id,
    photoUrl: `/geo-photos/${e.file}`,
    location: e.location,
    country: e.country,
    lat: e.lat,
    lng: e.lng,
    difficulty: e.difficulty,
    region: e.region,
  };
}

export function startGame(roomId: string, mode: PlayMode, members: Array<{ guestId: string; displayName: string }>): GeoGuesserState {
  const sessionId = nanoid(12);
  db.createSession(sessionId, roomId, "geoguesser");
  // Mix difficulties: bias toward easy/medium early, harder later.
  const easy   = ENTRIES.filter(e => e.difficulty === "easy");
  const medium = ENTRIES.filter(e => e.difficulty === "medium");
  const hard   = ENTRIES.filter(e => e.difficulty === "hard");
  const picks: GeoEntry[] = [];
  // Front-load 3 easy, 3 medium, 2 hard, then shuffle a bit so it's not predictable
  picks.push(...shuffle(easy).slice(0, 3));
  picks.push(...shuffle(medium).slice(0, 3));
  picks.push(...shuffle(hard).slice(0, 2));
  // If any tier is short, top up from the others
  while (picks.length < TOTAL) {
    const remaining = ENTRIES.filter(e => !picks.includes(e));
    if (remaining.length === 0) break;
    picks.push(remaining[Math.floor(Math.random() * remaining.length)]);
  }

  const bank = picks.slice(0, TOTAL).map(entryToQuestion);
  banks.set(roomId, bank);

  const state: GeoGuesserState = {
    sessionId,
    questionIndex: 0,
    totalQuestions: bank.length,
    phase: "countdown",
    question: null,
    deadline: null,
    timeLimit: TIME_LIMIT,
    pins: {},
    distances: {},
    scores: members.map(m => ({
      guestId: m.guestId,
      displayName: m.displayName,
      score: 0,
      totalDistanceKm: 0,
      bestRound: null,
    })),
    mode,
    passOrder: members.map(m => m.guestId),
    passIndex: 0,
  };
  sessions.set(roomId, state);
  return state;
}

export function getState(roomId: string): GeoGuesserState | null {
  return sessions.get(roomId) ?? null;
}

export function showQuestion(roomId: string): GeoGuesserState | null {
  const state = sessions.get(roomId);
  if (!state) return null;
  const q = banks.get(roomId)?.[state.questionIndex];
  if (!q) return null;
  state.phase = "question";
  // Strip lat/lng/location/country from the broadcast version so phones can't cheat
  state.question = {
    ...q,
    lat: 0, lng: 0,
    location: "",
    country: "",
  };
  state.deadline = Date.now() + TIME_LIMIT * 1000;
  state.pins = {};
  state.distances = {};
  if (state.mode === "pass_tablet") state.passIndex = 0;
  return state;
}

export function submitPin(roomId: string, guestId: string, lat: number, lng: number): GeoGuesserState | null {
  const state = sessions.get(roomId);
  if (!state || state.phase !== "question" || state.pins[guestId]) return null;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  state.pins[guestId] = { lat, lng };
  return state;
}

// Back-compat shim: old client may still send "geo:answer" with a string country choice.
// We tolerate it (no-op so nothing crashes) but the new flow uses pins.
export function submitAnswer(_roomId: string, _guestId: string, _answer: string): GeoGuesserState | null {
  return null;
}

export function revealAnswers(roomId: string): GeoGuesserState | null {
  const state = sessions.get(roomId);
  if (!state) return null;
  // Use the FULL question (with real lat/lng) from the bank, not the masked broadcast version
  const fullQ = banks.get(roomId)?.[state.questionIndex];
  if (!fullQ) return null;

  state.phase = "reveal";
  state.question = fullQ; // unmask for reveal

  for (const s of state.scores) {
    const pin = state.pins[s.guestId];
    if (!pin) {
      // No pin = max distance penalty (treat as 20,000 km)
      state.distances[s.guestId] = 20000;
      continue;
    }
    const km = haversineKm(pin, { lat: fullQ.lat, lng: fullQ.lng });
    state.distances[s.guestId] = km;
    const pts = scoreFromDistance(km);
    s.score += pts;
    s.totalDistanceKm += km;
    if (!s.bestRound || km < s.bestRound.distanceKm) {
      s.bestRound = { distanceKm: km, questionId: fullQ.id };
    }
  }

  state.scores.sort((a, b) => b.score - a.score);
  return state;
}

export function advance(roomId: string): { state: GeoGuesserState; done: boolean } | null {
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
  state.pins = {};
  state.distances = {};
  return { state, done: false };
}

export function cleanup(roomId: string): void {
  sessions.delete(roomId);
  banks.delete(roomId);
}
