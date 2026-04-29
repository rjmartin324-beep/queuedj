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
  const [cutScene, setCutScene] = useState<{ name: string; seq: number } | null>(null);
  const cutSeqRef = useRef(0);
  const prevPhaseRef = useRef<string | null>(null);
  function showCutScene(name: string) { setCutScene({ name, seq: ++cutSeqRef.current }); }
  useEffect(() => {
    if (!gameState) return;
    if (phase === prevPhaseRef.current) return;
    prevPhaseRef.current = phase;
    if (phase === "question" && questionIndex === totalQuestions - 1) {
      showCutScene("FINAL RANKING");
    }
    if (phase === "reveal") {
      const mySub: string[] | undefined = submissions?.[guestId];
      const correct: string[] | undefined = challenge?.correct;
      if (mySub && correct) {
        const exact = mySub.length === correct.length && mySub.every((x, i) => x === correct[i]);
        if (exact) showCutScene("PERFECT ORDER");
      }
    }
    if (phase === "game_over") {
      const sorted = [...(scores ?? [])].sort((a: any, b: any) => b.score - a.score);
      if (sorted[0]?.guestId === guestId) showCutScene("WINNER");
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

  return (
    <div className="trivia-game">
      <HostMenu guestId={guestId} roomId={roomId} isHost={isHost} phase={phase} />
      <CutScene scene={cutScene} onDone={() => setCutScene(null)} />
      <div className="trivia-header">
        <span className="q-progress">Q {questionIndex + 1}/{totalQuestions}</span>
        <span className="round-badge">RANK IT</span>
        <span className="answered-count">{answeredCount}/{totalPlayers} ✓</span>
      </div>

      {challenge && (
        <div className="question-card">
          <div className="question-category cat-general-knowledge">RANK IT</div>
          <div className="question-text">{challenge.question}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 8 }}>
            {!submitted && !isReveal ? "Tap items in order — first tap = #1" : ""}
          </div>
        </div>
      )}

      <div className="answer-section">
        {phase === "question" && <TimerBar deadline={deadline} timeLimit={timeLimit} onExpire={isHost ? () => socket.send({ type: "host:end_round", guestId, roomId } as any) : undefined} />}

        <div className="rankit-grid">
          {items.map(item => {
            const pos = order.indexOf(item);
            const hasPos = pos !== -1;
            const correctPos = isReveal ? challenge.correct.indexOf(item) : -1;
            const myPos = order.indexOf(item);
            const correct = isReveal && myPos !== -1 && challenge.correct[myPos] === item;

            return (
              <button key={item}
                className={`rankit-item ${hasPos && !isReveal ? "rankit-selected" : ""} ${isReveal && correct ? "rankit-correct" : ""} ${isReveal && myPos !== -1 && !correct ? "rankit-wrong" : ""}`}
                onClick={() => !isReveal && tap(item)}
                disabled={submitted || isReveal}>
                {hasPos && !isReveal && <span className="rankit-pos-badge">{pos + 1}</span>}
                {isReveal && <span className="rankit-pos-badge">{correctPos + 1}</span>}
                <span className="rankit-item-name">{item}</span>
              </button>
            );
          })}
        </div>

        {!isReveal && submitted && (
          <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "12px 0", fontSize: "0.9rem" }}>
            🔒 Locked in: {order.join(" → ")}
          </div>
        )}

        {isReveal && challenge && (
          <div className="reveal-overlay">
            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", textAlign: "center", marginBottom: 8 }}>Correct order:</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 16 }}>
              {challenge.correct.map((item: string, i: number) => (
                <div key={item} style={{ background: "var(--surface)", borderRadius: 8, padding: "6px 12px", fontSize: "0.85rem" }}>
                  <span style={{ color: "var(--accent)", fontWeight: 700 }}>{i + 1}.</span> {item}
                </div>
              ))}
            </div>
            {isHost && <div className="host-controls"><button className="next-btn" onClick={next}>{questionIndex + 1 >= totalQuestions ? "See Final Scores →" : "Next →"}</button></div>}
          </div>
        )}
      </div>
    </div>
  );
}
