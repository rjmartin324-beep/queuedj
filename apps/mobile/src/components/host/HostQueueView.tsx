import React, { useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Audio } from "expo-av";
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useRoom } from "../../contexts/RoomContext";
import { socketManager } from "../../lib/socket";
import { audioEngine } from "../../lib/engines/audioEngineSingleton";
import type { QueueItem } from "@queuedj/shared-types";

// ─────────────────────────────────────────────────────────────────────────────
// HostQueueView — drag-and-drop queue reordering for the host
//
// When a drag ends, emits queue:reorder to the server.
// The server reorders and broadcasts the updated queue to all guests.
// ─────────────────────────────────────────────────────────────────────────────

export function HostQueueView() {
  const { state, dispatch } = useRoom();

  function onDragEnd({ data, from, to }: { data: QueueItem[]; from: number; to: number }) {
    if (from === to) return;
    const socket = socketManager.get();
    if (!socket || !state.room) return;

    // Tell the server the new position (1-indexed to match position field)
    const movedItem = data[to];
    socket.emit("queue:reorder" as any, {
      roomId:      state.room.id,
      itemId:      movedItem.id,
      newPosition: to + 1,
    });
  }

  function removeItem(itemId: string) {
    // Local remove always works
    dispatch({ type: "SET_QUEUE", queue: state.queue.filter(q => q.id !== itemId) });
    // Also tell server if online
    const socket = socketManager.get();
    if (socket && state.room) {
      socket.emit("queue:remove" as any, { roomId: state.room.id, itemId });
    }
  }

  async function loadToDeck(item: QueueItem, deckId: "A" | "B") {
    const uri = (item.track as any).previewUrl ?? (item.track as any).uri;
    if (uri) {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {});
      await audioEngine.loadTrack(deckId, uri).catch(() => {});
    }
    // Tell server if online so guests see "now playing"
    const socket = socketManager.get();
    if (socket && state.room) {
      socket.emit("deck:command" as any, {
        roomId: state.room.id,
        guestId: "host",
        deck: deckId,
        command: "cue",
      });
    }
  }

  const renderItem = useCallback(({ item, drag, isActive, getIndex }: RenderItemParams<QueueItem>) => {
    const index = getIndex() ?? 0;
    const vibeScore = item.vibeDistanceScore;
    const vibeColor = vibeScore !== undefined
      ? vibeScore > 0.6 ? "#ef4444"
      : vibeScore > 0.3 ? "#f59e0b"
      : "#22c55e"
      : "#333";
    const vibeLabel = vibeScore !== undefined
      ? vibeScore > 0.6 ? "⚠" : vibeScore > 0.3 ? "~" : "✓"
      : "";

    return (
      <ScaleDecorator>
        <View style={[styles.row, isActive && styles.rowActive]}>
          {/* Drag handle */}
          <TouchableOpacity onLongPress={drag} style={styles.handle}>
            <Text style={styles.handleIcon}>⠿</Text>
          </TouchableOpacity>

          <Text style={styles.position}>{index + 1}</Text>

          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={1}>{item.track.title}</Text>
            <Text style={styles.artist} numberOfLines={1}>{item.track.artist}</Text>
          </View>

          {/* BPM badge if available */}
          {item.track.bpm && (
            <Text style={styles.bpm}>{Math.round(item.track.bpm)}</Text>
          )}

          <View style={[styles.vibePill, { borderColor: vibeColor + "66", backgroundColor: vibeColor + "22" }]}>
            <Text style={[styles.vibePillText, { color: vibeColor }]}>{vibeLabel}</Text>
          </View>

          {/* Load to deck buttons */}
          <TouchableOpacity onPress={() => loadToDeck(item, "A")} style={styles.deckLoadBtn}>
            <Text style={styles.deckLoadText}>A</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => loadToDeck(item, "B")} style={[styles.deckLoadBtn, styles.deckLoadBtnB]}>
            <Text style={styles.deckLoadText}>B</Text>
          </TouchableOpacity>

          {/* Remove */}
          <TouchableOpacity onPress={() => removeItem(item.id)} style={styles.removeBtn}>
            <Text style={styles.removeIcon}>✕</Text>
          </TouchableOpacity>
        </View>
      </ScaleDecorator>
    );
  }, [state.room]);

  if (state.queue.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Queue is empty</Text>
        <Text style={styles.emptyHint}>Guests can request tracks from their phones</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <DraggableFlatList
        data={state.queue}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onDragEnd={onDragEnd}
        containerStyle={styles.list}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1 },
  list:       { flex: 1 },
  row:        { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: "#111", gap: 8, backgroundColor: "#0a0a0a" },
  rowActive:  { backgroundColor: "#1a1a2e", borderRadius: 10 },
  handle:     { padding: 8 },
  handleIcon: { color: "#444", fontSize: 18 },
  position:   { color: "#444", fontSize: 12, width: 20, textAlign: "center" },
  info:       { flex: 1 },
  title:      { color: "#fff", fontSize: 14, fontWeight: "600" },
  artist:     { color: "#666", fontSize: 12, marginTop: 2 },
  bpm:        { color: "#6c47ff", fontSize: 12, fontWeight: "700", width: 36, textAlign: "right" },
  vibePill:     { borderRadius: 6, borderWidth: 1, paddingHorizontal: 5, paddingVertical: 2, minWidth: 20, alignItems: "center" },
  vibePillText: { fontSize: 10, fontWeight: "800" },
  deckLoadBtn:  { backgroundColor: "#6c47ff22", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 4, borderWidth: 1, borderColor: "#6c47ff55" },
  deckLoadBtnB: { backgroundColor: "#06b6d422", borderColor: "#06b6d455" },
  deckLoadText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  removeBtn:    { padding: 8 },
  removeIcon:   { color: "#555", fontSize: 13 },
  empty:      { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 40 },
  emptyText:  { color: "#fff", fontSize: 16, fontWeight: "600" },
  emptyHint:  { color: "#555", fontSize: 13, textAlign: "center" },
});
