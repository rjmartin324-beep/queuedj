import type { ExperienceModule, ExperienceType } from "@queuedj/shared-types";
import { DJExperience } from "./dj";
import { TriviaExperience } from "./trivia";
import { UnpopularOpinionsExperience } from "./unpopular-opinions";
import { ScrapbookSabotageExperience } from "./scrapbook-sabotage";
import { TheGlitchExperience } from "./the-glitch";
import { CopyrightInfringementExperience } from "./copyright-infringement";
import { DrawbackExperience } from "./drawback";
import { ScavengerSnapExperience } from "./scavenger-snap";
import { GeoGuesserExperience } from "./geo-guesser";
import { ArtifactHuntExperience } from "./artifact-hunt";
import { NightShiftExperience } from "./night-shift";
import { MindMoleExperience } from "./mind-mole";
import { GuessSongExperience } from "./guess-the-song";
import { FinishLyricExperience } from "./finish-the-lyric";
import { NameGenreExperience } from "./name-that-genre";
import { VibeCheckExperience } from "./vibe-check";
// Party games
import { WouldYouRatherExperience } from "./would-you-rather";
import { NeverHaveIEverExperience } from "./never-have-i-ever";
import { TruthOrDareExperience } from "./truth-or-dare";
import { HotTakesExperience } from "./hot-takes";
import { TwoTruthsOneLieExperience } from "./two-truths-one-lie";
import { CelebrityHeadExperience } from "./celebrity-head";
import { ConnectionsExperience } from "./connections";
import { DrawItExperience } from "./draw-it";
import { WordAssociationExperience } from "./word-association";
import { ChainReactionExperience } from "./chain-reaction";
import { FakeNewsExperience } from "./fake-news";
import { EmojiStoryExperience } from "./emoji-story";
import { RankItExperience } from "./rank-it";
import { SpeedRoundExperience } from "./speed-round";
import { ThumbWarExperience } from "./thumb-war";
import { MusicalChairsExperience } from "./musical-chairs";
import { PopCultureQuizExperience } from "./pop-culture-quiz";
import { StoryTimeExperience } from "./story-time";
import { WhoKnowsWhoExperience } from "./who-knows-who";
import { BucketListExperience } from "./bucket-list";
import { FightOrFlightExperience } from "./fight-or-flight";
import { AlibiExperience } from "./alibi";
import { CroppedLookExperience } from "./cropped-look";
import { MindReadingExperience } from "./mind-reading";
import { ImprovChallengeExperience } from "./improv-challenge";
import { AccentChallengeExperience } from "./accent-challenge";
import { HumItExperience } from "./hum-it";
import { MimicMeExperience } from "./mimic-me";
import { LyricsDropExperience } from "./lyrics-drop";
import { PhotoBombExperience } from "./photo-bomb";
import { SpeedTypingExperience } from "./speed-typing";
import { PartyDiceExperience } from "./party-dice";
import { BuzzerExperience } from "./buzzer";
import { RoastmasterExperience } from "./roastmaster";
import { ReflexExperience } from "./reflex";

// ─────────────────────────────────────────────────────────────────────────────
// Experience Registry
//
// Single place that knows about every experience.
// To add a new experience (raffle, karaoke, etc.):
//   1. Create services/realtime/src/experiences/raffle/index.ts
//   2. Implement ExperienceModule
//   3. Register it here — one line
//   4. Done. Platform routes it automatically.
// ─────────────────────────────────────────────────────────────────────────────

const registry = new Map<ExperienceType, ExperienceModule>([
  ["dj",                     new DJExperience()],
  ["trivia",                 new TriviaExperience()],
  ["unpopular_opinions",     new UnpopularOpinionsExperience()],
  ["scrapbook_sabotage",     new ScrapbookSabotageExperience()],
  ["the_glitch",             new TheGlitchExperience()],
  ["copyright_infringement", new CopyrightInfringementExperience()],
  ["drawback",               new DrawbackExperience()],
  ["scavenger_snap",         new ScavengerSnapExperience()],
  ["geo_guesser",            new GeoGuesserExperience()],
  ["artifact_hunt",          new ArtifactHuntExperience()],
  ["night_shift",            new NightShiftExperience()],
  ["mind_mole",              new MindMoleExperience()],
  ["guess_the_song",         new GuessSongExperience()],
  ["finish_the_lyric",       new FinishLyricExperience()],
  ["name_that_genre",        new NameGenreExperience()],
  ["vibe_check",             new VibeCheckExperience()],
  // Party games
  ["would_you_rather",      new WouldYouRatherExperience()],
  ["never_have_i_ever",     new NeverHaveIEverExperience()],
  ["truth_or_dare",         new TruthOrDareExperience()],
  ["hot_takes",             new HotTakesExperience()],
  ["two_truths_one_lie",    new TwoTruthsOneLieExperience()],
  ["celebrity_head",        new CelebrityHeadExperience()],
  ["connections",           new ConnectionsExperience()],
  ["draw_it",               new DrawItExperience()],
  ["word_association",      new WordAssociationExperience()],
  ["chain_reaction",        new ChainReactionExperience()],
  ["fake_news",             new FakeNewsExperience()],
  ["emoji_story",           new EmojiStoryExperience()],
  ["rank_it",               new RankItExperience()],
  ["speed_round",           new SpeedRoundExperience()],
  ["thumb_war",             new ThumbWarExperience()],
  ["musical_chairs",        new MusicalChairsExperience()],
  ["pop_culture_quiz",      new PopCultureQuizExperience()],
  ["story_time",            new StoryTimeExperience()],
  ["who_knows_who",         new WhoKnowsWhoExperience()],
  ["bucket_list",           new BucketListExperience()],
  ["fight_or_flight",       new FightOrFlightExperience()],
  ["alibi",                 new AlibiExperience()],
  ["cropped_look",          new CroppedLookExperience()],
  ["mind_reading",          new MindReadingExperience()],
  ["improv_challenge",      new ImprovChallengeExperience()],
  ["accent_challenge",      new AccentChallengeExperience()],
  ["hum_it",                new HumItExperience()],
  ["mimic_me",              new MimicMeExperience()],
  ["lyrics_drop",           new LyricsDropExperience()],
  ["photo_bomb",            new PhotoBombExperience()],
  ["speed_typing",          new SpeedTypingExperience()],
  ["party_dice",            new PartyDiceExperience()],
  ["buzzer",                new BuzzerExperience()],
  ["roastmaster",           new RoastmasterExperience()],
  ["reflex",                new ReflexExperience()],
]);

export function getExperience(type: ExperienceType): ExperienceModule {
  const experience = registry.get(type);
  if (!experience) throw new Error(`Unknown experience: ${type}`);
  return experience;
}

export function isValidExperience(type: string): type is ExperienceType {
  return registry.has(type as ExperienceType);
}
