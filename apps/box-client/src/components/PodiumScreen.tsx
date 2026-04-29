import { useState } from "react";
import { socket } from "../ws";
import { haptic } from "../haptics";

interface Score {
  guestId: string;
  displayName: string;
  score: number;
  correct: number;
  wrong: number;
}

interface Props {
  scores: Score[];
  guestId: string;
  roomId: string;
  isHost: boolean;
}

export default function PodiumScreen({ scores, guestId, roomId, isHost }: Props) {
  const [readyUp, setReadyUp] = useState(false);
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const isMultiplayer = scores.length > 1;

  function playAgain() {
    haptic.heavy();
    socket.send({ type: "host:play_again", guestId, roomId });
  }

  function exitToLobby() {
    haptic.tap();
    localStorage.removeItem("pg_room");
    window.location.reload();
  }

  return (
    <div className="podium-screen">
      <div className="podium-header">
        <div className="podium-label">FINAL SCORE</div>
        <div className="podium-winner">{sorted[0]?.displayName}</div>
        <div className="podium-winner-score">{sorted[0]?.score.toLocaleString()}</div>
      </div>

      <div className="podium-list">
        {sorted.map((s, i) => {
          const isMe = s.guestId === guestId;
          return (
            <div key={s.guestId} className={`podium-row ${isMe ? "is-me" : ""} ${i === 0 ? "top-row" : ""}`}>
              <span className="podium-rank">#{i + 1}</span>
              <span className="podium-name">{s.displayName}</span>
              <span className="podium-score">{s.score.toLocaleString()}</span>
              <span className="podium-stats">{s.correct}✓ {s.wrong}✗</span>
            </div>
          );
        })}
      </div>

      <div className="podium-actions">
        {isHost || !isMultiplayer ? (
          <>
            <button className="podium-btn primary" onClick={playAgain}>
              Play Again
            </button>
            <button className="podium-btn secondary" onClick={exitToLobby}>
              Exit to Lobby
            </button>
          </>
        ) : readyUp ? (
          <>
            <button className="podium-btn waiting" disabled>
              Waiting for host…
            </button>
            <button className="podium-btn secondary" onClick={exitToLobby}>
              Exit
            </button>
          </>
        ) : (
          <>
            <button className="podium-btn primary" onClick={() => { haptic.tap(); setReadyUp(true); }}>
              Ready Up
            </button>
            <button className="podium-btn secondary" onClick={exitToLobby}>
              Exit
            </button>
          </>
        )}
      </div>
    </div>
  );
}
