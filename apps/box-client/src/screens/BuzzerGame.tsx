import { useState, useEffect, useRef } from "react";
import { socket } from "../ws";
import { haptic } from "../haptics";
import PodiumScreen from "../components/PodiumScreen";
import TimerBar from "../components/TimerBar";
import HostMenu from "../components/HostMenu";
import CutScene from "../components/CutScene";

interface Props { guestId: string; roomId: string; isHost: boolean; gameState: any; }

const COLORS = { a: "#8B1A1A", b: "#0F3460", c: "#6B4800", d: "#0A3D1F" };

export default function BuzzerGame({ guestId, roomId, isHost, gameState }: Props) {
  const { phase, question, scores, questionIndex, totalQuestions, deadline, timeLimit,
          buzzedBy, lockedOut, correctAnswer } = gameState ?? {};
  const [myAnswer, setMyAnswer] = useState<string | null>(null);
  const [cutScene, setCutScene] = useState<{ name: string; seq: number } | null>(null);
  const cutSeqRef = useRef(0);
  const prevPhaseRef = useRef<string | null>(null);
  const prevBuzzedRef = useRef<string | null>(null);

  function showCutScene(name: string) { setCutScene({ name, seq: ++cutSeqRef.current }); }

  useEffect(() => { setMyAnswer(null); }, [questionIndex]);

  // Cutscene triggers
  useEffect(() => {
    if (!gameState) return;
    if (phase === prevPhaseRef.current && buzzedBy === prevBuzzedRef.current) return;
    if (phase === "buzzed" && buzzedBy && buzzedBy !== prevBuzzedRef.current) {
      const name = scores?.find((s: any) => s.guestId === buzzedBy)?.displayName ?? "?";
      showCutScene(`⚡ ${name.toUpperCase()}!`);
    }
    if (phase === "reveal" && prevPhaseRef.current === "buzzed") {
      // Was the buzzer right or wrong?
      const last = scores?.find((s: any) => s.guestId === prevBuzzedRef.current);
      if (last) {
        // Score went up = right; flat or down = wrong
        showCutScene(correctAnswer && myAnswer === correctAnswer ? "DING DING DING" : "WHIFF");
      }
    }
    if (phase === "game_over") {
      const sorted = [...(scores ?? [])].sort((a: any, b: any) => b.score - a.score);
      if (sorted[0]?.guestId === guestId) showCutScene("WINNER");
    }
    if (questionIndex === totalQuestions - 1 && phase === "question") {
      showCutScene("FINAL QUESTION");
    }
    prevPhaseRef.current = phase ?? null;
    prevBuzzedRef.current = buzzedBy ?? null;
  }, [phase, buzzedBy, questionIndex]);

  function buzz() {
    haptic.heavy();
    socket.send({ type: "game:action", guestId, roomId, action: "buzz:buzz", payload: {} } as any);
  }

  function answer(a: string) {
    haptic.lock();
    setMyAnswer(a);
    socket.send({ type: "game:action", guestId, roomId, action: "buzz:answer", payload: { answer: a } } as any);
  }

  function next() { socket.send({ type: "host:next_question", guestId, roomId } as any); }

  if (phase === "game_over") return <PodiumScreen scores={scores} guestId={guestId} roomId={roomId} isHost={isHost} />;

  if (phase === "countdown") {
    return <div className="game-loading"><div className="loading-spinner" /><p style={{ color: "var(--text-muted)", marginTop: 12 }}>Q {questionIndex + 1} / {totalQuestions}</p></div>;
  }

  const isBuzzedPlayer = buzzedBy === guestId;
  const isLockedOut = lockedOut?.includes(guestId);
  const canBuzz = phase === "question" && !isLockedOut;

  return (
    <div className="trivia-game">
      <HostMenu guestId={guestId} roomId={roomId} isHost={isHost} phase={phase} />
      <CutScene scene={cutScene} onDone={() => setCutScene(null)} />
      <div className="trivia-header">
        <span className="q-progress">Q {questionIndex + 1}/{totalQuestions}</span>
        <span className="round-badge">BUZZER</span>
      </div>

      {question && (
        <div className="question-card">
          <div className="question-text" style={{ fontSize: "clamp(1.2rem,4.5vw,1.8rem)" }}>{question.question}</div>
        </div>
      )}

      <div className="answer-section">
        {phase === "question" && <TimerBar deadline={deadline} timeLimit={timeLimit} onExpire={isHost ? () => socket.send({ type: "host:end_round", guestId, roomId } as any) : undefined} />}

        {phase === "question" && (
          <div className="buzzer-zone">
            {canBuzz ? (
              <button className="buzz-btn" onClick={buzz}>BUZZ!</button>
            ) : (
              <div className="buzz-locked">🔒 Locked out</div>
            )}
            {buzzedBy && <div className="buzz-status">{scores?.find((s: any) => s.guestId === buzzedBy)?.displayName} buzzed!</div>}
          </div>
        )}

        {phase === "buzzed" && (
          <div className="buzzer-answer-zone">
            {isBuzzedPlayer ? (
              <>
                <div className="buzz-your-turn">⚡ YOU BUZZED — ANSWER!</div>
                <div className="answer-grid">
                  {(["a","b","c","d"] as const).map((k) => (
                    <button key={k} className={`answer-square sq-${k}`}
                      style={{ background: COLORS[k] }}
                      disabled={!!myAnswer}
                      onClick={() => answer(k)}>
                      <span className="answer-text">{question?.[k]}</span>
                      <span className="answer-letter">{k.toUpperCase()}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="buzz-watching">
                <div className="buzz-status">{scores?.find((s: any) => s.guestId === buzzedBy)?.displayName} is answering…</div>
              </div>
            )}
          </div>
        )}

        {phase === "reveal" && question && (
          <div className="reveal-overlay">
            <div className="reveal-result correct">
              <span className="reveal-icon">✓</span>
              <span>Correct answer: <strong>{correctAnswer?.toUpperCase()}</strong> — {question[correctAnswer]}</span>
            </div>
            <div style={{ marginTop: 16 }}>
              {scores?.map((s: any, i: number) => (
                <div key={s.guestId} className={`scoreboard-row ${s.guestId === guestId ? "is-me" : ""}`} style={{ marginBottom: 8 }}>
                  <span className="scoreboard-rank">#{i+1}</span>
                  <span className="scoreboard-name">{s.displayName}</span>
                  <span className="scoreboard-score">{s.score.toLocaleString()}</span>
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
