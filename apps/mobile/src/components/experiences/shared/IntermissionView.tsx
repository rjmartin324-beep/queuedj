import React, { useRef, useEffect, useState } from "react";
import { View, Text, StyleSheet, Animated, ScrollView, TouchableOpacity, Easing } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";
import { SessionLeaderboard } from "../../shared/SessionLeaderboard";
import { socketManager } from "../../../lib/socket";

const TIPS = [
  "The host is picking the next game 🎮",
  "Get ready — things are about to heat up 🔥",
  "Host is setting the vibe ✨",
  "Stand by for the next round 🎯",
  "Something fun is coming 🎉",
];

const AVATAR_COLORS = [
  "#7c3aed","#a855f7","#ec4899","#f97316","#22c55e","#06b6d4","#3b82f6","#eab308",
];

function avatarColor(guestId: string) {
  let hash = 0;
  for (let i = 0; i < guestId.length; i++) hash = (hash * 31 + guestId.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

// ─── Confetti Particle ────────────────────────────────────────────────────────

const CONFETTI_COLORS = ["#f97316","#a855f7","#22c55e","#3b82f6","#f59e0b","#ec4899","#06b6d4"];

function ConfettiParticle({ color, startX, delay }: { color: string; startX: number; delay: number }) {
  const y    = useRef(new Animated.Value(-20)).current;
  const x    = useRef(new Animated.Value(0)).current;
  const op   = useRef(new Animated.Value(1)).current;
  const rot  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(y,   { toValue: 600, duration: 1800, useNativeDriver: true, easing: Easing.linear }),
        Animated.timing(x,   { toValue: (Math.random() - 0.5) * 120, duration: 1800, useNativeDriver: true }),
        Animated.timing(op,  { toValue: 0,   duration: 1800, delay: 900, useNativeDriver: true }),
        Animated.timing(rot, { toValue: 3,   duration: 1800, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const spin = rot.interpolate({ inputRange: [0, 3], outputRange: ["0deg", "1080deg"] });

  return (
    <Animated.View style={{
      position: "absolute",
      left: startX,
      top: 0,
      width: 10,
      height: 10,
      borderRadius: 2,
      backgroundColor: color,
      opacity: op,
      transform: [{ translateY: y }, { translateX: x }, { rotate: spin }],
    }} />
  );
}

function Confetti() {
  const particles = Array.from({ length: 30 }, (_, i) => ({
    key: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    startX: Math.random() * 360,
    delay: Math.random() * 600,
  }));
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map(p => <ConfettiParticle key={p.key} color={p.color} startX={p.startX} delay={p.delay} />)}
    </View>
  );
}

// ─── Post-Game Results ────────────────────────────────────────────────────────

function PostGameResults({ scores, members, sendAction, roomId }: {
  scores: Record<string, number>;
  members: { guestId: string; displayName?: string | null }[];
  sendAction: (action: string, payload?: any) => void;
  roomId: string;
}) {
  const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
  const [voted, setVoted] = useState(false);
  const [playAgainCount, setPlayAgainCount] = useState(0);

  useEffect(() => {
    const socket = socketManager.get();
    if (!socket) return;
    const handler = ({ count }: { count: number }) => setPlayAgainCount(count);
    socket.on("play_again:votes" as any, handler);
    return () => { socket.off("play_again:votes" as any, handler); };
  }, []);
  const titleScale = useRef(new Animated.Value(0.5)).current;
  const titleOp    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(titleScale, { toValue: 1, useNativeDriver: true, tension: 70, friction: 8 }),
      Animated.timing(titleOp,   { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  const memberName = (id: string) =>
    members.find(m => m.guestId === id)?.displayName ?? id.slice(0, 6);

  const RANK_ICONS = ["🥇","🥈","🥉"];

  return (
    <View style={pg.container}>
      <Confetti />
      <Animated.View style={[pg.header, { transform: [{ scale: titleScale }], opacity: titleOp }]}>
        <Text style={pg.trophy}>🏆</Text>
        <Text style={pg.title}>Round Over!</Text>
      </Animated.View>

      <ScrollView contentContainerStyle={pg.list} showsVerticalScrollIndicator={false}>
        {sorted.slice(0, 8).map(([gId, pts], i) => (
          <Animated.View key={gId} style={[pg.row, i < 3 && pg.rowTop]}>
            <Text style={pg.rank}>{RANK_ICONS[i] ?? `#${i+1}`}</Text>
            <Text style={pg.name} numberOfLines={1}>{memberName(gId)}</Text>
            <Text style={[pg.pts, i === 0 && pg.ptsGold]}>{pts}</Text>
          </Animated.View>
        ))}
        {roomId ? (
          <View style={pg.sessionBoard}>
            <Text style={pg.sessionBoardTitle}>SESSION STANDINGS</Text>
            <SessionLeaderboard roomId={roomId} pollMs={0} limit={8} />
          </View>
        ) : null}
      </ScrollView>

      <View style={pg.footer}>
        {!voted ? (
          <TouchableOpacity
            style={pg.voteBtn}
            onPress={() => { setVoted(true); sendAction("vote_play_again", {}); }}
            activeOpacity={0.8}
          >
            <LinearGradient colors={["#7c3aed","#6d28d9"]} style={pg.voteBtnInner}>
              <Text style={pg.voteBtnText}>🔁 Play Again?</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <View style={pg.votedRow}>
            <Text style={pg.votedText}>✓ Vote cast — waiting for host</Text>
          </View>
        )}
        {playAgainCount > 0 && (
          <Text style={pg.playAgainCount}>🔁 {playAgainCount} want{playAgainCount === 1 ? "s" : ""} to play again</Text>
        )}
        <Text style={pg.footerSub}>Waiting for host to pick the next game…</Text>
      </View>
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function IntermissionView() {
  const { state, sendAction } = useRoom();
  const pulse = useRef(new Animated.Value(1)).current;
  const tip   = TIPS[Math.floor(Math.random() * TIPS.length)];

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 900,  useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 900,  useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const roomCode = state.room?.code ?? "";
  const guests = state.members.filter(m => !m.isWorkerNode && m.role !== "HOST" && m.role !== "CO_HOST");
  const myId = state.guestId;

  // If we just came from a game that has scores, show the post-game results.
  // Guard: if the host has already launched a new experience (activeExperience changes),
  // clear results so a stale experienceState from the previous game doesn't bleed through.
  const scores: Record<string, number> | undefined = (state.experienceState as any)?.scores;
  const hasScores = scores && Object.keys(scores).length > 0;
  const lastPhase: string | undefined = (state.experienceState as any)?.phase;
  const showResults =
    hasScores &&
    (lastPhase === "finished" || lastPhase === "leaderboard") &&
    !state.activeExperience; // activeExperience is set when a new game is launching

  if (showResults) {
    return <PostGameResults scores={scores!} members={state.members} sendAction={sendAction} roomId={state.room?.id ?? ""} />;
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#03001c", "#07001a", "#0f0028"]} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={["transparent", "rgba(181,23,158,0.10)", "rgba(114,9,183,0.22)"]}
        style={[StyleSheet.absoluteFill, { top: "50%" }]}
        pointerEvents="none"
      />

      <Animated.Text style={[styles.emoji, { transform: [{ scale: pulse }] }]}>⏳</Animated.Text>
      <Text style={styles.heading}>Hang tight…</Text>
      <Text style={styles.tip}>{tip}</Text>

      {/* Party members */}
      {guests.length > 0 && (
        <View style={styles.partyBox}>
          <Text style={styles.partyLabel}>IN THE PARTY — {guests.length}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.partyRow}
          >
            {guests.map(m => {
              const isMe = m.guestId === myId;
              const name = m.displayName ?? m.guestId.slice(0, 8);
              const color = avatarColor(m.guestId);
              return (
                <View key={m.guestId} style={styles.chip}>
                  <View style={[styles.chipDot, { backgroundColor: color }]} />
                  <Text style={[styles.chipName, isMe && styles.chipNameMe]} numberOfLines={1}>
                    {name}{isMe ? " (you)" : ""}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {roomCode ? (
        <View style={styles.codeWrap}>
          <Text style={styles.codeLabel}>ROOM CODE</Text>
          <Text style={styles.code}>{roomCode}</Text>
        </View>
      ) : null}

      {state.room?.id ? (
        <View style={styles.boardWrap}>
          <SessionLeaderboard roomId={state.room.id} pollMs={15_000} limit={5} />
        </View>
      ) : null}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#03001c" },
  emoji:     { fontSize: 56, marginBottom: 20 },
  heading:   { color: "#fff", fontSize: 26, fontWeight: "900", marginBottom: 10 },
  tip:       { color: "#6b7fa0", fontSize: 15, textAlign: "center", paddingHorizontal: 40, lineHeight: 22 },

  partyBox: {
    marginTop: 28, width: "100%", paddingHorizontal: 20, gap: 10,
  },
  partyLabel: {
    color: "rgba(255,255,255,0.3)", fontSize: 10, fontWeight: "800", letterSpacing: 2, textAlign: "center",
  },
  partyRow: { gap: 8, paddingHorizontal: 4, flexDirection: "row" },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7,
  },
  chipDot:    { width: 8, height: 8, borderRadius: 4 },
  chipName:   { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "700", maxWidth: 120 },
  chipNameMe: { color: "#a78bfa" },

  codeWrap:  { marginTop: 32, alignItems: "center" },
  codeLabel: { color: "#4a5568", fontSize: 10, fontWeight: "700", letterSpacing: 1.5, marginBottom: 6 },
  code:      { color: "rgba(167,139,250,0.6)", fontSize: 28, fontWeight: "900", letterSpacing: 6 },
  boardWrap: { width: "100%", marginTop: 20 },
});

const pg = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#03001c" },
  header:    { alignItems: "center", paddingTop: 40, paddingBottom: 16 },
  trophy:    { fontSize: 56 },
  title:     { color: "#fff", fontSize: 28, fontWeight: "900", marginTop: 8 },
  list:      { paddingHorizontal: 20, paddingBottom: 160, gap: 8 },
  row:       { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, gap: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  rowTop:    { backgroundColor: "rgba(124,58,237,0.15)", borderColor: "rgba(167,139,250,0.25)" },
  rank:      { fontSize: 22, width: 32 },
  name:      { flex: 1, color: "#e5e7eb", fontSize: 15, fontWeight: "700" },
  pts:       { color: "#a78bfa", fontSize: 18, fontWeight: "900" },
  ptsGold:   { color: "#fbbf24" },
  footer:    { position: "absolute", bottom: 0, left: 0, right: 0, padding: 20, gap: 10, backgroundColor: "rgba(3,0,28,0.92)" },
  voteBtn:   { borderRadius: 16, overflow: "hidden" },
  voteBtnInner: { padding: 16, alignItems: "center" },
  voteBtnText:  { color: "#fff", fontSize: 17, fontWeight: "900" },
  votedRow:  { backgroundColor: "rgba(34,197,94,0.15)", borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(74,222,128,0.3)" },
  votedText: { color: "#4ade80", fontSize: 14, fontWeight: "700" },
  footerSub:       { color: "#4b5563", fontSize: 12, textAlign: "center" },
  playAgainCount:  { color: "#a78bfa", fontSize: 13, fontWeight: "700", textAlign: "center" },
  sessionBoard: { marginTop: 16, backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  sessionBoardTitle: { color: "#4b5563", fontSize: 10, fontWeight: "800", letterSpacing: 2, textAlign: "center", paddingTop: 14 },
});
