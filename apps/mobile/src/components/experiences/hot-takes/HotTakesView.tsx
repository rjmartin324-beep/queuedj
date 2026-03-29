import React, { useState, useRef, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, PanResponder, LayoutChangeEvent } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

// ─── Custom slider ────────────────────────────────────────────────────────────

interface SliderProps {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}

function Slider({ value, onChange, disabled }: SliderProps) {
  const trackWidth = useRef(0);

  const onLayout = (e: LayoutChangeEvent) => {
    trackWidth.current = e.nativeEvent.layout.width;
  };

  const clamp = (v: number) => Math.max(0, Math.min(100, v));

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: (e) => {
        if (!trackWidth.current || disabled) return;
        const x = e.nativeEvent.locationX;
        onChange(clamp(Math.round((x / trackWidth.current) * 100)));
      },
      onPanResponderMove: (e) => {
        if (!trackWidth.current || disabled) return;
        const x = e.nativeEvent.locationX;
        onChange(clamp(Math.round((x / trackWidth.current) * 100)));
      },
    })
  ).current;

  const pct = value / 100;

  return (
    <View style={sl.root} onLayout={onLayout} {...responder.panHandlers}>
      <View style={sl.track}>
        <View style={[sl.fill, { width: `${value}%` }]} />
      </View>
      <View style={[sl.thumb, { left: `${pct * 100}%`, marginLeft: -14 }]} />
      <View style={sl.labels}>
        <Text style={sl.labelText}>0</Text>
        <Text style={sl.labelText}>50</Text>
        <Text style={sl.labelText}>100</Text>
      </View>
    </View>
  );
}

