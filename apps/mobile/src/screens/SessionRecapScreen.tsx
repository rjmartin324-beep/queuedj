import React, { useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Easing, Share,
} from "react-native";
import { SessionLeaderboard } from "../components/shared/SessionLeaderboard";

// ─────────────────────────────────────────────────────────────────────────────
// Session Recap Screen
//
// Shown after a room closes. Receives summary stats via props.
// The parent (HomeScreen/RoomContext) detects "room:closed" socket event
// and navigates here with the final state.
// ─────────────────────────────────────────────────────────────────────────────

export interface SessionRecapData {
  roomId:     string;
  roomName:   string;
  roomCode:   string;
  tracksPlayed: number;
  guestCount:   number;
  topTrack?:    { title: string; artist: string } | null;
  myVotes:      number;
  myRequests:   number;
  myGameWins:   number;
  myCreditsEarned: number;
}

interface Props {
  recap:   SessionRecapData;
  onClose: () => void;
}

// ─── Stat Row ─────────────────────────────────────────────────────────────────

function StatRow({ icon, label, value, delay }: { icon: string; label: string; value: string | number; delay: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const slideX  = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, delay, useNativeDriver: true }),
      Animated.timing(slideX,  { toValue: 0, duration: 350, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.statRow, { opacity, transform: [{ translateX: slideX }] }]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </Animated.View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SessionRecapScreen({ recap, onClose }: Props) {
  const titleScale  = useRef(new Animated.Value(0.6)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(titleScale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 9 }),
      Animated.timing(titleOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Title */}
        <Animated.View style={[styles.titleBlock, { transform: [{ scale: titleScale }], opacity: titleOpacity }]}>
          <Text style={styles.emoji}>🎉</Text>
          <Text style={styles.title}>Session Over</Text>
          <Text style={styles.subtitle}>{recap.roomName}  ·  {recap.roomCode}</Text>
        </Animated.View>

        {/* Session summary */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>SESSION STATS</Text>
          <StatRow icon="🎵" label="Tracks played" value={recap.tracksPlayed} delay={200} />
          <StatRow icon="👥" label="Guests"          value={recap.guestCount}   delay={280} />
          {recap.topTrack && (
            <StatRow icon="🔥" label="Most requested" value={`${recap.topTrack.title} — ${recap.topTrack.artist}`} delay={360} />
          )}
        </View>

        {/* My contributions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>YOUR SESSION</Text>
          <StatRow icon="✓"  label="Votes cast"      value={recap.myVotes}         delay={440} />
          <StatRow icon="🎵" label="Tracks requested" value={recap.myRequests}      delay={500} />
          <StatRow icon="🏆" label="Games won"        value={recap.myGameWins}      delay={560} />
          <StatRow icon="⚡" label="Credits earned"   value={`+${recap.myCreditsEarned}`} delay={620} />
        </View>

        {/* Leaderboard */}
        <View style={styles.card}>
          <SessionLeaderboard roomId={recap.roomId} pollMs={0} limit={5} />
        </View>

        {/* Share + Close */}
        <TouchableOpacity
          style={styles.shareButton}
          onPress={() => Share.share({
            message: `I just hosted a PartyGlue party "${recap.roomName}"! ${recap.tracksPlayed} tracks played, ${recap.guestCount} guests. Join me next time 🎉`,
          })}
        >
          <Text style={styles.shareText}>Share Session</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeText}>Back to Home</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#03001c" },
  scroll:    { padding: 24, paddingBottom: 60 },

  titleBlock: { alignItems: "center", marginBottom: 32 },
  emoji:      { fontSize: 56, marginBottom: 8 },
  title:      { color: "#fff", fontSize: 28, fontWeight: "900" },
  subtitle:   { color: "#6b7280", fontSize: 13, marginTop: 4 },

  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  cardTitle: {
    color: "#6b7280",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 14,
  },

  statRow:   { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  statIcon:  { fontSize: 16, width: 24 },
  statLabel: { flex: 1, color: "#9ca3af", fontSize: 13 },
  statValue: { color: "#fff", fontWeight: "800", fontSize: 14, textAlign: "right" },

  shareButton: {
    backgroundColor: "transparent",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.4)",
  },
  shareText: { color: "#a78bfa", fontWeight: "700", fontSize: 15 },

  closeButton: {
    backgroundColor: "#7c3aed",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 10,
  },
  closeText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
