import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

export function BucketListView() {
  const { state, sendAction } = useRoom();
  const d = state.guestViewData as any ?? state.experienceState as any;
  const phase: string = d?.phase ?? "waiting";
  const round: number = d?.round ?? 1;
  const total: number = d?.totalRounds ?? 1;
  const submissionCount: number = d?.submissionCount ?? 0;
  const guessCount: number = d?.guessCount ?? 0;
  const scores: Record<string, number> = d?.scores ?? {};
  // currentItem: { text } during guessing, { text, authorId } during reveal
  const currentItem: { text: string; authorId?: string } | null = d?.currentItem ?? null;
  const myId = state.guestId ?? "";
  const isAuthor = currentItem?.authorId === myId || (phase === "guessing" && d?.myItem === true);

  const [item, setItem] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [guess, setGuess] = useState<string | null>(null);

  const memberName = (id: string) =>
    state.members.find(m => m.guestId === id)?.displayName ?? id.slice(0, 6);

  // Eligible guessees: all members except the author (hidden) and self
  const guessOptions = state.members.filter(
    m => !m.isWorkerNode && m.role !== "HOST" && m.role !== "CO_HOST" && m.guestId !== myId
  );

  function submitItem() {
    const trimmed = item.trim();
    if (!trimmed || submitted) return;
    setSubmitted(true);
    sendAction("submit_item", { item: trimmed });
    setItem("");
  }

  function submitGuess(authorGuestId: string) {
    if (guess || isAuthor) return;
    setGuess(authorGuestId);
    sendAction("guess", { authorGuestId });
  }

  if (phase === "waiting") return (
    <View style={s.center}>
      <Text style={s.emoji}>🪣</Text>
      <Text style={s.title}>Bucket List</Text>
      <Text style={s.sub}>Waiting for host to start...</Text>
    </View>
  );

  if (phase === "finished") {
    const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
    return (
      <View style={s.root}>
        <LinearGradient colors={["#0a0820","#130a20"]} style={StyleSheet.absoluteFill} />
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

  if (phase === "submitting") {
    const memberCount = state.members.filter(m => !m.isWorkerNode && m.role !== "HOST" && m.role !== "CO_HOST").length;
    return (
      <View style={s.root}>
        <LinearGradient colors={["#0a0820","#130a20"]} style={StyleSheet.absoluteFill} />
        <View style={s.header}>
          <Text style={s.eyebrow}>BUCKET LIST</Text>
        </View>
        <View style={s.promptCard}>
          <Text style={s.promptEmoji}>🪣</Text>
          <Text style={s.promptTitle}>Add your bucket list item</Text>
          <Text style={s.promptSub}>Something you want to do before you die — others will guess it's yours!</Text>
        </View>
        {!submitted ? (
          <View style={s.inputArea}>
            <TextInput
              style={s.input}
              value={item}
              onChangeText={setItem}
              placeholder="e.g. See the Northern Lights..."
              placeholderTextColor="#555"
              multiline
              maxLength={200}
              onSubmitEditing={submitItem}
            />
            <TouchableOpacity style={s.submitBtn} onPress={submitItem} activeOpacity={0.8}>
              <LinearGradient colors={["#7c3aed","#6d28d9"]} style={s.submitInner}>
                <Text style={s.submitText}>Submit</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.lockedCard}>
            <Text style={s.lockedEmoji}>✅</Text>
            <Text style={s.lockedTitle}>Submitted!</Text>
            <Text style={s.lockedSub}>{submissionCount} / {memberCount} submitted</Text>
          </View>
        )}
      </View>
    );
  }

  if (phase === "guessing" || phase === "reveal") {
    const isReveal = phase === "reveal";
    const authorId = currentItem?.authorId;
    const authorName = authorId ? memberName(authorId) : "";
    const iWroteThis = authorId === myId;
    const myGuessCorrect = isReveal && guess !== null && guess === authorId;

    return (
      <View style={s.root}>
        <LinearGradient colors={["#0a0820","#130a20"]} style={StyleSheet.absoluteFill} />
        <View style={s.header}>
          <Text style={s.eyebrow}>BUCKET LIST</Text>
          <Text style={s.roundLabel}>ITEM {round} / {total}</Text>
        </View>

        <View style={s.itemCard}>
          <Text style={s.itemLabel}>BUCKET LIST ITEM</Text>
          <Text style={s.itemText}>"{currentItem?.text}"</Text>
        </View>

        {isReveal ? (
          <View style={s.revealArea}>
            <View style={[s.authorCard, iWroteThis && s.authorCardMe]}>
              <Text style={s.authorLabel}>WRITTEN BY</Text>
              <Text style={[s.authorName, iWroteThis && s.authorNameMe]}>
                {iWroteThis ? "You! 🎉" : authorName}
              </Text>
            </View>
            {!iWroteThis && guess !== null && (
              <View style={[s.resultCard, myGuessCorrect ? s.resultCorrect : s.resultWrong]}>
                <Text style={s.resultText}>
                  {myGuessCorrect ? "✅ Correct! +300 pts" : `❌ You guessed ${memberName(guess)}`}
                </Text>
              </View>
            )}
            <Text style={s.guessTally}>{guessCount} guess{guessCount !== 1 ? "es" : ""} submitted</Text>
          </View>
        ) : iWroteThis ? (
          <View style={s.authorWaiting}>
            <Text style={s.authorWaitingEmoji}>🤫</Text>
            <Text style={s.authorWaitingText}>That's your item! Others are guessing who wrote it...</Text>
          </View>
        ) : guess !== null ? (
          <View style={s.lockedCard}>
            <Text style={s.lockedEmoji}>🔒</Text>
            <Text style={s.lockedTitle}>Guess locked in!</Text>
            <Text style={s.lockedSub}>Waiting for host to reveal...</Text>
          </View>
        ) : (
          <View style={s.guessArea}>
            <Text style={s.guessLabel}>Who wrote this? Tap to guess:</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {guessOptions.map(m => (
                <TouchableOpacity
                  key={m.guestId}
                  style={s.guessTile}
                  onPress={() => submitGuess(m.guestId)}
                  activeOpacity={0.8}
                >
                  <View style={[s.avatar, { backgroundColor: avatarColor(m.guestId) }]}>
                    <Text style={s.avatarText}>{(m.displayName ?? m.guestId)[0].toUpperCase()}</Text>
                  </View>
                  <Text style={s.guessTileName}>{m.displayName ?? m.guestId.slice(0, 6)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    );
  }

  return null;
}

function avatarColor(id: string) {
  const COLORS = ["#7c3aed","#a855f7","#ec4899","#f97316","#22c55e","#06b6d4","#3b82f6","#eab308"];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

const s = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  emoji:  { fontSize: 64 },
  title:  { color: "#fff", fontSize: 28, fontWeight: "900" },
  sub:    { color: "#6b7280", fontSize: 15, textAlign: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 },
  eyebrow:{ color: "#a78bfa", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  roundLabel: { color: "#6b7280", fontSize: 11, fontWeight: "800", letterSpacing: 1 },

  promptCard: { margin: 16, backgroundColor: "rgba(167,139,250,0.1)", borderRadius: 20, padding: 24, gap: 10, borderWidth: 1, borderColor: "rgba(167,139,250,0.2)", alignItems: "center" },
  promptEmoji: { fontSize: 40 },
  promptTitle: { color: "#fff", fontSize: 20, fontWeight: "900", textAlign: "center" },
  promptSub:   { color: "#9ca3af", fontSize: 13, textAlign: "center", lineHeight: 18 },

  inputArea:  { padding: 16, gap: 12 },
  input:      { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 16, padding: 16, color: "#fff", fontSize: 16, fontWeight: "600", minHeight: 80, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", textAlignVertical: "top" },
  submitBtn:  { borderRadius: 16, overflow: "hidden" },
  submitInner:{ padding: 16, alignItems: "center" },
  submitText: { color: "#fff", fontSize: 17, fontWeight: "900" },

  lockedCard: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  lockedEmoji:{ fontSize: 56 },
  lockedTitle:{ color: "#fff", fontSize: 22, fontWeight: "900" },
  lockedSub:  { color: "#9ca3af", fontSize: 15 },

  itemCard: { margin: 16, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 20, padding: 24, gap: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  itemLabel: { color: "#6b7280", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  itemText:  { color: "#fff", fontSize: 20, fontWeight: "800", lineHeight: 28, fontStyle: "italic" },

  revealArea: { padding: 16, gap: 12 },
  authorCard: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 18, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.1)", gap: 4 },
  authorCardMe: { borderColor: "#a78bfa", backgroundColor: "rgba(167,139,250,0.12)" },
  authorLabel:  { color: "#6b7280", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  authorName:   { color: "#fff", fontSize: 22, fontWeight: "900" },
  authorNameMe: { color: "#a78bfa" },
  resultCard:   { borderRadius: 14, padding: 16, alignItems: "center" },
  resultCorrect:{ backgroundColor: "rgba(74,222,128,0.15)", borderWidth: 1, borderColor: "rgba(74,222,128,0.4)" },
  resultWrong:  { backgroundColor: "rgba(248,113,113,0.12)", borderWidth: 1, borderColor: "rgba(248,113,113,0.3)" },
  resultText:   { color: "#fff", fontSize: 16, fontWeight: "800" },
  guessTally:   { color: "#6b7280", fontSize: 13, textAlign: "center" },

  authorWaiting: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  authorWaitingEmoji: { fontSize: 56 },
  authorWaitingText:  { color: "#9ca3af", fontSize: 16, textAlign: "center", paddingHorizontal: 24, lineHeight: 22 },

  guessArea:  { flex: 1, padding: 16, gap: 10 },
  guessLabel: { color: "#9ca3af", fontSize: 14, fontWeight: "700" },
  guessTile:  { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  avatar:     { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 17, fontWeight: "900" },
  guessTileName: { color: "#fff", fontSize: 17, fontWeight: "700" },

  scoreList: { width: "100%", marginTop: 12 },
  scoreRow:  { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  scoreRank: { fontSize: 22, minWidth: 36 },
  scoreName: { flex: 1, color: "#fff", fontSize: 16, fontWeight: "700" },
  scorePts:  { color: "#a78bfa", fontSize: 16, fontWeight: "900" },
});
