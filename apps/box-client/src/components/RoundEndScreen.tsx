const CATEGORIES = [
  "General Knowledge", "Science & Nature", "History",
  "Pop Culture", "Sports", "Geography", "Movies & TV",
];

const CAT_SLUG: Record<string, string> = {
  "General Knowledge": "general-knowledge",
  "Science & Nature": "science-nature",
  "History": "history",
  "Pop Culture": "pop-culture",
  "Sports": "sports",
  "Geography": "geography",
  "Movies & TV": "movies-tv",
};

interface Score {
  guestId: string;
  displayName: string;
  score: number;
  correct: number;
  wrong: number;
  eliminated: boolean;
}

interface Props {
  round: number;
  roundName: string;
  scores: Score[];
  isHost: boolean;
  draftCategory?: string | null;
  onPickCategory?: (cat: string) => void;
  onContinue: () => void;
}

export default function RoundEndScreen({ round, roundName, scores, isHost, draftCategory, onPickCategory, onContinue }: Props) {
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const isDraftPick = roundName === "Draft Pick";
  const needsCategoryPick = isDraftPick && isHost && !draftCategory;

  return (
    <div className="round-end-screen">
      <div className="round-end-header">
        <div className="round-end-badge">ROUND {round} OF 5</div>
        <h2 className="round-end-name">{roundName}</h2>
        <p className="round-end-hint">Round complete</p>
      </div>

      <div className="scoreboard-list">
        {sorted.map((s, i) => (
          <div key={s.guestId} className={`scoreboard-row ${s.eliminated ? "eliminated" : ""}`}>
            <span className="scoreboard-rank">#{i + 1}</span>
            <span className="scoreboard-name">
              {s.displayName}
              {s.eliminated && <span className="elim-badge">OUT</span>}
            </span>
            <span className="scoreboard-score">{s.score.toLocaleString()}</span>
          </div>
        ))}
      </div>

      {/* Draft Pick category selector */}
      {isDraftPick && isHost && (
        <div className="draft-pick-section">
          <div className="draft-pick-label">
            {draftCategory ? `Category: ${draftCategory}` : "Pick a category for this round"}
          </div>
          {!draftCategory && (
            <div className="draft-cat-grid">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  className={`draft-cat-btn cat-${CAT_SLUG[cat]}`}
                  onClick={() => onPickCategory?.(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isDraftPick && !isHost && !draftCategory && (
        <p className="waiting-hint">Host is picking a category…</p>
      )}
      {isDraftPick && draftCategory && !isHost && (
        <p className="waiting-hint">Category: {draftCategory}</p>
      )}

      {isHost && !needsCategoryPick && (
        <button className="next-btn" onClick={onContinue}>Next Round →</button>
      )}
      {!isHost && (
        <p className="waiting-hint">Waiting for host…</p>
      )}
    </div>
  );
}
