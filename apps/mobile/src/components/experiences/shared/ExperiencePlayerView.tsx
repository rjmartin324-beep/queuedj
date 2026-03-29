import React from "react";
import { useRoom } from "../../../contexts/RoomContext";

import { DJQueueView }           from "../dj/DJQueueView";
import { TriviaQuestionView }    from "../trivia/TriviaQuestionView";
import { TriviaWaitingView }     from "../trivia/TriviaWaitingView";
import { TriviaCountdownView }   from "../trivia/TriviaCountdownView";
import { LeaderboardView }       from "../trivia/LeaderboardView";
import { PollView }              from "./PollView";
import { IntermissionView }      from "./IntermissionView";
import { WaitingForPlayersView } from "./WaitingForPlayersView";
import { GenericGameView }       from "./GenericGameView";

import { JudgeView }    from "../unpopular-opinions/JudgeView";
import { GuessingView } from "../unpopular-opinions/GuessingView";
import { RevealView as OpinionsRevealView } from "../unpopular-opinions/RevealView";

import { WordInputView }           from "../scrapbook-sabotage/WordInputView";
import { WordBankView }            from "../scrapbook-sabotage/WordBankView";
import { WritingView }             from "../scrapbook-sabotage/WritingView";
import { VotingView as ScrapbookVotingView } from "../scrapbook-sabotage/VotingView";
import { ScrapbookRevealView }     from "../scrapbook-sabotage/RevealView";

import { WatchingView }           from "../the-glitch/WatchingView";
import { DescribingView }         from "../the-glitch/DescribingView";
import { GlitchVotingView }       from "../the-glitch/VotingView";
import { GlitchRevealView }       from "../the-glitch/RevealView";

import { ViewingView }            from "../copyright-infringement/ViewingView";
import { DrawingCanvas }          from "../copyright-infringement/DrawingCanvas";
import { GalleryView }            from "../copyright-infringement/GalleryView";
import { CopyrightResultsView }   from "../copyright-infringement/ResultsView";

import { GuessingView as GeoGuessingView }        from "../geo-guesser/GuessingView";
import { RegionGuessView as GeoRegionGuessView }  from "../geo-guesser/RegionGuessView";
import { RevealView as GeoRevealView }            from "../geo-guesser/RevealView";

import { DrawingView }                            from "../drawback/DrawingView";
import { VotingView as DrawbackVotingView }       from "../drawback/VotingView";
import { RevealView as DrawbackRevealView }       from "../drawback/RevealView";

import { ChallengeView }                          from "../scavenger-snap/ChallengeView";
import { GalleryView as SnapGalleryView }         from "../scavenger-snap/GalleryView";
import { ResultsView as SnapResultsView }         from "../scavenger-snap/ResultsView";

import { NightShiftView }    from "../night-shift/NightShiftView";
import { MindMoleView }      from "../mind-mole/MindMoleView";
import { CroppedLookView }   from "../cropped-look/CroppedLookView";
import { GuessSongView }     from "../guess-the-song/GuessSongView";
import { NameGenreView }     from "../name-that-genre/NameGenreView";
import { VibeCheckView }     from "../vibe-check/VibeCheckView";
import { ImprovChallengeView } from "../improv-challenge/ImprovChallengeView";
import { HumItView }           from "../hum-it/HumItView";
import { AccentChallengeView } from "../accent-challenge/AccentChallengeView";

export function ExperiencePlayerView() {
  const { state } = useRoom();

  switch (state.guestView) {
    case "dj_queue":          return <DJQueueView />;

    case "trivia_question":   return <TriviaQuestionView />;
    case "trivia_waiting":    return <TriviaWaitingView />;
    case "trivia_countdown":  return <TriviaCountdownView />;
    case "trivia_result":     return <TriviaQuestionView showResult />;

    case "leaderboard":       return <LeaderboardView />;
    case "poll_active":       return <PollView />;
    case "poll_result":       return <PollView />;

    case "opinions_judging":  return <JudgeView />;
    case "opinions_guessing": return <GuessingView />;
    case "opinions_reveal":   return <OpinionsRevealView />;

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

    case "copyright_viewing":  return <ViewingView />;
    case "copyright_drawing":  return <DrawingCanvas />;
    case "copyright_gallery":  return <GalleryView />;
    case "copyright_results":  return <CopyrightResultsView />;

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

    case "night_shift":       return <NightShiftView />;
    case "mind_mole":         return <MindMoleView />;
    case "cropped_look":      return <CroppedLookView />;
    case "guess_the_song":    return <GuessSongView />;
    case "name_that_genre":   return <NameGenreView />;
    case "vibe_check":        return <VibeCheckView />;

    case "improv_challenge_performing":
    case "improv_challenge_rating":
    case "improv_challenge_reveal":
    case "improv_challenge_finished":
      return <ImprovChallengeView />;

    case "hum_it_humming":
    case "hum_it_guessing":
    case "hum_it_reveal":
    case "hum_it_finished":
      return <HumItView />;

    case "accent_challenge_performing":
    case "accent_challenge_rating":
    case "accent_challenge_finished":
      return <AccentChallengeView />;

    case "draw_it":
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

    case "intermission":
    default:
      return <IntermissionView />;
  }
}
