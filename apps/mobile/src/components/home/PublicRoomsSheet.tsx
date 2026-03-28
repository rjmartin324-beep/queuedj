import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

const VIBE_META: Record<string, { emoji: string; color: string }> = {
  open:      { emoji: "🌐", color: "#7c3aed" },
  classy:    { emoji: "🎩", color: "#b45309" },
  hype:      { emoji: "🔥", color: "#dc2626" },
  throwback: { emoji: "📼", color: "#0891b2" },
  family:    { emoji: "🏠", color: "#16a34a" },
  chill:     { emoji: "🌊", color: "#2563eb" },
};

interface PublicRoom {
  id: string;
  code: string;
  name: string;
  vibePreset: string;
  memberCount: number;
  createdAt: number;
  hostGuestId: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onJoin: (code: string) => void;
  myGuestId?: string | null;
}

export function PublicRoomsSheet({ visible, onClose, onJoin, myGuestId }: Props) {
  const [rooms, setRooms]     = useState<PublicRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/rooms/public`);
      if (!res.ok) throw new Error("Server error");
      const data = await res.json();
      setRooms(data.rooms ?? []);
    } catch {
      setError("Couldn't load rooms. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteRoom = useCallback(async (room: PublicRoom) => {
    if (!myGuestId) return;
    setDeleting(room.id);
    try {
      const res = await fetch(`${API_URL}/rooms/${room.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostGuestId: myGuestId }),
      });
      if (res.ok) {
        setRooms((prev) => prev.filter((r) => r.id !== room.id));
      }
    } catch { /* silent */ } finally {
      setDeleting(null);
    }
  }, [myGuestId]);

  useEffect(() => {
    if (visible) fetchRooms();
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />

        <View style={styles.sheet}>
          <LinearGradient colors={["#0f0a2e", "#07001a"]} style={StyleSheet.absoluteFill} />

          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Live Rooms 🌐</Text>
            <TouchableOpacity onPress={fetchRooms} style={styles.refreshBtn} disabled={loading}>
              <Text style={styles.refreshText}>{loading ? "..." : "↺"}</Text>
            </TouchableOpacity>
          </View>

          {loading && !rooms.length ? (
            <View style={styles.centerState}>
              <ActivityIndicator color="#a78bfa" size="large" />
              <Text style={styles.stateText}>Finding parties...</Text>
            </View>
          ) : error ? (
            <View style={styles.centerState}>
              <Text style={styles.stateEmoji}>📡</Text>
              <Text style={styles.stateText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={fetchRooms}>
                <Text style={styles.retryText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : rooms.length === 0 ? (
            <View style={styles.centerState}>
              <Text style={styles.stateEmoji}>🎈</Text>
              <Text style={styles.stateText}>No live rooms right now</Text>
              <Text style={styles.stateSubtext}>Start one and be the first!</Text>
            </View>
          ) : (
            <FlatList
              data={rooms}
              keyExtractor={(r) => r.id}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const vibe = VIBE_META[item.vibePreset] ?? VIBE_META.open;
                return (
                  <TouchableOpacity
                    style={styles.card}
                    onPress={() => onJoin(item.code)}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={["rgba(255,255,255,0.06)", "rgba(255,255,255,0.02)"]}
                      style={styles.cardGradient}
                    >
                      {/* Left: vibe emoji */}
                      <View style={[styles.vibeCircle, { backgroundColor: `${vibe.color}33`, borderColor: `${vibe.color}66` }]}>
                        <Text style={styles.vibeEmoji}>{vibe.emoji}</Text>
                      </View>

                      {/* Center: name + code + guests */}
                      <View style={styles.cardBody}>
                        <Text style={styles.roomName} numberOfLines={1}>{item.name}</Text>
                        <View style={styles.cardMeta}>
                          <Text style={styles.roomCode}>{item.code}</Text>
                          <View style={styles.dot} />
                          <Text style={styles.memberCount}>
                            {item.memberCount} {item.memberCount === 1 ? "guest" : "guests"}
                          </Text>
                        </View>
                      </View>

                      {/* Right: join or close (if host) */}
                      {myGuestId && item.hostGuestId === myGuestId ? (
                        <TouchableOpacity
                          style={styles.closeBtn}
                          onPress={() => deleteRoom(item)}
                          disabled={deleting === item.id}
                        >
                          <Text style={styles.closeText}>{deleting === item.id ? "..." : "✕"}</Text>
                        </TouchableOpacity>
                      ) : (
                        <LinearGradient
                          colors={["#7c3aed", "#a855f7"]}
                          style={styles.joinBtn}
                        >
                          <Text style={styles.joinText}>Join</Text>
                        </LinearGradient>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    minHeight: 360,
    maxHeight: "80%",
    paddingBottom: 34,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "center",
    marginTop: 10, marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  title:       { color: "#fff", fontSize: 18, fontWeight: "900" },
  refreshBtn:  { padding: 6 },
  refreshText: { color: "#a78bfa", fontSize: 20, fontWeight: "700" },

  centerState: { alignItems: "center", justifyContent: "center", paddingVertical: 48, gap: 10 },
  stateEmoji:  { fontSize: 40 },
  stateText:   { color: "rgba(255,255,255,0.7)", fontSize: 15, fontWeight: "600", textAlign: "center" },
  stateSubtext:{ color: "rgba(255,255,255,0.4)", fontSize: 13, textAlign: "center" },
  retryBtn:    { marginTop: 8, backgroundColor: "rgba(124,58,237,0.3)", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: "#7c3aed" },
  retryText:   { color: "#a78bfa", fontWeight: "700" },

  list: { padding: 14, gap: 10 },
  card: { borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  cardGradient: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  vibeCircle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  vibeEmoji:  { fontSize: 20 },
  cardBody:   { flex: 1, gap: 3 },
  roomName:   { color: "#fff", fontSize: 15, fontWeight: "800" },
  cardMeta:   { flexDirection: "row", alignItems: "center", gap: 6 },
  roomCode:   { color: "rgba(167,139,250,0.8)", fontSize: 12, fontWeight: "700", letterSpacing: 1.5 },
  dot:        { width: 3, height: 3, borderRadius: 1.5, backgroundColor: "rgba(255,255,255,0.3)" },
  memberCount:{ color: "rgba(255,255,255,0.5)", fontSize: 12 },
  joinBtn:    { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8 },
  joinText:   { color: "#fff", fontWeight: "800", fontSize: 13 },

  closeBtn:   { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(220,38,38,0.2)", borderWidth: 1, borderColor: "rgba(220,38,38,0.4)", alignItems: "center", justifyContent: "center" },
  closeText:  { color: "#f87171", fontWeight: "900", fontSize: 15 },
});
