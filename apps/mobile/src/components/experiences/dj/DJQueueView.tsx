import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, FlatList, TextInput, Image,
  TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from "react-native";
import { useRoom } from "../../../contexts/RoomContext";
import type { QueueItem, Track } from "@queuedj/shared-types";
import { socketManager } from "../../../lib/socket";
import { tapMedium, notifySuccess, notifyWarning, notifyError } from "../../../lib/haptics";
import { TrackDetailModal } from "./TrackDetailModal";
import { BeatPulse } from "../../shared/BeatPulse";
import { CrowdGauge } from "../../shared/CrowdGauge";
import { EmotePanel } from "../../shared/EmotePanel";
import { ShoutoutBar } from "../../shared/ShoutoutBar";
import { DJBoothViz } from "./DJBoothViz";
import { AudioWaveform } from "../../shared/AudioWaveform";
import { RateLimitBadge } from "../../shared/RateLimitBadge";
import { GuestSpotifyLibrary } from "./GuestSpotifyLibrary";
import type { SpotifyLibraryTrack } from "../../../lib/spotifyGuest";

// ─────────────────────────────────────────────────────────────────────────────
// DJ Queue View — shown to all guests while DJ experience is active
//
// Guests can: see now playing, see queue, request tracks, vote
// HOST also sees this — host view is overlaid on top in HostScreen
// ─────────────────────────────────────────────────────────────────────────────

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

interface TrackSearchResult {
  isrc: string;
  title: string;
  artist: string;
  album: string | null;
  album_art_url: string | null;
  duration_ms: number | null;
  bpm: number | null;
  energy: number | null;
  genre?: string | null;
  mood?: string | null;
  artist_bio?: string | null;
  artist_image_url?: string | null;
  danceability?: number | null;
  valence?: number | null;
}

