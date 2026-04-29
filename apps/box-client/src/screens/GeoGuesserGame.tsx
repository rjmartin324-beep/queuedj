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

// ─── Zoom / pan constants ──────────────────────────────────────────────────
const ZOOM_MIN = 1;
const ZOOM_MAX = 6;
const TAP_THRESHOLD_PX = 6; // movement under this counts as a tap, not a drag

export default function GeoGuesserGame({ guestId, roomId, isHost, gameState }: Props) {
  const [pin, setPin] = useState<Pin | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const mapRef = useRef<SVGSVGElement | null>(null);

  // Zoom + pan state
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  // Touch tracking
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const pinchStartRef = useRef<{
    dist: number; centerX: number; centerY: number;
    zoom: number; panX: number; panY: number;
  } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const lastTapRef = useRef<number>(0); // for double-tap detection

  const { phase, question, scores, questionIndex, totalQuestions, deadline, timeLimit, pins, distances } = gameState ?? {};
  const isReveal = phase === "reveal";

  // Cutscene state
  const [cutScene, setCutScene] = useState<{ name: string; seq: number } | null>(null);
  const cutSeqRef = useRef(0);
  const prevPhaseRef = useRef<string | null>(null);
  function showCutScene(name: string) { setCutScene({ name, seq: ++cutSeqRef.current }); }

  // Reset between questions — including zoom/pan
  useEffect(() => {
    setPin(null);
    setSubmitted(false);
    setPhotoFailed(false);
    setZoom(1);
    setPanX(0);
    setPanY(0);
  }, [questionIndex]);

  // Clamp pan so we can't scroll off the map. View width/height = MAP / zoom.
  function clampPan(z: number, px: number, py: number): { x: number; y: number } {
    const viewW = MAP_W / z;
    const viewH = MAP_H / z;
    return {
      x: Math.max(0, Math.min(MAP_W - viewW, px)),
      y: Math.max(0, Math.min(MAP_H - viewH, py)),
    };
  }

  function setZoomAt(newZoom: number, focusXPx: number, focusYPx: number) {
    // focusXPx/focusYPx are SVG coords (0..MAP_W) of the zoom focus point.
    // We want that point to stay fixed under the pinch center after zoom.
    const z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom));
    if (z === zoom) return;
    // Current view top-left in SVG coords: (panX, panY)
    // The focus point's offset within the current view (in screen %):
    const oldViewW = MAP_W / zoom;
    const oldViewH = MAP_H / zoom;
    const focusU = (focusXPx - panX) / oldViewW; // 0..1
    const focusV = (focusYPx - panY) / oldViewH;
    const newViewW = MAP_W / z;
    const newViewH = MAP_H / z;
    const newPanX = focusXPx - focusU * newViewW;
    const newPanY = focusYPx - focusV * newViewH;
    const c = clampPan(z, newPanX, newPanY);
    setZoom(z);
    setPanX(c.x);
    setPanY(c.y);
  }

  function screenToSvg(clientX: number, clientY: number): { x: number; y: number } | null {
    const svg = mapRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const xPct = (clientX - rect.left) / rect.width;
    const yPct = (clientY - rect.top) / rect.height;
    const viewW = MAP_W / zoom;
    const viewH = MAP_H / zoom;
    return { x: panX + xPct * viewW, y: panY + yPct * viewH };
  }

  // Cutscene triggers based on phase + my distance
  useEffect(() => {
    if (!gameState) return;
    if (phase === prevPhaseRef.current) return;
    prevPhaseRef.current = phase;
    // Reset zoom whenever we transition to reveal so pins don't render at
    // a stale zoom level. (Phase change to "question" already covered by
    // questionIndex effect above.)
    if (phase === "reveal") { setZoom(1); setPanX(0); setPanY(0); }

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

  function dropPinAt(clientX: number, clientY: number) {
    if (submitted || isReveal) return;
    const sv = screenToSvg(clientX, clientY);
    if (!sv) return;
    haptic.tap();
    setPin(pxToLngLat(sv.x, sv.y));
  }

  function handleTouchStart(e: React.TouchEvent<SVGSVGElement>) {
    if (e.touches.length === 2) {
      // Pinch start
      const [t1, t2] = [e.touches[0], e.touches[1]];
      const dx = t2.clientX - t1.clientX;
      const dy = t2.clientY - t1.clientY;
      const dist = Math.hypot(dx, dy);
      const cx = (t1.clientX + t2.clientX) / 2;
      const cy = (t1.clientY + t2.clientY) / 2;
      pinchStartRef.current = { dist, centerX: cx, centerY: cy, zoom, panX, panY };
      touchStartRef.current = null;
      dragStartRef.current = null;
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      touchStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
      // If we're already zoomed in, treat single-finger move as pan
      if (zoom > 1) dragStartRef.current = { x: t.clientX, y: t.clientY, panX, panY };
      pinchStartRef.current = null;
    }
  }

  function handleTouchMove(e: React.TouchEvent<SVGSVGElement>) {
    // Pinch zoom
    if (e.touches.length === 2 && pinchStartRef.current) {
      e.preventDefault();
      const [t1, t2] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const ratio = dist / pinchStartRef.current.dist;
      const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, pinchStartRef.current.zoom * ratio));
      // Pinch center in SVG coords (using the ORIGINAL zoom/pan from gesture start)
      const sv = svgFromPan(
        pinchStartRef.current.centerX, pinchStartRef.current.centerY,
        pinchStartRef.current.zoom, pinchStartRef.current.panX, pinchStartRef.current.panY,
      );
      if (sv) setZoomAt(newZoom, sv.x, sv.y);
      return;
    }
    // Single-finger pan when zoomed
    if (e.touches.length === 1 && dragStartRef.current && zoom > 1) {
      e.preventDefault();
      const t = e.touches[0];
      const svg = mapRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const dxScreen = t.clientX - dragStartRef.current.x;
      const dyScreen = t.clientY - dragStartRef.current.y;
      // Convert screen-pixel delta to SVG-coord delta (panning the view in the opposite direction)
      const viewW = MAP_W / zoom;
      const viewH = MAP_H / zoom;
      const dxSvg = (dxScreen / rect.width) * viewW;
      const dySvg = (dyScreen / rect.height) * viewH;
      const c = clampPan(zoom, dragStartRef.current.panX - dxSvg, dragStartRef.current.panY - dySvg);
      setPanX(c.x);
      setPanY(c.y);
    }
  }

  function handleTouchEnd(e: React.TouchEvent<SVGSVGElement>) {
    // End of pinch
    if (pinchStartRef.current && e.touches.length < 2) {
      pinchStartRef.current = null;
    }
    // If dragging, decide tap vs drag
    if (touchStartRef.current && e.touches.length === 0) {
      const t = e.changedTouches[0];
      if (t) {
        const dx = t.clientX - touchStartRef.current.x;
        const dy = t.clientY - touchStartRef.current.y;
        const moved = Math.hypot(dx, dy);
        const elapsed = Date.now() - touchStartRef.current.t;
        if (moved < TAP_THRESHOLD_PX && elapsed < 400) {
          // Tap — check for double-tap to zoom in
          const now = Date.now();
          if (now - lastTapRef.current < 300) {
            // Double-tap → zoom in 2x at this point
            const sv = screenToSvg(t.clientX, t.clientY);
            if (sv) setZoomAt(Math.min(ZOOM_MAX, zoom * 2), sv.x, sv.y);
            lastTapRef.current = 0; // reset
          } else {
            // Single tap → drop pin (after a short delay so a double-tap can override)
            const tx = t.clientX, ty = t.clientY;
            lastTapRef.current = now;
            setTimeout(() => {
              if (lastTapRef.current === now) dropPinAt(tx, ty);
            }, 280);
          }
        }
      }
      touchStartRef.current = null;
      dragStartRef.current = null;
    }
  }

  // Helper: screen → SVG using arbitrary zoom/pan (used during gesture)
  function svgFromPan(clientX: number, clientY: number, z: number, px: number, py: number) {
    const svg = mapRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const xPct = (clientX - rect.left) / rect.width;
    const yPct = (clientY - rect.top) / rect.height;
    const viewW = MAP_W / z;
    const viewH = MAP_H / z;
    return { x: px + xPct * viewW, y: py + yPct * viewH };
  }

  // Mouse fallback for desktop testing
  function handleMouseClick(e: React.MouseEvent<SVGSVGElement>) {
    dropPinAt(e.clientX, e.clientY);
  }
  function handleWheel(e: React.WheelEvent<SVGSVGElement>) {
    if (submitted || isReveal) return;
    const sv = screenToSvg(e.clientX, e.clientY);
    if (!sv) return;
    const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
    setZoomAt(zoom * factor, sv.x, sv.y);
  }

  // Zoom controls (buttons)
  function zoomIn() {
    haptic.tap();
    setZoomAt(Math.min(ZOOM_MAX, zoom * 1.5), panX + (MAP_W / zoom) / 2, panY + (MAP_H / zoom) / 2);
  }
  function zoomOut() {
    haptic.tap();
    setZoomAt(Math.max(ZOOM_MIN, zoom / 1.5), panX + (MAP_W / zoom) / 2, panY + (MAP_H / zoom) / 2);
  }
  function zoomReset() {
    haptic.tap();
    setZoom(1); setPanX(0); setPanY(0);
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
          viewBox={`${panX} ${panY} ${MAP_W / zoom} ${MAP_H / zoom}`}
          preserveAspectRatio="xMidYMid meet"
          onClick={handleMouseClick}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* World map background loaded from /world.svg */}
          <image href="/world.svg" x={0} y={0} width={MAP_W} height={MAP_H} preserveAspectRatio="xMidYMid meet" />

          {/* My live pin (pre-submit) — scale radii inversely with zoom so
              the pin stays roughly constant size on screen */}
          {livePinPx && (
            <g className="geo-pin-live">
              <circle cx={livePinPx.x} cy={livePinPx.y} r={28 / zoom} className="geo-pin-halo" />
              <circle cx={livePinPx.x} cy={livePinPx.y} r={14 / zoom} className="geo-pin-dot" />
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

        {/* Zoom controls — pinch + double-tap also work, this is the explicit
            backup for users who want buttons. Only visible during question phase. */}
        {!isReveal && (
          <div className="geo-zoom-controls">
            <button className="geo-zoom-btn" aria-label="Zoom in" onClick={zoomIn} disabled={zoom >= ZOOM_MAX}>+</button>
            <div className="geo-zoom-level">{zoom.toFixed(1)}×</div>
            <button className="geo-zoom-btn" aria-label="Zoom out" onClick={zoomOut} disabled={zoom <= ZOOM_MIN}>−</button>
            {zoom > 1 && (
              <button className="geo-zoom-btn geo-zoom-reset" aria-label="Reset zoom" onClick={zoomReset}>⟲</button>
            )}
          </div>
        )}
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
