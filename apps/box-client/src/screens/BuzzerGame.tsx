import { useState, useEffect, useRef } from "react";
import { socket } from "../ws";
import { haptic } from "../haptics";
import PodiumScreen from "../components/PodiumScreen";
import TimerBar from "../components/TimerBar";
import HostMenu from "../components/HostMenu";
import CutScene from "../components/CutScene";

interface Props { guestId: string; roomId: string; isHost: boolean; gameState: any; }

export default function BuzzerGame({ guestId, roomId, isHost, gameState }: Props) {
  const { phase, question, scores, questionIndex, totalQuestions, deadline, timeLimit,
          buzzedBy, lockedOut, correctAnswer } = gameState ?? {};
  const [myAnswer, setMyAnswer] = useState<string | null>(null);
  const [cutScene, setCutScene] = useState<{ name: string; seq: number; tier?: "banner" | "overlay" | "peak" } | null>(null);
  const cutSeqRef = useRef(0);
  const prevPhaseRef = useRef<string | null>(null);
  const prevBuzzedRef = useRef<string | null>(null);
  // Streak tracking — buzz-correct chain
  const buzzStreakRef = useRef(0);
  const whiffStreakRef = useRef(0);
  const shownThisRoundRef = useRef<Set<string>>(new Set());
  const shownThisGameRef = useRef<Set<string>>(new Set());

  function showCutScene(name: string, tier: "banner" | "overlay" | "peak" = "overlay") {
    if (tier === "overlay" && shownThisRoundRef.current.has(name)) return;
    if (tier === "peak" && shownThisGameRef.current.has(name)) return;
    if (tier === "overlay") shownThisRoundRef.current.add(name);
    if (tier === "peak") shownThisGameRef.current.add(name);
    setCutScene({ name, seq: ++cutSeqRef.current, tier });
  }

  useEffect(() => { setMyAnswer(null); }, [questionIndex]);

  // Cutscene triggers
  useEffect(() => {
    if (!gameState) return;
    if (phase === prevPhaseRef.current && buzzedBy === prevBuzzedRef.current) return;
    if (phase === "buzzed" && buzzedBy && buzzedBy !== prevBuzzedRef.current) {
      const name = scores?.find((s: any) => s.guestId === buzzedBy)?.displayName ?? "?";
      showCutScene(`⚡ ${name.toUpperCase()}!`, "banner");
    }
    if (phase === "reveal" && prevPhaseRef.current === "buzzed") {
      // Was the buzzer right or wrong?
      const last = scores?.find((s: any) => s.guestId === prevBuzzedRef.current);
      if (last) {
        const iWasBuzzer = prevBuzzedRef.current === guestId;
        const gotIt = correctAnswer && myAnswer === correctAnswer;
        // Track streaks ONLY for the player who buzzed (resets if you whiff or someone else buzzed)
        if (iWasBuzzer) {
          if (gotIt) { buzzStreakRef.current += 1; whiffStreakRef.current = 0; }
          else { buzzStreakRef.current = 0; whiffStreakRef.current += 1; }
        } else if (last && gotIt === false) {
          // Someone else whiffed; doesn't affect MY streaks
        }
        // Streak callouts (only fires on my own buzzes, by design)
        if (iWasBuzzer && buzzStreakRef.current === 8) { showCutScene("BUZZ MASTER", "peak"); return; }
        if (iWasBuzzer && buzzStreakRef.current === 5) { showCutScene("KING OF THE BUZZER", "overlay"); return; }
        if (iWasBuzzer && buzzStreakRef.current === 3) { showCutScene("ON THE BUZZER", "banner"); return; }
        if (iWasBuzzer && whiffStreakRef.current === 3) { showCutScene("BUZZ HAPPY", "banner"); return; }
        // Default reveal callout
        showCutScene(gotIt ? "DING DING DING" : "WHIFF", gotIt ? "overlay" : "banner");
      }
    }
    if (phase === "game_over") {
      const sorted = [...(scores ?? [])].sort((a: any, b: any) => b.score - a.score);
      if (sorted[0]?.guestId === guestId) showCutScene("WINNER");
    }
    if (questionIndex === totalQuestions - 1 && phase === "question") {
      showCutScene("FINAL QUESTION", "banner");
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
    <div className="trivia-game buzzer-game">
      <HostMenu guestId={guestId} roomId={roomId} isHost={isHost} phase={phase} />
      <CutScene scene={cutScene} onDone={() => setCutScene(null)} />

      {/* Flagship arena header — red lights instead of purple/gold */}
      <div className="trivia-flagship-header buzzer-flagship-header">
        <div className="trivia-flagship-bulbs trivia-flagship-bulbs-top" aria-hidden>
          {Array.from({ length: 14 }).map((_, i) => <span key={i} className="trivia-flagship-bulb" style={{ animationDelay: `${i * 0.12}s` }} />)}
        </div>
        <div className="trivia-flagship-row">
          <span className="trivia-flagship-q">Q {questionIndex + 1}<span className="trivia-flagship-q-of">/{totalQuestions}</span></span>
          <span className="trivia-flagship-title">BUZZER ROUND</span>
          <span className="trivia-flagship-answered">{scores?.length ?? 0} IN</span>
        </div>
        <div className="trivia-flagship-bulbs trivia-flagship-bulbs-bottom" aria-hidden>
          {Array.from({ length: 14 }).map((_, i) => <span key={i} className="trivia-flagship-bulb" style={{ animationDelay: `${(13 - i) * 0.12}s` }} />)}
        </div>
      </div>

      {question && (
        <div className="question-card question-card-flagship" key={`q-${questionIndex}`}>
          <div className="question-spotlight" aria-hidden />
          <div className="question-text">{question.question}</div>
        </div>
      )}

      <div className="answer-section">
        {phase === "question" && <TimerBar deadline={deadline} timeLimit={timeLimit} onExpire={isHost ? () => socket.send({ type: "host:end_round", guestId, roomId } as any) : undefined} />}

        {phase === "question" && (
          <div className="buzzer-zone">
            {canBuzz ? (
              <button className="buzz-btn buzz-btn-flagship" onClick={buzz}>
                <span className="buzz-btn-ring" aria-hidden />
                <span className="buzz-btn-label">BUZZ</span>
              </button>
            ) : (
              <div className="buzz-locked buzz-locked-flagship">
                <span className="buzz-locked-eyebrow">LOCKED OUT</span>
                <span className="buzz-locked-sub">Wait for the next question</span>
              </div>
            )}
            {buzzedBy && (
              <div className="buzz-status buzz-status-flagship">
                <strong>{scores?.find((s: any) => s.guestId === buzzedBy)?.displayName}</strong> hit it first
              </div>
            )}
          </div>
        )}

        {phase === "buzzed" && (
          <div className="buzzer-answer-zone">
            {isBuzzedPlayer ? (
              <>
                <div className="buzz-your-turn buzz-your-turn-flagship">
                  <span className="buzz-your-turn-eyebrow">ON THE SPOT</span>
                  <span className="buzz-your-turn-title">PICK YOUR ANSWER</span>
                </div>
                <div className="answer-grid">
                  {(["a","b","c","d"] as const).map((k) => (
                    <button key={k} className={`answer-square sq-${k}`}
                      disabled={!!myAnswer}
                      onClick={() => answer(k)}>
                      <span className="answer-letter">{k.toUpperCase()}</span>
                      <span className="answer-text">{question?.[k]}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="buzz-watching buzz-watching-flagship">
                <span className="buzz-watching-eyebrow">ON THE CLOCK</span>
                <span className="buzz-watching-name">{scores?.find((s: any) => s.guestId === buzzedBy)?.displayName ?? "…"}</span>
                <span className="buzz-watching-sub">answering now</span>
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
