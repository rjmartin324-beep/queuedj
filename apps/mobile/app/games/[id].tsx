import React from "react";
import { useLocalSearchParams } from "expo-router";
import PartyTriviaScreen from "../../src/screens/games/PartyTriviaScreen";
import WouldYouRatherScreen from "../../src/screens/games/WouldYouRatherScreen";
import NeverHaveIEverScreen from "../../src/screens/games/NeverHaveIEverScreen";
import TruthOrDareScreen from "../../src/screens/games/TruthOrDareScreen";
import HotTakesScreen from "../../src/screens/games/HotTakesScreen";
import RankItScreen from "../../src/screens/games/RankItScreen";
import LyricsDropScreen from "../../src/screens/games/LyricsDropScreen";
import EmojiStoryScreen from "../../src/screens/games/EmojiStoryScreen";
import CelebrityHeadScreen from "../../src/screens/games/CelebrityHeadScreen";
import TwoTruthsOneLieScreen from "../../src/screens/games/TwoTruthsOneLieScreen";
import WordAssociationScreen from "../../src/screens/games/WordAssociationScreen";
import WhoKnowsWhoScreen from "../../src/screens/games/WhoKnowsWhoScreen";
import StoryTimeScreen from "../../src/screens/games/StoryTimeScreen";
import FakeNewsScreen from "../../src/screens/games/FakeNewsScreen";
import BucketListScreen from "../../src/screens/games/BucketListScreen";
import FightOrFlightScreen from "../../src/screens/games/FightOrFlightScreen";
import PopCultureQuizScreen from "../../src/screens/games/PopCultureQuizScreen";
import ImprovChallengeScreen from "../../src/screens/games/ImprovChallengeScreen";
import AlibiScreen from "../../src/screens/games/AlibiScreen";
import CroppedLookScreen from "../../src/screens/games/CroppedLookScreen";
import MindReadingScreen from "../../src/screens/games/MindReadingScreen";
import SpeedRoundScreen from "../../src/screens/games/SpeedRoundScreen";
import MusicalChairsScreen from "../../src/screens/games/MusicalChairsScreen";
import ThumbWarScreen from "../../src/screens/games/ThumbWarScreen";
import PhotoBombScreen from "../../src/screens/games/PhotoBombScreen";
import HumItScreen from "../../src/screens/games/HumItScreen";
import MimicMeScreen from "../../src/screens/games/MimicMeScreen";
import AccentChallengeScreen from "../../src/screens/games/AccentChallengeScreen";
import DrawItScreen from "../../src/screens/games/DrawItScreen";
import SpeedTypingScreen from "../../src/screens/games/SpeedTypingScreen";
import ConnectionsScreen from "../../src/screens/games/ConnectionsScreen";
import ChainReactionScreen from "../../src/screens/games/ChainReactionScreen";
import PartyDiceScreen from "../../src/screens/games/PartyDiceScreen";

const GAME_MAP: Record<string, React.ComponentType> = {
  // Full IDs
  party_trivia: PartyTriviaScreen,
  would_you_rather: WouldYouRatherScreen,
  never_have_i_ever: NeverHaveIEverScreen,
  truth_or_dare: TruthOrDareScreen,
  hot_takes: HotTakesScreen,
  rank_it: RankItScreen,
  lyrics_drop: LyricsDropScreen,
  emoji_story: EmojiStoryScreen,
  celebrity_head: CelebrityHeadScreen,
  two_truths_one_lie: TwoTruthsOneLieScreen,
  word_association: WordAssociationScreen,
  who_knows_who: WhoKnowsWhoScreen,
  story_time: StoryTimeScreen,
  fake_news: FakeNewsScreen,
  bucket_list: BucketListScreen,
  fight_or_flight: FightOrFlightScreen,
  pop_culture_quiz: PopCultureQuizScreen,
  improv_challenge: ImprovChallengeScreen,
  alibi: AlibiScreen,
  cropped_look: CroppedLookScreen,
  mind_reading: MindReadingScreen,
  speed_round: SpeedRoundScreen,
  musical_chairs: MusicalChairsScreen,
  thumb_war: ThumbWarScreen,
  photo_bomb: PhotoBombScreen,
  hum_it: HumItScreen,
  mimic_me: MimicMeScreen,
  accent_challenge: AccentChallengeScreen,
  draw_it: DrawItScreen,
  speed_typing: SpeedTypingScreen,
  connections: ConnectionsScreen,
  chain_reaction: ChainReactionScreen,
  party_dice: PartyDiceScreen,
  // Short-ID aliases used by GamesScreen CATEGORIES
  trivia: PartyTriviaScreen,
  two_truths: TwoTruthsOneLieScreen,
  pop_culture: PopCultureQuizScreen,
  improv: ImprovChallengeScreen,
  accent: AccentChallengeScreen,
};

export default function GameRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const Screen = GAME_MAP[id as string];
  if (!Screen) return null;
  return <Screen />;
}
