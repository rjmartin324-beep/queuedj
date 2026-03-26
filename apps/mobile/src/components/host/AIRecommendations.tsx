import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, ActivityIndicator,
} from "react-native";
import { useRoom } from "../../contexts/RoomContext";
import { socketManager } from "../../lib/socket";
import { SkeletonShimmer } from "../shared/SkeletonShimmer";

// ─────────────────────────────────────────────────────────────────────────────
// AIRecommendations
//
// Fetches ranked track recommendations from the taste graph (ML service).
// Based on the host's RLHF signal history — what their crowds respond to.
// Falls back gracefully: empty state if no profile yet.
// ─────────────────────────────────────────────────────────────────────────────

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

interface Recommendation {
  isrc:   string;
  title:  string | null;
  artist: string | null;
  bpm:    number | null;
  energy: number | null;
  genre:  string | null;
  score:  number;
}

export function AIRecommendations() {
  const { state } = useRoom();
  const [recs, setRecs]           = useState<Recommendation[]>([]);
  const [loading, setLoading]     = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [source, setSource]       = useState<"personal" | "trending">("trending");
  const [addedIds, setAddedIds]   = useState<Set<string>>(new Set());
  const [thumbs, setThumbs]       = useState<Map<string, "up" | "down">>(new Map());

  const crowdState = (state.room?.crowdState as string) ?? "PEAK";
  const guestId    = state.guestId;
  const roomId     = state.room?.id;

  const load = useCallback(async () => {
    if (!guestId) return;
    setLoading(true);
    try {
      const hour = new Date().getHours();
      const res = await fetch(
        `${API_URL}/recommendations/${guestId}?crowd_state=${crowdState}&hour_of_day=${hour}&limit=15`,
        { signal: AbortSignal.timeout(6000) },
      );
      if (!res.ok) return;
      const data = await res.json();
      setRecs(data.recommendations ?? []);
      setUpdatedAt(data.profile_updated_at ?? null);
      setSource(data.source ?? "trending");
    } catch {
      // ML unavailable — no-op
    } finally {
      setLoading(false);
    }
  }, [guestId, crowdState]);

  useEffect(() => { load(); }, [load]);

  function handleAddToQueue(rec: Recommendation) {
    const socket = socketManager.get();
    if (!socket || !roomId || !guestId) return;

    socket.emit("queue:request", {
      roomId,
      guestId,
      isrc:           rec.isrc,
      title:          rec.title ?? "Unknown",
      artist:         rec.artist ?? "Unknown",
      sourcePlatform: "recommendation",
    } as any, (ack: any) => {
      if (ack?.accepted) {
        setAddedIds((prev) => new Set(prev).add(rec.isrc));
      }
    });
  }

  async function sendFeedback(rec: Recommendation, signal: "up" | "down") {
    if (!guestId || thumbs.get(rec.isrc)) return;
    setThumbs(prev => new Map(prev).set(rec.isrc, signal));
    try {
      await fetch(`${API_URL}/recommendations/${guestId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isrc: rec.isrc, signal }),
      });
    } catch { /* offline — signal is still stored locally */ }
  }

  function vibeBar(score: number) {
    const pct = Math.round(score * 100);
    return (
      <View style={styles.vibeBarTrack}>
        <View style={[styles.vibeBarFill, { width: `${pct}%` as any }]} />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.skeletonWrap}>
        {[0, 1, 2, 3, 4].map(i => (
          <View key={i} style={styles.skeletonRow}>
            <SkeletonShimmer width={28} height={14} borderRadius={4} />
            <View style={styles.skeletonInfo}>
              <SkeletonShimmer width="65%" height={13} borderRadius={6} />
              <SkeletonShimmer width="45%" height={10} borderRadius={5} style={{ marginTop: 5 }} />
              <SkeletonShimmer width="80%" height={2} borderRadius={1} style={{ marginTop: 6 }} />
            </View>
            <SkeletonShimmer width={32} height={32} borderRadius={16} />
          </View>
        ))}
      </View>
    );
  }

  if (recs.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No recommendations yet</Text>
        <Text style={styles.emptyBody}>
          Play a few sessions first — the AI learns what your crowd responds to
          and suggests tracks that match.
        </Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={load}>
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>AI Picks</Text>
          {updatedAt && (
            <Text style={styles.headerSub}>
              Profile updated {new Date(updatedAt).toLocaleDateString()}
            </Text>
          )}
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={load}>
          <Text style={styles.refreshText}>↻ Refresh</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.crowdTag}>
          Tuned for: <Text style={styles.crowdTagBold}>{crowdState}</Text> crowd
        </Text>
        <View style={[styles.sourceBadge, source === "personal" && styles.sourceBadgePersonal]}>
          <Text style={[styles.sourceText, source === "personal" && styles.sourceTextPersonal]}>
            {source === "personal" ? "✨ Personal" : "📈 Trending"}
          </Text>
        </View>
      </View>

      {/* Track list */}
      <FlatList
        data={recs}
        keyExtractor={(item) => item.isrc}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        renderItem={({ item, index }) => {
          const added = addedIds.has(item.isrc);
          return (
            <View style={styles.row}>
              <Text style={styles.rank}>#{index + 1}</Text>
              <View style={styles.info}>
                <Text style={styles.title} numberOfLines={1}>
                  {item.title ?? item.isrc}
                </Text>
                <Text style={styles.artist} numberOfLines={1}>
                  {item.artist ?? "—"}
                </Text>
                <View style={styles.meta}>
                  {item.bpm    && <Text style={styles.chip}>{Math.round(item.bpm)} BPM</Text>}
                  {item.genre  && <Text style={styles.chip}>{item.genre}</Text>}
                  {item.energy != null && (
                    <Text style={styles.chip}>
                      E {Math.round(item.energy * 100)}
                    </Text>
                  )}
                </View>
                {vibeBar(item.score)}
              </View>
              <View style={styles.rowActions}>
                <View style={styles.thumbs}>
                  <TouchableOpacity
                    style={[styles.thumbBtn, thumbs.get(item.isrc) === "up" && styles.thumbBtnUp]}
                    onPress={() => sendFeedback(item, "up")}
                    disabled={!!thumbs.get(item.isrc)}
                  >
                    <Text style={styles.thumbIcon}>👍</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.thumbBtn, thumbs.get(item.isrc) === "down" && styles.thumbBtnDown]}
                    onPress={() => sendFeedback(item, "down")}
                    disabled={!!thumbs.get(item.isrc)}
                  >
                    <Text style={styles.thumbIcon}>👎</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={[styles.addBtn, added && styles.addBtnDone]}
                  onPress={() => handleAddToQueue(item)}
                  disabled={added}
                >
                  <Text style={[styles.addBtnText, added && styles.addBtnTextDone]}>
                    {added ? "✓" : "+"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:   { paddingBottom: 20 },
  center:      { alignItems: "center", paddingVertical: 40, gap: 12, paddingHorizontal: 20 },
  loadingText: { color: "#555", fontSize: 13, marginTop: 8 },
  emptyTitle:  { color: "#fff", fontSize: 16, fontWeight: "700", textAlign: "center" },
  emptyBody:   { color: "#555", fontSize: 13, textAlign: "center", lineHeight: 20 },

  header:      { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
  headerTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },
  headerSub:   { color: "#555", fontSize: 11, marginTop: 2 },

  crowdTag:     { color: "#555", fontSize: 12, marginBottom: 12 },
  crowdTagBold: { color: "#c4b5fd", fontWeight: "700" },

  refreshBtn:  { backgroundColor: "#1a1a1a", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: "#2a2a2a" },
  refreshText: { color: "#c4b5fd", fontSize: 12, fontWeight: "700" },

  sep:    { height: 1, backgroundColor: "#141414" },
  row:    { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 10 },
  rank:   { color: "#333", fontSize: 13, fontWeight: "700", width: 28, textAlign: "right" },

  info:   { flex: 1, gap: 3 },
  title:  { color: "#fff", fontSize: 13, fontWeight: "700" },
  artist: { color: "#666", fontSize: 12 },
  meta:   { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 2 },
  chip:   { backgroundColor: "#1a1a1a", color: "#888", fontSize: 10, fontWeight: "600", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },

  vibeBarTrack: { height: 2, backgroundColor: "#1a1a1a", borderRadius: 1, marginTop: 4, overflow: "hidden" },
  vibeBarFill:  { height: 2, backgroundColor: "#6c47ff", borderRadius: 1 },

  addBtn:        { width: 32, height: 32, borderRadius: 16, backgroundColor: "#6c47ff22", borderWidth: 1, borderColor: "#6c47ff55", alignItems: "center", justifyContent: "center" },
  addBtnDone:    { backgroundColor: "#14532d22", borderColor: "#22c55e55" },
  addBtnText:    { color: "#c4b5fd", fontSize: 18, fontWeight: "700", lineHeight: 22 },
  addBtnTextDone:{ color: "#22c55e" },

  metaRow:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sourceBadge:   { backgroundColor: "#1a1a1a", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: "#2a2a2a" },
  sourceBadgePersonal: { backgroundColor: "#1a0f3a", borderColor: "#4c2ea0" },
  sourceText:    { color: "#555", fontSize: 11, fontWeight: "700" },
  sourceTextPersonal: { color: "#c4b5fd" },

  rowActions:    { alignItems: "center", gap: 6 },
  thumbs:        { flexDirection: "row", gap: 4 },
  thumbBtn:      { width: 26, height: 26, borderRadius: 13, backgroundColor: "#1a1a1a", alignItems: "center", justifyContent: "center" },
  thumbBtnUp:    { backgroundColor: "#14532d" },
  thumbBtnDown:  { backgroundColor: "#450a0a" },
  thumbIcon:     { fontSize: 12 },

  skeletonWrap:  { paddingTop: 8 },
  skeletonRow:   { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: "#141414" },
  skeletonInfo:  { flex: 1 },
});
