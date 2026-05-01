import { useState, useEffect, useRef } from "react";
import { socket } from "../ws";
import { haptic } from "../haptics";
import PodiumScreen from "../components/PodiumScreen";

// Full-spec Whalabroad client. Visuals are still placeholder (colored cells +
// emoji) so we can play-test mechanics first; atlas sprite rendering wires
// in next iteration.

interface Props { guestId: string; roomId: string; isHost: boolean; gameState: any; }

const BOARD_PX = 480;
const BOARD_SIZE = 12;

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

    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        if (!inOctagon(x, y, ringScale)) continue;
        const isHarbor = harbor.some(([hx, hy]) => hx === x && hy === y);
        const isIsland = islands.some(([ix, iy]) => ix === x && iy === y);
        const isStorm = stormActive && stormCells.some(([sx, sy]) => sx === x && sy === y);
        ctx.fillStyle = isStorm ? "#3a3a3a" :
                        isHarbor ? "#5c4429" :
                        isIsland ? "#7d7567" : "#162230";
        ctx.fillRect(x * cellPx, y * cellPx, cellPx, cellPx);
        if (isStorm) {
          // Storm cross-hatch
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
      ctx.fillStyle = whale.dead ? "#7d7567" : (whale.surfaced ? "#dbe7ee" : "rgba(216,231,238,0.55)");
      ctx.beginPath();
      ctx.arc(px, py, cellPx * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0d1418";
      ctx.font = `${cellPx * 0.6}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(whale.dead ? "💀" : "🐋", px, py);
      // Wound count
      if (whale.wounds > 0 && !whale.dead) {
        ctx.fillStyle = "#7a2c1f";
        ctx.font = `${cellPx * 0.18}px sans-serif`;
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
      ctx.fillStyle = SHIP_HEX[s.color] ?? "#86643c";
      const sz = cellPx * (s.sunk ? 0.5 : 0.72);
      ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
      ctx.strokeStyle = s.sunk ? "#5a1a10" : "#e8dcb8";
      ctx.lineWidth = 2;
      ctx.strokeRect(px - sz / 2, py - sz / 2, sz, sz);
      ctx.fillStyle = "#fff";
      ctx.font = `${cellPx * 0.5}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(s.sunk ? "👻" : "⛵", px, py);
      // HP bar
      if (!s.sunk) {
        const barW = cellPx * 0.6;
        const fillW = (s.hp / 3) * barW;
        ctx.fillStyle = "#5a1a10";
        ctx.fillRect(px - barW / 2, py + cellPx * 0.34, barW, 3);
        ctx.fillStyle = "#4ade80";
        ctx.fillRect(px - barW / 2, py + cellPx * 0.34, fillW, 3);
      }
      // Facing tick
      if (!s.sunk) {
        const fa = (s.facing * 45 - 90) * Math.PI / 180;
        const tx = px + Math.cos(fa) * cellPx * 0.42;
        const ty = py + Math.sin(fa) * cellPx * 0.42;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(tx, ty);
        ctx.stroke();
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
  }, [ringScale, islands, harbor, stormCells, stormActive, whale, ships, targetCell, phase, isWhale, isGhost, isWhaler, actionMode, cannonSide, myShip]);

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

  function whaleAct(kind: string, extra: any = {}) { haptic.tap(); send("whalabroad:whale_action", { kind, ...extra }); setTargetCell(null); setActionMode("idle"); }
  function shipAct(kind: string, extra: any = {})  { haptic.tap(); send("whalabroad:ship_action",  { kind, ...extra }); setTargetCell(null); setActionMode("idle"); }

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
        <p style={{ color: "#a89e8b", marginBottom: 16 }}>1 whale vs 2-7 ships. Frenemy + race.</p>

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
    </div>
  );
}
