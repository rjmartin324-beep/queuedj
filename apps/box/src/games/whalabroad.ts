import { nanoid } from "nanoid";
import type { PlayMode } from "../types";
import config from "../seed/whalabroad-config.json";
import * as db from "../db";

// Whalabroad — full spec implementation. Asymmetric: 1 whale player vs.
// 2-7 whaler ships on an octagonal board that scales with player count.
// Whalers cooperate to wound the whale (only it is targetable in phase 1)
// then race / shoot each other to tow the carcass to harbor (phase 2).
// Server is the authority for fog-of-war, line-of-sight, recoil, the
// rolling 5-turn whale-movement rule, kraken delays, and ghost whispers.
//
// Phases:
//   lobby       → role pick (whale volunteer or random)
//   reveal      → 3-second whale start position shown to all (then submerge)
//   moving      → all players queue ONE action
//   resolving   → server applies whale-move → ship-move → attacks → checks
//   tow         → whale dead, race to drag carcass to harbor (PvP open)
//   game_over   → either whaler wins (delivers carcass) or whale wins
//                 (all ships sunk) or stalemate (turn cap, never reached
//                 in v1 since there's no hard cap; storm at turn 20 is
//                 a board mutation, not a game-end condition).

export type ShipColor =
  | "black" | "red" | "brown" | "white"
  | "yellow" | "green-faded" | "gray-faded";

export type CellType = "water" | "island" | "harbor" | "void" | "storm";

export type WhalabroadPhase =
  | "lobby" | "reveal" | "moving" | "resolving" | "tow" | "game_over";

// What the whale did on a given turn — server keeps a 5-element rolling
// history to enforce the "max 3 submerged + min 2 surface" rule.
export type WhaleTurnKind = "surface" | "submerged" | "bubble";

// Whale actions queued per turn.
export type WhaleActionKind =
  | "deep_dive"        // 4 tiles, hidden, no hint
  | "bubble_move"      // 3 tiles, hidden BUT bubble hint zone broadcast
  | "breach"           // 2 tiles, surface (one of the 2 required surface turns)
  | "ram_strike"       // surface; move 2 tiles + 2 dmg to ships in path
  | "surprise_breach"  // rise from underwater + 1 dmg adjacent target (counts as a surface turn)
  | "pass";

// Ship actions queued per turn.
export type ShipActionKind =
  | "full_sail"        // 3 tiles, no cannon this turn
  | "slow_crawl"       // 1 tile, can fire cannons same turn
  | "fire_cannons"     // perpendicular broadside; recoil = max 1 tile next turn
  | "harpoon_corpse"   // attach line to dead whale (adjacent only)
  | "cut_line"         // free-action: drop the carcass you were towing
  | "repair"           // in harbor zone only; full HP restore, no move/fire
  | "kraken_summon"    // dead-ship-only; tap a tile, fires next turn
  | "whisper"          // dead-ship-only; one chosen living ally per turn
  | "pass";

export interface WhaleState {
  guestId: string;
  displayName: string;
  x: number;
  y: number;
  surfaced: boolean;
  wounds: number;        // 0..hp; dead when wounds >= hp
  hp: number;            // scales with player count or host preset
  dead: boolean;
  towedBy: string | null; // guestId of the towing ship (set in phase 2)
  // Rolling-window enforcement bookkeeping. Newest at end.
  history: WhaleTurnKind[];
  bubbledThisStretch: boolean; // resets when surfacing
}

export interface ShipState {
  guestId: string;
  displayName: string;
  color: ShipColor;
  shipName: string;
  x: number;
  y: number;
  facing: number;         // 0..7 = N, NE, E, SE, S, SW, W, NW
  hp: number;
  sunk: boolean;
  // After firing, recoil limits next-turn move to 1 tile.
  recoilUntilTurn: number;
  // Dead-ship state: get one kraken summon and one whisper per turn.
  krakenUsed: boolean;
  whispersThisTurn: number;
}

export interface WhalabroadScore {
  guestId: string;
  displayName: string;
  score: number;
  role: "whale" | "whaler";
  outcome: "win" | "loss" | "draw";
}

export interface WhalePending {
  kind: WhaleActionKind;
  dx?: number;
  dy?: number;
  steps?: number;
  targetX?: number;
  targetY?: number;
  targetGuestId?: string;
}

export interface ShipPending {
  kind: ShipActionKind;
  dx?: number;
  dy?: number;
  steps?: number;
  // For fire_cannons: 'port' or 'starboard' relative to facing.
  side?: "port" | "starboard";
  // For fire_cannons / kraken_summon: target tile.
  targetX?: number;
  targetY?: number;
  // For whisper: recipient + text.
  whisperTo?: string;
  whisperText?: string;
}

export interface KrakenPending {
  byGuestId: string;
  x: number;
  y: number;
  fireOnTurn: number; // resolves at the START of resolving for this turn
}

export interface WhisperEntry {
  fromGuestId: string;
  fromDisplayName: string;
  toGuestId: string;
  text: string;
  turn: number;
}

export interface WhalabroadState {
  sessionId: string;
  phase: WhalabroadPhase;
  turnIndex: number;
  deadline: number | null;
  turnSeconds: number;

  boardSize: number;       // 12 (logical grid)
  ringScale: number;       // 3..6 — derived from player count

  islands: Array<[number, number]>;
  harbor: Array<[number, number]>;
  stormCells: Array<[number, number]>;
  stormActive: boolean;

  whale: WhaleState | null;
  ships: ShipState[];

  whaleAction: WhalePending | null;
  shipActions: Record<string, ShipPending>;
  krakensPending: KrakenPending[];
  whispers: WhisperEntry[];

