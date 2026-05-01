import { useState, useEffect, useRef } from "react";
import { socket } from "../ws";
import { haptic } from "../haptics";
import { playSound } from "../sounds";
import PodiumScreen from "../components/PodiumScreen";
import CutScene from "../components/CutScene";

// Full-spec Whalabroad client with atlas sprite rendering for ships + whale.
// Board tiles still flat colored (those sheets aren't a clean grid — pixel
// coords would need to be hand-mapped per tile and that's a follow-up).

interface Props { guestId: string; roomId: string; isHost: boolean; gameState: any; }

const BOARD_PX = 480;
const BOARD_SIZE = 12;

// ─── Atlas sheets ─────────────────────────────────────────────────────────
// Ship sheets: 1440 × 2912 px. Layout = 4 cols × 6 rows = 24 cells.
//   Rows 0-1: full health (N/NE/E/SE then S/SW/W/NW)
//   Rows 2-3: damaged
//   Rows 4-5: critical
// Cell ≈ 360 × 485 px.
const SHIP_SHEET_PATHS: Record<string, string> = {
  "black":        "/whalabroad/raw/ship-black-sheet.png",
  "red":          "/whalabroad/raw/ship-red-sheet.png",
  "brown":        "/whalabroad/raw/ship-brown-sheet.png",
  "white":        "/whalabroad/raw/ship-white-sheet.png",
  "yellow":       "/whalabroad/raw/ship-yellow-sheet.png",
  "green-faded":  "/whalabroad/raw/ship-green-faded-sheet.png",
  "gray-faded":   "/whalabroad/raw/ship-gray-faded-sheet.png",
};
const SHIP_SHEET_W = 1440, SHIP_SHEET_H = 2912;
const SHIP_CELL_W = SHIP_SHEET_W / 4;   // 360
const SHIP_CELL_H = SHIP_SHEET_H / 6;   // ≈485.33

// Whale alive grid (8 facings, 2 cols × 4 rows): 720 × 1456.
const WHALE_ALIVE_PATH = "/whalabroad/raw/whale-swim-grid-v2.png";
const WHALE_ALIVE_W = 720, WHALE_ALIVE_H = 1456;
const WHALE_ALIVE_CELL_W = WHALE_ALIVE_W / 2;  // 360
const WHALE_ALIVE_CELL_H = WHALE_ALIVE_H / 4;  // 364

// Whale damage grid (8 facings × 3 HP states, 4 cols × 6 rows): 881 × 1785.
const WHALE_DAMAGE_PATH = "/whalabroad/raw/whale-damage-grid.png";
const WHALE_DAMAGE_W = 881, WHALE_DAMAGE_H = 1785;
const WHALE_DAMAGE_CELL_W = WHALE_DAMAGE_W / 4;  // ≈220
const WHALE_DAMAGE_CELL_H = WHALE_DAMAGE_H / 6;  // ≈297.5

// Board tile sheet (1678 × 937). Layout is hand-measured from the v2 sheet:
//   row 1 (y≈140-260): 4 water tiles (left), 4 island tiles (right)
//   row 2 (y≈340-490): 2 center-island tiles (left, double-wide), edge-frame pieces (right)
//   row 3 (y≈580-770): 2 harbor tiles (left), more frame pieces (right)
// Coordinates are best-fit guesses; if any tile looks off, just nudge the
// numbers below — the painter will re-render automatically on next paint.
const BOARD_TILES_PATH = "/whalabroad/raw/board-tiles-v2.png";
const TILE = {
  water:  [
    [60,  140, 130, 130], [200, 140, 130, 130],
    [340, 140, 130, 130], [480, 140, 130, 130],
  ] as Array<[number, number, number, number]>,
  island: [
    [920, 140, 130, 130], [1060, 140, 130, 130],
    [1200, 140, 130, 130], [1340, 140, 130, 130],
  ] as Array<[number, number, number, number]>,
  // Harbor pair — left tile (with buildings/pier) and right tile (smaller dock).
  harborL: [60,  580, 280, 190] as [number, number, number, number],
  harborR: [340, 580, 280, 190] as [number, number, number, number],
};

// Pick a deterministic variant per cell so water/island texture varies across
// the board but stays stable between repaints.
function variantFor(x: number, y: number, choices: number): number {
  const h = (x * 73856093) ^ (y * 19349663);
  return Math.abs(h) % choices;
}

// Ship sprite cell coordinates given facing (0..7) and HP state (0=full,
// 1=damaged, 2=critical).
function shipCell(facing: number, hpState: 0 | 1 | 2): { sx: number; sy: number; sw: number; sh: number } {
  const col = facing % 4;
  const row = hpState * 2 + Math.floor(facing / 4);
  return { sx: col * SHIP_CELL_W, sy: row * SHIP_CELL_H, sw: SHIP_CELL_W, sh: SHIP_CELL_H };
}

function whaleAliveCell(facing: number) {
  const col = facing % 2;
  const row = Math.floor(facing / 2);
  return { sx: col * WHALE_ALIVE_CELL_W, sy: row * WHALE_ALIVE_CELL_H, sw: WHALE_ALIVE_CELL_W, sh: WHALE_ALIVE_CELL_H };
}

function whaleDamageCell(facing: number, hpState: 1 | 2) {
  const col = facing % 4;
  const row = hpState * 2 + Math.floor(facing / 4);
  return { sx: col * WHALE_DAMAGE_CELL_W, sy: row * WHALE_DAMAGE_CELL_H, sw: WHALE_DAMAGE_CELL_W, sh: WHALE_DAMAGE_CELL_H };
}

function shipHpState(hp: number, max = 3): 0 | 1 | 2 {
  if (hp >= max) return 0;
  if (hp >= Math.ceil(max / 2)) return 1;
  return 2;
}

function whaleDamageState(wounds: number, hp: number): 0 | 1 | 2 {
  if (wounds === 0) return 0;
  if (wounds < hp / 2) return 1;
  return 2;
}