const sl = StyleSheet.create({
  root:  { height: 60, justifyContent: "center", paddingHorizontal: 14 },
  track: { height: 6, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 3, overflow: "visible" },
  fill:  { height: "100%", backgroundColor: "#f97316", borderRadius: 3 },
  thumb: {
    position: "absolute",
    top: "50%",
    marginTop: -14,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#f97316",
    borderWidth: 3, borderColor: "#fff",
    shadowColor: "#f97316", shadowOpacity: 0.6, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  labels: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  labelText: { color: "#6b7280", fontSize: 11, fontWeight: "700" },
});

// ─── Main View ────────────────────────────────────────────────────────────────

export function HotTakesView() {
  const { state, sendAction } = useRoom();
  const d = state.guestViewData as any ?? state.experienceState as any;
  const phase: string = d?.phase ?? "waiting";
  const round: number = d?.round ?? 1;
  const total: number = d?.totalRounds ?? 10;
  const statement: string | null = d?.currentStatement ?? null;
  const respondedCount: number = d?.respondedCount ?? 0;
  const sliderValues: Record<string, number> = d?.sliderValues ?? {};
  const average: number | null = d?.average ?? null;
  const scores: Record<string, number> = d?.scores ?? {};
  const myId = state.guestId ?? "";

  const [localValue, setLocalValue] = useState(50);
  const [hasSlid, setHasSlid] = useState(false);
  const lastSentRef = useRef<number | null>(null);

  const memberName = (id: string) =>
    state.members.find(m => m.guestId === id)?.displayName ?? id.slice(0, 6);

  const handleSlide = useCallback((v: number) => {
    if (phase !== "question") return;
    setLocalValue(v);
    setHasSlid(true);
    if (lastSentRef.current !== v) {
      lastSentRef.current = v;
      sendAction("slide", { value: v });
    }
  }, [phase, sendAction]);

  if (phase === "waiting") return (
    <View style={s.center}>
      <Text style={s.emoji}>🌡️</Text>
      <Text style={s.title}>Hot Takes</Text>
      <Text style={s.sub}>Waiting for host to start...</Text>
    </View>
  );

  if (phase === "finished") {
    const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
    return (
      <View style={s.root}>
        <LinearGradient colors={["#0a0820","#0d1020"]} style={StyleSheet.absoluteFill} />
        <View style={s.center}>
          <Text style={s.emoji}>🏆</Text>
          <Text style={s.title}>Game Over!</Text>
          <ScrollView style={s.scoreList}>
            {sorted.map(([id, pts], i) => (
              <View key={id} style={s.scoreRow}>
                <Text style={s.scoreRank}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i+1}`}</Text>
                <Text style={s.scoreName}>{id === myId ? "You" : memberName(id)}</Text>
                <Text style={s.scorePts}>{pts} pts</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    );
  }

  const isReveal = phase === "reveal";
  const memberCount = state.members.filter(m => !m.isWorkerNode && m.role !== "HOST" && m.role !== "CO_HOST").length;
  const myRevealValue = isReveal ? (sliderValues[myId] ?? null) : null;
  const myDist = isReveal && myRevealValue !== null && average !== null
    ? Math.abs(myRevealValue - average)
    : null;
  const myPts = isReveal && myDist !== null ? Math.max(0, Math.round(300 - myDist * 3)) : null;

  // Sort reveal values by distance from average
  const revealEntries = isReveal
    ? Object.entries(sliderValues)
        .map(([id, val]) => ({ id, val, dist: average !== null ? Math.abs(val - average) : 999 }))
        .sort((a, b) => a.dist - b.dist)
    : [];

  return (
    <View style={s.root}>
      <LinearGradient colors={["#0a0820","#0d1020"]} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <Text style={s.eyebrow}>HOT TAKES</Text>
        <Text style={s.roundLabel}>ROUND {round} / {total}</Text>
      </View>

      {statement && (
        <View style={s.statementCard}>
          <Text style={s.statementEmoji}>🌡️</Text>
          <Text style={s.statementText}>{statement}</Text>
        </View>
      )}

      {!isReveal ? (
        <View style={s.sliderArea}>
          <View style={s.sliderLabels}>
            <Text style={s.disagreeLabel}>STRONGLY DISAGREE</Text>
            <Text style={s.agreeLabel}>STRONGLY AGREE</Text>
          </View>
          <Slider
            value={localValue}
            onChange={handleSlide}
            disabled={false}
          />
          <View style={s.valueDisplay}>
            <Text style={s.valueNum}>{localValue}</Text>
            <Text style={s.valueLabel}>/ 100</Text>
          </View>
          <View style={s.responseCount}>
            <Text style={s.responseText}>
              {hasSlid ? `✓ Sliding — ${respondedCount} / ${memberCount} have responded` : `${respondedCount} / ${memberCount} have responded`}
            </Text>
          </View>
        </View>
      ) : (
        <ScrollView style={s.revealScroll} contentContainerStyle={s.revealContent} showsVerticalScrollIndicator={false}>
          {average !== null && (
            <View style={s.averageCard}>
              <Text style={s.averageLabel}>GROUP AVERAGE</Text>
              <Text style={s.averageNum}>{average.toFixed(1)}</Text>
            </View>
          )}
          {myPts !== null && (
            <View style={[s.myResultCard, myDist !== null && myDist < 15 && s.myResultClose]}>
              <Text style={s.myResultLabel}>YOUR ANSWER: {myRevealValue}</Text>
              <Text style={s.myResultDist}>
                {myDist !== null ? `${myDist.toFixed(1)} away from average` : ""}
              </Text>
              <Text style={s.myResultPts}>+{myPts} pts</Text>
            </View>
          )}
          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerLabel}>ALL ANSWERS</Text>
            <View style={s.dividerLine} />
          </View>
          {revealEntries.map(({ id, val, dist }, i) => (
            <View key={id} style={[s.revealRow, id === myId && s.revealRowMe]}>
              <View style={[s.revealBar, { width: `${val}%` }]} />
              <Text style={s.revealName}>{id === myId ? "You" : memberName(id)}</Text>
              <Text style={s.revealVal}>{val}</Text>
              <Text style={s.revealDist}>{dist.toFixed(0)} away</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  emoji:  { fontSize: 64 },
  title:  { color: "#fff", fontSize: 28, fontWeight: "900" },
  sub:    { color: "#6b7280", fontSize: 15 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 },
  eyebrow:    { color: "#f97316", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  roundLabel: { color: "#6b7280", fontSize: 11, fontWeight: "800", letterSpacing: 1 },

  statementCard: { margin: 16, backgroundColor: "rgba(249,115,22,0.1)", borderRadius: 20, padding: 24, gap: 12, borderWidth: 1, borderColor: "rgba(249,115,22,0.25)", alignItems: "center" },
  statementEmoji:{ fontSize: 32 },
  statementText: { color: "#fff", fontSize: 19, fontWeight: "800", lineHeight: 27, textAlign: "center" },

  sliderArea:   { flex: 1, padding: 16, gap: 4 },
  sliderLabels: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14 },
  disagreeLabel:{ color: "#6b7280", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  agreeLabel:   { color: "#6b7280", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  valueDisplay: { alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 4, marginTop: 4 },
  valueNum:     { color: "#f97316", fontSize: 48, fontWeight: "900" },
  valueLabel:   { color: "#6b7280", fontSize: 20, fontWeight: "700", alignSelf: "flex-end", marginBottom: 8 },
  responseCount:{ alignItems: "center", marginTop: 8 },
  responseText: { color: "#6b7280", fontSize: 13 },

  revealScroll:  { flex: 1 },
  revealContent: { padding: 16, gap: 12, paddingBottom: 32 },
  averageCard:   { backgroundColor: "rgba(249,115,22,0.15)", borderRadius: 16, padding: 18, alignItems: "center", borderWidth: 1, borderColor: "rgba(249,115,22,0.35)" },
  averageLabel:  { color: "#f97316", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  averageNum:    { color: "#fff", fontSize: 52, fontWeight: "900" },
  myResultCard:  { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", gap: 4 },
  myResultClose: { borderColor: "rgba(74,222,128,0.4)", backgroundColor: "rgba(74,222,128,0.08)" },
  myResultLabel: { color: "#9ca3af", fontSize: 12, fontWeight: "700" },
  myResultDist:  { color: "#e5e7eb", fontSize: 15, fontWeight: "700" },
  myResultPts:   { color: "#f97316", fontSize: 22, fontWeight: "900" },
  divider:       { flexDirection: "row", alignItems: "center", gap: 10 },
  dividerLine:   { flex: 1, height: 1, backgroundColor: "#1e1e3a" },
  dividerLabel:  { color: "#555", fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  revealRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12,
    padding: 12, overflow: "hidden", position: "relative",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  revealRowMe:  { borderColor: "rgba(249,115,22,0.3)", backgroundColor: "rgba(249,115,22,0.08)" },
  revealBar:    { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: "rgba(249,115,22,0.12)", maxWidth: "100%" },
  revealName:   { flex: 1, color: "#fff", fontSize: 14, fontWeight: "700" },
  revealVal:    { color: "#f97316", fontSize: 16, fontWeight: "900", minWidth: 28 },
  revealDist:   { color: "#6b7280", fontSize: 11, fontWeight: "700" },

  scoreList: { width: "100%", marginTop: 12 },
  scoreRow:  { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  scoreRank: { fontSize: 22, minWidth: 36 },
  scoreName: { flex: 1, color: "#fff", fontSize: 16, fontWeight: "700" },
  scorePts:  { color: "#f97316", fontSize: 16, fontWeight: "900" },
});
