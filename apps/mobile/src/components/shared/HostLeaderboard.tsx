import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Animated, Easing,
} from "react-native";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HostEntry {
  host_fingerprint: string;
  total_sessions:   number;
  total_guests:     number;
  total_tracks:     number;
  peak_guests:      number;
  last_session_at:  string;
}

// ─── Host Card ────────────────────────────────────────────────────────────────

function HostCard({ entry, index }: { entry: HostEntry & { rank: number }; index: number }) {
  const slideY = useRef(new Animated.Value(30)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideY, {
        toValue: 0,
        duration: 400,
        delay: index * 70,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 350,
        delay: index * 70,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const rankColors = ["#FFD700", "#C0C0C0", "#CD7F32"];
  const rankColor = entry.rank <= 3 ? rankColors[entry.rank - 1] : "#6b7280";
  // Show only last 4 hex chars of fingerprint as anonymous display handle
  const handle = `DJ_${entry.host_fingerprint.slice(-4).toUpperCase()}`;

  return (
    <Animated.View
      style={[
        styles.card,
        entry.rank <= 3 && styles.cardHighlight,
        { transform: [{ translateY: slideY }], opacity },
      ]}
    >
      {/* Rank */}
      <View style={[styles.rankCircle, { borderColor: rankColor }]}>
        {entry.rank === 1 ? (
          <Text style={styles.crown}>👑</Text>
        ) : (
          <Text style={[styles.rankNum, { color: rankColor }]}>#{entry.rank}</Text>
        )}
      </View>

      {/* Identity + stats */}
      <View style={styles.body}>
        <Text style={styles.handle}>{handle}</Text>
        <View style={styles.pills}>
          <StatPill icon="🎉" value={entry.total_sessions} label="sessions" />
          <StatPill icon="👥" value={entry.total_guests}   label="guests"   />
          <StatPill icon="🎵" value={entry.total_tracks}   label="tracks"   />
        </View>
      </View>

      {/* Peak badge */}
      <View style={styles.peakBadge}>
        <Text style={styles.peakNum}>{entry.peak_guests}</Text>
        <Text style={styles.peakLabel}>peak</Text>
      </View>
    </Animated.View>
  );
}

function StatPill({ icon, value, label }: { icon: string; value: number; label: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillIcon}>{icon}</Text>
      <Text style={styles.pillValue}>{value ?? 0}</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  limit?: number;
}

export function HostLeaderboard({ limit = 10 }: Props) {
  const [entries, setEntries] = useState<(HostEntry & { rank: number })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/leaderboard/hosts?limit=${limit}`);
        if (res.ok) {
          const data = await res.json();
          const ranked = (data.leaderboard ?? []).map((e: HostEntry, i: number) => ({
            ...e,
            rank: i + 1,
          }));
          setEntries(ranked);
        }
      } catch { /* offline */ } finally {
        setLoading(false);
      }
    })();
  }, [limit]);

  if (loading) return null;
  if (!entries.length) {
    return <Text style={styles.empty}>No sessions recorded yet.</Text>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ALL-TIME HOST RANKINGS</Text>
      <FlatList
        data={entries}
        keyExtractor={(e) => e.host_fingerprint}
        renderItem={({ item, index }) => <HostCard entry={item} index={index} />}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { padding: 16 },

  title: {
    color: "#a78bfa",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 14,
    textAlign: "center",
  },

  empty: { color: "#6b7280", textAlign: "center", padding: 24 },

  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  cardHighlight: {
    backgroundColor: "rgba(124,58,237,0.14)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.25)",
  },

  rankCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  crown:   { fontSize: 18 },
  rankNum: { fontSize: 13, fontWeight: "900" },

  body:   { flex: 1 },
  handle: { color: "#fff", fontWeight: "700", fontSize: 15, marginBottom: 4 },
  pills:  { flexDirection: "row", gap: 8, flexWrap: "wrap" },

  pill:       { flexDirection: "row", alignItems: "center", gap: 3 },
  pillIcon:   { fontSize: 11 },
  pillValue:  { color: "#e5e7eb", fontSize: 11, fontWeight: "700" },
  pillLabel:  { color: "#6b7280", fontSize: 11 },

  peakBadge: { alignItems: "center" },
  peakNum:   { color: "#a78bfa", fontSize: 18, fontWeight: "900" },
  peakLabel: { color: "#6b7280", fontSize: 10 },
});
