import React, { useState, useEffect, useRef } from "react";
import { analyzeTrack } from "../../../lib/audioBPM";
import type { AudioAnalysis } from "../../../lib/audioBPM";
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Image, TextInput, PanResponder } from "react-native";
import { useRoom } from "../../../contexts/RoomContext";
import { socketManager } from "../../../lib/socket";
import { audioEngine } from "../../../lib/engines/audioEngineSingleton";
import { Crossfader } from "../Crossfader";
import { LocalTrackImporter } from "../LocalTrackImporter";
import { SpotifyConnectButton } from "../../shared/SpotifyConnectButton";
import type { CrowdState, VibePreset } from "@queuedj/shared-types";

// ─────────────────────────────────────────────────────────────────────────────
// DJControls — host-only panel
//
// Deck A / Deck B:  load track from queue → play / pause
// Crossfader:       already wired to audioEngine directly
// Crowd State:      manual override, synced to all guests via socket
// Vibe Preset:      maps to crowd state + BPM target
// Bathroom Break:   pauses vibe guardrail, emits crowd state RECOVERY
// ─────────────────────────────────────────────────────────────────────────────

const VIBES: { preset: VibePreset; label: string; emoji: string }[] = [
  { preset: "open",      label: "Open",      emoji: "🌊" },
  { preset: "hype",      label: "Hype",      emoji: "🔥" },
  { preset: "chill",     label: "Chill",     emoji: "🧊" },
  { preset: "throwback", label: "Throwback", emoji: "📻" },
];

const CROWD_STATES: {
  state: CrowdState; label: string; emoji: string; bpmRange: string; color: string;
}[] = [
  { state: "WARMUP",   label: "Warmup",   emoji: "🌅", bpmRange: "90–115",  color: "#3b82f6" },
  { state: "RISING",   label: "Rising",   emoji: "📈", bpmRange: "110–125", color: "#f59e0b" },
  { state: "PEAK",     label: "Peak",     emoji: "🔥", bpmRange: "122–140", color: "#ef4444" },
  { state: "FATIGUE",  label: "Fatigue",  emoji: "😮‍💨", bpmRange: "100–120", color: "#f97316" },
  { state: "RECOVERY", label: "Recovery", emoji: "🌊", bpmRange: "85–105",  color: "#8b5cf6" },
  { state: "COOLDOWN", label: "Cooldown", emoji: "🌙", bpmRange: "70–95",   color: "#6b7280" },
];

// ─── AI DJ ────────────────────────────────────────────────────────────────────

const VIBE_QUERIES: Record<CrowdState, { query: string; reason: string }> = {
  WARMUP:   { query: "chill house lounge",       reason: "Easing the crowd in — smooth grooves to get people moving" },
  RISING:   { query: "upbeat pop dance hits",    reason: "Energy is building — pushing BPM and momentum forward" },
  PEAK:     { query: "edm festival drops 2024",  reason: "Room is HYPED — dropping the peak-hour banger" },
  FATIGUE:  { query: "smooth r&b groove",        reason: "Reading the crowd — giving them a breather with soul" },
  RECOVERY: { query: "indie pop feel good",      reason: "Bringing the vibe back — feel-good energy reset" },
  COOLDOWN: { query: "acoustic chill downtempo", reason: "Winding down the night — slow, smooth closer" },
};

interface AITrack {
  title:      string;
  artist:     string;
  previewUrl: string;
  artworkUrl: string;
  duration:   number; // ms
}

