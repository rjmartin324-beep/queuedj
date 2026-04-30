import { useEffect, useMemo, useRef, useState } from "react";
import { socket } from "../ws";
import { haptic } from "../haptics";
import PodiumScreen from "../components/PodiumScreen";
import HostMenu from "../components/HostMenu";
import CutScene from "../components/CutScene";

interface Props { guestId: string; roomId: string; isHost: boolean; gameState: any; }

// ─── Draft Board slot — one row per pick in snake order ─────────────────────

function DraftBoardSlot({
  slotIdx, draftOrder, currentPick, scores,
}: { slotIdx: number; draftOrder: string[]; currentPick: number; scores: any[] }) {
  const playerId = draftOrder[slotIdx];
  // Which-pick-am-I for this player: count their appearances before this slot
  let nth = 0;
  for (let j = 0; j < slotIdx; j++) if (draftOrder[j] === playerId) nth++;
  const player = scores?.find((s: any) => s.guestId === playerId);
  const pickedItem = player?.picks?.[nth] ?? null;
  const isOnTheClock = slotIdx === currentPick;
  const isFilled = slotIdx < currentPick;
  const round = Math.floor(slotIdx / Math.max(1, new Set(draftOrder).size)) + 1;

  return (
    <div className={`thedraft-slot ${isFilled ? "thedraft-slot-filled" : ""} ${isOnTheClock ? "thedraft-slot-on-clock" : ""}`}>
      <div className="thedraft-slot-num">{String(slotIdx + 1).padStart(2, "0")}</div>
      <div className="thedraft-slot-meta">
        <span className="thedraft-slot-round">RD {round}</span>
        <span className="thedraft-slot-name">{player?.displayName ?? "—"}</span>
      </div>
      <div className="thedraft-slot-pick">
        {pickedItem?.name ?? (isOnTheClock ? "ON THE CLOCK" : "—")}
      </div>
    </div>
  );
}

// ─── War Room Desk — only the player on the clock sees this ─────────────────

