import { useState, useEffect, useRef } from "react";
import { socket } from "../ws";
import { haptic } from "../haptics";
import PodiumScreen from "../components/PodiumScreen";
import HostMenu from "../components/HostMenu";
import CutScene from "../components/CutScene";

interface Props { guestId: string; roomId: string; isHost: boolean; gameState: any; }

const COLOR_LABELS = { yellow: "⭐ Easy", green: "🟢 Medium", blue: "🔵 Hard", purple: "🟣 Expert" };
const COLOR_BG = { yellow: "#7B6B00", green: "#1A5C2A", blue: "#0A3060", purple: "#4B1A7B" };
const COLOR_BORDER = { yellow: "#F5C842", green: "#4ADE80", blue: "#60A5FA", purple: "#A78BFA" };

export default function ConnectionsGame({ guestId, roomId, isHost, gameState }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [shake, setShake] = useState(false);
  const [cutScene, setCutScene] = useState<{ name: string; seq: number } | null>(null);
  const cutSeqRef = useRef(0);
  const prevFoundRef = useRef<number>(0);
  const prevPhaseRef = useRef<string | null>(null);
  function showCutScene(name: string) { setCutScene({ name, seq: ++cutSeqRef.current }); }
  const { phase, tiles, puzzle, players, scores } = gameState ?? {};

  const myPlayer = players?.[guestId];
  const foundColors: string[] = myPlayer?.found ?? [];
  const attemptsLeft = 4 - (myPlayer?.attempts ?? 0);

  useEffect(() => {
    return socket.on((msg: any) => {
      if (msg.type === "game:event" && msg.event === "conn:result") {
        if (!msg.payload.correct) {
          setShake(true);
          setTimeout(() => setShake(false), 500);
          haptic.wrong();
          setSelected([]);
          showCutScene("WRONG GROUP");
        } else {
          haptic.correct();
          setSelected([]);
          // Color-tier callout — purple is the trickiest
          if (msg.payload.color === "purple") showCutScene("EXPERT GROUP");
          else if (msg.payload.color === "blue") showCutScene("HARD GROUP");
        }
      }
    });
  }, []);

  // Phase + foundCount cutscenes
  useEffect(() => {
    if (!gameState) return;
    const found = (players?.[guestId]?.found ?? []).length;
    if (found === 4 && prevFoundRef.current !== 4) showCutScene("PUZZLE SOLVED");
    else if (found === 3 && prevFoundRef.current !== 3) showCutScene("ONE MORE");
    prevFoundRef.current = found;

    if (phase !== prevPhaseRef.current) {
      prevPhaseRef.current = phase;
      if (phase === "game_over") {
        const sorted = [...(scores ?? [])].sort((a: any, b: any) => b.score - a.score);
        if (sorted[0]?.guestId === guestId) showCutScene("WINNER");
      }
    }
  }, [players, phase]);

  function toggleTile(tile: string) {
    if (myPlayer?.done || foundColors.length === 4) return;
    haptic.tap();
    setSelected(s => s.includes(tile) ? s.filter(x => x !== tile) : s.length < 4 ? [...s, tile] : s);
  }

  function submitGroup() {
    if (selected.length !== 4) return;
    haptic.lock();
    socket.send({ type: "game:action", guestId, roomId, action: "conn:submit", payload: { tiles: selected } } as any);
  }

  function reveal() { socket.send({ type: "game:action", guestId, roomId, action: "conn:reveal", payload: {} } as any); }
  function endGame() { socket.send({ type: "host:next_question", guestId, roomId } as any); }

  if (phase === "game_over") return <PodiumScreen scores={scores} guestId={guestId} roomId={roomId} isHost={isHost} />;

  const isReveal = phase === "reveal";
  const allTiles: string[] = tiles ?? [];
  const remainingTiles = isReveal ? [] : allTiles.filter(t => {
    if (!puzzle) return true;
    return !puzzle.groups.some((g: any) => foundColors.includes(g.color) && g.items.includes(t));
  });

  return (
    <div className="trivia-game" style={{ padding: "0 0 24px" }}>
      <HostMenu guestId={guestId} roomId={roomId} isHost={isHost} phase={phase} />
      <CutScene scene={cutScene} onDone={() => setCutScene(null)} />
      <div className="trivia-header">
        <span className="q-progress">CONNECTIONS</span>
        <span className="answered-count">{attemptsLeft} attempts left</span>
      </div>

      <div style={{ padding: "8px 16px", fontSize: "0.8rem", color: "var(--text-muted)", textAlign: "center" }}>
        Find 4 groups of 4. Tap tiles, then submit.
      </div>

      {/* Found groups */}
      {foundColors.map(color => {
        const group = puzzle?.groups?.find((g: any) => g.color === color);
        if (!group) return null;
        return (
          <div key={color} className="conn-found-group" style={{ background: COLOR_BG[color as keyof typeof COLOR_BG], borderColor: COLOR_BORDER[color as keyof typeof COLOR_BORDER] }}>
            <div className="conn-group-label">{COLOR_LABELS[color as keyof typeof COLOR_LABELS]}: {group.category}</div>
            <div className="conn-group-items">{group.items.join(" · ")}</div>
          </div>
        );
      })}

      {/* Tile grid */}
      {!isReveal && (
        <>
          <div className="conn-grid">
            {remainingTiles.map(tile => (
              <button key={tile}
                className={`conn-tile ${selected.includes(tile) ? "conn-tile-selected" : ""} ${shake && selected.includes(tile) ? "conn-tile-shake" : ""}`}
                onClick={() => toggleTile(tile)}>
                {tile}
              </button>
            ))}
          </div>
          <div className="conn-selected-count">
            <strong>{selected.length}</strong> / 4 selected
          </div>
        </>
      )}

      {!isReveal && selected.length === 4 && !myPlayer?.done && (
        <div style={{ padding: "0 16px" }}>
          <button className="lets-go-btn" onClick={submitGroup}>Submit Group</button>
        </div>
      )}

      {/* Reveal: show all groups */}
      {isReveal && puzzle?.groups?.map((group: any) => (
        <div key={group.color} className="conn-found-group" style={{ background: COLOR_BG[group.color as keyof typeof COLOR_BG], borderColor: COLOR_BORDER[group.color as keyof typeof COLOR_BORDER] }}>
          <div className="conn-group-label">{COLOR_LABELS[group.color as keyof typeof COLOR_LABELS]}: {group.category}</div>
          <div className="conn-group-items">{group.items.join(" · ")}</div>
        </div>
      ))}

      {isReveal && (
        <div style={{ padding: "16px" }}>
          {scores?.map((s: any, i: number) => (
            <div key={s.guestId} className={`scoreboard-row ${s.guestId === guestId ? "is-me" : ""}`} style={{ marginBottom: 8 }}>
              <span className="scoreboard-rank">#{i+1}</span>
              <span className="scoreboard-name">{s.displayName}</span>
              <span className="scoreboard-score">{s.score}</span>
            </div>
          ))}
          {isHost && <div className="host-controls" style={{ marginTop: 16 }}><button className="next-btn" onClick={endGame}>See Final Scores →</button></div>}
        </div>
      )}

      {!isReveal && isHost && (
        <div style={{ padding: "16px" }}>
          <button className="btn-secondary" style={{ width: "100%" }} onClick={reveal}>Force Reveal</button>
        </div>
      )}
    </div>
  );
}
