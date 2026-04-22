import React, { useState, useMemo, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";


export function ConnectionsView() {
  const { state, sendAction } = useRoom();
  const d = state.guestViewData as any ?? state.experienceState as any;
  const phase  = d?.phase ?? "waiting";
  // Server broadcasts { ...state, puzzle } — puzzle.groups has the word data
  const groups: { label: string; items: string[] }[] = d?.puzzle?.groups ?? [];
  // Derive shuffled word list from puzzle groups; stable per puzzleIndex so reconnects match
  const puzzleIndex: number = d?.puzzleIndex ?? 0;
  const words: string[] = useMemo(() => {
    const all = groups.flatMap(g => g.items);
    return [...all].sort((a, b) =>
      (a + String(puzzleIndex)).localeCompare(b + String(puzzleIndex))
    );
  }, [puzzleIndex, groups.length]); // eslint-disable-line react-hooks/exhaustive-deps
  // Server sends solvedGroups (array of full group objects)
  const solvedGroups: { label: string; items: string[] }[] = d?.solvedGroups ?? [];
  const round   = puzzleIndex + 1;
  const scores  = d?.scores ?? {};
  const mistakes = d?.mistakes?.[state.guestId ?? ""] ?? 0;

  const MAX_MISTAKES = 4;
  const mistakesLeft = Math.max(0, MAX_MISTAKES - mistakes);

  const [selected, setSelected] = useState<string[]>([]);
  const [lastResult, setLastResult] = useState<{ correct: boolean; oneAway?: boolean } | null>(null);

  // Sync lastResult from server state
  const serverLastResult = (d as any)?.lastResult;
  useEffect(() => {
    if (!serverLastResult) return;
    const isOneAway = !serverLastResult.correct && serverLastResult.oneAway;
    setLastResult({ correct: serverLastResult.correct, oneAway: isOneAway });
    const t = setTimeout(() => setLastResult(null), 2500);
    return () => clearTimeout(t);
  }, [serverLastResult?.correct, serverLastResult?.oneAway]);

  function toggle(w: string) {
    if (phase !== "playing") return;
    setSelected(prev =>
      prev.includes(w) ? prev.filter(x => x !== w) : prev.length < 4 ? [...prev, w] : prev
    );
  }

  function submit() {
    if (selected.length !== 4) return;
    sendAction("submit_group", { items: selected });
    setSelected([]);
  }

  if (phase === "waiting") return (
    <View style={s.center}><Text style={s.emoji}>🔗</Text><Text style={s.title}>Connections</Text><Text style={s.sub}>Waiting for host...</Text></View>
  );
  if (phase === "finished") return (
    <View style={s.center}><Text style={s.emoji}>🏆</Text><Text style={s.title}>Game Over!</Text></View>
  );

  // Words not yet in a solved group
  const solvedItems = new Set(solvedGroups.flatMap(g => g.items));
  const remaining = words.filter(w => !solvedItems.has(w));

  return (
    <View style={s.root}>
      <LinearGradient colors={["#0a0820","#0d1020"]} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <Text style={s.round}>ROUND {round}</Text>
        {/* Hearts for mistakes remaining — NYT style */}
        <View style={s.hearts}>
          {Array.from({ length: MAX_MISTAKES }).map((_, i) => (
            <Text key={i} style={s.heart}>{i < mistakesLeft ? "❤️" : "🖤"}</Text>
          ))}
        </View>
      </View>

      {/* Feedback banner */}
      {lastResult && (
        <View style={[s.feedbackBanner, lastResult.correct ? s.feedbackCorrect : lastResult.oneAway ? s.feedbackOneAway : s.feedbackWrong]}>
          <Text style={s.feedbackText}>
            {lastResult.correct ? "Correct!" : lastResult.oneAway ? "One away..." : "Try again!"}
          </Text>
        </View>
      )}

      {/* Solved groups collapse to top, colored by difficulty */}
      {solvedGroups.map((sg, i) => {
        // Map color name from server to hex
        const colorMap: Record<string, [string, string]> = {
          yellow: ["#fbbf24", "rgba(251,191,36,0.18)"],
          green:  ["#4ade80", "rgba(74,222,128,0.18)"],
          blue:   ["#60a5fa", "rgba(96,165,250,0.18)"],
          purple: ["#c084fc", "rgba(192,132,252,0.18)"],
        };
        const serverColor = (groups[i] as any)?.color ?? (sg as any).color ?? "yellow";
        const [border, bg] = colorMap[serverColor] ?? colorMap.yellow;
        return (
          <View key={sg.label} style={[s.solvedGroup, { backgroundColor: bg, borderColor: border }]}>
            <Text style={[s.solvedLabel, { color: border }]}>{sg.label.toUpperCase()}</Text>
            <Text style={s.solvedItems}>{sg.items.join(" · ")}</Text>
          </View>
        );
      })}

      {/* Remaining word grid — 4×N */}
      <ScrollView contentContainerStyle={s.grid} showsVerticalScrollIndicator={false}>
        {remaining.map(w => {
          const sel = selected.includes(w);
          return (
            <TouchableOpacity key={w} style={[s.tile, sel && s.tileSelected]} onPress={() => toggle(w)} activeOpacity={0.8}>
              <Text style={[s.tileText, sel && s.tileTextSelected]}>{w}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.submitBtn, selected.length !== 4 && s.submitBtnDisabled]}
          onPress={submit}
          activeOpacity={selected.length === 4 ? 0.8 : 1}
          disabled={selected.length !== 4}
        >
          <LinearGradient
            colors={selected.length === 4 ? ["#7c3aed","#6d28d9"] : ["#222","#1a1a1a"]}
            style={s.submitInner}
          >
            <Text style={[s.submitText, selected.length !== 4 && s.submitTextDisabled]}>
              {selected.length === 4 ? "Submit Group" : `Select ${4 - selected.length} more`}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emoji:  { fontSize: 64 },
  title:  { color: "#fff", fontSize: 28, fontWeight: "900" },
  sub:    { color: "#6b7280", fontSize: 15 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10 },
  round:  { color: "#6b7280", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  hearts: { flexDirection: "row", gap: 3 },
  heart:  { fontSize: 16 },
  feedbackBanner: { marginHorizontal: 12, marginBottom: 6, borderRadius: 10, padding: 10, alignItems: "center" },
  feedbackCorrect: { backgroundColor: "rgba(74,222,128,0.18)", borderWidth: 1, borderColor: "rgba(74,222,128,0.4)" },
  feedbackOneAway: { backgroundColor: "rgba(251,191,36,0.18)", borderWidth: 1, borderColor: "rgba(251,191,36,0.4)" },
  feedbackWrong:   { backgroundColor: "rgba(248,113,113,0.18)", borderWidth: 1, borderColor: "rgba(248,113,113,0.4)" },
  feedbackText:    { color: "#fff", fontSize: 13, fontWeight: "800" },
  solvedGroup: { marginHorizontal: 12, marginBottom: 6, borderRadius: 12, padding: 12, borderWidth: 1.5 },
  solvedLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 1, marginBottom: 4 },
  solvedItems: { color: "#fff", fontSize: 14, fontWeight: "700" },
  grid:   { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 8, paddingBottom: 100 },
  tile:   { width: "47%", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 14, paddingVertical: 18, paddingHorizontal: 10, alignItems: "center", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.08)" },
  tileSelected: { borderColor: "#a78bfa", backgroundColor: "rgba(167,139,250,0.2)" },
  tileText: { color: "#e5e7eb", fontSize: 16, fontWeight: "800", textAlign: "center" },
  tileTextSelected: { color: "#fff" },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: "rgba(10,8,32,0.9)" },
  submitBtn:         { borderRadius: 16, overflow: "hidden" },
  submitBtnDisabled: { opacity: 0.5 },
  submitInner: { padding: 16, alignItems: "center" },
  submitText:         { color: "#fff", fontSize: 17, fontWeight: "900" },
  submitTextDisabled: { color: "#888" },
});
