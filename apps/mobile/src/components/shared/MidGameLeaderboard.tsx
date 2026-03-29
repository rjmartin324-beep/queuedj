import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated, Modal, ScrollView } from "react-native";
import { SessionLeaderboard } from "./SessionLeaderboard";

// ─────────────────────────────────────────────────────────────────────────────
// Mid-Game Leaderboard slide-up sheet
// Shown when guest taps the 🏆 FAB during an active game.
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  roomId: string;
}

export function MidGameLeaderboard({ visible, onClose, roomId }: Props) {
  const slideY = useRef(new Animated.Value(400)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideY, { toValue: 400, duration: 250, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!roomId) return null;

  return (
    <Modal transparent visible={visible} onRequestClose={onClose} animationType="none">
      <Animated.View style={[s.backdrop, { opacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      <Animated.View style={[s.sheet, { transform: [{ translateY: slideY }] }]}>
        {/* Handle + header */}
        <View style={s.handle} />
        <View style={s.header}>
          <Text style={s.title}>🏆 Session Standings</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={s.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.subtitle}>Cumulative scores across all games this session</Text>

        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
          <SessionLeaderboard roomId={roomId} pollMs={30_000} limit={20} />
          <View style={s.bottomSpacer} />
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#0d0d1e",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingTop: 12,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "center",
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  title:    { color: "#fff", fontSize: 18, fontWeight: "900" },
  closeBtn: { color: "#6b7280", fontSize: 16, fontWeight: "700" },
  subtitle: { color: "#6b7280", fontSize: 12, paddingHorizontal: 20, marginBottom: 16 },
  scroll:   { flex: 1, paddingHorizontal: 16 },
  bottomSpacer: { height: 32 },
});
