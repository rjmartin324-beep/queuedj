import React, { useRef, useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  PanResponder, GestureResponderEvent,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { useRoom } from "../../../contexts/RoomContext";
import type { DrawingData, DrawingPath } from "@queuedj/shared-types";

// ─────────────────────────────────────────────────────────────────────────────
// DrawingCanvas — 60-second freehand drawing
// Strokes are sent to server in real-time via "drawing_stroke" action
// Host can see all drawings live; guests just draw
// ─────────────────────────────────────────────────────────────────────────────

const COLORS    = ["#ffffff", "#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7"];
const WIDTHS    = [2, 4, 8, 16];

export function DrawingCanvas() {
  const { state, sendAction } = useRoom();
  const data      = state.guestViewData as any;
  const prompt    = data?.prompt    as string | undefined;
  const drawingMs = data?.drawingMs as number ?? 60000;

  const [paths, setPaths]           = useState<DrawingPath[]>([]);
  const [currentPath, setCurrentPath] = useState<string>("");
  const [color, setColor]           = useState(COLORS[0]);
  const colorRef                    = useRef(COLORS[0]);
  const [width, setWidth]           = useState(WIDTHS[1]);
  const widthRef                    = useRef(WIDTHS[1]);
  const [timeLeft, setTimeLeft]     = useState(Math.ceil(drawingMs / 1000));
  const [startedAt]                 = useState(Date.now());
  const [done, setDone]             = useState(false);

  const canvasLayout = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const pathRef      = useRef<Array<[number, number]>>([]);

  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { widthRef.current = width; }, [width]);

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, Math.ceil((drawingMs - elapsed) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        setDone(true);
        clearInterval(interval);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [drawingMs, startedAt]);

  // Broadcast latest drawing state
  function broadcast(updatedPaths: DrawingPath[]) {
    const drawing: DrawingData = { paths: updatedPaths, width: canvasLayout.current.width, height: canvasLayout.current.height };
    sendAction("drawing_stroke", { drawing });
  }

  function pointsToSvgD(pts: Array<[number, number]>): string {
    if (pts.length === 0) return "";
    const [sx, sy] = pts[0];
    let d = `M ${sx} ${sy}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i][0]} ${pts[i][1]}`;
    }
    return d;
  }

  function pathToSvgD(p: DrawingPath): string {
    return pointsToSvgD(p.points.map((pt) => [pt.x, pt.y]));
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !done,
      onMoveShouldSetPanResponder:  () => !done,

      onPanResponderGrant: (e: GestureResponderEvent) => {
        const { locationX, locationY } = e.nativeEvent;
        pathRef.current = [[locationX, locationY]];
        setCurrentPath(pointsToSvgD([[locationX, locationY]]));
      },

      onPanResponderMove: (e: GestureResponderEvent) => {
        const { locationX, locationY } = e.nativeEvent;
        pathRef.current.push([locationX, locationY]);
        setCurrentPath(pointsToSvgD(pathRef.current));
      },

      onPanResponderRelease: () => {
        if (pathRef.current.length < 2) return;
        const newPath: DrawingPath = {
          points:     pathRef.current.map(([x, y]) => ({ x, y })),
          color: colorRef.current,
          strokeWidth: widthRef.current,
        };
        setPaths((prev) => {
          const updated = [...prev, newPath];
          broadcast(updated);
          return updated;
        });
        pathRef.current = [];
        setCurrentPath("");
      },
    })
  ).current;

  function undo() {
    setPaths((prev) => {
      const updated = prev.slice(0, -1);
      broadcast(updated);
      return updated;
    });
  }

  function clear() {
    setPaths([]);
    broadcast([]);
  }

  const urgency = timeLeft <= 10;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.promptLabel}>Draw: <Text style={styles.promptName}>{prompt}</Text></Text>
        <Text style={[styles.timer, urgency && styles.timerUrgent]}>{timeLeft}s</Text>
      </View>

      {/* Canvas */}
      <View
        style={styles.canvas}
        onLayout={(e) => {
          const { x, y, width: w, height: h } = e.nativeEvent.layout;
          canvasLayout.current = { x, y, width: w, height: h };
        }}
        {...panResponder.panHandlers}
      >
        <Svg width="100%" height="100%">
          {paths.map((p, i) => (
            <Path key={i} d={pathToSvgD(p)} stroke={p.color} strokeWidth={p.strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {currentPath ? (
            <Path d={currentPath} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ) : null}
        </Svg>
        {done && (
          <View style={styles.doneOverlay}>
            <Text style={styles.doneText}>Time's up!</Text>
          </View>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <View style={styles.colorRow}>
          {COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.colorBtn, { backgroundColor: c }, color === c && styles.colorBtnActive]}
              onPress={() => setColor(c)}
            />
          ))}
        </View>
        <View style={styles.widthRow}>
          {WIDTHS.map((w) => (
            <TouchableOpacity
              key={w}
              style={[styles.widthBtn, width === w && styles.widthBtnActive]}
              onPress={() => setWidth(w)}
            >
              <View style={[styles.widthDot, { width: w * 2, height: w * 2, borderRadius: w }]} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.undoBtn} onPress={undo}>
            <Text style={styles.undoBtnText}>Undo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.undoBtn} onPress={clear}>
            <Text style={styles.undoBtnText}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: "#0a0a0a" },
  header:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10 },
  promptLabel:    { color: "#888", fontSize: 13 },
  promptName:     { color: "#fff", fontWeight: "700" },
  timer:          { color: "#fff", fontSize: 22, fontWeight: "800" },
  timerUrgent:    { color: "#ef4444" },
  canvas:         { flex: 1, backgroundColor: "#1a1a1a", margin: 8, borderRadius: 12, overflow: "hidden" },
  doneOverlay:    { ...StyleSheet.absoluteFillObject, backgroundColor: "#00000099", alignItems: "center", justifyContent: "center" },
  doneText:       { color: "#fff", fontSize: 32, fontWeight: "900" },
  controls:       { padding: 12, gap: 10 },
  colorRow:       { flexDirection: "row", gap: 10, justifyContent: "center" },
  colorBtn:       { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: "transparent" },
  colorBtnActive: { borderColor: "#fff" },
  widthRow:       { flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center" },
  widthBtn:       { width: 36, height: 36, borderRadius: 8, backgroundColor: "#222", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#333" },
  widthBtnActive: { borderColor: "#6c47ff" },
  widthDot:       { backgroundColor: "#fff" },
  undoBtn:        { backgroundColor: "#2a2a2a", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  undoBtnText:    { color: "#fff", fontSize: 13 },
});
