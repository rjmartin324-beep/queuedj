import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

const GROUP_COLORS = ["#fbbf24","#4ade80","#60a5fa","#f87171"];
const GROUP_BG     = ["rgba(251,191,36,0.2)","rgba(74,222,128,0.2)","rgba(96,165,250,0.2)","rgba(248,113,113,0.2)"];

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

  const [selected, setSelected] = useState<string[]>([]);

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
        <Text style={s.mistakes}>❌ {mistakes} mistake{mistakes !== 1 ? "s" : ""}</Text>
      </View>

      {/* Solved groups — use index in original groups list for consistent color */}
      {solvedGroups.map((sg, i) => {
        const colorIdx = Math.max(0, groups.findIndex(g => g.label === sg.label)) || i;
        return (
          <View key={sg.label} style={[s.solvedGroup, { backgroundColor: GROUP_BG[colorIdx % 4], borderColor: GROUP_COLORS[colorIdx % 4] }]}>
            <Text style={[s.solvedLabel, { color: GROUP_COLORS[colorIdx % 4] }]}>{sg.label}</Text>
            <Text style={s.solvedItems}>{sg.items.join(" · ")}</Text>
          </View>
        );
      })}

      {/* Remaining word grid */}
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

      {selected.length === 4 && (
        <View style={s.footer}>
          <TouchableOpacity style={s.submitBtn} onPress={submit} activeOpacity={0.8}>
            <LinearGradient colors={["#7c3aed","#6d28d9"]} style={s.submitInner}>
              <Text style={s.submitText}>Submit Group</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emoji:  { fontSize: 64 },
  title:  { color: "#fff", fontSize: 28, fontWeight: "900" },
  sub:    { color: "#6b7280", fontSize: 15 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 },
  round:  { color: "#6b7280", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  mistakes: { color: "#f87171", fontSize: 13, fontWeight: "700" },
  solvedGroup: { marginHorizontal: 12, marginBottom: 6, borderRadius: 12, padding: 12, borderWidth: 1.5 },
  solvedLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 1, marginBottom: 4 },
  solvedItems: { color: "#fff", fontSize: 14, fontWeight: "700" },
  grid:   { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 8, paddingBottom: 100 },
  tile:   { width: "47%", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 14, paddingVertical: 18, paddingHorizontal: 10, alignItems: "center", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.08)" },
  tileSelected: { borderColor: "#a78bfa", backgroundColor: "rgba(167,139,250,0.2)" },
  tileText: { color: "#e5e7eb", fontSize: 16, fontWeight: "800", textAlign: "center" },
  tileTextSelected: { color: "#fff" },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: "rgba(10,8,32,0.9)" },
  submitBtn: { borderRadius: 16, overflow: "hidden" },
  submitInner: { padding: 16, alignItems: "center" },
  submitText: { color: "#fff", fontSize: 17, fontWeight: "900" },
});
