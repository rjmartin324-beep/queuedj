import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  PanResponder, GestureResponderEvent,
} from "react-native";
import { useRoom } from "../../../contexts/RoomContext";

// ─────────────────────────────────────────────────────────────────────────────
// Drawback — DrawingView
// Finger-drawing canvas with prompt, 60s timer bar turning red, color picker,
// clear + submit buttons. Sends a placeholder dataUrl since real SVG export
// is deferred to a native module.
// ─────────────────────────────────────────────────────────────────────────────

const ACCENT = "#3b82f6";
const TIMER_TOTAL = 60;

const PALETTE = [
  "#ffffff",
  "#ef4444",
  "#f59e0b",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
];

interface Dot { x: number; y: number; color: string; size: number }

export function DrawingView() {
  const { state, sendAction } = useRoom();
  const data = state.guestViewData as any;
  const prompt: string = data?.prompt ?? "Draw something!";

  const [dots, setDots] = useState<Dot[]>([]);
  const [activeColor, setActiveColor] = useState(PALETTE[0]);
  const [timeLeft, setTimeLeft] = useState(TIMER_TOTAL);
  const [submitted, setSubmitted] = useState(false);
  const startedAt = useRef(Date.now());
  const canvasRef = useRef<View>(null);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  // Countdown
  useEffect(() => {
    const iv = setInterval(() => {
      const elapsed = (Date.now() - startedAt.current) / 1000;
      const remaining = Math.max(0, TIMER_TOTAL - Math.floor(elapsed));
      setTimeLeft(remaining);
      if (remaining <= 0) clearInterval(iv);
    }, 500);
    return () => clearInterval(iv);
  }, []);

  const timerPct = timeLeft / TIMER_TOTAL;
  const timerColor = timerPct > 0.4 ? ACCENT : timerPct > 0.15 ? "#f59e0b" : "#ef4444";
  const isUrgent = timeLeft <= 10;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        const { locationX, locationY } = e.nativeEvent;
        lastPoint.current = { x: locationX, y: locationY };
        setDots(prev => [...prev, { x: locationX, y: locationY, color: activeColor, size: 5 }]);
      },
      onPanResponderMove: (e: GestureResponderEvent) => {
        const { locationX, locationY } = e.nativeEvent;
        const last = lastPoint.current;
        if (!last) return;
        // Interpolate dots between last and current for smooth lines
        const dx = locationX - last.x;
        const dy = locationY - last.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.max(1, Math.floor(dist / 4));
        const newDots: Dot[] = [];
        for (let i = 1; i <= steps; i++) {
          newDots.push({
            x: last.x + (dx * i) / steps,
            y: last.y + (dy * i) / steps,
            color: activeColor,
            size: 5,
          });
        }
        lastPoint.current = { x: locationX, y: locationY };
        setDots(prev => [...prev, ...newDots]);
      },
      onPanResponderRelease: () => {
        lastPoint.current = null;
      },
    })
  ).current;

  // Keep color ref in sync for panResponder closure
  const colorRef = useRef(activeColor);
  useEffect(() => { colorRef.current = activeColor; }, [activeColor]);

  // Re-create panResponder when color changes so closure has fresh color
  // Instead use ref trick: read colorRef inside handler
  const panResponderWithColor = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !submitted,
      onMoveShouldSetPanResponder: () => !submitted,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        const { locationX, locationY } = e.nativeEvent;
        lastPoint.current = { x: locationX, y: locationY };
        setDots(prev => [...prev, { x: locationX, y: locationY, color: colorRef.current, size: 5 }]);
      },
      onPanResponderMove: (e: GestureResponderEvent) => {
        const { locationX, locationY } = e.nativeEvent;
        const last = lastPoint.current;
        if (!last) return;
        const dx = locationX - last.x;
        const dy = locationY - last.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.max(1, Math.floor(dist / 4));
        const newDots: Dot[] = [];
        for (let i = 1; i <= steps; i++) {
          newDots.push({
            x: last.x + (dx * i) / steps,
            y: last.y + (dy * i) / steps,
            color: colorRef.current,
            size: 5,
          });
        }
        lastPoint.current = { x: locationX, y: locationY };
        setDots(prev => [...prev, ...newDots]);
      },
      onPanResponderRelease: () => { lastPoint.current = null; },
    })
  ).current;

  function clear() {
    setDots([]);
  }

  function submit() {
    if (submitted) return;
    setSubmitted(true);
    sendAction("submit_drawing", { dataUrl: "sketch_placeholder" });
  }

  if (submitted) {
    return (
      <View style={styles.root}>
        <View style={styles.submittedScreen}>
          <Text style={styles.submittedIcon}>✏️</Text>
          <Text style={styles.submittedTitle}>Drawing Locked!</Text>
          <Text style={styles.submittedSub}>Waiting for everyone to finish...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Timer bar */}
      <View style={styles.timerBarTrack}>
        <View style={[styles.timerBarFill, { width: `${timerPct * 100}%`, backgroundColor: timerColor }]} />
      </View>

      {/* Prompt */}
      <View style={styles.promptRow}>
        <View style={styles.promptPill}>
          <Text style={styles.promptLabel}>DRAW THIS</Text>
        </View>
        <Text style={[styles.timerText, isUrgent && styles.timerTextUrgent]}>
          {timeLeft}s
        </Text>
      </View>
      <Text style={styles.promptText}>{prompt}</Text>

      {/* Canvas */}
      <View
        ref={canvasRef}
        style={styles.canvas}
        {...panResponderWithColor.panHandlers}
      >
        {dots.map((dot, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                left: dot.x - dot.size / 2,
                top: dot.y - dot.size / 2,
                width: dot.size,
                height: dot.size,
                borderRadius: dot.size / 2,
                backgroundColor: dot.color,
              },
            ]}
          />
        ))}
        {dots.length === 0 && (
          <Text style={styles.canvasHint}>Draw here with your finger</Text>
        )}
        {timeLeft === 0 && (
          <View style={styles.timeUpOverlay}>
            <Text style={styles.timeUpText}>Time's Up!</Text>
          </View>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {/* Color picker */}
        <View style={styles.paletteRow}>
          {PALETTE.map((c) => (
            <TouchableOpacity
              key={c}
              onPress={() => setActiveColor(c)}
              style={[
                styles.colorSwatch,
                { backgroundColor: c },
                activeColor === c && styles.colorSwatchActive,
              ]}
            />
          ))}
        </View>

        {/* Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.clearBtn} onPress={clear}>
            <Text style={styles.clearBtnText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitBtn, timeLeft === 0 && styles.submitBtnDisabled]}
            onPress={submit}
            disabled={timeLeft === 0 && dots.length === 0}
          >
            <Text style={styles.submitBtnText}>Submit Drawing</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:              { flex: 1, backgroundColor: "#08081a" },

  // Timer bar
  timerBarTrack:     { height: 5, backgroundColor: "#1e1e3a", overflow: "hidden" },
  timerBarFill:      { height: "100%", borderRadius: 2 },

  // Prompt
  promptRow:         { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4, gap: 10 },
  promptPill:        { backgroundColor: ACCENT + "22", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  promptLabel:       { color: ACCENT, fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  timerText:         { color: "#fff", fontSize: 22, fontWeight: "900", marginLeft: "auto" },
  timerTextUrgent:   { color: "#ef4444" },
  promptText:        { color: "#fff", fontSize: 22, fontWeight: "900", paddingHorizontal: 16, paddingBottom: 12, lineHeight: 28 },

  // Canvas
  canvas: {
    flex: 1,
    marginHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "#12122a",
    borderWidth: 1,
    borderColor: "#1e1e3a",
    overflow: "hidden",
    position: "relative",
  },
  dot:               { position: "absolute" },
  canvasHint:        { position: "absolute", top: "46%", left: 0, right: 0, textAlign: "center", color: "#2a2a4a", fontSize: 14, fontWeight: "600" },
  timeUpOverlay:     { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center" },
  timeUpText:        { color: "#ef4444", fontSize: 36, fontWeight: "900" },

  // Controls
  controls:          { padding: 14, gap: 12 },
  paletteRow:        { flexDirection: "row", justifyContent: "center", gap: 12 },
  colorSwatch:       { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: "transparent" },
  colorSwatchActive: { borderColor: "#fff", transform: [{ scale: 1.15 }] },
  buttonRow:         { flexDirection: "row", gap: 10 },
  clearBtn:          { flex: 1, paddingVertical: 15, backgroundColor: "#12122a", borderRadius: 14, alignItems: "center", borderWidth: 1, borderColor: "#1e1e3a" },
  clearBtnText:      { color: "#888", fontWeight: "700", fontSize: 15 },
  submitBtn:         { flex: 2, paddingVertical: 15, backgroundColor: ACCENT, borderRadius: 14, alignItems: "center" },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText:     { color: "#fff", fontWeight: "800", fontSize: 15 },

  // Submitted screen
  submittedScreen:   { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  submittedIcon:     { fontSize: 56 },
  submittedTitle:    { color: "#fff", fontSize: 28, fontWeight: "900" },
  submittedSub:      { color: "#888", fontSize: 15, textAlign: "center" },
});
