import React, { useEffect, useRef, useState } from "react";
import {
  Modal, View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Animated, Image, ActivityIndicator,
} from "react-native";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrackDetail {
  isrc:            string;
  title:           string;
  artist:          string;
  album:           string | null;
  album_art_url:   string | null;
  bpm:             number | null;
  camelot_key:     number | null;
  camelot_type:    "A" | "B" | null;
  energy:          number | null;
  danceability:    number | null;
  valence:         number | null;
  genre:           string | null;
  mood:            string | null;
  artist_bio:      string | null;
  artist_image_url: string | null;
  release_date:    string | null;
  similar_tracks:  Array<{ artist: string; title: string; match: number }> | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CAMELOT_NAMES: Record<string, string> = {
  "1A": "Am", "1B": "C",  "2A": "Em",  "2B": "G",
  "3A": "Bm", "3B": "D",  "4A": "F#m", "4B": "A",
  "5A": "Dbm","5B": "E",  "6A": "Abm", "6B": "B",
  "7A": "Ebm","7B": "F#", "8A": "Bbm", "8B": "Db",
  "9A": "Fm", "9B": "Ab", "10A": "Cm", "10B": "Eb",
  "11A":"Gm", "11B":"Bb", "12A":"Dm",  "12B":"F",
};

function camelotLabel(key: number | null, type: "A" | "B" | null): string {
  if (!key || !type) return "—";
  const code = `${key}${type}`;
  return `${code} · ${CAMELOT_NAMES[code] ?? ""}`;
}

function energyBar(value: number | null, color: string) {
  if (value === null) return null;
  return (
    <View style={bar.track}>
      <View style={[bar.fill, { width: `${Math.round(value * 100)}%`, backgroundColor: color }]} />
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  isrc:    string | null;
  visible: boolean;
  onClose: () => void;
}

export function TrackDetailModal({ isrc, visible, onClose }: Props) {
  const [track, setTrack]     = useState<TrackDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const slideY = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (!visible || !isrc) return;
    setTrack(null);
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`${API_URL}/tracks/${encodeURIComponent(isrc)}`);
        if (res.ok) setTrack(await res.json());
      } catch { /* offline */ } finally {
        setLoading(false);
      }
    })();
  }, [isrc, visible]);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }).start();
    } else {
      slideY.setValue(400);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideY }] }]}>
        {/* Handle */}
        <View style={styles.handle} />

        {loading && <ActivityIndicator color="#a78bfa" style={{ marginVertical: 40 }} />}

        {track && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Header */}
            <View style={styles.header}>
              {track.album_art_url ? (
                <Image source={{ uri: track.album_art_url }} style={styles.art} />
              ) : (
                <View style={[styles.art, styles.artPlaceholder]}>
                  <Text style={{ fontSize: 32 }}>🎵</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={2}>{track.title}</Text>
                <Text style={styles.artist} numberOfLines={1}>{track.artist}</Text>
                {track.album && <Text style={styles.album} numberOfLines={1}>{track.album}</Text>}
                {track.genre && <Text style={styles.genre}>{track.genre}</Text>}
              </View>
            </View>

            {/* Audio stats */}
            <View style={styles.statsGrid}>
              <StatBox label="BPM"   value={track.bpm ? Math.round(track.bpm).toString() : "—"} />
              <StatBox label="KEY"   value={camelotLabel(track.camelot_key, track.camelot_type)} />
              <StatBox label="MOOD"  value={track.mood ?? "—"} />
              <StatBox label="YEAR"  value={track.release_date ? track.release_date.slice(0, 4) : "—"} />
            </View>

            {/* Energy bars */}
            <View style={styles.section}>
              <BarRow label="Energy"      value={track.energy}      color="#f59e0b" />
              <BarRow label="Danceability" value={track.danceability} color="#10b981" />
              <BarRow label="Mood (valence)" value={track.valence}   color="#6366f1" />
            </View>

            {/* Artist bio */}
            {track.artist_bio ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>ABOUT {track.artist.toUpperCase()}</Text>
                {track.artist_image_url && (
                  <Image source={{ uri: track.artist_image_url }} style={styles.artistImg} />
                )}
                <Text style={styles.bio}>{track.artist_bio}</Text>
              </View>
            ) : null}

            {/* Similar tracks */}
            {track.similar_tracks && track.similar_tracks.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>SOUNDS LIKE</Text>
                {track.similar_tracks.slice(0, 5).map((s, i) => (
                  <View key={i} style={styles.similarRow}>
                    <Text style={styles.similarDot}>•</Text>
                    <View>
                      <Text style={styles.similarTitle}>{s.title}</Text>
                      <Text style={styles.similarArtist}>{s.artist}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>
        )}
      </Animated.View>
    </Modal>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function BarRow({ label, value, color }: { label: string; value: number | null; color: string }) {
  if (value === null) return null;
  const pct = Math.round(value * 100);
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={bar.track}>
        <View style={[bar.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.barPct}>{pct}%</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#111827",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    maxHeight: "85%",
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },

  header: { flexDirection: "row", gap: 14, marginBottom: 20 },
  art:    { width: 80, height: 80, borderRadius: 10 },
  artPlaceholder: { backgroundColor: "rgba(124,58,237,0.2)", alignItems: "center", justifyContent: "center" },
  title:  { color: "#fff", fontWeight: "800", fontSize: 16, lineHeight: 22 },
  artist: { color: "#9ca3af", fontSize: 13, marginTop: 3 },
  album:  { color: "#6b7280", fontSize: 12, marginTop: 2 },
  genre:  { color: "#7c3aed", fontSize: 11, fontWeight: "700", marginTop: 4, textTransform: "uppercase", letterSpacing: 1 },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    minWidth: "44%",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  statLabel: { color: "#6b7280", fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
  statValue: { color: "#fff", fontSize: 16, fontWeight: "900", marginTop: 4 },

  section: { marginBottom: 20 },
  sectionTitle: { color: "#6b7280", fontSize: 10, fontWeight: "800", letterSpacing: 2, marginBottom: 12 },

  barRow:  { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  barLabel: { color: "#9ca3af", fontSize: 12, width: 90 },
  barPct:   { color: "#6b7280", fontSize: 12, width: 34, textAlign: "right" },

  artistImg: { width: "100%", height: 120, borderRadius: 12, marginBottom: 10 },
  bio:       { color: "#9ca3af", fontSize: 13, lineHeight: 20 },

  similarRow:   { flexDirection: "row", gap: 10, alignItems: "flex-start", marginBottom: 8 },
  similarDot:   { color: "#7c3aed", fontSize: 18, lineHeight: 20 },
  similarTitle: { color: "#e5e7eb", fontWeight: "700", fontSize: 13 },
  similarArtist: { color: "#6b7280", fontSize: 12 },
});

const bar = StyleSheet.create({
  track: { flex: 1, height: 6, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" },
  fill:  { height: "100%", borderRadius: 3 },
});