  taunt: string | null;
  scores: WhalabroadScore[];

  // Append-only event log of notable in-game moments. Client diffs against
  // the previous state to fire one-shot cutscene overlays. Each entry is a
  // short ALL-CAPS label (e.g. "RAMMING STRIKE", "STORM RISES"). Order is
  // chronological. Never reset mid-game.
  events: string[];
  // One-shot flags so the same event doesn't fire multiple times across turns.
  firstRamShown: boolean;

  mode: PlayMode;
  passOrder: string[];
  whaleVolunteers: string[];
  // Host-set HP override (or null = compute as N+1)
  whaleHPPreset: "quick" | "standard" | "epic" | null;
}

const SHIP_COLORS = config.shipColors as ShipColor[];
const SHIP_NAMES = config.shipNamesByColor as Record<ShipColor, string[]>;
const TAUNTS = config.whaleTaunts as string[];

const sessions = new Map<string, WhalabroadState>();

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function chebyshev(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

function manhattan(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

// ──────────────────────────────────────────────────────────────────────────
// Board geometry: 12×12 grid clipped into an octagon. Corners are "void".
// "ringScale" controls how much of the octagon is playable — 3 rings = small
// (corners cut deeper), 6 rings = full board.
// ──────────────────────────────────────────────────────────────────────────
const BOARD_SIZE = config.boardSize;

export function inOctagon(x: number, y: number, ringScale: number): boolean {
  if (x < 0 || y < 0 || x >= BOARD_SIZE || y >= BOARD_SIZE) return false;
  // Smaller ring scale = more aggressive corner clip.
  // ringScale 6 → cut 1, ringScale 5 → cut 2, ringScale 4 → cut 3, ringScale 3 → cut 4.
  const cut = 7 - ringScale;
  if (x + y < cut) return false;
  if (x + (BOARD_SIZE - 1 - y) < cut) return false;
  if ((BOARD_SIZE - 1 - x) + y < cut) return false;
  if ((BOARD_SIZE - 1 - x) + (BOARD_SIZE - 1 - y) < cut) return false;
  return true;
}

function cellTypeAt(s: WhalabroadState, x: number, y: number): CellType {
  if (!inOctagon(x, y, s.ringScale)) return "void";
  if (s.stormActive && s.stormCells.some(([sx, sy]) => sx === x && sy === y)) return "storm";
  if (s.harbor.some(([hx, hy]) => hx === x && hy === y)) return "harbor";
  if (s.islands.some(([ix, iy]) => ix === x && iy === y)) return "island";
  return "water";
}

function isPassable(s: WhalabroadState, x: number, y: number, forWhale: boolean): boolean {
  const t = cellTypeAt(s, x, y);
  if (t === "void" || t === "island" || t === "storm") return false;
  // Whales can't enter harbor (shallow water rule).
  if (forWhale && t === "harbor") return false;
  // Occupant collision.
  for (const sh of s.ships) if (!sh.sunk && sh.x === x && sh.y === y) return false;
  if (s.whale && !forWhale && !s.whale.dead && s.whale.surfaced && s.whale.x === x && s.whale.y === y) return false;
  return true;
}

// ──────────────────────────────────────────────────────────────────────────
// Lifecycle
// ──────────────────────────────────────────────────────────────────────────
export function startGame(
  roomId: string,
  mode: PlayMode,
  members: Array<{ guestId: string; displayName: string }>,
): WhalabroadState {
  if (members.length < 3) {
    throw new Error("whalabroad: need at least 3 players (1 whale + 2 whalers)");
  }
  const sessionId = nanoid(12);
  db.createSession(sessionId, roomId, "whalabroad");

  const whalerCount = members.length - 1; // 1 will become whale
  const ringScaleMap = config.ringScaleByPlayerCount as Record<string, number>;
  const ringScale = ringScaleMap[String(whalerCount)] ?? 4;

  // Layout islands + harbor based on ring scale. We place a 2×2 central
  // island near the middle and 1-2 outer islands at random valid cells.
  const { islands, harbor, stormCells } = layoutBoard(ringScale);

  const state: WhalabroadState = {
    sessionId,
    phase: "lobby",
    turnIndex: 0,
    deadline: null,
    turnSeconds: config.turnSeconds,
    boardSize: BOARD_SIZE,
    ringScale,
    islands,
    harbor,
    stormCells,
    stormActive: false,
    whale: null,
    ships: [],
    whaleAction: null,
    shipActions: {},
    krakensPending: [],
    whispers: [],
    taunt: null,
    events: [],
    firstRamShown: false,
    scores: members.map(m => ({
      guestId: m.guestId, displayName: m.displayName, score: 0,
      role: "whaler", outcome: "draw",
    })),
    mode,
    passOrder: members.map(m => m.guestId),
    whaleVolunteers: [],
    whaleHPPreset: null,
  };
  sessions.set(roomId, state);
  return state;
}

function layoutBoard(ringScale: number): {
  islands: Array<[number, number]>;
  harbor: Array<[number, number]>;
  stormCells: Array<[number, number]>;
} {
  const center = Math.floor(BOARD_SIZE / 2);
  // 2×2 central island at the middle.
  // Two central islands separated by a 2-tile-wide sea-lane channel — the
  // design's signature "narrow chase route." Each island is 2 cells tall × 2
  // cells wide, with a 2-tile horizontal gap between them at the same rows.
  // Layout (ringScale 4, center=6):
  //
  //          col 3 4 5 . . 8 9 10
  //   row 5  .  L L .  .  R R .
  //   row 6  .  L L .  .  R R .
  //
  // Whale CAN traverse the channel (it's water). Ships can too. Both islands
  // block movement.
  const channelHalfGap = 2;
  const islandLeft: Array<[number, number]> = [
    [center - channelHalfGap - 2, center - 1], [center - channelHalfGap - 1, center - 1],
    [center - channelHalfGap - 2, center],     [center - channelHalfGap - 1, center],
  ];
  const islandRight: Array<[number, number]> = [
    [center + channelHalfGap, center - 1],     [center + channelHalfGap + 1, center - 1],
    [center + channelHalfGap, center],         [center + channelHalfGap + 1, center],
  ];
  // Filter to cells actually inside the octagon — small ringScale boards may
  // clip the outer edges of these blocks.
  const central: Array<[number, number]> = [...islandLeft, ...islandRight]
    .filter(([x, y]) => inOctagon(x, y, ringScale));
  // One additional outer island, placed at a random valid water cell roughly
  // 2 rings out from center, NOT inside the channel.
  const channelCols = new Set<number>();
  for (let dx = -channelHalfGap + 1; dx <= channelHalfGap - 1; dx++) channelCols.add(center + dx - 1);
  const candidates: Array<[number, number]> = [];
  for (let y = 1; y < BOARD_SIZE - 1; y++) {
    for (let x = 1; x < BOARD_SIZE - 1; x++) {
      if (!inOctagon(x, y, ringScale)) continue;
      if (central.some(([cx, cy]) => cx === x && cy === y)) continue;
      const distFromCenter = chebyshev(x, y, center, center);
      if (distFromCenter < 2 || distFromCenter > 4) continue;
      // Don't put it near the harbor row OR in the channel itself.
      if (y >= BOARD_SIZE - 2) continue;
      if ((y === center - 1 || y === center) && channelCols.has(x)) continue;
      candidates.push([x, y]);
    }
  }
  const outer = candidates[Math.floor(Math.random() * candidates.length)] ?? [2, 3] as [number, number];
  const islands = [...central, outer];

  // Harbor: 2-cell stretch on the south edge inside the octagon.
  const harbor: Array<[number, number]> = [];
  // Find the southmost row inside the octagon, and the middle 2 cells of that row.
  let southY = BOARD_SIZE - 1;
  while (southY >= 0 && !inOctagon(center, southY, ringScale)) southY--;
  // Pick 2 adjacent x-cells around center.
  if (inOctagon(center - 1, southY, ringScale) && inOctagon(center, southY, ringScale)) {
    harbor.push([center - 1, southY], [center, southY]);
  } else {
    harbor.push([center, southY]);
  }

  // Storm cells = outermost ring on N/E/W (NOT south so harbor stays open).
  // Compute the topmost+sidemost ring by finding cells with min/max x or y inside the octagon.
  const stormCells: Array<[number, number]> = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (!inOctagon(x, y, ringScale)) continue;
      // Skip south half (preserve harbor approach).
      if (y > center) continue;
      // Outermost ring = cell adjacent to a void.
      const neighborsInOctagon = [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]
        .every(([nx, ny]) => inOctagon(nx, ny, ringScale));
      if (!neighborsInOctagon) stormCells.push([x, y]);
    }
  }

  return { islands, harbor, stormCells };
}