function AIDJSection({ crowdState, deckABpm, deckBBpm, onDeckABpm, onDeckBBpm }: {
  crowdState:  CrowdState;
  deckABpm:    number;
  deckBBpm:    number;
  onDeckABpm:  (v: number) => void;
  onDeckBBpm:  (v: number) => void;
}) {
  const { state: roomState } = useRoom();
  const [active,       setActive]       = useState(false);
  const [tracks,       setTracks]       = useState<AITrack[]>([]);
  const [trackIdx,     setTrackIdx]     = useState(0);
  const [activeDeck,   setActiveDeck]   = useState<"A" | "B">("A");
  const [fetching,     setFetching]     = useState(false);
  const [posMs,        setPosMs]        = useState(0);
  const [durMs,        setDurMs]        = useState(30000);
  const [fadeProgress, setFadeProgress] = useState(0); // 0–1 crossfade in progress
  const [error,        setError]        = useState<string | null>(null);
  const [source,       setSource]       = useState<"queue" | "itunes">("itunes");
  const [random,       setRandom]       = useState(false);

  const pulseAnim   = useRef(new Animated.Value(1)).current;
  const idxRef      = useRef(0);
  const activeRef   = useRef(false);
  const deckRef     = useRef<"A" | "B">("A");
  const fadingRef   = useRef(false); // guard: prevent double-trigger of crossfade
  const posTimer    = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tracksRef   = useRef<AITrack[]>([]);
  const deckABpmRef      = useRef(deckABpm);
  const deckBBpmRef      = useRef(deckBBpm);
  const transitionPtRef  = useRef(22000);   // ms — updated by analysis
  const analysisRef      = useRef<AudioAnalysis | null>(null);
  const [detectedBpm,  setDetectedBpm]  = useState<number | null>(null);
  const [analyzing,    setAnalyzing]    = useState(false);

  // Keep BPM refs in sync with props so crossfade closure always reads latest
  useEffect(() => { deckABpmRef.current = deckABpm; }, [deckABpm]);
  useEffect(() => { deckBBpmRef.current = deckBBpm; }, [deckBBpm]);

  // Pulse animation while playing
  useEffect(() => {
    if (active) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.06, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(pulseAnim, { toValue: 1.00, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [active]);

  // Fetch tracks on activate or crowd state change
  useEffect(() => {
    if (active) fetchTracks(crowdState);
  }, [active, crowdState]);

  function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  async function fetchTracks(cs: CrowdState) {
    setFetching(true);
    setError(null);
    try {
      // ── Try the queue first ───────────────────────────────────────────────
      const queueItems = roomState.queue.filter(q => {
        const uri = (q.track as any).previewUrl ?? (q.track as any).uri;
        return !!uri;
      });

      if (queueItems.length > 0) {
        let list: AITrack[] = queueItems.map(q => ({
          title:      q.track.title,
          artist:     q.track.artist,
          previewUrl: (q.track as any).previewUrl ?? (q.track as any).uri,
          artworkUrl: (q.track as any).artworkUrl ?? (q.track as any).artworkUrl100 ?? "",
          duration:   q.track.durationMs ?? 30000,
        }));
        if (random) list = shuffle(list);
        setSource("queue");
        setTracks(list);
        tracksRef.current = list;
        idxRef.current = 0;
        setTrackIdx(0);
        if (list.length > 1) audioEngine.loadTrack("B", list[1].previewUrl).catch(() => {});
        await startDeck("A", list[0]);
        return;
      }

      // ── Fall back to iTunes previews for the current crowd state ──────────
      setSource("itunes");
      const { query } = VIBE_QUERIES[cs];
      const res  = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=10&media=music`);
      const data = await res.json();
      let list: AITrack[] = (data.results ?? [])
        .filter((r: any) => r.previewUrl)
        .slice(0, 8)
        .map((r: any) => ({
          title:      r.trackName,
          artist:     r.artistName,
          previewUrl: r.previewUrl,
          artworkUrl: r.artworkUrl100,
          duration:   r.trackTimeMillis ?? 30000,
        }));
      if (random) list = shuffle(list);
      if (list.length === 0) { setError("Queue is empty and no iTunes previews found"); return; }
      setTracks(list);
      tracksRef.current = list;
      idxRef.current = 0;
      setTrackIdx(0);
      if (list.length > 1) audioEngine.loadTrack("B", list[1].previewUrl).catch(() => {});
      await startDeck("A", list[0]);
    } catch {
      setError("Couldn't load tracks — check connection");
    } finally {
      setFetching(false);
    }
  }

  async function analyzeInBackground(track: AITrack, deck: "A" | "B") {
    setAnalyzing(true);
    try {
      const analysis = await analyzeTrack(track.previewUrl, track.duration || 30000);
      analysisRef.current     = analysis;
      transitionPtRef.current = analysis.transitionMs;
      setDetectedBpm(analysis.bpm);
      // Push detected BPM into the shared BPM Sync panel
      if (deck === "A") { onDeckABpm(analysis.bpm); deckABpmRef.current = analysis.bpm; }
      else              { onDeckBBpm(analysis.bpm); deckBBpmRef.current = analysis.bpm; }
    } catch {
      transitionPtRef.current = 22000;
    } finally {
      setAnalyzing(false);
    }
  }

  async function startDeck(deck: "A" | "B", track: AITrack) {
    if (!activeRef.current) return;
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {});
      await audioEngine.loadTrack(deck, track.previewUrl);
      audioEngine.setCrossfader(deck === "A" ? 0 : 1);
      await audioEngine.play(deck);
      deckRef.current = deck;
      setActiveDeck(deck);
      setDurMs(track.duration || 30000);
      setPosMs(0);
      setFadeProgress(0);

      // Reset analysis state for new track, analyze in background
      transitionPtRef.current = Math.round((track.duration || 30000) * 0.73);
      analysisRef.current     = null;
      setDetectedBpm(null);
      analyzeInBackground(track, deck).catch(() => {});

      // Poll position — use dynamically updated transitionPtRef
      if (posTimer.current) clearInterval(posTimer.current);
      posTimer.current = setInterval(async () => {
        const pos = await audioEngine.getPosition(deck);
        setPosMs(pos);
        if (pos >= transitionPtRef.current && !fadingRef.current && activeRef.current) {
          clearInterval(posTimer.current!);
          // ── Beat-grid alignment: wait until the next bar boundary ──────
          const analysis = analysisRef.current;
          if (analysis && analysis.confidence > 0.5) {
            const barMs    = analysis.barIntervalMs;
            const posInBar = pos % barMs;
            const waitMs   = Math.max(0, Math.min(barMs, barMs - posInBar));
            setTimeout(() => {
              if (activeRef.current) triggerAutoCrossfade(deck);
            }, waitMs);
          } else {
            triggerAutoCrossfade(deck);
          }
        }
      }, 200); // tighter poll for beat alignment accuracy
    } catch { /* audio not available */ }
  }

  async function triggerAutoCrossfade(fromDeck: "A" | "B") {
    if (!activeRef.current || fadingRef.current) return;
    fadingRef.current = true;
    const toDeck: "A" | "B" = fromDeck === "A" ? "B" : "A";
    const nextIdx = idxRef.current + 1;
    const list    = tracksRef.current;
    if (nextIdx >= list.length) { stop(); return; }

    setFadeProgress(0.01); // mark fade started

    // ── BPM rate-match: sync incoming deck tempo to outgoing deck before audible ──
    const outBpm = fromDeck === "A" ? deckABpmRef.current : deckBBpmRef.current;
    const inBpm  = fromDeck === "A" ? deckBBpmRef.current : deckABpmRef.current;
    if (outBpm > 0 && inBpm > 0) {
      const syncRate = Math.max(0.5, Math.min(2.0, outBpm / inBpm));
      await audioEngine.setRate(toDeck, syncRate).catch(() => {});
    }

    // Play the already-preloaded deck (rate-matched, silent until crossfader moves)
    try { await audioEngine.play(toDeck); } catch { return; }
    setActiveDeck(toDeck);
    deckRef.current = toDeck;

    // ── Animate crossfader with eased S-curve over 4 seconds (16 × 250ms) ──
    // Uses smoothstep: t*t*(3-2t) — slow start, fast middle, slow end (like CDJ transition)
    const steps   = 20;
    const fromVal = fromDeck === "A" ? 0 : 1;
    const toVal   = fromDeck === "A" ? 1 : 0;
    for (let i = 1; i <= steps; i++) {
      if (!activeRef.current) return;
      const t = i / steps;
      // Smoothstep easing
      const eased = t * t * (3 - 2 * t);
      const xfade = fromVal + (toVal - fromVal) * eased;
      audioEngine.setCrossfader(xfade);
      setFadeProgress(t);

      // ── Tempo push: outgoing track very slightly slows in final third ──
      // Gives the feel of the track "fading out" in energy
      if (i > Math.floor(steps * 0.66)) {
        const pullback = 1 - (((i - Math.floor(steps * 0.66)) / (steps * 0.34)) * 0.04);
        audioEngine.setRate(fromDeck, Math.max(0.5, pullback)).catch(() => {});
      }

      await new Promise(r => setTimeout(r, 200));
    }

    // Fully settle crossfader at destination
    audioEngine.setCrossfader(toVal);

    // Reset outgoing deck rate before pausing (clean state for next load)
    audioEngine.setRate(fromDeck, 1).catch(() => {});
    // Reset incoming deck rate to ×1 now that it's the new master
    audioEngine.setRate(toDeck, 1).catch(() => {});

    // Stop the old deck
    audioEngine.pause(fromDeck).catch(() => {});

    // Advance track index
    idxRef.current = nextIdx;
    setTrackIdx(nextIdx);
    setFadeProgress(0);
    setPosMs(0);
    fadingRef.current = false;

    // Preload the one after next to the deck we just freed
    const afterNext = nextIdx + 1;
    if (afterNext < list.length) {
      audioEngine.loadTrack(fromDeck, list[afterNext].previewUrl).catch(() => {});
    }

    // Restart position timer on new deck — analyze next track in background too
    const nextTrack = list[nextIdx];
    transitionPtRef.current = Math.round((nextTrack.duration || 30000) * 0.73);
    analysisRef.current     = null;
    setDetectedBpm(null);
    analyzeInBackground(nextTrack, toDeck).catch(() => {});

    if (posTimer.current) clearInterval(posTimer.current);
    posTimer.current = setInterval(async () => {
      const pos = await audioEngine.getPosition(toDeck);
      setPosMs(pos);
      if (pos >= transitionPtRef.current && !fadingRef.current && activeRef.current) {
        clearInterval(posTimer.current!);
        const analysis = analysisRef.current;
        if (analysis && analysis.confidence > 0.5) {
          const barMs    = analysis.barIntervalMs;
          const posInBar = pos % barMs;
          const waitMs   = Math.max(0, Math.min(barMs, barMs - posInBar));
          setTimeout(() => {
            if (activeRef.current) triggerAutoCrossfade(toDeck);
          }, waitMs);
        } else {
          triggerAutoCrossfade(toDeck);
        }
      }
    }, 200);
  }

  function toggle() {
    if (active) { stop(); } else { activate(); }
  }

  function activate() {
    activeRef.current = true;
    setActive(true);
    setTracks([]);
    setTrackIdx(0);
    idxRef.current = 0;
  }

  function stop() {
    activeRef.current = false;
    setActive(false);
    setFetching(false);
    setFadeProgress(0);
    if (posTimer.current) clearInterval(posTimer.current);
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    audioEngine.pause("A").catch(() => {});
    audioEngine.pause("B").catch(() => {});
    audioEngine.setCrossfader(0.5);
  }

  function skipToNext() {
    const list    = tracksRef.current;
    const nextIdx = idxRef.current + 1;
    if (nextIdx >= list.length) { stop(); return; }
    if (posTimer.current) clearInterval(posTimer.current);
    fadingRef.current = false;
    idxRef.current = nextIdx;
    setTrackIdx(nextIdx);
    const toDeck: "A" | "B" = deckRef.current === "A" ? "B" : "A";
    audioEngine.pause(deckRef.current).catch(() => {});
    startDeck(toDeck, list[nextIdx]);
  }

  useEffect(() => () => stop(), []);

  const current = tracks[trackIdx] ?? null;
  const next    = tracks[trackIdx + 1] ?? null;
  const vibe    = VIBE_QUERIES[crowdState];

  return (
    <View style={aiStyles.wrap}>
      {/* Header row */}
      <View style={aiStyles.header}>
        <View style={aiStyles.titleRow}>
          <Text style={aiStyles.aiLabel}>🤖 AI DJ</Text>
          {active && <View style={aiStyles.liveBadge}><Text style={aiStyles.liveBadgeText}>LIVE</Text></View>}
        </View>
        <TouchableOpacity
          style={[aiStyles.toggle, active && aiStyles.toggleOn]}
          onPress={toggle}
          disabled={fetching}
        >
          <Text style={[aiStyles.toggleText, active && aiStyles.toggleTextOn]}>
            {fetching ? "Loading..." : active ? "Stop" : "Start"}
          </Text>
        </TouchableOpacity>
      </View>

      {error && <Text style={aiStyles.error}>{error}</Text>}

      {active && current && (
        <>
          {/* Now playing card */}
          <Animated.View style={[aiStyles.nowPlaying, { transform: [{ scale: pulseAnim }] }]}>
            {current.artworkUrl ? (
              <Image source={{ uri: current.artworkUrl }} style={aiStyles.artwork} />
            ) : (
              <View style={[aiStyles.artwork, aiStyles.artworkPlaceholder]}><Text style={{ fontSize: 22 }}>🎵</Text></View>
            )}
            <View style={aiStyles.trackInfo}>
              <Text style={aiStyles.nowLabel}>
                NOW PLAYING  ·  DECK {activeDeck}  ·  {source === "queue" ? "FROM QUEUE" : "PREVIEW"}
                {analyzing ? "  ·  analyzing..." : detectedBpm ? `  ·  ${detectedBpm} BPM` : ""}
              </Text>
              <Text style={aiStyles.title} numberOfLines={1}>{current.title}</Text>
              <Text style={aiStyles.artist} numberOfLines={1}>{current.artist}</Text>

              {/* Progress bar */}
              <View style={aiStyles.progressBar}>
                <View style={[aiStyles.progressFill, { width: `${Math.min((posMs / (durMs || 30000)) * 100, 100)}%` as any }]} />
                {fadeProgress > 0 && (
                  <View style={[aiStyles.fadeFill, { width: `${fadeProgress * 100}%` as any }]} />
                )}
              </View>
              <Text style={aiStyles.timeText}>
                {fadeProgress > 0
                  ? `⟷ BPM-synced crossfade...`
                  : `${Math.floor(posMs / 1000)}s / ${Math.floor((durMs || 30000) / 1000)}s`}
              </Text>
            </View>
          </Animated.View>

          {/* AI reasoning */}
          <View style={aiStyles.reasonWrap}>
            <Text style={aiStyles.reasonLabel}>WHY THIS TRACK</Text>
            <Text style={aiStyles.reason}>{vibe.reason}</Text>
          </View>

          {/* Controls row */}
          <View style={aiStyles.controls}>
            <TouchableOpacity
              style={[aiStyles.randomBtn, random && aiStyles.randomBtnOn]}
              onPress={() => setRandom(r => !r)}
            >
              <Text style={[aiStyles.randomBtnText, random && aiStyles.randomBtnTextOn]}>RND</Text>
            </TouchableOpacity>
            <TouchableOpacity style={aiStyles.skipBtn} onPress={skipToNext} disabled={!next}>
              <Text style={aiStyles.skipBtnText}>⏭  Skip</Text>
            </TouchableOpacity>
            {next && (
              <View style={aiStyles.upNext}>
                <Text style={aiStyles.upNextLabel}>UP NEXT</Text>
                <Text style={aiStyles.upNextTitle} numberOfLines={1}>{next.title}</Text>
                <Text style={aiStyles.upNextArtist} numberOfLines={1}>{next.artist}</Text>
              </View>
            )}
          </View>

          {/* Queue preview dots */}
          {tracks.length > 1 && (
            <View style={aiStyles.dots}>
              {tracks.map((_, i) => (
                <View key={i} style={[
                  aiStyles.dot,
                  i === trackIdx && aiStyles.dotActive,
                  i < trackIdx  && aiStyles.dotPlayed,
                ]} />
              ))}
            </View>
          )}
        </>
      )}

      {!active && (
        <View style={aiStyles.inactiveRow}>
          <TouchableOpacity
            style={[aiStyles.randomBtn, random && aiStyles.randomBtnOn]}
            onPress={() => setRandom(r => !r)}
          >
            <Text style={[aiStyles.randomBtnText, random && aiStyles.randomBtnTextOn]}>RND</Text>
          </TouchableOpacity>
          <Text style={[aiStyles.hint, { flex: 1 }]}>
            Plays your queue like a pro DJ — BPM-synced auto-crossfades every ~22s.{"\n"}
            {random ? "RND Random order ON" : "Tracks play in queue order. Tap RND to shuffle."}
          </Text>
        </View>
      )}
    </View>
  );
}

// Need Audio import for setAudioModeAsync
import { Audio } from "expo-av";

const aiStyles = StyleSheet.create({
  wrap:             { backgroundColor: "rgba(108,71,255,0.08)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(108,71,255,0.25)", padding: 14, gap: 10 },
  header:           { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  titleRow:         { flexDirection: "row", alignItems: "center", gap: 8 },
  aiLabel:          { color: "#fff", fontSize: 14, fontWeight: "900", letterSpacing: 0.5 },
  liveBadge:        { backgroundColor: "#ef4444", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  liveBadgeText:    { color: "#fff", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  toggle:           { backgroundColor: "#1a1a1a", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: "#333" },
  toggleOn:         { backgroundColor: "#3b0f0f", borderColor: "#ef4444" },
  toggleText:       { color: "#aaa", fontSize: 12, fontWeight: "700" },
  toggleTextOn:     { color: "#f87171" },
  error:            { color: "#f87171", fontSize: 12 },
  hint:             { color: "#555", fontSize: 12, lineHeight: 17 },

  nowPlaying:       { flexDirection: "row", gap: 12, backgroundColor: "rgba(108,71,255,0.12)", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "rgba(108,71,255,0.3)" },
  artwork:          { width: 60, height: 60, borderRadius: 8 },
  artworkPlaceholder:{ backgroundColor: "#1a1a1a", alignItems: "center", justifyContent: "center" },
  trackInfo:        { flex: 1, gap: 3 },
  nowLabel:         { color: "#6c47ff", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  title:            { color: "#fff", fontSize: 14, fontWeight: "800" },
  artist:           { color: "#888", fontSize: 12 },
  progressBar:      { height: 3, backgroundColor: "#2a2a2a", borderRadius: 2, overflow: "hidden", marginTop: 6, position: "relative" },
  progressFill:     { position: "absolute", left: 0, top: 0, height: 3, backgroundColor: "#6c47ff", borderRadius: 2 },
  fadeFill:         { position: "absolute", left: 0, top: 0, height: 3, backgroundColor: "#22c55e", borderRadius: 2, opacity: 0.7 },
  timeText:         { color: "#555", fontSize: 10, marginTop: 2 },

  reasonWrap:       { backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 8, padding: 10, gap: 3 },
  reasonLabel:      { color: "#444", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  reason:           { color: "#8b7cf8", fontSize: 12, lineHeight: 17, fontStyle: "italic" },

  controls:         { flexDirection: "row", alignItems: "center", gap: 10 },
  skipBtn:          { backgroundColor: "#1a1a1a", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: "#333" },
  skipBtnText:      { color: "#aaa", fontSize: 12, fontWeight: "700" },
  randomBtn:        { backgroundColor: "#1a1a1a", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: "#333" },
  randomBtnOn:      { backgroundColor: "rgba(34,197,94,0.12)", borderColor: "rgba(34,197,94,0.5)" },
  randomBtnText:    { fontSize: 14 },
  randomBtnTextOn:  { },
  inactiveRow:      { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  upNext:           { flex: 1, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 8, gap: 1 },
  upNextLabel:      { color: "#444", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  upNextTitle:      { color: "#ccc", fontSize: 12, fontWeight: "700" },
  upNextArtist:     { color: "#555", fontSize: 11 },

  dots:             { flexDirection: "row", gap: 6, justifyContent: "center" },
  dot:              { width: 6, height: 6, borderRadius: 3, backgroundColor: "#2a2a2a" },
  dotActive:        { backgroundColor: "#6c47ff", width: 18 },
  dotPlayed:        { backgroundColor: "#3a2a6a" },
});

// ─── Vinyl Record ─────────────────────────────────────────────────────────────

function VinylRecord({ size, accentColor, isPlaying }: { size: number; accentColor: string; isPlaying: boolean }) {
  const rotation = useRef(new Animated.Value(0)).current;
  const animRef  = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isPlaying) {
      rotation.setValue(0);
      animRef.current = Animated.loop(
        Animated.timing(rotation, { toValue: 1, duration: 2400, useNativeDriver: true, easing: Easing.linear })
      );
      animRef.current.start();
    } else {
      animRef.current?.stop();
    }
  }, [isPlaying]);

  const spin = rotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  // Groove ring sizes (outermost to innermost)
  const grooves = [0.88, 0.74, 0.60, 0.46];

  return (
    <Animated.View style={[{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: "#0d0d0d",
      alignItems: "center", justifyContent: "center",
      borderWidth: 1, borderColor: "#222",
      // Glow when playing
      shadowColor: accentColor, shadowOpacity: isPlaying ? 0.5 : 0,
      shadowRadius: 10, elevation: isPlaying ? 6 : 0,
    }, { transform: [{ rotate: spin }] }]}>
      {/* Grooves */}
      {grooves.map((ratio, i) => (
        <View key={i} style={{
          position: "absolute",
          width: size * ratio, height: size * ratio,
          borderRadius: (size * ratio) / 2,
          borderWidth: 0.5,
          borderColor: `rgba(255,255,255,${0.04 + i * 0.02})`,
        }} />
      ))}
      {/* Sheen stripe */}
      <View style={{
        position: "absolute",
        width: size * 0.12, height: size * 0.7,
        backgroundColor: "rgba(255,255,255,0.03)",
        borderRadius: 4,
        transform: [{ rotate: "30deg" }],
      }} />
      {/* Center label */}
      <View style={{
        width: size * 0.30, height: size * 0.30,
        borderRadius: size * 0.15,
        backgroundColor: accentColor,
        opacity: 0.85,
        alignItems: "center", justifyContent: "center",
      }}>
        {/* Center spindle hole */}
        <View style={{
          width: size * 0.07, height: size * 0.07,
          borderRadius: size * 0.035,
          backgroundColor: "#000",
        }} />
      </View>
    </Animated.View>
  );
}

// ─── Deck Panel ───────────────────────────────────────────────────────────────

interface DeckPanelProps {
  deckId: "A" | "B";
  roomId: string;
  guestId: string;
  siblingIsrc: string | null;          // ISRC loaded on the other deck — skip it
  onLoaded: (isrc: string | null) => void;
}

function DeckPanel({ deckId, roomId, guestId, siblingIsrc, onLoaded }: DeckPanelProps) {
  const { state } = useRoom();
  const [isPlaying, setIsPlaying]     = useState(false);
  const [positionMs, setPositionMs]   = useState(0);
  const [durationMs, setDurationMs]   = useState(0);
  const [loadedTrack, setLoadedTrack] = useState<{ isrc: string; title: string; artist: string; uri?: string } | null>(null);
  const [loading, setLoading]         = useState(false);
  const [volume, setVolume]           = useState(1);
  const positionInterval              = useRef<ReturnType<typeof setInterval> | null>(null);
  const volumeRef                     = useRef(1);
  const volTrackWidthRef              = useRef(0);

  const volPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (e) => {
        const w = volTrackWidthRef.current;
        if (w <= 0) return;
        const next = Math.max(0, Math.min(1, e.nativeEvent.locationX / w));
        volumeRef.current = next;
        setVolume(next);
        audioEngine.setVolume(deckId, next);
      },
      onPanResponderMove: (_, g) => {
        const w = volTrackWidthRef.current;
        if (w <= 0) return;
        const startX = volumeRef.current * w;
        const next   = Math.max(0, Math.min(1, (startX + g.dx) / w));
        volumeRef.current = next;
        setVolume(next);
        audioEngine.setVolume(deckId, next);
      },
      onPanResponderRelease:   () => {},
      onPanResponderTerminate: () => {},
    })
  ).current;

  // Poll position every 500ms while playing
  useEffect(() => {
    if (isPlaying) {
      positionInterval.current = setInterval(async () => {
        const pos = await audioEngine.getPosition(deckId);
        setPositionMs(pos);
      }, 500);
    } else {
      if (positionInterval.current) clearInterval(positionInterval.current);
    }
    return () => { if (positionInterval.current) clearInterval(positionInterval.current); };
  }, [isPlaying, deckId]);

  async function handleLoad() {
    const queue = state.queue;
    if (queue.length === 0) return;

    // Skip any track already loaded on the sibling deck
    const track = queue.find(q => q.track.isrc !== siblingIsrc) ?? queue[0];
    if (!track) return;

    setLoading(true);
    try {
      const uri = (track.track as any).previewUrl ?? (track.track as any).uri;
      if (!uri) {
        const t = { isrc: track.track.isrc, title: track.track.title, artist: track.track.artist };
        setLoadedTrack(t);
        onLoaded(track.track.isrc);
        setDurationMs(track.track.durationMs ?? 0);
        setLoading(false);
        return;
      }

      await audioEngine.loadTrack(deckId, uri);
      const t = { isrc: track.track.isrc, title: track.track.title, artist: track.track.artist, uri };
      setLoadedTrack(t);
      onLoaded(track.track.isrc);
      setDurationMs(track.track.durationMs ?? 0);
      setPositionMs(0);
      emitDeckCommand("cue");
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadSpecific(isrc: string, title: string, artist: string, uri?: string, duration?: number) {
    setLoading(true);
    try {
      if (uri) await audioEngine.loadTrack(deckId, uri);
      setLoadedTrack({ isrc, title, artist, uri });
      onLoaded(isrc);
      setDurationMs(duration ?? 0);
      setPositionMs(0);
      emitDeckCommand("cue");
    } finally {
      setLoading(false);
    }
  }

  async function handlePlayPause() {
    if (!loadedTrack) return;

    if (isPlaying) {
      if (loadedTrack.uri) await audioEngine.pause(deckId);
      setIsPlaying(false);
      emitDeckCommand("pause");
    } else {
      if (loadedTrack.uri) await audioEngine.play(deckId);
      setIsPlaying(true);
      emitDeckCommand("play");
    }
  }

  function emitDeckCommand(command: "play" | "pause" | "cue") {
    const socket = socketManager.get();
    if (!socket) return;
    socket.emit("deck:command" as any, { roomId, guestId, deck: deckId, command });
  }

  function formatTime(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  }

  const progress = durationMs > 0 ? Math.min(positionMs / durationMs, 1) : 0;
  const accentColor = deckId === "A" ? "#6c47ff" : "#06b6d4";

  return (
    <View style={[styles.deckPanel, { borderColor: accentColor + "44" }]}>
      {/* Deck header */}
      <View style={styles.deckHeader}>
        <View style={[styles.deckBadge, { backgroundColor: accentColor }]}>
          <Text style={styles.deckBadgeText}>DECK {deckId}</Text>
        </View>
        {isPlaying && (
          <View style={styles.playingDot}>
            <View style={[styles.playingDotInner, { backgroundColor: accentColor }]} />
          </View>
        )}
      </View>

      {/* Vinyl record */}
      <View style={styles.vinylWrap}>
        <VinylRecord size={80} accentColor={accentColor} isPlaying={isPlaying} />
      </View>

      {/* Track info */}
      <View style={styles.deckTrackInfo}>
        {loadedTrack ? (
          <>
            <Text style={styles.deckTitle} numberOfLines={1}>{loadedTrack.title}</Text>
            <Text style={styles.deckArtist} numberOfLines={1}>{loadedTrack.artist}</Text>
          </>
        ) : (
          <Text style={styles.deckEmpty}>No track loaded</Text>
        )}
      </View>

      {/* Progress bar */}
      <View style={styles.progressRow}>
        <Text style={styles.progressTime}>{formatTime(positionMs)}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` as any, backgroundColor: accentColor }]} />
        </View>
        <Text style={styles.progressTime}>{formatTime(durationMs)}</Text>
      </View>

      {/* Controls */}
      <View style={styles.deckControls}>
        <TouchableOpacity
          style={[styles.deckBtn, styles.loadBtn]}
          onPress={handleLoad}
          disabled={loading || state.queue.length === 0}
        >
          <Text style={styles.deckBtnText}>{loading ? "..." : "⏏ Load"}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.deckBtn,
            styles.playBtn,
            { backgroundColor: accentColor },
            !loadedTrack && styles.deckBtnDisabled,
          ]}
          onPress={handlePlayPause}
          disabled={!loadedTrack}
        >
          <Text style={[styles.deckBtnText, { color: "#fff", fontSize: 20 }]}>
            {isPlaying ? "⏸" : "▶"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Volume slider */}
      <View style={styles.volRow}>
        <Text style={[styles.volLabel, { color: accentColor }]}>VOL</Text>
        <View
          style={styles.volTrack}
          onLayout={e => { volTrackWidthRef.current = e.nativeEvent.layout.width; }}
          {...volPanResponder.panHandlers}
        >
          <View style={[styles.volFill, { width: `${volume * 100}%` as any, backgroundColor: accentColor }]} />
        </View>
        <Text style={styles.volPct}>{Math.round(volume * 100)}%</Text>
      </View>
    </View>
  );
}

