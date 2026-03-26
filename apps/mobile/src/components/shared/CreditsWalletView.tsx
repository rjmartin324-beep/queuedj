import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

// ─────────────────────────────────────────────────────────────────────────────
// CreditsWalletView — shows balance, recent history, and spend options
// ─────────────────────────────────────────────────────────────────────────────

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

interface HistoryRow {
  delta:         number;
  balance_after: number;
  reason:        string;
  created_at:    string;
}

const REASON_LABELS: Record<string, { emoji: string; label: string }> = {
  vote_cast:       { emoji: "✓", label: "Voted" },
  track_request:   { emoji: "🎵", label: "Track requested" },
  game_win:        { emoji: "🏆", label: "Game win" },
  full_session:    { emoji: "🎉", label: "Full session" },
  admin_grant:     { emoji: "⭐", label: "Admin bonus" },
  wardrobe_unlock: { emoji: "👗", label: "Wardrobe unlock" },
  emote_purchase:  { emoji: "🎭", label: "Emote purchase" },
};

interface Props {
  guestId: string;
}

export function CreditsWalletView({ guestId }: Props) {
  const [balance, setBalance]   = useState<number | null>(null);
  const [history, setHistory]   = useState<HistoryRow[]>([]);
  const [loading, setLoading]   = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [balRes, histRes] = await Promise.all([
        fetch(`${API_URL}/credits/${encodeURIComponent(guestId)}`),
        fetch(`${API_URL}/credits/${encodeURIComponent(guestId)}/history?limit=20`),
      ]);
      if (balRes.ok)  setBalance((await balRes.json()).balance ?? 0);
      if (histRes.ok) setHistory((await histRes.json()).history ?? []);
    } catch { /* offline */ }
    setLoading(false);
  }

  useEffect(() => { load(); }, [guestId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#a78bfa" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Balance card */}
      <LinearGradient
        colors={["rgba(124,58,237,0.3)", "rgba(109,40,217,0.15)"]}
        style={styles.balanceCard}
      >
        <Text style={styles.balanceLabel}>VIBE CREDITS</Text>
        <Text style={styles.balanceValue}>⚡ {balance?.toLocaleString() ?? "0"}</Text>
        <Text style={styles.balanceSub}>Earn by voting, requesting, and winning games</Text>
      </LinearGradient>

      {/* Earn rates */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>HOW TO EARN</Text>
        <View style={styles.ratesGrid}>
          {[
            { emoji: "✓",  label: "Vote",        pts: "+1" },
            { emoji: "🎵", label: "Request",      pts: "+2" },
            { emoji: "🏆", label: "Win a game",   pts: "+10" },
            { emoji: "🎉", label: "Full session", pts: "+5" },
          ].map((r) => (
            <View key={r.label} style={styles.rateCard}>
              <Text style={styles.rateEmoji}>{r.emoji}</Text>
              <Text style={styles.rateLabel}>{r.label}</Text>
              <Text style={styles.ratePts}>{r.pts}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* History */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>RECENT HISTORY</Text>
        {history.length === 0 ? (
          <Text style={styles.empty}>No credits yet — go party!</Text>
        ) : (
          history.map((row, i) => {
            const info = REASON_LABELS[row.reason] ?? { emoji: "⚡", label: row.reason };
            const isEarn = row.delta > 0;
            return (
              <View key={i} style={styles.histRow}>
                <Text style={styles.histEmoji}>{info.emoji}</Text>
                <View style={styles.histInfo}>
                  <Text style={styles.histLabel}>{info.label}</Text>
                  <Text style={styles.histDate}>
                    {new Date(row.created_at).toLocaleDateString()} · Balance: {row.balance_after}
                  </Text>
                </View>
                <Text style={[styles.histDelta, { color: isEarn ? "#22c55e" : "#ef4444" }]}>
                  {isEarn ? "+" : ""}{row.delta}
                </Text>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  center:    { flex: 1, justifyContent: "center", alignItems: "center" },

  balanceCard: {
    margin: 16,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.4)",
  },
  balanceLabel: { color: "rgba(167,139,250,0.7)", fontSize: 11, fontWeight: "800", letterSpacing: 2, marginBottom: 8 },
  balanceValue: { color: "#fff", fontSize: 44, fontWeight: "900", letterSpacing: -1 },
  balanceSub:   { color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 8, textAlign: "center" },

  section:      { paddingHorizontal: 16, marginBottom: 20 },
  sectionLabel: { color: "#6b7280", fontSize: 10, fontWeight: "800", letterSpacing: 2, marginBottom: 12 },

  ratesGrid: { flexDirection: "row", gap: 8 },
  rateCard:  {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  rateEmoji: { fontSize: 20 },
  rateLabel: { color: "#9ca3af", fontSize: 10, fontWeight: "600", textAlign: "center" },
  ratePts:   { color: "#22c55e", fontWeight: "900", fontSize: 15 },

  histRow:  {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  histEmoji: { fontSize: 20, width: 28, textAlign: "center" },
  histInfo:  { flex: 1 },
  histLabel: { color: "#fff", fontWeight: "600", fontSize: 13 },
  histDate:  { color: "#6b7280", fontSize: 11, marginTop: 2 },
  histDelta: { fontWeight: "900", fontSize: 16, minWidth: 36, textAlign: "right" },

  empty: { color: "#6b7280", fontSize: 14, textAlign: "center", paddingVertical: 20 },
});
