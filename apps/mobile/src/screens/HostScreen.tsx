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

const GAME_CHIPS = EXPERIENCES.filter(e => e.type !== "dj");

export default function HostScreen() {
  const { state, switchExperience, dispatch } = useRoom();
  const [tab, setTab] = useState<Tab>("controls");
  const [gameViewMode, setGameViewMode] = useState<"player" | "host">("host");
  const [chatOpen,      setChatOpen]      = useState(false);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [djExpanded,    setDjExpanded]    = useState(false);
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
      case "dj":
      case undefined:
        return (
          <View style={styles.pickGamePrompt}>
            <Text style={styles.pickGameEmoji}>🎮</Text>
            <Text style={styles.pickGameTitle}>Pick a Game</Text>
            <Text style={styles.pickGameSub}>Select a game from the list above to get started. Use the DJ Deck below for music controls.</Text>
          </View>
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

  const activeGame = GAME_CHIPS.find(e => e.type === state.activeExperience);

  const SECONDARY_TABS: { id: Tab; label: string; icon: string; badge?: number }[] = [
    { id: "controls", label: "Controls", icon: "🎛️" },
    { id: "guests",   label: "Guests",   icon: "👥", badge: state.members.length || undefined },
    { id: "queue",    label: "Queue",    icon: "🎵", badge: state.queue.length   || undefined },
    { id: "recs",     label: "AI Picks", icon: "✨" },
    { id: "settings", label: "Settings", icon: "⚙️" },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={["#050512", "#08051a", "#0a0520"]} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <OfflineBanner isOffline={state.isOffline} />
      <ConnectionBar isOffline={state.isOffline} memberCount={state.members.length} />

      {/* ─── HEADER ─── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleExit} style={styles.exitBtn}>
          <Text style={styles.exitArrow}>←</Text>
          <Text style={styles.exitLabel}>Exit</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerCodeLabel}>ROOM CODE</Text>
          <InviteLinkButton roomCode={roomCode} />
        </View>
        <View style={styles.headerRight}>
          <View style={styles.guestPill}>
            <Text style={styles.guestCount}>{state.members.length}</Text>
            <Text style={styles.guestLabel}>in</Text>
          </View>
          <RoomQRCode roomCode={roomCode} />
          <TouchableOpacity onPress={() => setShowAllOptions(true)} style={styles.menuBtn}>
            <Text style={styles.menuBtnText}>⋯</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── GAMES SECTION ─── */}
      <View style={styles.gamesSectionHead}>
        <Text style={styles.gamesSectionLabel}>🎮  GAMES</Text>
        {activeGame ? (
          <View style={styles.activeGamePill}>
            <View style={styles.activeGameDot} />
            <Text style={styles.activeGameText}>{activeGame.label} active</Text>
          </View>
        ) : (
          <Text style={styles.pickHint}>pick a game below</Text>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        style={styles.chipScroll}
      >
        {GAME_CHIPS.map(({ type, label, emoji }) => {
          const active = state.activeExperience === type;
          return (
            <TouchableOpacity
              key={type}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => {
                setTab("controls");
                setGameViewMode("host");
                switchExperienceAnimated(type);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.chipEmoji}>{emoji}</Text>
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ─── HOST VIEW RETURN BAR ─── */}
      {tab === "controls" && gameViewMode === "player" && (
        <TouchableOpacity style={styles.hostViewBar} onPress={() => setGameViewMode("host")} activeOpacity={0.85}>
          <Text style={styles.hostViewBarText}>🎛️  Back to Host Controls</Text>
        </TouchableOpacity>
      )}

      {/* ─── SECONDARY TABS ─── */}
      <View style={styles.tabRow}>
        {SECONDARY_TABS.map(({ id, label, icon, badge }) => {
          const on = tab === id;
          return (
            <TouchableOpacity
              key={id}
              style={[styles.tabBtn, on && styles.tabBtnOn]}
              onPress={() => setTab(id)}
              activeOpacity={0.75}
            >
              <Text style={[styles.tabIcon, on && styles.tabIconOn]}>{icon}</Text>
              <Text style={[styles.tabLabel, on && styles.tabLabelOn]}>{label}</Text>
              {badge !== undefined && badge > 0 && (
                <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{badge}</Text></View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ─── CONTENT ─── */}
      <View style={{ flex: 1 }}>
        <Animated.View style={{ flex: 1, opacity: controlsFade }}>
          {tab === "controls" ? (
            renderControls()
          ) : tab === "guests" ? (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
              <GuestList />
            </ScrollView>
          ) : tab === "queue" ? (
            <HostQueueView />
          ) : tab === "recs" ? (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
              <AIRecommendations />
            </ScrollView>
          ) : tab === "settings" ? (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
              <RoomSettingsPanel />
            </ScrollView>
          ) : tab === "history" ? (
            <RoomHistory />
          ) : tab === "demo" ? (
            <DevTestPanel />
          ) : null}
        </Animated.View>
      </View>

      {/* ─── DJ DECK ─── */}
      <View style={styles.djDeck}>
        <TouchableOpacity style={styles.djDeckHeader} onPress={() => setDjExpanded(v => !v)} activeOpacity={0.85}>
          <View style={styles.djDeckLeft}>
            <Text style={styles.djDeckIcon}>🎛️</Text>
            <View>
              <Text style={styles.djDeckTitle}>DJ DECK</Text>
              <Text style={styles.djDeckSub}>Music controls & queue</Text>
            </View>
          </View>
          <Text style={styles.djDeckChevron}>{djExpanded ? "▼" : "▲"}</Text>
        </TouchableOpacity>
        {djExpanded && (
          <ScrollView
            style={styles.djDeckContent}
            contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <DJControls />
          </ScrollView>
        )}
      </View>

      <ChatTicker roomId={state.room?.id ?? ""} />

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

      {/* ─── ALL OPTIONS SHEET ─── */}
      <Modal
        visible={showAllOptions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAllOptions(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowAllOptions(false)} />
          <View style={styles.allOptionsSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>All Options</Text>
              <TouchableOpacity onPress={() => setShowAllOptions(false)} style={styles.sheetCloseBtn}>
                <Text style={styles.sheetCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              <Text style={styles.sheetSection}>SWITCH GAME</Text>
              {GAME_CHIPS.map(({ type, label, emoji }) => {
                const active = state.activeExperience === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.sheetOption, active && styles.sheetOptionActive]}
                    onPress={() => {
                      setShowAllOptions(false);
                      setTab("controls");
                      setGameViewMode("host");
                      setTimeout(() => switchExperienceAnimated(type), 160);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.sheetOptionEmoji}>{emoji}</Text>
                    <Text style={[styles.sheetOptionLabel, active && styles.sheetOptionLabelActive]}>{label}</Text>
                    {active && <Text style={styles.sheetOptionCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
              <View style={styles.sheetDivider} />
              <Text style={styles.sheetSection}>ROOM TOOLS</Text>
              {([
                { id: "controls" as Tab, label: "Controls",     icon: "🎛️", sub: "Game host panel" },
                { id: "queue"    as Tab, label: "Queue",         icon: "🎵", sub: `${state.queue.length} tracks` },
                { id: "guests"   as Tab, label: "Guests",        icon: "👥", sub: `${state.members.length} in room` },
                { id: "recs"     as Tab, label: "AI Picks",      icon: "✨", sub: "Smart recommendations" },
                { id: "history"  as Tab, label: "History",       icon: "📋", sub: "Played tracks" },
                { id: "settings" as Tab, label: "Room Settings", icon: "⚙️", sub: "Vibe, rules & access" },
                { id: "demo"     as Tab, label: "Dev Panel",     icon: "🧪", sub: "Test events" },
              ]).map(({ id, label, icon, sub }) => {
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
                      <Text style={[styles.sheetOptionLabel, active && styles.sheetOptionLabelActive]}>{label}</Text>
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

  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: "rgba(5,5,18,0.98)",
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)",
  },
  headerCenter: { alignItems: "center", flex: 1 },
  headerRight:  { flexDirection: "row", alignItems: "center", gap: 8 },
  headerCodeLabel: { color: "#4b5563", fontSize: 9, fontWeight: "800", letterSpacing: 2, textTransform: "uppercase", marginBottom: 1 },

  exitBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
  },
  exitArrow: { color: "#d1d5db", fontSize: 14, fontWeight: "700" },
  exitLabel: { color: "#d1d5db", fontSize: 12, fontWeight: "700" },

  menuBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center", justifyContent: "center",
  },
  menuBtnText: { color: "#e2e8f0", fontSize: 20, fontWeight: "700", lineHeight: 24 },

  guestPill:  { alignItems: "center", minWidth: 28 },
  guestCount: { color: "#a78bfa", fontSize: 18, fontWeight: "900", lineHeight: 22 },
  guestLabel: { color: "#4b5563", fontSize: 9, fontWeight: "700" },

  // ── Games section ──────────────────────────────────────────────────────────
  gamesSectionHead: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4,
    backgroundColor: "rgba(5,5,18,0.98)",
  },
  gamesSectionLabel: { color: "#fbbf24", fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  pickHint:          { color: "#374151", fontSize: 11, fontWeight: "600" },

  activeGamePill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(251,191,36,0.1)", borderRadius: 12,
    paddingHorizontal: 9, paddingVertical: 3,
    borderWidth: 1, borderColor: "rgba(251,191,36,0.25)",
  },
  activeGameDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#fbbf24" },
  activeGameText: { color: "#fbbf24", fontSize: 10, fontWeight: "700" },

  chipScroll: {
    flexShrink: 0, flexGrow: 0,
    backgroundColor: "rgba(5,5,18,0.98)",
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)",
  },
  chipRow: { paddingHorizontal: 12, paddingBottom: 10, paddingTop: 4, gap: 7, flexDirection: "row" },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 13, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.09)",
  },
  chipActive: {
    backgroundColor: "rgba(251,191,36,0.14)",
    borderColor: "rgba(251,191,36,0.55)",
  },
  chipEmoji: { fontSize: 15 },
  chipLabel: { color: "#6b7280", fontSize: 12, fontWeight: "700" },
  chipLabelActive: { color: "#fcd34d" },

  // ── Host view return bar ───────────────────────────────────────────────────
  hostViewBar: {
    alignItems: "center", paddingVertical: 8,
    backgroundColor: "rgba(108,71,255,0.10)",
    borderBottomWidth: 1, borderBottomColor: "rgba(108,71,255,0.20)",
  },
  hostViewBarText: { color: "#a78bfa", fontSize: 12, fontWeight: "700" },

  // ── Secondary tabs ─────────────────────────────────────────────────────────
  tabRow: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.4)",
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 8, paddingVertical: 6, gap: 4,
  },
  tabBtn: {
    flex: 1, alignItems: "center", justifyContent: "center", gap: 2,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1, borderColor: "transparent",
  },
  tabBtnOn: {
    backgroundColor: "rgba(108,71,255,0.14)",
    borderColor: "rgba(108,71,255,0.30)",
  },
  tabIcon:     { fontSize: 16 },
  tabIconOn:   {},
  tabLabel:    { color: "#555", fontSize: 9, fontWeight: "800", letterSpacing: 0.3 },
  tabLabelOn:  { color: "#c4b5fd" },
  tabBadge: {
    position: "absolute", top: 2, right: 2,
    backgroundColor: "#7c3aed", borderRadius: 8,
    minWidth: 15, height: 15, paddingHorizontal: 3,
    alignItems: "center", justifyContent: "center",
  },
  tabBadgeText: { color: "#fff", fontSize: 8, fontWeight: "900" },

  content: { padding: 16, gap: 12 },

  // ── Pick game prompt ───────────────────────────────────────────────────────
  pickGamePrompt: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 40 },
  pickGameEmoji:  { fontSize: 52 },
  pickGameTitle:  { color: "#fff", fontSize: 22, fontWeight: "900", textAlign: "center" },
  pickGameSub:    { color: "#555", fontSize: 14, textAlign: "center", lineHeight: 21 },

  // ── DJ Deck ────────────────────────────────────────────────────────────────
  djDeck: {
    backgroundColor: "#0a0520",
    borderTopWidth: 1, borderTopColor: "rgba(124,58,237,0.35)",
  },
  djDeckHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  djDeckLeft:  { flexDirection: "row", alignItems: "center", gap: 10 },
  djDeckIcon:  { fontSize: 22 },
  djDeckTitle: { color: "#c4b5fd", fontSize: 13, fontWeight: "900", letterSpacing: 0.5 },
  djDeckSub:   { color: "#5b3fa6", fontSize: 10, fontWeight: "600", marginTop: 1 },
  djDeckChevron: { color: "#7c3aed", fontSize: 13, fontWeight: "900" },
  djDeckContent: { maxHeight: 360 },

  // ── Chat FAB ───────────────────────────────────────────────────────────────
  chatFab: { position: "absolute", bottom: 72, right: 16, zIndex: 20 },

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
    backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 2, marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)",
  },
  sheetTitle:    { color: "#fff", fontSize: 17, fontWeight: "800" },
  sheetCloseBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center", justifyContent: "center",
  },
  sheetCloseBtnText: { color: "#9ca3af", fontSize: 13, fontWeight: "700" },
  sheetSection: {
    color: "#374151", fontSize: 10, fontWeight: "800", letterSpacing: 1.5,
    textTransform: "uppercase", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 6,
  },
  sheetOption: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingVertical: 13, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)",
  },
  sheetOptionActive:      { backgroundColor: "rgba(124,58,237,0.10)" },
  sheetOptionEmoji:       { fontSize: 20, width: 26, textAlign: "center" },
  sheetOptionLabel:       { color: "#d1d5db", fontSize: 14, fontWeight: "700" },
  sheetOptionLabelActive: { color: "#c4b5fd" },
  sheetOptionSub:         { color: "#4b5563", fontSize: 11, marginTop: 1 },
  sheetOptionCheck:       { color: "#a78bfa", fontSize: 15, fontWeight: "900" },
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
