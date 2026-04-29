import { useState } from "react";
import type { TriviaAnswer } from "../types";
import { logToServer } from "../logger";

interface Score {
  guestId: string;
  displayName: string;
  score: number;
  correct: number;
  wrong: number;
  streak: number;
}

interface Question {
  id?: number;
  question?: string;
  category?: string;
  a: string;
  b: string;
  c: string;
  d: string;
}

interface Props {
  scores: Score[];
  guestId: string;
  answers: Record<string, TriviaAnswer>;
  correctAnswer: TriviaAnswer | undefined;
  question?: Question | null;
  lockedAnswer?: TriviaAnswer | null;
}

export default function RevealOverlay({ scores, guestId, answers, correctAnswer, question, lockedAnswer }: Props) {
  const [reported, setReported] = useState(false);
  // answers[guestId] is authoritative; fall back to lockedAnswer if server hasn't echoed it yet
  const myAnswer = answers?.[guestId] ?? lockedAnswer ?? undefined;
  const gotIt = myAnswer !== undefined && myAnswer === correctAnswer;
  const myScore = scores?.find(s => s.guestId === guestId);
  const correctText = question && correctAnswer ? question[correctAnswer] : null;

  function reportBad() {
    if (reported || !question) return;
    setReported(true);
    const payload = {
      id: question.id,
      category: question.category,
      question: question.question,
      a: question.a, b: question.b, c: question.c, d: question.d,
      marked_correct: correctAnswer,
    };
    logToServer("WARN", "trivia.bad-question", `Player flagged bad/wrong question: ${JSON.stringify(payload)}`);
  }

  return (
    <div className="reveal-overlay">
      <div className={`reveal-result ${gotIt ? "correct" : "wrong"}`}>
        <span className="reveal-icon">{gotIt ? "✓" : "✗"}</span>
        <span className="reveal-label">{gotIt ? "Correct!" : "Wrong"}</span>
        {myScore && gotIt && myScore.streak >= 2 && (
          <span className="reveal-streak">{myScore.streak}× streak</span>
        )}
      </div>

      <div className="reveal-answer-row">
        <span className="reveal-answer-label">Answer: </span>
        <span className="reveal-answer-key">{correctAnswer?.toUpperCase()}</span>
        {correctText && <span className="reveal-answer-text"> — {correctText}</span>}
      </div>

      <button
        className={`report-bad-q ${reported ? "reported" : ""}`}
        onClick={reportBad}
        disabled={reported}
        title="Flag this question — it'll be logged to /sdcard/errors.log"
      >
        {reported ? "✓ Reported — thanks" : "🚩 Report bad question"}
      </button>
    </div>
  );
}
