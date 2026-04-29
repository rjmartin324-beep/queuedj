import { useEffect, useRef, useState } from "react";
import { socket } from "../ws";
import { haptic } from "../haptics";
import PodiumScreen from "../components/PodiumScreen";
import HostMenu from "../components/HostMenu";
import CutScene from "../components/CutScene";

interface Props { guestId: string; roomId: string; isHost: boolean; gameState: any; }

export default function TheDraftGame({ guestId, roomId, isHost, gameState }: Props) {
  const { phase, scenario, availableItems, draftOrder, currentPick, scores } = gameState ?? {};
  const [customText, setCustomText] = useState("");

  function pick(itemId: string) {
    haptic.heavy();
    socket.send({ type: "game:action", guestId, roomId, action: "draft:pick", payload: { itemId } } as any);
  }

  function pickCustom() {
    const name = customText.trim();
    if (name.length === 0) return;
    haptic.heavy();
    socket.send({ type: "game:action", guestId, roomId, action: "draft:custom_pick", payload: { name } } as any);
    setCustomText("");
  }

  function endGame() { socket.send({ type: "host:next_question", guestId, roomId } as any); }

  // Cutscenes
  const [cutScene, setCutScene] = useState<{ name: string; seq: number } | null>(null);
  const cutSeqRef = useRef(0);
  const prevPhaseRef = useRef<string | null>(null);
  function showCutScene(name: string) { setCutScene({ name, seq: ++cutSeqRef.current }); }
  useEffect(() => {
    if (!gameState) return;
    if (phase !== prevPhaseRef.current) {
      prevPhaseRef.current = phase;
      if (phase === "reveal") showCutScene("BIG REVEAL");
      if (phase === "game_over") {
        const sorted = [...(scores ?? [])].sort((a: any, b: any) => b.score - a.score);
        if (sorted[0]?.guestId === guestId) showCutScene("DRAFT KING");
      }
    }
  }, [phase]);

  if (phase === "game_over") return <PodiumScreen scores={scores} guestId={guestId} roomId={roomId} isHost={isHost} />;

  const currentPickerId = draftOrder?.[currentPick];
  const isMyTurn = currentPickerId === guestId;
  const myPicks = scores?.find((s: any) => s.guestId === guestId)?.picks ?? [];

  return (
    <div className="trivia-game" style={{ padding: "0 0 32px" }}>
      <HostMenu guestId={guestId} roomId={roomId} isHost={isHost} phase={phase} />
      <CutScene scene={cutScene} onDone={() => setCutScene(null)} />
      <div className="trivia-header">
        <span className="q-progress">THE DRAFT</span>
        {phase === "drafting" && <span className="round-badge">Pick {currentPick + 1}/{draftOrder?.length}</span>}
      </div>

      {scenario && (
        <div className="draft-marquee">
          <div className="draft-marquee-eyebrow">THE DRAFT</div>
          <div className="draft-marquee-title">{scenario.title}</div>
          <div className="draft-marquee-sub">{scenario.subtitle}</div>
        </div>
      )}

      {phase === "drafting" && (
        <>
          <div className="draft-status">
            {isMyTurn ? (
              <>
                <div className="draft-on-the-clock">ON THE CLOCK</div>
                <div className="draft-on-the-clock-sub">No timer. Take your time. Talk it out.</div>
              </>
            ) : (
              <div className="draft-waiting">
                Waiting on <strong>{scores?.find((s: any) => s.guestId === currentPickerId)?.displayName ?? "…"}</strong>
              </div>
            )}
          </div>

          <div className="draft-grid">
            {(availableItems ?? []).map((item: any) => (
              <button key={item.id}
                className={`draft-item ${isMyTurn ? "draft-item-available" : ""}`}
                disabled={!isMyTurn}
                onClick={() => pick(item.id)}>
                <span className="draft-item-name">{item.name}</span>
              </button>
            ))}
          </div>

          {isMyTurn && (
            <div className="draft-custom-row">
              <input
                type="text"
                className="draft-custom-input"
                placeholder="Or type your own pick…"
                value={customText}
                onChange={e => setCustomText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") pickCustom(); }}
                maxLength={40}
              />
              <button
                className="draft-custom-submit"
                disabled={customText.trim().length === 0}
                onClick={pickCustom}>
                Draft It
              </button>
            </div>
          )}

          {myPicks.length > 0 && (
            <div className="draft-mypicks">
              <div className="draft-mypicks-label">YOUR PICKS · {myPicks.length}</div>
              <div className="draft-mypicks-row">
                {myPicks.map((p: any) => (
                  <div key={p.id} className={`draft-mypick-chip ${p.id?.startsWith?.("custom-") ? "draft-mypick-chip-custom" : ""}`}>
                    {p.name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {phase === "reveal" && (
        <div className="draft-reveal">
          <div className="draft-reveal-header">HIDDEN RATINGS REVEALED</div>
          {[...scores].sort((a: any, b: any) => b.score - a.score).map((s: any, i: number) => (
            <div key={s.guestId} className={`draft-reveal-card ${s.guestId === guestId ? "draft-reveal-card-me" : ""}`}>
              <div className="draft-reveal-card-head">
                <span className={`draft-reveal-rank ${i === 0 ? "draft-reveal-rank-top" : ""}`}>#{i+1}</span>
                <span className="draft-reveal-name">{s.displayName}</span>
                <span className="draft-reveal-total">{s.score}</span>
              </div>
              <div className="draft-reveal-picks">
                {s.picks?.map((p: any) => (
                  <div key={p.id} className={`draft-reveal-pick ${p.id?.startsWith?.("custom-") ? "draft-reveal-pick-custom" : ""}`}>
                    <span className="draft-reveal-pick-name">{p.name}</span>
                    <span className="draft-reveal-pick-val">{p.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {isHost && <div className="host-controls" style={{ marginTop: 16 }}><button className="next-btn" onClick={endGame}>See Final Scores →</button></div>}
        </div>
      )}
    </div>
  );
}
