import React, { useRef, useState, useEffect } from "react";
import {
  View, Text, StyleSheet, Animated,
  ScrollView, TouchableOpacity, FlatList, Alert, Platform, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRoom } from "../contexts/RoomContext";
import { ConnectionBar } from "../components/shared/ConnectionBar";
import { OfflineBanner } from "../components/shared/OfflineBanner";
import { DJControls }                from "../components/host/controls/DJControls";
import { TriviaControls }            from "../components/host/controls/TriviaControls";
import { UnpopularOpinionsControls } from "../components/host/controls/UnpopularOpinionsControls";
import { ScrapbookControls }         from "../components/host/controls/ScrapbookControls";
import { GlitchControls }            from "../components/host/controls/GlitchControls";
import { CopyrightControls }         from "../components/host/controls/CopyrightControls";
import { DrawbackControls }          from "../components/host/controls/DrawbackControls";
import { ScavengerSnapControls }     from "../components/host/controls/ScavengerSnapControls";
import { GeoGuesserControls }        from "../components/host/controls/GeoGuesserControls";
// Party game controls
import { WouldYouRatherControls }    from "../components/host/controls/WouldYouRatherControls";
import { NeverHaveIEverControls }    from "../components/host/controls/NeverHaveIEverControls";
import { TruthOrDareControls }       from "../components/host/controls/TruthOrDareControls";
import { TwoTruthsOneLieControls }   from "../components/host/controls/TwoTruthsOneLieControls";
import { CelebrityHeadControls }     from "../components/host/controls/CelebrityHeadControls";
import { ConnectionsControls }       from "../components/host/controls/ConnectionsControls";
import { WordAssociationControls }   from "../components/host/controls/WordAssociationControls";
import { ChainReactionControls }     from "../components/host/controls/ChainReactionControls";
import { FakeNewsControls }          from "../components/host/controls/FakeNewsControls";
import { EmojiStoryControls }        from "../components/host/controls/EmojiStoryControls";
import { RankItControls }            from "../components/host/controls/RankItControls";
import { SpeedRoundControls }        from "../components/host/controls/SpeedRoundControls";
import { ThumbWarControls }          from "../components/host/controls/ThumbWarControls";
import { MusicalChairsControls }     from "../components/host/controls/MusicalChairsControls";
import { PopCultureQuizControls }    from "../components/host/controls/PopCultureQuizControls";
import { WhoKnowsWhoControls }       from "../components/host/controls/WhoKnowsWhoControls";
import { AlibiControls }             from "../components/host/controls/AlibiControls";
import { CroppedLookControls }       from "../components/host/controls/CroppedLookControls";
import { MindReadingControls }       from "../components/host/controls/MindReadingControls";
import { ImprovChallengeControls }   from "../components/host/controls/ImprovChallengeControls";
import { AccentChallengeControls }   from "../components/host/controls/AccentChallengeControls";
import { HumItControls }             from "../components/host/controls/HumItControls";
import { MimicMeControls }           from "../components/host/controls/MimicMeControls";
import { LyricsDropControls }        from "../components/host/controls/LyricsDropControls";
import { PartyDiceControls }         from "../components/host/controls/PartyDiceControls";
import { RoomQRCode }                from "../components/host/RoomQRCode";
import { HostQueueView }             from "../components/host/HostQueueView";
import { DevTestPanel }             from "../components/host/DevTestPanel";
import { SpotifyConnectButton }     from "../components/host/SpotifyConnectButton";
import { InviteLinkButton }         from "../components/shared/InviteLinkButton";
import { RoomHistory }              from "../components/host/RoomHistory";
import { AIRecommendations }        from "../components/host/AIRecommendations";
import { RoomSettingsPanel }        from "../components/host/RoomSettingsPanel";
import type { ExperienceType } from "@queuedj/shared-types";
import { registerForPushNotifications, registerTokenWithServer } from "../lib/notifications";
import { socketManager } from "../lib/socket";
import { ChatTicker } from "../components/host/ChatTicker";
import { PartyChatPanel, ChatFloatingButton } from "../components/shared/PartyChatPanel";

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
  { type: "dj",                     label: "DJ",              emoji: "🎛️" },
  { type: "trivia",                 label: "Trivia",           emoji: "🧠" },
  { type: "unpopular_opinions",     label: "Opinions",         emoji: "🌶️" },
  { type: "scrapbook_sabotage",     label: "Scrapbook",        emoji: "📋" },
  { type: "the_glitch",             label: "The Glitch",       emoji: "👾" },
  { type: "copyright_infringement", label: "Copyright",        emoji: "⚖️" },
  { type: "drawback",               label: "Drawback",         emoji: "🎨" },
  { type: "scavenger_snap",         label: "Snap",             emoji: "📷" },
  { type: "geo_guesser",            label: "GeoGuesser",       emoji: "🌍" },
  // Party games
  { type: "would_you_rather",       label: "Would You Rather", emoji: "🤔" },
  { type: "never_have_i_ever",      label: "Never Have I",     emoji: "🤫" },
  { type: "truth_or_dare",          label: "Truth or Dare",    emoji: "💀" },
  { type: "two_truths_one_lie",     label: "Two Truths",       emoji: "🤥" },
  { type: "celebrity_head",         label: "Celebrity Head",   emoji: "👑" },
  { type: "connections",            label: "Connections",      emoji: "🔗" },
  { type: "word_association",       label: "Word Chain",       emoji: "💭" },
  { type: "chain_reaction",         label: "Chain Reaction",   emoji: "⚡" },
  { type: "fake_news",              label: "Fake News",        emoji: "📰" },
  { type: "emoji_story",            label: "Emoji Story",      emoji: "😂" },
  { type: "rank_it",                label: "Rank It",          emoji: "🏆" },
  { type: "speed_round",            label: "Speed Round",      emoji: "⏱️" },
  { type: "thumb_war",              label: "Thumb War",        emoji: "👍" },
  { type: "musical_chairs",         label: "Musical Chairs",   emoji: "🪑" },
  { type: "pop_culture_quiz",       label: "Pop Culture",      emoji: "🎬" },
  { type: "who_knows_who",          label: "Who Knows Who",    emoji: "👥" },
  { type: "alibi",                  label: "Alibi",            emoji: "🔍" },
  { type: "cropped_look",           label: "Cropped Look",     emoji: "🔎" },
  { type: "mind_reading",           label: "Mind Reading",     emoji: "🔮" },
  { type: "improv_challenge",       label: "Improv",           emoji: "🎭" },
  { type: "accent_challenge",       label: "Accents",          emoji: "🗣️" },
  { type: "hum_it",                 label: "Hum It",           emoji: "🎵" },
  { type: "mimic_me",               label: "Mimic Me",         emoji: "🪞" },
  { type: "lyrics_drop",            label: "Lyrics Drop",      emoji: "🎤" },
  { type: "party_dice",             label: "Party Dice",       emoji: "🎲" },
];