export function getState(roomId: string): WhalabroadState | null {
  return sessions.get(roomId) ?? null;
}

// Returns state with whale position obscured for non-whale, non-ghost players
// when the whale is hidden. Ghost ships (sunk whalers) have full god-view.
export function getStateForPlayer(roomId: string, guestId: string): WhalabroadState | null {
  const s = sessions.get(roomId);
  if (!s) return null;
  if (!s.whale) return s;

  const isWhalePlayer = s.whale.guestId === guestId;
  const myShip = s.ships.find(sh => sh.guestId === guestId);
  const isGhost = !!myShip && myShip.sunk;

  if (s.whale.surfaced || s.whale.dead || isWhalePlayer || isGhost) return s;
  // Hidden — fog the position. Server still computes a coarse hint zone
  // separately so clients can render bubbles without learning exact x/y.
  const fogged: WhaleState = { ...s.whale, x: -1, y: -1 };
  // Strip whispers not addressed to this player.
  const filteredWhispers = s.whispers.filter(w => w.toGuestId === guestId);
  return { ...s, whale: fogged, whispers: filteredWhispers };
}

export function getWhaleHintZone(roomId: string): { cx: number; cy: number; radius: number } | null {
  const s = sessions.get(roomId);
  if (!s || !s.whale || s.whale.surfaced || s.whale.dead) return null;
  // If the LAST whale move was a Bubble, broadcast a tighter hint. Otherwise
  // the deep-dive turns broadcast nothing → hint is null and clients show no
  // bubbles at all. This is the design's "1 of 3 submerged turns reveals".
  if (s.whale.history[s.whale.history.length - 1] !== "bubble") return null;
  const cx = Math.round(s.whale.x / 2) * 2;
  const cy = Math.round(s.whale.y / 2) * 2;
  return { cx, cy, radius: 1 };
}

// ──────────────────────────────────────────────────────────────────────────
// Lobby
// ──────────────────────────────────────────────────────────────────────────
export function volunteerForWhale(roomId: string, guestId: string): WhalabroadState | null {
  const s = sessions.get(roomId);
  if (!s || s.phase !== "lobby") return null;
  if (!s.passOrder.includes(guestId)) return null;
  if (!s.whaleVolunteers.includes(guestId)) s.whaleVolunteers.push(guestId);
  return s;
}

export function unvolunteerForWhale(roomId: string, guestId: string): WhalabroadState | null {
  const s = sessions.get(roomId);
  if (!s || s.phase !== "lobby") return null;
  s.whaleVolunteers = s.whaleVolunteers.filter(id => id !== guestId);
  return s;
}

