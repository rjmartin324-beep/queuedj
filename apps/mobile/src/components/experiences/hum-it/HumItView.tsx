import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

const ACCENT = "#a855f7";

// ─────────────────────────────────────────────────────────────────────────────
// Hum It — Guest View
// Phases: waiting → humming → guessing → reveal → finished
// ─────────────────────────────────────────────────────────────────────────────

export function HumItView() {
  const { state, sendAction } = useRoom();
  const data      = (state.guestViewData ?? {}) as any;
  const guestId   = state.guestId ?? "";
  const phase     = data.phase ?? "waiting";
  const [guessed, setGuessed] = useState(false);
  const [doneHumming, setDoneHumming] = useState(false);

  const isHummer = data.currentHummer === guestId;

  React.useEffect(() => { setGuessed(false); setDoneHumming(false); }, [data.currentHummer, data.round]);

  function submitGuess(result: "got_it" | "missed") {
    setGuessed(true);
    sendAction("guess", { result });
  }

  function finishHumming() {
    setDoneHumming(true);
    sendAction("done_humming", {});
  }

  return (
    <LinearGradient colors={["#0d0020", "#080014"]} style={s.flex}>
      <View style={s.header}>
        <Text style={s.headerTitle}>🎵  Hum It</Text>
        <Text style={s.roundPill}>Round {data.round ?? 0} / {data.totalRounds ?? 0}</Text>
      </View>

      <ScrollView contentContainerStyle={s.body}>

        {/* WAITING */}
        {phase === "waiting" && (
          <View style={s.center}>
            <Text style={{ fontSize: 64, marginBottom: 16 }}>🎵</Text>
            <Text style={s.title}>Hum It</Text>
            <Text style={s.sub}>Waiting for the host to begin…</Text>
          </View>
        )}

        {/* HUMMING */}
        {phase === "humming" && (
          isHummer ? (
            <View style={s.center}>
              <View style={[s.songCard, { borderColor: ACCENT + "55" }]}>
                <Text style={[s.eyebrow, { color: ACCENT }]}>YOUR SONG TO HUM</Text>
                <Text style={s.songTitle}>{data.song?.title ?? "???"}</Text>
                <Text style={s.songArtist}>{data.song?.artist ?? ""}</Text>
              </View>
              <Text style={[s.sub, { marginTop: 16, marginBottom: 24 }]}>
                Hum the song — no words, no lyrics!
              </Text>
              {!doneHumming ? (
                <TouchableOpacity style={s.doneBtn} onPress={finishHumming}>
                  <Text style={s.doneBtnText}>Done Humming →</Text>
                </TouchableOpacity>
              ) : (
                <Text style={[s.sub, { color: ACCENT }]}>Waiting for others to guess…</Text>
              )}
            </View>
          ) : (
            <View style={s.center}>
              <Text style={{ fontSize: 64, marginBottom: 16 }}>🎧</Text>
              <Text style={s.title}>Listen up!</Text>
              <Text style={s.sub}>{data.currentHummer} is humming a song.</Text>
              <Text style={[s.sub, { color: ACCENT }]}>Get ready to guess!</Text>
            </View>
          )
        )}

        {/* GUESSING */}
        {phase === "guessing" && !isHummer && (
          <View style={s.center}>
            <Text style={[s.eyebrow, { marginBottom: 24 }]}>DID YOU GET IT?</Text>
            {!guessed ? (
              <View style={s.guessRow}>
                <TouchableOpacity style={[s.guessBtn, { borderColor: "#22c55e" }]} onPress={() => submitGuess("got_it")}>
                  <Text style={{ fontSize: 40 }}>✅</Text>
                  <Text style={[s.guessBtnText, { color: "#22c55e" }]}>Got it!</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.guessBtn, { borderColor: "#ef4444" }]} onPress={() => submitGuess("missed")}>
                  <Text style={{ fontSize: 40 }}>❌</Text>
                  <Text style={[s.guessBtnText, { color: "#ef4444" }]}>Missed it</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={{ fontSize: 48, marginBottom: 16 }}>⏳</Text>
                <Text style={s.sub}>Waiting for reveal…</Text>
              </>
            )}
          </View>
        )}

        {phase === "guessing" && isHummer && (
          <View style={s.center}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>⏳</Text>
            <Text style={s.title}>Others are guessing…</Text>
            <Text style={s.sub}>Waiting for everyone to submit.</Text>
          </View>
        )}

        {/* REVEAL */}
        {phase === "reveal" && (
          <View style={s.center}>
            <Text style={[s.eyebrow, { marginBottom: 16 }]}>THE SONG WAS…</Text>
            <View style={s.songCard}>
              <Text style={s.songTitle}>{data.song?.title ?? "???"}</Text>
              <Text style={s.songArtist}>{data.song?.artist ?? ""}</Text>
            </View>
            <View style={s.countsRow}>
              <View style={s.countBox}>
                <Text style={{ fontSize: 32 }}>✅</Text>
                <Text style={[s.countNum, { color: "#22c55e" }]}>{Object.values(data.guesses ?? {}).filter((g: any) => g === "got_it").length}</Text>
                <Text style={s.countLabel}>Got it</Text>
              </View>
              <View style={s.countBox}>
                <Text style={{ fontSize: 32 }}>❌</Text>
                <Text style={[s.countNum, { color: "#ef4444" }]}>{Object.values(data.guesses ?? {}).filter((g: any) => g === "missed").length}</Text>
                <Text style={s.countLabel}>Missed</Text>
              </View>
            </View>
          </View>
        )}

        {/* FINISHED */}
        {phase === "finished" && (
          <View style={s.center}>
            <Text style={{ fontSize: 64, marginBottom: 16 }}>🏁</Text>
            <Text style={s.title}>Game Over!</Text>
            {data.scores && (
              <View style={[s.songCard, { width: "100%", alignItems: "stretch", marginTop: 16 }]}>
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
  header:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(168,85,247,0.2)" },
  headerTitle:  { fontSize: 16, fontWeight: "900", color: ACCENT, flex: 1 },
  roundPill:    { color: "#888", fontSize: 12, fontWeight: "700" },
  title:        { fontSize: 24, fontWeight: "900", color: "#fff", textAlign: "center", marginBottom: 8 },
  sub:          { color: "#888", fontSize: 14, textAlign: "center" },
  eyebrow:      { color: "#666", fontSize: 11, fontWeight: "800", letterSpacing: 2, textAlign: "center" },
  songCard:     { backgroundColor: "rgba(168,85,247,0.1)", borderRadius: 20, padding: 24, borderWidth: 1, borderColor: "rgba(168,85,247,0.3)", alignItems: "center", gap: 6 },
  songTitle:    { color: "#fff", fontSize: 26, fontWeight: "900", textAlign: "center" },
  songArtist:   { color: "#888", fontSize: 16, textAlign: "center" },
  doneBtn:      { backgroundColor: ACCENT, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 16 },
  doneBtnText:  { color: "#fff", fontSize: 16, fontWeight: "900" },
  guessRow:     { flexDirection: "row", gap: 16 },
  guessBtn:     { flex: 1, borderRadius: 16, borderWidth: 2, padding: 24, alignItems: "center", gap: 8 },
  guessBtnText: { fontSize: 16, fontWeight: "900" },
  countsRow:    { flexDirection: "row", gap: 24, marginTop: 24 },
  countBox:     { alignItems: "center", gap: 4 },
  countNum:     { fontSize: 36, fontWeight: "900" },
  countLabel:   { color: "#888", fontSize: 12 },
  scoreRow:     { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  scoreRank:    { color: "#555", fontWeight: "800", width: 28 },
  scoreName:    { flex: 1, color: "#fff", fontWeight: "700" },
  scorePts:     { fontWeight: "900", fontSize: 15 },
});
