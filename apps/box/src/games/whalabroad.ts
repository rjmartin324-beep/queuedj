import { nanoid } from "nanoid";
import type { PlayMode } from "../types";
import config from "../seed/whalabroad-config.json";
import * as db from "../db";

// Whalabroad is asymmetric: 1 whale player vs. 2-7 whaler ships.
// Whalers must cooperate to wound the whale, but only one wins by
// towing the carcass to harbor. Whale wins by sinking every ship.
//
// Server is the authority for everything: positions, HP, fog-of-war
// for the hidden whale, harpoon line-of-sight, tow ownership.
// Clients render an octagonal board and submit one action per turn.

export type ShipColor =
  | "black" | "red" | "brown" | "white"
  | "yellow" | "green-faded" | "gray-faded";

export type CellType = "water" | "island" | "harbor" | "void";

export interface Cell { type: CellType; }

export type WhalabroadPhase =
  | "lobby"      // role pick: who is the whale, who are the whalers
  | "moving"    // all players submit one action (or pass) per turn
  | "resolving" // server applies actions, broadcasts result
  | "tow"       // whale is dead, race to tow body to harbor
  | "game_over";

export interface WhaleState {
  guestId: string;
  displayName: string;
  x: number;
  y: number;
  surfaced: boolean;     // false = hidden underwater (position fogged)
  wounds: number;        // 0..whaleStartingHP; dead when wounds >= HP
  dead: boolean;
  towedBy: string | null; // guestId of the ship currently towing (after death)
}

export interface ShipState {
  guestId: string;
  displayName: string;
  color: ShipColor;
  shipName: string;
  x: number;
  y: number;
  facing: number;         // 0..7 = N, NE, E, SE, S, SW, W, NW
  hp: number;             // 0..shipStartingHP; sunk when hp <= 0
  sunk: boolean;
}

export interface WhalabroadScore {
  guestId: string;
  displayName: string;
  score: number;
  role: "whale" | "whaler";
  outcome: "win" | "loss" | "draw";
}

// Submitted action for the current turn (one per player).
export type WhaleActionKind = "move" | "surface" | "dive" | "ram" | "pass";
export type ShipActionKind  = "move" | "harpoon" | "ram" | "tow" | "release" | "pass";

export interface WhalePending {
  kind: WhaleActionKind;
  // For "move": dx/dy is one step in any of 8 directions, repeated up to whaleMoveRange.
  dx?: number;
  dy?: number;
  steps?: number;
  // For "ram": targetGuestId
  targetGuestId?: string;
}

export interface ShipPending {
  kind: ShipActionKind;
  dx?: number;
  dy?: number;
  steps?: number;
  // For "harpoon": targetX/Y on the board
  targetX?: number;
  targetY?: number;
}

export interface WhalabroadState {
  sessionId: string;
  phase: WhalabroadPhase;
  turnIndex: number;
  totalTurnsLimit: number;     // hard cap to prevent stalemate
  deadline: number | null;
  turnSeconds: number;

  boardSize: number;           // 12
  islands: Array<[number, number]>;
  harbor: Array<[number, number]>;

  whale: WhaleState | null;
  ships: ShipState[];

  // Per-turn submission queues
  whaleAction: WhalePending | null;
  shipActions: Record<string, ShipPending>; // guestId → action

  taunt: string | null;        // last whale taunt for client display
  scores: WhalabroadScore[];

