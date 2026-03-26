import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  ScrollView, ActivityIndicator, Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";

// ─────────────────────────────────────────────────────────────────────────────
// WeeklyTasteReport
//
// Fetches the last 7 days of the user's track request history from the API
// and renders a visual music taste profile:
//   - Top genres (bar chart)
//   - Avg BPM + energy
//   - Top 3 artists
//   - Top 3 tracks
//   - Vibe personality label (e.g. "Peak Hour Destroyer", "Chill Architect")
// ─────────────────────────────────────────────────────────────────────────────

const API_URL       = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";
const REPORT_KEY    = "partyglue_taste_report_cache";
const TASTE_TS_KEY  = "partyglue_taste_report_ts";

interface TasteReport {
  weekOf:       string;           // "YYYY-MM-DD" (Monday of the week)
  topGenres:    { genre: string; count: number }[];
  topArtists:   { artist: string; count: number }[];
  topTracks:    { title: string; artist: string; count: number }[];
  avgBpm:       number | null;
  avgEnergy:    number | null;
  totalRequests: number;
  vibePersonality: string;        // computed label
  vibeEmoji:    string;
}

const PERSONALITY_LABELS: { maxBpm: number; maxEnergy: number; label: string; emoji: string }[] = [
  { maxBpm: 100, maxEnergy: 0.4, label: "Sunset Chiller",        emoji: "🌅" },
  { maxBpm: 115, maxEnergy: 0.5, label: "Late Night Groover",     emoji: "🌙" },
  { maxBpm: 125, maxEnergy: 0.6, label: "Crowd Connector",        emoji: "🤝" },
  { maxBpm: 130, maxEnergy: 0.7, label: "Dance Floor Builder",    emoji: "🕺" },
  { maxBpm: 140, maxEnergy: 0.8, label: "Peak Hour Destroyer",    emoji: "🔥" },
  { maxBpm: 999, maxEnergy: 1.0, label: "Chaos Engineer",         emoji: "⚡" },
];

function computePersonality(avgBpm: number, avgEnergy: number): { label: string; emoji: string } {
  for (const p of PERSONALITY_LABELS) {
    if (avgBpm <= p.maxBpm && avgEnergy <= p.maxEnergy) return p;
  }
  return PERSONALITY_LABELS[PERSONALITY_LABELS.length - 1];
}

async function fetchReport(guestId: string): Promise<TasteReport | null> {
  try {
    const res = await fetch(`${API_URL}/taste-report/${encodeURIComponent(guestId)}?days=7`);
    if (!res.ok) return null;
    const data = await res.json();

    // Compute personality from BPM + energy
    const avgBpm    = data.avgBpm    ?? 120;
    const avgEnergy = data.avgEnergy ?? 0.5;
    const personality = computePersonality(avgBpm, avgEnergy);

    const report: TasteReport = {
      weekOf:         data.weekOf ?? new Date().toISOString().slice(0, 10),
      topGenres:      data.topGenres    ?? [],
      topArtists:     data.topArtists   ?? [],
      topTracks:      data.topTracks    ?? [],
      avgBpm:         data.avgBpm,
      avgEnergy:      data.avgEnergy,
      totalRequests:  data.totalRequests ?? 0,
      vibePersonality: personality.label,
      vibeEmoji:      personality.emoji,
    };

    await AsyncStorage.setItem(REPORT_KEY, JSON.stringify(report));
    await AsyncStorage.setItem(TASTE_TS_KEY, Date.now().toString());

    // Increment taste report counter for achievements
    const prev = parseInt((await AsyncStorage.getItem("stat_taste_reports")) ?? "0", 10);
    await AsyncStorage.setItem("stat_taste_reports", String(prev + 1));

    return report;
  } catch {
    return null;
  }
}

