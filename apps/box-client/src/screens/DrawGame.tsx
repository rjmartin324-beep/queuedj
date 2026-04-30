import { useEffect, useRef, useState } from "react";
import { socket } from "../ws";
import { haptic } from "../haptics";
import PodiumScreen from "../components/PodiumScreen";
import HostMenu from "../components/HostMenu";
import CutScene from "../components/CutScene";

interface Props { guestId: string; roomId: string; isHost: boolean; displayName: string; gameState: any; }

interface Stroke { points: [number, number][]; color: string; width: number; }

export default function DrawGame({ guestId, roomId, isHost, gameState }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<[number, number][] | null>(null);
  const [guessInput, setGuessInput] = useState("");
  const [guessLog, setGuessLog] = useState<{ name: string; guess: string; correct: boolean }[]>([]);
  const [guessedIt, setGuessedIt] = useState(false);
  // Post-It theme: dark marker on yellow paper
  const POSTIT_BG = "#FFE680";
  const MARKER = "#1F1A0E";
  const color = MARKER;
  const strokeWidth = 5;

  const { phase, roundIndex, totalRounds, drawerId, word, scores } = gameState ?? {};
  const isDrawer = drawerId === guestId;

  // Listen for draw events from other players
  useEffect(() => {
    return socket.on((msg: any) => {
      if (msg.type === "game:event") {
        if (msg.event === "draw:stroke") {
          const pts: [number, number][] = msg.payload?.points ?? [];
          if (pts.length > 0) {
            setStrokes(s => [...s, { points: pts, color: MARKER, width: strokeWidth }]);
          }
        } else if (msg.event === "draw:clear") {
          setStrokes([]);
        } else if (msg.event === "draw:correct_guess") {
          haptic.correct();
          setGuessLog(l => [...l, { name: msg.payload.displayName, guess: "✓", correct: true }]);
          if (msg.payload.guestId === guestId) setGuessedIt(true);
        } else if (msg.event === "draw:wrong_guess") {
          setGuessLog(l => [...l.slice(-10), { name: "?", guess: msg.payload.guess, correct: false }]);
        }
      }
    });
  }, [guestId]);

  // Redraw canvas whenever strokes change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = POSTIT_BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(stroke.points[0][0], stroke.points[0][1]);
      for (const [x, y] of stroke.points.slice(1)) ctx.lineTo(x, y);
      ctx.stroke();
    }
  }, [strokes]);

  useEffect(() => { setStrokes([]); setGuessLog([]); setGuessedIt(false); setGuessInput(""); }, [roundIndex]);

  // Cutscenes
  const [cutScene, setCutScene] = useState<{ name: string; seq: number } | null>(null);
  const cutSeqRef = useRef(0);
  const prevPhaseRef = useRef<string | null>(null);
  function showCutScene(name: string) { setCutScene({ name, seq: ++cutSeqRef.current }); }
  useEffect(() => {
    if (!gameState) return;
    if (phase !== prevPhaseRef.current) {
      prevPhaseRef.current = phase;
      if (phase === "drawing" && roundIndex === totalRounds - 1) showCutScene("FINAL ROUND");
      if (phase === "game_over") {
        const sorted = [...(scores ?? [])].sort((a: any, b: any) => b.score - a.score);
        if (sorted[0]?.guestId === guestId) showCutScene("WINNER");
      }
    }
  }, [phase]);

  // Fire MASTERPIECE when a guess hits during drawing
  useEffect(() => {
    if (guessedIt) showCutScene("GOT IT");
  }, [guessedIt]);

  function getPos(e: React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement): [number, number] {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return [(t.clientX - rect.left) * scaleX, (t.clientY - rect.top) * scaleY];
    }
    return [((e as React.MouseEvent).clientX - rect.left) * scaleX, ((e as React.MouseEvent).clientY - rect.top) * scaleY];
  }

  function startDraw(e: React.TouchEvent | React.MouseEvent) {
    if (!isDrawer || phase !== "drawing") return;
    e.preventDefault();
    const canvas = canvasRef.current!;
    const pos = getPos(e, canvas);
    setCurrentStroke([pos]);
  }

  function moveDraw(e: React.TouchEvent | React.MouseEvent) {
    if (!isDrawer || !currentStroke || phase !== "drawing") return;
    e.preventDefault();
    const canvas = canvasRef.current!;
    const pos = getPos(e, canvas);
    setCurrentStroke(s => s ? [...s, pos] : [pos]);
    // Draw live on canvas
    const ctx = canvas.getContext("2d")!;
    const pts = currentStroke;
    if (pts.length > 0) {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
      ctx.lineTo(pos[0], pos[1]);
      ctx.stroke();
    }
  }

  function endDraw(e: React.TouchEvent | React.MouseEvent) {
    if (!isDrawer || !currentStroke || phase !== "drawing") return;
    e.preventDefault();
    const finalStroke = currentStroke;
    setStrokes(s => [...s, { points: finalStroke, color, width: strokeWidth }]);
    setCurrentStroke(null);
    if (finalStroke.length > 1) {
      socket.send({ type: "game:action", guestId, roomId, action: "draw:stroke", payload: { points: finalStroke } } as any);
    }
  }

  function clearCanvas() {
    setStrokes([]);
    socket.send({ type: "game:action", guestId, roomId, action: "draw:clear", payload: {} } as any);
    const canvas = canvasRef.current;
    if (canvas) { const ctx = canvas.getContext("2d")!; ctx.fillStyle = POSTIT_BG; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  }

  function revealRound() { socket.send({ type: "game:action", guestId, roomId, action: "draw:reveal", payload: {} } as any); }

  function submitGuess() {
    if (!guessInput.trim() || guessedIt) return;
    socket.send({ type: "game:action", guestId, roomId, action: "draw:guess", payload: { guess: guessInput.trim() } } as any);
    setGuessInput("");
  }

  function nextRound() { socket.send({ type: "host:next_question", guestId, roomId } as any); }

  if (phase === "game_over") return <PodiumScreen scores={scores} guestId={guestId} roomId={roomId} isHost={isHost} />;

  const drawerName = scores?.find((s: any) => s.guestId === drawerId)?.displayName ?? "?";

  return (
    <div className="draw-game" style={{ userSelect: "none" }}>
      <HostMenu guestId={guestId} roomId={roomId} isHost={isHost} phase={phase}
        onForceReveal={() => socket.send({ type: "host:end_round", guestId, roomId } as any)}
        onNext={() => socket.send({ type: "host:next_question", guestId, roomId } as any)}
      />
      <CutScene scene={cutScene} onDone={() => setCutScene(null)} />

      {/* Flagship sketchpad header */}
      <div className="draw-flagship-header">
        <div className="draw-flagship-eyebrow">SKETCHPAD · ROUND {roundIndex + 1} OF {totalRounds}</div>
        <div className="draw-flagship-title">DRAW IT</div>
        <div className="draw-flagship-meta">
          <span className="draw-flagship-drawer">{drawerName}</span>
          <span className="draw-flagship-divider">·</span>
          <span className="draw-flagship-status">{isDrawer ? "you're up" : "is drawing"}</span>
        </div>
      </div>

      {isDrawer && phase === "drawing" && (
        <div className="draw-word-panel">
          <span className="draw-word-eyebrow">DRAW THIS:</span>
          <span className="draw-word-marker">{word}</span>
        </div>
      )}

      {!isDrawer && phase === "drawing" && (
        <div className="draw-watching-panel">
          {guessedIt ? "✓ YOU GOT IT!" : `${drawerName} is drawing…`}
        </div>
      )}

      {/* Post-It canvas — yellow paper, dark marker, tape strip, slight tilt */}
      {phase === "drawing" && (
        <div className="postit-wrap">
          <span className="postit-tape" aria-hidden />
          <canvas
            ref={canvasRef}
            className="postit-canvas"
            width={600}
            height={380}
            onMouseDown={startDraw}
            onMouseMove={moveDraw}
            onMouseUp={endDraw}
            onTouchStart={startDraw}
            onTouchMove={moveDraw}
            onTouchEnd={endDraw}
          />
        </div>
      )}

      {/* Guess log for non-drawers */}
      {phase === "drawing" && !isDrawer && guessLog.length > 0 && (
        <div className="draw-guess-log">
          {guessLog.slice(-5).map((entry, i) => (
            <div key={i} className={`draw-guess-line ${entry.correct ? "draw-guess-correct" : "draw-guess-wrong"}`}>
              {entry.correct ? `✓ ${entry.name} got it!` : entry.guess}
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      {isDrawer && phase === "drawing" && (
        <div style={{ display: "flex", gap: 10, padding: "10px 16px" }}>
          <button className="btn-secondary" style={{ flex: 1, padding: "12px" }} onClick={clearCanvas}>Clear</button>
          {isHost && <button className="next-btn" style={{ flex: 1 }} onClick={revealRound}>Reveal Word</button>}
        </div>
      )}

      {!isDrawer && phase === "drawing" && !guessedIt && (
        <div style={{ display: "flex", gap: 10, padding: "10px 16px" }}>
          <input className="name-input" style={{ flex: 1 }} placeholder="Type your guess…"
            value={guessInput}
            onChange={e => setGuessInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submitGuess()}
          />
          <button className="lets-go-btn" style={{ width: 80, padding: "12px 0" }} onClick={submitGuess}>Go</button>
        </div>
      )}

      {phase === "reveal" && (
        <div className="draw-reveal">
          <div className="draw-reveal-word-panel">
            <span className="draw-reveal-eyebrow">THE WORD WAS</span>
            <span className="draw-reveal-marker">{word}</span>
          </div>
          {scores?.map((s: any, i: number) => (
            <div key={s.guestId} className={`scoreboard-row ${s.guestId === guestId ? "is-me" : ""}`} style={{ marginBottom: 8 }}>
              <span className="scoreboard-rank">#{i+1}</span>
              <span className="scoreboard-name">{s.displayName}</span>
              <span className="scoreboard-score">{s.score.toLocaleString()}</span>
            </div>
          ))}
          {isHost && <div className="host-controls" style={{ marginTop: 16 }}><button className="next-btn" onClick={nextRound}>{roundIndex + 1 >= totalRounds ? "See Final Scores →" : "Next Round →"}</button></div>}
        </div>
      )}
    </div>
  );
}