  mode: PlayMode;
  passOrder: string[];
  // For lobby phase — guestIds who have raised their hand to be the whale.
  whaleVolunteers: string[];
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

// ──────────────────────────────────────────────────────────────────────────
// Board geometry: 12×12 grid clipped into an octagon. Corners are "void".
// ──────────────────────────────────────────────────────────────────────────
export function inOctagon(x: number, y: number, size = config.boardSize): boolean {
  if (x < 0 || y < 0 || x >= size || y >= size) return false;
  // Clip 3-deep triangular corners.
  const cut = 3;
  if (x + y < cut) return false;                       // NW
  if (x + (size - 1 - y) < cut) return false;          // SW
  if ((size - 1 - x) + y < cut) return false;          // NE
  if ((size - 1 - x) + (size - 1 - y) < cut) return false; // SE
  return true;
}

function cellTypeAt(x: number, y: number, islands: Array<[number, number]>, harbor: Array<[number, number]>): CellType {
  if (!inOctagon(x, y)) return "void";
  if (harbor.some(([hx, hy]) => hx === x && hy === y)) return "harbor";
  if (islands.some(([ix, iy]) => ix === x && iy === y)) return "island";
  return "water";
}

export function getCell(state: WhalabroadState, x: number, y: number): Cell {
  return { type: cellTypeAt(x, y, state.islands, state.harbor) };
}

function isPassable(state: WhalabroadState, x: number, y: number, forWhale: boolean): boolean {
  const t = cellTypeAt(x, y, state.islands, state.harbor);
  if (t === "void" || t === "island") return false;
  // Whale cannot enter harbor cells (shallow water).
  if (forWhale && t === "harbor") return false;
  // Occupant check: ships block each other.
  for (const s of state.ships) if (!s.sunk && s.x === x && s.y === y) return false;
  if (state.whale && !forWhale && !state.whale.dead && state.whale.surfaced && state.whale.x === x && state.whale.y === y) return false;
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
    // Need at least 1 whale + 2 whalers for an interesting game.
    throw new Error("whalabroad: need at least 3 players (1 whale + 2 whalers)");
  }
  const sessionId = nanoid(12);
  db.createSession(sessionId, roomId, "whalabroad");

  const state: WhalabroadState = {
    sessionId,
    phase: "lobby",
    turnIndex: 0,
    totalTurnsLimit: 30,
    deadline: null,
    turnSeconds: config.turnSeconds,
    boardSize: config.boardSize,
    islands: [...config.scatteredIslandCells, ...config.centerIslandCells].map(([x, y]) => [x, y] as [number, number]),
    harbor: config.harborCells.map(([x, y]) => [x, y] as [number, number]),
    whale: null,
    ships: [],
    whaleAction: null,
    shipActions: {},
    taunt: null,
    scores: members.map(m => ({
      guestId: m.guestId, displayName: m.displayName, score: 0,
      role: "whaler", outcome: "draw",
    })),
    mode,
    passOrder: members.map(m => m.guestId),
    whaleVolunteers: [],
  };
  sessions.set(roomId, state);
  return state;
}

export function getState(roomId: string): WhalabroadState | null {
  return sessions.get(roomId) ?? null;
}

// Returns state with the whale's exact position obscured for non-whale players
// when the whale is hidden. We still send a coarse "hint zone" so whalers can
// hunt — just not pinpoint targeting.
export function getStateForPlayer(roomId: string, guestId: string): WhalabroadState | null {
  const s = sessions.get(roomId);
  if (!s) return null;
  if (!s.whale) return s;
  if (s.whale.surfaced || s.whale.dead) return s; // visible to all
  if (s.whale.guestId === guestId) return s;      // the whale player sees self
  // Fog the position: snap to a 3-cell "hint zone" centered on the whale.
  const fogged: WhaleState = { ...s.whale, x: -1, y: -1 };
  // Provide hint via the taunt/state instead of leaking exact coords.
  return { ...s, whale: fogged };
}

// Hint zone (3×3 area) — used by clients to render bubbles where the whale
// MIGHT be. Server-computed so the actual position is never leaked client-side.
export function getWhaleHintZone(roomId: string): { cx: number; cy: number; radius: number } | null {
  const s = sessions.get(roomId);
  if (!s || !s.whale || s.whale.surfaced || s.whale.dead) return null;
  // Snap to a 3-cell grid so the hint moves coarsely.
  const cx = Math.round(s.whale.x / 3) * 3;
  const cy = Math.round(s.whale.y / 3) * 3;
  return { cx, cy, radius: 1 };
}

// ──────────────────────────────────────────────────────────────────────────
// Lobby — role assignment
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