function inOctagon(x: number, y: number, ringScale: number): boolean {
  if (x < 0 || y < 0 || x >= BOARD_SIZE || y >= BOARD_SIZE) return false;
  const cut = 7 - ringScale;
  if (x + y < cut) return false;
  if (x + (BOARD_SIZE - 1 - y) < cut) return false;
  if ((BOARD_SIZE - 1 - x) + y < cut) return false;
  if ((BOARD_SIZE - 1 - x) + (BOARD_SIZE - 1 - y) < cut) return false;
  return true;
}

const SHIP_HEX: Record<string, string> = {
  "black":        "#1a1410",
  "red":          "#7a2c1f",
  "brown":        "#86643c",
  "white":        "#c9c2b0",
  "yellow":       "#d9a649",
  "green-faded":  "#5e7560",
  "gray-faded":   "#7d7567",
};

const FACING_LABEL = ["N","NE","E","SE","S","SW","W","NW"];

type ActionMode =
  | "idle"
  | "move"           // pick a destination cell
  | "fire_cannons"   // pick a target cell w/ side
  | "kraken"         // ghost: pick a target cell
  | "whisper";       // ghost: pick a recipient

export default function WhalabroadGame({ guestId, roomId, isHost, gameState }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [actionMode, setActionMode] = useState<ActionMode>("idle");
  const [moveKind, setMoveKind] = useState<"full_sail" | "slow_crawl">("slow_crawl");
  const [whaleMoveKind, setWhaleMoveKind] = useState<"deep_dive" | "bubble_move" | "breach">("deep_dive");
  const [cannonSide, setCannonSide] = useState<"port" | "starboard">("port");
  const [targetCell, setTargetCell] = useState<{ x: number; y: number } | null>(null);
  const [whisperText, setWhisperText] = useState<string>("");
  const [whisperTo, setWhisperTo] = useState<string>("");

  const phase: string = gameState?.phase ?? "lobby";
  const ringScale: number = gameState?.ringScale ?? 4;
  const islands: Array<[number, number]> = gameState?.islands ?? [];
  const harbor: Array<[number, number]> = gameState?.harbor ?? [];
  const stormCells: Array<[number, number]> = gameState?.stormCells ?? [];
  const stormActive: boolean = gameState?.stormActive ?? false;
  const whale = gameState?.whale ?? null;
  const ships: any[] = gameState?.ships ?? [];
  const turnIndex: number = gameState?.turnIndex ?? 0;
  const taunt: string | null = gameState?.taunt ?? null;
  const scores: any[] = gameState?.scores ?? [];
  const whaleVolunteers: string[] = gameState?.whaleVolunteers ?? [];
  const hpPreset: string | null = gameState?.whaleHPPreset ?? null;
  const whispers: any[] = gameState?.whispers ?? [];

  const myShip = ships.find((s: any) => s.guestId === guestId);
  const isWhale = whale && whale.guestId === guestId;
  const isWhaler = !!myShip && !myShip.sunk;
  const isGhost = !!myShip && myShip.sunk;
  const amSpectator = !isWhale && !isWhaler && !isGhost;

  // ─── Atlas image preloader ────────────────────────────────────────────
  const imgRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [atlasTick, setAtlasTick] = useState(0); // bump to force redraw on load
  useEffect(() => {
    const paths = [
      ...Object.values(SHIP_SHEET_PATHS),
      WHALE_ALIVE_PATH, WHALE_DAMAGE_PATH, BOARD_TILES_PATH,
    ];
    let cancelled = false;
    for (const p of paths) {
      if (imgRef.current.has(p)) continue;
      const img = new Image();
      img.onload = () => { if (!cancelled) setAtlasTick(t => t + 1); };
      img.src = p;
      imgRef.current.set(p, img);
    }
    return () => { cancelled = true; };
  }, []);

  // "?" rules pull-up — always available during play
  const [showRules, setShowRules] = useState(false);

  // Cut-scene overlay — server pushes labels into state.events; we diff and
  // fire one banner per new label using PartyGlue's existing CutScene component.
  const [cutScene, setCutScene] = useState<{ name: string; seq: number; tier?: "banner" | "overlay" | "peak"; sound?: string } | null>(null);
  const cutSeqRef = useRef(0);
  const eventsSeenRef = useRef(0);
  useEffect(() => {
    const events: string[] = gameState?.events ?? [];
    if (events.length <= eventsSeenRef.current) return;
    // Fire only the most recent event (queueing multiple cinematics back-to-back
    // would just stomp each other — server rarely emits more than one per turn).
    const latest = events[events.length - 1];
    eventsSeenRef.current = events.length;
    const SOUND: Record<string, string> = {
      "RAMMING STRIKE":   "wb-cannon",
      "WHITE WHALE FELLS":"wb-victory",
      "TOW DELIVERED":    "wb-victory",
      "KRAKEN RISES":     "wb-kraken",
      "STORM RISES":      "wb-storm",
    };
    const TIER: Record<string, "banner" | "overlay" | "peak"> = {
      "RAMMING STRIKE":   "overlay",
      "WHITE WHALE FELLS":"peak",
      "TOW DELIVERED":    "peak",
      "KRAKEN RISES":     "overlay",
      "STORM RISES":      "overlay",
    };
    setCutScene({
      name: latest,
      seq: ++cutSeqRef.current,
      tier: TIER[latest] ?? "overlay",
      sound: SOUND[latest],
    });
  }, [gameState?.events?.length]);

  // First-turn tooltip — explain broadside cannons to whalers ONCE per device.
  // Stored in localStorage so it doesn't repeat for repeat players.
  const [showFacingTip, setShowFacingTip] = useState(false);
  useEffect(() => {
    if (phase !== "moving") return;
    if (turnIndex !== 1) return;
    if (typeof window === "undefined") return;
    const seen = window.localStorage.getItem("wb_seen_facing_tip");
    if (!seen) setShowFacingTip(true);
  }, [phase, turnIndex]);
  function dismissFacingTip() {
    setShowFacingTip(false);
    try { window.localStorage.setItem("wb_seen_facing_tip", "1"); } catch {}
  }

  // Reactive SFX — diff previous state against current and fire sounds for
  // observable transitions (HP drops, sinks, storm activates, whisper arrives).
  const prevSnapRef = useRef<any>(null);
  useEffect(() => {
    if (!gameState) { prevSnapRef.current = null; return; }
    const prev = prevSnapRef.current;
    if (prev) {
      // My ship took damage
      const myPrevShip = prev.ships?.find((s: any) => s.guestId === guestId);
      const myCurShip  = ships.find((s: any) => s.guestId === guestId);
      if (myPrevShip && myCurShip) {
        if (myCurShip.hp < myPrevShip.hp) playSound("wb-wood-crack");
        if (!myPrevShip.sunk && myCurShip.sunk) playSound("wb-sinking");
      }
      // Storm just activated
      if (!prev.stormActive && stormActive) playSound("wb-storm");
      // Kraken pending count went down (one resolved this turn)
      const prevPending = prev.krakensPending?.length ?? 0;
      const curPending = gameState.krakensPending?.length ?? 0;
      if (prevPending > curPending) playSound("wb-kraken");
      // New whisper addressed to me
      const prevWhisperCount = (prev.whispers ?? []).filter((w: any) => w.toGuestId === guestId).length;
      const curWhisperCount  = whispers.filter((w: any) => w.toGuestId === guestId).length;
      if (curWhisperCount > prevWhisperCount) playSound("wb-whisper");
      // Game just ended with me on the winning side
      if (prev.phase !== "game_over" && phase === "game_over") {
        const me = scores.find((s: any) => s.guestId === guestId);
        if (me && me.outcome === "win") playSound("wb-victory");
      }
    }
    prevSnapRef.current = gameState;
  }, [gameState, ships, stormActive, whispers, scores, phase, guestId]);

  // Auto-end the 3-second reveal phase as host.
  useEffect(() => {
    if (phase === "reveal" && isHost) {
      const t = setTimeout(() => {
        socket.send({ type: "game:action", guestId, roomId, action: "whalabroad:end_reveal", payload: {} } as any);
      }, 3200);
      return () => clearTimeout(t);
    }
  }, [phase, isHost, guestId, roomId]);

  // ─── Canvas painter ───────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cellPx = BOARD_PX / BOARD_SIZE;
    ctx.clearRect(0, 0, BOARD_PX, BOARD_PX);

    const tilesImg = imgRef.current.get(BOARD_TILES_PATH);
    const tilesReady = tilesImg && tilesImg.complete && tilesImg.naturalWidth > 0;
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        if (!inOctagon(x, y, ringScale)) continue;
        const isHarbor = harbor.some(([hx, hy]) => hx === x && hy === y);
        const isIsland = islands.some(([ix, iy]) => ix === x && iy === y);
        const isStorm = stormActive && stormCells.some(([sx, sy]) => sx === x && sy === y);

        if (tilesReady && !isStorm) {
          // Atlas-painted tile.
          let crop: [number, number, number, number] | null = null;
          if (isHarbor) {
            // Alternate left/right harbor variant by x.
            crop = (x % 2 === 0) ? TILE.harborL : TILE.harborR;
          } else if (isIsland) {
            crop = TILE.island[variantFor(x, y, TILE.island.length)];
          } else {
            crop = TILE.water[variantFor(x, y, TILE.water.length)];
          }
          const [sx, sy, sw, sh] = crop;
          ctx.drawImage(tilesImg!, sx, sy, sw, sh, x * cellPx, y * cellPx, cellPx, cellPx);
        } else {
          // Fallback: flat color while tiles load (or storm cell).
          ctx.fillStyle = isStorm ? "#3a3a3a" :
                          isHarbor ? "#5c4429" :
                          isIsland ? "#7d7567" : "#162230";
          ctx.fillRect(x * cellPx, y * cellPx, cellPx, cellPx);
        }

        if (isStorm) {
          // Storm cross-hatch overlay (always — even atop atlas tile)
          if (tilesReady) {
            // Dim the underlying tile a bit so the storm reads.
            ctx.fillStyle = "rgba(58,58,58,0.55)";
            ctx.fillRect(x * cellPx, y * cellPx, cellPx, cellPx);
          }
          ctx.strokeStyle = "rgba(255,255,255,0.3)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x * cellPx, y * cellPx);
          ctx.lineTo((x + 1) * cellPx, (y + 1) * cellPx);
          ctx.moveTo((x + 1) * cellPx, y * cellPx);
          ctx.lineTo(x * cellPx, (y + 1) * cellPx);
          ctx.stroke();
        }
        ctx.strokeStyle = "rgba(255,255,255,0.06)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x * cellPx, y * cellPx, cellPx, cellPx);
      }
    }

    // Repair zone highlight (manhattan ≤ 2 from any harbor cell)
    if (isWhaler) {
      ctx.fillStyle = "rgba(74,222,128,0.05)";
      for (let y = 0; y < BOARD_SIZE; y++) {
        for (let x = 0; x < BOARD_SIZE; x++) {
          if (!inOctagon(x, y, ringScale)) continue;
          if (harbor.some(([hx, hy]) => Math.abs(hx - x) + Math.abs(hy - y) <= 2)) {
            if (!harbor.some(([hx, hy]) => hx === x && hy === y)) {
              ctx.fillRect(x * cellPx, y * cellPx, cellPx, cellPx);
            }
          }
        }
      }
    }

    // Whale (only render when surfaced/dead, OR when viewer is the whale or a ghost)
    const showWhalePosition = whale && whale.x >= 0 && whale.y >= 0;
    if (whale && showWhalePosition) {
      const px = whale.x * cellPx + cellPx / 2;
      const py = whale.y * cellPx + cellPx / 2;
      const damageState = whaleDamageState(whale.wounds ?? 0, whale.hp ?? 5);
      const facing = 4; // whale doesn't track facing in state — render it facing south by default
      // Pick the right atlas sheet: damage-grid for wounded/dead, alive grid otherwise.
      const useDamage = damageState > 0 || whale.dead;
      const sheetPath = useDamage ? WHALE_DAMAGE_PATH : WHALE_ALIVE_PATH;
      const img = imgRef.current.get(sheetPath);
      const cell = useDamage
        ? whaleDamageCell(facing, (whale.dead ? 2 : damageState) as 1 | 2)
        : whaleAliveCell(facing);
      const drawSize = cellPx * 1.5; // sprite oversized for board-piece feel
      ctx.globalAlpha = whale.surfaced || whale.dead ? 1 : 0.6; // fade slightly when underwater
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, cell.sx, cell.sy, cell.sw, cell.sh,
                      px - drawSize / 2, py - drawSize / 2, drawSize, drawSize);
      } else {
        // Fallback: colored circle while atlas loads
        ctx.fillStyle = whale.dead ? "#7d7567" : (whale.surfaced ? "#dbe7ee" : "rgba(216,231,238,0.55)");
        ctx.beginPath();
        ctx.arc(px, py, cellPx * 0.42, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#0d1418";
        ctx.font = `${cellPx * 0.6}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(whale.dead ? "💀" : "🐋", px, py);
      }
      ctx.globalAlpha = 1;
      // Wound count
      if (whale.wounds > 0 && !whale.dead) {
        ctx.fillStyle = "#7a2c1f";
        ctx.font = `${cellPx * 0.18}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("✦".repeat(whale.wounds), px, py + cellPx * 0.32);
      }
      // Tow line indicator
      if (whale.dead && whale.towedBy) {
        const tower = ships.find(sh => sh.guestId === whale.towedBy);
        if (tower) {
          ctx.strokeStyle = "#a8503a";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(tower.x * cellPx + cellPx / 2, tower.y * cellPx + cellPx / 2);
          ctx.stroke();
        }
      }
    }

    // Bubble hint zone (only for non-whale viewers, only when last whale move was bubble)
    const lastMove = whale?.history?.[whale.history.length - 1];
    if (!isWhale && !isGhost && whale && !whale.surfaced && !whale.dead && lastMove === "bubble") {
      // Server didn't send hint zone in state; we approximate from fogged x=-1.
      // For now just show a global "bubble hint" indicator overlay.
      ctx.fillStyle = "rgba(216,231,238,0.18)";
      ctx.font = `${cellPx * 0.7}px serif`;
      ctx.textAlign = "left";
      ctx.fillText("💦 bubbles spotted", 8, BOARD_PX - 8);
    }

    // Ships
    for (const s of ships) {
      const px = s.x * cellPx + cellPx / 2;
      const py = s.y * cellPx + cellPx / 2;
      const sheetPath = SHIP_SHEET_PATHS[s.color];
      const img = sheetPath ? imgRef.current.get(sheetPath) : null;
      const hpState = s.sunk ? 2 : shipHpState(s.hp ?? 3, 3);
      const cell = shipCell(s.facing ?? 0, hpState);
      const drawSize = cellPx * 1.55; // ship sprites are taller than wide; oversize for visibility
      ctx.globalAlpha = s.sunk ? 0.55 : 1;
      if (img && img.complete && img.naturalWidth > 0) {
        // Center on cell with extra height because ships have masts.
        ctx.drawImage(img, cell.sx, cell.sy, cell.sw, cell.sh,
                      px - drawSize / 2, py - drawSize * 0.6, drawSize, drawSize * 1.2);
      } else {
        // Fallback while atlas loads
        ctx.fillStyle = SHIP_HEX[s.color] ?? "#86643c";
        const sz = cellPx * 0.72;
        ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
        ctx.strokeStyle = s.sunk ? "#5a1a10" : "#e8dcb8";
        ctx.lineWidth = 2;
        ctx.strokeRect(px - sz / 2, py - sz / 2, sz, sz);
        ctx.fillStyle = "#fff";
        ctx.font = `${cellPx * 0.5}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(s.sunk ? "👻" : "⛵", px, py);
      }
      ctx.globalAlpha = 1;
      // HP bar (only when alive)
      if (!s.sunk) {
        const barW = cellPx * 0.6;
        const fillW = (s.hp / 3) * barW;
        ctx.fillStyle = "#5a1a10";
        ctx.fillRect(px - barW / 2, py + cellPx * 0.42, barW, 3);
        ctx.fillStyle = "#4ade80";
        ctx.fillRect(px - barW / 2, py + cellPx * 0.42, fillW, 3);
      }
      // Sunk overlay
      if (s.sunk) {
        ctx.fillStyle = "#fff";
        ctx.font = `${cellPx * 0.5}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("👻", px, py);
      }
    }

    // Cannon arc preview when in fire_cannons mode for my ship
    if (isWhaler && actionMode === "fire_cannons" && myShip) {
      const px = myShip.x * cellPx + cellPx / 2;
      const py = myShip.y * cellPx + cellPx / 2;
      const portFacing = (myShip.facing + 6) % 8;
      const stbdFacing = (myShip.facing + 2) % 8;
      const useFacing = cannonSide === "port" ? portFacing : stbdFacing;
      const angle = (useFacing * 45 - 90) * Math.PI / 180;
      ctx.strokeStyle = "#d9a649";
      ctx.lineWidth = 2;
      for (let r = 1; r <= 3; r++) {
        const tx = px + Math.cos(angle) * cellPx * r;
        const ty = py + Math.sin(angle) * cellPx * r;
        ctx.strokeRect(tx - cellPx / 2, ty - cellPx / 2, cellPx, cellPx);
      }
    }

    // Selected target cell
    if (targetCell) {
      ctx.strokeStyle = "#d9a649";
      ctx.lineWidth = 3;
      ctx.strokeRect(targetCell.x * cellPx, targetCell.y * cellPx, cellPx, cellPx);
    }
  }, [ringScale, islands, harbor, stormCells, stormActive, whale, ships, targetCell, phase, isWhale, isGhost, isWhaler, actionMode, cannonSide, myShip, atlasTick]);

  function canvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (phase !== "moving" && phase !== "tow") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const cellPx = rect.width / BOARD_SIZE;
    const x = Math.floor(cx / cellPx);
    const y = Math.floor(cy / cellPx);
    if (!inOctagon(x, y, ringScale)) return;
    haptic.tap();
    setTargetCell({ x, y });
  }

  // ─── Senders ──────────────────────────────────────────────────────────────
  function send(action: string, payload: any = {}) {
    socket.send({ type: "game:action", guestId, roomId, action, payload } as any);
  }
  function volunteerWhale()   { haptic.tap(); send("whalabroad:volunteer_whale"); }
  function unvolunteerWhale() { haptic.tap(); send("whalabroad:unvolunteer_whale"); }
  function commitLobby()      { haptic.tap(); send("whalabroad:commit_lobby"); }
  function setHPPreset(p: "quick"|"standard"|"epic"|null) { haptic.tap(); send("whalabroad:set_hp_preset", { preset: p }); }
  function resolveTurn()      { haptic.heavy(); send("whalabroad:resolve_turn"); }

  function whaleAct(kind: string, extra: any = {}) {
    haptic.tap();
    if (kind === "deep_dive" || kind === "bubble_move") playSound("wb-splash");
    else if (kind === "breach" || kind === "ram_strike" || kind === "surprise_breach") playSound("wb-splash");
    send("whalabroad:whale_action", { kind, ...extra });
    setTargetCell(null);
    setActionMode("idle");
  }
  function shipAct(kind: string, extra: any = {}) {
    haptic.tap();
    if (kind === "fire_cannons") playSound("wb-cannon");
    else if (kind === "harpoon_corpse") playSound("wb-harpoon");
    send("whalabroad:ship_action", { kind, ...extra });
    setTargetCell(null);
    setActionMode("idle");
  }

  function deltaToTarget() {
    if (!targetCell) return null;
    const me = isWhale ? whale : myShip;
    if (!me) return null;
    const dx = Math.sign(targetCell.x - me.x);
    const dy = Math.sign(targetCell.y - me.y);
    const steps = Math.max(Math.abs(targetCell.x - me.x), Math.abs(targetCell.y - me.y));
    return { dx, dy, steps };
  }

  function submitWhaleMove() {
    const d = deltaToTarget();
    if (!d || d.steps === 0) return;
    whaleAct(whaleMoveKind, { dx: d.dx, dy: d.dy, steps: d.steps });
  }
  function submitWhaleRam() {
    if (!targetCell || !whale) return;
    const d = deltaToTarget();
    if (!d) return;
    const target = ships.find((s: any) => s.x === targetCell.x && s.y === targetCell.y && !s.sunk);
    whaleAct("ram_strike", { dx: d.dx, dy: d.dy, steps: Math.min(d.steps, 2), targetGuestId: target?.guestId });
  }
  function submitSurpriseBreach() {
    if (!targetCell) return;
    const target = ships.find((s: any) => s.x === targetCell.x && s.y === targetCell.y && !s.sunk);
    if (!target) return;
    whaleAct("surprise_breach", { targetGuestId: target.guestId });
  }
  function submitShipMove() {
    const d = deltaToTarget();
    if (!d || d.steps === 0) return;
    shipAct(moveKind, { dx: d.dx, dy: d.dy, steps: d.steps });
  }
  function submitFireCannons() {
    if (!targetCell) return;
    shipAct("fire_cannons", { side: cannonSide, targetX: targetCell.x, targetY: targetCell.y });
  }
  function submitKraken() {
    if (!targetCell) return;
    shipAct("kraken_summon", { targetX: targetCell.x, targetY: targetCell.y });
  }
  function submitWhisper() {
    if (!whisperTo || !whisperText.trim()) return;
    shipAct("whisper", { whisperTo, whisperText: whisperText.trim() });
    setWhisperText("");
    setWhisperTo("");
  }

  // ─── Lobby ────────────────────────────────────────────────────────────────
  if (phase === "lobby") {
    const iVolunteered = whaleVolunteers.includes(guestId);
    return (
      <div style={{ padding: 16, color: "#e8dcb8", textAlign: "center" }}>
        <h1 style={{ fontFamily: "var(--font-display)", letterSpacing: "0.05em" }}>WHALABROAD</h1>
        <p style={{ color: "#a89e8b", marginBottom: 12 }}>1 whale vs 2-7 ships. Frenemy + race.</p>

        <button className="btn-secondary" style={{ marginBottom: 12, padding: "6px 14px", fontSize: 13 }}
                onClick={() => setShowRules(true)}>📖 How to Play</button>

        {showRules && <RulesCard onClose={() => setShowRules(false)} role={isWhale ? "whale" : "whaler"} />}

        <div style={{ background: "#1f3142", padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "#a89e8b", marginBottom: 8, letterSpacing: "0.08em" }}>
            VOLUNTEERS FOR WHALE ({whaleVolunteers.length})
          </div>
          {whaleVolunteers.length === 0 && <div style={{ color: "#7d7567" }}>No one — random pick if no one volunteers</div>}
          {whaleVolunteers.map(id => {
            const sc = scores.find((s: any) => s.guestId === id);
            return <div key={id} style={{ padding: 4 }}>🐋 {sc?.displayName ?? id}</div>;
          })}
        </div>

        {!iVolunteered ? (
          <button className="btn-primary" style={{ marginBottom: 8 }} onClick={volunteerWhale}>
            🐋 Volunteer to be the whale
          </button>
        ) : (
          <button className="btn-secondary" style={{ marginBottom: 8 }} onClick={unvolunteerWhale}>
            Withdraw volunteer
          </button>
        )}

        {isHost && (
          <>
            <div style={{ background: "#1f3142", padding: 12, borderRadius: 8, marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#a89e8b", marginBottom: 8, letterSpacing: "0.08em" }}>
                WHALE HP PRESET
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {[null, "quick", "standard", "epic"].map(p => (
                  <button key={p ?? "auto"}
                          className={`btn-secondary ${hpPreset === p ? "locked" : ""}`}
                          style={{ flex: 1, padding: "6px 4px", fontSize: 12 }}
                          onClick={() => setHPPreset(p as any)}>
                    {p === null ? "Auto (N+1)" : p === "quick" ? "Quick (3)" : p === "standard" ? "Standard (5)" : "Epic (8)"}
                  </button>
                ))}
              </div>
            </div>
            <button className="lets-go-btn" onClick={commitLobby} disabled={scores.length < 3}>
              START GAME ({scores.length} players)
            </button>
          </>
        )}
        {scores.length < 3 && <p style={{ color: "#fc8181", fontSize: 12, marginTop: 8 }}>Need at least 3 players</p>}
      </div>
    );
  }

  // ─── Reveal phase (3-second whale start) ─────────────────────────────────
  if (phase === "reveal") {
    return (
      <div style={{ padding: 24, color: "#e8dcb8", textAlign: "center" }}>
        <h2 style={{ marginBottom: 16 }}>The whale rises…</h2>
        <p style={{ color: "#a89e8b", fontSize: 14 }}>Mark its starting tile. It dives in 3 seconds.</p>
        <canvas
          ref={canvasRef}
          width={BOARD_PX}
          height={BOARD_PX}
          style={{ width: "100%", maxWidth: 480, aspectRatio: "1", margin: "16px auto", display: "block",
                   background: "#0d1418", borderRadius: 8, border: "2px solid #1f3142" }}
        />
      </div>
    );
  }

  if (phase === "game_over") {
    const podiumScores = scores.map((s: any) => ({
      guestId: s.guestId,
      displayName: s.displayName + (s.role === "whale" ? " 🐋" : " ⛵"),
      score: s.score,
    }));
    return <PodiumScreen scores={podiumScores as any} guestId={guestId} roomId={roomId} isHost={isHost} />;
  }

  // ─── In-game ─────────────────────────────────────────────────────────────
  const myRole = isWhale ? "whale" : isGhost ? "ghost" : isWhaler ? "whaler" : "spectator";
  const canAct = (phase === "moving" || phase === "tow") && (isWhale || isWhaler || isGhost);
  const inHarborZone = isWhaler && myShip && harbor.some(([hx, hy]) => Math.abs(hx - myShip.x) + Math.abs(hy - myShip.y) <= 2);
  const isTowing = !!whale && whale.towedBy === guestId;
  const recoiled = isWhaler && myShip && myShip.recoilUntilTurn >= turnIndex;

  // Whispers visible to me (server already filtered)
  const myWhispers = whispers.filter((w: any) => w.toGuestId === guestId).slice(-3);

  return (
    <div style={{ padding: 12, color: "#e8dcb8" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontWeight: 700 }}>Turn {turnIndex}{stormActive ? " 🌩️" : ""}</span>
        <span style={{ fontSize: 13, color: "#a89e8b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {myRole}{isTowing ? " · towing" : ""}{recoiled ? " · recoil" : ""}
        </span>
      </div>

      {taunt && <div style={{ fontStyle: "italic", color: "#a89e8b", fontSize: 12, marginBottom: 6, textAlign: "center" }}>"{taunt}"</div>}

      {showFacingTip && isWhaler && (
        <div style={{
          background: "linear-gradient(135deg, #1f3142, #2c4a5e)",
          border: "1px solid #d9a649", borderRadius: 6,
          padding: 10, marginBottom: 8, fontSize: 13, color: "#e8dcb8",
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4, color: "#d9a649" }}>⚓ FIRST TURN — READ THIS</div>
          <div style={{ marginBottom: 6 }}>
            Your cannons fire <strong>perpendicular to your facing</strong> — port (left) or starboard (right) only.
            Move first to turn the ship; THEN fire. All ships start facing North.
          </div>
          <button className="btn-secondary" style={{ padding: "4px 10px", fontSize: 11 }}
                  onClick={dismissFacingTip}>Got it</button>
        </div>
      )}

      {myWhispers.length > 0 && (
        <div style={{ background: "rgba(125,117,103,0.2)", border: "1px solid #5e5852", padding: 6, borderRadius: 4, marginBottom: 8, fontSize: 12 }}>
          {myWhispers.map((w: any, i: number) => (
            <div key={i}>👻 <em>{w.fromDisplayName}:</em> {w.text}</div>
          ))}
        </div>
      )}

      <canvas
        ref={canvasRef}
        width={BOARD_PX}
        height={BOARD_PX}
        onClick={canvasClick}
        style={{
          width: "100%", maxWidth: 480, aspectRatio: "1", display: "block", margin: "0 auto",
          background: "#0d1418", borderRadius: 8, border: "2px solid #1f3142",
          touchAction: "manipulation", cursor: canAct ? "crosshair" : "default",
        }}
      />

      {targetCell && canAct && (
        <div style={{ fontSize: 12, color: "#a89e8b", textAlign: "center", marginTop: 6 }}>
          Selected: ({targetCell.x}, {targetCell.y})
        </div>
      )}

      {/* WHALE actions */}
      {isWhale && phase === "moving" && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 4 }}>
            {([
              ["deep_dive", "Deep Dive (4)"],
              ["bubble_move", "Bubble (3)"],
              ["breach", "Breach (2)"],
            ] as const).map(([k, label]) => (
              <button key={k} className={`btn-secondary ${whaleMoveKind === k ? "locked" : ""}`}
                      style={{ flex: 1, padding: "8px 4px", fontSize: 12 }}
                      onClick={() => setWhaleMoveKind(k)}>{label}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button className="btn-secondary" style={{ flex: 1, padding: 8 }} onClick={submitWhaleMove} disabled={!targetCell}>
              Move
            </button>
            <button className="btn-secondary" style={{ flex: 1, padding: 8 }} onClick={submitWhaleRam} disabled={!targetCell}>
              Ram (2 dmg)
            </button>
            <button className="btn-secondary" style={{ flex: 1, padding: 8 }} onClick={submitSurpriseBreach} disabled={!targetCell}>
              Surprise (1)
            </button>
          </div>
          <button className="btn-secondary" style={{ padding: 6, fontSize: 12 }} onClick={() => whaleAct("pass")}>
            Pass turn
          </button>
        </div>
      )}

      {/* WHALER actions */}
      {isWhaler && (phase === "moving" || phase === "tow") && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {/* Move kind toggle */}
          <div style={{ display: "flex", gap: 4 }}>
            <button className={`btn-secondary ${moveKind === "slow_crawl" ? "locked" : ""}`}
                    style={{ flex: 1, padding: 6, fontSize: 12 }}
                    onClick={() => setMoveKind("slow_crawl")}>Slow Crawl (1)</button>
            <button className={`btn-secondary ${moveKind === "full_sail" ? "locked" : ""}`}
                    style={{ flex: 1, padding: 6, fontSize: 12 }}
                    disabled={recoiled || isTowing}
                    onClick={() => setMoveKind("full_sail")}>Full Sail (3)</button>
          </div>

          <div style={{ display: "flex", gap: 4 }}>
            <button className="btn-secondary" style={{ flex: 1, padding: 8 }} onClick={submitShipMove} disabled={!targetCell}>
              Move
            </button>
            <button className="btn-secondary" style={{ flex: 1, padding: 8 }}
                    onClick={submitFireCannons} disabled={!targetCell || isTowing}>
              Fire ({cannonSide})
            </button>
          </div>

          <div style={{ display: "flex", gap: 4 }}>
            <button className={`btn-secondary ${cannonSide === "port" ? "locked" : ""}`}
                    style={{ flex: 1, padding: 6, fontSize: 11 }}
                    onClick={() => setCannonSide("port")}>← Port</button>
            <button className={`btn-secondary ${cannonSide === "starboard" ? "locked" : ""}`}
                    style={{ flex: 1, padding: 6, fontSize: 11 }}
                    onClick={() => setCannonSide("starboard")}>Starboard →</button>
          </div>

          {/* Repair (in harbor zone) */}
          {inHarborZone && !isTowing && (
            <button className="btn-secondary" style={{ padding: 8, background: "#1B5E40", borderColor: "#4ADE80" }}
                    onClick={() => shipAct("repair")}>
              ⚓ Repair (full HP)
            </button>
          )}

          {/* Phase 2: harpoon corpse + tow controls */}
          {whale?.dead && !isTowing && (
            <button className="btn-secondary" style={{ padding: 8 }} onClick={() => shipAct("harpoon_corpse")}>
              🪝 Harpoon Corpse
            </button>
          )}
          {isTowing && (
            <button className="btn-secondary" style={{ padding: 8 }} onClick={() => shipAct("cut_line")}>
              ✂️ Cut Line
            </button>
          )}

          <button className="btn-secondary" style={{ padding: 6, fontSize: 12 }} onClick={() => shipAct("pass")}>
            Pass turn
          </button>
        </div>
      )}

      {/* GHOST actions */}
      {isGhost && (phase === "moving" || phase === "tow") && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12, color: "#a89e8b", textAlign: "center" }}>
            👻 Spectral. God-view active. 1 Kraken summon + 1 whisper / turn.
          </div>
          <button className="btn-secondary" style={{ padding: 8 }} onClick={submitKraken}
                  disabled={!targetCell || !!myShip?.krakenUsed}>
            🦑 Summon Kraken {myShip?.krakenUsed ? "(used)" : "(here)"}
          </button>

          <div style={{ background: "#1f3142", padding: 6, borderRadius: 4 }}>
            <div style={{ fontSize: 11, color: "#a89e8b", marginBottom: 4 }}>WHISPER TO ALLY</div>
            <select value={whisperTo} onChange={e => setWhisperTo(e.target.value)}
                    style={{ width: "100%", padding: 4, background: "#0d1418", color: "#e8dcb8", border: "1px solid #5e5852", borderRadius: 4, marginBottom: 4 }}>
              <option value="">Pick a living ally…</option>
              {ships.filter((s: any) => !s.sunk).map((s: any) => (
                <option key={s.guestId} value={s.guestId}>{s.displayName} ({s.shipName})</option>
              ))}
            </select>
            <input type="text" value={whisperText} onChange={e => setWhisperText(e.target.value)}
                   placeholder="Whisper text…"
                   style={{ width: "100%", padding: 4, background: "#0d1418", color: "#e8dcb8", border: "1px solid #5e5852", borderRadius: 4, marginBottom: 4 }} />
            <button className="btn-secondary" style={{ padding: 6, fontSize: 12, width: "100%" }}
                    onClick={submitWhisper}
                    disabled={!whisperTo || !whisperText.trim() || (myShip?.whispersThisTurn ?? 0) >= 1}>
              Send Whisper
            </button>
          </div>

          <button className="btn-secondary" style={{ padding: 6, fontSize: 12 }} onClick={() => shipAct("pass")}>
            Pass
          </button>
        </div>
      )}

      {amSpectator && <div style={{ marginTop: 12, padding: 12, background: "#1f3142", borderRadius: 8, textAlign: "center", color: "#a89e8b" }}>Spectating</div>}

      {isHost && (phase === "moving" || phase === "tow") && (
        <button className="lets-go-btn" style={{ marginTop: 12 }} onClick={resolveTurn}>
          Resolve Turn (Host)
        </button>
      )}

      {/* Scoreboard */}
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 11, color: "#a89e8b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Players</div>
        {scores.map((s: any) => {
          const isMe = s.guestId === guestId;
          const ship = ships.find((sh: any) => sh.guestId === s.guestId);
          const status = s.role === "whale"
            ? (whale?.dead ? "💀 dead" : `🐋 ${whale?.wounds ?? 0}/${whale?.hp ?? 5}`)
            : (ship?.sunk ? "👻 sunk" : `⛵ ${ship?.hp ?? 0}/3`);
          return (
            <div key={s.guestId} style={{
              display: "flex", justifyContent: "space-between", padding: "3px 8px",
              background: isMe ? "#3d6a82" : "transparent", borderRadius: 4, fontSize: 12,
            }}>
              <span>{s.displayName}{isMe ? " (you)" : ""}</span>
              <span style={{ color: "#a89e8b" }}>{status}</span>
            </div>
          );
        })}
      </div>

      {showRules && <RulesCard onClose={() => setShowRules(false)} role={myRole} />}

      <CutScene scene={cutScene} onDone={() => setCutScene(null)} />

      {/* Always-visible floating "?" button while in-game */}
      <button
        onClick={() => setShowRules(true)}
        aria-label="Show rules"
        style={{
          position: "fixed", right: 14, bottom: 14, zIndex: 50,
          width: 44, height: 44, borderRadius: "50%",
          background: "#1f3142", color: "#d9a649",
          border: "2px solid #d9a649", fontSize: 22, fontWeight: 700,
          cursor: "pointer", boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        }}>?</button>
    </div>
  );
}

