import React, { useRef, useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  PanResponder, Dimensions, ScrollView,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

const { width: SW } = Dimensions.get("window");
const CANVAS_SIZE = SW - 32;

const COLORS = ["#ffffff", "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7", "#ec4899"];
const WIDTHS = [3, 6, 10];

interface StrokePoint { x: number; y: number; }
interface Stroke { points: StrokePoint[]; color: string; width: number; }

function pointsToPath(points: StrokePoint[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0].x},${points[0].y} L${points[0].x},${points[0].y}`;
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L${points[i].x},${points[i].y}`;
  }
  return d;
}

export function DrawItView() {
  const { state, sendAction } = useRoom();
  const expState = state.guestViewData as any ?? state.experienceState as any;

  const phase: string          = expState?.phase ?? "waiting";
  const currentDrawer: string  = expState?.currentDrawer ?? "";
  const currentPrompt: string  = expState?.currentPrompt ?? "";
  const strokes: Stroke[]      = expState?.strokes ?? [];
  const correctGuessers: string[] = expState?.correctGuessers ?? [];
  const round: number          = expState?.round ?? 1;
  const totalRounds: number    = expState?.totalRounds ?? 5;
  const scores: Record<string, number> = expState?.scores ?? {};

  const isDrawer = state.guestId === currentDrawer;
  const hasGuessedCorrectly = correctGuessers.includes(state.guestId ?? "");

  const [selectedColor, setSelectedColor] = useState("#ffffff");
  const [selectedWidth, setSelectedWidth] = useState(4);
  const [guessText, setGuessText]         = useState("");
  const [guessSent, setGuessSent]         = useState(false);
  const currentStroke = useRef<StrokePoint[]>([]);
  // liveStrokes accumulates committed strokes locally for the drawer so server
  // broadcasts (triggered by guess events etc.) don't cause a visual stutter.
  // Guessers always read from server `strokes` directly.
  const [liveStrokes, setLiveStrokes] = useState<Stroke[]>([]);

  // Reset local canvas when round advances or the host clears
  useEffect(() => {
    if (isDrawer) setLiveStrokes([]);
  }, [round, currentDrawer]);

  // Refs so panResponder callbacks always see the latest values without being recreated
  const isDrawerRef      = useRef(false);
  const phaseRef         = useRef("waiting");
  const selectedColorRef = useRef("#ffffff");
  const selectedWidthRef = useRef(4);
  isDrawerRef.current      = isDrawer;
  phaseRef.current         = phase;
  selectedColorRef.current = selectedColor;
  selectedWidthRef.current = selectedWidth;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isDrawerRef.current && phaseRef.current === "drawing",
      onMoveShouldSetPanResponder:  () => isDrawerRef.current && phaseRef.current === "drawing",
      onPanResponderGrant: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        currentStroke.current = [{ x: Math.round(locationX), y: Math.round(locationY) }];
        setLiveStrokes(prev => [...prev, { points: currentStroke.current, color: selectedColorRef.current, width: selectedWidthRef.current }]);
      },
      onPanResponderMove: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        currentStroke.current = [...currentStroke.current, { x: Math.round(locationX), y: Math.round(locationY) }];
        setLiveStrokes(prev => [...prev.slice(0, -1), { points: currentStroke.current, color: selectedColorRef.current, width: selectedWidthRef.current }]);
      },
      onPanResponderRelease: () => {
        if (currentStroke.current.length > 0) {
          const committed: Stroke = { points: currentStroke.current, color: selectedColorRef.current, width: selectedWidthRef.current };
          sendAction("stroke", { points: committed.points, color: committed.color, width: committed.width });
          currentStroke.current = [];
          // Keep the committed stroke in liveStrokes so server broadcasts don't cause stutter
          setLiveStrokes(prev => [...prev.slice(0, -1), committed]);
        }
      },
    })
  ).current;

  function handleClear() {
    sendAction("clear_canvas", {});
    setLiveStrokes([]);
  }

  function handleGuess() {
    const text = guessText.trim();
    if (!text) return;
    sendAction("guess", { text });
    setGuessText("");
    setGuessSent(true);
    setTimeout(() => setGuessSent(false), 2000);
  }

  const memberName = useCallback((id: string) =>
    state.members.find(m => m.guestId === id)?.displayName ?? id.slice(0, 6),
  [state.members]);

  if (phase === "waiting") {
    return (
      <View style={styles.center}>
        <Text style={styles.waitEmoji}>🎨</Text>
        <Text style={styles.waitTitle}>Draw It</Text>
        <Text style={styles.waitSub}>Waiting for the host to start...</Text>
      </View>
    );
  }

  if (phase === "finished") {
    const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.finishContent}>
        <Text style={styles.finishTitle}>Game Over!</Text>
        {sorted.map(([id, pts], i) => (
          <View key={id} style={styles.scoreRow}>
            <Text style={styles.scoreRank}>#{i + 1}</Text>
            <Text style={styles.scoreName}>{memberName(id)}</Text>
            <Text style={styles.scorePts}>{pts} pts</Text>
          </View>
        ))}
      </ScrollView>
    );
  }

  // Drawer: use fully-local liveStrokes (avoids stutter from server broadcasts mid-draw)
  // Guessers: use server strokes which are the source of truth
  const displayStrokes = isDrawer ? liveStrokes : strokes;

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.roundLabel}>Round {round}/{totalRounds}</Text>
        {isDrawer ? (
          <View style={styles.promptPill}>
            <Text style={styles.promptText}>Draw: <Text style={styles.promptWord}>{currentPrompt}</Text></Text>
          </View>
        ) : (
          <Text style={styles.drawerLabel}>{memberName(currentDrawer)} is drawing</Text>
        )}
      </View>

      {/* Canvas */}
      <View style={styles.canvasWrap} {...(isDrawer ? panResponder.panHandlers : {})}>
        <View style={styles.canvas} pointerEvents="none">
          <Svg width={CANVAS_SIZE} height={CANVAS_SIZE}>
            {displayStrokes.map((stroke, i) => (
              <Path
                key={i}
                d={pointsToPath(stroke.points)}
                stroke={stroke.color}
                strokeWidth={stroke.width}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ))}
          </Svg>
        </View>
      </View>

      {/* Drawer tools */}
      {isDrawer && phase === "drawing" && (
        <View style={styles.toolbar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorScroll}>
            {COLORS.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.colorDot, { backgroundColor: c }, selectedColor === c && styles.colorDotSelected]}
                onPress={() => setSelectedColor(c)}
              />
            ))}
          </ScrollView>
          <View style={styles.widthRow}>
            {WIDTHS.map(w => (
              <TouchableOpacity
                key={w}
                style={[styles.widthBtn, selectedWidth === w && styles.widthBtnSelected]}
                onPress={() => setSelectedWidth(w)}
              >
                <View style={{ width: w * 2, height: w * 2, borderRadius: w, backgroundColor: selectedColor }} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Guesser input */}
      {!isDrawer && phase === "drawing" && (
        <View style={styles.guessArea}>
          {hasGuessedCorrectly ? (
            <View style={styles.correctBanner}>
              <Text style={styles.correctText}>You got it!</Text>
            </View>
          ) : (
            <View style={styles.guessRow}>
              <TextInput
                style={styles.guessInput}
                value={guessText}
                onChangeText={setGuessText}
                placeholder="Type your guess..."
                placeholderTextColor="#555"
                onSubmitEditing={handleGuess}
                returnKeyType="send"
                editable={!guessSent}
              />
              <TouchableOpacity style={styles.guessBtn} onPress={handleGuess}>
                <Text style={styles.guessBtnText}>{guessSent ? "✓" : "Guess"}</Text>
              </TouchableOpacity>
            </View>
          )}
          {correctGuessers.length > 0 && (
            <Text style={styles.correctCount}>{correctGuessers.length} got it ✓</Text>
          )}
        </View>
      )}

      {/* Reveal phase */}
      {phase === "reveal" && (
        <View style={styles.revealBanner}>
          <Text style={styles.revealLabel}>The word was:</Text>
          <Text style={styles.revealWord}>{currentPrompt}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#08081a" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  waitEmoji: { fontSize: 64 },
  waitTitle: { color: "#fff", fontSize: 28, fontWeight: "900" },
  waitSub:   { color: "#6b7280", fontSize: 15 },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  roundLabel:   { color: "#6b7280", fontSize: 13, fontWeight: "700" },
  promptPill:   { backgroundColor: "rgba(124,58,237,0.25)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(167,139,250,0.4)" },
  promptText:   { color: "#d8b4fe", fontSize: 13, fontWeight: "700" },
  promptWord:   { color: "#fff", fontSize: 15, fontWeight: "900" },
  drawerLabel:  { color: "#a78bfa", fontSize: 13, fontWeight: "700" },

  canvasWrap: { alignItems: "center", paddingHorizontal: 16 },
  canvas: {
    width: CANVAS_SIZE, height: CANVAS_SIZE,
    backgroundColor: "#fff",
    borderRadius: 16, overflow: "hidden",
  },

  toolbar: { paddingHorizontal: 16, paddingTop: 10, gap: 8 },
  colorScroll: { flexGrow: 0 },
  colorDot: { width: 30, height: 30, borderRadius: 15, marginRight: 8, borderWidth: 2, borderColor: "transparent" },
  colorDotSelected: { borderColor: "#fff", transform: [{ scale: 1.2 }] },
  widthRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  widthBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "transparent" },
  widthBtnSelected: { borderColor: "#a78bfa" },
  clearBtn: { marginLeft: "auto", backgroundColor: "rgba(239,68,68,0.2)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(239,68,68,0.4)" },
  clearText: { color: "#f87171", fontWeight: "700", fontSize: 13 },

  guessArea: { padding: 16, gap: 8 },
  guessRow:  { flexDirection: "row", gap: 10 },
  guessInput: { flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: "#fff", fontSize: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  guessBtn:     { backgroundColor: "#7c3aed", borderRadius: 12, paddingHorizontal: 18, justifyContent: "center" },
  guessBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  correctBanner:{ backgroundColor: "rgba(34,197,94,0.2)", borderRadius: 12, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(34,197,94,0.4)" },
  correctText:  { color: "#4ade80", fontSize: 18, fontWeight: "900" },
  correctCount: { color: "#6b7280", fontSize: 12, textAlign: "center" },

  revealBanner: { padding: 20, alignItems: "center", gap: 8 },
  revealLabel:  { color: "#6b7280", fontSize: 13, fontWeight: "700" },
  revealWord:   { color: "#fff", fontSize: 32, fontWeight: "900" },

  finishContent: { padding: 24, gap: 10 },
  finishTitle:   { color: "#fff", fontSize: 28, fontWeight: "900", textAlign: "center", marginBottom: 16 },
  scoreRow:  { flexDirection: "row", alignItems: "center", gap: 10 },
  scoreRank: { color: "#6b7280", fontSize: 13, fontWeight: "700", width: 32 },
  scoreName: { flex: 1, color: "#e5e7eb", fontSize: 15, fontWeight: "600" },
  scorePts:  { color: "#a78bfa", fontSize: 15, fontWeight: "900" },
});