// Host commits the lobby: pick a whale (random from volunteers, or random
// from everyone if none volunteered), assign ship colors to the rest, and
// start turn 1.
export function commitLobby(roomId: string): WhalabroadState | null {
  const s = sessions.get(roomId);
  if (!s || s.phase !== "lobby") return null;

  const allIds = s.passOrder;
  const whalePool = s.whaleVolunteers.length > 0 ? s.whaleVolunteers : allIds;
  const whaleId = whalePool[Math.floor(Math.random() * whalePool.length)];
  const whaleName = s.scores.find(x => x.guestId === whaleId)?.displayName ?? "Moby";

  const whalerIds = allIds.filter(id => id !== whaleId);
  if (whalerIds.length < 2) return null;

  // Assign one unique ship color per whaler.
  const colors = shuffle([...SHIP_COLORS]).slice(0, whalerIds.length);
  const ships: ShipState[] = whalerIds.map((gid, i) => {
    const color = colors[i];
    const namePool = SHIP_NAMES[color] ?? ["The Vessel"];
    const shipName = namePool[Math.floor(Math.random() * namePool.length)];
    const displayName = s.scores.find(x => x.guestId === gid)?.displayName ?? "Whaler";
    // Spawn whalers on water cells near the harbor without overlap.
    const [sx, sy] = pickSpawnNearHarbor(s, i);
    return {
      guestId: gid, displayName, color, shipName,
      x: sx, y: sy, facing: 0,
      hp: config.shipStartingHP,
      sunk: false,
    };
  });

  s.whale = {
    guestId: whaleId,
    displayName: whaleName,
    x: config.whaleStart.x,
    y: config.whaleStart.y,
    surfaced: false,
    wounds: 0,
    dead: false,
    towedBy: null,
  };
  s.ships = ships;

  // Update scores' role tags.
  for (const sc of s.scores) sc.role = sc.guestId === whaleId ? "whale" : "whaler";

  s.phase = "moving";
  s.turnIndex = 1;
  s.deadline = Date.now() + s.turnSeconds * 1000;
  s.taunt = TAUNTS[Math.floor(Math.random() * TAUNTS.length)];
  return s;
}

function pickSpawnNearHarbor(s: WhalabroadState, idx: number): [number, number] {
  // Harbor is along y=11 around x=5,6. Spread spawns left/right along y=10.
  const baseY = 10;
  const baseX = 6;
  const offsets = [0, -1, 1, -2, 2, -3, 3];
  for (const dx of offsets) {
    const x = baseX + dx + (idx > 6 ? idx - 6 : 0);
    if (cellTypeAt(x, baseY, s.islands, s.harbor) === "water") return [x, baseY];
  }
  // Fallback: scan upward for any water cell.
  for (let y = 9; y >= 5; y--) for (let x = 0; x < s.boardSize; x++) {
    if (cellTypeAt(x, y, s.islands, s.harbor) === "water") return [x, y];
  }
  return [baseX, baseY];
}

// ──────────────────────────────────────────────────────────────────────────
// Per-turn action submission. Players queue ONE action; server resolves at
// turn end (timer expiry or all-submitted).
// ──────────────────────────────────────────────────────────────────────────
export function submitWhaleAction(roomId: string, guestId: string, action: WhalePending): WhalabroadState | null {
  const s = sessions.get(roomId);
  if (!s || s.phase !== "moving" || !s.whale) return null;
  if (s.whale.guestId !== guestId || s.whale.dead) return null;
  s.whaleAction = sanitizeWhaleAction(action);
  return s;
}

export function submitShipAction(roomId: string, guestId: string, action: ShipPending): WhalabroadState | null {
  const s = sessions.get(roomId);
  if (!s || s.phase !== "moving") return null;
  const ship = s.ships.find(sh => sh.guestId === guestId && !sh.sunk);
  if (!ship) return null;
  s.shipActions[guestId] = sanitizeShipAction(action);
  return s;
}

function sanitizeWhaleAction(a: WhalePending): WhalePending {
  const kind = a.kind;
  if (kind === "move") {
    const dx = clamp(a.dx ?? 0, -1, 1);
    const dy = clamp(a.dy ?? 0, -1, 1);
    const steps = clamp(a.steps ?? 1, 1, config.whaleMoveRange);
    return { kind, dx, dy, steps };
  }
  if (kind === "ram") return { kind, targetGuestId: typeof a.targetGuestId === "string" ? a.targetGuestId : undefined };
  // surface / dive / pass have no payload
  return { kind };
}

