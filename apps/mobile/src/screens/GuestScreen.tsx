import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform, Clipboard } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../contexts/RoomContext";
import { SessionRecapScreen, type SessionRecapData } from "./SessionRecapScreen";
import { useRouter } from "expo-router";

// Shared
import { DJQueueView }           from "../components/experiences/dj/DJQueueView";
import { TriviaQuestionView }    from "../components/experiences/trivia/TriviaQuestionView";
import { TriviaWaitingView }     from "../components/experiences/trivia/TriviaWaitingView";
import { TriviaCountdownView }   from "../components/experiences/trivia/TriviaCountdownView";
import { LeaderboardView }       from "../components/experiences/trivia/LeaderboardView";
import { PollView }              from "../components/experiences/shared/PollView";
import { IntermissionView }      from "../components/experiences/shared/IntermissionView";
import { WaitingForPlayersView } from "../components/experiences/shared/WaitingForPlayersView";
import { ConnectionBar }      from "../components/shared/ConnectionBar";
import { VibeCreditsBar }     from "../components/shared/VibeCreditsBar";
import { GuestAvatarRow, type GuestPresence } from "../components/shared/GuestAvatarRow";
import { OfflineBanner } from "../components/shared/OfflineBanner";
import { registerForPushNotifications, registerTokenWithServer } from "../lib/notifications";
import { tapLight } from "../lib/haptics";
import { PartyChatPanel, ChatFloatingButton } from "../components/shared/PartyChatPanel";
import { socketManager } from "../lib/socket";

// Unpopular Opinions
import { JudgeView }    from "../components/experiences/unpopular-opinions/JudgeView";
import { GuessingView } from "../components/experiences/unpopular-opinions/GuessingView";
import { RevealView as OpinionsRevealView } from "../components/experiences/unpopular-opinions/RevealView";

// Scrapbook Sabotage
import { WordInputView }           from "../components/experiences/scrapbook-sabotage/WordInputView";
import { WordBankView }            from "../components/experiences/scrapbook-sabotage/WordBankView";
import { WritingView }             from "../components/experiences/scrapbook-sabotage/WritingView";
import { VotingView as ScrapbookVotingView } from "../components/experiences/scrapbook-sabotage/VotingView";
import { ScrapbookRevealView }     from "../components/experiences/scrapbook-sabotage/RevealView";

// The Glitch
import { WatchingView }           from "../components/experiences/the-glitch/WatchingView";
import { DescribingView }         from "../components/experiences/the-glitch/DescribingView";
import { GlitchVotingView }       from "../components/experiences/the-glitch/VotingView";
import { GlitchRevealView }       from "../components/experiences/the-glitch/RevealView";

// Copyright Infringement
import { ViewingView }            from "../components/experiences/copyright-infringement/ViewingView";
import { DrawingCanvas }          from "../components/experiences/copyright-infringement/DrawingCanvas";
import { GalleryView }            from "../components/experiences/copyright-infringement/GalleryView";
import { CopyrightResultsView }   from "../components/experiences/copyright-infringement/ResultsView";

// GeoGuesser
import { GuessingView as GeoGuessingView } from "../components/experiences/geo-guesser/GuessingView";
import { RegionGuessView as GeoRegionGuessView } from "../components/experiences/geo-guesser/RegionGuessView";
import { RevealView as GeoRevealView } from "../components/experiences/geo-guesser/RevealView";

// Drawback
import { DrawingView }            from "../components/experiences/drawback/DrawingView";
import { VotingView as DrawbackVotingView } from "../components/experiences/drawback/VotingView";
import { RevealView as DrawbackRevealView } from "../components/experiences/drawback/RevealView";

// Scavenger Snap
import { ChallengeView }          from "../components/experiences/scavenger-snap/ChallengeView";
import { GalleryView as SnapGalleryView } from "../components/experiences/scavenger-snap/GalleryView";
import { ResultsView as SnapResultsView } from "../components/experiences/scavenger-snap/ResultsView";

// Phase 2 games (phase-based, single-component views)
import { NightShiftView }    from "../components/experiences/night-shift/NightShiftView";
import { MindMoleView }      from "../components/experiences/mind-mole/MindMoleView";
import { CroppedLookView }   from "../components/experiences/cropped-look/CroppedLookView";
import { GuessSongView }     from "../components/experiences/guess-the-song/GuessSongView";
import { NameGenreView }     from "../components/experiences/name-that-genre/NameGenreView";
import { VibeCheckView }     from "../components/experiences/vibe-check/VibeCheckView";