function GenreBar({ genre, count, max }: { genre: string; count: number; max: number }) {
  const pct = max > 0 ? count / max : 0;
  return (
    <View style={barStyles.row}>
      <Text style={barStyles.label} numberOfLines={1}>{genre}</Text>
      <View style={barStyles.track}>
        <LinearGradient
          colors={["#7c3aed", "#a78bfa"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={[barStyles.fill, { width: `${Math.max(pct * 100, 4)}%` as any }]}
        />
      </View>
      <Text style={barStyles.count}>{count}</Text>
    </View>
  );
}

const barStyles = StyleSheet.create({
  row:   { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  label: { color: "#9ca3af", fontSize: 12, width: 90 },
  track: { flex: 1, height: 8, backgroundColor: "#1f1f1f", borderRadius: 4, overflow: "hidden" },
  fill:  { height: "100%", borderRadius: 4 },
  count: { color: "#6b7280", fontSize: 11, width: 24, textAlign: "right" },
});

// ─── Main Component ───────────────────────────────────────────────────────────

export function WeeklyTasteReport({ guestId }: { guestId?: string | null }) {
  const [report,     setReport]     = useState<TasteReport | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadCached();
  }, []);

  async function loadCached() {
    const raw  = await AsyncStorage.getItem(REPORT_KEY);
    const tsRaw = await AsyncStorage.getItem(TASTE_TS_KEY);
    if (raw) {
      setReport(JSON.parse(raw));
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }
    if (tsRaw) setLastFetched(Number(tsRaw));
  }

  async function refresh() {
    if (!guestId) return;
    setLoading(true);
    const r = await fetchReport(guestId);
    if (r) {
      setReport(r);
      setLastFetched(Date.now());
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }
    setLoading(false);
  }

  // Auto-fetch if no cached report or cache older than 24 hrs
  useEffect(() => {
    const stale = !lastFetched || Date.now() - lastFetched > 24 * 3_600_000;
    if (guestId && stale && !report) refresh();
  }, [guestId]);

  const maxGenre = report?.topGenres[0]?.count ?? 1;
  const energyPct = report?.avgEnergy !== null && report?.avgEnergy !== undefined
    ? Math.round(report.avgEnergy * 100)
    : null;

  return (
    <>
      {/* Teaser card */}
      <Animated.View style={[styles.teaser, { opacity: fadeAnim }]}>
        <LinearGradient
          colors={["rgba(124,58,237,0.18)", "rgba(6,2,14,0)"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.teaserTop}>
          <Text style={styles.teaserLabel}>📊 WEEKLY TASTE REPORT</Text>
          {lastFetched && (
            <Text style={styles.teaserDate}>
              {new Date(lastFetched).toLocaleDateString([], { month: "short", day: "numeric" })}
            </Text>
          )}
        </View>

        {report ? (
          <>
            <View style={styles.personalityRow}>
              <Text style={styles.personalityEmoji}>{report.vibeEmoji}</Text>
              <View>
                <Text style={styles.personalityLabel}>{report.vibePersonality}</Text>
                <Text style={styles.personalityHint}>{report.totalRequests} tracks requested this week</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.viewBtn} onPress={() => setModalOpen(true)}>
              <Text style={styles.viewBtnText}>View Full Report →</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Request tracks in a room to generate your taste profile</Text>
            {guestId && (
              <TouchableOpacity style={styles.refreshBtn} onPress={refresh} disabled={loading}>
                {loading
                  ? <ActivityIndicator color="#a78bfa" size="small" />
                  : <Text style={styles.refreshBtnText}>Generate Report</Text>
                }
              </TouchableOpacity>
            )}
          </View>
        )}
      </Animated.View>

      {/* Full report modal */}
      <Modal transparent animationType="slide" visible={modalOpen} onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHandle} />

          <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {/* Header */}
            <LinearGradient colors={["#3b1f7a", "#1a0a3a"]} style={styles.modalHeader}>
              <Text style={styles.modalEmoji}>{report?.vibeEmoji ?? "🎵"}</Text>
              <Text style={styles.modalTitle}>{report?.vibePersonality ?? "Your Taste"}</Text>
              <Text style={styles.modalSubtitle}>
                {report?.totalRequests ?? 0} tracks · Last 7 days
              </Text>
              {report?.avgBpm && (
                <View style={styles.modalStatRow}>
                  <View style={styles.modalStat}>
                    <Text style={styles.modalStatVal}>{Math.round(report.avgBpm)}</Text>
                    <Text style={styles.modalStatLabel}>Avg BPM</Text>
                  </View>
                  {energyPct !== null && (
                    <>
                      <View style={styles.modalStatDivider} />
                      <View style={styles.modalStat}>
                        <Text style={styles.modalStatVal}>{energyPct}%</Text>
                        <Text style={styles.modalStatLabel}>Avg Energy</Text>
                      </View>
                    </>
                  )}
                </View>
              )}
            </LinearGradient>

            {/* Top Genres */}
            {report && report.topGenres.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>TOP GENRES</Text>
                {report.topGenres.slice(0, 6).map(g => (
                  <GenreBar key={g.genre} genre={g.genre} count={g.count} max={maxGenre} />
                ))}
              </View>
            )}

            {/* Top Artists */}
            {report && report.topArtists.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>TOP ARTISTS</Text>
                {report.topArtists.slice(0, 5).map((a, i) => (
                  <View key={a.artist} style={styles.rankRow}>
                    <Text style={styles.rankNum}>#{i + 1}</Text>
                    <Text style={styles.rankName} numberOfLines={1}>{a.artist}</Text>
                    <Text style={styles.rankCount}>{a.count}×</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Top Tracks */}
            {report && report.topTracks.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>MOST REQUESTED</Text>
                {report.topTracks.slice(0, 5).map((t, i) => (
                  <View key={`${t.title}${t.artist}`} style={styles.rankRow}>
                    <Text style={styles.rankNum}>#{i + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rankName} numberOfLines={1}>{t.title}</Text>
                      <Text style={styles.rankArtist} numberOfLines={1}>{t.artist}</Text>
                    </View>
                    <Text style={styles.rankCount}>{t.count}×</Text>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity style={styles.refreshFullBtn} onPress={refresh} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#a78bfa" />
                : <Text style={styles.refreshFullBtnText}>Refresh Report</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeFullBtn} onPress={() => setModalOpen(false)}>
              <Text style={styles.closeFullBtnText}>Close</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  teaser: {
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 20, borderWidth: 1, borderColor: "rgba(124,58,237,0.25)",
    padding: 18, gap: 12, overflow: "hidden",
  },
  teaserTop:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  teaserLabel:    { color: "#6b7280", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  teaserDate:     { color: "#4b5563", fontSize: 11 },
  personalityRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  personalityEmoji: { fontSize: 40 },
  personalityLabel: { color: "#fff", fontSize: 18, fontWeight: "800" },
  personalityHint:  { color: "#6b7280", fontSize: 12, marginTop: 2 },
  viewBtn:          { backgroundColor: "rgba(124,58,237,0.2)", borderRadius: 12, paddingVertical: 11, alignItems: "center", borderWidth: 1, borderColor: "rgba(124,58,237,0.4)" },
  viewBtnText:      { color: "#a78bfa", fontWeight: "700", fontSize: 14 },
  emptyState:       { gap: 10 },
  emptyText:        { color: "#6b7280", fontSize: 13, lineHeight: 18 },
  refreshBtn:       { backgroundColor: "#7c3aed", borderRadius: 12, paddingVertical: 11, alignItems: "center" },
  refreshBtnText:   { color: "#fff", fontWeight: "700", fontSize: 14 },

  // Modal
  modalContainer: { flex: 1, backgroundColor: "#0a0a0a", borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: 60 },
  modalHandle:    { width: 40, height: 4, borderRadius: 2, backgroundColor: "#333", alignSelf: "center", marginTop: 10 },
  modalScroll:    { paddingBottom: 60 },

  modalHeader:   { padding: 28, alignItems: "center", gap: 6 },
  modalEmoji:    { fontSize: 56 },
  modalTitle:    { color: "#fff", fontSize: 24, fontWeight: "900", textAlign: "center" },
  modalSubtitle: { color: "rgba(255,255,255,0.5)", fontSize: 13 },
  modalStatRow:  { flexDirection: "row", marginTop: 12, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 24, gap: 24 },
  modalStat:     { alignItems: "center", gap: 2 },
  modalStatVal:  { color: "#fff", fontSize: 22, fontWeight: "900" },
  modalStatLabel:{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "700" },
  modalStatDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.15)" },

  section:      { padding: 20, borderBottomWidth: 1, borderBottomColor: "#111" },
  sectionTitle: { color: "#6b7280", fontSize: 10, fontWeight: "800", letterSpacing: 2, marginBottom: 14 },

  rankRow:    { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  rankNum:    { color: "#4b5563", fontSize: 13, fontWeight: "700", width: 28 },
  rankName:   { flex: 1, color: "#fff", fontSize: 14, fontWeight: "600" },
  rankArtist: { color: "#6b7280", fontSize: 12, marginTop: 1 },
  rankCount:  { color: "#7c3aed", fontSize: 13, fontWeight: "700" },

  refreshFullBtn:     { margin: 20, borderRadius: 14, paddingVertical: 13, alignItems: "center", borderWidth: 1, borderColor: "rgba(124,58,237,0.4)", backgroundColor: "rgba(124,58,237,0.1)" },
  refreshFullBtnText: { color: "#a78bfa", fontWeight: "700", fontSize: 14 },
  closeFullBtn:       { marginHorizontal: 20, borderRadius: 14, paddingVertical: 14, alignItems: "center", backgroundColor: "#7c3aed" },
  closeFullBtnText:   { color: "#fff", fontWeight: "800", fontSize: 15 },
});
