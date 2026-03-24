import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// DJ Card — DJ MODE section with song queue
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  onPress: () => void;
}

const SONGS = [
  { emoji: "🤖", title: "Channel 5 – SynthWave Mix",  genre: "Synthwave",   bpm: 124, players: "2-9"  },
  { emoji: "🎵", title: "Chillin' – 80s Synthwave",    genre: "Neon Nights", bpm: 114, players: "2-3"  },
  { emoji: "🌐", title: "Electric Feel – Nu Disco",     genre: "Funky Town",  bpm: 124, players: "2-6"  },
];

export function DJCard({ onPress }: Props) {
  const [autoDJ] = useState(true);

  return (
    <View style={styles.section}>
      {/* Section header */}
      <View style={styles.sectionHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerIcon}>🎧</Text>
          <Text style={styles.sectionTitle}>DJ MODE</Text>
        </View>
        <Text style={styles.headerArrow}>›</Text>
      </View>

      <View style={styles.card}>
        {/* Play row */}
        <View style={styles.playRow}>
          <TouchableOpacity onPress={onPress} style={styles.playBtn}>
            <Text style={styles.playIcon}>▶</Text>
          </TouchableOpacity>

          <View style={styles.playInfo}>
            <Text style={styles.playTitle}>Start the Music</Text>
            <Text style={styles.playSub}>Auto DJ with smooth transitions</Text>
            <View style={styles.waveRow}>
              {[4,10,7,14,9,6,12,8,5,11,7,9,6,13,8,10,5,12].map((h, i) => (
                <View key={i} style={[styles.wavBar, { height: h }]} />
              ))}
            </View>
          </View>

          <View style={styles.autoDJWrap}>
            <Text style={styles.autoDJLabel}>Auto DJ</Text>
            <View style={[styles.autoDJPill, autoDJ && styles.autoDJPillOn]}>
              <Text style={styles.autoDJText}>GN</Text>
            </View>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressRow}>
          <Text style={styles.progressTime}>8:23</Text>
          <View style={styles.progressTrack}>
            <View style={styles.progressFill} />
            <View style={styles.progressThumb} />
          </View>
          <Text style={styles.progressTimeRight}>30:00</Text>
        </View>

        <View style={styles.divider} />

        {/* Song list */}
        {SONGS.map((s, i) => (
          <View key={i} style={[styles.songRow, i === SONGS.length - 1 && styles.songRowLast]}>
            <View style={styles.songThumb}>
              <Text style={styles.songThumbEmoji}>{s.emoji}</Text>
            </View>
            <View style={styles.songInfo}>
              <Text style={styles.songTitle} numberOfLines={1}>{s.title}</Text>
              <Text style={styles.songMeta}>{s.genre} · {s.bpm} BPM</Text>
            </View>
            <View style={styles.songRight}>
              <Text style={styles.songPlay}>▶ {s.players} 👤</Text>
              <Text style={styles.songMenu}>⋮</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 20, marginTop: 24, marginBottom: 4 },

  sectionHeader: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 12,
  },
  headerLeft:  { flexDirection: "row", alignItems: "center", gap: 8 },
  headerIcon:  { fontSize: 16 },
  sectionTitle: { color: "#fff", fontSize: 15, fontWeight: "800", letterSpacing: 0.8 },
  headerArrow:  { color: "#a855f7", fontSize: 22 },

  card: {
    backgroundColor: "rgba(10,5,25,0.55)",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.2)",
  },

  // Play row
  playRow:  { flexDirection: "row", alignItems: "flex-start", gap: 14, marginBottom: 12 },
  playBtn:  {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: "#7c3aed",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#a855f7", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55, shadowRadius: 10, elevation: 8,
  },
  playIcon: { color: "#fff", fontSize: 18, marginLeft: 2 },
  playInfo: { flex: 1 },
  playTitle: { color: "#fff", fontSize: 15, fontWeight: "700", marginBottom: 2 },
  playSub:   { color: "#6b7280", fontSize: 11, marginBottom: 8 },
  waveRow:   { flexDirection: "row", alignItems: "flex-end", gap: 2, height: 16 },
  wavBar:    { width: 3, borderRadius: 2, backgroundColor: "#a855f7", opacity: 0.55 },

  autoDJWrap:    { alignItems: "center", gap: 4, paddingTop: 2 },
  autoDJLabel:   { color: "#6b7280", fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
  autoDJPill:    { backgroundColor: "#374151", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  autoDJPillOn:  { backgroundColor: "#7c3aed" },
  autoDJText:    { color: "#fff", fontSize: 10, fontWeight: "800" },

  // Progress
  progressRow:      { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  progressTime:     { color: "#6b7280", fontSize: 11, fontWeight: "600", width: 34 },
  progressTimeRight:{ color: "#6b7280", fontSize: 11, fontWeight: "600", width: 34, textAlign: "right" },
  progressTrack:    {
    flex: 1, height: 4, borderRadius: 2, backgroundColor: "#1f2937",
    flexDirection: "row", alignItems: "center",
  },
  progressFill:  { width: "28%", height: 4, borderRadius: 2, backgroundColor: "#ec4899" },
  progressThumb: {
    width: 12, height: 12, borderRadius: 6, backgroundColor: "#f9a8d4",
    marginLeft: -6,
    shadowColor: "#ec4899", shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 4,
  },

  divider: { height: 1, backgroundColor: "#1f2937", marginBottom: 8 },

  // Song rows
  songRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#1f2937",
  },
  songRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  songThumb: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: "#1f2937",
    alignItems: "center", justifyContent: "center",
  },
  songThumbEmoji: { fontSize: 22 },
  songInfo:  { flex: 1 },
  songTitle: { color: "#fff", fontSize: 13, fontWeight: "600", marginBottom: 2 },
  songMeta:  { color: "#6b7280", fontSize: 11 },
  songRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  songPlay:  { color: "#6b7280", fontSize: 11 },
  songMenu:  { color: "#6b7280", fontSize: 20 },
});