// ─── BPM Sync ─────────────────────────────────────────────────────────────────
// Master/slave BPM sync — like Serato/Traktor.
//
// One deck is MASTER (the one currently playing / outgoing).
// The other is SLAVE (the incoming track about to be mixed in).
// SLAVE rate = masterBpm / slaveBpm so both play at the same tempo.
// AUTO: applies the rate live whenever either BPM changes.
// FLIP: swaps which deck is master (A→B transition vs B→A).

interface BPMSyncProps {
  roomId: string;
  deckABpm: number;
  deckBBpm: number;
  onDeckABpm: (v: number) => void;
  onDeckBBpm: (v: number) => void;
}

function BPMSync({ roomId, deckABpm, deckBBpm, onDeckABpm, onDeckBBpm }: BPMSyncProps) {
  const setDeckABpm = onDeckABpm;
  const setDeckBBpm = onDeckBBpm;
  const [master,    setMaster]    = useState<"A" | "B">("A"); // A is master → mixing into B
  const [autoSync,  setAutoSync]  = useState(false);
  const [tappedBpm, setTappedBpm] = useState<number | null>(null);
  const tapsRef = useRef<number[]>([]);

  // AUTO: reapply slave rate whenever any BPM or master changes
  useEffect(() => {
    if (!autoSync) return;
    applySlave(master, deckABpm, deckBBpm);
  }, [autoSync, master, deckABpm, deckBBpm]);

  function applySlave(m: "A" | "B", aBpm: number, bBpm: number) {
    if (m === "A") {
      // A is master — slave B speeds up/slows down to match A
      if (bBpm > 0) audioEngine.setRate("B", aBpm / bBpm).catch(() => {});
      audioEngine.setRate("A", 1).catch(() => {}); // master always plays at ×1
    } else {
      // B is master — slave A matches B
      if (aBpm > 0) audioEngine.setRate("A", bBpm / aBpm).catch(() => {});
      audioEngine.setRate("B", 1).catch(() => {});
    }
  }

  // ── Tap tempo ─────────────────────────────────────────────────────────────
  function handleTap() {
    const now = Date.now();
    tapsRef.current.push(now);
    if (tapsRef.current.length > 8) tapsRef.current.shift();
    if (tapsRef.current.length > 1 && now - tapsRef.current[tapsRef.current.length - 2] > 3000) {
      tapsRef.current = [now];
      setTappedBpm(null);
      return;
    }
    if (tapsRef.current.length < 2) return;
    const deltas   = tapsRef.current.slice(1).map((t, i) => t - tapsRef.current[i]);
    const avg      = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const computed = Math.round(60000 / avg);
    setTappedBpm(computed);
    // Push straight into master deck BPM — BPM Sync picks it up immediately
    if (master === "A") setDeckABpm(computed);
    else                setDeckBBpm(computed);
    const socket = socketManager.get();
    if (socket && roomId) socket.emit("room:setting" as any, { roomId, key: "bpm_override", value: computed });
  }

  function nudge(deck: "A" | "B", delta: number) {
    if (deck === "A") setDeckABpm(Math.max(40, Math.min(220, deckABpm + delta)));
    else              setDeckBBpm(Math.max(40, Math.min(220, deckBBpm + delta)));
  }

  function flipMaster() {
    setMaster(m => m === "A" ? "B" : "A");
  }

  const slave     = master === "A" ? "B" : "A";
  const masterBpm = master === "A" ? deckABpm : deckBBpm;
  const slaveBpm  = master === "A" ? deckBBpm : deckABpm;
  const slaveRate = slaveBpm > 0 ? masterBpm / slaveBpm : 1;
  const masterColor = master === "A" ? "#6c47ff" : "#06b6d4";
  const slaveColor  = slave  === "A" ? "#6c47ff" : "#06b6d4";

  function rateColor(rate: number) {
    const diff = Math.abs(rate - 1);
    if (diff < 0.02) return "#22c55e";
    if (diff < 0.08) return "#f59e0b";
    return "#ef4444";
  }

  return (
    <View style={bpmStyles.wrap}>
      {/* Header */}
      <View style={bpmStyles.header}>
        <Text style={bpmStyles.title}>BPM SYNC</Text>
        <TouchableOpacity
          style={[bpmStyles.autoBtn, autoSync && bpmStyles.autoBtnOn]}
          onPress={() => setAutoSync(v => !v)}
        >
          <View style={[bpmStyles.autoDot, autoSync && bpmStyles.autoDotOn]} />
          <Text style={[bpmStyles.autoBtnText, autoSync && bpmStyles.autoBtnTextOn]}>AUTO</Text>
        </TouchableOpacity>
      </View>

      {/* Direction label */}
      <View style={bpmStyles.dirRow}>
        <Text style={[bpmStyles.dirDeck, { color: masterColor }]}>DECK {master}</Text>
        <Text style={bpmStyles.dirArrow}>──────────────→</Text>
        <Text style={[bpmStyles.dirDeck, { color: slaveColor }]}>DECK {slave}</Text>
      </View>
      <View style={bpmStyles.dirRow}>
        <Text style={[bpmStyles.dirRole, { color: masterColor }]}>MASTER</Text>
        <Text style={bpmStyles.dirRoleGap} />
        <Text style={[bpmStyles.dirRole, { color: slaveColor }]}>INCOMING</Text>
      </View>

      {/* BPM inputs — master left, slave right */}
      <View style={bpmStyles.cols}>
        {/* Master deck */}
        <View style={bpmStyles.deckCol}>
          <View style={bpmStyles.nudgeRow}>
            <TouchableOpacity style={bpmStyles.nudgeBtn} onPress={() => nudge(master, -1)}>
              <Text style={bpmStyles.nudgeTxt}>−</Text>
            </TouchableOpacity>
            <TextInput
              style={[bpmStyles.bpmInput, { borderColor: masterColor + "66" }]}
              value={String(masterBpm)}
              onChangeText={t => { const n = parseInt(t); if (!isNaN(n)) nudge(master, n - masterBpm); }}
              keyboardType="numeric"
              selectTextOnFocus
            />
            <TouchableOpacity style={bpmStyles.nudgeBtn} onPress={() => nudge(master, 1)}>
              <Text style={bpmStyles.nudgeTxt}>+</Text>
            </TouchableOpacity>
          </View>
          <Text style={bpmStyles.rateFixed}>×1.000</Text>
        </View>

        {/* Flip button */}
        <TouchableOpacity style={bpmStyles.flipBtn} onPress={flipMaster}>
          <Text style={bpmStyles.flipTxt}>⇄</Text>
          <Text style={bpmStyles.flipLabel}>FLIP</Text>
        </TouchableOpacity>

        {/* Slave deck */}
        <View style={bpmStyles.deckCol}>
          <View style={bpmStyles.nudgeRow}>
            <TouchableOpacity style={bpmStyles.nudgeBtn} onPress={() => nudge(slave, -1)}>
              <Text style={bpmStyles.nudgeTxt}>−</Text>
            </TouchableOpacity>
            <TextInput
              style={[bpmStyles.bpmInput, { borderColor: slaveColor + "66" }]}
              value={String(slaveBpm)}
              onChangeText={t => { const n = parseInt(t); if (!isNaN(n)) nudge(slave, n - slaveBpm); }}
              keyboardType="numeric"
              selectTextOnFocus
            />
            <TouchableOpacity style={bpmStyles.nudgeBtn} onPress={() => nudge(slave, 1)}>
              <Text style={bpmStyles.nudgeTxt}>+</Text>
            </TouchableOpacity>
          </View>
          <Text style={[bpmStyles.rateLabel, { color: rateColor(slaveRate) }]}>
            ×{slaveRate.toFixed(3)}
          </Text>
        </View>
      </View>

      {/* Tap Tempo row — built in, updates master BPM live */}
      <View style={bpmStyles.tapRow}>
        <TouchableOpacity style={bpmStyles.tapBtn} onPress={handleTap} activeOpacity={0.5}>
          <Text style={bpmStyles.tapBtnText}>TAP</Text>
        </TouchableOpacity>
        <View style={bpmStyles.tapDisplay}>
          {tappedBpm ? (
            <>
              <Text style={bpmStyles.tapBpmValue}>{tappedBpm}</Text>
              <Text style={bpmStyles.tapBpmLabel}>→ DECK {master}</Text>
            </>
          ) : (
            <Text style={bpmStyles.tapBpmHint}>tap in time with the beat</Text>
          )}
        </View>
      </View>

      {/* Action row */}
      <View style={bpmStyles.actionRow}>
        {!autoSync && (
          <TouchableOpacity
            style={bpmStyles.syncNowBtn}
            onPress={() => applySlave(master, deckABpm, deckBBpm)}
          >
            <Text style={bpmStyles.syncNowText}>SYNC NOW</Text>
          </TouchableOpacity>
        )}
        {autoSync && <Text style={bpmStyles.autoHint}>● LIVE — incoming deck adjusts automatically</Text>}
        <TouchableOpacity
          onPress={() => { audioEngine.setRate("A", 1).catch(() => {}); audioEngine.setRate("B", 1).catch(() => {}); }}
        >
          <Text style={bpmStyles.resetText}>reset</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const bpmStyles = StyleSheet.create({
  wrap:        { backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 14, borderWidth: 1, borderColor: "#1e1e1e", padding: 14, gap: 10 },
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title:       { color: "#555", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  autoBtn:     { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#111", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "#2a2a2a" },
  autoBtnOn:   { backgroundColor: "rgba(34,197,94,0.12)", borderColor: "rgba(34,197,94,0.4)" },
  autoDot:     { width: 7, height: 7, borderRadius: 4, backgroundColor: "#333" },
  autoDotOn:   { backgroundColor: "#22c55e" },
  autoBtnText: { color: "#555", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  autoBtnTextOn:{ color: "#22c55e" },

  dirRow:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dirDeck:     { fontSize: 11, fontWeight: "900", letterSpacing: 1, width: 64 },
  dirArrow:    { flex: 1, color: "#333", fontSize: 9, textAlign: "center" },
  dirRole:     { fontSize: 9, fontWeight: "700", letterSpacing: 1, width: 64 },
  dirRoleGap:  { flex: 1 },

  cols:        { flexDirection: "row", gap: 8, alignItems: "center" },
  deckCol:     { flex: 1, alignItems: "center", gap: 4 },
  nudgeRow:    { flexDirection: "row", alignItems: "center", gap: 4 },
  nudgeBtn:    { backgroundColor: "#1a1a1a", borderRadius: 6, width: 24, height: 30, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#2a2a2a" },
  nudgeTxt:    { color: "#aaa", fontSize: 16, fontWeight: "700", lineHeight: 20 },
  bpmInput:    { backgroundColor: "#111", borderRadius: 8, borderWidth: 1, color: "#fff", fontSize: 18, fontWeight: "900", textAlign: "center", width: 54, paddingVertical: 4 },
  rateLabel:   { fontSize: 11, fontWeight: "700" },
  rateFixed:   { fontSize: 11, fontWeight: "700", color: "#22c55e" },

  flipBtn:     { alignItems: "center", gap: 2, paddingHorizontal: 4 },
  flipTxt:     { color: "#555", fontSize: 20 },
  flipLabel:   { color: "#444", fontSize: 8, fontWeight: "800", letterSpacing: 1 },

  tapRow:       { flexDirection: "row", alignItems: "center", gap: 10 },
  tapBtn:       { backgroundColor: "rgba(108,71,255,0.25)", borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12, borderWidth: 1, borderColor: "rgba(108,71,255,0.5)" },
  tapBtnText:   { color: "#c4b5fd", fontWeight: "900", fontSize: 14, letterSpacing: 2 },
  tapDisplay:   { flex: 1, backgroundColor: "#111", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: "#222", flexDirection: "row", alignItems: "center", gap: 8 },
  tapBpmValue:  { color: "#fff", fontSize: 22, fontWeight: "900" },
  tapBpmLabel:  { color: "#6c47ff", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  tapBpmHint:   { color: "#444", fontSize: 11 },

  actionRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  syncNowBtn:  { backgroundColor: "rgba(108,71,255,0.22)", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(108,71,255,0.45)" },
  syncNowText: { color: "#c4b5fd", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  autoHint:    { color: "#22c55e", fontSize: 10, fontWeight: "700", flex: 1 },
  resetText:   { color: "#333", fontSize: 11 },
});

// ─── Demo Track Loader ────────────────────────────────────────────────────────
// Lets the host search iTunes and instantly load a 30-second preview to a deck
// without needing guests to queue up songs first.

const DEMO_QUERIES = [
  // Row 1 — always visible
  { label: "pop hits 2024",      emoji: "🎤" },
  { label: "hip hop party",      emoji: "🔥" },
  { label: "electronic dance",   emoji: "⚡" },
  // Row 2 — always visible (3 more)
  { label: "r&b slow jams",      emoji: "🎷" },
  { label: "latin reggaeton",    emoji: "💃" },
  { label: "indie feel good",    emoji: "🌿" },
];

type DemoTrack = { title: string; artist: string; previewUrl: string; artworkUrl: string };

function DemoTrackLoader({ roomId, guestId }: { roomId: string; guestId: string }) {
  const { dispatch } = useRoom();
  const [results,    setResults]    = useState<DemoTrack[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [searched,   setSearched]   = useState(false);
  const [activeQ,    setActiveQ]    = useState("");
  const [expanded,   setExpanded]   = useState(false); // show all 20 vs first 6
  const [searchText, setSearchText] = useState("");
  const PREVIEW_COUNT = 6;

  async function search(q: string) {
    setActiveQ(q);
    setLoading(true);
    setSearched(true);
    setExpanded(false);
    try {
      const encoded = encodeURIComponent(q);
      const res  = await fetch(`https://itunes.apple.com/search?term=${encoded}&entity=song&limit=25&media=music`);
      const data = await res.json();
      const tracks = (data.results ?? [])
        .filter((r: any) => r.previewUrl)
        .slice(0, 20)
        .map((r: any) => ({
          title:      r.trackName,
          artist:     r.artistName,
          previewUrl: r.previewUrl,
          artworkUrl: r.artworkUrl100,
        }));
      setResults(tracks);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function addToQueue(track: DemoTrack) {
    dispatch({
      type: "ADD_QUEUE_ITEM",
      item: {
        id:        `demo_${Date.now()}`,
        guestId,
        roomId,
        position:  999,
        timestamp: Date.now(),
        track: {
          isrc:       `DEMO_${Date.now()}`,
          title:      track.title,
          artist:     track.artist,
          previewUrl: track.previewUrl,
          durationMs: 30000,
        } as any,
        votes:     0,
        vibeScore: 0.8,
      } as any,
    });
  }

  const visible = expanded ? results : results.slice(0, PREVIEW_COUNT);
  const hiddenCount = results.length - PREVIEW_COUNT;

  function submitSearch() {
    const q = searchText.trim();
    if (!q) return;
    search(q);
  }

  return (
    <View style={demoStyles.wrap}>
      <Text style={demoStyles.hint}>Search iTunes to load 30-second previews directly to a deck — no guests needed.</Text>

      {/* Free-text search bar */}
      <View style={demoStyles.searchRow}>
        <TextInput
          style={demoStyles.searchInput}
          placeholder="Search any artist or song..."
          placeholderTextColor="#555"
          value={searchText}
          onChangeText={setSearchText}
          onSubmitEditing={submitSearch}
          returnKeyType="search"
          autoCorrect={false}
        />
        <TouchableOpacity style={demoStyles.searchBtn} onPress={submitSearch}>
          <Text style={demoStyles.searchBtnText}>Go</Text>
        </TouchableOpacity>
      </View>

      {/* Quick-search buttons — 2 rows of 3 */}
      <View style={demoStyles.quickRow}>
        {DEMO_QUERIES.map(({ label, emoji }) => (
          <TouchableOpacity
            key={label}
            style={[demoStyles.quickBtn, activeQ === label && demoStyles.quickBtnActive]}
            onPress={() => search(label)}
          >
            <Text style={demoStyles.quickBtnEmoji}>{emoji}</Text>
            <Text style={[demoStyles.quickBtnText, activeQ === label && demoStyles.quickBtnTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && <Text style={demoStyles.loadingText}>Searching iTunes...</Text>}
      {searched && !loading && results.length === 0 && (
        <Text style={demoStyles.loadingText}>No results with previews</Text>
      )}

      {/* Track list */}
      {visible.map((t, i) => (
        <View key={i} style={demoStyles.row}>
          {t.artworkUrl ? (
            <Image source={{ uri: t.artworkUrl }} style={demoStyles.thumb} />
          ) : (
            <View style={[demoStyles.thumb, demoStyles.thumbPlaceholder]}><Text style={{ fontSize: 16 }}>🎵</Text></View>
          )}
          <View style={demoStyles.trackInfo}>
            <Text style={demoStyles.title} numberOfLines={1}>{t.title}</Text>
            <Text style={demoStyles.artist} numberOfLines={1}>{t.artist}</Text>
          </View>
          <TouchableOpacity style={demoStyles.addBtn} onPress={() => addToQueue(t)}>
            <Text style={demoStyles.addBtnText}>+ Queue</Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* Expand / collapse toggle */}
      {results.length > PREVIEW_COUNT && (
        <TouchableOpacity style={demoStyles.expandBtn} onPress={() => setExpanded(e => !e)}>
          <Text style={demoStyles.expandBtnText}>
            {expanded ? `▲  Show less` : `▼  Show ${hiddenCount} more tracks`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const demoStyles = StyleSheet.create({
  wrap:               { gap: 8 },
  hint:               { color: "#6b7280", fontSize: 12, lineHeight: 17, marginBottom: 2 },
  searchRow:          { flexDirection: "row", gap: 8, alignItems: "center" },
  searchInput:        { flex: 1, backgroundColor: "#111", borderRadius: 10, borderWidth: 1, borderColor: "#333", color: "#fff", fontSize: 13, paddingHorizontal: 12, paddingVertical: 10 },
  searchBtn:          { backgroundColor: "#6c47ff", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  searchBtnText:      { color: "#fff", fontSize: 13, fontWeight: "800" },
  quickRow:           { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  quickBtn:           { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(108,71,255,0.18)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: "rgba(108,71,255,0.35)" },
  quickBtnActive:     { backgroundColor: "rgba(108,71,255,0.40)", borderColor: "rgba(108,71,255,0.7)" },
  quickBtnEmoji:      { fontSize: 13 },
  quickBtnText:       { color: "#a78bfa", fontSize: 11, fontWeight: "700" },
  quickBtnTextActive: { color: "#fff" },
  loadingText:        { color: "#6b7280", fontSize: 12 },
  row:                { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 10 },
  thumb:              { width: 38, height: 38, borderRadius: 6 },
  thumbPlaceholder:   { backgroundColor: "#1a1a1a", alignItems: "center", justifyContent: "center" },
  trackInfo:          { flex: 1 },
  title:              { color: "#fff", fontSize: 13, fontWeight: "700" },
  artist:             { color: "#6b7280", fontSize: 11 },
  addBtn:             { backgroundColor: "rgba(108,71,255,0.25)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(108,71,255,0.4)" },
  addBtnText:         { color: "#a78bfa", fontSize: 11, fontWeight: "800" },
  expandBtn:          { alignItems: "center", paddingVertical: 10, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "#222" },
  expandBtnText:      { color: "#6b7280", fontSize: 12, fontWeight: "600" },
});

// ─── Main DJControls ──────────────────────────────────────────────────────────


export function DJControls() {
  const { state } = useRoom();
  const [bathroomActive, setBathroomActive] = useState(false);
  const [activeVibe, setActiveVibe]         = useState<VibePreset>("open");
  // Track what each deck has loaded so they don't grab the same queue item
  const [deckAIsrc, setDeckAIsrc] = useState<string | null>(null);
  const [deckBIsrc, setDeckBIsrc] = useState<string | null>(null);
  // Shared BPM state — used by both BPMSync panel and AI DJ auto-crossfade
  const [deckABpm, setDeckABpm] = useState(120);
  const [deckBBpm, setDeckBBpm] = useState(120);

  const [localCrowdState, setLocalCrowdState] = useState<CrowdState | null>(null);
  const currentCrowdState: CrowdState = localCrowdState ?? (state.room?.crowdState as CrowdState) ?? "WARMUP";
  const roomId  = state.room?.id ?? "";
  const guestId = state.guestId ?? "";

  // Init audio engine once on mount
  useEffect(() => {
    audioEngine.init().catch(() => {});
  }, []);

  function toggleBathroom() {
    const socket = socketManager.get();
    if (!socket || !state.room) return;
    const next = !bathroomActive;
    setBathroomActive(next);
    socket.emit("bathroom:toggle" as any, { roomId, active: next });
  }

  function setVibe(preset: VibePreset) {
    setActiveVibe(preset); // always applies locally
    const socket = socketManager.get();
    if (socket && state.room) socket.emit("vibe:set" as any, { roomId, preset });
  }

  function setCrowdState(crowdState: CrowdState) {
    setLocalCrowdState(crowdState); // always applies locally
    const socket = socketManager.get();
    if (socket && state.room) socket.emit("crowd_state:set" as any, { roomId, crowdState });
  }

  function skipCurrentTrack() {
    const socket = socketManager.get();
    if (!socket || !state.room) return;
    socket.emit("experience:action" as any, {
      roomId,
      guestId,
      action: "queue:skip_current",
      payload: {},
    });
  }

  return (
    <View style={styles.container}>

      {/* ── Spotify ────────────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>SPOTIFY</Text>
      <SpotifyConnectButton />

      {/* ── AI DJ ──────────────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>AI DJ</Text>
      <AIDJSection
        crowdState={currentCrowdState}
        deckABpm={deckABpm}
        deckBBpm={deckBBpm}
        onDeckABpm={setDeckABpm}
        onDeckBBpm={setDeckBBpm}
      />

      {/* ── Decks ──────────────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>DECKS</Text>
      <View style={styles.decksRow}>
        <View style={styles.deckWrap}>
          <DeckPanel deckId="A" roomId={roomId} guestId={guestId}
            siblingIsrc={deckBIsrc} onLoaded={setDeckAIsrc} />
        </View>
        <View style={styles.deckWrap}>
          <DeckPanel deckId="B" roomId={roomId} guestId={guestId}
            siblingIsrc={deckAIsrc} onLoaded={setDeckBIsrc} />
        </View>
      </View>

      {/* ── Crossfader ─────────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>CROSSFADER</Text>
      <Crossfader />

      {/* ── BPM Sync + Tap Tempo ───────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>BPM SYNC</Text>
      <BPMSync
        roomId={roomId}
        deckABpm={deckABpm}
        deckBBpm={deckBBpm}
        onDeckABpm={setDeckABpm}
        onDeckBBpm={setDeckBBpm}
      />

      {/* ── Demo Tracks ────────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>DEMO TRACKS</Text>
      <DemoTrackLoader roomId={roomId} guestId={guestId} />

      {/* ── Local File Import ──────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>LOCAL FILE</Text>
      <LocalTrackImporter />

      {/* ── Crowd State ────────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>CROWD STATE</Text>
      <View style={styles.arcRow}>
        {CROWD_STATES.map(({ state: cs }, i) => {
          const active = cs === currentCrowdState;
          const past   = CROWD_STATES.findIndex(s => s.state === currentCrowdState) > i;
          return (
            <React.Fragment key={cs}>
              <View style={[
                styles.arcDot,
                { backgroundColor: active ? CROWD_STATES[i].color : past ? CROWD_STATES[i].color + "55" : "#222" },
                active && styles.arcDotActive,
              ]} />
              {i < CROWD_STATES.length - 1 && (
                <View style={[styles.arcLine, past && { backgroundColor: "#333" }]} />
              )}
            </React.Fragment>
          );
        })}
      </View>
      <View style={styles.crowdGrid}>
        {CROWD_STATES.map(({ state: cs, label, emoji, bpmRange, color }) => {
          const active = cs === currentCrowdState;
          return (
            <TouchableOpacity
              key={cs}
              style={[styles.crowdBtn, active && { borderColor: color, backgroundColor: color + "18" }]}
              onPress={() => setCrowdState(cs)}
            >
              <Text style={styles.crowdEmoji}>{emoji}</Text>
              <Text style={[styles.crowdLabel, active && { color }]}>{label}</Text>
              <Text style={[styles.crowdBpm, active && { color: color + "cc" }]}>{bpmRange}</Text>
              {active && <View style={[styles.activeDot, { backgroundColor: color }]} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Vibe Preset ────────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>VIBE PRESET</Text>
      <View style={styles.row}>
        {VIBES.map(({ preset, label, emoji }) => (
          <TouchableOpacity
            key={preset}
            style={[styles.vibeBtn, activeVibe === preset && styles.vibeBtnActive]}
            onPress={() => setVibe(preset)}
          >
            <Text style={styles.vibeEmoji}>{emoji}</Text>
            <Text style={styles.vibeLabel}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Skip Controls ──────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>PLAYBACK</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.vibeBtn, { borderColor: "#ef4444", backgroundColor: "#1a0808" }]}
          onPress={skipCurrentTrack}
        >
          <Text style={styles.vibeEmoji}>⏭</Text>
          <Text style={[styles.vibeLabel, { color: "#f87171" }]}>Skip Track</Text>
        </TouchableOpacity>
      </View>

      {/* ── Bathroom Break ─────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>BREAK</Text>
      <TouchableOpacity
        style={[styles.bathroomBtn, bathroomActive && styles.bathroomBtnActive]}
        onPress={toggleBathroom}
      >
        <Text style={styles.bathroomText}>
          {bathroomActive ? "🚻 Bathroom Break — ON (tap to end)" : "🚻 Start Bathroom Break"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:    { gap: 12 },
  sectionLabel: { color: "#555", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  row:          { flexDirection: "row", gap: 10 },

  // Decks
  decksRow:     { flexDirection: "row", gap: 10 },
  deckWrap:     { flex: 1 },
  deckPanel:    { backgroundColor: "#0d0d0d", borderRadius: 12, borderWidth: 1, padding: 12, gap: 8 },
  deckHeader:   { flexDirection: "row", alignItems: "center", gap: 8 },
  deckBadge:    { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  deckBadgeText:{ color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  playingDot:   { width: 10, height: 10, borderRadius: 5, backgroundColor: "#1a1a1a", alignItems: "center", justifyContent: "center" },
  playingDotInner: { width: 6, height: 6, borderRadius: 3 },

  deckTrackInfo:{ minHeight: 36 },
  deckTitle:    { color: "#fff", fontSize: 12, fontWeight: "700" },
  deckArtist:   { color: "#666", fontSize: 11, marginTop: 1 },
  deckEmpty:    { color: "#333", fontSize: 12, fontStyle: "italic" },

  progressRow:  { flexDirection: "row", alignItems: "center", gap: 6 },
  progressTime: { color: "#444", fontSize: 10, width: 32 },
  progressTrack:{ flex: 1, height: 3, backgroundColor: "#1a1a1a", borderRadius: 2, overflow: "hidden" },
  progressFill: { height: 3, borderRadius: 2 },

  deckControls: { flexDirection: "row", gap: 8 },
  deckBtn:      { flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: "center", justifyContent: "center" },
  loadBtn:      { backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "#2a2a2a" },
  playBtn:      { },
  deckBtnText:  { color: "#aaa", fontSize: 13, fontWeight: "700" },
  deckBtnDisabled: { opacity: 0.3 },

  vinylWrap:    { alignItems: "center", paddingVertical: 6 },

  volRow:       { flexDirection: "row", alignItems: "center", gap: 8 },
  volLabel:     { fontSize: 9, fontWeight: "900", letterSpacing: 1, width: 24 },
  volTrack:     { flex: 1, height: 20, backgroundColor: "#1a1a1a", borderRadius: 10, borderWidth: 1, borderColor: "#2a2a2a", overflow: "hidden", justifyContent: "center" },
  volFill:      { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 10, opacity: 0.7 },
  volPct:       { color: "#555", fontSize: 10, width: 30, textAlign: "right" },

  // Crowd state arc
  arcRow:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 4, marginBottom: 4 },
  arcDot:       { width: 8, height: 8, borderRadius: 4 },
  arcDotActive: { width: 10, height: 10, borderRadius: 5 },
  arcLine:      { flex: 1, height: 1, backgroundColor: "#1e1e1e" },

  crowdGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  crowdBtn:     { width: "30%", flexGrow: 1, backgroundColor: "#111", borderRadius: 10, padding: 10, alignItems: "center", borderWidth: 1, borderColor: "#222", gap: 2, position: "relative" },
  crowdEmoji:   { fontSize: 18 },
  crowdLabel:   { color: "#aaa", fontSize: 11, fontWeight: "700" },
  crowdBpm:     { color: "#444", fontSize: 10 },
  activeDot:    { position: "absolute", top: 6, right: 6, width: 5, height: 5, borderRadius: 3 },

  // Vibe
  vibeBtn:          { flex: 1, backgroundColor: "#1a1a1a", borderRadius: 10, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "#333", gap: 4 },
  vibeBtnActive:    { borderColor: "#6c47ff", backgroundColor: "#1e1e2e" },
  vibeEmoji:        { fontSize: 20 },
  vibeLabel:        { color: "#fff", fontSize: 11, fontWeight: "600" },

  // Bathroom
  bathroomBtn:      { backgroundColor: "#1a1a1a", borderRadius: 10, padding: 16, alignItems: "center", borderWidth: 1, borderColor: "#333" },
  bathroomBtnActive:{ borderColor: "#f59e0b", backgroundColor: "#1c1a0e" },
  bathroomText:     { color: "#fff", fontSize: 14, fontWeight: "600" },
});
