import { useEffect, useRef, useState } from "react";
import { socket } from "../ws";
import { haptic } from "../haptics";
import CutScene from "../components/CutScene";
import PodiumScreen from "../components/PodiumScreen";
import HostMenu from "../components/HostMenu";

interface Props {
  guestId: string;
  roomId: string;
  roomMode: "pass_tablet" | "phones_only" | "host_tablet";
  isHost: boolean;
  displayName: string;
  gameState: any;
}

export default function WYRGame({ guestId, roomId, roomMode, isHost, gameState }: Props) {
  const [cutScene, setCutScene] = useState<{ name: string; seq: number } | null>(null);
  const [localVote, setLocalVote] = useState<"a" | "b" | null>(null);
  const cutSeqRef = useRef(0);
  const prevPhaseRef = useRef<string | null>(null);
  const prevScoresRef = useRef<any[]>([]);

  function showCutScene(name: string) {
    setCutScene({ name, seq: ++cutSeqRef.current });
  }

  useEffect(() => {
    if (!gameState) return;
    const phase = gameState.phase;
    if (phase === prevPhaseRef.current) return;
    prevPhaseRef.current = phase;

    if (phase === "question") {
      prevScoresRef.current = gameState.scores ?? [];
      setLocalVote(null);
      if (gameState.questionIndex === gameState.totalQuestions - 1) {
        showCutScene("FINAL DILEMMA");
      }
    }

    if (phase === "reveal") {
      const votes = gameState.votes ?? {};
      const aCount = Object.values(votes).filter(v => v === "a").length;
      const bCount = Object.values(votes).filter(v => v === "b").length;
      const total = aCount + bCount;
      const myVote = votes[guestId];

      if (total >= 2 && aCount === bCount) {
        showCutScene("DEAD SPLIT");
      } else if (total >= 4 && (aCount === 0 || bCount === 0)) {
        showCutScene("UNANIMOUS");
      } else if (total >= 4 && (aCount / total >= 0.8 || bCount / total >= 0.8)) {
        showCutScene("LANDSLIDE");
      } else if (myVote && total >= 2) {
        const majority = aCount > bCount ? "a" : "b";
        if (myVote !== majority) showCutScene("BOLD PICK");
      }
    }

    if (phase === "game_over") {
      const sorted = [...(gameState.scores ?? [])].sort((a: any, b: any) => b.score - a.score);
      if (sorted[0]?.guestId === guestId) showCutScene("WINNER");
    }
  }, [gameState?.phase]);

  function vote(v: "a" | "b") {
    haptic.lock();
    setLocalVote(v);
    socket.send({ type: "game:action", guestId, roomId, action: "wyr:vote", payload: { vote: v, promptId: gameState?.prompt?.id } } as any);
  }

  function next() {
    socket.send({ type: "game:action", guestId, roomId, action: "wyr:next", payload: {} } as any);
  }

  if (!gameState) return <div className="game-loading"><p>Loading…</p></div>;

  const { phase, prompt, scores, votes, questionIndex, totalQuestions, passOrder, passIndex, mode } = gameState;

  if (phase === "game_over") {
    const podiumScores = (scores ?? []).map((s: any) => ({
      ...s,
      correct: s.bold ?? 0,
      wrong: s.safe ?? 0,
    }));
    return (
      <>
        <CutScene scene={cutScene} onDone={() => setCutScene(null)} />
        <PodiumScreen scores={podiumScores} guestId={guestId} roomId={roomId} isHost={isHost} />
      </>
    );
  }

  const aCount = votes ? Object.values(votes).filter(v => v === "a").length : 0;
  const bCount = votes ? Object.values(votes).filter(v => v === "b").length : 0;
  const totalVotes = aCount + bCount;
  const totalPlayers = scores?.length ?? 0;

  const serverVote = votes?.[guestId];
  const myVote = localVote ?? (serverVote === "a" || serverVote === "b" ? serverVote : null);
  const isMyTurn = mode === "pass_tablet" ? passOrder?.[passIndex] === guestId : true;
  const hasVoted = !!localVote || !!(votes && guestId in votes);

  const majority = aCount > bCount ? "a" : bCount > aCount ? "b" : null;

  if (phase === "countdown") {
    return (
      <>
        <CutScene scene={cutScene} onDone={() => setCutScene(null)} />
        <div className="wyr-countdown">
          <div className="wyr-logo">WOULD<br />YOU<br />RATHER</div>
          <div className="wyr-q-progress">Q {questionIndex + 1} / {totalQuestions}</div>
          <div className="wyr-scores-mini">
            {[...(scores ?? [])].sort((a: any, b: any) => b.score - a.score).map((s: any, i: number) => (
              <div key={s.guestId} className={`wyr-score-row ${s.guestId === guestId ? "wyr-score-me" : ""}`}>
                <span className="wyr-rank">#{i + 1}</span>
                <span className="wyr-name">{s.displayName}</span>
                <span className="wyr-pts">{s.score}</span>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  if (phase === "question" && mode === "pass_tablet" && !isMyTurn) {
    const currentName = scores?.find((s: any) => s.guestId === passOrder?.[passIndex])?.displayName ?? "…";
    return (
      <div className="wyr-pass-wait">
        <div className="wyr-pass-label">Passing to</div>
        <div className="wyr-pass-name">{currentName}</div>
        <div className="wyr-pass-hint">Hand the tablet over</div>
      </div>
    );
  }

  if (phase === "question") {
    return (
      <div className="wyr-game wyr-game-flagship">
        <HostMenu guestId={guestId} roomId={roomId} isHost={isHost} phase={phase} />

        {/* Flagship dilemma header */}
        <div className="wyr-flagship-header">
          <div className="wyr-flagship-eyebrow">DILEMMA №{String(questionIndex + 1).padStart(2, "0")} OF {String(totalQuestions).padStart(2, "0")}</div>
          <div className="wyr-flagship-title">WOULD YOU RATHER…</div>
          <div className="wyr-flagship-meta">
            {prompt?.category && <span className="wyr-flagship-cat">{prompt.category}</span>}
            {mode !== "pass_tablet" && <span className="wyr-flagship-voted">{totalVotes}/{totalPlayers} VOTED</span>}
          </div>
        </div>

        {prompt && (
          <div className="wyr-choices wyr-choices-flagship">
            <button
              className={`wyr-choice wyr-choice-flagship wyr-choice-a ${hasVoted && myVote === "a" ? "wyr-chosen" : ""} ${hasVoted && myVote !== "a" ? "wyr-unchosen" : ""}`}
              onClick={() => !hasVoted && isMyTurn && vote("a")}
              disabled={hasVoted || !isMyTurn}
            >
              <span className="wyr-choice-letter">A</span>
              <span className="wyr-choice-text">{prompt.optionA}</span>
              {hasVoted && myVote === "a" && <span className="wyr-chosen-stamp">PICKED</span>}
            </button>

            <div className="wyr-or-flagship">
              <span className="wyr-or-line" aria-hidden />
              <span className="wyr-or-text">OR</span>
              <span className="wyr-or-line" aria-hidden />
            </div>

            <button
              className={`wyr-choice wyr-choice-flagship wyr-choice-b ${hasVoted && myVote === "b" ? "wyr-chosen" : ""} ${hasVoted && myVote !== "b" ? "wyr-unchosen" : ""}`}
              onClick={() => !hasVoted && isMyTurn && vote("b")}
              disabled={hasVoted || !isMyTurn}
            >
              <span className="wyr-choice-letter">B</span>
              <span className="wyr-choice-text">{prompt.optionB}</span>
              {hasVoted && myVote === "b" && <span className="wyr-chosen-stamp">PICKED</span>}
            </button>
          </div>
        )}
      </div>
    );
  }

  if (phase === "reveal") {
    const aPercent = totalVotes > 0 ? Math.round((aCount / totalVotes) * 100) : 50;
    const bPercent = 100 - aPercent;

    return (
      <div className="wyr-game wyr-game-flagship">
        <HostMenu guestId={guestId} roomId={roomId} isHost={isHost} phase={phase} />
        <CutScene scene={cutScene} onDone={() => setCutScene(null)} />

        <div className="wyr-flagship-header">
          <div className="wyr-flagship-eyebrow">RESULTS · DILEMMA №{String(questionIndex + 1).padStart(2, "0")}</div>
          <div className="wyr-flagship-title">{majority === null ? "DEAD SPLIT" : "THE ROOM HAS SPOKEN"}</div>
          {prompt?.category && (
            <div className="wyr-flagship-meta">
              <span className="wyr-flagship-cat">{prompt.category}</span>
            </div>
          )}
        </div>

        {prompt && (
          <div className="wyr-reveal wyr-reveal-flagship">
            <div className="wyr-split-bar wyr-split-bar-flagship">
              <div className="wyr-split-a" style={{ width: `${aPercent}%` }}>
                <span className="wyr-split-letter">A</span>
                <span className="wyr-split-pct">{aPercent}%</span>
              </div>
              <div className="wyr-split-b" style={{ width: `${bPercent}%` }}>
                <span className="wyr-split-letter">B</span>
                <span className="wyr-split-pct">{bPercent}%</span>
              </div>
            </div>

            <div className="wyr-reveal-labels">
              <div className={`wyr-reveal-option ${majority === "a" ? "wyr-majority" : ""}`}>
                <span className="wyr-rl-letter">A</span>
                <span className="wyr-rl-text">{prompt.optionA}</span>
                <span className="wyr-rl-count">{aCount} {aCount === 1 ? "vote" : "votes"}</span>
              </div>
              <div className={`wyr-reveal-option ${majority === "b" ? "wyr-majority" : ""}`}>
                <span className="wyr-rl-letter">B</span>
                <span className="wyr-rl-text">{prompt.optionB}</span>
                <span className="wyr-rl-count">{bCount} {bCount === 1 ? "vote" : "votes"}</span>
              </div>
            </div>

            <div className="wyr-voter-list">
              {scores?.map((s: any) => {
                const v = votes?.[s.guestId];
                if (!v || v === "voted") return null;
                const isMaj = v === majority || majority === null;
                return (
                  <div key={s.guestId} className={`wyr-voter-row ${s.guestId === guestId ? "wyr-voter-me" : ""}`}>
                    <span className="wyr-voter-name">{s.displayName}</span>
                    <span className={`wyr-voter-badge wyr-badge-${v}`}>{v.toUpperCase()}</span>
                    <span className={`wyr-voter-pts ${isMaj ? "wyr-pts-safe" : "wyr-pts-bold"}`}>
                      {majority === null ? "+75" : isMaj ? "+50" : "+150 BOLD"}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="wyr-scoreboard">
              {[...(scores ?? [])].sort((a: any, b: any) => b.score - a.score).map((s: any, i: number) => (
                <div key={s.guestId} className={`wyr-score-row ${s.guestId === guestId ? "wyr-score-me" : ""}`}>
                  <span className="wyr-rank">#{i + 1}</span>
                  <span className="wyr-name">{s.displayName}</span>
                  <span className="wyr-pts">{s.score}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {isHost && (
          <div className="host-controls">
            <button className="next-btn" onClick={next}>
              {questionIndex + 1 >= totalQuestions ? "See Results →" : "Next →"}
            </button>
          </div>
        )}
        {!isHost && <p className="waiting-hint">Waiting for host…</p>}
      </div>
    );
  }

  return null;
}
