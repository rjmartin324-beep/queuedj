import React from "react";
import { View, StyleSheet } from "react-native";
import { useRoom } from "../contexts/RoomContext";

// Shared
import { DJQueueView }       from "../components/experiences/dj/DJQueueView";
import { TriviaQuestionView } from "../components/experiences/trivia/TriviaQuestionView";
import { TriviaWaitingView }  from "../components/experiences/trivia/TriviaWaitingView";
import { LeaderboardView }    from "../components/experiences/trivia/LeaderboardView";
import { PollView }           from "../components/experiences/shared/PollView";
import { IntermissionView }   from "../components/experiences/shared/IntermissionView";
import { ConnectionBar }      from "../components/shared/ConnectionBar";

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
import { RevealView as GeoRevealView } from "../components/experiences/geo-guesser/RevealView";

// Drawback
import { DrawingView }            from "../components/experiences/drawback/DrawingView";
import { VotingView as DrawbackVotingView } from "../components/experiences/drawback/VotingView";
import { RevealView as DrawbackRevealView } from "../components/experiences/drawback/RevealView";

// Scavenger Snap
import { ChallengeView }          from "../components/experiences/scavenger-snap/ChallengeView";
import { GalleryView as SnapGalleryView } from "../components/experiences/scavenger-snap/GalleryView";
import { ResultsView as SnapResultsView } from "../components/experiences/scavenger-snap/ResultsView";

// ─────────────────────────────────────────────────────────────────────────────
// Guest Screen — The View Router
//
// This screen never manually navigates. The server tells it what to show
// via the "experience:state" socket event → RoomContext → guestView.
//
// To add a new experience: create a component, add one case here.
// ─────────────────────────────────────────────────────────────────────────────

export default function GuestScreen() {
  const { state } = useRoom();

  function renderView() {
    switch (state.guestView) {
      // ── DJ ──────────────────────────────────────────────────────────────
      case "dj_queue":          return <DJQueueView />;

      // ── Trivia ──────────────────────────────────────────────────────────
      case "trivia_question":   return <TriviaQuestionView />;
      case "trivia_waiting":    return <TriviaWaitingView />;
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

      // ── The Glitch ───────────────────────────────────────────────────────
      case "glitch_watching":   return <WatchingView />;
      case "glitch_describing": return <DescribingView />;
      case "glitch_voting":     return <GlitchVotingView />;
      case "glitch_reveal":     return <GlitchRevealView />;

      // ── Copyright Infringement ───────────────────────────────────────────
      case "copyright_viewing":  return <ViewingView />;
      case "copyright_drawing":  return <DrawingCanvas />;
      case "copyright_gallery":  return <GalleryView />;
      case "copyright_results":  return <CopyrightResultsView />;

      // ── GeoGuesser ───────────────────────────────────────────────────────
      case "geo_guessing":      return <GeoGuessingView />;
      case "geo_reveal":        return <GeoRevealView />;

      // ── Drawback ─────────────────────────────────────────────────────────
      case "drawback_drawing":  return <DrawingView />;
      case "drawback_voting":   return <DrawbackVotingView />;
      case "drawback_reveal":   return <DrawbackRevealView />;

      // ── Scavenger Snap ───────────────────────────────────────────────────
      case "snap_challenge":    return <ChallengeView />;
      case "snap_gallery":      return <SnapGalleryView />;
      case "snap_results":      return <SnapResultsView />;

      // ── Fallback ─────────────────────────────────────────────────────────
      case "intermission":
      default:                  return <IntermissionView />;
    }
  }

  return (
    <View style={styles.container}>
      <ConnectionBar isOffline={state.isOffline} memberCount={state.members.length} />
      {renderView()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
});
