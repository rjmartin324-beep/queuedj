import React, { useRef, useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  Animated, Dimensions, Platform, ScrollView, ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRoom } from "../../contexts/RoomContext";
import { socketManager } from "../../lib/socket";

const SW = Dimensions.get("window").width;
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

export interface LaunchGame {
  id: string;
  title: string;
  tagline: string;
  emoji: string;
  routeId?: string;   // if set, has a standalone screen at /games/[routeId]
  description?: string;
  rules?: string[];
  players?: string;
}

interface Props {
  game: LaunchGame | null;
  visible: boolean;
  onClose: () => void;
}

export function GameLaunchModal({ game, visible, onClose }: Props) {
  const router   = useRouter();
  const { state, dispatch } = useRoom();
  const [creating, setCreating] = useState(false);
  const slideY = useRef(new Animated.Value(500)).current;
  const bgOp   = useRef(new Animated.Value(0)).current;
  const scale  = useRef(new Animated.Value(0.95)).current;

  const inRoom = !!state.room;
  const isHost = inRoom && state.members.find(m => m.guestId === state.guestId)?.role === "HOST";

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideY, { toValue: 0,    useNativeDriver: true, damping: 20, stiffness: 160 }),
        Animated.spring(scale,  { toValue: 1,    useNativeDriver: true, damping: 18, stiffness: 140 }),
        Animated.timing(bgOp,   { toValue: 1,    useNativeDriver: true, duration: 220 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideY, { toValue: 500,  useNativeDriver: true, duration: 240 }),
        Animated.timing(scale,  { toValue: 0.95, useNativeDriver: true, duration: 200 }),
        Animated.timing(bgOp,   { toValue: 0,    useNativeDriver: true, duration: 180 }),
      ]).start();
      // Reset creating state when modal closes
      setCreating(false);
    }
  }, [visible]);

  if (!game) return null;

  // ── Solo / Pass & Play ────────────────────────────────────────────────────
  function launchSolo() {
    onClose();
    if (game!.routeId) {
      setTimeout(() => router.push(`/games/${game!.routeId}` as any), 260);
    }
  }

  // ── Play in a Party Room ──────────────────────────────────────────────────
  async function launchParty() {
    // Already in a room — navigate directly to the game screen
    if (inRoom) {
      onClose();
      if (game!.routeId) {
        setTimeout(() => router.push(`/games/${game!.routeId}` as any), 260);
      }
      return;
    }

    // Not in a room — create one, then open the host screen
    setCreating(true);
    try {
      const guestId     = await socketManager.getOrCreateGuestId();
      const displayName = (await socketManager.getDisplayName()) ?? "Host";

      const socketPromise = Promise.race([
        socketManager.connect(guestId, displayName),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
      ]).catch(() => null);

      let roomId: string;
      let roomData: any;

      const controller  = new AbortController();
      const fetchTimeout = setTimeout(() => controller.abort(), 4000);
      try {
        const res = await fetch(`${API_URL}/rooms`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hostGuestId: guestId, name: "My Party", vibePreset: "open" }),
          signal: controller.signal,
        });
        clearTimeout(fetchTimeout);
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        roomData = data.room;
        roomId   = data.room.id;
        await socketPromise;
        await socketManager.joinRoom(roomId).catch(() => {});
      } catch {
        clearTimeout(fetchTimeout);
        // Offline / demo mode — no server needed
        const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
        roomId   = `demo_${rand}`;
        roomData = {
          id: roomId, code: rand.slice(0, 4), hostGuestId: guestId,
          name: "My Party", vibePreset: "open", crowdState: "WARMUP",
          isLive: true, isBathroomBreakActive: false,
          createdAt: Date.now(), memberCount: 1, sequenceId: 0,
        };
        dispatch({ type: "SET_OFFLINE", isOffline: true });
      }

      dispatch({ type: "SET_ROOM",     room: roomData });
      dispatch({ type: "SET_GUEST_ID", guestId, role: "HOST" });

      onClose();
      setTimeout(() => router.push(`/host/${roomId}` as any), 260);
    } catch {
      // silently fail — leave modal open so user can try again
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: bgOp }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideY }, { scale }] }]}>
        <LinearGradient colors={["#0f0028", "#080018"]} style={StyleSheet.absoluteFill} />
        <View style={[styles.topAccent, { borderTopColor: "rgba(167,139,250,0.35)" }]} />

        {/* Drag handle */}
        <View style={styles.handle} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          bounces={false}
        >
          {/* ── Game identity ── */}
          <View style={styles.gameInfo}>
            <View style={styles.gameIconWrap}>
              <LinearGradient colors={["#2a0060", "#1a0040"]} style={styles.gameIcon}>
                <Text style={styles.gameEmoji}>{game.emoji}</Text>
              </LinearGradient>
            </View>
            <View style={styles.gameMeta}>
              <Text style={styles.gameTitle}>{game.title}</Text>
              <Text style={styles.gameTagline}>{game.tagline}</Text>
              {game.players && (
                <View style={styles.playersPill}>
                  <Text style={styles.playersText}>👥 {game.players}</Text>
                </View>
              )}
            </View>
          </View>

          {/* ── Description ── */}
          {!!game.description && (
            <View style={styles.descBox}>
              <Text style={styles.descLabel}>ABOUT THIS GAME</Text>
              <Text style={styles.descText}>{game.description}</Text>
            </View>
          )}

          {/* ── How to play ── */}
          {!!game.rules?.length && (
            <View style={styles.rulesBox}>
              <View style={styles.rulesHeader}>
                <View style={styles.rulesHeaderLine} />
                <Text style={styles.rulesLabel}>HOW TO PLAY</Text>
                <View style={styles.rulesHeaderLine} />
              </View>
              {game.rules.map((rule, i) => (
                <View key={i} style={styles.ruleRow}>
                  <LinearGradient
                    colors={["#7c3aed", "#a855f7"]}
                    style={styles.ruleNum}
                  >
                    <Text style={styles.ruleNumText}>{i + 1}</Text>
                  </LinearGradient>
                  <Text style={styles.ruleText}>{rule}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── Divider ── */}
          <View style={styles.divider} />

          {/* ── Mode label ── */}
          <Text style={styles.chooseLabel}>HOW DO YOU WANT TO PLAY?</Text>

          {/* ── Option cards ── */}
          <View style={styles.options}>

            {/* Solo / Pass & Play */}
            <TouchableOpacity
              style={[styles.optionCard, !game.routeId && styles.optionCardDisabled]}
              activeOpacity={game.routeId ? 0.82 : 1}
              onPress={game.routeId ? launchSolo : undefined}
            >
              <LinearGradient
                colors={game.routeId
                  ? ["rgba(124,58,237,0.20)", "rgba(76,29,149,0.12)"]
                  : ["rgba(40,40,40,0.20)", "rgba(20,20,20,0.12)"]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              />
              <View style={[styles.optionBorder, { borderColor: game.routeId ? "rgba(167,139,250,0.30)" : "rgba(80,80,80,0.20)" }]} />
              <Text style={[styles.optionEmoji, !game.routeId && { opacity: 0.4 }]}>📱</Text>
              <View style={styles.optionText}>
                <Text style={[styles.optionTitle, !game.routeId && { color: "#555" }]}>Solo / Pass & Play</Text>
                <Text style={[styles.optionDesc, !game.routeId && { color: "#3a3a3a" }]}>
                  {game.routeId
                    ? "Play on one device, pass it around. No room needed."
                    : "This game requires a party room to play."}
                </Text>
              </View>
              {game.routeId ? (
                <View style={styles.optionArrow}>
                  <Text style={styles.optionArrowText}>›</Text>
                </View>
              ) : (
                <View style={styles.lockedBadge}>
                  <Text style={styles.lockedText}>Room only</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Party Room */}
            <TouchableOpacity
              style={styles.optionCard}
              activeOpacity={0.82}
              onPress={launchParty}
              disabled={creating}
            >
              <LinearGradient
                colors={["rgba(181,23,158,0.22)", "rgba(109,40,217,0.14)"]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              />
              <View style={[styles.optionBorder, { borderColor: "rgba(240,171,252,0.30)" }]} />
              <Text style={styles.optionEmoji}>🎉</Text>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>
                  {inRoom ? "Play in Current Room" : "Start a Party Room"}
                </Text>
                <Text style={styles.optionDesc}>
                  {inRoom
                    ? "Everyone on their own phone. Real-time multiplayer."
                    : "Create a room, share the code. Everyone plays live."}
                </Text>
              </View>
              {creating ? (
                <ActivityIndicator color="#a78bfa" size="small" />
              ) : inRoom ? (
                <View style={styles.liveChip}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              ) : (
                <View style={styles.optionArrow}>
                  <Text style={styles.optionArrowText}>›</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Cancel */}
          <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.70)",
  },

  sheet: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    maxHeight: "90%",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingBottom: Platform.OS === "ios" ? 44 : 28,
    overflow: "hidden",
  },
  topAccent: {
    position: "absolute", top: 0, left: 0, right: 0,
    borderTopWidth: 1,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
  },

  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignSelf: "center",
    marginTop: 14, marginBottom: 6,
  },

  scrollContent: {
    paddingBottom: 8,
  },

  // Game identity
  gameInfo: {
    flexDirection: "row", alignItems: "center", gap: 16,
    paddingHorizontal: 24, paddingVertical: 18,
  },
  gameIconWrap: {
    borderRadius: 18, overflow: "hidden",
    shadowColor: "#a78bfa", shadowOpacity: 0.4,
    shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
    ...Platform.select({ android: { elevation: 6 } }),
  },
  gameIcon: {
    width: 64, height: 64, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(167,139,250,0.25)",
  },
  gameEmoji:   { fontSize: 32 },
  gameMeta:    { flex: 1, gap: 4 },
  gameTitle:   { color: "#fff", fontSize: 22, fontWeight: "900", letterSpacing: -0.3 },
  gameTagline: { color: "#6b7fa0", fontSize: 14, fontWeight: "500" },
  playersPill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(167,139,250,0.12)",
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3,
    marginTop: 2,
  },
  playersText: { color: "#a78bfa", fontSize: 11, fontWeight: "700" },

  // Description
  descBox: {
    marginHorizontal: 24, marginBottom: 16,
    backgroundColor: "rgba(124,58,237,0.07)",
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: "rgba(167,139,250,0.18)",
  },
  descLabel: { color: "#7c3aed", fontSize: 9, fontWeight: "900", letterSpacing: 1.6, marginBottom: 6 },
  descText: { color: "#c4b5fd", fontSize: 13, lineHeight: 20 },

  // Rules
  rulesBox: {
    marginHorizontal: 24, marginBottom: 18,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: "rgba(167,139,250,0.12)",
  },
  rulesHeader: {
    flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14,
  },
  rulesHeaderLine: {
    flex: 1, height: 1, backgroundColor: "rgba(167,139,250,0.20)",
  },
  rulesLabel: {
    color: "#a78bfa", fontSize: 10, fontWeight: "900", letterSpacing: 1.8,
  },
  ruleRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 10 },
  ruleNum: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  ruleNumText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  ruleText:    { color: "#d1d5db", fontSize: 13, lineHeight: 19, flex: 1, paddingTop: 3 },

  divider: {
    height: 1, marginHorizontal: 24,
    backgroundColor: "rgba(167,139,250,0.12)",
    marginBottom: 0,
  },

  chooseLabel: {
    color: "#4a5568", fontSize: 11, fontWeight: "700", letterSpacing: 1.2,
    paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12,
  },

  // Options
  options: { paddingHorizontal: 16, gap: 10 },

  optionCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    borderRadius: 18, padding: 16, overflow: "hidden",
    minHeight: 80,
  },
  optionBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18, borderWidth: 1,
  },
  optionEmoji:  { fontSize: 28, width: 36, textAlign: "center" },
  optionText:   { flex: 1, gap: 3 },
  optionTitle:  { color: "#fff", fontSize: 16, fontWeight: "800" },
  optionDesc:   { color: "#6b7fa0", fontSize: 12, fontWeight: "500", lineHeight: 17 },
  optionArrow:  { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  optionArrowText: { color: "#a78bfa", fontSize: 18, fontWeight: "700", marginTop: -2 },

  // Live badge
  liveChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(34,197,94,0.15)", borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: "rgba(34,197,94,0.3)",
  },
  liveDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: "#4ade80" },
  liveText: { color: "#4ade80", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },

  cancelBtn: { alignItems: "center", paddingVertical: 18 },
  cancelText: { color: "#4a5568", fontSize: 15, fontWeight: "600" },

  optionCardDisabled: { opacity: 0.6 },
  lockedBadge: {
    backgroundColor: "rgba(80,80,80,0.25)",
    borderRadius: 10, borderWidth: 1, borderColor: "rgba(80,80,80,0.3)",
    paddingHorizontal: 10, paddingVertical: 4,
  },
  lockedText: { color: "#555", fontSize: 11, fontWeight: "700" },
});
