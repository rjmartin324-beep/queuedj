import React, { useEffect, useState } from "react";
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─────────────────────────────────────────────────────────────────────────────
// RoomHistory — shows past sessions for this host device
//
// Primary: fetches from server API (GET /history/:hostGuestId)
// Fallback: local AsyncStorage cache (works offline)
// ─────────────────────────────────────────────────────────────────────────────

const HISTORY_KEY = "host_session_history";
const MAX_HISTORY = 20;
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

export interface SessionSummary {
  id:          string;
  roomCode:    string;
  date:        number; // unix ms
  guestCount:  number;
  trackCount:  number;
  topTracks:   { title: string; artist: string; votes: number }[];
  durationMs:  number;
}

// ─── Save / Load helpers (called from RoomContext on session end) ──────────────

export async function saveSessionToHistory(session: Omit<SessionSummary, "id">): Promise<void> {
  try {
    const raw      = await AsyncStorage.getItem(HISTORY_KEY);
    const existing: SessionSummary[] = raw ? JSON.parse(raw) : [];
    const newEntry: SessionSummary   = { ...session, id: `session_${Date.now()}` };
    const updated  = [newEntry, ...existing].slice(0, MAX_HISTORY);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // Non-critical — history is best-effort
  }
}

export async function loadSessionHistory(hostGuestId?: string): Promise<SessionSummary[]> {
  // Try server first
  if (hostGuestId) {
    try {
      const res = await fetch(`${API_URL}/history/${hostGuestId}`);
      if (res.ok) {
        const { sessions } = await res.json();
        const mapped: SessionSummary[] = sessions.map((s: any) => ({
          id: s.id,
          roomCode: s.roomCode,
          date: new Date(s.startedAt).getTime(),
          guestCount: s.guestCount,
          trackCount: s.trackCount,
          durationMs: s.durationMs,
          topTracks: (s.topTracks ?? []).map((t: any) => ({
            title: t.title,
            artist: t.artist,
            votes: t.voteCount,
          })),
        }));
        // Update local cache
        await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(mapped));
        return mapped;
      }
    } catch {
      // Fall through to local cache
    }
  }
  // Fallback: local AsyncStorage
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RoomHistory() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    loadSessionHistory().then((data) => {
      setSessions(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#6c47ff" />
      </View>
    );
  }

  if (sessions.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>🎛️</Text>
        <Text style={styles.emptyTitle}>No sessions yet</Text>
        <Text style={styles.emptySubtitle}>Your past parties will appear here</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={sessions}
      keyExtractor={(s) => s.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <SessionCard
          session={item}
          isExpanded={expanded === item.id}
          onToggle={() => setExpanded(expanded === item.id ? null : item.id)}
        />
      )}
    />
  );
}

function SessionCard({
  session, isExpanded, onToggle,
}: {
  session:    SessionSummary;
  isExpanded: boolean;
  onToggle:   () => void;
}) {
  const date     = new Date(session.date);
  const dateStr  = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const timeStr  = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const duration = Math.round(session.durationMs / 60000);

  return (
    <TouchableOpacity style={styles.card} onPress={onToggle} activeOpacity={0.8}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.codeBox}>
          <Text style={styles.codeText}>{session.roomCode}</Text>
        </View>
        <View style={styles.cardMeta}>
          <Text style={styles.cardDate}>{dateStr} · {timeStr}</Text>
          <View style={styles.cardStats}>
            <Text style={styles.statChip}>👥 {session.guestCount}</Text>
            <Text style={styles.statChip}>🎵 {session.trackCount}</Text>
            {duration > 0 && <Text style={styles.statChip}>⏱ {duration}m</Text>}
          </View>
        </View>
        <Text style={styles.chevron}>{isExpanded ? "▲" : "▼"}</Text>
      </View>

      {/* Expanded: top tracks */}
      {isExpanded && session.topTracks.length > 0 && (
        <View style={styles.trackList}>
          <Text style={styles.trackListLabel}>TOP TRACKS</Text>
          {session.topTracks.slice(0, 5).map((t, i) => (
            <View key={i} style={styles.trackRow}>
              <Text style={styles.trackNum}>{i + 1}</Text>
              <View style={styles.trackInfo}>
                <Text style={styles.trackTitle} numberOfLines={1}>{t.title}</Text>
                <Text style={styles.trackArtist} numberOfLines={1}>{t.artist}</Text>
              </View>
              {t.votes > 0 && (
                <Text style={styles.trackVotes}>▲ {t.votes}</Text>
              )}
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  list:           { padding: 16, gap: 12 },
  center:         { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyIcon:      { fontSize: 40 },
  emptyTitle:     { color: "#fff", fontSize: 16, fontWeight: "700" },
  emptySubtitle:  { color: "#444", fontSize: 13 },

  card:           { backgroundColor: "#111", borderRadius: 14, borderWidth: 1, borderColor: "#1e1e1e", overflow: "hidden" },
  cardHeader:     { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  codeBox:        { backgroundColor: "#6c47ff22", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "#6c47ff44" },
  codeText:       { color: "#c4b5fd", fontSize: 16, fontWeight: "900", letterSpacing: 2 },
  cardMeta:       { flex: 1, gap: 4 },
  cardDate:       { color: "#666", fontSize: 12 },
  cardStats:      { flexDirection: "row", gap: 6 },
  statChip:       { color: "#888", fontSize: 12, fontWeight: "600" },
  chevron:        { color: "#444", fontSize: 12 },

  trackList:      { borderTopWidth: 1, borderTopColor: "#1e1e1e", padding: 14, gap: 10 },
  trackListLabel: { color: "#444", fontSize: 10, fontWeight: "700", letterSpacing: 2, marginBottom: 4 },
  trackRow:       { flexDirection: "row", alignItems: "center", gap: 10 },
  trackNum:       { color: "#444", width: 16, fontSize: 12 },
  trackInfo:      { flex: 1 },
  trackTitle:     { color: "#fff", fontSize: 14, fontWeight: "600" },
  trackArtist:    { color: "#555", fontSize: 12 },
  trackVotes:     { color: "#6c47ff", fontSize: 12, fontWeight: "700" },
});
