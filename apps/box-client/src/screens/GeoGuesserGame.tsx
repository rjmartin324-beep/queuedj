import { useState, useEffect, useRef } from "react";
import { socket } from "../ws";
import { haptic } from "../haptics";
import PodiumScreen from "../components/PodiumScreen";
import TimerBar from "../components/TimerBar";
import HostMenu from "../components/HostMenu";
import CutScene from "../components/CutScene";

interface Props { guestId: string; roomId: string; isHost: boolean; gameState: any; }

interface Pin { lat: number; lng: number; }

// Equirectangular projection helpers — match the BlankMap-World.svg viewBox
// (Wikimedia's standard blank world map is 2754 x 1398, equirectangular,
// covering the full -180..180 lng × -90..90 lat range.)
const MAP_W = 2754;
const MAP_H = 1398;

function lngLatToPx(lng: number, lat: number): { x: number; y: number } {
  const x = ((lng + 180) / 360) * MAP_W;
  const y = ((90 - lat) / 180) * MAP_H;
  return { x, y };
}

function pxToLngLat(x: number, y: number): { lat: number; lng: number } {
  const lng = (x / MAP_W) * 360 - 180;
  const lat = 90 - (y / MAP_H) * 180;
  return { lat, lng };
}

function fmtKm(km: number): string {
  if (km < 1) return "<1 km";
  if (km < 100) return `${km.toFixed(1)} km`;
  return `${Math.round(km).toLocaleString()} km`;
}

