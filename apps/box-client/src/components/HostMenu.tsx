import { useState } from "react";
import { socket } from "../ws";
import { haptic } from "../haptics";

interface Props {
  guestId: string;
  roomId: string;
  isHost: boolean;
  phase?: string;             // current game phase, optional
  onForceReveal?: () => void; // if set, "Reveal Now" button calls this; else falls back to host:end_round
  onNext?: () => void;        // if set, "Next" button calls this; else falls back to host:next_question
}

export default function HostMenu({ guestId, roomId, isHost, phase, onForceReveal, onNext }: Props) {
  const [open, setOpen] = useState(false);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  if (!isHost) return null;

  function reveal() {
    haptic.tap();
    if (onForceReveal) onForceReveal();
    else socket.send({ type: "host:end_round", guestId, roomId } as any);
    setOpen(false);
  }

  function next() {
    haptic.tap();
    if (onNext) onNext();
    else socket.send({ type: "host:next_question", guestId, roomId } as any);
    setOpen(false);
  }

  function endGame() {
    haptic.heavy();
    socket.send({ type: "host:force_end", guestId, roomId } as any);
    setOpen(false);
    setConfirmingEnd(false);
  }

  function backToLobby() {
    haptic.heavy();
    socket.send({ type: "host:play_again", guestId, roomId } as any);
    setOpen(false);
  }

  // Phase hints: only show "Reveal Now" during play phases, "Next" during reveal/round_end
  const showReveal = phase === "question" || phase === "drawing" || phase === "drafting" || phase === "buzzed";
  const showNext = phase === "reveal" || phase === "round_end";

  return (
    <>
      <button
        className="host-menu-fab"
        onClick={() => { haptic.tap(); setOpen(o => !o); }}
        aria-label="Host menu"
      >
        ☰
      </button>
      {open && (
        <div className="host-menu-sheet" onClick={() => setOpen(false)}>
          <div className="host-menu-card" onClick={e => e.stopPropagation()}>
            <div className="host-menu-title">HOST CONTROLS</div>
            {showReveal && (
              <button className="host-menu-btn" onClick={reveal}>
                <span className="host-menu-icon">👁</span> Reveal Now
              </button>
            )}
            {showNext && (
              <button className="host-menu-btn primary" onClick={next}>
                <span className="host-menu-icon">→</span> Next
              </button>
            )}
            <button className="host-menu-btn" onClick={backToLobby}>
              <span className="host-menu-icon">↺</span> Back to Lobby
            </button>
            {!confirmingEnd ? (
              <button className="host-menu-btn danger" onClick={() => setConfirmingEnd(true)}>
                <span className="host-menu-icon">⏹</span> End Game
              </button>
            ) : (
              <div className="host-menu-confirm">
                <div className="host-menu-confirm-text">End the game now?</div>
                <div className="host-menu-confirm-row">
                  <button className="host-menu-btn small" onClick={() => setConfirmingEnd(false)}>Cancel</button>
                  <button className="host-menu-btn danger small" onClick={endGame}>Yes, end it</button>
                </div>
              </div>
            )}
            <button className="host-menu-close" onClick={() => setOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
