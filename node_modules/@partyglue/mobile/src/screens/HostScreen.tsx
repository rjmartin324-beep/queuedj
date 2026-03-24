import React, { useState } from "react";
import {
  View, Text, StyleSheet, SafeAreaView,
  ScrollView, TouchableOpacity, FlatList, Alert, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useRoom } from "../contexts/RoomContext";
import { ConnectionBar } from "../components/shared/ConnectionBar";
import { DJControls }                from "../components/host/controls/DJControls";
import { TriviaControls }            from "../components/host/controls/TriviaControls";
import { UnpopularOpinionsControls } from "../components/host/controls/UnpopularOpinionsControls";
import { ScrapbookControls }         from "../components/host/controls/ScrapbookControls";
import { GlitchControls }            from "../components/host/controls/GlitchControls";
import { CopyrightControls }         from "../components/host/controls/CopyrightControls";
import { DrawbackControls }          from "../components/host/controls/DrawbackControls";
import { ScavengerSnapControls }     from "../components/host/controls/ScavengerSnapControls";
import { GeoGuesserControls }        from "../components/host/controls/GeoGuesserControls";
import { RoomQRCode }                from "../components/host/RoomQRCode";
import { HostQueueView }             from "../components/host/HostQueueView";
import { DevTestPanel }             from "../components/host/DevTestPanel";
import type { ExperienceType } from "@partyglue/shared-types";

// ─────────────────────────────────────────────────────────────────────────────
// Host Screen
//
// Layout:
//   ┌──────────────────────────┐
//   │ Room code   Member count │  ← always visible
//   │──────────────────────────│
//   │ Experience switcher row  │  ← horizontal scroll
//   │──────────────────────────│
//   │ [Controls] [Guests]      │  ← tab bar
//   │                          │
//   │  Per-experience controls │
//   │  — or —                  │
//   │  Guest list              │
//   └──────────────────────────┘
// ─────────────────────────────────────────────────────────────────────────────

const EXPERIENCES: { type: ExperienceType; label: string; emoji: string }[] = [
  { type: "dj",                     label: "DJ",          emoji: "🎛️" },
  { type: "trivia",                 label: "Trivia",       emoji: "🧠" },
  { type: "unpopular_opinions",     label: "Opinions",     emoji: "🌶️" },
  { type: "scrapbook_sabotage",     label: "Scrapbook",    emoji: "📋" },
  { type: "the_glitch",             label: "The Glitch",   emoji: "👾" },
  { type: "copyright_infringement", label: "Copyright",    emoji: "⚖️" },
  { type: "drawback",               label: "Drawback",     emoji: "🎨" },
  { type: "scavenger_snap",         label: "Snap",         emoji: "📷" },
  { type: "geo_guesser",            label: "GeoGuesser",   emoji: "🌍" },
];

type Tab = "controls" | "queue" | "guests" | "demo";

