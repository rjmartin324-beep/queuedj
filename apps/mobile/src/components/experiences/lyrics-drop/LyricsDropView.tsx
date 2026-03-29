import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

export function LyricsDropView() {
  const { state, sendAction } = useRoom();
  const d = state.guestViewData as any ?? state.experienceState as any;
  const phase = d?.phase ?? "waiting";
  const round = d?.round ?? 1;
  const total = d?.totalRounds ?? 8;
  // Server field is currentLyric: { text, blank, answer, hint }
  // Client was built for generic lyric/blanks/answers/artist — map them here.
  const currentLyric = d?.currentLyric as { text: string; blank: string; answer: string; hint: string } | null;
  const lyric  = currentLyric?.text ?? "";
  // Wrap single answer in array so the multi-blank index logic [i] still works
  const blanks: string[] = currentLyric?.answer ? [currentLyric.answer] : [];
  // Server field is guesses: Record<string, string> — wrap per-guest string in [string]
  const rawGuesses: Record<string, string> = d?.guesses ?? {};
  const answers: Record<string, string[]> = Object.fromEntries(
    Object.entries(rawGuesses).map(([k, v]) => [k, [v]])
  );
  // hint format is "Song Title — Artist"
  const [song, artist] = (currentLyric?.hint ?? "").split(" — ").map(s => s.trim());

  const myAnswer = answers[state.guestId ?? ""];
  const [guess, setGuess] = useState("");

  function submit() {
    const w = guess.trim();
    if (!w || myAnswer !== undefined) return;
    sendAction("guess", { word: w });
    setGuess("");
  }

  if (phase === "waiting") return (
    <View style={s.center}><Text style={s.emoji}>🎵</Text><Text style={s.title}>Lyrics Drop</Text><Text style={s.sub}>Waiting for host...</Text></View>
  );
  if (phase === "finished") return (
    <View style={s.center}><Text style={s.emoji}>🏆</Text><Text style={s.title}>Game Over!</Text></View>
  );

  const showReveal = phase === "reveal";

  // Build display lyric — replace blanks with guesses or answers on reveal
  const displayParts = lyric.split("___");

  return (
    <View style={s.root}>
      <LinearGradient colors={["#0a0820","#130a20"]} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <Text style={s.round}>ROUND {round} / {total}</Text>
      </View>

      <View style={s.lyricCard}>
        <Text style={s.musicNote}>🎵</Text>
        {artist ? <Text style={s.songInfo}>{artist} — {song}</Text> : null}
        <View style={s.lyricRow}>
          {displayParts.map((part, i) => (
            <React.Fragment key={i}>
              <Text style={s.lyricText}>{part}</Text>
              {i < displayParts.length - 1 && (
                <View style={s.blankWrapper}>
                  {showReveal ? (
                    <Text style={[s.blankFilled, myAnswer?.[i] === blanks[i] ? s.correct : s.wrong]}>
                      {blanks[i]}
                    </Text>
                  ) : myAnswer?.[i] ? (
                    <Text style={s.blankGuessed}>{myAnswer[i]}</Text>
                  ) : (
                    <View style={s.blank} />
                  )}
                </View>
              )}
            </React.Fragment>
          ))}
        </View>
      </View>

      {!myAnswer && phase === "question" && (
        <View style={s.inputArea}>
          <Text style={s.inputLabel}>Fill in the blank{displayParts.length > 2 ? "s" : ""}:</Text>
          <View style={s.row}>
            <TextInput
              style={s.input}
              value={guess}
              onChangeText={setGuess}
              placeholder="Missing word..."
              placeholderTextColor="#555"
              autoFocus
              onSubmitEditing={submit}
              returnKeyType="send"
            />
            <TouchableOpacity style={s.sendBtn} onPress={submit} activeOpacity={0.8}>
              <Text style={s.sendText}>→</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {myAnswer && !showReveal && (
        <View style={s.locked}><Text style={s.lockedText}>Locked in — waiting for reveal 🎤</Text></View>
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
  header: { padding: 16 },
  round:  { color: "#6b7280", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  lyricCard: { margin: 16, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 24, padding: 24, gap: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  musicNote: { fontSize: 32 },
  songInfo:  { color: "#6b7280", fontSize: 12, fontStyle: "italic" },
  lyricRow:  { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 4 },
  lyricText: { color: "#fff", fontSize: 20, fontWeight: "700", lineHeight: 32 },
  blankWrapper: { marginHorizontal: 2 },
  blank:      { width: 80, height: 3, backgroundColor: "#a78bfa", borderRadius: 2, marginBottom: 4 },
  blankFilled: { fontSize: 20, fontWeight: "900", paddingHorizontal: 4 },
  blankGuessed:{ color: "#a78bfa", fontSize: 20, fontWeight: "900" },
  correct:    { color: "#4ade80" },
  wrong:      { color: "#f87171" },
  inputArea:  { padding: 16, gap: 8 },
  inputLabel: { color: "#9ca3af", fontSize: 14 },
  row:        { flexDirection: "row", gap: 10 },
  input:      { flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: "#fff", fontSize: 18, fontWeight: "700", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  sendBtn:    { backgroundColor: "#7c3aed", borderRadius: 14, width: 52, justifyContent: "center", alignItems: "center" },
  sendText:   { color: "#fff", fontSize: 22, fontWeight: "900" },
  locked:     { margin: 16, backgroundColor: "rgba(99,102,241,0.2)", borderRadius: 14, padding: 14, alignItems: "center" },
  lockedText: { color: "#818cf8", fontSize: 13, fontWeight: "700" },
});
