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
  const [cutScene, setCutScene] = useState<{ name: string; seq: number; tier?: "banner" | "overlay" | "peak" } | null>(null);
  const cutSeqRef = useRef(0);
  const prevPhaseRef = useRef<string | null>(null);
  const prevScoreRef = useRef<number>(0);
  const bullseyeStreakRef = useRef(0);
  const wayoffStreakRef = useRef(0);
  const shownThisGameRef = useRef<Set<string>>(new Set());
  function showCutScene(name: string, tier: "banner" | "overlay" | "peak" = "overlay") {
    if (tier === "peak" && shownThisGameRef.current.has(name)) return;
    if (tier === "peak") shownThisGameRef.current.add(name);
    setCutScene({ name, seq: ++cutSeqRef.current, tier });
  }
  useEffect(() => {
    if (!gameState) return;
    if (phase !== prevPhaseRef.current) {
      prevPhaseRef.current = phase;
      if (phase === "question" && questionIndex === totalQuestions - 1) {
        showCutScene("LAST GUESS", "banner");
      }
      if (phase === "reveal") {
        const myScore = scores?.find((s: any) => s.guestId === guestId)?.score ?? 0;
        const delta = myScore - prevScoreRef.current;
        prevScoreRef.current = myScore;
        // Streak tracking
        if (delta >= 950) { bullseyeStreakRef.current += 1; wayoffStreakRef.current = 0; }
        else if (delta < 100) { bullseyeStreakRef.current = 0; wayoffStreakRef.current += 1; }
        else { bullseyeStreakRef.current = 0; wayoffStreakRef.current = 0; }
        // Streak callouts — peak tier first (rarer), then overlay, then banner
        if (bullseyeStreakRef.current === 8) { showCutScene("NUMERICAL GENIUS", "peak"); return; }
        if (bullseyeStreakRef.current === 5) { showCutScene("ORACLE", "overlay"); return; }
        if (bullseyeStreakRef.current === 3) { showCutScene("SHARPSHOOTER", "banner"); return; }
        if (wayoffStreakRef.current === 3) { showCutScene("WAY OFF AGAIN", "banner"); return; }
        // Default per-question callouts
        if (delta >= 950) showCutScene("BULLSEYE", "overlay");
        else if (delta >= 800) showCutScene("DEAD ON", "banner");
        else if (delta < 100) showCutScene("WAY OFF", "banner");
      }
      if (phase === "game_over") {
        const sorted = [...(scores ?? [])].sort((a: any, b: any) => b.score - a.score);
        if (sorted[0]?.guestId === guestId) showCutScene("WINNER", "overlay");
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
    <div className="guess-game">
      <HostMenu guestId={guestId} roomId={roomId} isHost={isHost} phase={phase} />
      <CutScene scene={cutScene} onDone={() => setCutScene(null)} />

      {/* Terminal-style flagship header */}
      <div className="guess-flagship-header">
        <div className="guess-flagship-eyebrow">UNIT {String(questionIndex + 1).padStart(2, "0")} / {String(totalQuestions).padStart(2, "0")} :: TERMINAL ACTIVE</div>
        <div className="guess-flagship-title">guesstimate</div>
        <div className="guess-flagship-meta">
          <span className="guess-flagship-readout">{answeredCount}/{totalPlayers} LOCKED</span>
        </div>
      </div>

      {phase === "question" && question && (
        <>
          <div className="answer-section">
            <TimerBar deadline={deadline} timeLimit={timeLimit} onExpire={isHost ? next : undefined} />
          </div>
          <div className="guess-lcd-panel">
            <div className="guess-lcd-prompt">{question.question}</div>
            {question.unit && <div className="guess-lcd-unit">UNIT :: {question.unit.toUpperCase()}</div>}
          </div>

          <div className="guess-input-wrap guess-input-wrap-flagship">
            {!submitted ? (
              <>
                <input
                  className="guess-input guess-input-flagship"
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && submit()}
                  autoFocus
                />
                <button className="lets-go-btn guess-submit-flagship" disabled={!input.trim()} onClick={submit}>LOCK IN ▸</button>
              </>
            ) : (
              <div className="guess-locked-flagship">
                <span className="guess-locked-eyebrow">LOCKED</span>
                <span className="guess-locked-value">{input}</span>
                {question.unit && <span className="guess-locked-unit">{question.unit}</span>}
              </div>
            )}
          </div>
        </>
      )}

      {phase === "reveal" && question && (
        <div className="guess-reveal-flagship">
          <div className="guess-lcd-panel">
            <div className="guess-lcd-prompt">{question.question}</div>
          </div>
          <div className="guess-answer-readout">
            <span className="guess-answer-eyebrow">CORRECT ANSWER</span>
            <span className="guess-answer-value">{question.answer.toLocaleString()}</span>
            {question.unit && <span className="guess-answer-unit">{question.unit}</span>}
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
