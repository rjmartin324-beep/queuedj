import { useState, useEffect, useRef } from "react";
import { socket } from "../ws";
import { haptic } from "../haptics";
import PodiumScreen from "../components/PodiumScreen";
import TimerBar from "../components/TimerBar";
import HostMenu from "../components/HostMenu";
import CutScene from "../components/CutScene";

interface Props { guestId: string; roomId: string; isHost: boolean; gameState: any; }

export default function RankItGame({ guestId, roomId, isHost, gameState }: Props) {
  const [order, setOrder] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const { phase, challenge, scores, questionIndex, totalQuestions, deadline, timeLimit, submissions } = gameState ?? {};

  useEffect(() => { setOrder([]); setSubmitted(false); }, [questionIndex]);

  // Cutscenes
  const [cutScene, setCutScene] = useState<{ name: string; seq: number; tier?: "banner" | "overlay" | "peak" } | null>(null);
  const cutSeqRef = useRef(0);
  const prevPhaseRef = useRef<string | null>(null);
  function showCutScene(name: string, tier: "banner" | "overlay" | "peak" = "overlay") { setCutScene({ name, seq: ++cutSeqRef.current, tier }); }
  useEffect(() => {
    if (!gameState) return;
    if (phase === prevPhaseRef.current) return;
    prevPhaseRef.current = phase;
    if (phase === "question" && questionIndex === totalQuestions - 1) {
      showCutScene("FINAL RANKING", "banner");
    }
    if (phase === "reveal") {
      const mySub: string[] | undefined = submissions?.[guestId];
      const correct: string[] | undefined = challenge?.correct;
      if (mySub && correct) {
        const exact = mySub.length === correct.length && mySub.every((x, i) => x === correct[i]);
        if (exact) showCutScene("PERFECT ORDER", "peak");
      }
    }
    if (phase === "game_over") {
      const sorted = [...(scores ?? [])].sort((a: any, b: any) => b.score - a.score);
      if (sorted[0]?.guestId === guestId) showCutScene("WINNER", "overlay");
    }
  }, [phase]);

  function tap(item: string) {
    if (submitted) return;
    if (order.includes(item)) {
      haptic.tap();
      setOrder(o => o.filter(x => x !== item));
    } else {
      haptic.tap();
      setOrder(o => [...o, item]);
      if (order.length + 1 === (challenge?.items?.length ?? 4)) {
        const finalOrder = [...order, item];
        setSubmitted(true);
        haptic.lock();
        socket.send({ type: "game:action", guestId, roomId, action: "rank:submit", payload: { order: finalOrder } } as any);
      }
    }
  }

  function next() { socket.send({ type: "host:next_question", guestId, roomId } as any); }

  if (phase === "game_over") return <PodiumScreen scores={scores} guestId={guestId} roomId={roomId} isHost={isHost} />;

  if (phase === "countdown") {
    return <div className="game-loading"><div className="loading-spinner" /><p style={{ color: "var(--text-muted)", marginTop: 12 }}>Q {questionIndex + 1} / {totalQuestions}</p></div>;
  }

  const isReveal = phase === "reveal";
  const answeredCount = submissions ? Object.keys(submissions).length : 0;
  const totalPlayers = scores?.length ?? 0;
  const items: string[] = challenge?.items ?? [];

  // Pool = items not yet placed in order
  const pool: string[] = items.filter(it => !order.includes(it));
  const totalSlots = items.length;
  const correctOrder: string[] = challenge?.correct ?? [];

  return (
    <div className="rankit-game">
      <HostMenu guestId={guestId} roomId={roomId} isHost={isHost} phase={phase} />
      <CutScene scene={cutScene} onDone={() => setCutScene(null)} />

      {/* Late-show chyron header */}
      <div className="rankit-flagship-header">
        <div className="rankit-flagship-eyebrow">CHALLENGE №{String(questionIndex + 1).padStart(2, "0")} OF {String(totalQuestions).padStart(2, "0")} · LIVE</div>
        <div className="rankit-flagship-title">RANK IT</div>
        <div className="rankit-flagship-meta">
          <span className="rankit-flagship-bulb" />
          <span>{answeredCount}/{totalPlayers} LOCKED</span>
        </div>
      </div>

      {challenge && (
        <div className="rankit-prompt-panel">
          <div className="rankit-prompt-eyebrow">RANK THESE BY</div>
          <div className="rankit-prompt-text">{challenge.question}</div>
        </div>
      )}

      {phase === "question" && <TimerBar deadline={deadline} timeLimit={timeLimit} onExpire={isHost ? () => socket.send({ type: "host:end_round", guestId, roomId } as any) : undefined} />}

      {/* RANKED SLOTS — fills top-down as items get tapped */}
      {!isReveal && (
        <div className="rankit-slots">
          {Array.from({ length: totalSlots }).map((_, i) => {
            const placed = order[i];
            return (
              <button
                key={i}
                className={`rankit-slot ${placed ? "rankit-slot-filled" : ""}`}
                onClick={() => placed && !submitted && setOrder(o => o.filter(x => x !== placed))}
                disabled={!placed || submitted}>
                <span className="rankit-slot-num">#{i + 1}</span>
                <span className="rankit-slot-content">
                  {placed ?? <span className="rankit-slot-empty">— empty —</span>}
                </span>
                {placed && !submitted && <span className="rankit-slot-remove">✕</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* ITEM POOL — tap to place into next available slot */}
      {!isReveal && pool.length > 0 && (
        <div className="rankit-pool-section">
          <div className="rankit-pool-label">TAP TO RANK ({pool.length} LEFT)</div>
          <div className="rankit-pool">
            {pool.map(item => (
              <button key={item}
                className="rankit-pool-item"
                onClick={() => !submitted && tap(item)}
                disabled={submitted}>
                {item}
              </button>
            ))}
          </div>
        </div>
      )}

      {!isReveal && submitted && (
        <div className="rankit-locked">
          <span className="rankit-locked-eyebrow">BALLOT LOCKED</span>
          <span className="rankit-locked-sub">Waiting for the rest of the room…</span>
        </div>
      )}

      {/* REVEAL — slot machine: positions reveal top-down */}
      {isReveal && challenge && (
        <div className="rankit-reveal">
          <div className="rankit-reveal-eyebrow">THE OFFICIAL RANKING</div>
          <div className="rankit-reveal-list">
            {correctOrder.map((item: string, i: number) => {
              const myItem = submissions?.[guestId]?.[i];
              const correct = myItem === item;
              return (
                <div
                  key={item}
                  className={`rankit-reveal-row ${correct ? "rankit-reveal-correct" : myItem ? "rankit-reveal-wrong" : "rankit-reveal-missed"}`}
                  style={{ animationDelay: `${i * 0.18}s` }}>
                  <span className="rankit-reveal-num">#{i + 1}</span>
                  <span className="rankit-reveal-name">{item}</span>
                  <span className="rankit-reveal-status">
                    {correct ? "+250" : myItem ? `you: ${myItem}` : "—"}
                  </span>
                </div>
              );
            })}
          </div>
          {isHost && (
            <div className="host-controls" style={{ marginTop: 16 }}>
              <button className="next-btn" onClick={next}>
                {questionIndex + 1 >= totalQuestions ? "See Final Scores →" : "Next →"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
