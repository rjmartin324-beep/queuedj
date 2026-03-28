import React, { useState } from "react";
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

const ACCENT = "#ec4899";

interface Props {
  viewMode: "player" | "host";
  onViewModeChange: (m: "player" | "host") => void;
}

export function GuessSongControls({ viewMode, onViewModeChange }: Props) {
  const { state, sendAction } = useRoom();
  const expState = state.experienceState as any;
  const phase = expState?.phase ?? "waiting";
  const scores = expState?.scores ?? {};
  const round = expState?.round ?? 1;
  const currentTitle: string = expState?.currentTitle ?? "";
  const currentArtist: string = expState?.currentArtist ?? "";
  const members = state.members.filter(m => !m.isWorkerNode);

  const [isrc,   setIsrc]   = useState("");
  const [title,  setTitle]  = useState("");
  const [artist, setArtist] = useState("");

  function memberName(guestId: string) {
    return members.find(m => m.guestId === guestId)?.displayName ?? guestId.slice(0, 6);
  }

  const sortedScores = Object.entries(scores).sort(
    ([, a], [, b]) => (b as number) - (a as number),
  );

  function startRound() {
    if (!isrc.trim() || !title.trim() || !artist.trim()) return;
    sendAction("start_round", { isrc: isrc.trim(), title: title.trim(), artist: artist.trim() });
    setIsrc(""); setTitle(""); setArtist("");
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.phaseLabel}>GUESS THE SONG — {phase.toUpperCase()} · ROUND {round}</Text>

      {/* waiting / revealed: pick next song */}
      {(phase === "waiting" || phase === "revealed") && (
        <View style={s.card}>
          <Text style={s.cardTitle}>{phase === "waiting" ? "Start round" : `Round ${round} complete — next song`}</Text>
          <TextInput
            style={s.input} placeholder="ISRC" placeholderTextColor="#444"
            value={isrc} onChangeText={setIsrc} autoCapitalize="characters"
          />
          <TextInput
            style={s.input} placeholder="Song title" placeholderTextColor="#444"
            value={title} onChangeText={setTitle}
          />
          <TextInput
            style={s.input} placeholder="Artist" placeholderTextColor="#444"
            value={artist} onChangeText={setArtist}
          />
          <TouchableOpacity
            style={[s.btn, (!isrc || !title || !artist) && s.btnDisabled]}
            onPress={startRound}
            disabled={!isrc || !title || !artist}
          >
            <LinearGradient colors={["#ec4899", "#db2777"]} style={s.btnInner}>
              <Text style={s.btnText}>▶ START ROUND</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* guessing: 30s auto-reveal on server, host can reveal early */}
      {phase === "guessing" && (
        <View style={s.card}>
          <View style={s.nowPlayingBox}>
            <Text style={s.nowPlayingLabel}>PLAYING</Text>
            <Text style={s.nowPlayingTitle}>{currentTitle || "—"}</Text>
            <Text style={s.nowPlayingArtist}>{currentArtist || "—"}</Text>
          </View>
          <Text style={s.cardSub}>30s auto-reveal — or reveal early:</Text>
          <TouchableOpacity style={s.btn} onPress={() => sendAction("reveal")}>
            <LinearGradient colors={["#8b5cf6", "#7c3aed"]} style={s.btnInner}>
              <Text style={s.btnText}>🔍 REVEAL ANSWER</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Scores */}
      {sortedScores.length > 0 && (
        <View style={s.scores}>
          <Text style={s.scoresTitle}>SCORES</Text>
          {sortedScores.map(([gId, pts], i) => (
            <View key={gId} style={s.scoreRow}>
              <Text style={s.scoreRank}>#{i + 1}</Text>
              <Text style={s.scoreName}>{memberName(gId)}</Text>
              <Text style={s.scorePts}>{pts as number} pts</Text>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity style={s.endBtn} onPress={() => sendAction("end")}>
        <Text style={s.endBtnText}>End Game</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 10 },
  phaseLabel: { color: "#666", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  card: { backgroundColor: "#111", borderRadius: 12, padding: 14, gap: 10 },
  cardTitle: { color: "#e5e7eb", fontSize: 15, fontWeight: "700" },
  cardSub: { color: "#6b7280", fontSize: 13 },
  input: {
    backgroundColor: "#1a1a1a", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    color: "#e5e7eb", fontSize: 14, borderWidth: 1, borderColor: "#2a2a2a",
  },
  nowPlayingBox: { backgroundColor: "#1a0a12", borderRadius: 8, padding: 12, alignItems: "center", gap: 4 },
  nowPlayingLabel: { color: ACCENT, fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  nowPlayingTitle: { color: "#f9fafb", fontSize: 16, fontWeight: "800", textAlign: "center" },
  nowPlayingArtist: { color: "#9ca3af", fontSize: 13, textAlign: "center" },
  btn: { borderRadius: 12, overflow: "hidden" },
  btnDisabled: { opacity: 0.4 },
  btnInner: { padding: 14, alignItems: "center" },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  scores: { backgroundColor: "#111", borderRadius: 12, padding: 12 },
  scoresTitle: { color: "#555", fontSize: 10, fontWeight: "900", letterSpacing: 1, marginBottom: 8 },
  scoreRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4, gap: 8 },
  scoreRank: { color: "#4b5563", fontSize: 12, fontWeight: "700", width: 24 },
  scoreName: { flex: 1, color: "#ccc", fontSize: 14 },
  scorePts: { color: "#a78bfa", fontSize: 14, fontWeight: "700" },
  endBtn: { padding: 12, alignItems: "center" },
  endBtnText: { color: "#555", fontSize: 13 },
});
