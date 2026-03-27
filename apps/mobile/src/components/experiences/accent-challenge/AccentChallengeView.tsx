import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

const ACCENT = "#10b981";
const RATINGS = [0, 100, 200, 350] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Accent Challenge — Guest View
// Phases: waiting → performing → rating → finished
// ─────────────────────────────────────────────────────────────────────────────

export function AccentChallengeView() {
  const { state, sendAction } = useRoom();
  const data      = (state.guestViewData ?? {}) as any;
  const guestId   = state.guestId ?? "";
  const phase     = data.phase ?? "waiting";
  const [rated, setRated] = useState(false);

  const isPerformer = data.currentPerformer === guestId;

  React.useEffect(() => { setRated(false); }, [data.currentPerformer, data.round]);

  function rate(rating: typeof RATINGS[number]) {
    setRated(true);
    sendAction("rate", { rating });
  }

  return (
    <LinearGradient colors={["#001a10", "#000f0a"]} style={s.flex}>
      <View style={s.header}>
        <Text style={s.headerTitle}>🎙️  Accent Challenge</Text>
        <Text style={s.roundPill}>Round {data.round ?? 0} / {data.totalRounds ?? 0}</Text>
      </View>

      <ScrollView contentContainerStyle={s.body}>

        {/* WAITING */}
        {phase === "waiting" && (
          <View style={s.center}>
            <Text style={{ fontSize: 64, marginBottom: 16 }}>🎙️</Text>
            <Text style={s.title}>Accent Challenge</Text>
            <Text style={s.sub}>Waiting for the host to begin…</Text>
          </View>
        )}

        {/* PERFORMING */}
        {phase === "performing" && (
          isPerformer ? (
            <View style={s.center}>
              <View style={[s.accentCard, { borderColor: ACCENT + "55" }]}>
                <Text style={[s.eyebrow, { color: ACCENT }]}>YOUR ACCENT</Text>
                <Text style={s.accentName}>{data.accent ?? "???"}</Text>
              </View>
              <View style={[s.phraseCard, { marginTop: 16 }]}>
                <Text style={s.eyebrow}>SAY THIS PHRASE</Text>
                <Text style={s.phraseText}>"{data.phrase ?? "???"}"</Text>
              </View>
              <Text style={[s.sub, { marginTop: 20, color: ACCENT }]}>
                Read it with your best {data.accent} accent!
              </Text>
            </View>
          ) : (
            <View style={s.center}>
              <Text style={{ fontSize: 64, marginBottom: 16 }}>👂</Text>
              <Text style={s.title}>Listen up!</Text>
              <Text style={s.sub}>{data.currentPerformer} is performing their accent.</Text>
              <View style={[s.accentCard, { marginTop: 16 }]}>
                <Text style={s.eyebrow}>THEIR ACCENT</Text>
                <Text style={s.accentName}>{data.accent ?? "???"}</Text>
              </View>
              <View style={[s.phraseCard, { marginTop: 12 }]}>
                <Text style={s.eyebrow}>THE PHRASE</Text>
                <Text style={s.phraseText}>"{data.phrase ?? "???"}"</Text>
              </View>
            </View>
          )
        )}

        {/* RATING */}
        {phase === "rating" && (
          isPerformer ? (
            <View style={s.center}>
              <Text style={{ fontSize: 48, marginBottom: 16 }}>⏳</Text>
              <Text style={s.title}>Getting rated…</Text>
              <Text style={s.sub}>The crowd is scoring your accent!</Text>
            </View>
          ) : rated ? (
            <View style={s.center}>
              <Text style={{ fontSize: 48, marginBottom: 16 }}>✅</Text>
              <Text style={s.title}>Rating submitted!</Text>
              <Text style={s.sub}>Waiting for others…</Text>
            </View>
          ) : (
            <>
              <Text style={[s.eyebrow, { textAlign: "center", marginBottom: 16 }]}>RATE THE ACCENT</Text>
              <Text style={[s.sub, { textAlign: "center", marginBottom: 24 }]}>
                How convincing was {data.currentPerformer}'s {data.accent} accent?
              </Text>
              <View style={s.ratingGrid}>
                {([
                  { rating: 0,   label: "😬", desc: "Completely wrong" },
                  { rating: 100, label: "😐", desc: "Barely there" },
                  { rating: 200, label: "😄", desc: "Pretty good!" },
                  { rating: 350, label: "🤩", desc: "Perfect accent!" },
                ] as const).map(({ rating, label, desc }) => (
                  <TouchableOpacity
                    key={rating}
                    style={s.ratingBtn}
                    onPress={() => rate(rating as typeof RATINGS[number])}
                  >
                    <Text style={{ fontSize: 36 }}>{label}</Text>
                    <Text style={[s.ratingScore, { color: ACCENT }]}>+{rating}</Text>
                    <Text style={s.ratingDesc}>{desc}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )
        )}

        {/* FINISHED */}
        {phase === "finished" && (
          <View style={s.center}>
            <Text style={{ fontSize: 64, marginBottom: 16 }}>🏁</Text>
            <Text style={s.title}>Game Over!</Text>
            {data.scores && (
              <View style={[s.accentCard, { width: "100%", alignItems: "stretch", marginTop: 16 }]}>
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
  header:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(16,185,129,0.2)" },
  headerTitle:  { fontSize: 16, fontWeight: "900", color: ACCENT, flex: 1 },
  roundPill:    { color: "#888", fontSize: 12, fontWeight: "700" },
  title:        { fontSize: 24, fontWeight: "900", color: "#fff", textAlign: "center", marginBottom: 8 },
  sub:          { color: "#888", fontSize: 14, textAlign: "center" },
  eyebrow:      { color: "#666", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  accentCard:   { backgroundColor: "rgba(16,185,129,0.1)", borderRadius: 16, padding: 20, borderWidth: 1, borderColor: "rgba(16,185,129,0.3)", alignItems: "center", gap: 6 },
  accentName:   { color: ACCENT, fontSize: 28, fontWeight: "900", textAlign: "center" },
  phraseCard:   { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 16, padding: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", alignItems: "center", gap: 8 },
  phraseText:   { color: "#fff", fontSize: 18, fontWeight: "700", textAlign: "center", fontStyle: "italic", lineHeight: 28 },
  ratingGrid:   { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center" },
  ratingBtn:    { width: "44%", backgroundColor: "rgba(16,185,129,0.08)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(16,185,129,0.25)", padding: 16, alignItems: "center", gap: 4 },
  ratingScore:  { fontWeight: "900", fontSize: 20 },
  ratingDesc:   { color: "#888", fontSize: 11, textAlign: "center" },
  scoreRow:     { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  scoreRank:    { color: "#555", fontWeight: "800", width: 28 },
  scoreName:    { flex: 1, color: "#fff", fontWeight: "700" },
  scorePts:     { fontWeight: "900", fontSize: 15 },
});