// ─── Rules card (used in both lobby + in-game pull-up) ──────────────────
function RulesCard({ onClose, role = "whaler" }: { onClose: () => void; role?: string }) {
  const isWhaleRole = role === "whale";
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(13,20,24,0.85)",
      zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center",
      padding: 12,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        maxWidth: 520, maxHeight: "92vh", overflowY: "auto",
        background: "#1f3142", border: "2px solid #d9a649", borderRadius: 8,
        padding: 16, color: "#e8dcb8", fontSize: 13, lineHeight: 1.5,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h2 style={{ fontFamily: "var(--font-display)", letterSpacing: "0.05em", margin: 0, color: "#d9a649" }}>WHALABROAD — HOW TO PLAY</h2>
          <button onClick={onClose} className="btn-secondary" style={{ padding: "4px 10px" }}>Close</button>
        </div>

        <p style={{ color: "#a89e8b", marginBottom: 8 }}>
          One player is the white whale. The rest are whalers. Whalers cooperate to wound the whale,
          then race to tow its corpse to harbor. Whale wins if every ship is sunk.
        </p>

        <h3 style={{ color: "#d9a649", fontSize: 14, marginTop: 12, marginBottom: 4 }}>Win conditions</h3>
        <ul style={{ paddingLeft: 18, marginTop: 0 }}>
          <li><strong>Whale</strong>: sink every ship.</li>
          <li><strong>Whaler</strong>: be the ship that tows the corpse to the harbor.</li>
        </ul>

        <h3 style={{ color: "#d9a649", fontSize: 14, marginTop: 12, marginBottom: 4 }}>
          {isWhaleRole ? "🐋 Whale actions" : "⛵ Whaler actions"}
        </h3>
        {isWhaleRole ? (
          <ul style={{ paddingLeft: 18, marginTop: 0 }}>
            <li><strong>Deep Dive</strong> — 4 hidden tiles, no hint.</li>
            <li><strong>Bubble Move</strong> — 3 hidden tiles, BUT a hint zone is shown to whalers. Once per submerged stretch.</li>
            <li><strong>Breach</strong> — 2 surface tiles. Counts toward the surface-min.</li>
            <li><strong>Ram Strike</strong> — surfaced; move 2 + 2 dmg to ships in path.</li>
            <li><strong>Surprise Breach</strong> — rise from underwater + 1 dmg to adjacent ship.</li>
          </ul>
        ) : (
          <ul style={{ paddingLeft: 18, marginTop: 0 }}>
            <li><strong>Slow Crawl</strong> — 1 tile + can fire same turn.</li>
            <li><strong>Full Sail</strong> — 3 tiles, no fire.</li>
            <li><strong>Fire Cannons</strong> — broadside (port/starboard), perpendicular to facing, 3 tiles, 1 dmg, applies recoil (1-tile move next turn).</li>
            <li><strong>Repair</strong> — within 2 tiles of harbor; full HP restore.</li>
            <li><strong>Harpoon Corpse</strong> — adjacent to dead whale; attaches tow line. Towing forces slow-crawl + no fire.</li>
            <li><strong>Cut Line</strong> — free action, drops the corpse you were towing.</li>
          </ul>
        )}

        <h3 style={{ color: "#d9a649", fontSize: 14, marginTop: 12, marginBottom: 4 }}>Key rules</h3>
        <ul style={{ paddingLeft: 18, marginTop: 0 }}>
          <li>The whale must surface at least <strong>2 of every 5</strong> turns. Max 3 submerged turns in a row.</li>
          <li><strong>Pre-kill</strong>: whaler cannons can ONLY hit the whale. Forced cooperation.</li>
          <li><strong>Post-kill</strong>: PvP opens. Cannons can hit rival ships AND the tow line (rivals shoot the line to detach).</li>
          <li><strong>Sunk ships become ghosts</strong>: full god-view of the whale + ONE Kraken summon (3×3 splash + push) + ONE whisper to a living ally per turn.</li>
          <li><strong>Storm at turn 20</strong>: outer ring (N/E/W) becomes impassable. Harbor approach is preserved.</li>
          <li><strong>The whale cannot enter harbor cells</strong> — shallow water rule.</li>
        </ul>

        <h3 style={{ color: "#d9a649", fontSize: 14, marginTop: 12, marginBottom: 4 }}>Damage</h3>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <tbody>
            {[
              ["Whale Ram Strike (surface)", "2"],
              ["Whale Surprise Breach", "1"],
              ["Ship cannon hit", "1"],
              ["Kraken splash", "1 + 1-tile push outward"],
            ].map(([label, val], i) => (
              <tr key={i} style={{ borderBottom: "1px solid #2c4a5e" }}>
                <td style={{ padding: "4px 6px" }}>{label}</td>
                <td style={{ padding: "4px 6px", textAlign: "right", color: "#d9a649" }}>{val}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
