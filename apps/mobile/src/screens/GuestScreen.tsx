import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform, Clipboard, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../contexts/RoomContext";
import { SessionRecapScreen, type SessionRecapData } from "./SessionRecapScreen";
import { useRouter } from "expo-router";

import { ConnectionBar }      from "../components/shared/ConnectionBar";
import { VibeCreditsBar }     from "../components/shared/VibeCreditsBar";
import { GuestAvatarRow, type GuestPresence } from "../components/shared/GuestAvatarRow";
import { OfflineBanner } from "../components/shared/OfflineBanner";
import { registerForPushNotifications, registerTokenWithServer } from "../lib/notifications";
import { tapLight, tapMedium } from "../lib/haptics";
import { PartyChatPanel, ChatFloatingButton } from "../components/shared/PartyChatPanel";
import { socketManager } from "../lib/socket";

import { ExperiencePlayerView }   from "../components/experiences/shared/ExperiencePlayerView";

// ─────────────────────────────────────────────────────────────────────────────
// Guest Screen
//
// This screen never manually navigates. The server tells it what to show
// via the "experience:state" socket event → RoomContext → guestView.
//
// To add a new experience: create a component and add a case to
// ExperiencePlayerView (components/experiences/shared/ExperiencePlayerView.tsx).
// ─────────────────────────────────────────────────────────────────────────────

const API_GUEST_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

