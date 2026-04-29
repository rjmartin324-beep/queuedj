import { nanoid } from "nanoid";
import type { PlayMode } from "../types";
import scenarioData from "../seed/thedraft-scenarios.json";

interface DraftItem { id: string; name: string; emoji: string; value: number; }
interface DraftScenario { id: number; title: string; subtitle: string; items: DraftItem[]; }

export interface DraftScore { guestId: string; displayName: string; score: number; picks: DraftItem[]; }
export type DraftPhase = "drafting" | "reveal" | "game_over";

export interface DraftState {
  sessionId: string;
  phase: DraftPhase;
  scenario: DraftScenario;
  availableItems: DraftItem[];
  picks: Record<string, string[]>; // guestId → itemIds (in order picked)
  draftOrder: string[]; // snake draft order (guestIds)
  currentPick: number; // index into draftOrder
  totalPicks: number;
  scores: DraftScore[];
  mode: PlayMode;
  passOrder: string[];
}

const SCENARIOS: DraftScenario[] = scenarioData.scenarios.map((s, i) => ({
  id: i + 1,
  title: s.title,
  subtitle: s.subtitle,
  items: s.items,
}));

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Snake draft: 1,2,3,4, 4,3,2,1, 1,2... for 2 picks each
function buildDraftOrder(guestIds: string[], picksEach: number): string[] {
  const order: string[] = [];
  for (let round = 0; round < picksEach; round++) {
    const arr = round % 2 === 0 ? [...guestIds] : [...guestIds].reverse();
    order.push(...arr);
  }
  return order;
}

const sessions = new Map<string, DraftState>();

export function startGame(roomId: string, mode: PlayMode, members: Array<{ guestId: string; displayName: string }>): DraftState {
  const sessionId = nanoid(12);
  const scenario = shuffle(SCENARIOS)[0];
  const picksEach = 2;
  const guestIds = members.map(m => m.guestId);
  const draftOrder = buildDraftOrder(guestIds, picksEach);
  const picks: Record<string, string[]> = {};
  for (const id of guestIds) picks[id] = [];

  const state: DraftState = {
    sessionId,
    phase: "drafting",
    scenario: { ...scenario, items: shuffle(scenario.items) },
    availableItems: shuffle(scenario.items),
    picks,
    draftOrder,
    currentPick: 0,
    totalPicks: draftOrder.length,
    scores: members.map(m => ({ guestId: m.guestId, displayName: m.displayName, score: 0, picks: [] })),
    mode,
    passOrder: members.map(m => m.guestId),
  };
  sessions.set(roomId, state);
  return state;
}

export function getState(roomId: string): DraftState | null { return sessions.get(roomId) ?? null; }

export function pickItem(roomId: string, guestId: string, itemId: string): DraftState | null {
  const state = sessions.get(roomId);
  if (!state || state.phase !== "drafting") return null;
  if (state.draftOrder[state.currentPick] !== guestId) return null;
  const itemIdx = state.availableItems.findIndex(i => i.id === itemId);
  if (itemIdx === -1) return null;
  const item = state.availableItems.splice(itemIdx, 1)[0];
  state.picks[guestId].push(itemId);
  const score = state.scores.find(s => s.guestId === guestId);
  if (score) score.picks.push(item);
  state.currentPick++;
  if (state.currentPick >= state.totalPicks) return revealDraft(roomId);
  return state;
}

// Wildcard pick — player types their own. Hidden value is fixed at 50 (neutral).
// The fun is in the reveal: "you picked 'my cousin Steve' — it scored 50, just middle of the pack."
export function pickCustom(roomId: string, guestId: string, rawName: string): DraftState | null {
  const state = sessions.get(roomId);
  if (!state || state.phase !== "drafting") return null;
  if (state.draftOrder[state.currentPick] !== guestId) return null;
  const name = String(rawName ?? "").trim().slice(0, 40);
  if (name.length === 0) return null;
  const item: DraftItem = { id: `custom-${nanoid(6)}`, name, emoji: "", value: 50 };
  state.picks[guestId].push(item.id);
  const score = state.scores.find(s => s.guestId === guestId);
  if (score) score.picks.push(item);
  state.currentPick++;
  if (state.currentPick >= state.totalPicks) return revealDraft(roomId);
  return state;
}

function revealDraft(roomId: string): DraftState {
  const state = sessions.get(roomId)!;
  state.phase = "reveal";
  for (const s of state.scores) {
    s.score = s.picks.reduce((sum, item) => sum + item.value, 0);
  }
  state.scores.sort((a, b) => b.score - a.score);
  return state;
}

export function endGame(roomId: string): DraftState | null {
  const state = sessions.get(roomId);
  if (!state) return null;
  state.phase = "game_over";
  return state;
}

// Skip the current picker — used when the picker disconnects or the host force-skips.
// Advances `currentPick` past anyone who's no longer present in `activeGuestIds`.
export function skipMissingPickers(roomId: string, activeGuestIds: string[]): DraftState | null {
  const state = sessions.get(roomId);
  if (!state || state.phase !== "drafting") return null;
  const active = new Set(activeGuestIds);
  let advanced = false;
  while (state.currentPick < state.totalPicks && !active.has(state.draftOrder[state.currentPick])) {
    state.currentPick++;
    advanced = true;
  }
  if (advanced && state.currentPick >= state.totalPicks) {
    return revealDraft(roomId);
  }
  return advanced ? state : null;
}

export function cleanup(roomId: string): void { sessions.delete(roomId); }
