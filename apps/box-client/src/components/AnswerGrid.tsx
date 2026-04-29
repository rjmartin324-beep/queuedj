import type { TriviaAnswer } from "../types";
import { haptic } from "../haptics";

interface Question {
  a: string;
  b: string;
  c: string;
  d: string;
  correct: TriviaAnswer;
}

interface Props {
  question: Question | null;
  locked: TriviaAnswer | null;
  revealPhase: 0 | 1 | 2 | 3 | 4;
  onAnswer: (a: TriviaAnswer) => void;
  guestAnswer: TriviaAnswer | null;
  guestId: string;
  scores: any[];
}

const ANSWERS: TriviaAnswer[] = ["a", "b", "c", "d"];
const LABELS = ["A", "B", "C", "D"];

export default function AnswerGrid({ question, locked, revealPhase, onAnswer, guestAnswer }: Props) {
  if (!question) return null;

  const answers: Record<TriviaAnswer, string> = {
    a: question.a,
    b: question.b,
    c: question.c,
    d: question.d,
  };

  const isRevealed = revealPhase >= 2;
  const isDimmed = revealPhase >= 3;

  return (
    <div className="answer-grid">
      {ANSWERS.map((key, i) => {
        const isMyAnswer = guestAnswer === key;
        const isCorrect = key === question.correct;
        const isLocked = locked === key;

        let cls = `answer-square sq-${key}`;
        if (isLocked && !isRevealed) cls += " locked";
        if (isRevealed && isCorrect) cls += " correct";
        if (isDimmed && !isCorrect) cls += " wrong";

        return (
          <button
            key={key}
            className={cls}
            onClick={() => { if (!locked) { haptic.tap(); onAnswer(key); } }}
            disabled={!!locked}
          >
            <span className="answer-text">{answers[key]}</span>
            <span className="answer-letter">{LABELS[i]}</span>
            {isMyAnswer && !isRevealed && (
              <span className="answer-check">✓</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
