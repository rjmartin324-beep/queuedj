import React, { useState } from "react";
import {
  View, Text, FlatList, TextInput,
  TouchableOpacity, StyleSheet, Alert,
} from "react-native";
import { useRoom } from "../../../contexts/RoomContext";
import type { QueueItem } from "@partyglue/shared-types";
import { socketManager } from "../../../lib/socket";

// ─────────────────────────────────────────────────────────────────────────────
// DJ Queue View — shown to all guests while DJ experience is active
//
// Guests can: see now playing, see queue, request tracks, vote
// HOST also sees this — host view is overlaid on top in HostScreen
// ─────────────────────────────────────────────────────────────────────────────

export function DJQueueView() {
  const { state, sendAction } = useRoom();
  const [searchText, setSearchText] = useState("");
  const [requesting, setRequesting] = useState(false);

  const nowPlaying = state.djState?.nowPlaying;
  const crowdState = state.room?.crowdState ?? "WARMUP";

  async function requestTrack() {
    if (!searchText.trim()) return;
    setRequesting(true);
    try {
      const socket = socketManager.get();
      if (!socket || !state.room) return;

      socket.emit("queue:request", {
        roomId: state.room.id,
        guestId: state.guestId!,
        isrc: `manual:${Date.now()}`, // Placeholder — real ISRC lookup in Phase 2
        title: searchText.trim(),
        artist: "Unknown",
        durationMs: 180000,
        sourcePlatform: "local",
      }, (ack) => {
        if (ack.accepted) {
          setSearchText("");
          Alert.alert("✅ Added to queue!");
        } else {
          const msg = ack.guardrailResult?.vibeDistanceScore ?? 0 > 0.7
            ? `That track doesn't fit the vibe right now.\n${ack.guardrailResult?.alternativePositionSuggestion ?? ""}`
            : "Could not add track";
          Alert.alert("Not added", msg);
        }
        setRequesting(false);
      });
    } catch {
      setRequesting(false);
    }
  }

  function voteUp(itemId: string) {
    sendAction("vote:cast", { targetItemId: itemId, vote: "up" });
  }

  return (
    <View style={styles.container}>

      {/* Now Playing */}
      <View style={styles.nowPlaying}>
        <Text style={styles.nowPlayingLabel}>NOW PLAYING</Text>
        <Text style={styles.nowPlayingTrack}>
          {state.djState?.nowPlaying ? "🎵 Track loaded" : "Waiting for host..."}
        </Text>
        <View style={styles.crowdStateBadge}>
          <Text style={styles.crowdStateText}>{crowdState}</Text>
        </View>
      </View>

      {/* Queue */}
      <Text style={styles.sectionLabel}>UP NEXT ({state.queue.length})</Text>
      <FlatList
        data={state.queue}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <QueueItemRow item={item} position={index} onVoteUp={() => voteUp(item.id)} />
        )}
        style={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Queue is empty — request a track below</Text>
        }
      />

      {/* Request */}
      <View style={styles.requestBar}>
        <TextInput
          style={styles.requestInput}
          placeholder="Request a song..."
          placeholderTextColor="#555"
          value={searchText}
          onChangeText={setSearchText}
          returnKeyType="send"
          onSubmitEditing={requestTrack}
        />
        <TouchableOpacity
          style={[styles.requestButton, !searchText && styles.buttonDisabled]}
          onPress={requestTrack}
          disabled={!searchText || requesting}
        >
          <Text style={styles.requestButtonText}>{requesting ? "..." : "Add"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function QueueItemRow({ item, position, onVoteUp }: {
  item: QueueItem;
  position: number;
  onVoteUp: () => void;
}) {
  const vibeColor = item.vibeDistanceScore !== undefined
    ? item.vibeDistanceScore > 0.6 ? "#ff4444"
    : item.vibeDistanceScore > 0.3 ? "#ffaa00"
    : "#44ff88"
    : "#333";

  return (
    <View style={styles.queueItem}>
      <Text style={styles.queuePosition}>{position + 1}</Text>
      <View style={styles.queueInfo}>
        <Text style={styles.queueTitle} numberOfLines={1}>{item.track.title}</Text>
        <Text style={styles.queueArtist} numberOfLines={1}>{item.track.artist}</Text>
      </View>
      <View style={[styles.vibeIndicator, { backgroundColor: vibeColor }]} />
      <TouchableOpacity onPress={onVoteUp} style={styles.voteButton}>
        <Text style={styles.voteText}>▲</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: "#0a0a0a" },
  nowPlaying:      { padding: 20, borderBottomWidth: 1, borderBottomColor: "#1a1a1a" },
  nowPlayingLabel: { fontSize: 10, color: "#6c47ff", fontWeight: "700", letterSpacing: 2 },
  nowPlayingTrack: { fontSize: 18, color: "#fff", fontWeight: "700", marginTop: 4 },
  crowdStateBadge: { marginTop: 8, alignSelf: "flex-start", backgroundColor: "#1a1a1a", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  crowdStateText:  { color: "#888", fontSize: 11, fontWeight: "600" },
  sectionLabel:    { paddingHorizontal: 20, paddingVertical: 12, fontSize: 10, color: "#444", fontWeight: "700", letterSpacing: 2 },
  list:            { flex: 1 },
  emptyText:       { textAlign: "center", color: "#444", padding: 40, fontSize: 14 },
  queueItem:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#111" },
  queuePosition:   { color: "#444", width: 24, fontSize: 13 },
  queueInfo:       { flex: 1, marginLeft: 8 },
  queueTitle:      { color: "#fff", fontWeight: "600", fontSize: 15 },
  queueArtist:     { color: "#666", fontSize: 12, marginTop: 2 },
  vibeIndicator:   { width: 6, height: 6, borderRadius: 3, marginHorizontal: 12 },
  voteButton:      { padding: 8 },
  voteText:        { color: "#6c47ff", fontSize: 16, fontWeight: "700" },
  requestBar:      { flexDirection: "row", padding: 16, borderTopWidth: 1, borderTopColor: "#1a1a1a", gap: 10 },
  requestInput:    { flex: 1, backgroundColor: "#111", color: "#fff", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, borderWidth: 1, borderColor: "#222" },
  requestButton:   { backgroundColor: "#6c47ff", borderRadius: 12, paddingHorizontal: 20, justifyContent: "center" },
  buttonDisabled:  { opacity: 0.4 },
  requestButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
