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
import { DrawItView }              from "../draw-it/DrawItView";
import { WouldYouRatherView }      from "../would-you-rather/WouldYouRatherView";
import { NeverHaveIEverView }      from "../never-have-i-ever/NeverHaveIEverView";
import { TruthOrDareView }         from "../truth-or-dare/TruthOrDareView";
import { TwoTruthsOneLieView }     from "../two-truths-one-lie/TwoTruthsOneLieView";
import { FakeNewsView }            from "../fake-news/FakeNewsView";
import { RankItView }              from "../rank-it/RankItView";
import { EmojiStoryView }          from "../emoji-story/EmojiStoryView";
import { CelebrityHeadView }       from "../celebrity-head/CelebrityHeadView";
import { WordAssociationView }     from "../word-association/WordAssociationView";
import { WhoKnowsWhoView }         from "../who-knows-who/WhoKnowsWhoView";
import { AlibiView }               from "../alibi/AlibiView";
import { MindReadingView }         from "../mind-reading/MindReadingView";
import { SpeedRoundView }          from "../speed-round/SpeedRoundView";
import { MimicMeView }             from "../mimic-me/MimicMeView";
import { ChainReactionView }       from "../chain-reaction/ChainReactionView";
import { PartyDiceView }           from "../party-dice/PartyDiceView";
import { ConnectionsView }         from "../connections/ConnectionsView";
import { LyricsDropView }          from "../lyrics-drop/LyricsDropView";
import { MusicalChairsView }       from "../musical-chairs/MusicalChairsView";
import { ThumbWarView }            from "../thumb-war/ThumbWarView";
import { PopCultureQuizView }     from "../pop-culture-quiz/PopCultureQuizView";
import { BucketListView }        from "../bucket-list/BucketListView";
import { FightOrFlightView }     from "../fight-or-flight/FightOrFlightView";
import { HotTakesView }          from "../hot-takes/HotTakesView";
import { StoryTimeView }         from "../story-time/StoryTimeView";
import { BuzzerView }            from "../buzzer/BuzzerView";
import { RoastmasterView }       from "../roastmaster/RoastmasterView";
import { ReflexView }            from "../reflex/ReflexView";

export function ExperiencePlayerView() {
  const { state } = useRoom();

  // During ready-up, show a universal waiting screen so every game has a clean pre-start state.
  // This fires for any game that doesn't resolve ready-up before emitting its first state event.
  if (state.readyUp.active) {
    return (
      <WaitingForPlayersView
        emoji="🎮" accent="#7c3aed"
        title="Game Starting Soon!"
        subtitle="Tap Ready when you're set to play"
        submittedCount={state.readyUp.readyCount}
        totalCount={state.readyUp.totalCount}
      />
    );
  }

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

    case "draw_it":           return <DrawItView />;

    case "would_you_rather":    return <WouldYouRatherView />;
    case "never_have_i_ever":   return <NeverHaveIEverView />;
    case "truth_or_dare":       return <TruthOrDareView />;
    case "two_truths_one_lie":  return <TwoTruthsOneLieView />;

    case "rank_it":           return <RankItView />;
    case "emoji_story":       return <EmojiStoryView />;
    case "celebrity_head":    return <CelebrityHeadView />;
    case "word_association":  return <WordAssociationView />;
    case "who_knows_who":     return <WhoKnowsWhoView />;
    case "fake_news":         return <FakeNewsView />;
    case "alibi":             return <AlibiView />;
    case "mind_reading":      return <MindReadingView />;
    case "speed_round":       return <SpeedRoundView />;
    case "mimic_me":          return <MimicMeView />;
    case "chain_reaction":    return <ChainReactionView />;
    case "party_dice":        return <PartyDiceView />;
    case "connections":       return <ConnectionsView />;
    case "lyrics_drop":       return <LyricsDropView />;
    case "musical_chairs":    return <MusicalChairsView />;
    case "thumb_war":         return <ThumbWarView />;

    case "pop_culture_quiz":  return <PopCultureQuizView />;

    case "bucket_list":       return <BucketListView />;
    case "fight_or_flight":   return <FightOrFlightView />;
    case "hot_takes":         return <HotTakesView />;
    case "story_time":        return <StoryTimeView />;

    case "buzzer":            return <BuzzerView />;
    case "roastmaster":       return <RoastmasterView />;
    case "reflex":            return <ReflexView />;

    case "intermission":
    default:
      return <IntermissionView />;
  }
}