export function DJQueueView() {
  const { state } = useRoom();
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<TrackSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [cooldown, setCooldown]     = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [optimisticQueue, setOptimisticQueue] = useState<QueueItem[] | null>(null);
  const [detailIsrc, setDetailIsrc] = useState<string | null>(null);
  const [emoteOpen, setEmoteOpen]       = useState(false);
  const [shoutoutOpen, setShoutoutOpen] = useState(false);
  const [boothOpen, setBoothOpen]       = useState(false);
  const [libraryOpen, setLibraryOpen]   = useState(false);
  const [nowPlayingTrack, setNowPlayingTrack] = useState<TrackSearchResult | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nowPlayingIsrc = state.djState?.nowPlaying ?? null;
  const crowdState = state.room?.crowdState ?? "WARMUP";
  const displayQueue = optimisticQueue ?? state.queue;

  // Clear optimistic queue when server queue updates
  useEffect(() => { setOptimisticQueue(null); }, [state.queue]);

  // Fetch Now Playing track details whenever ISRC changes
  useEffect(() => {
    if (!nowPlayingIsrc) { setNowPlayingTrack(null); return; }

    // Check queue first — might already have the data
    const inQueue = state.queue.find(item => item.track.isrc === nowPlayingIsrc);
    if (inQueue) {
      const t = inQueue.track;
      setNowPlayingTrack({
        isrc: t.isrc, title: t.title, artist: t.artist,
        album: t.album ?? null, album_art_url: t.artworkUrl ?? null,
        duration_ms: t.durationMs, bpm: t.bpm ?? null, energy: t.energy ?? null,
      });
      return;
    }

    // Not in queue — fetch from API
    fetch(`${API_URL}/tracks/${encodeURIComponent(nowPlayingIsrc)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.track) setNowPlayingTrack(data.track);
      })
      .catch(() => {}); // Graceful fail — shows ISRC fallback
  }, [nowPlayingIsrc]);

  // Debounced search — fires 300ms after user stops typing
  useEffect(() => {
    const trimmed = searchText.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `${API_URL}/tracks/search?q=${encodeURIComponent(trimmed)}&limit=8`
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.tracks ?? []);
          setShowResults(true);
        }
      } catch {
        // API unreachable — allow manual entry
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchText]);

  async function requestTrackFromResult(result: TrackSearchResult) {
    setShowResults(false);
    setSearchText(`${result.title} — ${result.artist}`);
    setRequesting(true);

    const socket = socketManager.get();
    if (!socket || !state.room) { setRequesting(false); return; }

    // Optimistic item with real data
    const optimisticItem: QueueItem = {
      id: `optimistic:${Date.now()}`,
      roomId: state.room.id,
      track: {
        isrc: result.isrc,
        title: result.title,
        artist: result.artist,
        album: result.album ?? undefined,
        artworkUrl: result.album_art_url ?? undefined,
        durationMs: result.duration_ms ?? 180000,
        bpm: result.bpm ?? undefined,
        energy: result.energy ?? undefined,
        sourcePlatform: "local",
      } as Track,
      position: (optimisticQueue ?? state.queue).length,
      requestedBy: state.guestId ?? "",
      requestedAt: Date.now(),
      votes: 0,
    };
    setOptimisticQueue([...(optimisticQueue ?? state.queue), optimisticItem]);

    socket.emit("queue:request", {
      roomId: state.room.id,
      guestId: state.guestId!,
      isrc: result.isrc,
      title: result.title,
      artist: result.artist,
      durationMs: result.duration_ms ?? 180000,
      sourcePlatform: "local",
      artworkUrl: result.album_art_url ?? undefined,
    }, (ack) => {
      if (!ack.accepted) {
        setOptimisticQueue(null);
        setSearchText("");
        notifyError();
        // Server-side per-guest cooldown — show badge with exact remaining seconds
        if (ack.error?.startsWith("COOLDOWN:")) {
          const secs = parseInt(ack.error.split(":")[1], 10) || 30;
          setCooldown(secs);
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          cooldownRef.current = setInterval(() => {
            setCooldown((c) => {
              if (c <= 1) { clearInterval(cooldownRef.current!); return 0; }
              return c - 1;
            });
          }, 1000);
        } else if (ack.error === "RATE_LIMITED") {
          Alert.alert("Slow down", "You're sending requests too fast. Wait a moment.");
        } else if (ack.error === "UNAUTHORIZED") {
          Alert.alert("Not allowed", "You don't have permission to request tracks right now.");
        } else if (ack.guardrailResult?.rejected) {
          const suggestion = ack.guardrailResult.alternativePositionSuggestion;
          Alert.alert(
            "Vibe mismatch 🎚️",
            suggestion
              ? `That track clashes with the current vibe.\n${suggestion}`
              : "That track doesn't fit the current vibe. Try something closer to the energy on the floor.",
          );
        } else {
          Alert.alert("Not added", ack.error ?? "Could not add track. Try again.");
        }
      } else {
        notifySuccess();
        setSearchText("");
        // Start 30s cooldown after successful request
        if (cooldownRef.current) clearInterval(cooldownRef.current);
        setCooldown(30);
        cooldownRef.current = setInterval(() => {
          setCooldown((c) => {
            if (c <= 1) { clearInterval(cooldownRef.current!); return 0; }
            return c - 1;
          });
        }, 1000);
      }
      setRequesting(false);
    });
  }

  // Manual entry fallback — used when search has no results or API is down
  async function requestManual() {
    const title = searchText.trim();
    if (!title) return;
    setRequesting(true);
    setShowResults(false);

    const socket = socketManager.get();
    if (!socket || !state.room) { setRequesting(false); return; }

    const optimisticItem: QueueItem = {
      id: `optimistic:${Date.now()}`,
      roomId: state.room.id,
      track: {
        isrc: `manual:${Date.now()}`,
        title,
        artist: "Unknown",
        durationMs: 180000,
        sourcePlatform: "local",
      } as Track,
      position: (optimisticQueue ?? state.queue).length,
      requestedBy: state.guestId ?? "",
      requestedAt: Date.now(),
      votes: 0,
    };
    setOptimisticQueue([...(optimisticQueue ?? state.queue), optimisticItem]);
    setSearchText("");

    socket.emit("queue:request", {
      roomId: state.room.id,
      guestId: state.guestId!,
      isrc: optimisticItem.track.isrc,
      title,
      artist: "Unknown",
      durationMs: 180000,
      sourcePlatform: "local",
    }, (ack) => {
      if (!ack.accepted) {
        setOptimisticQueue(null);
        notifyError();
        if (ack.error?.startsWith("COOLDOWN:")) {
          const secs = parseInt(ack.error.split(":")[1], 10) || 30;
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          setCooldown(secs);
          cooldownRef.current = setInterval(() => {
            setCooldown((c) => {
              if (c <= 1) { clearInterval(cooldownRef.current!); return 0; }
              return c - 1;
            });
          }, 1000);
        } else if (ack.error === "RATE_LIMITED") {
          Alert.alert("Slow down", "You're sending requests too fast. Wait a moment.");
        } else if (ack.error === "UNAUTHORIZED") {
          Alert.alert("Not allowed", "You don't have permission to request tracks right now.");
        } else if (ack.guardrailResult?.rejected) {
          Alert.alert("Vibe mismatch 🎚️", ack.guardrailResult.alternativePositionSuggestion ?? "That track doesn't fit the current vibe.");
        } else {
          Alert.alert("Not added", ack.error ?? "Could not add track. Try again.");
        }
      }
      setRequesting(false);
    });
  }

  function requestFromLibrary(track: SpotifyLibraryTrack) {
    requestTrackFromResult({
      isrc:          track.isrc,
      title:         track.title,
      artist:        track.artist,
      album:         track.album,
      album_art_url: track.artworkUrl,
      duration_ms:   track.durationMs,
      bpm:           null,
      energy:        null,
    });
  }

  function voteUp(itemId: string) {
    if (votedIds.has(itemId)) return;
    const socket = socketManager.get();
    if (!socket || !state.room || !state.guestId) return;
    tapMedium();
    setVotedIds(prev => new Set(prev).add(itemId));
    setOptimisticQueue((optimisticQueue ?? state.queue).map(item =>
      item.id === itemId ? { ...item, votes: item.votes + 1 } : item
    ));
    socket.emit("vote:cast", {
      roomId: state.room.id,
      guestId: state.guestId,
      targetItemId: itemId,
      vote: "up",
    });
  }

  return (
    <View style={styles.container}>

      {/* Cooldown badge */}
      {cooldown > 0 && (
        <RateLimitBadge seconds={cooldown} label="Track request" />
      )}

      {/* Now Playing */}
      <NowPlayingBar
        track={nowPlayingTrack}
        isrc={nowPlayingIsrc}
        crowdState={crowdState}
        bpm={state.djState?.bpm ?? nowPlayingTrack?.bpm ?? null}
      />

      {/* DJ Booth Viz (collapsible) */}
      <TouchableOpacity
        style={styles.boothToggle}
        onPress={() => setBoothOpen(v => !v)}
        activeOpacity={0.7}
      >
        <Text style={styles.boothToggleText}>{boothOpen ? "▲" : "▼"} DJ BOOTH</Text>
      </TouchableOpacity>
      {boothOpen && (
        <View style={styles.boothWrap}>
          <DJBoothViz
            bpm={state.djState?.bpm ?? nowPlayingTrack?.bpm ?? undefined}
            energy={nowPlayingTrack?.energy ?? undefined}
          />
        </View>
      )}

      {/* Queue */}
      <Text style={styles.sectionLabel}>UP NEXT ({displayQueue.length})</Text>
      <FlatList
        data={displayQueue}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <QueueItemRow
            item={item}
            position={index}
            voted={votedIds.has(item.id)}
            onVoteUp={() => voteUp(item.id)}
            onPress={() => setDetailIsrc(item.track.isrc)}
          />
        )}
        style={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>🎵</Text>
            <Text style={styles.emptyTitle}>Queue is empty</Text>
            <Text style={styles.emptyText}>Search for a track below to kick things off</Text>
          </View>
        }
      />

      {/* Search dropdown */}
      {showResults && searchResults.length > 0 && (
        <View style={styles.resultsDropdown}>
          {searchResults.map((result) => (
            <TouchableOpacity
              key={result.isrc}
              style={styles.resultRow}
              onPress={() => requestTrackFromResult(result)}
            >
              <View style={styles.resultInfo}>
                <Text style={styles.resultTitle} numberOfLines={1}>{result.title}</Text>
                <Text style={styles.resultArtist} numberOfLines={1}>
                  {result.artist}{result.genre ? `  ·  ${result.genre}` : ""}
                </Text>
              </View>
              {result.bpm !== null && (
                <Text style={styles.resultBpm}>{Math.round(result.bpm)} BPM</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Request bar */}
      <View style={styles.requestBar}>
        <TouchableOpacity
          style={styles.libraryBtn}
          onPress={() => setLibraryOpen(true)}
        >
          <Text style={styles.libraryBtnText}>🎵</Text>
        </TouchableOpacity>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.requestInput}
            placeholder="Search for a song..."
            placeholderTextColor="#555"
            value={searchText}
            onChangeText={(t) => { setSearchText(t); if (!t.trim()) setShowResults(false); }}
            returnKeyType="search"
            onSubmitEditing={() => searchResults.length > 0 ? requestTrackFromResult(searchResults[0]) : requestManual()}
            onFocus={() => { if (searchResults.length > 0) setShowResults(true); }}
          />
          {isSearching && (
            <ActivityIndicator style={styles.searchSpinner} size="small" color="#6c47ff" />
          )}
        </View>
        <TouchableOpacity
          style={[styles.requestButton, (!searchText || requesting || cooldown > 0) && styles.buttonDisabled]}
          onPress={() => searchResults.length > 0 ? requestTrackFromResult(searchResults[0]) : requestManual()}
          disabled={!searchText || requesting || cooldown > 0}
        >
          <Text style={styles.requestButtonText}>
            {requesting ? "..." : cooldown > 0 ? `${cooldown}s` : "Add"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Floating action buttons */}
      <TouchableOpacity
        style={[styles.emoteToggle, { right: 68 }]}
        onPress={() => { setShoutoutOpen(v => !v); setEmoteOpen(false); }}
        activeOpacity={0.8}
      >
        <Text style={styles.emoteToggleText}>📣</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.emoteToggle}
        onPress={() => { setEmoteOpen(v => !v); setShoutoutOpen(false); }}
        activeOpacity={0.8}
      >
        <Text style={styles.emoteToggleText}>😄</Text>
      </TouchableOpacity>

      <EmotePanel visible={emoteOpen} onClose={() => setEmoteOpen(false)} />
      <ShoutoutBar composeOpen={shoutoutOpen} onComposeClose={() => setShoutoutOpen(false)} />

      <TrackDetailModal
        isrc={detailIsrc}
        visible={detailIsrc !== null}
        onClose={() => setDetailIsrc(null)}
      />

      <GuestSpotifyLibrary
        visible={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onRequestTrack={requestFromLibrary}
      />
    </View>
  );
}

// ─── Now Playing Bar ──────────────────────────────────────────────────────────

function NowPlayingBar({
  track, isrc, crowdState, bpm,
}: {
  track: TrackSearchResult | null;
  isrc: string | null;
  crowdState: string;
  bpm: number | null;
}) {
  if (!isrc) {
    return (
      <View style={styles.nowPlaying}>
        <Text style={styles.nowPlayingLabel}>NOW PLAYING</Text>
        <Text style={styles.nowPlayingEmpty}>Waiting for host...</Text>
        <CrowdStateBadge crowdState={crowdState} />
      </View>
    );
  }

  return (
    <View style={styles.nowPlaying}>
      <View style={styles.nowPlayingTop}>
        {track?.album_art_url ? (
          <Image source={{ uri: track.album_art_url }} style={styles.nowPlayingArt} />
        ) : (
          <View style={[styles.nowPlayingArt, styles.nowPlayingArtPlaceholder]}>
            <Text style={{ fontSize: 28 }}>🎵</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
      <Text style={styles.nowPlayingLabel}>NOW PLAYING</Text>
      {track ? (
        <>
          <Text style={styles.nowPlayingTrack} numberOfLines={1}>{track.title}</Text>
          <Text style={styles.nowPlayingArtist} numberOfLines={1}>{track.artist}</Text>
          <View style={styles.nowPlayingMeta}>
            {bpm !== null && (
              <View style={[styles.metaBadge, { flexDirection: "row", alignItems: "center", gap: 5 }]}>
                <BeatPulse bpm={bpm} size={8} />
                <Text style={styles.metaText}>{Math.round(bpm)} BPM</Text>
              </View>
            )}
            {track.energy !== null && (
              <View style={styles.metaBadge}>
                <Text style={styles.metaText}>Energy {Math.round((track.energy ?? 0) * 100)}%</Text>
              </View>
            )}
            {!!track.genre && (
              <View style={styles.metaBadge}>
                <Text style={styles.metaText}>{track.genre}</Text>
              </View>
            )}
            {!!track.mood && (
              <View style={[styles.metaBadge, { backgroundColor: "#1a0a2e" }]}>
                <Text style={[styles.metaText, { color: "#c084fc" }]}>{track.mood}</Text>
              </View>
            )}
          </View>
          <AudioWaveform energy={track.energy} playing={true} height={28} />
          <CrowdGauge crowdState={crowdState} />
        </>
      ) : (
        <>
          <Text style={styles.nowPlayingTrack}>🎵 Track loading...</Text>
          <CrowdGauge crowdState={crowdState} />
        </>
      )}
        </View>
      </View>
    </View>
  );
}

function CrowdStateBadge({ crowdState }: { crowdState: string }) {
  const COLOR: Record<string, string> = {
    WARMUP:   "#3b82f6",
    RISING:   "#f59e0b",
    PEAK:     "#ef4444",
    FATIGUE:  "#f97316",
    RECOVERY: "#8b5cf6",
    COOLDOWN: "#6b7280",
  };
  const color = COLOR[crowdState] ?? "#555";
  return (
    <View style={[styles.crowdStateBadge, { borderColor: color + "55", backgroundColor: color + "22" }]}>
      <Text style={[styles.crowdStateText, { color }]}>{crowdState}</Text>
    </View>
  );
}

// ─── Queue Item Row ───────────────────────────────────────────────────────────

function QueueItemRow({ item, position, voted, onVoteUp, onPress }: {
  item: QueueItem;
  position: number;
  voted: boolean;
  onVoteUp: () => void;
  onPress?: () => void;
}) {
  const isOptimistic = item.id.startsWith("optimistic:");
  const vibeColor =
    item.vibeDistanceScore === undefined ? "#333"
    : item.vibeDistanceScore > 0.6      ? "#ef4444"
    : item.vibeDistanceScore > 0.3      ? "#f59e0b"
                                        : "#22c55e";

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={!isOptimistic ? onPress : undefined}
      style={[styles.queueItem, isOptimistic && styles.queueItemOptimistic]}
    >
      <Text style={styles.queuePosition}>{position + 1}</Text>
      {item.track.artworkUrl ? (
        <Image source={{ uri: item.track.artworkUrl }} style={styles.queueArt} />
      ) : (
        <View style={[styles.queueArt, styles.queueArtPlaceholder]} />
      )}
      <View style={styles.queueInfo}>
        <Text style={[styles.queueTitle, isOptimistic && { opacity: 0.5 }]} numberOfLines={1}>
          {item.track.title}
        </Text>
        <Text style={styles.queueArtist} numberOfLines={1}>
          {isOptimistic ? "Adding..." : item.track.artist}
          {item.track.bpm && !isOptimistic ? `  ·  ${Math.round(item.track.bpm)} BPM` : ""}
        </Text>
      </View>
      <View style={[styles.vibeIndicator, { backgroundColor: vibeColor }]} />
      <TouchableOpacity
        onPress={onVoteUp}
        style={styles.voteButton}
        disabled={voted || isOptimistic}
      >
        <Text style={[styles.voteText, voted && styles.voteTextVoted]}>
          ▲ {item.votes > 0 ? item.votes : ""}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: "#0a0a0a" },

  // Now Playing
  nowPlaying:        { padding: 20, borderBottomWidth: 1, borderBottomColor: "#1a1a1a" },
  nowPlayingTop:     { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  nowPlayingArt:     { width: 80, height: 80, borderRadius: 8 },
  nowPlayingArtPlaceholder: { backgroundColor: "#1a1a1a", alignItems: "center", justifyContent: "center" },
  nowPlayingLabel:   { fontSize: 10, color: "#6c47ff", fontWeight: "700", letterSpacing: 2, marginBottom: 4 },
  nowPlayingEmpty:   { fontSize: 16, color: "#444", fontStyle: "italic" },
  nowPlayingTrack:   { fontSize: 18, color: "#fff", fontWeight: "700" },
  nowPlayingArtist:  { fontSize: 13, color: "#888", marginTop: 2 },
  nowPlayingMeta:    { flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" },
  metaBadge:         { backgroundColor: "#1a1a1a", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  metaText:          { color: "#aaa", fontSize: 11, fontWeight: "600" },
  crowdStateBadge:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  crowdStateText:    { fontSize: 11, fontWeight: "700" },

  // Queue
  sectionLabel:      { paddingHorizontal: 20, paddingVertical: 12, fontSize: 10, color: "#444", fontWeight: "700", letterSpacing: 2 },
  list:              { flex: 1 },
  emptyWrap:  { alignItems: "center", paddingVertical: 48, gap: 8 },
  emptyIcon:  { fontSize: 48, opacity: 0.4 },
  emptyTitle: { color: "#6b7280", fontSize: 16, fontWeight: "700" },
  emptyText:  { color: "#4b5563", fontSize: 13, textAlign: "center", paddingHorizontal: 32 },
  queueItem:         { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#111" },
  queuePosition:     { color: "#444", width: 24, fontSize: 13 },
  queueArt:          { width: 40, height: 40, borderRadius: 6, marginRight: 10 },
  queueArtPlaceholder: { backgroundColor: "#1a1a1a" },
  queueInfo:         { flex: 1 },
  queueTitle:        { color: "#fff", fontWeight: "600", fontSize: 15 },
  queueArtist:       { color: "#666", fontSize: 12, marginTop: 2 },
  vibeIndicator:     { width: 6, height: 6, borderRadius: 3, marginHorizontal: 12 },
  queueItemOptimistic: { opacity: 0.6 },
  voteButton:        { padding: 8 },
  voteText:          { color: "#6c47ff", fontSize: 16, fontWeight: "700" },
  voteTextVoted:     { color: "#22c55e" },

  // Search results dropdown
  resultsDropdown:   { position: "absolute", bottom: 72, left: 16, right: 16, backgroundColor: "#141414", borderRadius: 12, borderWidth: 1, borderColor: "#2a2a2a", overflow: "hidden", zIndex: 10, maxHeight: 280 },
  resultRow:         { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#1e1e1e" },
  resultInfo:        { flex: 1 },
  resultTitle:       { color: "#fff", fontSize: 14, fontWeight: "600" },
  resultArtist:      { color: "#666", fontSize: 12, marginTop: 1 },
  resultBpm:         { color: "#6c47ff", fontSize: 12, fontWeight: "600", marginLeft: 8 },

  // Request bar
  requestBar:        { flexDirection: "row", padding: 16, borderTopWidth: 1, borderTopColor: "#1a1a1a", gap: 10 },
  libraryBtn:        { width: 44, height: 44, borderRadius: 12, backgroundColor: "#1DB95422", borderWidth: 1, borderColor: "#1DB95455", alignItems: "center", justifyContent: "center" },
  libraryBtnText:    { fontSize: 20 },
  inputWrapper:      { flex: 1, position: "relative", justifyContent: "center" },
  requestInput:      { backgroundColor: "#111", color: "#fff", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, paddingRight: 40, fontSize: 15, borderWidth: 1, borderColor: "#222" },
  searchSpinner:     { position: "absolute", right: 12 },
  requestButton:     { backgroundColor: "#6c47ff", borderRadius: 12, paddingHorizontal: 20, justifyContent: "center" },
  buttonDisabled:    { opacity: 0.4 },
  requestButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  // Booth
  boothToggle: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  boothToggleText: { color: "#4b5563", fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  boothWrap: { paddingHorizontal: 16, paddingBottom: 8 },

  // Emote
  emoteToggle: {
    position:        "absolute",
    bottom:          80,
    right:           16,
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: "rgba(124,58,237,0.85)",
    alignItems:      "center",
    justifyContent:  "center",
    elevation:       6,
    shadowColor:     "#7c3aed",
    shadowOpacity:   0.5,
    shadowRadius:    8,
    shadowOffset:    { width: 0, height: 3 },
  },
  emoteToggleText: { fontSize: 22 },
});
