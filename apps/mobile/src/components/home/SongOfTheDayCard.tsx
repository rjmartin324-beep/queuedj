import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Animated, Easing, ActivityIndicator, Linking,
} from "react-native";
import { SkeletonShimmer } from "../shared/SkeletonShimmer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";

// ─────────────────────────────────────────────────────────────────────────────
// SongOfTheDayCard
//
// Fetches today's Song of the Day from /sotd API endpoint.
// Caches in AsyncStorage — won't re-fetch if already shown today.
// Plays the 30-second preview via expo-av.
// ─────────────────────────────────────────────────────────────────────────────

const SOTD_CACHE_KEY = "partyglue_sotd_cache";
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

interface SOTD {
  date:       string;  // "YYYY-MM-DD"
  isrc:       string;
  title:      string;
  artist:     string;
  artworkUrl: string | null;
  previewUrl: string | null;
  genre:      string | null;
  bpm:        number | null;
  energy:     number | null;
  curatedNote: string | null; // "Why we picked this" blurb
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function SongOfTheDayCard() {
  const [sotd,       setSotd]       = useState<SOTD | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(false);
  const [playing,    setPlaying]    = useState(false);
  const [listened,   setListened]   = useState(false);
  const [playError,  setPlayError]  = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadSotd();
    return () => { soundRef.current?.unloadAsync().catch(() => {}); };
  }, []);

  // Enrich with iTunes preview if API didn't supply one
  useEffect(() => {
    if (!sotd) return;
    if (sotd.previewUrl) { setPreviewUrl(sotd.previewUrl); return; }
    const q = encodeURIComponent(`${sotd.title} ${sotd.artist}`);
    fetch(`https://itunes.apple.com/search?term=${q}&entity=song&limit=8&media=music`)
      .then(r => r.json())
      .then(data => {
        const match = (data.results ?? []).find((r: any) =>
          r.previewUrl &&
          r.trackName?.toLowerCase().includes(sotd.title.toLowerCase().slice(0, 8)),
        );
        if (match?.previewUrl) setPreviewUrl(match.previewUrl);
      })
      .catch(() => {});
  }, [sotd]);

  async function loadSotd(forceRefresh = false) {
    setLoading(true);
    setError(false);
    try {
      // Check cache first (skip on manual refresh)
      if (!forceRefresh) {
        const raw = await AsyncStorage.getItem(SOTD_CACHE_KEY);
        if (raw) {
          const cached: SOTD = JSON.parse(raw);
          if (cached.date === today()) {
            setSotd(cached);
            animateIn();
            setLoading(false);
            return;
          }
        }
      }
      // Fetch from server
      const res = await fetch(`${API_URL}/sotd`);
      if (res.ok) {
        const data: SOTD = await res.json();
        await AsyncStorage.setItem(SOTD_CACHE_KEY, JSON.stringify(data));
        setSotd(data);
        animateIn();
      } else {
        setError(true);
      }
    } catch { setError(true); }
    finally { setLoading(false); }
  }

  function animateIn() {
    Animated.parallel([
      Animated.spring(scaleAnim,   { toValue: 1, useNativeDriver: true, tension: 60, friction: 9 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }

  async function togglePlay() {
    if (!previewUrl) return;

    if (playing) {
      await soundRef.current?.pauseAsync();
      setPlaying(false);
      return;
    }

    if (!soundRef.current) {
      try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {});
      const { sound } = await Audio.Sound.createAsync(
        { uri: previewUrl },
        { shouldPlay: true },
      );
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate(status => {
        if (!status.isLoaded) return;
        if (status.didJustFinish) {
          setPlaying(false);
          setListened(true);
          // Unlock achievement via central function (triggers toast)
          import("../home/AchievementsSection").then(m => m.unlockAchievement("song_of_the_day")).catch(() => {});
        }
      });
      } catch {
        setPlayError(true);
        setPlaying(false);
        setTimeout(() => setPlayError(false), 3000);
        return;
      }
    } else {
      await soundRef.current.playAsync().catch(() => { setPlayError(true); setTimeout(() => setPlayError(false), 3000); });
    }
    setPlaying(true);
    setListened(true);
  }

  if (loading) {
    return (
      <View style={styles.skeletonCard}>
        <SkeletonShimmer width={64} height={64} borderRadius={14} />
        <View style={styles.skeletonBody}>
          <SkeletonShimmer width="60%" height={14} borderRadius={7} />
          <SkeletonShimmer width="80%" height={11} borderRadius={6} style={{ marginTop: 8 }} />
          <SkeletonShimmer width="45%" height={9} borderRadius={5} style={{ marginTop: 6 }} />
        </View>
      </View>
    );
  }

  if (error) return null;

  if (!sotd) return null;

  const energyPct = sotd.energy !== null ? Math.round(sotd.energy * 100) : null;

  return (
    <Animated.View style={[styles.wrap, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
      <LinearGradient
        colors={["rgba(124,58,237,0.25)", "rgba(6,2,14,0.0)"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.gradient}
      />

      {/* Date label */}
      <View style={styles.topRow}>
        <View style={styles.dateBadge}>
          <Text style={styles.dateBadgeText}>🎵 SONG OF THE DAY</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={styles.dateText}>{new Date().toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}</Text>
          <TouchableOpacity onPress={() => loadSotd(true)} disabled={loading} style={styles.refreshBtn} activeOpacity={0.6}>
            <Text style={[styles.refreshIcon, loading && { opacity: 0.4 }]}>↺</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Track info + inline play button */}
      <View style={styles.trackRow}>
        {sotd.artworkUrl ? (
          <Image source={{ uri: sotd.artworkUrl }} style={styles.artwork} />
        ) : (
          <View style={[styles.artwork, styles.artworkPlaceholder]}>
            <Text style={{ fontSize: 32 }}>🎵</Text>
          </View>
        )}
        <View style={styles.trackInfo}>
          <Text style={styles.trackTitle} numberOfLines={2}>{sotd.title}</Text>
          <Text style={styles.trackArtist} numberOfLines={1}>{sotd.artist}</Text>
          <View style={styles.metaRow}>
            {sotd.genre && <View style={styles.metaChip}><Text style={styles.metaChipText}>{sotd.genre}</Text></View>}
            {sotd.bpm    && <View style={styles.metaChip}><Text style={styles.metaChipText}>{Math.round(sotd.bpm)} BPM</Text></View>}
            {energyPct !== null && <View style={styles.metaChip}><Text style={styles.metaChipText}>Energy {energyPct}%</Text></View>}
          </View>
        </View>
        {/* Circular play button — right side; search button if no preview */}
        {previewUrl ? (
          <TouchableOpacity
            onPress={togglePlay}
            activeOpacity={0.8}
            style={styles.playCircle}
          >
            <LinearGradient
              colors={
                playError ? ["#7f1d1d", "#991b1b"] :
                playing   ? ["#2a2a2a", "#1a1a1a"] :
                            ["#7c3aed", "#6d28d9"]
              }
              style={styles.playCircleGrad}
            >
              <Text style={styles.playCircleIcon}>
                {playError ? "⚠" : playing ? "⏸" : "▶"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => {
              const q = encodeURIComponent(`${sotd!.title} ${sotd!.artist}`);
              Linking.openURL(`https://open.spotify.com/search/${q}`).catch(() => {});
            }}
            activeOpacity={0.8}
            style={styles.searchCircle}
          >
            <LinearGradient colors={["#1db954", "#17a347"]} style={styles.playCircleGrad}>
              <Text style={styles.searchCircleIcon}>🔍</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>

      {/* Curated note */}
      {sotd.curatedNote && (
        <Text style={styles.note}>"{sotd.curatedNote}"</Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  loadingCard: {
    marginHorizontal: 16, marginVertical: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 20, padding: 20,
    alignItems: "center", gap: 8, flexDirection: "row",
  },
  skeletonCard: {
    marginHorizontal: 16, marginVertical: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 20, padding: 16,
    flexDirection: "row", alignItems: "center", gap: 14,
    borderWidth: 1, borderColor: "rgba(124,58,237,0.15)",
  },
  skeletonBody: { flex: 1, gap: 0 },
  loadingText: { color: "#6b7280", fontSize: 13, flex: 1 },
  retryBtn:    { backgroundColor: "rgba(124,58,237,0.2)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(124,58,237,0.4)" },
  retryText:   { color: "#a78bfa", fontSize: 13, fontWeight: "700" },

  wrap: {
    marginHorizontal: 16, marginVertical: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 24, overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(124,58,237,0.3)",
    padding: 18, gap: 14,
  },
  gradient: { ...StyleSheet.absoluteFillObject },

  topRow:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dateBadge:     { backgroundColor: "rgba(167,139,250,0.15)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: "rgba(167,139,250,0.3)" },
  dateBadgeText: { color: "#a78bfa", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  dateText:      { color: "#6b7280", fontSize: 12 },

  trackRow:           { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  artwork:            { width: 80, height: 80, borderRadius: 12 },
  artworkPlaceholder: { backgroundColor: "#1a1a1a", alignItems: "center", justifyContent: "center" },
  trackInfo:          { flex: 1, gap: 4 },
  trackTitle:         { color: "#fff", fontSize: 18, fontWeight: "800", lineHeight: 22 },
  trackArtist:        { color: "#9ca3af", fontSize: 13 },
  metaRow:            { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 4 },
  metaChip:           { backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  metaChipText:       { color: "#6b7280", fontSize: 11, fontWeight: "600" },

  note: { color: "#6b7280", fontSize: 13, fontStyle: "italic", lineHeight: 18 },

  refreshBtn:  { padding: 4 },
  refreshIcon: { color: "#6b7280", fontSize: 16, fontWeight: "700" },

  playCircle:     { width: 52, height: 52, borderRadius: 26, overflow: "hidden", alignSelf: "center", flexShrink: 0 },
  playCircleGrad: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  playCircleIcon: { fontSize: 20, color: "#fff", marginLeft: 3 },

  searchCircle:     { width: 52, height: 52, borderRadius: 26, overflow: "hidden", alignSelf: "center", flexShrink: 0 },
  searchCircleIcon: { fontSize: 18 },
});