// 32 standalone card games
import { GenericGameView }        from "../components/experiences/shared/GenericGameView";
import { ImprovChallengeView }    from "../components/experiences/improv-challenge/ImprovChallengeView";
import { HumItView }              from "../components/experiences/hum-it/HumItView";
import { AccentChallengeView }    from "../components/experiences/accent-challenge/AccentChallengeView";

// ─────────────────────────────────────────────────────────────────────────────
// Guest Screen — The View Router
//
// This screen never manually navigates. The server tells it what to show
// via the "experience:state" socket event → RoomContext → guestView.
//
// To add a new experience: create a component, add one case here.
// ─────────────────────────────────────────────────────────────────────────────

const API_GUEST_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

export default function GuestScreen() {
  const { state, dispatch } = useRoom();
  const router = useRouter();
  const [recap,       setRecap]       = useState<SessionRecapData | null>(null);
  const [chatOpen,    setChatOpen]    = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const buildRecap = useCallback(async () => {
    if (!state.room || !state.guestId) return;
    const roomId = state.room.id;
    const guestId = state.guestId;

    // Try to fetch leaderboard stats for this guest
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
        // Only show once per session — check flag
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

  function renderView() {
    switch (state.guestView) {
      // ── DJ ──────────────────────────────────────────────────────────────
      case "dj_queue":          return <DJQueueView />;

      // ── Trivia ──────────────────────────────────────────────────────────
      case "trivia_question":   return <TriviaQuestionView />;
      case "trivia_waiting":    return <TriviaWaitingView />;
      case "trivia_countdown":  return <TriviaCountdownView />;
      case "trivia_result":     return <TriviaQuestionView showResult />;

      // ── Shared ──────────────────────────────────────────────────────────
      case "leaderboard":       return <LeaderboardView />;
      case "poll_active":       return <PollView />;
      case "poll_result":       return <PollView />;

      // ── Unpopular Opinions ───────────────────────────────────────────────
      case "opinions_judging":  return <JudgeView />;
      case "opinions_guessing": return <GuessingView />;
      case "opinions_reveal":   return <OpinionsRevealView />;

      // ── Scrapbook Sabotage ───────────────────────────────────────────────
      case "scrapbook_word_input": return <WordInputView />;
      case "scrapbook_word_bank":  return <WordBankView />;
      case "scrapbook_writing":    return <WritingView />;
      case "scrapbook_voting":     return <ScrapbookVotingView />;
      case "scrapbook_reveal":     return <ScrapbookRevealView />;
      case "scrapbook_waiting":    return (
        <WaitingForPlayersView
          emoji="📖" accent="#6c47ff"
          title="Chapter Received!"
          subtitle="Waiting for all writers to finish..."
          submittedCount={(state.guestViewData as any)?.submittedCount}
          totalCount={state.members.length}
        />
      );

      // ── The Glitch ───────────────────────────────────────────────────────
      case "glitch_watching":   return <WatchingView />;
      case "glitch_describing": return <DescribingView />;
      case "glitch_voting":     return <GlitchVotingView />;
      case "glitch_reveal":     return <GlitchRevealView />;
      case "glitch_waiting":    return (
        <WaitingForPlayersView
          emoji="📺" accent="#818cf8"
          title="Round Finished!"
          subtitle="Waiting for the next clip..."
          submittedCount={(state.guestViewData as any)?.submittedCount}
          totalCount={state.members.length}
        />
      );

      // ── Copyright Infringement ───────────────────────────────────────────
      case "copyright_viewing":  return <ViewingView />;
      case "copyright_drawing":  return <DrawingCanvas />;
      case "copyright_gallery":  return <GalleryView />;
      case "copyright_results":  return <CopyrightResultsView />;

      // ── GeoGuesser ───────────────────────────────────────────────────────
      case "geo_guessing":      return <GeoGuessingView />;
      case "geo_region_guess":  return <GeoRegionGuessView />;
      case "geo_reveal":        return <GeoRevealView />;
      case "geo_waiting":       return (
        <WaitingForPlayersView
          emoji="🌍" accent="#22c55e"
          title="Round Complete!"
          subtitle="Waiting for the next location..."
          submittedCount={(state.guestViewData as any)?.submittedCount}
          totalCount={state.members.length}
        />
      );

      // ── Drawback ─────────────────────────────────────────────────────────
      case "drawback_drawing":  return <DrawingView />;
      case "drawback_voting":   return <DrawbackVotingView />;
      case "drawback_reveal":   return <DrawbackRevealView />;
      case "drawback_waiting":  return (
        <WaitingForPlayersView
          emoji="🎨" accent="#3b82f6"
          title="Round Over!"
          subtitle="Waiting for the next drawing prompt..."
          submittedCount={(state.guestViewData as any)?.submittedCount}
          totalCount={state.members.length}
        />
      );

      // ── Scavenger Snap ───────────────────────────────────────────────────
      case "snap_challenge":    return <ChallengeView />;
      case "snap_gallery":      return <SnapGalleryView />;
      case "snap_results":      return <SnapResultsView />;
      case "snap_waiting":      return (
        <WaitingForPlayersView
          emoji="📸" accent="#10b981"
          title="All Snaps In!"
          subtitle="Get ready for the next challenge..."
          submittedCount={(state.guestViewData as any)?.submittedCount}
          totalCount={state.members.length}
        />
      );

      // ── NightShift ───────────────────────────────────────────────────────
      case "night_shift":       return <NightShiftView />;

      // ── MindMole ─────────────────────────────────────────────────────────
      case "mind_mole":         return <MindMoleView />;

      // ── Cropped Look ─────────────────────────────────────────────────────
      case "cropped_look":      return <CroppedLookView />;

      // ── Music Games ──────────────────────────────────────────────────────
      case "guess_the_song":    return <GuessSongView />;
      case "name_that_genre":   return <NameGenreView />;
      case "vibe_check":        return <VibeCheckView />;

      // ── Improv Challenge ─────────────────────────────────────────────────
      case "improv_challenge_performing":
      case "improv_challenge_rating":
      case "improv_challenge_reveal":
      case "improv_challenge_finished":
        return <ImprovChallengeView />;

      // ── Hum It ───────────────────────────────────────────────────────────
      case "hum_it_humming":
      case "hum_it_guessing":
      case "hum_it_reveal":
      case "hum_it_finished":
        return <HumItView />;

      // ── Accent Challenge ─────────────────────────────────────────────────
      case "accent_challenge_performing":
      case "accent_challenge_rating":
      case "accent_challenge_finished":
        return <AccentChallengeView />;

      // ── 21 Card / Voting Games ────────────────────────────────────────────
      case "would_you_rather":
      case "never_have_i_ever":
      case "truth_or_dare":
      case "two_truths_one_lie":
      case "rank_it":
      case "emoji_story":
      case "celebrity_head":
      case "word_association":
      case "who_knows_who":
      case "fake_news":
      case "pop_culture_quiz":
      case "alibi":
      case "mind_reading":
      case "speed_round":
      case "mimic_me":
      case "chain_reaction":
      case "party_dice":
      case "connections":
      case "lyrics_drop":
      case "musical_chairs":
      case "thumb_war":
        return <GenericGameView />;

      // ── Fallback ─────────────────────────────────────────────────────────
      case "intermission":
      default:                  return <IntermissionView />;
    }
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

  const roomCode    = state.room?.code ?? "";
  const gameLabel   = state.guestView && state.guestView !== "intermission"
    ? state.guestView.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    : null;

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

        {/* Right: co-host badge + credits */}
        <View style={styles.topRight}>
          {state.role === "CO_HOST" && (
            <View style={styles.coHostBadge}>
              <Text style={styles.coHostText}>⭐</Text>
            </View>
          )}
          {state.guestId && <VibeCreditsBar guestId={state.guestId} compact />}
        </View>
      </View>

      <ConnectionBar isOffline={state.isOffline} memberCount={state.members.length} />

      {state.guestView === "dj_queue" && (
        <GuestAvatarRow guests={guestPresences} maxVisible={12} />
      )}

      {renderView()}

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

  chatFab: {
    position: "absolute",
    bottom: 28,
    right: 16,
    zIndex: 20,
  },
});
