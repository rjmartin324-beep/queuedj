import { useState, useEffect, useRef } from "react";
import { socket } from "../ws";
import { haptic } from "../haptics";
import PodiumScreen from "../components/PodiumScreen";
import TimerBar from "../components/TimerBar";
import HostMenu from "../components/HostMenu";
import CutScene from "../components/CutScene";

interface Props { guestId: string; roomId: string; isHost: boolean; gameState: any; }

export default function GuessimateGame({ guestId, roomId, isHost, gameState }: Props) {
  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { phase, question, scores, questionIndex, totalQuestions, deadline, timeLimit, guesses } = gameState ?? {};

  useEffect(() => { setInput(""); setSubmitted(false); }, [questionIndex]);

  // Cutscenes
  const [cutScene, setCutScene] = useState<{ name: string; seq: number } | null>(null);
  const cutSeqRef = useRef(0);
  const prevPhaseRef = useRef<string | null>(null);
  const prevScoreRef = useRef<number>(0);
  function showCutScene(name: string) { setCutScene({ name, seq: ++cutSeqRef.current }); }
  useEffect(() => {
    if (!gameState) return;
    if (phase !== prevPhaseRef.current) {
      prevPhaseRef.current = phase;
      if (phase === "question" && questionIndex === totalQuestions - 1) {
        showCutScene("LAST GUESS");
      }
      if (phase === "reveal") {
        const myScore = scores?.find((s: any) => s.guestId === guestId)?.score ?? 0;
        const delta = myScore - prevScoreRef.current;
        prevScoreRef.current = myScore;
        if (delta >= 950) showCutScene("BULLSEYE");
        else if (delta >= 800) showCutScene("DEAD ON");
        else if (delta < 100) showCutScene("WAY OFF");
      }
      if (phase === "game_over") {
        const sorted = [...(scores ?? [])].sort((a: any, b: any) => b.score - a.score);
        if (sorted[0]?.guestId === guestId) showCutScene("WINNER");
      }
    }
  }, [phase]);

  function submit() {
    const n = parseFloat(input.replace(/,/g, ""));
    if (isNaN(n)) return;
    haptic.lock();
    setSubmitted(true);
    socket.send({ type: "game:action", guestId, roomId, action: "guess:submit", payload: { guess: n } } as any);
  }

  function next() { socket.send({ type: "host:next_question", guestId, roomId } as any); }

  if (phase === "game_over") return <PodiumScreen scores={scores} guestId={guestId} roomId={roomId} isHost={isHost} />;

  if (phase === "countdown") {
    return (
      <div className="game-loading">
        <div className="loading-spinner" />
        <p style={{ color: "var(--text-muted)", marginTop: 12 }}>Get ready… {questionIndex + 1} / {totalQuestions}</p>
      </div>
    );
  }

  const myGuess = guesses?.[guestId];
  const answeredCount = guesses ? Object.keys(guesses).length : 0;
  const totalPlayers = scores?.length ?? 0;

  return (
    <div className="trivia-game">
      <HostMenu guestId={guestId} roomId={roomId} isHost={isHost} phase={phase} />
      <CutScene scene={cutScene} onDone={() => setCutScene(null)} />
      <div className="trivia-header">
        <span className="q-progress">Q {questionIndex + 1}/{totalQuestions}</span>
        <span className="answered-count">{answeredCount}/{totalPlayers} ✓</span>
      </div>

      {phase === "question" && question && (
        <>
          <div className="answer-section">
            <TimerBar deadline={deadline} timeLimit={timeLimit} onExpire={isHost ? next : undefined} />
          </div>
          <div className="question-card" style={{ flex: 1 }}>
            <div className="question-category cat-general-knowledge">GUESSTIMATE</div>
            <div className="question-text">{question.question}</div>
          </div>

          <div className="guess-input-wrap">
            {!submitted ? (
              <>
                <input
                  className="guess-input"
                  type="number"
                  inputMode="numeric"
                  placeholder={`Your answer${question.unit ? " (" + question.unit + ")" : ""}`}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && submit()}
                  autoFocus
                />
                <button className="lets-go-btn" disabled={!input.trim()} onClick={submit}>Lock In →</button>
              </>
            ) : (
              <div className="guess-locked-msg">🔒 Locked in — {input} {question.unit}</div>
            )}
          </div>
        </>
      )}

      {phase === "reveal" && question && (
        <div style={{ padding: "24px 20px", flex: 1, overflowY: "auto" }}>
          <div className="question-card" style={{ marginBottom: 20 }}>
            <div className="question-text">{question.question}</div>
            <div className="guess-reveal-answer">✓ {question.answer.toLocaleString()} {question.unit}</div>
          </div>

          <div className="guess-results-list">
            {[...scores].sort((a: any, b: any) => {
              const ag = guesses?.[a.guestId] ?? null;
              const bg = guesses?.[b.guestId] ?? null;
              if (ag === null) return 1;
              if (bg === null) return -1;
              return Math.abs(ag - question.answer) - Math.abs(bg - question.answer);
            }).map((s: any, i: number) => {
              const g = guesses?.[s.guestId];
              const off = g !== undefined ? Math.abs(g - question.answer) : null;
              const pct = off !== null && question.answer !== 0 ? Math.round(off / Math.abs(question.answer) * 100) : null;
              return (
                <div key={s.guestId} className={`guess-result-row ${s.guestId === guestId ? "is-me" : ""}`}>
                  <span className="guess-rank">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i+1}`}</span>
                  <span className="guess-name">{s.displayName}</span>
                  <span className="guess-value">{g !== undefined ? g.toLocaleString() : "—"}</span>
                  {pct !== null && <span className={`guess-off ${pct === 0 ? "perfect" : pct < 20 ? "close" : "far"}`}>{pct === 0 ? "EXACT!" : `${pct}% off`}</span>}
                </div>
              );
            })}
          </div>

          {isHost && (
            <div className="host-controls">
              <button className="next-btn" onClick={next}>{questionIndex + 1 >= totalQuestions ? "See Final Scores →" : "Next Question →"}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