export default function GeoGuesserGame({ guestId, roomId, isHost, gameState }: Props) {
  const [pin, setPin] = useState<Pin | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const mapRef = useRef<SVGSVGElement | null>(null);

  const { phase, question, scores, questionIndex, totalQuestions, deadline, timeLimit, pins, distances } = gameState ?? {};
  const isReveal = phase === "reveal";

  // Cutscene state
  const [cutScene, setCutScene] = useState<{ name: string; seq: number } | null>(null);
  const cutSeqRef = useRef(0);
  const prevPhaseRef = useRef<string | null>(null);
  function showCutScene(name: string) { setCutScene({ name, seq: ++cutSeqRef.current }); }

  // Reset between questions
  useEffect(() => {
    setPin(null);
    setSubmitted(false);
    setPhotoFailed(false);
  }, [questionIndex]);

  // Cutscene triggers based on phase + my distance
  useEffect(() => {
    if (!gameState) return;
    if (phase === prevPhaseRef.current) return;
    prevPhaseRef.current = phase;

    if (phase === "question" && questionIndex === totalQuestions - 1) {
      showCutScene("FINAL DROP");
    }
    if (phase === "reveal") {
      const myDist: number | undefined = distances?.[guestId];
      if (myDist !== undefined) {
        if (myDist < 50) showCutScene("PINPOINT");
        else if (myDist < 250) showCutScene("DEAD ON");
        else if (myDist < 1000) showCutScene("CLOSE CALL");
        else if (myDist > 12000) showCutScene("WAY OFF");
      }
    }
    if (phase === "game_over") {
      const sorted = [...(scores ?? [])].sort((a: any, b: any) => b.score - a.score);
      if (sorted[0]?.guestId === guestId) showCutScene("WORLD CHAMP");
    }
  }, [phase]);

  function handleMapClick(e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) {
    if (submitted || isReveal) return;
    const svg = mapRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ("touches" in e) {
      const t = (e as React.TouchEvent).changedTouches[0] ?? (e as React.TouchEvent).touches[0];
      if (!t) return;
      clientX = t.clientX; clientY = t.clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    const xPct = (clientX - rect.left) / rect.width;
    const yPct = (clientY - rect.top) / rect.height;
    const x = xPct * MAP_W;
    const y = yPct * MAP_H;
    const ll = pxToLngLat(x, y);
    haptic.tap();
    setPin(ll);
  }

  function submit() {
    if (!pin || submitted) return;
    haptic.lock();
    setSubmitted(true);
    socket.send({ type: "game:action", guestId, roomId, action: "geo:pin", payload: { lat: pin.lat, lng: pin.lng } } as any);
  }

  function next() { socket.send({ type: "host:next_question", guestId, roomId } as any); }

  if (phase === "game_over") return <PodiumScreen scores={scores} guestId={guestId} roomId={roomId} isHost={isHost} />;

  if (phase === "countdown") {
    return <div className="game-loading"><div className="loading-spinner" /><p style={{ color: "var(--text-muted)", marginTop: 12 }}>Q {questionIndex + 1} / {totalQuestions}</p></div>;
  }

  const totalPlayers = scores?.length ?? 0;
  const pinnedCount = pins ? Object.keys(pins).length : 0;
  const myPin: Pin | undefined = pins?.[guestId];
  const myDistance: number | undefined = distances?.[guestId];

  const correctPx = isReveal && question ? lngLatToPx(question.lng, question.lat) : null;
  const myPinPx = myPin ? lngLatToPx(myPin.lng, myPin.lat) : null;
  const livePinPx = !isReveal && pin ? lngLatToPx(pin.lng, pin.lat) : null;

  return (
    <div className="geo-game">
      <HostMenu guestId={guestId} roomId={roomId} isHost={isHost} phase={phase} />
      <CutScene scene={cutScene} onDone={() => setCutScene(null)} />

      {/* Atlas-style header — replaces the generic trivia-header */}
      <div className="geo-header">
        <div className="geo-header-eyebrow">EXPEDITION №{String(questionIndex + 1).padStart(2, "0")} OF {String(totalQuestions).padStart(2, "0")}</div>
        <div className="geo-header-title">GEOGUESSER</div>
        <div className="geo-header-meta">
          <span>{pinnedCount}/{totalPlayers} pinned</span>
          {phase === "question" && deadline && <span className="geo-header-divider">·</span>}
        </div>
      </div>

      {question && (
        <div className="geo-frame geo-photo-frame">
          {!photoFailed && question.photoUrl && (
            <img
              className="geo-photo"
              src={question.photoUrl}
              alt="Where in the world?"
              onError={() => setPhotoFailed(true)}
            />
          )}
          {photoFailed && (
            <div className="geo-photo-fallback">
              <div className="geo-photo-fallback-eyebrow">PHOTO UNAVAILABLE</div>
              <div className="geo-photo-fallback-title">Where in the world?</div>
              <div className="geo-photo-fallback-hint">Tap the map where you think it is.</div>
            </div>
          )}
          {phase === "question" && (
            <TimerBar
              deadline={deadline}
              timeLimit={timeLimit}
              onExpire={isHost ? () => socket.send({ type: "host:end_round", guestId, roomId } as any) : undefined}
            />
          )}
        </div>
      )}

      <div className="geo-frame geo-map-wrap">
        <svg
          ref={mapRef}
          className="geo-map"
          viewBox={`0 0 ${MAP_W} ${MAP_H}`}
          preserveAspectRatio="xMidYMid meet"
          onClick={handleMapClick}
          onTouchEnd={handleMapClick}
        >
          {/* World map background loaded from /world.svg */}
          <image href="/world.svg" x={0} y={0} width={MAP_W} height={MAP_H} preserveAspectRatio="xMidYMid meet" />

          {/* My live pin (pre-submit) */}
          {livePinPx && (
            <g className="geo-pin-live">
              <circle cx={livePinPx.x} cy={livePinPx.y} r={28} className="geo-pin-halo" />
              <circle cx={livePinPx.x} cy={livePinPx.y} r={14} className="geo-pin-dot" />
            </g>
          )}

          {/* Reveal: my submitted pin */}
          {isReveal && myPinPx && (
            <g>
              <circle cx={myPinPx.x} cy={myPinPx.y} r={16} className="geo-pin-mine" />
              <text x={myPinPx.x} y={myPinPx.y - 24} className="geo-pin-label">YOU</text>
            </g>
          )}

          {/* Reveal: other players' pins (smaller, less prominent) */}
          {isReveal && pins && Object.entries(pins).map(([gid, p]: [string, any]) => {
            if (gid === guestId) return null;
            const px = lngLatToPx(p.lng, p.lat);
            const name = scores?.find((s: any) => s.guestId === gid)?.displayName ?? "?";
            return (
              <g key={gid} className="geo-pin-other">
                <circle cx={px.x} cy={px.y} r={10} />
                <text x={px.x} y={px.y - 16} className="geo-pin-other-label">{name}</text>
              </g>
            );
          })}

          {/* Reveal: correct location */}
          {isReveal && correctPx && (
            <g className="geo-pin-correct">
              <circle cx={correctPx.x} cy={correctPx.y} r={32} className="geo-correct-halo" />
              <circle cx={correctPx.x} cy={correctPx.y} r={14} className="geo-correct-dot" />
              <text x={correctPx.x} y={correctPx.y - 24} className="geo-pin-label-correct">📍 ANSWER</text>
            </g>
          )}

          {/* Reveal: line from my pin to correct */}
          {isReveal && myPinPx && correctPx && (
            <line
              x1={myPinPx.x} y1={myPinPx.y}
              x2={correctPx.x} y2={correctPx.y}
              className="geo-distance-line"
            />
          )}
        </svg>
      </div>

      {/* Submit button + reveal panel */}
      {!isReveal && (
        <div className="geo-controls">
          {!submitted ? (
            <button className="geo-submit-btn" disabled={!pin} onClick={submit}>
              {pin ? "Lock my pin →" : "Tap the map first"}
            </button>
          ) : (
            <div className="geo-locked">✓ Pin locked — waiting for others ({pinnedCount}/{totalPlayers})</div>
          )}
        </div>
      )}

      {isReveal && question && (
        <div className="geo-reveal">
          <div className="geo-reveal-location">
            <div className="geo-reveal-eyebrow">THE ANSWER</div>
            <div className="geo-reveal-place">{question.location}</div>
            <div className="geo-reveal-country">{question.country}</div>
          </div>
          {myDistance !== undefined && (
            <div className="geo-reveal-distance">
              <span className="geo-reveal-distance-label">You were off by</span>
              <span className="geo-reveal-distance-value">{fmtKm(myDistance)}</span>
            </div>
          )}
          <div className="geo-reveal-leaderboard">
            {[...(scores ?? [])].sort((a: any, b: any) => b.score - a.score).slice(0, 5).map((s: any, i: number) => {
              const dist = distances?.[s.guestId];
              return (
                <div key={s.guestId} className={`scoreboard-row ${s.guestId === guestId ? "is-me" : ""}`}>
                  <span className="scoreboard-rank">#{i + 1}</span>
                  <span className="scoreboard-name">{s.displayName}</span>
                  <span className="scoreboard-score">{s.score.toLocaleString()}</span>
                  {dist !== undefined && <span style={{ marginLeft: 8, color: "var(--text-muted)", fontSize: "0.78rem" }}>· {fmtKm(dist)}</span>}
                </div>
              );
            })}
          </div>
          {isHost && (
            <div className="host-controls" style={{ marginTop: 14 }}>
              <button className="next-btn" onClick={next}>
                {questionIndex + 1 >= totalQuestions ? "See Final Scores →" : "Next →"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
