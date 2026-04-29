import { useEffect, useRef, useState } from "react";
import { socket } from "../ws";
import { playSound } from "../sounds";
import { haptic } from "../haptics";
import type { TriviaAnswer } from "../types";
import AnswerGrid from "../components/AnswerGrid";
import TimerBar from "../components/TimerBar";
import Scoreboard from "../components/Scoreboard";
import PassScreen from "../components/PassScreen";
import RevealOverlay from "../components/RevealOverlay";
import PodiumScreen from "../components/PodiumScreen";
import RoundEndScreen from "../components/RoundEndScreen";
import ScorePop from "../components/ScorePop";
import CutScene from "../components/CutScene";
import HostMenu from "../components/HostMenu";

const CAT_SLUG: Record<string, string> = {
  "General Knowledge": "general-knowledge",
  "Science & Nature": "science-nature",
  "History": "history",
  "Pop Culture": "pop-culture",
  "Sports": "sports",
  "Geography": "geography",
  "Movies & TV": "movies-tv",
};

interface Props {
  guestId: string;
  roomId: string;
  roomMode: "pass_tablet" | "phones_only" | "host_tablet";
  isHost: boolean;
  displayName: string;
  gameState: any;
}

export default function TriviaGame({ guestId, roomId, roomMode, isHost, displayName, gameState }: Props) {
  const [lockedAnswer, setLockedAnswer] = useState<TriviaAnswer | null>(null);
  const [revealPhase, setRevealPhase] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [scoreDelta, setScoreDelta] = useState(0);
  const [cutScene, setCutScene] = useState<{ name: string; seq: number } | null>(null);
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  function clearTimers() {
    timerRefs.current.forEach(clearTimeout);
    timerRefs.current = [];
  }

  useEffect(() => () => clearTimers(), []);

  // Defense in depth: any time the question index changes, hard-reset local
  // state so a stale lockedAnswer/revealPhase from the previous question can
  // never visually carry over (the "auto-pick" symptom).
  useEffect(() => {
    clearTimers();
    setLockedAnswer(null);
    setRevealPhase(0);
    setScoreDelta(0);
    fastAnswerRef.current = false;
    questionStartRef.current = Date.now();
  }, [gameState?.questionIndex, gameState?.round]);

  const prevPhaseRef = useRef<string | null>(null);
  const prevScoresRef = useRef<any[]>([]);
  const streakRef = useRef(0);
  const questionStartRef = useRef(0);
  const fastAnswerRef = useRef(false);
  const cutSeqRef = useRef(0);
  const shownRoundCutSceneRef = useRef<string | null>(null); // prevents repeat per-round cut scenes
  const wrongStreakRef = useRef(0); // for GUTTER BALL callout

  function showCutScene(name: string) {
    setCutScene({ name, seq: ++cutSeqRef.current });
  }

  useEffect(() => {
    if (!gameState) return;
    const phase = gameState.phase;
    if (phase === prevPhaseRef.current) return;
    prevPhaseRef.current = phase;

    if (phase === "question") {
      clearTimers();
      setLockedAnswer(null);
      setRevealPhase(0);
      setScoreDelta(0);
      prevScoresRef.current = gameState.scores ?? [];
      questionStartRef.current = Date.now();
      fastAnswerRef.current = false;
      if (gameState.questionIndex === gameState.totalInRound - 1) {
        showCutScene("FINAL QUESTION");
      }
    }

    if (phase === "reveal") {
      // Track this timer so a fast next-question doesn't let it fire on the new question's render
      timerRefs.current.push(setTimeout(() => runRevealSequence(), 800));
    }

    if (phase === "countdown") {
      playSound("countdown");
      // SUDDEN DEATH only fires once per round, not before every question
      if (gameState.roundName === "Sudden Death" && shownRoundCutSceneRef.current !== "Sudden Death") {
        shownRoundCutSceneRef.current = "Sudden Death";
        showCutScene("SUDDEN DEATH");
      }
    }

    if (phase === "round_end") {
      playSound("round-end");
      shownRoundCutSceneRef.current = null; // reset for next round
      showCutScene("ROUND COMPLETE");
    }

    if (phase === "game_over") {
      playSound("podium-1st");
      const sorted = [...(gameState.scores ?? [])].sort((a: any, b: any) => b.score - a.score);
      if (sorted[0]?.guestId === guestId) showCutScene("WINNER");
    }
  }, [gameState?.phase]);

  useEffect(() => {
    if (revealPhase === 4 && gameState?.scores) {
      const prev = prevScoresRef.current.find((s: any) => s.guestId === guestId)?.score ?? 0;
      const curr = gameState.scores.find((s: any) => s.guestId === guestId)?.score ?? 0;
      setScoreDelta(curr - prev);

      const answers = gameState.answers ?? {};
      const correct = gameState.question?.correct;
      const iGotItRight = answers[guestId] === correct;

      if (iGotItRight) {
        streakRef.current += 1;
        wrongStreakRef.current = 0;
        if (fastAnswerRef.current) {
          showCutScene("KOBE");
          return;
        }
      } else {
        streakRef.current = 0;
        wrongStreakRef.current += 1;
        if (wrongStreakRef.current === 3) {
          showCutScene("GUTTER BALL");
          return;
        }
      }

      const totalPlayers = gameState.scores?.length ?? 0;
      const correctCount = Object.values(answers).filter((a) => a === correct).length;

      if (totalPlayers >= 2 && correctCount === 0) {
        showCutScene("NOBODY KNOWS ANYTHING");
        return;
      }
      if (totalPlayers >= 2 && correctCount === totalPlayers) {
        showCutScene("PERFECT ROUND");
        return;
      }
      if (streakRef.current === 5) {
        showCutScene("LANE 9 IS BURNING");
        return;
      }
      if (streakRef.current === 3) {
        showCutScene("TURKEY");
        return;
      }
      if (gameState.scores && prevScoresRef.current.length >= 3) {
        const sortedPrev = [...prevScoresRef.current].sort((a: any, b: any) => b.score - a.score);
        const sortedNow  = [...gameState.scores].sort((a: any, b: any) => b.score - a.score);
        const prevRank = sortedPrev.findIndex((s: any) => s.guestId === guestId) + 1;
        const nowRank  = sortedNow.findIndex((s: any) => s.guestId === guestId) + 1;
        const prevMyScore = prevScoresRef.current.find((s: any) => s.guestId === guestId)?.score ?? 0;
        const prevLeader = sortedPrev[0]?.score ?? 0;
        const gapClosed = (prevLeader - prevMyScore) >= 3000 && nowRank <= 2;
        if (gapClosed) {
          showCutScene("SPLIT CONVERSION");
          return;
        }
        if (nowRank <= 3 && prevRank >= sortedPrev.length && prevRank > nowRank + 1) {
          showCutScene("COMEBACK KID");
          return;
        }
      }
    }
  }, [revealPhase]);

  function runRevealSequence() {
    clearTimers();
    const correct = gameState?.question?.correct;
    const gotItRight = lockedAnswer !== null && lockedAnswer === correct;

    setRevealPhase(1);
    timerRefs.current.push(setTimeout(() => {
      setRevealPhase(2);
      playSound("reveal-correct");
      if (gotItRight) haptic.correct();
    }, 500));
    timerRefs.current.push(setTimeout(() => {
      setRevealPhase(3);
      playSound("reveal-wrong");
      if (!gotItRight && lockedAnswer !== null) haptic.wrong();
    }, 800));
    timerRefs.current.push(setTimeout(() => { setRevealPhase(4); playSound("score-pop"); }, 1200));
  }

  function handleAnswer(answer: TriviaAnswer) {
    if (lockedAnswer) return;
    setLockedAnswer(answer);
    playSound("answer-lock");
    haptic.lock();
    socket.send({ type: "game:answer", guestId, roomId, answer } as any);
    if (Date.now() - questionStartRef.current < 2000) {
      fastAnswerRef.current = true;
    }
  }

  function handleNextQuestion() {
    socket.send({ type: "host:next_question", guestId, roomId } as any);
  }

  function handleForceReveal() {
    socket.send({ type: "host:end_round", guestId, roomId } as any);
  }

  function handlePickCategory(category: string) {
    socket.send({ type: "host:pick_category", guestId, roomId, category } as any);
  }

  if (!gameState) {
    return <div className="game-loading"><p>Loading game…</p></div>;
  }

  const { phase, question, scores, round, roundName, questionIndex, totalInRound,
          answers, passOrder, passIndex, tournament, mode, draftCategory } = gameState;

  const answeredCount = answers ? Object.keys(answers).length : 0;
  const totalPlayers = scores?.length ?? 0;
  const isMyTurn = mode === "pass_tablet" ? passOrder?.[passIndex] === guestId : true;

  // PERFECT GAME cut scene must render here — PodiumScreen replaces the main div
  if (phase === "game_over") {
    return (
      <>
        <CutScene scene={cutScene} onDone={() => setCutScene(null)} />
        <PodiumScreen scores={scores} guestId={guestId} roomId={roomId} isHost={isHost} />
      </>
    );
  }

  if (phase === "round_end") {
    return (
      <>
        <CutScene scene={cutScene} onDone={() => setCutScene(null)} />
        <RoundEndScreen
          round={round}
          roundName={roundName}
          scores={scores}
          isHost={isHost}
          draftCategory={draftCategory}
          onPickCategory={handlePickCategory}
          onContinue={handleNextQuestion}
        />
      </>
    );
  }

  if (mode === "pass_tablet" && phase === "question" && !isMyTurn) {
    const currentPlayerName = scores?.find((s: any) => s.guestId === passOrder?.[passIndex])?.displayName ?? "…";
    return <PassScreen playerName={currentPlayerName} />;
  }

  if (phase === "countdown") {
    return (
      <>
        <CutScene scene={cutScene} onDone={() => setCutScene(null)} />
        <Scoreboard
          scores={scores}
          guestId={guestId}
          questionIndex={questionIndex}
          totalInRound={totalInRound}
          isHost={isHost}
          onNext={handleNextQuestion}
          showNext={false}
          prevScores={prevScoresRef.current}
          countdown
        />
      </>
    );
  }

  const showFullQuestion = mode === "pass_tablet" || mode === "host_tablet"
    ? isHost || mode === "pass_tablet"
    : true;

  if (!showFullQuestion && phase === "question") {
    return (
      <div className="guest-phone-view">
        <div className="answered-badge">{answeredCount}/{totalPlayers} answered</div>
        <AnswerGrid
          question={question}
          locked={lockedAnswer}
          revealPhase={0}
          onAnswer={handleAnswer}
          guestAnswer={lockedAnswer}
          guestId={guestId}
          scores={scores}
        />
      </div>
    );
  }

  return (
    <div className="trivia-game">
      <HostMenu guestId={guestId} roomId={roomId} isHost={isHost} phase={phase} />
      <CutScene scene={cutScene} onDone={() => setCutScene(null)} />

      {/* Flagship gameshow header — broadcast banner with round in lights */}
      <div className="trivia-flagship-header">
        <div className="trivia-flagship-bulbs trivia-flagship-bulbs-top" aria-hidden>
          {Array.from({ length: 14 }).map((_, i) => <span key={i} className="trivia-flagship-bulb" style={{ animationDelay: `${i * 0.12}s` }} />)}
        </div>
        <div className="trivia-flagship-row">
          <span className="trivia-flagship-q">Q {questionIndex + 1}<span className="trivia-flagship-q-of">/{totalInRound}</span></span>
          <span className="trivia-flagship-title">{tournament ? roundName : "TRIVIA"}</span>
          <span className="trivia-flagship-answered">{answeredCount}/{totalPlayers}</span>
        </div>
        <div className="trivia-flagship-bulbs trivia-flagship-bulbs-bottom" aria-hidden>
          {Array.from({ length: 14 }).map((_, i) => <span key={i} className="trivia-flagship-bulb" style={{ animationDelay: `${(13 - i) * 0.12}s` }} />)}
        </div>
      </div>

      {question && (
        <div className="question-card question-card-flagship" key={`q-${questionIndex}-${round}`}>
          <div className="question-spotlight" aria-hidden />
          <div className={`question-category cat-${CAT_SLUG[question.category] ?? "general-knowledge"}`}>
            {question.category}
          </div>
          <div className="question-text">{question.question}</div>
        </div>
      )}

      <div className="answer-section">
        {phase === "question" && question && (
          <TimerBar
            deadline={gameState.deadline}
            timeLimit={gameState.timeLimit}
            onExpire={isHost ? handleForceReveal : undefined}
          />
        )}

        <AnswerGrid
          question={question}
          locked={lockedAnswer}
          revealPhase={revealPhase as any}
          onAnswer={handleAnswer}
          guestAnswer={lockedAnswer}
          guestId={guestId}
          scores={scores}
        />

        {phase === "reveal" && revealPhase >= 4 && scoreDelta > 0 && (
          <ScorePop key={questionIndex} delta={scoreDelta} />
        )}
      </div>

      {phase === "reveal" && revealPhase >= 4 && (
        <RevealOverlay
          scores={scores}
          guestId={guestId}
          answers={answers}
          correctAnswer={question?.correct}
          question={question}
          lockedAnswer={lockedAnswer}
        />
      )}

      {isHost && phase === "reveal" && revealPhase >= 4 && (
        <div className="host-controls">
          <button className="next-btn" onClick={handleNextQuestion}>
            Next Question →
          </button>
        </div>
      )}

      {phase === "reveal" && revealPhase >= 4 && (
        <Scoreboard
          scores={scores}
          guestId={guestId}
          questionIndex={questionIndex}
          totalInRound={totalInRound}
          isHost={isHost}
          onNext={handleNextQuestion}
          showNext={false}
          prevScores={prevScoresRef.current}
        />
      )}
    </div>
  );
}
