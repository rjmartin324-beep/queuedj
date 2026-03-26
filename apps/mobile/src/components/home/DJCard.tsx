import React, { useEffect, useRef, useState } from "react";
import { Animated, View, Text, TouchableOpacity, StyleSheet } from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// DJ Card — DJ MODE hero card on the home screen
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  onPress:     () => void;
  nowPlaying?: string | null;
  queueCount?: number;
  guestCount?: number;
}

export function DJCard({ onPress, nowPlaying, queueCount = 0, guestCount = 0 }: Props) {
  const pulseAnim = useRef(new Animated.Value(0.5)).current;

  // Subtle pulse on the play button
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 0.5, duration: 1200, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const glowOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.8] });

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

      <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
        {/* Play row */}
        <View style={styles.playRow}>
          <View style={styles.playBtnWrap}>
            <Animated.View style={[styles.playGlow, { opacity: glowOpacity }]} />
            <TouchableOpacity onPress={onPress} style={styles.playBtn}>
              <Text style={styles.playIcon}>▶</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.playInfo}>
            <Text style={styles.playTitle}>
              {nowPlaying ? "Now Playing" : "Start the Party"}
            </Text>
            <Text style={styles.playSub} numberOfLines={1}>
              {nowPlaying ?? "Launch DJ queue · invite guests"}
            </Text>
            <View style={styles.waveRow}>
              {[4,10,7,14,9,6,12,8,5,11,7,9,6,13,8,10,5,12].map((h, i) => (
                <View key={i} style={[styles.wavBar, { height: h }]} />
              ))}
            </View>
          </View>

          <View style={styles.statCol}>
            {guestCount > 0 && (
              <View style={styles.statPill}>
                <Text style={styles.statValue}>{guestCount}</Text>
                <Text style={styles.statLabel}>guests</Text>
              </View>
            )}
            {queueCount > 0 && (
              <View style={[styles.statPill, { marginTop: 4 }]}>
                <Text style={styles.statValue}>{queueCount}</Text>
                <Text style={styles.statLabel}>queued</Text>
              </View>
            )}
          </View>
        </View>

        {/* CTA banner */}
        <View style={styles.ctaBanner}>
          <Text style={styles.ctaText}>
            {nowPlaying ? "Open DJ Queue →" : "Host or Join a Room →"}
          </Text>
        </View>
      </TouchableOpacity>
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

  statCol: { alignItems: "center", gap: 4 },
  statPill: {
    backgroundColor: "rgba(124,58,237,0.2)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.3)",
  },
  statValue: { color: "#a78bfa", fontWeight: "900", fontSize: 16 },
  statLabel: { color: "#7c3aed", fontSize: 9, fontWeight: "700" },

  ctaBanner: {
    marginTop: 12,
    backgroundColor: "rgba(124,58,237,0.15)",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.25)",
  },
  ctaText: { color: "#a78bfa", fontWeight: "800", fontSize: 13, letterSpacing: 0.5 },

  playBtnWrap: { position: "relative" },
  playGlow: {
    position: "absolute",
    top: -8, left: -8, right: -8, bottom: -8,
    borderRadius: 36,
    backgroundColor: "#7c3aed",
  },
});