export default function GuestScreen() {
  const { state, dispatch, sendReadyUp } = useRoom();

  const router = useRouter();
  const [recap,       setRecap]       = useState<SessionRecapData | null>(null);
  const [chatOpen,    setChatOpen]    = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Pulse animation for the ready-up button when it first activates
  const readyPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!state.readyUp.active || state.readyUp.iHaveReadied) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(readyPulse, { toValue: 1.06, duration: 600, useNativeDriver: true }),
        Animated.timing(readyPulse, { toValue: 1,    duration: 600, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [state.readyUp.active, state.readyUp.iHaveReadied]);

  const buildRecap = useCallback(async () => {
    if (!state.room || !state.guestId) return;
    const roomId = state.room.id;
    const guestId = state.guestId;

    let myVotes = 0, myRequests = 0, myGameWins = 0;
    try {
      const res = await fetch(`${API_GUEST_URL}/rooms/${encodeURIComponent(roomId)}/leaderboard`);
      if (res.ok) {
        const d = await res.json();
        const me = (d.leaderboard ?? []).find((e: any) => e.guestId === guestId);
        if (me) {
          myVotes    = me.votes    ?? 0;
          myRequests = me.requests ?? 0;
          myGameWins = me.game_wins ?? 0;
        }
      }
    } catch { /* offline */ }

    setRecap({
      roomId,
      roomName:        state.room.name,
      roomCode:        state.room.code,
      tracksPlayed:    0,
      guestCount:      state.members.length,
      topTrack:        null,
      myVotes,
      myRequests,
      myGameWins,
      myCreditsEarned: myVotes + myRequests * 2 + myGameWins * 10,
    });
  }, [state.room, state.guestId, state.members.length]);

  useEffect(() => {
    if (state.roomClosed && !recap) {
      buildRecap();
    }
  }, [state.roomClosed]);

  // Increment unread count when chat messages arrive and panel is closed
  useEffect(() => {
    const socket = socketManager.get();
    if (!socket) return;
    const handler = () => {
      if (!chatOpen) setUnreadCount(c => c + 1);
    };
    socket.on("chat:received" as any, handler);
    return () => { socket.off("chat:received" as any, handler); };
  }, [chatOpen]);

  // Register push token when joining a room
  useEffect(() => {
    const roomId = state.room?.id;
    if (!roomId) return;
    (async () => {
      const token = await registerForPushNotifications();
      if (token) {
        await registerTokenWithServer(API_GUEST_URL, roomId, token, "guest");
      } else {
        const shown = await import("@react-native-async-storage/async-storage")
          .then(m => m.default.getItem("push_denied_shown"));
        if (!shown) {
          Alert.alert(
            "Notifications Off",
            "Enable notifications in Settings so you don't miss when a party starts.",
            [{ text: "OK" }],
          );
          import("@react-native-async-storage/async-storage")
            .then(m => m.default.setItem("push_denied_shown", "1"));
        }
      }
    })();
  }, [state.room?.id]);

  if (recap) {
    return (
      <SessionRecapScreen
        recap={recap}
        onClose={() => {
          dispatch({ type: "LEAVE_ROOM" });
          router.replace("/");
        }}
      />
    );
  }

  const guestPresences: GuestPresence[] = state.members
    .filter(m => !m.isWorkerNode)
    .map(m => ({
      guestId:     m.guestId,
      displayName: m.displayName ?? m.guestId.slice(0, 8),
      isMe:        m.guestId === state.guestId,
    }));

  function handleLeave() {
    const doLeave = () => {
      dispatch({ type: "LEAVE_ROOM" });
      router.replace("/");
    };
    if (Platform.OS === "web") {
      if (window.confirm("Leave this party?")) doLeave();
    } else {
      Alert.alert("Leave Party?", "You'll need the room code to rejoin.", [
        { text: "Stay",  style: "cancel" },
        { text: "Leave", style: "destructive", onPress: doLeave },
      ]);
    }
  }

  function handleReadyUp() {
    tapMedium();
    sendReadyUp();
  }

  const roomCode    = state.room?.code ?? "";
  const gameLabel   = state.guestView && state.guestView !== "intermission"
    ? state.guestView.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    : null;

  const { active: readyActive, iHaveReadied, readyCount, totalCount } = state.readyUp;

  return (
    <View style={styles.container}>
      {/* Background */}
      <LinearGradient colors={["#03001c", "#07001a", "#0a0018"]} style={StyleSheet.absoluteFill} />

      <OfflineBanner isOffline={state.isOffline} />

      {/* Top bar */}
      <View style={styles.topBar}>
        {/* Left: Leave button */}
        <TouchableOpacity onPress={handleLeave} style={styles.leaveBtn}>
          <Text style={styles.leaveText}>✕</Text>
        </TouchableOpacity>

        {/* Center: room code + active game */}
        <View style={styles.topCenter}>
          {roomCode ? (
            <TouchableOpacity
              onPress={() => { Clipboard.setString(roomCode); tapLight(); Alert.alert("Copied!", `Room code ${roomCode} copied to clipboard.`); }}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.roomCode}>{roomCode} 📋</Text>
            </TouchableOpacity>
          ) : null}
          {gameLabel ? (
            <View style={styles.gameChip}>
              <View style={styles.liveDot} />
              <Text style={styles.gameChipText}>{gameLabel}</Text>
            </View>
          ) : null}
        </View>

        {/* Right: co-host badge + credits + ready-up button */}
        <View style={styles.topRight}>
          {state.role === "CO_HOST" && (
            <View style={styles.coHostBadge}>
              <Text style={styles.coHostText}>⭐</Text>
            </View>
          )}
          {state.guestId && <VibeCreditsBar guestId={state.guestId} compact />}

          {/* Ready-up button — always rendered, disabled until a game is active */}
          {iHaveReadied ? (
            // After tapping: show waiting state with live count
            <View style={styles.readyWaiting}>
              <Text style={styles.readyWaitingText}>
                {readyCount}/{totalCount} ✓
              </Text>
            </View>
          ) : (
            <Animated.View style={{ transform: [{ scale: readyActive ? readyPulse : 1 }] }}>
              <TouchableOpacity
                onPress={readyActive ? handleReadyUp : undefined}
                style={[styles.readyBtn, !readyActive && styles.readyBtnDisabled]}
                activeOpacity={readyActive ? 0.75 : 1}
              >
                <LinearGradient
                  colors={readyActive ? ["#7c3aed", "#a855f7"] : ["#1a1a1a", "#1a1a1a"]}
                  style={styles.readyBtnInner}
                >
                  <Text style={[styles.readyBtnText, !readyActive && styles.readyBtnTextDisabled]}>
                    {readyActive ? "Ready!" : "Ready"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </View>

      <ConnectionBar isOffline={state.isOffline} memberCount={state.members.length} />

      {state.guestView === "dj_queue" && (
        <GuestAvatarRow guests={guestPresences} maxVisible={12} />
      )}

      <ExperiencePlayerView />

      {/* Floating chat button — always visible regardless of active game */}
      <View style={styles.chatFab}>
        <ChatFloatingButton
          onPress={() => { setChatOpen(true); setUnreadCount(0); }}
          unreadCount={unreadCount}
        />
      </View>

      <PartyChatPanel
        visible={chatOpen}
        onClose={() => setChatOpen(false)}
        unreadCount={unreadCount}
        onRead={() => setUnreadCount(0)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#03001c" },

  topBar: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14, paddingTop: Platform.OS === "ios" ? 54 : 14, paddingBottom: 10,
  },

  leaveBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center",
  },
  leaveText: { color: "#6b7fa0", fontSize: 14, fontWeight: "700" },

  topCenter: { alignItems: "center", gap: 4 },
  roomCode:  { color: "rgba(167,139,250,0.7)", fontSize: 16, fontWeight: "900", letterSpacing: 3 },
  gameChip:  {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(181,23,158,0.18)", borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: "rgba(240,171,252,0.25)",
  },
  liveDot:      { width: 5, height: 5, borderRadius: 3, backgroundColor: "#f0abfc" },
  gameChipText: { color: "#f0abfc", fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },

  topRight:    { flexDirection: "row", alignItems: "center", gap: 6 },
  coHostBadge: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(245,158,11,0.15)",
    borderWidth: 1, borderColor: "rgba(245,158,11,0.35)",
    alignItems: "center", justifyContent: "center",
  },
  coHostText: { fontSize: 14 },

  // Ready-up button
  readyBtn: { borderRadius: 16, overflow: "hidden" },
  readyBtnDisabled: { opacity: 0.4 },
  readyBtnInner: { paddingHorizontal: 12, paddingVertical: 7, alignItems: "center" },
  readyBtnText: { color: "#fff", fontSize: 12, fontWeight: "900", letterSpacing: 0.3 },
  readyBtnTextDisabled: { color: "#555" },

  // After ready tapped
  readyWaiting: {
    borderRadius: 16, paddingHorizontal: 10, paddingVertical: 7,
    backgroundColor: "rgba(34,197,94,0.15)",
    borderWidth: 1, borderColor: "rgba(34,197,94,0.35)",
    alignItems: "center",
  },
  readyWaitingText: { color: "#4ade80", fontSize: 11, fontWeight: "800" },

  chatFab: {
    position: "absolute",
    bottom: 28,
    right: 16,
    zIndex: 20,
  },
});