function sanitizeShipAction(a: ShipPending): ShipPending {
  const kind = a.kind;
  if (kind === "move") {
    const dx = clamp(a.dx ?? 0, -1, 1);
    const dy = clamp(a.dy ?? 0, -1, 1);
    const steps = clamp(a.steps ?? 1, 1, config.shipMoveRange);
    return { kind, dx, dy, steps };
  }
  if (kind === "harpoon" || kind === "ram") {
    return {
      kind,
      targetX: typeof a.targetX === "number" ? Math.floor(a.targetX) : undefined,
      targetY: typeof a.targetY === "number" ? Math.floor(a.targetY) : undefined,
    };
  }
  return { kind };
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

// ──────────────────────────────────────────────────────────────────────────
// Resolution: applied at turn end. Order is whale-moves → ship-moves →
// attacks (whale ram, ship harpoon, ship ram) → end-of-turn checks.
// ──────────────────────────────────────────────────────────────────────────
export function resolveTurn(roomId: string): WhalabroadState | null {
  const s = sessions.get(roomId);
  if (!s || s.phase !== "moving" || !s.whale) return null;
  s.phase = "resolving";

  // 1. Whale moves first (it's the apex predator and harder to read).
  applyWhaleMovement(s);

  // 2. All ships move simultaneously. Resolve in passOrder for tie-breaking.
  for (const gid of s.passOrder) {
    const action = s.shipActions[gid];
    const ship = s.ships.find(sh => sh.guestId === gid && !sh.sunk);
    if (!action || !ship) continue;
    if (action.kind === "move") applyShipMovement(s, ship, action);
  }

  // 3. Attacks resolve simultaneously: whale ram first, then ship harpoons + rams.
  if (s.whale && !s.whale.dead) applyWhaleRam(s);
  for (const gid of s.passOrder) {
    const action = s.shipActions[gid];
    const ship = s.ships.find(sh => sh.guestId === gid && !sh.sunk);
    if (!action || !ship) continue;
    if (action.kind === "harpoon") applyShipHarpoon(s, ship, action);
    else if (action.kind === "ram") applyShipRamAttempt(s, ship, action);
    else if (action.kind === "tow") applyShipTow(s, ship);
    else if (action.kind === "release") {
      if (s.whale && s.whale.towedBy === ship.guestId) s.whale.towedBy = null;
    }
  }

  // 4. End-of-turn: check for game over.
  const ended = checkEndOfGame(s);
  if (!ended) {
    // If the whale is dead and someone is towing, switch to "tow" phase.
    s.phase = (s.whale && s.whale.dead && s.whale.towedBy) ? "tow" : "moving";
    s.turnIndex++;
    s.deadline = Date.now() + s.turnSeconds * 1000;
    s.taunt = TAUNTS[Math.floor(Math.random() * TAUNTS.length)];
    s.shipActions = {};
    s.whaleAction = null;
    if (s.turnIndex > s.totalTurnsLimit) finalizeStalemate(s);
  }
  return s;
}

function applyWhaleMovement(s: WhalabroadState) {
  if (!s.whale || s.whale.dead) return;
  const a = s.whaleAction;
  if (!a) return;
  if (a.kind === "surface") s.whale.surfaced = true;
  else if (a.kind === "dive") s.whale.surfaced = false;
  else if (a.kind === "move") {
    const dx = a.dx ?? 0, dy = a.dy ?? 0;
    let steps = a.steps ?? 1;
    while (steps > 0) {
      const nx = s.whale.x + dx, ny = s.whale.y + dy;
      if (!isPassable(s, nx, ny, true)) break;
      s.whale.x = nx; s.whale.y = ny;
      steps--;
    }
  }
}

function applyShipMovement(s: WhalabroadState, ship: ShipState, a: ShipPending) {
  // If this ship is towing the whale, dragging it slows movement.
  const isTowing = s.whale && s.whale.towedBy === ship.guestId;
  const maxSteps = isTowing ? 1 : (a.steps ?? 1);
  let steps = Math.min(a.steps ?? 1, maxSteps);
  const dx = a.dx ?? 0, dy = a.dy ?? 0;
  // Update facing from movement direction.
  const dir = directionToFacing(dx, dy);
  if (dir !== -1) ship.facing = dir;
  while (steps > 0) {
    const nx = ship.x + dx, ny = ship.y + dy;
    if (!isPassable(s, nx, ny, false)) break;
    ship.x = nx; ship.y = ny;
    if (isTowing && s.whale) {
      // Drag the carcass to the previous cell of the ship.
      s.whale.x = nx - dx;
      s.whale.y = ny - dy;
    }
    steps--;
  }
}

function directionToFacing(dx: number, dy: number): number {
  const dirs: Record<string, number> = {
    "0,-1": 0, "1,-1": 1, "1,0": 2, "1,1": 3,
    "0,1": 4, "-1,1": 5, "-1,0": 6, "-1,-1": 7,
  };
  return dirs[`${dx},${dy}`] ?? -1;
}

function applyWhaleRam(s: WhalabroadState) {
  const a = s.whaleAction;
  if (!a || a.kind !== "ram" || !s.whale) return;
  const target = s.ships.find(sh => sh.guestId === a.targetGuestId && !sh.sunk);
  if (!target) return;
  // Ram requires whale surfaced + adjacent to target.
  if (!s.whale.surfaced) return;
  if (chebyshev(s.whale.x, s.whale.y, target.x, target.y) > config.ramRange) return;
  target.hp -= 1;
  if (target.hp <= 0) {
    target.sunk = true;
    target.hp = 0;
  }
}

function applyShipHarpoon(s: WhalabroadState, ship: ShipState, a: ShipPending) {
  if (!s.whale || s.whale.dead) return;
  const tx = a.targetX, ty = a.targetY;
  if (typeof tx !== "number" || typeof ty !== "number") return;
  // Harpoons can only be fired at SURFACED whales — fog hides position from
  // whalers, so they have to read the bubble hint and guess when to surface.
  if (!s.whale.surfaced) return;
  if (s.whale.x !== tx || s.whale.y !== ty) return;
  if (chebyshev(ship.x, ship.y, s.whale.x, s.whale.y) > config.harpoonRange) return;
  s.whale.wounds += 1;
  if (s.whale.wounds >= config.whaleStartingHP) {
    s.whale.dead = true;
    s.whale.surfaced = true;
    s.whale.towedBy = null; // claimed via separate "tow" action by an adjacent ship
  }
}

function applyShipRamAttempt(s: WhalabroadState, ship: ShipState, a: ShipPending) {
  if (!s.whale || s.whale.dead) return;
  const tx = a.targetX, ty = a.targetY;
  if (typeof tx !== "number" || typeof ty !== "number") return;
  if (!s.whale.surfaced) return;
  if (s.whale.x !== tx || s.whale.y !== ty) return;
  if (chebyshev(ship.x, ship.y, s.whale.x, s.whale.y) > config.ramRange) return;
  // Ramming a whale: minor wound to whale, but ship also takes 1 damage.
  s.whale.wounds += 1;
  ship.hp -= 1;
  if (ship.hp <= 0) ship.sunk = true;
  if (s.whale.wounds >= config.whaleStartingHP) {
    s.whale.dead = true;
    s.whale.surfaced = true;
  }
}

function applyShipTow(s: WhalabroadState, ship: ShipState) {
  if (!s.whale || !s.whale.dead) return;
  if (s.whale.towedBy) return; // already claimed
  if (chebyshev(ship.x, ship.y, s.whale.x, s.whale.y) > 1) return;
  s.whale.towedBy = ship.guestId;
}

function chebyshev(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

// ──────────────────────────────────────────────────────────────────────────
// End-of-game checks.
// ──────────────────────────────────────────────────────────────────────────
function checkEndOfGame(s: WhalabroadState): boolean {
  if (!s.whale) return false;
  // Whale wins if every ship is sunk.
  const aliveShips = s.ships.filter(sh => !sh.sunk);
  if (aliveShips.length === 0) {
    s.phase = "game_over";
    finalize(s, "whale");
    return true;
  }
  // Whaler wins if a ship tows the carcass to a harbor cell.
  if (s.whale.dead && s.whale.towedBy) {
    const towShip = s.ships.find(sh => sh.guestId === s.whale!.towedBy);
    if (towShip && s.harbor.some(([hx, hy]) => hx === towShip.x && hy === towShip.y)) {
      s.phase = "game_over";
      finalize(s, "whaler", towShip.guestId);
      return true;
    }
  }
  return false;
}

function finalizeStalemate(s: WhalabroadState) {
  // Time-out: whale wins if still alive (you didn't kill it in time).
  s.phase = "game_over";
  if (s.whale && !s.whale.dead) finalize(s, "whale");
  else finalize(s, "draw");
}

function finalize(s: WhalabroadState, victor: "whale" | "whaler" | "draw", winningWhalerId?: string) {
  for (const sc of s.scores) {
    if (victor === "draw") { sc.outcome = "draw"; sc.score = 100; continue; }
    if (sc.role === "whale") {
      sc.outcome = victor === "whale" ? "win" : "loss";
      sc.score = victor === "whale" ? 1000 : 0;
    } else {
      // Whalers: winning towing whaler takes the prize, others get participation.
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