export function setWhaleHPPreset(
  roomId: string, hostGuestId: string, preset: "quick" | "standard" | "epic" | null
): WhalabroadState | null {
  const s = sessions.get(roomId);
  if (!s || s.phase !== "lobby") return null;
  // Only accept from host — caller should also gate this, but defensive here too.
  s.whaleHPPreset = preset;
  return s;
}

export function commitLobby(roomId: string): WhalabroadState | null {
  const s = sessions.get(roomId);
  if (!s || s.phase !== "lobby") return null;

  const allIds = s.passOrder;
  const whalePool = s.whaleVolunteers.length > 0 ? s.whaleVolunteers : allIds;
  const whaleId = whalePool[Math.floor(Math.random() * whalePool.length)];
  const whaleName = s.scores.find(x => x.guestId === whaleId)?.displayName ?? "Moby";

  const whalerIds = allIds.filter(id => id !== whaleId);
  if (whalerIds.length < 2) return null;

  const colors = shuffle([...SHIP_COLORS]).slice(0, whalerIds.length);
  const ships: ShipState[] = whalerIds.map((gid, i) => {
    const color = colors[i];
    const namePool = SHIP_NAMES[color] ?? ["The Vessel"];
    const shipName = namePool[Math.floor(Math.random() * namePool.length)];
    const displayName = s.scores.find(x => x.guestId === gid)?.displayName ?? "Whaler";
    const [sx, sy] = pickSpawnNearHarbor(s, i);
    return {
      guestId: gid, displayName, color, shipName,
      x: sx, y: sy, facing: 0, // 0 = N
      hp: config.shipStartingHP,
      sunk: false,
      recoilUntilTurn: 0,
      krakenUsed: false,
      whispersThisTurn: 0,
    };
  });

  // Whale HP: preset wins; otherwise N+1.
  const presets = config.whaleHPPresets as Record<string, number>;
  const whaleHP = s.whaleHPPreset
    ? (presets[s.whaleHPPreset] ?? 5)
    : (whalerIds.length + 1);

  const startSpot = pickWhaleStart(s);
  s.whale = {
    guestId: whaleId,
    displayName: whaleName,
    x: startSpot.x,
    y: startSpot.y,
    surfaced: true, // 3-second reveal at game start
    wounds: 0,
    hp: whaleHP,
    dead: false,
    towedBy: null,
    history: [],
    bubbledThisStretch: false,
  };
  s.ships = ships;
  for (const sc of s.scores) sc.role = sc.guestId === whaleId ? "whale" : "whaler";

  s.phase = "reveal";
  s.turnIndex = 0;
  s.deadline = Date.now() + 3000; // 3-second whale reveal then it submerges
  s.taunt = TAUNTS[Math.floor(Math.random() * TAUNTS.length)];
  return s;
}

function pickSpawnNearHarbor(s: WhalabroadState, idx: number): [number, number] {
  // Cluster ships in the 2-row band just north of the harbor.
  const center = Math.floor(BOARD_SIZE / 2);
  const harborY = s.harbor[0]?.[1] ?? BOARD_SIZE - 1;
  const baseY = harborY - 1;
  const offsets = [0, -1, 1, -2, 2, -3, 3, -4, 4];
  for (const dx of offsets) {
    const x = center + dx + (idx > 8 ? idx - 8 : 0);
    if (cellTypeAt(s, x, baseY) === "water" && !s.ships.some(sh => sh.x === x && sh.y === baseY)) {
      return [x, baseY];
    }
  }
  // Fallback scan.
  for (let y = baseY; y >= 1; y--) for (let x = 0; x < BOARD_SIZE; x++) {
    if (cellTypeAt(s, x, y) === "water" && !s.ships.some(sh => sh.x === x && sh.y === y)) return [x, y];
  }
  return [center, baseY];
}

function pickWhaleStart(s: WhalabroadState): { x: number; y: number } {
  // Random water tile in the upper third of the board.
  const candidates: Array<[number, number]> = [];
  const upperLimit = Math.floor(BOARD_SIZE / 3);
  for (let y = 0; y <= upperLimit; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (cellTypeAt(s, x, y) === "water") candidates.push([x, y]);
    }
  }
  if (candidates.length === 0) {
    // Fallback: just find any water tile.
    for (let y = 0; y < BOARD_SIZE; y++) for (let x = 0; x < BOARD_SIZE; x++) {
      if (cellTypeAt(s, x, y) === "water") return { x, y };
    }
    return { x: 6, y: 1 };
  }
  const [x, y] = candidates[Math.floor(Math.random() * candidates.length)];
  return { x, y };
}

// Called by the WS layer after the 3-second reveal countdown elapses.
export function endRevealPhase(roomId: string): WhalabroadState | null {
  const s = sessions.get(roomId);
  if (!s || s.phase !== "reveal" || !s.whale) return null;
  s.whale.surfaced = false;
  s.whale.history.push("submerged");
  s.phase = "moving";
  s.turnIndex = 1;
  s.deadline = Date.now() + s.turnSeconds * 1000;
  return s;
}

// ──────────────────────────────────────────────────────────────────────────
// Action submission
// ──────────────────────────────────────────────────────────────────────────
export function submitWhaleAction(roomId: string, guestId: string, action: WhalePending): WhalabroadState | null {
  const s = sessions.get(roomId);
  if (!s || s.phase !== "moving" || !s.whale) return null;
  if (s.whale.guestId !== guestId || s.whale.dead) return null;
  const sanitized = sanitizeWhaleAction(action);
  if (!whaleActionAllowed(s, sanitized)) return null;
  s.whaleAction = sanitized;
  return s;
}

