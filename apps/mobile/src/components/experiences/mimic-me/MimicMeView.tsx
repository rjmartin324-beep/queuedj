import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

const RATINGS = [1,2,3,4,5];

export function MimicMeView() {
  const { state, sendAction } = useRoom();
  const d = state.guestViewData as any ?? state.experienceState as any;
  const phase     = d?.phase ?? "waiting";
  const performer = d?.currentPerformer ?? "";
  const action    = d?.action ?? null;
  const ratings   = d?.ratings ?? {};
  const round     = d?.round ?? 1;
  const total     = d?.totalRounds ?? 5;

  const isPerformer = state.guestId === performer;
  const myRating    = ratings[state.guestId ?? ""];
  const [rated, setRated] = useState<number|null>(null);

  function rate(val: number) {
    if (rated || myRating || isPerformer) return;
    setRated(val);
    sendAction("rate", { rating: val });
  }

  const memberName = (id: string) =>
    state.members.find(m => m.guestId === id)?.displayName ?? id.slice(0, 6);

  if (phase === "waiting") return (
    <View style={s.center}><Text style={s.emoji}>🎭</Text><Text style={s.title}>Mimic Me</Text><Text style={s.sub}>Waiting for host...</Text></View>
  );
  if (phase === "finished") return (
    <View style={s.center}><Text style={s.emoji}>🏆</Text><Text style={s.title}>Game Over!</Text></View>
  );

  const ratingsDone = Object.keys(ratings).length;
  const choice = rated ?? myRating ?? null;

  return (
    <View style={s.root}>
      <LinearGradient colors={["#0a0820","#0d0a20"]} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <Text style={s.round}>ROUND {round} / {total}</Text>
      </View>

      {action && (
        <View style={s.actionCard}>
          <Text style={s.actionEmoji}>{action.emoji}</Text>
          <Text style={s.actionText}>{action.instruction}</Text>
        </View>
      )}

      {phase === "studying" && (
        <View style={s.statusCard}>
          <Text style={s.statusText}>📖 Study this action — {memberName(performer)} will perform it!</Text>
        </View>
      )}

      {phase === "performing" && (
        <View style={s.statusCard}>
          {isPerformer ? (
            <Text style={s.statusText}>🎬 Perform the action above!</Text>
          ) : (
            <Text style={s.statusText}>👀 Watch {memberName(performer)} perform!</Text>
          )}
        </View>
      )}

      {phase === "rating" && !isPerformer && (
        <View style={s.ratingArea}>
          <Text style={s.ratingLabel}>Rate {memberName(performer)}'s performance:</Text>
          <View style={s.stars}>
            {RATINGS.map(v => (
              <TouchableOpacity key={v} onPress={() => rate(v)} style={s.starBtn} disabled={!!choice} activeOpacity={0.7}>
                <Text style={[s.star, choice !== null && v <= choice && s.starFilled]}>
                  {choice !== null && v <= choice ? "⭐" : "☆"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {choice && <Text style={s.ratingDone}>{ratingsDone} rated ✓</Text>}
        </View>
      )}

      {phase === "rating" && isPerformer && (
        <View style={s.statusCard}><Text style={s.statusText}>⏳ Waiting for ratings...</Text></View>
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
  actionCard: { margin: 16, backgroundColor: "rgba(124,58,237,0.2)", borderRadius: 24, padding: 32, alignItems: "center", gap: 12, borderWidth: 1, borderColor: "rgba(167,139,250,0.3)" },
  actionEmoji:{ fontSize: 64 },
  actionText: { color: "#fff", fontSize: 18, fontWeight: "800", textAlign: "center", lineHeight: 26 },
  statusCard: { marginHorizontal: 16, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 14, padding: 16, alignItems: "center" },
  statusText: { color: "#e5e7eb", fontSize: 15, fontWeight: "600", textAlign: "center" },
  ratingArea: { padding: 16, alignItems: "center", gap: 12 },
  ratingLabel:{ color: "#e5e7eb", fontSize: 15, fontWeight: "700" },
  stars:      { flexDirection: "row", gap: 8 },
  starBtn:    { padding: 8 },
  star:       { fontSize: 36, color: "#4b5563" },
  starFilled: { color: "#fbbf24" },
  ratingDone: { color: "#6b7280", fontSize: 13 },
});