function WarRoomDesk({
  availableItems, customText, setCustomText, pick, pickCustom,
}: {
  availableItems: any[];
  customText: string;
  setCustomText: (s: string) => void;
  pick: (id: string) => void;
  pickCustom: () => void;
}) {
  const [showAll, setShowAll] = useState(false);

  // Random 4 suggested picks. Regenerates when the available pool changes
  // (i.e., a pick happens). Stable within the same pool snapshot.
  const poolKey = (availableItems ?? []).map((i: any) => i.id).join(",");
  const suggested = useMemo(() => {
    const shuffled = [...(availableItems ?? [])].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 4);
  }, [poolKey]);

  const itemsToShow = showAll ? (availableItems ?? []) : suggested;
  const moreCount = (availableItems?.length ?? 0) - suggested.length;

  return (
    <div className="war-room-desk">
      {/* Scattered paper-card decorations behind the controls */}
      <div className="war-room-papers" aria-hidden>
        <div className="war-room-paper" style={{ top: "4%", left: "5%",  width: 86,  height: 110, transform: "rotate(-9deg)" }} />
        <div className="war-room-paper" style={{ top: "8%", right: "6%", width: 70,  height: 92,  transform: "rotate(7deg)"  }} />
        <div className="war-room-paper" style={{ top: "32%", right: "12%", width: 60,  height: 78,  transform: "rotate(-3deg)" }} />
        <div className="war-room-paper" style={{ bottom: "22%", left: "8%", width: 100, height: 68, transform: "rotate(4deg)"  }} />
        <div className="war-room-paper" style={{ bottom: "8%",  right: "5%", width: 78,  height: 100, transform: "rotate(-5deg)" }} />
        <div className="war-room-paper" style={{ top: "55%", left: "3%",  width: 72,  height: 88,  transform: "rotate(11deg)" }} />
      </div>

      <div className="war-room-content">
        <div className="war-room-eyebrow">YOUR DESK · ON THE CLOCK</div>
        <div className="war-room-title">MAKE YOUR PICK</div>

        <div className="war-room-custom">
          <input
            type="text"
            className="war-room-custom-input"
            placeholder="Type your own pick…"
            value={customText}
            onChange={e => setCustomText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") pickCustom(); }}
            maxLength={40}
          />
          <button className="war-room-custom-submit"
            disabled={customText.trim().length === 0}
            onClick={pickCustom}>
            DRAFT IT
          </button>
        </div>

        <div className="war-room-suggested-label">{showAll ? "ALL OPTIONS" : "SUGGESTED PICKS"}</div>
        <div className="war-room-suggested">
          {itemsToShow.map((item: any) => (
            <button key={item.id}
              className="war-room-pick-btn"
              onClick={() => pick(item.id)}>
              {item.name}
            </button>
          ))}
        </div>

        {moreCount > 0 && !showAll && (
          <button className="war-room-more" onClick={() => setShowAll(true)}>
            SHOW {moreCount} MORE
          </button>
        )}
        {showAll && (availableItems?.length ?? 0) > 4 && (
          <button className="war-room-more" onClick={() => setShowAll(false)}>
            COLLAPSE
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────

export default function TheDraftGame({ guestId, roomId, isHost, gameState }: Props) {
  const { phase, scenario, availableItems, draftOrder, currentPick, scores, votesSubmitted } = gameState ?? {};
  const [customText, setCustomText] = useState("");
  const [myVotes, setMyVotes] = useState<Record<string, number>>({});

  function pick(itemId: string) {
    haptic.heavy();
    socket.send({ type: "game:action", guestId, roomId, action: "draft:pick", payload: { itemId } } as any);
  }

  function pickCustom() {
    const name = customText.trim();
    if (name.length === 0) return;
    haptic.heavy();
    socket.send({ type: "game:action", guestId, roomId, action: "draft:custom_pick", payload: { name } } as any);
    setCustomText("");
  }

  function endGame() { socket.send({ type: "host:next_question", guestId, roomId } as any); }

  function submitVotes() {
    haptic.heavy();
    socket.send({ type: "game:action", guestId, roomId, action: "draft:submit_votes", payload: { votes: myVotes } } as any);
  }

  // Cutscenes
  const [cutScene, setCutScene] = useState<{ name: string; seq: number; tier?: "banner" | "overlay" | "peak" } | null>(null);
  const cutSeqRef = useRef(0);
  const prevPhaseRef = useRef<string | null>(null);
  const prevPickRef = useRef<number>(-1);
  // Streak tracking for peer-vote results (only meaningful in multi-round draft)
  const voteWinStreakRef = useRef(0);
  const shownThisGameRef = useRef<Set<string>>(new Set());

  function showCutScene(name: string, tier: "banner" | "overlay" | "peak" = "overlay") {
    if (tier === "peak" && shownThisGameRef.current.has(name)) return;
    if (tier === "peak") shownThisGameRef.current.add(name);
    setCutScene({ name, seq: ++cutSeqRef.current, tier });
  }

  // Phase cutscenes
  useEffect(() => {
    if (!gameState) return;
    if (phase !== prevPhaseRef.current) {
      prevPhaseRef.current = phase;
      if (phase === "reveal") showCutScene("BIG REVEAL", "overlay");
      if (phase === "voting" || phase === "game_over") {
        // Check if my pick won most votes (only meaningful at game_over with final vote tally)
        if (phase === "game_over") {
          const sorted = [...(scores ?? [])].sort((a: any, b: any) => b.score - a.score);
          const myScore = scores?.find((s: any) => s.guestId === guestId)?.score ?? 0;
          const topScore = sorted[0]?.score ?? 0;
          const iAmTop = sorted[0]?.guestId === guestId;
          if (iAmTop && myScore === topScore) {
            voteWinStreakRef.current += 1;
            if (voteWinStreakRef.current === 2) {
              showCutScene("TASTE MAKER", "overlay");
            } else {
              showCutScene("CROWD FAVORITE", "banner");
            }
          } else if (myScore === 0 && topScore > 0) {
            showCutScene("READ THE ROOM", "banner");
            voteWinStreakRef.current = 0;
          } else {
            voteWinStreakRef.current = 0;
          }
          if (iAmTop) showCutScene("DRAFT KING", "overlay");
        }
      }
    }
  }, [phase]);

  // "ON THE CLOCK" flash when it becomes my turn
  const currentPickerId = draftOrder?.[currentPick];
  const isMyTurn = currentPickerId === guestId;
  useEffect(() => {
    if (currentPick !== prevPickRef.current && phase === "drafting" && isMyTurn) {
      showCutScene("ON THE CLOCK", "banner");
    }
    prevPickRef.current = currentPick;
  }, [currentPick, phase, isMyTurn]);

  if (phase === "game_over") return <PodiumScreen scores={scores} guestId={guestId} roomId={roomId} isHost={isHost} />;

  const totalPicks = draftOrder?.length ?? 0;
  const round = totalPicks > 0 && draftOrder
    ? Math.floor(currentPick / Math.max(1, new Set(draftOrder).size)) + 1
    : 1;

  return (
    <div className="thedraft-game">
      <HostMenu guestId={guestId} roomId={roomId} isHost={isHost} phase={phase} />
      <CutScene scene={cutScene} onDone={() => setCutScene(null)} />

      {/* NFL-Draft-style header — broadcast feel */}
      <div className="thedraft-header">
        <div className="thedraft-header-eyebrow">
          ROUND {round} · PICK {String(currentPick + 1).padStart(2, "0")} OF {String(totalPicks).padStart(2, "0")}
        </div>
        <div className="thedraft-header-title">THE DRAFT</div>
        {scenario && <div className="thedraft-header-scenario">{scenario.title}</div>}
      </div>

      {/* Draft Board — always visible during drafting; the main visual element */}
      {phase === "drafting" && draftOrder && (
        <div className="thedraft-board">
          <div className="thedraft-board-label">DRAFT BOARD</div>
          <div className="thedraft-board-slots">
            {draftOrder.map((_: string, i: number) => (
              <DraftBoardSlot key={i}
                slotIdx={i}
                draftOrder={draftOrder}
                currentPick={currentPick}
                scores={scores ?? []} />
            ))}
          </div>
        </div>
      )}

      {/* Two-view: drafter sees War Room Desk, others see waiting state */}
      {phase === "drafting" && (
        isMyTurn ? (
          <WarRoomDesk
            availableItems={availableItems}
            customText={customText}
            setCustomText={setCustomText}
            pick={pick}
            pickCustom={pickCustom}
          />
        ) : (
          <div className="thedraft-waiting">
            <div className="thedraft-waiting-eyebrow">ON THE CLOCK</div>
            <div className="thedraft-waiting-name">
              {scores?.find((s: any) => s.guestId === currentPickerId)?.displayName ?? "…"}
            </div>
            <div className="thedraft-waiting-sub">Watch the board.</div>
          </div>
        )
      )}

      {/* Reveal phase — show every draft side-by-side with hidden values as flavor.
          Host advances to voting phase via the "Open Ballots" button. */}
      {phase === "reveal" && (
        <div className="draft-reveal">
          <div className="draft-reveal-header">THE DRAFTS ARE IN</div>
          <div className="draft-reveal-sub">Official ratings shown — but the room votes for the winner.</div>
          {[...(scores ?? [])].sort((a: any, b: any) => b.score - a.score).map((s: any, i: number) => (
            <div key={s.guestId} className={`draft-reveal-card ${s.guestId === guestId ? "draft-reveal-card-me" : ""}`}>
              <div className="draft-reveal-card-head">
                <span className={`draft-reveal-rank ${i === 0 ? "draft-reveal-rank-top" : ""}`}>#{i + 1}</span>
                <span className="draft-reveal-name">{s.displayName}</span>
                <span className="draft-reveal-total">{s.score}</span>
              </div>
              <div className="draft-reveal-picks">
                {s.picks?.map((p: any) => (
                  <div key={p.id} className={`draft-reveal-pick ${p.id?.startsWith?.("custom-") ? "draft-reveal-pick-custom" : ""}`}>
                    <span className="draft-reveal-pick-name">{p.name}</span>
                    <span className="draft-reveal-pick-val">{p.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {isHost && (
            <div className="host-controls" style={{ marginTop: 16 }}>
              <button className="next-btn" onClick={endGame}>
                {(scores?.length ?? 0) > 1 ? "Open Ballots →" : "See Final Scores →"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Voting phase — peer voting. Each player has 3 points to distribute. */}
      {phase === "voting" && (() => {
        const others = (scores ?? []).filter((s: any) => s.guestId !== guestId);
        const used = Object.values(myVotes).reduce((a: number, b: number) => a + b, 0);
        const remaining = 3 - used;
        const iSubmitted = !!votesSubmitted?.[guestId];

        function setVote(rid: string, n: number) {
          if (iSubmitted) return;
          const current = myVotes[rid] ?? 0;
          const wouldBe = used - current + n;
          if (wouldBe > 3) return;
          setMyVotes(prev => ({ ...prev, [rid]: n }));
        }

        if (iSubmitted) {
          const waiting = (scores ?? []).filter((s: any) => !votesSubmitted?.[s.guestId]).length;
          return (
            <div className="draft-voting">
              <div className="draft-voting-header">
                <div className="draft-voting-eyebrow">VOTES LOCKED</div>
                <div className="draft-voting-title">WAITING ON {waiting}</div>
                <div className="draft-voting-sub">Other ballots are still being tallied.</div>
              </div>
            </div>
          );
        }

        return (
          <div className="draft-voting">
            <div className="draft-voting-header">
              <div className="draft-voting-eyebrow">YOUR BALLOT</div>
              <div className="draft-voting-title">CAST 3 VOTES</div>
              <div className="draft-voting-remaining">
                Points remaining: <strong>{remaining}</strong>
              </div>
            </div>

            {others.map((s: any) => {
              const myVoteForThem = myVotes[s.guestId] ?? 0;
              return (
                <div key={s.guestId} className="draft-vote-card">
                  <div className="draft-vote-card-name">{s.displayName}</div>
                  <div className="draft-vote-card-picks">
                    {s.picks?.map((p: any) => (
                      <span key={p.id} className={`draft-vote-pick ${p.id?.startsWith?.("custom-") ? "draft-vote-pick-custom" : ""}`}>
                        {p.name}
                      </span>
                    ))}
                  </div>
                  <div className="draft-vote-buttons">
                    {[0, 1, 2, 3].map(n => {
                      const wouldBe = used - myVoteForThem + n;
                      const disabled = wouldBe > 3;
                      return (
                        <button key={n}
                          className={`draft-vote-btn ${myVoteForThem === n ? "draft-vote-btn-selected" : ""}`}
                          disabled={disabled}
                          onClick={() => setVote(s.guestId, n)}>
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <button className="draft-voting-submit"
              disabled={used !== 3}
              onClick={submitVotes}>
              {used === 3 ? "LOCK IN BALLOT" : `${remaining} MORE TO PLACE`}
            </button>
          </div>
        );
      })()}
    </div>
  );
}