type Tab = "controls" | "queue" | "guests" | "history" | "recs" | "settings" | "demo";

export default function HostScreen() {
  const { state, switchExperience, dispatch } = useRoom();
  const [tab, setTab] = useState<Tab>("controls");
  const [gameViewMode, setGameViewMode] = useState<"player" | "host">("host");
  const [chatOpen,      setChatOpen]      = useState(false);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [primaryMode,   setPrimaryMode]   = useState<"dj" | "games">(
    state.activeExperience === "dj" ? "dj" : "games"
  );
  const [showAllOptions, setShowAllOptions] = useState(false);
  const router = useRouter();
  const controlsFade = useRef(new Animated.Value(1)).current;

  // Increment unread when chat message arrives and panel is closed
  useEffect(() => {
    const socket = socketManager.get();
    if (!socket) return;
    const handler = () => { if (!chatOpen) setUnreadCount(c => c + 1); };
    socket.on("chat:received" as any, handler);
    return () => { socket.off("chat:received" as any, handler); };
  }, [chatOpen]);

  // Register push token when room is created
  useEffect(() => {
    const roomId = state.room?.id;
    if (!roomId) return;
    (async () => {
      const token = await registerForPushNotifications();
      if (token) {
        await registerTokenWithServer(API_URL, roomId, token, "host");
      }
    })();
  }, [state.room?.id]);

  function switchExperienceAnimated(type: Parameters<typeof switchExperience>[0]) {
    Animated.timing(controlsFade, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      switchExperience(type);
      Animated.timing(controlsFade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    });
  }

  const roomCode = state.room?.code ?? "????";

  const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

  async function doEndRoom() {
    const roomId    = state.room?.id;
    const guestId   = state.guestId;
    if (roomId && guestId) {
      fetch(`${API_URL}/rooms/${roomId}`, {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ hostGuestId: guestId }),
      }).catch(() => {});
    }
    dispatch({ type: "LEAVE_ROOM" });
    router.replace("/");
  }

  function handleExit() {
    if (Platform.OS === "web") {
      if (window.confirm("End Party? This will close the room for all guests.")) {
        doEndRoom();
      }
    } else {
      Alert.alert(
        "End Party?",
        "This will close the room for all guests.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "End Party", style: "destructive", onPress: doEndRoom },
        ]
      );
    }
  }

  function renderControls() {
    const vmProps = { viewMode: gameViewMode, onViewModeChange: setGameViewMode };
    switch (state.activeExperience) {
      case "dj":                     return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
          <DJControls />
        </ScrollView>
      );
      case "trivia":                 return <TriviaControls {...vmProps} />;
      case "unpopular_opinions":     return <UnpopularOpinionsControls {...vmProps} />;
      case "scrapbook_sabotage":     return <ScrapbookControls {...vmProps} />;
      case "the_glitch":             return <GlitchControls {...vmProps} />;
      case "copyright_infringement": return <CopyrightControls {...vmProps} />;
      case "drawback":               return <DrawbackControls {...vmProps} />;
      case "scavenger_snap":         return <ScavengerSnapControls {...vmProps} />;
      case "geo_guesser":            return <GeoGuesserControls {...vmProps} />;
      // Party games
      case "would_you_rather":       return <WouldYouRatherControls {...vmProps} />;
      case "never_have_i_ever":      return <NeverHaveIEverControls {...vmProps} />;
      case "truth_or_dare":          return <TruthOrDareControls {...vmProps} />;
      case "two_truths_one_lie":     return <TwoTruthsOneLieControls {...vmProps} />;
      case "celebrity_head":         return <CelebrityHeadControls {...vmProps} />;
      case "connections":            return <ConnectionsControls {...vmProps} />;
      case "word_association":       return <WordAssociationControls {...vmProps} />;
      case "chain_reaction":         return <ChainReactionControls {...vmProps} />;
      case "fake_news":              return <FakeNewsControls {...vmProps} />;
      case "emoji_story":            return <EmojiStoryControls {...vmProps} />;
      case "rank_it":                return <RankItControls {...vmProps} />;
      case "speed_round":            return <SpeedRoundControls {...vmProps} />;
      case "thumb_war":              return <ThumbWarControls {...vmProps} />;
      case "musical_chairs":         return <MusicalChairsControls {...vmProps} />;
      case "pop_culture_quiz":       return <PopCultureQuizControls {...vmProps} />;
      case "who_knows_who":          return <WhoKnowsWhoControls {...vmProps} />;
      case "alibi":                  return <AlibiControls {...vmProps} />;
      case "cropped_look":           return <CroppedLookControls {...vmProps} />;
      case "mind_reading":           return <MindReadingControls {...vmProps} />;
      case "improv_challenge":       return <ImprovChallengeControls {...vmProps} />;
      case "accent_challenge":       return <AccentChallengeControls {...vmProps} />;
      case "hum_it":                 return <HumItControls {...vmProps} />;
      case "mimic_me":               return <MimicMeControls {...vmProps} />;
      case "lyrics_drop":            return <LyricsDropControls {...vmProps} />;
      case "party_dice":             return <PartyDiceControls {...vmProps} />;
      default:                       return null;
    }
  }

  const djColor    = "#7c3aed";
  const gamesColor = "#f59e0b";
  const activeColor = primaryMode === "dj" ? djColor : gamesColor;
  const activeGame = EXPERIENCES.find(e => e.type === state.activeExperience);

  return (
    <SafeAreaView style={styles.container}>
      {/* Background */}
      <LinearGradient
        colors={["#050512", "#08051a", "#0a0520"]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.headerGlow} pointerEvents="none" />

      <OfflineBanner isOffline={state.isOffline} />
      <ConnectionBar isOffline={state.isOffline} memberCount={state.members.length} />

      {/* ─── HEADER ───────────────────────────────────────────────────── */}
      <View style={styles.header}>
        {/* Left */}
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={handleExit} style={styles.exitBtn}>
            <Text style={styles.exitArrow}>←</Text>
            <Text style={styles.exitLabel}>Exit</Text>
          </TouchableOpacity>
        </View>

        {/* Center — room code */}
        <View style={styles.headerCenter}>
          <Text style={styles.headerCodeLabel}>ROOM CODE</Text>
          <InviteLinkButton roomCode={roomCode} />
        </View>

        {/* Right — ⋯ menu + QR + guests */}
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => setShowAllOptions(true)} style={styles.menuBtn}>
            <Text style={styles.menuBtnText}>⋯</Text>
          </TouchableOpacity>
          <RoomQRCode roomCode={roomCode} />
          <View style={styles.guestPill}>
            <Text style={styles.guestCount}>{state.members.length}</Text>
            <Text style={styles.guestLabel}>guests</Text>
          </View>
        </View>
      </View>

      {/* ─── PRIMARY TABS: DJ MODE | GAMES ────────────────────────────── */}
      <View style={styles.primaryTabRow}>
        {([
          { mode: "dj",    label: "DJ MODE", emoji: "🎛️", color: djColor },
          { mode: "games", label: "GAMES",   emoji: "🎮", color: gamesColor },
        ] as { mode: "dj" | "games"; label: string; emoji: string; color: string }[]).map(
          ({ mode, label, emoji, color }) => {
            const active = primaryMode === mode;
            return (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.primaryTab,
                  active && { backgroundColor: color + "18", borderColor: color + "80" },
                ]}
                onPress={() => {
                  setPrimaryMode(mode);
                  setTab("controls");
                  setGameViewMode("host");
                  if (mode === "dj") switchExperienceAnimated("dj");
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryTabEmoji}>{emoji}</Text>
                <Text style={[styles.primaryTabLabel, active && { color }]}>{label}</Text>
                {active && (
                  <View style={[styles.primaryTabLine, { backgroundColor: color }]} />
                )}
              </TouchableOpacity>
            );
          }
        )}
      </View>

      {/* ─── GAME CHIPS (GAMES mode only) ─────────────────────────────── */}
      {primaryMode === "games" && (
        <View style={styles.gamePickerWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.gamePickerContent}
          >
            {EXPERIENCES.filter(e => e.type !== "dj").map(({ type, label, emoji }) => {
              const active = state.activeExperience === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.gameChip, active && styles.gameChipActive]}
                  onPress={() => {
                    setTab("controls");
                    setGameViewMode("host");
                    switchExperienceAnimated(type);
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={styles.gameChipEmoji}>{emoji}</Text>
                  <Text style={[styles.gameChipLabel, active && styles.gameChipLabelActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {/* Active game label strip */}
          {activeGame && state.activeExperience !== "dj" && (
            <View style={styles.activeGameBar}>
              <Text style={styles.activeGameBarText}>
                {activeGame.emoji} {activeGame.label} — active
              </Text>
              {tab === "controls" && gameViewMode === "player" && (
                <TouchableOpacity onPress={() => setGameViewMode("host")} style={styles.hostViewBtn}>
                  <Text style={styles.hostViewBtnText}>🎛️ Host View</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}

      {/* DJ active game bar */}
      {primaryMode === "dj" && tab === "controls" && gameViewMode === "player" && (
        <TouchableOpacity onPress={() => setGameViewMode("host")} style={styles.djHostCtrlBar}>
          <Text style={styles.djHostCtrlText}>🎛️ Switch to Host Controls</Text>
        </TouchableOpacity>
      )}

      {/* ─── SECONDARY TAB BAR ────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBarScroll}
        contentContainerStyle={styles.tabBar}
      >
        {([
          { id: "controls", label: "Controls", icon: "🎛️" },
          { id: "queue",    label: "Queue",    icon: "🎵", badge: state.queue.length   || undefined },
          { id: "guests",   label: "Guests",   icon: "👥", badge: state.members.length || undefined },
          { id: "recs",     label: "AI Picks", icon: "✨" },
          { id: "history",  label: "History",  icon: "📋" },
          { id: "settings", label: "Settings", icon: "⚙️" },
          { id: "demo",     label: "Dev",      icon: "🧪" },
        ] as { id: Tab; label: string; icon: string; badge?: number }[]).map(
          ({ id, label, icon, badge }) => {
            const on = tab === id;
            return (
              <TouchableOpacity
                key={id}
                style={[styles.tabBtn, on && [styles.tabBtnActive, { borderColor: activeColor + "60", backgroundColor: activeColor + "14" }]]}
                onPress={() => setTab(id)}
                activeOpacity={0.8}
              >
                <Text style={styles.tabIcon}>{icon}</Text>
                <Text style={[styles.tabLabel, on && [styles.tabLabelActive, { color: activeColor === djColor ? "#c4b5fd" : "#fcd34d" }]]}>
                  {label}
                </Text>
                {badge !== undefined && badge > 0 && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>{badge}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }
        )}
      </ScrollView>

      {/* ─── CONTENT ──────────────────────────────────────────────────── */}
      {tab === "queue" ? (
        <HostQueueView />
      ) : tab === "demo" ? (
        <DevTestPanel />
      ) : tab === "history" ? (
        <RoomHistory />
      ) : tab === "recs" ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
          <AIRecommendations />
        </ScrollView>
      ) : tab === "settings" ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
          <RoomSettingsPanel />
        </ScrollView>
      ) : tab === "guests" ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
          <GuestList />
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          <Animated.View style={{ flex: 1, opacity: controlsFade }}>
            {renderControls()}
          </Animated.View>
        </View>
      )}

      {/* ─── CHAT TICKER ──────────────────────────────────────────────── */}
      <ChatTicker roomId={state.room?.id ?? ""} />

      {/* ─── FLOATING CHAT BUTTON ─────────────────────────────────────── */}
      <View style={{ position: "absolute", bottom: 28, right: 16, zIndex: 20 }}>
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

      {/* ─── ALL OPTIONS BOTTOM SHEET ─────────────────────────────────── */}
      <Modal
        visible={showAllOptions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAllOptions(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowAllOptions(false)}
          />
          <View style={styles.allOptionsSheet}>
            {/* Handle */}
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>All Options</Text>
              <TouchableOpacity onPress={() => setShowAllOptions(false)} style={styles.sheetCloseBtn}>
                <Text style={styles.sheetCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              {/* ── Switch Experience ── */}
              <Text style={styles.sheetSection}>SWITCH EXPERIENCE</Text>
              {EXPERIENCES.map(({ type, label, emoji }) => {
                const active = state.activeExperience === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.sheetOption, active && styles.sheetOptionActive]}
                    onPress={() => {
                      setShowAllOptions(false);
                      setPrimaryMode(type === "dj" ? "dj" : "games");
                      setTab("controls");
                      setGameViewMode("host");
                      setTimeout(() => switchExperienceAnimated(type), 160);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.sheetOptionEmoji}>{emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sheetOptionLabel, active && styles.sheetOptionLabelActive]}>
                        {label}
                      </Text>
                    </View>
                    {active && <Text style={styles.sheetOptionCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}

              {/* ── Room Tools ── */}
              <View style={styles.sheetDivider} />
              <Text style={styles.sheetSection}>ROOM TOOLS</Text>
              {([
                { id: "controls", label: "Controls",     icon: "🎛️", sub: "Game host panel" },
                { id: "queue",    label: "Queue",         icon: "🎵", sub: `${state.queue.length} tracks` },
                { id: "guests",   label: "Guests",        icon: "👥", sub: `${state.members.length} in room` },
                { id: "recs",     label: "AI Picks",      icon: "✨", sub: "Smart recommendations" },
                { id: "history",  label: "History",       icon: "📋", sub: "Played tracks" },
                { id: "settings", label: "Room Settings", icon: "⚙️", sub: "Vibe, rules & access" },
                { id: "demo",     label: "Dev Panel",     icon: "🧪", sub: "Test events" },
              ] as { id: Tab; label: string; icon: string; sub: string }[]).map(({ id, label, icon, sub }) => {
                const active = tab === id;
                return (
                  <TouchableOpacity
                    key={id}
                    style={[styles.sheetOption, active && styles.sheetOptionActive]}
                    onPress={() => { setShowAllOptions(false); setTab(id); }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.sheetOptionEmoji}>{icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sheetOptionLabel, active && styles.sheetOptionLabelActive]}>
                        {label}
                      </Text>
                      <Text style={styles.sheetOptionSub}>{sub}</Text>
                    </View>
                    {active && <Text style={styles.sheetOptionCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
              <View style={{ height: 50 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Guest List ──────────────────────────────────────────────────────────────

const API_HOST_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

function GuestList() {
  const { state } = useRoom();
  const myId = state.guestId;
  const [grantingId, setGrantingId] = useState<string | null>(null);
  const [mutedIds, setMutedIds] = useState<Set<string>>(new Set());

  function getSocket() {
    return socketManager.getSocket?.() ?? (socketManager as any).get?.();
  }

  function toggleMute(targetId: string, displayName: string) {
    const socket = getSocket();
    if (!socket || !state.room) return;
    const nowMuted = !mutedIds.has(targetId);
    socket.emit("guest:mute" as any, { roomId: state.room.id, targetGuestId: targetId, muted: nowMuted });
    setMutedIds((prev) => {
      const next = new Set(prev);
      if (nowMuted) next.add(targetId); else next.delete(targetId);
      return next;
    });
    Alert.alert(nowMuted ? "Guest Muted" : "Guest Unmuted", `${displayName} has been ${nowMuted ? "muted" : "unmuted"}.`);
  }

  function reportGuest(targetId: string, displayName: string) {
    const socket = getSocket();
    if (!socket || !state.room) return;
    Alert.alert(
      "Report Guest",
      `Report ${displayName} for inappropriate behavior?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Report",
          style: "destructive",
          onPress: () => {
            socket.emit("guest:report" as any, { roomId: state.room!.id, targetGuestId: targetId, reason: "inappropriate" });
            Alert.alert("Reported", "The report has been logged.");
          },
        },
      ],
    );
  }

  async function grantCredits(targetId: string, amount: number) {
    try {
      await fetch(`${API_HOST_URL}/credits/award`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestFingerprint: targetId, reason: "admin_grant", customAmount: amount }),
      });
      Alert.alert("Credits Granted", `+${amount} credits sent!`);
    } catch {
      Alert.alert("Error", "Could not grant credits.");
    } finally {
      setGrantingId(null);
    }
  }

  function showGrantDialog(targetId: string, displayName: string) {
    Alert.prompt?.(
      "Grant Credits",
      `How many credits to give ${displayName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Grant",
          onPress: (text) => {
            const n = parseInt(text ?? "0", 10);
            if (n > 0) grantCredits(targetId, n);
          },
        },
      ],
      "plain-text",
      "10",
      "numeric",
    );
    // On Android (no Alert.prompt), use a fixed grant
    if (!Alert.prompt) {
      Alert.alert("Grant Credits", `Grant 10 credits to ${displayName}?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Grant 10", onPress: () => grantCredits(targetId, 10) },
        { text: "Grant 50", onPress: () => grantCredits(targetId, 50) },
      ]);
    }
  }

  function promoteToCoHost(targetId: string) {
    const socket = getSocket();
    if (!socket || !state.room) return;
    socket.emit("role:promote" as any, { roomId: state.room.id, targetGuestId: targetId, newRole: "CO_HOST" });
  }

  function demoteGuest(targetId: string) {
    const socket = getSocket();
    if (!socket || !state.room) return;
    socket.emit("role:demote" as any, { roomId: state.room.id, targetGuestId: targetId });
  }

  if (state.members.length === 0) {
    return <Text style={guestStyles.empty}>No guests yet — share the room code!</Text>;
  }

  return (
    <>
      {state.members
        .filter(m => !m.isWorkerNode)
        .map((m) => {
          const isMe = m.guestId === myId;
          const isCoHost = m.role === "CO_HOST";
          const displayName = (m as any).displayName ?? m.guestId.slice(0, 8);
          return (
            <View key={m.guestId} style={guestStyles.row}>
              <View style={[guestStyles.avatar, isCoHost && { backgroundColor: "#1a0a2e" }]}>
                <Text style={guestStyles.avatarText}>{m.guestId.slice(0, 2).toUpperCase()}</Text>
              </View>
              <View style={guestStyles.info}>
                <Text style={guestStyles.name}>
                  {displayName}{isMe ? " (you)" : ""}
                </Text>
                <Text style={[guestStyles.role, isCoHost && { color: "#a78bfa" }]}>
                  {m.role === "CO_HOST" ? "⭐ Co-Host" : m.role}
                </Text>
              </View>
              {!isMe && m.role !== "HOST" && (
                <View style={guestStyles.actions}>
                  {isCoHost ? (
                    <TouchableOpacity style={guestStyles.demoteBtn} onPress={() => demoteGuest(m.guestId)}>
                      <Text style={guestStyles.demoteBtnText}>Remove ⭐</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={guestStyles.promoteBtn} onPress={() => promoteToCoHost(m.guestId)}>
                      <Text style={guestStyles.promoteBtnText}>⭐ Co-Host</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={guestStyles.grantBtn}
                    onPress={() => showGrantDialog(m.guestId, displayName)}
                  >
                    <Text style={guestStyles.grantBtnText}>⚡ Credits</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[guestStyles.muteBtn, mutedIds.has(m.guestId) && guestStyles.muteBtnActive]}
                    onPress={() => toggleMute(m.guestId, displayName)}
                  >
                    <Text style={guestStyles.muteBtnText}>{mutedIds.has(m.guestId) ? "🔊 Unmute" : "🔇 Mute"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={guestStyles.reportBtn}
                    onPress={() => reportGuest(m.guestId, displayName)}
                  >
                    <Text style={guestStyles.reportBtnText}>⚑ Report</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050512" },

  headerGlow: {
    position: "absolute", top: -60, left: "15%", right: "15%",
    height: 160, borderRadius: 80,
    backgroundColor: "rgba(124,58,237,0.10)",
  },

  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: "rgba(5,5,18,0.98)",
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)",
  },
  headerLeft:   { flexDirection: "row", alignItems: "center" },
  headerCenter: { alignItems: "center", flex: 1 },
  headerRight:  { flexDirection: "row", alignItems: "center", gap: 8 },

  exitBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 22,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
  },
  exitArrow:      { color: "#e2e8f0", fontSize: 15, fontWeight: "700" },
  exitLabel:      { color: "#e2e8f0", fontSize: 13, fontWeight: "700", letterSpacing: 0.3 },
  headerCodeLabel:{ color: "#4b5563", fontSize: 9, fontWeight: "800", letterSpacing: 2, textTransform: "uppercase", marginBottom: 1 },

  menuBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center", justifyContent: "center",
  },
  menuBtnText: { color: "#e2e8f0", fontSize: 20, fontWeight: "700", lineHeight: 24 },

  guestPill:  { alignItems: "center", minWidth: 34 },
  guestCount: { color: "#a78bfa", fontSize: 22, fontWeight: "900", lineHeight: 26 },
  guestLabel: { color: "#4b5563", fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },

  // ── Primary Tabs ───────────────────────────────────────────────────────────
  primaryTabRow: {
    flexDirection: "row",
    paddingHorizontal: 12, paddingTop: 12, paddingBottom: 10, gap: 10,
    backgroundColor: "rgba(5,5,18,0.98)",
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)",
  },
  primaryTab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "rgba(255,255,255,0.03)",
    position: "relative", overflow: "hidden",
  },
  primaryTabEmoji: { fontSize: 20 },
  primaryTabLabel: {
    fontSize: 13, fontWeight: "800", letterSpacing: 1,
    color: "#4b5563", textTransform: "uppercase",
  },
  primaryTabLine: {
    position: "absolute", bottom: 0, left: "20%", right: "20%",
    height: 3, borderRadius: 2,
  },

  // ── Game chips (GAMES mode) ────────────────────────────────────────────────
  gamePickerWrap: {
    backgroundColor: "rgba(0,0,0,0.4)",
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)",
  },
  gamePickerContent: {
    paddingHorizontal: 12, paddingVertical: 10, gap: 7, flexDirection: "row",
  },
  gameChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 13, paddingVertical: 7,
    borderRadius: 22, borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.08)",
  },
  gameChipActive: {
    backgroundColor: "rgba(245,158,11,0.15)",
    borderColor: "rgba(245,158,11,0.55)",
  },
  gameChipEmoji: { fontSize: 14 },
  gameChipLabel: { color: "#6b7280", fontSize: 11, fontWeight: "700" },
  gameChipLabelActive: { color: "#fcd34d" },

  activeGameBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: "rgba(245,158,11,0.07)",
    borderTopWidth: 1, borderTopColor: "rgba(245,158,11,0.15)",
  },
  activeGameBarText: { color: "#fcd34d", fontSize: 12, fontWeight: "700" },

  hostViewBtn: {
    backgroundColor: "rgba(124,58,237,0.2)", borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: "rgba(124,58,237,0.4)",
  },
  hostViewBtnText: { color: "#c4b5fd", fontSize: 11, fontWeight: "700" },

  djHostCtrlBar: {
    alignItems: "center", paddingVertical: 8,
    backgroundColor: "rgba(124,58,237,0.08)",
    borderBottomWidth: 1, borderBottomColor: "rgba(124,58,237,0.15)",
  },
  djHostCtrlText: { color: "#a78bfa", fontSize: 12, fontWeight: "700" },

  // ── Secondary Tab Bar ──────────────────────────────────────────────────────
  tabBarScroll: {
    flexShrink: 0, flexGrow: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)",
  },
  tabBar: { flexDirection: "row", paddingHorizontal: 10, gap: 6, paddingVertical: 8 },
  tabBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 9, paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1, borderColor: "transparent",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  tabBtnActive:   {},  // color applied inline
  tabIcon:        { fontSize: 15 },
  tabLabel:       { color: "#6b7280", fontSize: 12, fontWeight: "700", letterSpacing: 0.2 },
  tabLabelActive: {},  // color applied inline
  tabBadge: {
    backgroundColor: "#7c3aed", borderRadius: 10,
    minWidth: 18, height: 18, paddingHorizontal: 4,
    alignItems: "center", justifyContent: "center",
  },
  tabBadgeText: { color: "#fff", fontSize: 9, fontWeight: "900" },

  content: { padding: 20, gap: 12 },

  // ── All Options Modal ──────────────────────────────────────────────────────
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.65)" },
  allOptionsSheet: {
    backgroundColor: "#0d0d22",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: "88%",
    borderTopWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    paddingTop: 10,
  },
  sheetHandle: {
    alignSelf: "center", width: 40, height: 4,
    backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 2, marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)",
  },
  sheetTitle:    { color: "#fff", fontSize: 17, fontWeight: "800", letterSpacing: 0.5 },
  sheetCloseBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center", justifyContent: "center",
  },
  sheetCloseBtnText: { color: "#9ca3af", fontSize: 13, fontWeight: "700" },

  sheetSection: {
    color: "#4b5563", fontSize: 10, fontWeight: "800", letterSpacing: 1.5,
    textTransform: "uppercase", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 6,
  },
  sheetOption: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingVertical: 13, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)",
  },
  sheetOptionActive: { backgroundColor: "rgba(124,58,237,0.10)" },
  sheetOptionEmoji:  { fontSize: 20, width: 26, textAlign: "center" },
  sheetOptionLabel:  { color: "#d1d5db", fontSize: 14, fontWeight: "700" },
  sheetOptionLabelActive: { color: "#c4b5fd" },
  sheetOptionSub:    { color: "#4b5563", fontSize: 11, marginTop: 1 },
  sheetOptionCheck:  { color: "#a78bfa", fontSize: 15, fontWeight: "900" },
  sheetDivider: {
    height: 1, backgroundColor: "rgba(255,255,255,0.06)",
    marginHorizontal: 20, marginTop: 8,
  },
});

const guestStyles = StyleSheet.create({
  empty:   { color: "#444", fontSize: 14, textAlign: "center", marginTop: 40 },
  row:     { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#1a1a1a" },
  avatar:  { width: 40, height: 40, borderRadius: 20, backgroundColor: "#6c47ff33", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#c4b5fd", fontSize: 13, fontWeight: "700" },
  info:    { flex: 1, gap: 2 },
  name:    { color: "#fff", fontSize: 14, fontWeight: "600" },
  role:    { color: "#555", fontSize: 11 },
  actions: { gap: 6 },
  promoteBtn:     { backgroundColor: "rgba(124,58,237,0.2)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(124,58,237,0.4)" },
  promoteBtnText: { color: "#a78bfa", fontSize: 11, fontWeight: "700" },
  demoteBtn:      { backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(239,68,68,0.3)" },
  demoteBtnText:  { color: "#f87171", fontSize: 11, fontWeight: "700" },
  grantBtn:       { backgroundColor: "rgba(34,197,94,0.12)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(34,197,94,0.3)" },
  grantBtnText:   { color: "#4ade80", fontSize: 11, fontWeight: "700" },
  muteBtn:        { backgroundColor: "rgba(251,191,36,0.1)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(251,191,36,0.25)" },
  muteBtnActive:  { backgroundColor: "rgba(251,191,36,0.25)", borderColor: "rgba(251,191,36,0.6)" },
  muteBtnText:    { color: "#fbbf24", fontSize: 11, fontWeight: "700" },
  reportBtn:      { backgroundColor: "rgba(239,68,68,0.08)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(239,68,68,0.2)" },
  reportBtnText:  { color: "#f87171", fontSize: 11, fontWeight: "700" },
});