export default function HostScreen() {
  const { state, switchExperience, dispatch } = useRoom();
  const [tab, setTab] = useState<Tab>("controls");
  const [gameViewMode, setGameViewMode] = useState<"player" | "host">("host");
  const router = useRouter();

  const roomCode = state.room?.code ?? "????";

  function handleExit() {
    if (Platform.OS === "web") {
      if (window.confirm("End Party? This will close the room for all guests.")) {
        dispatch({ type: "LEAVE_ROOM" });
        router.replace("/");
      }
    } else {
      Alert.alert(
        "End Party?",
        "This will close the room for all guests.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "End Party", style: "destructive", onPress: () => { dispatch({ type: "LEAVE_ROOM" }); router.replace("/"); } },
        ]
      );
    }
  }

  function renderControls() {
    const vmProps = { viewMode: gameViewMode, onViewModeChange: setGameViewMode };
    switch (state.activeExperience) {
      case "dj":                     return <DJControls />;
      case "trivia":                 return <TriviaControls {...vmProps} />;
      case "unpopular_opinions":     return <UnpopularOpinionsControls {...vmProps} />;
      case "scrapbook_sabotage":     return <ScrapbookControls {...vmProps} />;
      case "the_glitch":             return <GlitchControls {...vmProps} />;
      case "copyright_infringement": return <CopyrightControls {...vmProps} />;
      case "drawback":               return <DrawbackControls {...vmProps} />;
      case "scavenger_snap":         return <ScavengerSnapControls {...vmProps} />;
      case "geo_guesser":            return <GeoGuesserControls {...vmProps} />;
      default:                       return null;
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ConnectionBar isOffline={state.isOffline} memberCount={state.members.length} />

      {/* ── Room code header ──────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TouchableOpacity onPress={handleExit} style={styles.exitBtn}>
            <Text style={styles.exitArrow}>←</Text>
            <Text style={styles.exitLabel}>Exit</Text>
          </TouchableOpacity>
          {tab === "controls" && gameViewMode === "player" && (
            <TouchableOpacity onPress={() => setGameViewMode("host")} style={styles.hostCtrlBtn}>
              <Text style={styles.hostCtrlText}>🎛️ Controls</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.headerLabel}>ROOM CODE</Text>
          <Text style={styles.roomCode}>{roomCode}</Text>
        </View>
        <View style={styles.headerRight}>
          <RoomQRCode roomCode={roomCode} />
          <View style={styles.memberBadge}>
            <Text style={styles.memberCount}>{state.members.length}</Text>
            <Text style={styles.memberLabel}>guests</Text>
          </View>
        </View>
      </View>

      {/* ── Experience switcher ───────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.experienceRow}
      >
        {EXPERIENCES.map(({ type, label, emoji }) => {
          const active = state.activeExperience === type;
          return (
            <TouchableOpacity
              key={type}
              style={[styles.expBtn, active && styles.expBtnActive]}
              onPress={() => { setGameViewMode("host"); switchExperience(type); }}
            >
              <Text style={styles.expEmoji}>{emoji}</Text>
              <Text style={[styles.expLabel, active && styles.expLabelActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Tab bar ───────────────────────────────────────────────────── */}
      <View style={styles.tabBar}>
        {([
          { id: "controls", label: "Controls" },
          { id: "queue",    label: `Queue (${state.queue.length})` },
          { id: "guests",   label: `Guests (${state.members.length})` },
          { id: "demo",     label: "🧪 Demo" },
        ] as { id: Tab; label: string }[]).map(({ id, label }) => (
          <TouchableOpacity
            key={id}
            style={[styles.tabBtn, tab === id && styles.tabBtnActive]}
            onPress={() => setTab(id)}
          >
            <Text style={[styles.tabLabel, tab === id && styles.tabLabelActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Content ───────────────────────────────────────────────────── */}
      {tab === "queue" ? (
        <HostQueueView />
      ) : tab === "demo" ? (
        <DevTestPanel />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {tab === "controls" ? renderControls() : <GuestList />}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Guest List ──────────────────────────────────────────────────────────────

function GuestList() {
  const { state } = useRoom();

  if (state.members.length === 0) {
    return <Text style={guestStyles.empty}>No guests yet — share the room code!</Text>;
  }

  return (
    <>
      {state.members.map((m) => (
        <View key={m.guestId} style={guestStyles.row}>
          <View style={guestStyles.avatar}>
            <Text style={guestStyles.avatarText}>{m.guestId.slice(0, 2).toUpperCase()}</Text>
          </View>
          <View style={guestStyles.info}>
            <Text style={guestStyles.name}>{(m as any).displayName ?? m.guestId.slice(0, 8)}</Text>
            <Text style={guestStyles.role}>{m.role}</Text>
          </View>
        </View>
      ))}
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: "#0a0a0a" },
  header:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#1a1a1a" },
  exitBtn:      { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "#2a2a2a" },
  exitArrow:    { color: "#fff", fontSize: 16, fontWeight: "600" },
  exitLabel:    { color: "#fff", fontSize: 13, fontWeight: "600" },
  headerCenter: { alignItems: "center" },
  headerLabel:  { color: "#555", fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  roomCode:     { color: "#fff", fontSize: 30, fontWeight: "900", letterSpacing: 5 },
  headerRight:  { flexDirection: "row", alignItems: "center", gap: 10 },
  memberBadge:  { alignItems: "center" },
  memberCount:  { color: "#6c47ff", fontSize: 26, fontWeight: "900" },
  memberLabel:  { color: "#555", fontSize: 11 },

  experienceRow:  { paddingHorizontal: 16, paddingVertical: 12, gap: 8, flexDirection: "row" },
  expBtn:         { backgroundColor: "#1a1a1a", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, alignItems: "center", borderWidth: 1, borderColor: "#2a2a2a", minWidth: 72, gap: 4 },
  expBtnActive:   { borderColor: "#6c47ff", backgroundColor: "#1e1e2e" },
  expEmoji:       { fontSize: 20 },
  expLabel:       { color: "#666", fontSize: 11, fontWeight: "600" },
  expLabelActive: { color: "#c4b5fd" },

  tabBar:         { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#1a1a1a", paddingHorizontal: 20 },
  tabBtn:         { paddingVertical: 12, paddingHorizontal: 4, marginRight: 24, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabBtnActive:   { borderBottomColor: "#6c47ff" },
  tabLabel:       { color: "#555", fontSize: 14, fontWeight: "600" },
  tabLabelActive: { color: "#fff" },

  content:        { padding: 20, gap: 12 },

  hostCtrlBtn:  { flexDirection: "row", alignItems: "center", backgroundColor: "#2a1060", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "#6c47ff55" },
  hostCtrlText: { color: "#c4b5fd", fontSize: 13, fontWeight: "700" },
});

const guestStyles = StyleSheet.create({
  empty:   { color: "#444", fontSize: 14, textAlign: "center", marginTop: 40 },
  row:     { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#1a1a1a" },
  avatar:  { width: 40, height: 40, borderRadius: 20, backgroundColor: "#6c47ff33", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#c4b5fd", fontSize: 13, fontWeight: "700" },
  info:    { gap: 2 },
  name:    { color: "#fff", fontSize: 14, fontWeight: "600" },
  role:    { color: "#555", fontSize: 11 },
});
