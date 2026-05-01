import { useState, useEffect, useRef } from "react";
import { socket } from "../ws";
import { haptic } from "../haptics";
import PodiumScreen from "../components/PodiumScreen";

// First-pass v1: placeholder visuals (colored cells + emoji) so we get a
// playable end-to-end loop on the tablet. Real atlas sprites wire in next.

interface Props { guestId: string; roomId: string; isHost: boolean; gameState: any; }

const BOARD_PX = 480; // logical canvas size

// Mirror the server's octagon clip so the client paints the same shape.
function inOctagon(x: number, y: number, size: number): boolean {
  if (x < 0 || y < 0 || x >= size || y >= size) return false;
  const cut = 3;
  if (x + y < cut) return false;
  if (x + (size - 1 - y) < cut) return false;
  if ((size - 1 - x) + y < cut) return false;
  if ((size - 1 - x) + (size - 1 - y) < cut) return false;
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

export default function WhalabroadGame({ guestId, roomId, isHost, gameState }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedAction, setSelectedAction] = useState<string>("move");
  const [moveDir, setMoveDir] = useState<{ dx: number; dy: number } | null>(null);
  const [moveSteps, setMoveSteps] = useState<number>(1);
  const [targetCell, setTargetCell] = useState<{ x: number; y: number } | null>(null);

  const phase: string = gameState?.phase ?? "lobby";
  const boardSize: number = gameState?.boardSize ?? 12;
  const islands: Array<[number, number]> = gameState?.islands ?? [];
  const harbor: Array<[number, number]> = gameState?.harbor ?? [];
  const whale = gameState?.whale ?? null;
  const ships: any[] = gameState?.ships ?? [];
  const turnIndex: number = gameState?.turnIndex ?? 0;
  const totalTurnsLimit: number = gameState?.totalTurnsLimit ?? 30;
  const taunt: string | null = gameState?.taunt ?? null;
  const scores: any[] = gameState?.scores ?? [];
  const whaleVolunteers: string[] = gameState?.whaleVolunteers ?? [];

  const myShip = ships.find((s: any) => s.guestId === guestId);
  const isWhale = whale && whale.guestId === guestId;
  const isWhaler = !!myShip;
  const amSpectator = !isWhale && !isWhaler;

  // ─── Canvas painter ───────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cellPx = BOARD_PX / boardSize;
    ctx.clearRect(0, 0, BOARD_PX, BOARD_PX);

    // Board cells
    for (let y = 0; y < boardSize; y++) {
      for (let x = 0; x < boardSize; x++) {
        if (!inOctagon(x, y, boardSize)) continue;
        const isHarbor = harbor.some(([hx, hy]) => hx === x && hy === y);
        const isIsland = islands.some(([ix, iy]) => ix === x && iy === y);
        ctx.fillStyle = isHarbor ? "#5c4429" : isIsland ? "#7d7567" : "#162230";
        ctx.fillRect(x * cellPx, y * cellPx, cellPx, cellPx);
        ctx.strokeStyle = "rgba(255,255,255,0.06)";
        ctx.strokeRect(x * cellPx, y * cellPx, cellPx, cellPx);
      }
    }

    // Whale hint zone (bubbles) when underwater
    if (whale && !whale.surfaced && !whale.dead) {
      // server sends fogged x=-1, y=-1 to non-whale players. The whale player
      // gets the real coords. Either way render a 3-cell hint zone if we have
      // something usable. Skip rendering if both are -1 (fully fogged for now).
      if (whale.x >= 0 && whale.y >= 0) {
        // Whale player's own view — show real position
        ctx.fillStyle = "rgba(216,231,238,0.85)";
        ctx.beginPath();
        ctx.arc(whale.x * cellPx + cellPx / 2, whale.y * cellPx + cellPx / 2, cellPx * 0.32, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#0d1418";
        ctx.font = `${cellPx * 0.5}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🐋", whale.x * cellPx + cellPx / 2, whale.y * cellPx + cellPx / 2);
      }
    }

    // Surfaced or dead whale — visible to everyone
    if (whale && (whale.surfaced || whale.dead) && whale.x >= 0 && whale.y >= 0) {
      const px = whale.x * cellPx + cellPx / 2;
      const py = whale.y * cellPx + cellPx / 2;
      ctx.fillStyle = whale.dead ? "#7d7567" : "#dbe7ee";
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
        ctx.font = `${cellPx * 0.22}px sans-serif`;
        ctx.fillText("✦".repeat(whale.wounds), px, py + cellPx * 0.32);
      }
    }

    // Ships
    for (const s of ships) {
      const px = s.x * cellPx + cellPx / 2;
      const py = s.y * cellPx + cellPx / 2;
      ctx.fillStyle = SHIP_HEX[s.color] ?? "#86643c";
      ctx.fillRect(px - cellPx * 0.36, py - cellPx * 0.36, cellPx * 0.72, cellPx * 0.72);
      ctx.strokeStyle = s.sunk ? "#5a1a10" : "#e8dcb8";
      ctx.lineWidth = 2;
      ctx.strokeRect(px - cellPx * 0.36, py - cellPx * 0.36, cellPx * 0.72, cellPx * 0.72);
      ctx.fillStyle = "#fff";
      ctx.font = `${cellPx * 0.5}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(s.sunk ? "💥" : "⛵", px, py);
      // HP bar
      if (!s.sunk) {
        const barW = cellPx * 0.6;
        const fillW = (s.hp / 3) * barW;
        ctx.fillStyle = "#5a1a10";
        ctx.fillRect(px - barW / 2, py + cellPx * 0.34, barW, 3);
        ctx.fillStyle = "#4ade80";
        ctx.fillRect(px - barW / 2, py + cellPx * 0.34, fillW, 3);
      }
    }

    // Highlight target cell
    if (targetCell && phase === "moving") {
      ctx.strokeStyle = "#d9a649";
      ctx.lineWidth = 3;
      ctx.strokeRect(targetCell.x * cellPx, targetCell.y * cellPx, cellPx, cellPx);
    }
  }, [boardSize, islands, harbor, whale, ships, targetCell, phase]);

  function canvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (phase !== "moving") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const cellPx = rect.width / boardSize;
    const x = Math.floor(cx / cellPx);
    const y = Math.floor(cy / cellPx);
    if (!inOctagon(x, y, boardSize)) return;
    haptic.tap();
    setTargetCell({ x, y });
  }

  // ─── Action senders ──────────────────────────────────────────────────────
  function send(action: string, payload: any = {}) {
    socket.send({ type: "game:action", guestId, roomId, action, payload } as any);
  }
  function volunteerWhale() { haptic.tap(); send("whalabroad:volunteer_whale"); }
  function unvolunteerWhale() { haptic.tap(); send("whalabroad:unvolunteer_whale"); }
  function commitLobby()    { haptic.tap(); send("whalabroad:commit_lobby"); }
  function resolveTurn()    { haptic.heavy(); send("whalabroad:resolve_turn"); }

  function submitWhaleAction(kind: string, extra: any = {}) {
    haptic.tap();
    send("whalabroad:whale_action", { kind, ...extra });
  }
  function submitShipAction(kind: string, extra: any = {}) {
    haptic.tap();
    send("whalabroad:ship_action", { kind, ...extra });
  }

  function submitMoveTo() {
    if (!targetCell) return;
    const myPos = isWhale ? whale : myShip;
    if (!myPos || myPos.x === undefined) return;
    const dx = Math.sign(targetCell.x - myPos.x);
    const dy = Math.sign(targetCell.y - myPos.y);
    const steps = Math.max(Math.abs(targetCell.x - myPos.x), Math.abs(targetCell.y - myPos.y));
    if (steps === 0) return;
    if (isWhale) submitWhaleAction("move", { dx, dy, steps: Math.min(steps, 2) });
    else if (isWhaler) submitShipAction("move", { dx, dy, steps: Math.min(steps, 2) });
    setTargetCell(null);
  }

  function submitHarpoonAt() {
    if (!targetCell || !isWhaler) return;
    submitShipAction("harpoon", { targetX: targetCell.x, targetY: targetCell.y });
    setTargetCell(null);
  }

  function submitRamAt() {
    if (!targetCell) return;
    if (isWhale) {
      // Whale ram targets a ship at this cell.
      const target = ships.find((s: any) => s.x === targetCell.x && s.y === targetCell.y && !s.sunk);
      if (target) submitWhaleAction("ram", { targetGuestId: target.guestId });
    } else if (isWhaler) {
      submitShipAction("ram", { targetX: targetCell.x, targetY: targetCell.y });
    }
    setTargetCell(null);
  }

  // ─── Render: Lobby ────────────────────────────────────────────────────────
  if (phase === "lobby") {
    const iVolunteered = whaleVolunteers.includes(guestId);
    return (
      <div style={{ padding: 16, color: "#e8dcb8", textAlign: "center" }}>
        <h1 style={{ fontFamily: "var(--font-display)", letterSpacing: "0.05em" }}>WHALABROAD</h1>
        <p style={{ color: "#a89e8b", marginBottom: 16 }}>One player is the white whale. The rest are whalers.</p>

        <div style={{ background: "#1f3142", padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 14, color: "#a89e8b", marginBottom: 8 }}>
            VOLUNTEERS FOR WHALE ({whaleVolunteers.length})
          </div>
          {whaleVolunteers.length === 0 && <div style={{ color: "#7d7567" }}>No one yet — random pick if no one volunteers</div>}
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
          <button className="lets-go-btn" onClick={commitLobby} disabled={scores.length < 3}>
            START GAME ({scores.length} players)
          </button>
        )}
        {scores.length < 3 && <p style={{ color: "#fc8181", fontSize: 12, marginTop: 8 }}>Need at least 3 players (1 whale + 2 whalers)</p>}
      </div>
    );
  }

  // ─── Render: Game over ────────────────────────────────────────────────────
  if (phase === "game_over") {
    const podiumScores = scores.map((s: any) => ({
      guestId: s.guestId,
      displayName: s.displayName + (s.role === "whale" ? " 🐋" : " ⛵"),
      score: s.score,
    }));
    return <PodiumScreen scores={podiumScores as any} guestId={guestId} roomId={roomId} isHost={isHost} />;
  }

  // ─── Render: In game (moving / resolving / tow) ───────────────────────────
  const myRole = isWhale ? "whale" : isWhaler ? "whaler" : "spectator";
  const canAct = phase === "moving" && (isWhale || isWhaler);

  return (
    <div style={{ padding: 12, color: "#e8dcb8" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontWeight: 700 }}>Turn {turnIndex} / {totalTurnsLimit}</span>
        <span style={{ fontSize: 13, color: "#a89e8b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {myRole}
        </span>
      </div>

      {taunt && (
        <div style={{ fontStyle: "italic", color: "#a89e8b", fontSize: 13, marginBottom: 8, textAlign: "center" }}>
          "{taunt}"
        </div>
      )}

      <canvas
        ref={canvasRef}
        width={BOARD_PX}
        height={BOARD_PX}
        onClick={canvasClick}
        style={{
          width: "100%",
          maxWidth: 480,
          aspectRatio: "1",
          display: "block",
          margin: "0 auto",
          background: "#0d1418",
          borderRadius: 8,
          border: "2px solid #1f3142",
          touchAction: "manipulation",
          cursor: canAct ? "crosshair" : "default",
        }}
      />

      {targetCell && canAct && (
        <div style={{ fontSize: 13, color: "#a89e8b", textAlign: "center", marginTop: 6 }}>
          Selected: ({targetCell.x}, {targetCell.y})
        </div>
      )}

      {/* Action buttons */}
      {canAct && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
            <button className="btn-secondary" style={{ flex: 1, padding: "10px 8px" }}
                    onClick={submitMoveTo} disabled={!targetCell}>
              Move {targetCell ? `→ (${targetCell.x},${targetCell.y})` : ""}
            </button>
            {isWhale && (
              <>
                <button className="btn-secondary" style={{ flex: 1, padding: "10px 8px" }}
                        onClick={() => submitWhaleAction(whale?.surfaced ? "dive" : "surface")}>
                  {whale?.surfaced ? "Dive" : "Surface"}
                </button>
                <button className="btn-secondary" style={{ flex: 1, padding: "10px 8px" }}
                        onClick={submitRamAt} disabled={!targetCell || !whale?.surfaced}>
                  Ram
                </button>
              </>
            )}
            {isWhaler && (
              <>
                <button className="btn-secondary" style={{ flex: 1, padding: "10px 8px" }}
                        onClick={submitHarpoonAt} disabled={!targetCell}>
                  Harpoon
                </button>
                <button className="btn-secondary" style={{ flex: 1, padding: "10px 8px" }}
                        onClick={submitRamAt} disabled={!targetCell}>
                  Ram
                </button>
              </>
            )}
          </div>

          {isWhaler && whale?.dead && (
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn-secondary" style={{ flex: 1, padding: "10px 8px" }}
                      onClick={() => submitShipAction("tow")}>
                Tow Carcass
              </button>
              <button className="btn-secondary" style={{ flex: 1, padding: "10px 8px" }}
                      onClick={() => submitShipAction("release")}>
                Release Tow
              </button>
            </div>
          )}

          <button className="btn-secondary" style={{ padding: "8px" }}
                  onClick={() => isWhale ? submitWhaleAction("pass") : submitShipAction("pass")}>
            Pass turn
          </button>
        </div>
      )}

      {amSpectator && (
        <div style={{ marginTop: 12, padding: 12, background: "#1f3142", borderRadius: 8, textAlign: "center", color: "#a89e8b" }}>
          Spectating
        </div>
      )}

      {isHost && phase === "moving" && (
        <button className="lets-go-btn" style={{ marginTop: 16 }} onClick={resolveTurn}>
          Resolve Turn (Host)
        </button>
      )}

      {/* Scoreboard */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 12, color: "#a89e8b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
          Players
        </div>
        {scores.map((s: any) => {
          const isMe = s.guestId === guestId;
          return (
            <div key={s.guestId} style={{
              display: "flex", justifyContent: "space-between", padding: "4px 8px",
              background: isMe ? "#3d6a82" : "transparent", borderRadius: 4, fontSize: 13,
            }}>
              <span>{s.role === "whale" ? "🐋" : "⛵"} {s.displayName}{isMe ? " (you)" : ""}</span>
              <span style={{ color: "#a89e8b" }}>{s.score}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