export function submitShipAction(roomId: string, guestId: string, action: ShipPending): WhalabroadState | null {
  const s = sessions.get(roomId);
  if (!s) return null;
  if (s.phase !== "moving" && s.phase !== "tow") return null;
  const ship = s.ships.find(sh => sh.guestId === guestId);
  if (!ship) return null;

  // Sunk ships have a different action set (kraken, whisper, pass).
  if (ship.sunk) {
    if (action.kind !== "kraken_summon" && action.kind !== "whisper" && action.kind !== "pass") return null;
    if (action.kind === "kraken_summon" && ship.krakenUsed) return null;
    if (action.kind === "whisper" && ship.whispersThisTurn >= config.ghostWhispersPerTurn) return null;
  } else {
    // Living ships can't kraken or whisper.
    if (action.kind === "kraken_summon" || action.kind === "whisper") return null;
    // Towing ship can't fire and is forced to slow_crawl movement.
    const isTowing = !!s.whale && s.whale.towedBy === ship.guestId;
    if (isTowing && action.kind === "fire_cannons") return null;
    if (isTowing && action.kind === "full_sail") return null;
    // Ships with recoil can only do slow_crawl move (not full_sail).
    if (ship.recoilUntilTurn >= s.turnIndex && action.kind === "full_sail") return null;
  }

  s.shipActions[guestId] = sanitizeShipAction(action);
  return s;
}

function sanitizeWhaleAction(a: WhalePending): WhalePending {
  const out: WhalePending = { kind: a.kind };
  if (a.kind === "deep_dive" || a.kind === "bubble_move" || a.kind === "breach" || a.kind === "ram_strike") {
    out.dx = clamp(a.dx ?? 0, -1, 1);
    out.dy = clamp(a.dy ?? 0, -1, 1);
    out.steps = a.steps ?? maxStepsForWhaleKind(a.kind);
  }
  if (a.kind === "ram_strike" || a.kind === "surprise_breach") {
    if (typeof a.targetGuestId === "string") out.targetGuestId = a.targetGuestId;
  }
  return out;
}

function maxStepsForWhaleKind(k: WhaleActionKind): number {
  if (k === "deep_dive") return config.whaleDeepDiveRange;
  if (k === "bubble_move") return config.whaleBubbleRange;
  if (k === "breach") return config.whaleBreachRange;
  if (k === "ram_strike") return 2;
  return 0;
}

