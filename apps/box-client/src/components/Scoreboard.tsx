interface Score {
  guestId: string;
  displayName: string;
  score: number;
  correct: number;
  wrong: number;
  streak: number;
  eliminated: boolean;
}

interface Props {
  scores: Score[];
  guestId: string;
  questionIndex: number;
  totalInRound: number;
  isHost: boolean;
  onNext: () => void;
  showNext: boolean;
  prevScores?: Score[];
  countdown?: boolean;
}

export default function Scoreboard({ scores, guestId, questionIndex, totalInRound, isHost, onNext, showNext, prevScores, countdown }: Props) {
  const sorted = [...scores].sort((a, b) => b.score - a.score);

  function getRankShift(id: string, currentRank: number): number {
    if (!prevScores || prevScores.length === 0) return 0;
    const prevSorted = [...prevScores].sort((a, b) => b.score - a.score);
    const prevRank = prevSorted.findIndex(s => s.guestId === id);
    if (prevRank === -1) return 0;
    return prevRank - currentRank;
  }

  return (
    <div className="scoreboard">
      <div className="scoreboard-header">
        <span className="scoreboard-progress">Q {questionIndex + 1} / {totalInRound}</span>
        {countdown && <span className="scoreboard-next-hint">Next question coming…</span>}
      </div>

      <div className="scoreboard-list">
        {sorted.map((s, i) => {
          const isMe = s.guestId === guestId;
          const shift = getRankShift(s.guestId, i);
          return (
            <div
              key={s.guestId}
              className={`scoreboard-row ${isMe ? "is-me" : ""} ${s.eliminated ? "eliminated" : ""}`}
            >
              <span className="scoreboard-rank">#{i + 1}</span>
              <span className="scoreboard-name">
                {s.displayName}
                {s.streak >= 3 && <span className="streak-badge">×{s.streak}</span>}
                {s.eliminated && <span className="elim-badge">OUT</span>}
              </span>
              {shift !== 0 && (
                <span className={`rank-shift ${shift > 0 ? "up" : "down"}`}>
                  {shift > 0 ? `↑${shift}` : `↓${Math.abs(shift)}`}
                </span>
              )}
              <span className="scoreboard-score">{s.score.toLocaleString()}</span>
            </div>
          );
        })}
      </div>

      {isHost && showNext && (
        <button className="next-btn" onClick={onNext}>Next Question →</button>
      )}
    </div>
  );
}
