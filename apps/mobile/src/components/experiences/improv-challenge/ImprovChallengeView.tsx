import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

const ACCENT = "#f59e0b";

// ─────────────────────────────────────────────────────────────────────────────
// Improv Challenge — Guest View
// Phases: waiting → performing → rating → reveal → finished
// ─────────────────────────────────────────────────────────────────────────────

export function ImprovChallengeView() {
  const { state, sendAction } = useRoom();
  const data      = (state.guestViewData ?? {}) as any;
  const guestId   = state.guestId ?? "";
  const phase     = data.phase ?? "waiting";
  const [rated, setRated] = useState(false);

  const isPerformer = data.currentPerformer === guestId;

  React.useEffect(() => { setRated(false); }, [data.currentPerformer, data.round]);

  function rate(rating: 0 | 150 | 300) {
    setRated(true);
    sendAction("rate", { rating });
  }

  return (
    <LinearGradient colors={["#1a0a00", "#100800"]} style={s.flex}>
      <View style={s.header}>
        <Text style={s.headerTitle}>🎭  Improv Challenge</Text>
        <Text style={s.roundPill}>Round {data.round ?? 0} / {data.totalRounds ?? 0}</Text>
      </View>

      <ScrollView contentContainerStyle={s.body}>

        {/* WAITING */}
        {phase === "waiting" && (
          <View style={s.center}>
            <Text style={{ fontSize: 64, marginBottom: 16 }}>🎭</Text>
            <Text style={s.title}>Improv Challenge</Text>
            <Text style={s.sub}>Waiting for the host to begin…</Text>
          </View>
        )}

        {/* PERFORMING */}
        {phase === "performing" && data.scenario && (
          <>
            {isPerformer ? (
              <View style={[s.card, s.performerCard]}>
                <Text style={[s.eyebrow, { color: ACCENT }]}>YOUR SCENE</Text>
                <Text style={s.sceneLine}><Text style={s.sceneLabel}>WHO: </Text>{data.scenario.who}</Text>
                <Text style={s.sceneLine}><Text style={s.sceneLabel}>WHERE: </Text>{data.scenario.where}</Text>
                <Text style={s.sceneLine}><Text style={s.sceneLabel}>WHAT: </Text>{data.scenario.what}</Text>
                <Text style={[s.sub, { color: ACCENT, marginTop: 12 }]}>Act it out! Others are watching.</Text>
              </View>
            ) : (
              <>
                <Text style={s.eyebrow}>NOW PERFORMING…</Text>
                <View style={s.card}>
                  <Text style={s.title}>{data.currentPerformer}</Text>
                </View>
                <View style={s.card}>
                  <Text style={s.sceneLine}><Text style={s.sceneLabel}>WHO: </Text>{data.scenario.who}</Text>
                  <Text style={s.sceneLine}><Text style={s.sceneLabel}>WHERE: </Text>{data.scenario.where}</Text>
                  <Text style={s.sceneLine}><Text style={s.sceneLabel}>WHAT: </Text>{data.scenario.what}</Text>
                </View>
                <Text style={s.sub}>Watch the performance!</Text>
              </>
            )}
          </>
        )}

        {/* RATING */}
        {phase === "rating" && (
          <>
            {!isPerformer && !rated ? (
              <>
                <Text style={s.eyebrow}>RATE THE PERFORMANCE</Text>
                <Text style={[s.sub, { marginBottom: 16 }]}>How well did {data.currentPerformer} nail the scene?</Text>
                <View style={s.ratingRow}>
                  {([{ score: 0, label: "😬", sub: "Missed it" }, { score: 150, label: "😄", sub: "Nailed parts" }, { score: 300, label: "🤩", sub: "Perfection!" }] as const).map(({ score, label, sub }) => (
                    <TouchableOpacity
                      key={score}
                      style={s.ratingBtn}
                      onPress={() => rate(score as 0 | 150 | 300)}
                    >
                      <Text style={{ fontSize: 36 }}>{label}</Text>
                      <Text style={s.ratingScore}>+{score}</Text>
                      <Text style={s.ratingSub}>{sub}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : isPerformer ? (
              <View style={s.center}>
                <Text style={{ fontSize: 48, marginBottom: 16 }}>⏳</Text>
                <Text style={s.title}>Waiting for ratings…</Text>
                <Text style={s.sub}>The crowd is judging your performance!</Text>
                {data.ratingCount !== undefined && (
                  <Text style={[s.sub, { color: ACCENT }]}>{data.ratingCount} rated so far</Text>
                )}
              </View>
            ) : (
              <View style={s.center}>
                <Text style={{ fontSize: 48, marginBottom: 16 }}>✅</Text>
                <Text style={s.title}>Rating submitted!</Text>
                <Text style={s.sub}>Waiting for others to rate…</Text>
              </View>
            )}
          </>
        )}

        {/* REVEAL */}
        {phase === "reveal" && (
          <View style={s.center}>
            <Text style={{ fontSize: 64, marginBottom: 16 }}>📊</Text>
            <Text style={s.title}>Round Results</Text>
            {data.scores && Object.keys(data.scores).length > 0 && (
              <View style={[s.card, { width: "100%", marginTop: 16 }]}>
                {Object.entries(data.scores as Record<string, number>)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([id, pts], i) => (
                    <View key={id} style={s.scoreRow}>
                      <Text style={s.scoreRank}>#{i + 1}</Text>
                      <Text style={s.scoreName}>{id === guestId ? "You" : id}</Text>
                      <Text style={[s.scorePts, { color: ACCENT }]}>{pts} pts</Text>
                    </View>
                  ))}
              </View>
            )}
          </View>
        )}

        {/* FINISHED */}
        {phase === "finished" && (
          <View style={s.center}>
            <Text style={{ fontSize: 64, marginBottom: 16 }}>🏁</Text>
            <Text style={s.title}>Game Over!</Text>
            {data.scores && (
              <View style={[s.card, { width: "100%", marginTop: 16 }]}>
                <Text style={[s.eyebrow, { marginBottom: 12 }]}>FINAL SCORES</Text>
                {Object.entries(data.scores as Record<string, number>)
                  .sort((a, b) => b[1] - a[1])
                  .map(([id, pts], i) => (
                    <View key={id} style={s.scoreRow}>
                      <Text style={s.scoreRank}>#{i + 1}</Text>
                      <Text style={[s.scoreName, id === guestId && { color: ACCENT }]}>
                        {id === guestId ? "You" : id}
                      </Text>
                      <Text style={[s.scorePts, { color: ACCENT }]}>{pts}</Text>
                    </View>
                  ))}
              </View>
            )}
          </View>
        )}

      </ScrollView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  flex:         { flex: 1 },
  center:       { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  body:         { padding: 16, gap: 12, flexGrow: 1 },
  header:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(245,158,11,0.2)" },
  headerTitle:  { fontSize: 16, fontWeight: "900", color: ACCENT, flex: 1 },
  roundPill:    { color: "#888", fontSize: 12, fontWeight: "700" },
  title:        { fontSize: 24, fontWeight: "900", color: "#fff", textAlign: "center", marginBottom: 8 },
  sub:          { color: "#888", fontSize: 14, textAlign: "center" },
  eyebrow:      { color: "#666", fontSize: 11, fontWeight: "800", letterSpacing: 2, textAlign: "center", marginBottom: 8 },
  card:         { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", gap: 8 },
  performerCard:{ borderColor: "rgba(245,158,11,0.4)", backgroundColor: "rgba(245,158,11,0.08)" },
  sceneLine:    { color: "#fff", fontSize: 16, lineHeight: 26 },
  sceneLabel:   { color: ACCENT, fontWeight: "800" },
  ratingRow:    { flexDirection: "row", gap: 12 },
  ratingBtn:    { flex: 1, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(245,158,11,0.3)", padding: 16, alignItems: "center", gap: 4 },
  ratingScore:  { color: ACCENT, fontWeight: "900", fontSize: 18 },
  ratingSub:    { color: "#888", fontSize: 11, textAlign: "center" },
  scoreRow:     { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  scoreRank:    { color: "#555", fontWeight: "800", width: 28 },
  scoreName:    { flex: 1, color: "#fff", fontWeight: "700" },
  scorePts:     { fontWeight: "900", fontSize: 15 },
});
