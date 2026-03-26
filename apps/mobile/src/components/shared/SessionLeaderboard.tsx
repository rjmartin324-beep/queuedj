import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Animated, Easing, ActivityIndicator,
} from "react-native";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LeaderboardEntry {
  rank:        number;
  guestId:     string;
  displayName: string;
  votes:       number;
  requests:    number;
  game_wins:   number;
  score:       number;
}

// ─── Rank Card ────────────────────────────────────────────────────────────────

function RankCard({ entry, index }: { entry: LeaderboardEntry; index: number }) {
  const slideX = useRef(new Animated.Value(-60)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideX, {
        toValue: 0,
        duration: 350,
        delay: index * 60,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        delay: index * 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const isTop3 = entry.rank <= 3;
  const rankColors = ["#FFD700", "#C0C0C0", "#CD7F32"];
  const rankColor = isTop3 ? rankColors[entry.rank - 1] : "#6b7280";

  return (
    <Animated.View
      style={[
        styles.card,
        isTop3 && styles.cardTop3,
        { transform: [{ translateX: slideX }], opacity },
      ]}
    >
      <View style={[styles.rankBadge, { borderColor: rankColor }]}>
        {entry.rank === 1 ? (
          <Text style={[styles.rankText, { color: rankColor }]}>👑</Text>
        ) : (
          <Text style={[styles.rankText, { color: rankColor }]}>#{entry.rank}</Text>
        )}
      </View>

      <View style={styles.nameCol}>
        <Text style={styles.name} numberOfLines={1}>{entry.displayName}</Text>
        <View style={styles.statRow}>
          {entry.votes > 0    && <Text style={styles.statChip}>✓ {entry.votes}</Text>}
          {entry.requests > 0 && <Text style={styles.statChip}>🎵 {entry.requests}</Text>}
          {entry.game_wins > 0 && <Text style={styles.statChip}>🏆 {entry.game_wins}</Text>}
        </View>
      </View>

      <Text style={[styles.score, { color: rankColor }]}>{entry.score}</Text>
    </Animated.View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  roomId: string;
  /** Poll interval in ms — defaults to 10s */
  pollMs?: number;
  /** Max entries to show — defaults to 10 */
  limit?: number;
}

export function SessionLeaderboard({ roomId, pollMs = 10_000, limit = 10 }: Props) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    if (!roomId) return;
    try {
      const res = await fetch(`${API_URL}/rooms/${encodeURIComponent(roomId)}/leaderboard`);
      if (res.ok) {
        const data = await res.json();
        setEntries((data.leaderboard ?? []).slice(0, limit));
      }
    } catch { /* offline */ } finally {
      setLoading(false);
    }
  }, [roomId, limit]);

  useEffect(() => {
    fetchLeaderboard();
    const t = setInterval(fetchLeaderboard, pollMs);
    return () => clearInterval(t);
  }, [fetchLeaderboard, pollMs]);

  if (loading) return <ActivityIndicator color="#a78bfa" style={{ margin: 20 }} />;
  if (!entries.length) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>LEADERBOARD</Text>
      <FlatList
        data={entries}
        keyExtractor={(e) => e.guestId}
        renderItem={({ item, index }) => <RankCard entry={item} index={index} />}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
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
    marginBottom: 12,
    textAlign: "center",
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
  },
  cardTop3: {
    backgroundColor: "rgba(124,58,237,0.15)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.2)",
  },

  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: { fontSize: 13, fontWeight: "900" },

  nameCol:  { flex: 1 },
  name:     { color: "#fff", fontWeight: "700", fontSize: 14 },
  statRow:  { flexDirection: "row", gap: 6, marginTop: 3 },
  statChip: { color: "#9ca3af", fontSize: 11, fontWeight: "600" },

  score: { fontSize: 20, fontWeight: "900" },
});