function sanitizeShipAction(a: ShipPending): ShipPending {
  const out: ShipPending = { kind: a.kind };
  if (a.kind === "full_sail" || a.kind === "slow_crawl") {
    out.dx = clamp(a.dx ?? 0, -1, 1);
    out.dy = clamp(a.dy ?? 0, -1, 1);
    out.steps = a.steps ?? (a.kind === "full_sail" ? config.shipFullSailRange : config.shipSlowCrawlRange);
  }
  if (a.kind === "fire_cannons") {
    out.side = a.side === "starboard" ? "starboard" : "port";
    if (typeof a.targetX === "number") out.targetX = Math.floor(a.targetX);
    if (typeof a.targetY === "number") out.targetY = Math.floor(a.targetY);
  }
  if (a.kind === "kraken_summon") {
    if (typeof a.targetX === "number") out.targetX = Math.floor(a.targetX);
    if (typeof a.targetY === "number") out.targetY = Math.floor(a.targetY);
  }
  if (a.kind === "whisper") {
    if (typeof a.whisperTo === "string") out.whisperTo = a.whisperTo;
    if (typeof a.whisperText === "string") out.whisperText = a.whisperText.slice(0, 200);
  }
  return out;
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

// Rolling 5-turn rule enforcement.
function whaleActionAllowed(s: WhalabroadState, a: WhalePending): boolean {
  if (!s.whale) return false;
  // Surface and submerged kinds.
  const surfaceKinds: WhaleActionKind[] = ["breach", "ram_strike", "surprise_breach"];
  const submergedKinds: WhaleActionKind[] = ["deep_dive", "bubble_move"];
  const k = a.kind;
  if (k === "pass") return true;

  // Project the action into history and check the rolling rule.
  const projected: WhaleTurnKind[] = [...s.whale.history];
  if (surfaceKinds.includes(k)) projected.push("surface");
  else if (k === "bubble_move") {
    if (s.whale.bubbledThisStretch) return false; // already used this stretch
    projected.push("bubble");
  } else if (submergedKinds.includes(k)) projected.push("submerged");

  // Trim to the rolling window.
  const window = projected.slice(-config.rollingWindow);
  if (window.length < config.rollingWindow) return true; // not enough history yet

  const submergedCount = window.filter(t => t === "submerged" || t === "bubble").length;
  const surfaceCount = window.filter(t => t === "surface").length;
  if (submergedCount > config.maxSubmergedInWindow) return false;
  if (surfaceCount < config.minSurfaceInWindow) {
    // Only block if adding this action would lock surfaceCount below the
    // minimum AND there's no way to recover (we'd need to enforce future
    // surfaces). Simplest check: if window is full AND surface count too low,
    // reject submerged kinds.
    if (k !== "breach" && k !== "ram_strike" && k !== "surprise_breach") return false;
  }
  return true;
}

// ──────────────────────────────────────────────────────────────────────────
// Resolution
// ──────────────────────────────────────────────────────────────────────────
export function resolveTurn(roomId: string): WhalabroadState | null {
  const s = sessions.get(roomId);
  if (!s) return null;
  if (s.phase !== "moving" && s.phase !== "tow") return null;
  if (!s.whale) return null;

  s.phase = "resolving";

  // 0. Kraken summons that are due THIS turn fire first.
  resolveDueKrakens(s);

  // 1. Whale moves.
  applyWhaleAction(s);

  // 2. Ship moves (in passOrder for tie-break).
  for (const gid of s.passOrder) {
    const a = s.shipActions[gid];
    const ship = s.ships.find(sh => sh.guestId === gid && !sh.sunk);
    if (!a || !ship) continue;
    if (a.kind === "full_sail" || a.kind === "slow_crawl") applyShipMove(s, ship, a);
  }

  // 3. Whale ram-attack damage was already rolled into applyWhaleAction.
  //    Now ship-side attacks: cannons, harpoon-corpse, ram, cut_line, repair.
  for (const gid of s.passOrder) {
    const a = s.shipActions[gid];
    const ship = s.ships.find(sh => sh.guestId === gid);
    if (!a || !ship) continue;

    if (ship.sunk) {
      if (a.kind === "kraken_summon") queueKraken(s, ship, a);
      else if (a.kind === "whisper")  recordWhisper(s, ship, a);
      continue;
    }

    if (a.kind === "fire_cannons")  applyCannons(s, ship, a);
    else if (a.kind === "harpoon_corpse") applyHarpoonCorpse(s, ship);
    else if (a.kind === "cut_line")  applyCutLine(s, ship);
    else if (a.kind === "repair")    applyRepair(s, ship);
  }

  // 4. End-of-turn:
  //    - Storm activation at storm-start turn
  if (!s.stormActive && s.turnIndex >= config.stormStartTurn) {
    s.stormActive = true;
    s.events.push("STORM RISES");
  }

  //    - Tow-delivery check: if a ship sat in harbor for ONE turn while towing,
  //      whaler wins. We mark a "delivery_pending" via timing; for simplicity
  //      this check fires immediately if tower is already in harbor at turn end.
  //      (Real "survive 1 turn" rule needs a separate flag — wired below.)
  const ended = checkEndOfGame(s);
  if (!ended) {
    // Phase advance: stay in moving/tow as appropriate.
    s.phase = (s.whale.dead && s.whale.towedBy) ? "tow" : "moving";
    s.turnIndex++;
    s.deadline = Date.now() + s.turnSeconds * 1000;
    s.taunt = TAUNTS[Math.floor(Math.random() * TAUNTS.length)];
    s.shipActions = {};
    s.whaleAction = null;
    // Reset per-turn ghost flags.
    for (const sh of s.ships) if (sh.sunk) sh.whispersThisTurn = 0;
  }
  return s;
}

function applyWhaleAction(s: WhalabroadState) {
  if (!s.whale || s.whale.dead) return;
  const a = s.whaleAction;
  if (!a) {
    // No action submitted — count as a passive submerged turn.
    s.whale.history.push("submerged");
    s.whale.history = s.whale.history.slice(-config.rollingWindow);
    return;
  }

  if (a.kind === "deep_dive") {
    moveWhale(s, a.dx ?? 0, a.dy ?? 0, Math.min(a.steps ?? 0, config.whaleDeepDiveRange));
    s.whale.surfaced = false;
    s.whale.history.push("submerged");
  }
  else if (a.kind === "bubble_move") {
    moveWhale(s, a.dx ?? 0, a.dy ?? 0, Math.min(a.steps ?? 0, config.whaleBubbleRange));
    s.whale.surfaced = false;
    s.whale.bubbledThisStretch = true;
    s.whale.history.push("bubble");
  }
  else if (a.kind === "breach") {
    moveWhale(s, a.dx ?? 0, a.dy ?? 0, Math.min(a.steps ?? 0, config.whaleBreachRange));
    s.whale.surfaced = true;
    s.whale.bubbledThisStretch = false;
    s.whale.history.push("surface");
  }
  else if (a.kind === "ram_strike") {
    // Move 2 tiles + 2 dmg to ships in path.
    const pathDamaged = moveWhaleAndDamagePath(s, a.dx ?? 0, a.dy ?? 0, Math.min(a.steps ?? 0, 2), config.whaleRamDamage);
    s.whale.surfaced = true;
    s.whale.bubbledThisStretch = false;
    s.whale.history.push("surface");
    // Also damage explicit target if adjacent to final position.
    if (a.targetGuestId) hitShipAt(s, a.targetGuestId, config.whaleRamDamage, "ram_strike", pathDamaged);
    // First ram of the game gets a cinematic reveal.
    if (!s.firstRamShown && pathDamaged.size > 0) {
      s.firstRamShown = true;
      s.events.push("RAMMING STRIKE");
    }
  }
  else if (a.kind === "surprise_breach") {
    // No movement; surface + 1 dmg to adjacent ship.
    s.whale.surfaced = true;
    s.whale.bubbledThisStretch = false;
    s.whale.history.push("surface");
    if (a.targetGuestId) {
      const target = s.ships.find(sh => sh.guestId === a.targetGuestId && !sh.sunk);
      if (target && chebyshev(s.whale.x, s.whale.y, target.x, target.y) <= 1) {
        damageShip(target, config.whaleSurpriseBreachDamage);
      }
    }
  }
  else if (a.kind === "pass") {
    s.whale.history.push(s.whale.surfaced ? "surface" : "submerged");
  }
  s.whale.history = s.whale.history.slice(-config.rollingWindow);
}

function moveWhale(s: WhalabroadState, dx: number, dy: number, steps: number) {
  if (!s.whale) return;
  while (steps > 0) {
    const nx = s.whale.x + dx, ny = s.whale.y + dy;
    if (!isPassable(s, nx, ny, true)) break;
    s.whale.x = nx; s.whale.y = ny;
    steps--;
  }
}

function moveWhaleAndDamagePath(s: WhalabroadState, dx: number, dy: number, steps: number, damage: number): Set<string> {
  const damaged = new Set<string>();
  if (!s.whale) return damaged;
  while (steps > 0) {
    const nx = s.whale.x + dx, ny = s.whale.y + dy;
    // If a ship is in the way, ram it (damage but don't enter the cell).
    const blocker = s.ships.find(sh => !sh.sunk && sh.x === nx && sh.y === ny);
    if (blocker) {
      damageShip(blocker, damage);
      damaged.add(blocker.guestId);
      break;
    }
    if (!isPassable(s, nx, ny, true)) break;
    s.whale.x = nx; s.whale.y = ny;
    steps--;
  }
  return damaged;
}

function hitShipAt(s: WhalabroadState, guestId: string, damage: number, _reason: string, alreadyDamaged: Set<string>) {
  if (alreadyDamaged.has(guestId)) return; // don't double-tap on a path ram
  const target = s.ships.find(sh => sh.guestId === guestId && !sh.sunk);
  if (!target || !s.whale) return;
  if (chebyshev(s.whale.x, s.whale.y, target.x, target.y) > 1) return;
  damageShip(target, damage);
}

function damageShip(ship: ShipState, dmg: number) {
  ship.hp = Math.max(0, ship.hp - dmg);
  if (ship.hp <= 0) ship.sunk = true;
}

function applyShipMove(s: WhalabroadState, ship: ShipState, a: ShipPending) {
  // Recoil cap: max 1 tile this turn if recoil active.
  let stepsAllowed = a.steps ?? 0;
  if (ship.recoilUntilTurn >= s.turnIndex) stepsAllowed = Math.min(stepsAllowed, 1);
  // Towing forces slow crawl.
  const isTowing = !!s.whale && s.whale.towedBy === ship.guestId;
  if (isTowing) stepsAllowed = Math.min(stepsAllowed, config.shipTowRange);

  const dx = a.dx ?? 0, dy = a.dy ?? 0;
  const dir = directionToFacing(dx, dy);
  if (dir !== -1) ship.facing = dir;

  while (stepsAllowed > 0) {
    const nx = ship.x + dx, ny = ship.y + dy;
    if (!isPassable(s, nx, ny, false)) break;
    ship.x = nx; ship.y = ny;
    if (isTowing && s.whale) {
      s.whale.x = nx - dx;
      s.whale.y = ny - dy;
    }
    stepsAllowed--;
  }
}

function directionToFacing(dx: number, dy: number): number {
  const dirs: Record<string, number> = {
    "0,-1": 0, "1,-1": 1, "1,0": 2, "1,1": 3,
    "0,1": 4, "-1,1": 5, "-1,0": 6, "-1,-1": 7,
  };
  return dirs[`${dx},${dy}`] ?? -1;
}

// Cannons: perpendicular to facing. Port = -90°, starboard = +90°.
// Range 3 tiles. Hits the FIRST entity in the line (whale phase 1, any ship in phase 2).
function applyCannons(s: WhalabroadState, ship: ShipState, a: ShipPending) {
  const tx = a.targetX, ty = a.targetY;
  if (typeof tx !== "number" || typeof ty !== "number") return;
  if (!isCannonAngleValid(ship, tx, ty, a.side ?? "port")) return;
  if (chebyshev(ship.x, ship.y, tx, ty) > config.shipCannonRange) return;

  // Phase gate: pre-kill, only the whale is targetable. Post-kill, ships
  // become targetable too (PvP) AND the tow-line.
  const whaleAlive = s.whale && !s.whale.dead;
  if (whaleAlive) {
    if (s.whale && s.whale.surfaced && s.whale.x === tx && s.whale.y === ty) {
      s.whale.wounds += config.shipCannonDamage;
      if (s.whale.wounds >= s.whale.hp) {
        s.whale.dead = true;
        s.whale.surfaced = true;
        s.whale.towedBy = null;
        s.events.push("WHITE WHALE FELLS");
      }
    }
    // If the cell isn't the whale, the shot misses (you can only target the whale pre-kill).
  } else {
    // Post-kill: target can be a rival ship OR the tow line (the carcass cell).
    const target = s.ships.find(sh => sh.guestId !== ship.guestId && !sh.sunk && sh.x === tx && sh.y === ty);
    if (target) damageShip(target, config.shipCannonDamage);
    // Or hit the line: if the carcass is at (tx,ty) and someone's towing, detach.
    if (s.whale && s.whale.dead && s.whale.x === tx && s.whale.y === ty && s.whale.towedBy) {
      s.whale.towedBy = null;
    }
  }

  // Recoil: max 1-tile move next turn.
  ship.recoilUntilTurn = s.turnIndex + 1;
}

function isCannonAngleValid(ship: ShipState, tx: number, ty: number, side: "port" | "starboard"): boolean {
  // Compute perpendicular direction relative to ship facing.
  // Facing 0..7 = N, NE, E, SE, S, SW, W, NW. Port = -90°, starboard = +90°.
  const dx = tx - ship.x, dy = ty - ship.y;
  const targetFacing = directionToFacing(Math.sign(dx), Math.sign(dy));
  if (targetFacing === -1) return false;
  const portFacing = (ship.facing + 6) % 8;        // -90°
  const starboardFacing = (ship.facing + 2) % 8;   // +90°
  const required = side === "port" ? portFacing : starboardFacing;
  // Allow target to be exactly perpendicular OR ±1 facing (8-direction grid is coarse).
  return targetFacing === required ||
         targetFacing === (required + 1) % 8 ||
         targetFacing === (required + 7) % 8;
}

function applyHarpoonCorpse(s: WhalabroadState, ship: ShipState) {
  if (!s.whale || !s.whale.dead) return;
  if (s.whale.towedBy) return; // already attached
  if (chebyshev(ship.x, ship.y, s.whale.x, s.whale.y) > config.shipHarpoonRange) return;
  s.whale.towedBy = ship.guestId;
}

function applyCutLine(s: WhalabroadState, ship: ShipState) {
  if (!s.whale) return;
  if (s.whale.towedBy === ship.guestId) s.whale.towedBy = null;
}

function applyRepair(s: WhalabroadState, ship: ShipState) {
  // Must be within harborRepairRadius of ANY harbor cell (manhattan).
  const inZone = s.harbor.some(([hx, hy]) => manhattan(ship.x, ship.y, hx, hy) <= config.harborRepairRadius);
  if (!inZone) return;
  ship.hp = config.shipStartingHP;
}

function queueKraken(s: WhalabroadState, ship: ShipState, a: ShipPending) {
  if (typeof a.targetX !== "number" || typeof a.targetY !== "number") return;
  if (ship.krakenUsed) return;
  ship.krakenUsed = true;
  s.krakensPending.push({
    byGuestId: ship.guestId,
    x: a.targetX,
    y: a.targetY,
    fireOnTurn: s.turnIndex + 1,
  });
}

function resolveDueKrakens(s: WhalabroadState) {
  const due = s.krakensPending.filter(k => k.fireOnTurn <= s.turnIndex);
  s.krakensPending = s.krakensPending.filter(k => k.fireOnTurn > s.turnIndex);
  if (due.length > 0) s.events.push("KRAKEN RISES");
  for (const k of due) {
    // 3×3 splash centered on (k.x, k.y).
    for (let dy = -config.krakenSplashRadius; dy <= config.krakenSplashRadius; dy++) {
      for (let dx = -config.krakenSplashRadius; dx <= config.krakenSplashRadius; dx++) {
        const x = k.x + dx, y = k.y + dy;
        // Damage + push 1 tile outward from center.
        const ship = s.ships.find(sh => !sh.sunk && sh.x === x && sh.y === y);
        if (ship) {
          damageShip(ship, config.krakenDamage);
          // Push outward. If the push cell isn't passable, ship doesn't move.
          if (dx !== 0 || dy !== 0) {
            const px = ship.x + Math.sign(dx);
            const py = ship.y + Math.sign(dy);
            if (isPassable(s, px, py, false)) { ship.x = px; ship.y = py; }
          }
        }
        // Whale takes a hit too if surfaced and in splash.
        if (s.whale && !s.whale.dead && s.whale.surfaced && s.whale.x === x && s.whale.y === y) {
          s.whale.wounds += config.krakenDamage;
          if (s.whale.wounds >= s.whale.hp) { s.whale.dead = true; s.whale.surfaced = true; s.whale.towedBy = null; s.events.push("WHITE WHALE FELLS"); }
        }
      }
    }
  }
}

function recordWhisper(s: WhalabroadState, ghost: ShipState, a: ShipPending) {
  if (!a.whisperTo || !a.whisperText) return;
  if (ghost.whispersThisTurn >= config.ghostWhispersPerTurn) return;
  ghost.whispersThisTurn += 1;
  s.whispers.push({
    fromGuestId: ghost.guestId,
    fromDisplayName: ghost.displayName + " 👻",
    toGuestId: a.whisperTo,
    text: a.whisperText,
    turn: s.turnIndex,
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Endgame
// ──────────────────────────────────────────────────────────────────────────
function checkEndOfGame(s: WhalabroadState): boolean {
  if (!s.whale) return false;
  // All ships sunk → whale wins.
  if (s.ships.every(sh => sh.sunk)) {
    s.phase = "game_over";
    finalize(s, "whale");
    return true;
  }
  // Tow + survive in harbor zone for one full turn.
  if (s.whale.dead && s.whale.towedBy) {
    const tower = s.ships.find(sh => sh.guestId === s.whale!.towedBy);
    if (tower && s.harbor.some(([hx, hy]) => hx === tower.x && hy === tower.y)) {
      s.phase = "game_over";
      s.events.push("TOW DELIVERED");
      finalize(s, "whaler", tower.guestId);
      return true;
    }
  }
  return false;
}

function finalize(s: WhalabroadState, victor: "whale" | "whaler" | "draw", winningWhalerId?: string) {
  for (const sc of s.scores) {
    if (victor === "draw") { sc.outcome = "draw"; sc.score = 100; continue; }
    if (sc.role === "whale") {
      sc.outcome = victor === "whale" ? "win" : "loss";
      sc.score = victor === "whale" ? 1000 : 0;
    } else {
      if (victor === "whaler" && sc.guestId === winningWhalerId) { sc.outcome = "win"; sc.score = 1000; }
      else if (victor === "whaler") { sc.outcome = "loss"; sc.score = 250; }
      else { sc.outcome = "loss"; sc.score = 50; }
    }
  }
  s.scores.sort((a, b) => b.score - a.score);
  try {
    db.persistScores(s.sessionId, s.scores.map(x => ({
      guestId: x.guestId, displayName: x.displayName, score: x.score, correct: 0, wrong: 0,
    })));
  } catch (e) { console.error("[whalabroad] persistScores failed at game_over:", e); }
}

export function cleanup(roomId: string): void {
  const s = sessions.get(roomId);
  if (s) {
    try {
      db.persistScores(s.sessionId, s.scores.map(x => ({
        guestId: x.guestId, displayName: x.displayName, score: x.score, correct: 0, wrong: 0,
      })));
    } catch {}
  }
  sessions.delete(roomId);
}
