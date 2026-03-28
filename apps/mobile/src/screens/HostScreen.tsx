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
import { NightShiftControls }        from "../components/host/controls/NightShiftControls";
import { MindMoleControls }          from "../components/host/controls/MindMoleControls";
import { GuessSongControls }         from "../components/host/controls/GuessSongControls";
import { NameGenreControls }         from "../components/host/controls/NameGenreControls";
import { VibeCheckControls }         from "../components/host/controls/VibeCheckControls";
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
import { ExperiencePlayerView } from "../components/experiences/shared/ExperiencePlayerView";

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
  { type: "night_shift",            label: "Night Shift",      emoji: "🌙" },
  { type: "mind_mole",              label: "Mind Mole",        emoji: "🦔" },
  { type: "guess_the_song",         label: "Guess the Song",   emoji: "🎵" },
  { type: "name_that_genre",        label: "Name the Genre",   emoji: "🎼" },
  { type: "vibe_check",             label: "Vibe Check",       emoji: "✨" },
];

type Tab = "controls" | "queue" | "guests" | "history" | "recs" | "settings" | "demo";

const GAME_META: Record<string, { tagline: string; players: string; time: string; age: string; steps: string[]; rules: string[] }> = {
  trivia: { tagline: "Test your knowledge against the crowd", players: "2–20", time: "10–20 min", age: "All ages",
    steps: ["Questions appear on every phone at the same time", "Everyone submits their answer on their phone", "Points awarded for correct + fast answers", "Most points after all rounds wins"],
    rules: ["No googling allowed", "15 seconds per question", "Fastest correct answer gets bonus points"] },
  unpopular_opinions: { tagline: "Guess who said what — can you read the room?", players: "3–20", time: "15–25 min", age: "13+",
    steps: ["Everyone submits an unpopular opinion", "Players guess who wrote each opinion", "Points for correct guesses and fooling others", "Most points wins"],
    rules: ["Keep it fun, not mean", "Opinions must be your own", "No hinting about your submission"] },
  scrapbook_sabotage: { tagline: "Write a story — then sabotage it", players: "3–16", time: "15–20 min", age: "13+",
    steps: ["Each player writes story snippets", "Others secretly sabotage with silly words", "Group reads the final story together", "Vote for the funniest saboteur"],
    rules: ["Keep it appropriate", "Sabotages must fit grammatically", "No revealing who did what until the vote"] },
  the_glitch: { tagline: "Describe what you watched — without giving it away", players: "3–16", time: "10–20 min", age: "All ages",
    steps: ["A short video clip is shown", "Players describe what they saw — poorly", "Others guess what the clip actually showed", "Points for best descriptions and guesses"],
    rules: ["No spoilers in your description", "Keep descriptions under 20 words", "Vote for the most misleading description"] },
  copyright_infringement: { tagline: "Recreate famous images — badly on purpose", players: "3–20", time: "10–15 min", age: "All ages",
    steps: ["Host names a famous image or logo", "Everyone draws it from memory on their phone", "Gallery of all drawings revealed", "Vote for the best (worst) recreation"],
    rules: ["No tracing or looking it up", "Draw as fast as you can", "Funnier is better"] },
  drawback: { tagline: "Draw what the prompt says — no peeking", players: "3–20", time: "10–20 min", age: "All ages",
    steps: ["Each player gets a secret prompt", "Draw it on your phone screen", "Others guess what you drew", "Points for guessing right and fooling others"],
    rules: ["No letters or numbers in your drawing", "30 seconds to draw", "No hints beyond the drawing"] },
  scavenger_snap: { tagline: "Find it, snap it, win it", players: "2–20", time: "15–30 min", age: "All ages",
    steps: ["Host sends a photo challenge item", "Players race to find and photograph it", "First valid photo in wins the round", "Most rounds won takes the prize"],
    rules: ["Items must be physically found, not image searched", "Photo must be taken in real time", "Host judges validity"] },
  geo_guesser: { tagline: "Where in the world is this landmark?", players: "2–20", time: "10–15 min", age: "All ages",
    steps: ["A mystery location clue is shown", "Drop your pin or pick your region on the map", "Closest guess wins the round", "5 rounds — highest score wins"],
    rules: ["No Googling the location", "30 seconds to guess", "Points based on accuracy"] },
  would_you_rather: { tagline: "Two options. No escape. Choose wisely.", players: "2–30", time: "10–20 min", age: "13+",
    steps: ["A 'would you rather' question appears on screen", "Everyone votes on their phone", "Results revealed — minorities defend their choice", "Most crowd-pleasing answers earn bonus points"],
    rules: ["You MUST pick one option", "No 'neither' allowed", "Explain your choice if you're in the minority"] },
  never_have_i_ever: { tagline: "Raise a finger if you've done it", players: "3–20", time: "15–30 min", age: "18+",
    steps: ["A statement appears on screen", "Everyone who has done it puts a finger down", "Last player with fingers up wins", "Elimination style — runs until one remains"],
    rules: ["You must be honest", "No judgement zone", "Custom statements can be added by host"] },
  truth_or_dare: { tagline: "Pick your fate — truth or dare?", players: "3–16", time: "20–40 min", age: "13+",
    steps: ["Player picks truth or dare", "The app generates the prompt", "Complete the challenge to stay in", "Refuse and lose a life"],
    rules: ["You must attempt every prompt", "Keep it fun and consensual", "Host can skip inappropriate prompts"] },
  two_truths_one_lie: { tagline: "Spot the liar in the room", players: "3–20", time: "10–20 min", age: "All ages",
    steps: ["Each player submits 2 truths and 1 lie", "Others vote on which statement is the lie", "Points for guessing right and fooling others", "Most points wins"],
    rules: ["Keep truths real but interesting", "Lies must be plausible", "No changing answers after submission"] },
  celebrity_head: { tagline: "Famous face on your forehead", players: "3–16", time: "10–25 min", age: "All ages",
    steps: ["A celebrity name appears on your forehead", "Ask yes/no questions to figure out who you are", "Others can only answer yes or no", "Guess your celebrity before time runs out"],
    rules: ["Questions must be yes/no format", "Each player gets one guess per round", "If you guess wrong you lose a turn", "Most correct guesses wins"] },
  connections: { tagline: "Find the common thread", players: "2–20", time: "10–20 min", age: "All ages",
    steps: ["16 words appear on screen", "Group them into 4 categories of 4", "Tap to select and submit your grouping", "Color reveals how close you were"],
    rules: ["One wrong guess per category is allowed", "All 4 words must belong together", "Categories can be tricky — think laterally", "Complete all 4 groups to win"] },
  word_association: { tagline: "One word leads to another", players: "2–20", time: "5–15 min", age: "All ages",
    steps: ["A starting word appears on screen", "Say the first word that comes to mind", "Chain continues around the room", "Any hesitation or repeat word = eliminated"],
    rules: ["No pausing for more than 3 seconds", "Single words only — no phrases", "If two players say the same word, both are out", "Last player standing wins"] },
  chain_reaction: { tagline: "Trigger the avalanche", players: "3–16", time: "10–20 min", age: "All ages",
    steps: ["A category is given to start the chain", "Each player adds one item that connects to the last", "The chain must logically flow", "Break the chain and you're out"],
    rules: ["Connections must be explained if challenged", "No direct repeats from the chain", "Majority vote decides if a connection is valid", "Last one in the chain wins"] },
  fake_news: { tagline: "Real or totally made up?", players: "3–20", time: "10–20 min", age: "All ages",
    steps: ["A news headline appears on screen", "Guess if it's real or fake", "Points for correct guesses", "Bonus round: write your own fake headlines"],
    rules: ["No Googling allowed", "Vote before the timer runs out", "Bonus points for most convincing fake", "All votes revealed simultaneously"] },
  emoji_story: { tagline: "Tell it in emojis only", players: "2–20", time: "10–20 min", age: "All ages",
    steps: ["A movie, book or phrase is assigned to you", "Represent it using only emojis", "Others guess what you're describing", "Points for the fastest correct guess"],
    rules: ["Emojis only — no text", "30 seconds to compose your emoji story", "One guess per player per submission", "Closest guess wins if no exact match"] },
  rank_it: { tagline: "Sort it out — your way", players: "2–20", time: "10–20 min", age: "All ages",
    steps: ["A list of items appears on screen", "Rank them in order on your phone", "Compare your rankings with everyone else", "Points for matching the crowd consensus"],
    rules: ["All items must be ranked — no ties", "Rankings are locked after 30 seconds", "Closest to crowd average scores most", "Wildly unique rankings get a special badge"] },
  speed_round: { tagline: "Fast fingers, faster thinking", players: "2–20", time: "5–15 min", age: "All ages",
    steps: ["Questions flash on screen one by one", "Answer as fast as possible on your phone", "Speed matters — first correct answer wins the point", "Most points after 20 questions wins"],
    rules: ["No second attempts on the same question", "Questions auto-advance after 10 seconds", "Must type answer — voice not accepted", "Spelling must be close enough to count"] },
  thumb_war: { tagline: "The ultimate digital showdown", players: "2–16", time: "5–10 min", age: "All ages",
    steps: ["Two players face off at a time", "Compete in rapid reflex mini-games", "Win 3 rounds to advance", "Tournament continues until one champion remains"],
    rules: ["No touching other players' phones", "Phone face-up on a flat surface", "Rematches only if there's a technical issue", "Champion plays all challengers in sequence"] },
  musical_chairs: { tagline: "When the music stops...", players: "4–20", time: "10–15 min", age: "All ages",
    steps: ["Music plays and everyone moves around", "When music stops everyone races to tap their phone", "Slowest player is eliminated each round", "Last player standing wins"],
    rules: ["You must be standing when music plays", "No holding your phone while music plays", "Disputes resolved by reaction-time timestamp", "Eliminated players become judges"] },
  pop_culture_quiz: { tagline: "How plugged in are you?", players: "2–20", time: "15–25 min", age: "13+",
    steps: ["Pop culture questions appear on screen", "Buzz in first then answer", "Categories span movies, music, TV, memes and more", "Most points after all rounds wins"],
    rules: ["No Googling", "Buzz before you're ready and you lose a point", "Host can challenge any answer", "Ties broken by a lightning round"] },
  who_knows_who: { tagline: "How well do you know each other?", players: "4–20", time: "15–30 min", age: "All ages",
    steps: ["Personal questions about players in the room", "Guess which player the question is describing", "Points for knowing your crew the best", "Surprise reveals at the end"],
    rules: ["Questions are about people in the room", "No hints from the person being described", "Choices locked after 15 seconds", "Most correct guesses wins"] },
  alibi: { tagline: "Someone's lying. Find out who.", players: "4–16", time: "20–35 min", age: "13+",
    steps: ["One player is assigned a secret role", "Everyone constructs an alibi", "Players are questioned one by one", "Vote on who you think is lying"],
    rules: ["Stick to your alibi once told", "Questioners get 2 questions each", "The accused cannot directly deny", "Majority vote decides the verdict"] },
  cropped_look: { tagline: "What's hiding in plain sight?", players: "2–20", time: "10–20 min", age: "All ages",
    steps: ["A cropped section of an image appears on screen", "Guess what the full image is", "More of the image is revealed over time", "Faster guesses score more points"],
    rules: ["Only one guess per reveal stage", "Incorrect guess locks you out until next reveal", "Identical guesses split the points", "Bonus for guessing on the first reveal"] },
  mind_reading: { tagline: "Think it. Broadcast it.", players: "3–16", time: "10–20 min", age: "All ages",
    steps: ["One player thinks of a word or thing", "Others ask only yes/no questions", "Limited to 20 questions total per round", "First to guess correctly earns the points"],
    rules: ["The thinker can only say yes, no, or sometimes", "No body language hints allowed", "Questions must be answerable yes/no", "If nobody guesses in 20 questions the thinker wins"] },
  improv_challenge: { tagline: "No script. No safety net.", players: "3–16", time: "15–30 min", age: "13+",
    steps: ["A random scenario is assigned to 2-4 players", "They improvise a scene for 60-90 seconds", "Rest of the room rates the performance", "Highest rated performance wins the round"],
    rules: ["Accept everything your scene partner offers", "No breaking character mid-scene", "Audience must stay silent during performance", "Ratings are anonymous and revealed together"] },
  accent_challenge: { tagline: "Say it with a twist", players: "2–20", time: "10–20 min", age: "All ages",
    steps: ["A phrase appears on screen", "Read it out loud in the assigned accent", "Others rate authenticity from 1-5", "Best average accent score wins"],
    rules: ["You must attempt every assigned accent", "No mocking — keep it fun", "Rating must be submitted before next player goes", "Host can add custom phrases between rounds"] },
  hum_it: { tagline: "No lyrics. Just the tune.", players: "2–20", time: "10–20 min", age: "All ages",
    steps: ["A song is secretly shown to one player", "They hum it without any words", "Others race to guess the song title", "First correct guess scores for both guesser and hummer"],
    rules: ["No words, beats, or rhythm — melody only", "30 seconds to hum before passing", "No mouthing the words while humming", "Hummer gets bonus points if song goes unguessed"] },
  mimic_me: { tagline: "Copy that — if you can", players: "3–16", time: "10–20 min", age: "All ages",
    steps: ["One player performs a random action or expression", "Everyone else tries to copy it exactly", "The crowd votes on who did it best", "Most votes accumulated wins"],
    rules: ["The original player acts for 5 seconds only", "No coaching other players", "Vote before the timer runs out", "You cannot vote for yourself"] },
  lyrics_drop: { tagline: "Finish the lyric or lose the beat", players: "2–20", time: "10–20 min", age: "13+",
    steps: ["A song lyric appears on screen — cut off mid-line", "Type or say the next words before time runs out", "Points for accuracy and speed", "Bonus points for getting it word-perfect"],
    rules: ["Close enough counts — host makes the final call", "Songs span multiple decades and genres", "No phone searches allowed", "Tiebreaker is a one-on-one lyric battle"] },
  party_dice: { tagline: "Roll your fate", players: "2–10", time: "10–20 min", age: "18+",
    steps: ["Each player rolls the virtual dice on their phone", "Dice face determines your challenge for the round", "Complete the challenge to earn points", "Game ends when all challenges are exhausted"],
    rules: ["You must attempt what you roll — no trading", "Challenge difficulty shown before you commit", "Host can remove any challenge type before the game", "Doubles earns an automatic bonus point"] },
};

function getGameMeta(type: string) {
  return GAME_META[type] ?? {
    tagline: "A fun party game for everyone",
    players: "2–20", time: "10–20 min", age: "All ages",
    steps: ["Host launches the game", "Everyone plays on their phone", "Compete and score points", "Winner takes the crown"],
    rules: ["Play fair", "Have fun", "No cheating"],
  };
}

const GAME_CHIPS = EXPERIENCES.filter(e => e.type !== "dj");

export default function HostScreen() {
  const { state, switchExperience, dispatch } = useRoom();
  const [tab, setTab] = useState<Tab>("controls");
  const [gameViewMode, setGameViewMode] = useState<"player" | "host">("host");
  const [chatOpen,      setChatOpen]      = useState(false);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [djExpanded,    setDjExpanded]    = useState(false);
  const [showAllOptions, setShowAllOptions] = useState(false);
  const [showAllGames, setShowAllGames] = useState(false);
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
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
      case "night_shift":            return <NightShiftControls {...vmProps} />;
      case "mind_mole":              return <MindMoleControls {...vmProps} />;
      case "guess_the_song":         return <GuessSongControls {...vmProps} />;
      case "name_that_genre":        return <NameGenreControls {...vmProps} />;
      case "vibe_check":             return <VibeCheckControls {...vmProps} />;
      default:                       return null;
    }
  }

  const activeGame = GAME_CHIPS.find(e => e.type === state.activeExperience);

  const SECONDARY_TABS: { id: Tab; label: string; badge?: number }[] = [
    { id: "controls", label: "Controls" },
    { id: "guests",   label: "Guests",   badge: state.members.length || undefined },
    { id: "recs",     label: "AI Picks" },
    { id: "history",  label: "History" },
    { id: "settings", label: "Room" },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={["#050512", "#08051a", "#0a0520"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <OfflineBanner isOffline={state.isOffline} />

      {/* TOP BAR */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleExit} style={styles.exitBtn}>
          <Text style={styles.exitBtnText}>← Exit</Text>
        </TouchableOpacity>
        <View style={styles.topBarCenter}>
          <Text style={styles.roomLabel}>Room Code</Text>
          <InviteLinkButton roomCode={roomCode} />
        </View>
        <View style={styles.topRight}>
          <RoomQRCode roomCode={roomCode} />
          <TouchableOpacity onPress={() => setShowAllOptions(true)} style={styles.menuBtn}>
            <Text style={styles.menuBtnText}>⋯</Text>
          </TouchableOpacity>
          <Text style={styles.guestCount}>{state.members.length}</Text>
          <Text style={styles.guestLabel}>guests</Text>
        </View>
      </View>

      {/* CONNECTED BAR */}
      <ConnectionBar isOffline={state.isOffline} memberCount={state.members.length} />

      {/* SUB-NAV - pills row */}
      <View style={[styles.subNav, styles.subNavContent]}>
        {SECONDARY_TABS.map(({ id, label, badge }) => {
          const on = tab === id;
          return (
            <TouchableOpacity key={id} style={[styles.subTab, on && styles.subTabActive]} onPress={() => setTab(id)} activeOpacity={0.75}>
              <Text style={[styles.subTabText, on && styles.subTabTextActive]}>{label}</Text>
              {badge !== undefined && badge > 0 && (
                <View style={styles.subTabBadge}><Text style={styles.subTabBadgeText}>{badge}</Text></View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* CONTENT AREA */}
      <View style={{ flex: 1 }}>
        <Animated.View style={{ flex: 1, opacity: controlsFade }}>
          {tab === "controls" ? (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Games section */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionLabel}>Games & Activities</Text>
                  <TouchableOpacity style={styles.viewAllBtn} onPress={() => setShowAllGames(v => !v)}>
                    <Text style={styles.viewAllBtnText}>{showAllGames ? "Show Less ↑" : "View All ↓"}</Text>
                  </TouchableOpacity>
                </View>
                {activeGame && (
                  <View style={styles.activeGameBanner}>
                    <View style={styles.activeGameDot} />
                    <Text style={styles.activeGameText}>{activeGame.emoji}  {activeGame.label} — active</Text>
                  </View>
                )}
                {state.readyUp?.active && (
                  <View style={styles.readyBanner}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={styles.readyBannerText}>
                        ✋ {state.readyUp.readyCount} / {state.readyUp.totalCount} ready
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          const socket = socketManager.get();
                          if (socket && state.room?.id) socket.emit("room:force_start" as any, { roomId: state.room.id });
                        }}
                        style={{ backgroundColor: "#7c3aed", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 }}
                        activeOpacity={0.8}
                      >
                        <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>Start Now</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.readyBarTrack}>
                      <View style={[styles.readyBarFill, { width: `${state.readyUp.totalCount > 0 ? Math.round((state.readyUp.readyCount / state.readyUp.totalCount) * 100) : 0}%` as any }]} />
                    </View>
                  </View>
                )}
                <View style={styles.appsGrid}>
                  {(showAllGames ? GAME_CHIPS : GAME_CHIPS.slice(0, 6)).map(({ type, label, emoji }) => {
                    const active = state.activeExperience === type;
                    return (
                      <TouchableOpacity key={type} style={[styles.appCard, active && styles.appCardActive]} onPress={() => setSelectedGame(type)} activeOpacity={0.75}>
                        <Text style={styles.appIcon}>{emoji}</Text>
                        <Text style={[styles.appName, active && styles.appNameActive]} numberOfLines={2}>{label}</Text>
                        {active && <View style={styles.appActiveDot} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Play as player button — only shown when a game is active */}
              {state.activeExperience && state.activeExperience !== "dj" && gameViewMode === "host" && (
                <TouchableOpacity
                  style={styles.playAsPlayerBtn}
                  onPress={() => setGameViewMode("player")}
                  activeOpacity={0.85}
                >
                  <Text style={styles.playAsPlayerText}>🎮  Play as Player</Text>
                </TouchableOpacity>
              )}

              {/* Game controls */}
              <View style={styles.controlsWrap}>
                {renderControls()}
              </View>

              {/* DJ Section — inline, below game controls */}
              <View style={styles.djSection}>
                <TouchableOpacity style={styles.djToggleRow} onPress={() => setDjExpanded(v => !v)} activeOpacity={0.85}>
                  <View style={styles.djToggleLeft}>
                    <Text style={styles.djToggleIcon}>🤖</Text>
                    <View>
                      <Text style={styles.djToggleName}>DJ Mode</Text>
                      <Text style={styles.djToggleSub}>Spotify + Decks + AI DJ</Text>
                    </View>
                  </View>
                  <View style={[styles.toggleTrack, djExpanded && styles.toggleTrackOn]}>
                    <View style={[styles.toggleThumb, djExpanded && styles.toggleThumbOn]} />
                  </View>
                </TouchableOpacity>
                {djExpanded && (
                  <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
                    <DJControls />
                    <View style={styles.djQueueDivider}>
                      <Text style={styles.djQueueLabel}>QUEUE</Text>
                    </View>
                    <HostQueueView />
                  </View>
                )}
              </View>
            </ScrollView>
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
          ) : tab === "demo" && __DEV__ ? (
            <DevTestPanel />
          ) : null}
        </Animated.View>
      </View>

      {/* Player mode overlay — full screen, sits above everything */}
      {gameViewMode === "player" && state.activeExperience && state.activeExperience !== "dj" && (
        <View style={StyleSheet.absoluteFillObject}>
          <LinearGradient colors={["#03001c", "#07001a", "#0a0018"]} style={StyleSheet.absoluteFill} />
          <ExperiencePlayerView />
          <TouchableOpacity
            style={styles.hostViewBar}
            onPress={() => setGameViewMode("host")}
            activeOpacity={0.85}
          >
            <Text style={styles.hostViewBarText}>🎛️  Back to Host Controls</Text>
          </TouchableOpacity>
        </View>
      )}

      <ChatTicker roomId={state.room?.id ?? ""} />

      <View style={styles.chatFab}>
        <ChatFloatingButton onPress={() => { setChatOpen(true); setUnreadCount(0); }} unreadCount={unreadCount} />
      </View>

      <PartyChatPanel visible={chatOpen} onClose={() => setChatOpen(false)} unreadCount={unreadCount} onRead={() => setUnreadCount(0)} />

      {/* GAME INFO SHEET MODAL */}
      <Modal visible={selectedGame !== null} transparent animationType="slide" onRequestClose={() => setSelectedGame(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setSelectedGame(null)} />
          {selectedGame && (() => {
            const chip = GAME_CHIPS.find(g => g.type === selectedGame);
            const meta = getGameMeta(selectedGame);
            if (!chip) return null;
            return (
              <View style={styles.gameSheet}>
                <View style={styles.sheetHandle} />
                <View style={styles.modalHeader}>
                  <View style={styles.modalIconTitle}>
                    <View style={styles.modalBigIcon}><Text style={styles.modalBigIconText}>{chip.emoji}</Text></View>
                    <View>
                      <Text style={styles.modalGameName}>{chip.label}</Text>
                      <Text style={styles.modalTagline}>{meta.tagline}</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.modalClose} onPress={() => setSelectedGame(null)}>
                    <Text style={styles.modalCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.modalPills}>
                  <View style={[styles.pill, styles.pillPlayers]}><Text style={styles.pillIcon}>👥</Text><Text style={styles.pillText}>{meta.players}</Text></View>
                  <View style={[styles.pill, styles.pillTime]}><Text style={styles.pillIcon}>⏱</Text><Text style={styles.pillText}>{meta.time}</Text></View>
                  <View style={[styles.pill, styles.pillAge]}><Text style={styles.pillIcon}>⭐</Text><Text style={styles.pillText}>{meta.age}</Text></View>
                </View>

                <View style={styles.modalDivider} />

                <ScrollView style={styles.gameSheetScroll} showsVerticalScrollIndicator={false}>
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>HOW TO PLAY</Text>
                    <View style={styles.howToSteps}>
                      {meta.steps.map((step, i) => (
                        <View key={i} style={styles.step}>
                          <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
                          <Text style={styles.stepText}>{step}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View style={styles.modalDivider} />

                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>RULES</Text>
                    <View style={styles.rulesList}>
                      {meta.rules.map((rule, i) => (
                        <View key={i} style={styles.ruleItem}>
                          <View style={styles.ruleDot} />
                          <Text style={styles.ruleText}>{rule}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <View style={{ height: 24 }} />
                </ScrollView>

                <TouchableOpacity
                  style={styles.launchBtn}
                  onPress={() => {
                    switchExperienceAnimated(selectedGame as any);
                    setTab("controls");
                    setGameViewMode("host");
                    setSelectedGame(null);
                  }}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={["#7c3aed", "#a78bfa"]} style={styles.launchBtnGrad}>
                    <Text style={styles.launchBtnText}>🚀 Launch {chip.label}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            );
          })()}
        </View>
      </Modal>

      {/* ALL OPTIONS SHEET */}
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
                ...(__DEV__ ? [{ id: "demo" as Tab, label: "Dev Panel", icon: "🧪", sub: "Test events" }] : []),
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
  container: { flex: 1, backgroundColor: "#0a0a0f" },

  // TOP BAR
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#12101e", borderBottomWidth: 1, borderBottomColor: "#2a2450",
    paddingHorizontal: 16, paddingVertical: 14,
  },
  exitBtn: {
    backgroundColor: "#1e1b30", borderWidth: 1, borderColor: "#3a3260",
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
  },
  exitBtnText: { color: "#9990cc", fontSize: 12, fontWeight: "700" },
  topBarCenter: { alignItems: "center", flex: 1 },
  roomLabel: { color: "#6a64a0", fontSize: 9, fontWeight: "800", letterSpacing: 2, textTransform: "uppercase", marginBottom: 2 },
  topRight: { alignItems: "center", gap: 4 },
  menuBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#1e1b30", borderWidth: 1, borderColor: "#2a2450",
    alignItems: "center", justifyContent: "center",
  },
  menuBtnText: { color: "#9990cc", fontSize: 18, fontWeight: "700", lineHeight: 22 },
  guestCount: { color: "#a78bfa", fontSize: 18, fontWeight: "900", lineHeight: 22 },
  guestLabel: { color: "#6a64a0", fontSize: 9, letterSpacing: 1 },

  // SUB-NAV
  subNav: { flexShrink: 0, flexGrow: 0, backgroundColor: "#0a0a0f" },
  subNavContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 4, flexDirection: "row" },
  subTab: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: "#12101e", borderWidth: 1, borderColor: "#1e1b30",
  },
  subTabActive: { backgroundColor: "#1e1b40", borderColor: "#a78bfa" },
  subTabText: { color: "#6a64a0", fontSize: 11, fontWeight: "500" },
  subTabTextActive: { color: "#c4b5fd" },
  subTabBadge: {
    position: "absolute", top: -4, right: -4,
    backgroundColor: "#7c3aed", borderRadius: 8, minWidth: 16, height: 16,
    paddingHorizontal: 3, alignItems: "center", justifyContent: "center",
  },
  subTabBadgeText: { color: "#fff", fontSize: 8, fontWeight: "900" },

  // SECTION
  section: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4, backgroundColor: "#0a0a0f" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionLabel: { color: "#6a64a0", fontSize: 10, fontWeight: "700", letterSpacing: 2, textTransform: "uppercase", flex: 1 },
  viewAllBtn: { borderWidth: 1, borderColor: "#3a2f70", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 10 },
  viewAllBtnText: { color: "#a78bfa", fontSize: 11, fontWeight: "700" },

  // ACTIVE GAME BANNER
  activeGameBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 0, paddingVertical: 6, marginBottom: 8,
  },
  activeGameDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#a78bfa" },
  activeGameText: { color: "#a78bfa", fontSize: 11, fontWeight: "700" },
  readyBanner: {
    marginTop: 6, padding: 10, borderRadius: 10,
    backgroundColor: "rgba(168,85,247,0.12)", borderWidth: 1, borderColor: "rgba(168,85,247,0.3)", gap: 6,
  },
  readyBannerText: { color: "#c4b5fd", fontSize: 12, fontWeight: "700" },
  readyBarTrack: { height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" },
  readyBarFill: { height: "100%" as any, borderRadius: 2, backgroundColor: "#a855f7" },

  // APPS GRID
  appsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  appCard: {
    width: "31%", aspectRatio: 1,
    backgroundColor: "#12101e", borderWidth: 1, borderColor: "#1e1b30",
    borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 8,
    position: "relative", overflow: "hidden",
  },
  appCardActive: { backgroundColor: "rgba(167,139,250,0.1)", borderColor: "#a78bfa" },
  appIcon: { fontSize: 24, lineHeight: 28 },
  appName: { color: "#9990cc", fontSize: 11, fontWeight: "500", textAlign: "center", lineHeight: 14, paddingHorizontal: 4 },
  appNameActive: { color: "#c4b5fd" },
  appActiveDot: { position: "absolute", top: 6, right: 6, width: 6, height: 6, borderRadius: 3, backgroundColor: "#a78bfa" },

  // HOST VIEW RETURN BAR
  hostViewBar: { alignItems: "center", paddingVertical: 8, backgroundColor: "rgba(124,58,237,0.10)", borderBottomWidth: 1, borderBottomColor: "rgba(124,58,237,0.20)" },
  hostViewBarText: { color: "#a78bfa", fontSize: 12, fontWeight: "700" },
  playAsPlayerBtn: { marginHorizontal: 16, marginBottom: 8, alignItems: "center", paddingVertical: 8, borderRadius: 10, backgroundColor: "rgba(124,58,237,0.15)", borderWidth: 1, borderColor: "rgba(124,58,237,0.30)" },
  playAsPlayerText: { color: "#a78bfa", fontSize: 13, fontWeight: "700" },

  // CONTENT
  content: { padding: 16, gap: 12 },
  pickGamePrompt: { alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 36, paddingHorizontal: 24 },
  controlsWrap: {},
  pickGameEmoji: { fontSize: 52 },
  pickGameTitle: { color: "#e8e6ff", fontSize: 22, fontWeight: "900", textAlign: "center" },
  pickGameSub: { color: "#6a64a0", fontSize: 14, textAlign: "center", lineHeight: 21 },

  // DJ SECTION
  djSection: { marginHorizontal: 16, marginTop: 12, backgroundColor: "#12101e", borderWidth: 1, borderColor: "#2a2450", borderRadius: 12, overflow: "hidden" },
  djToggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
  djToggleLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  djToggleIcon: { fontSize: 20 },
  djToggleName: { color: "#e8e6ff", fontSize: 15, fontWeight: "600" },
  djToggleSub: { color: "#6a64a0", fontSize: 11, marginTop: 2 },
  toggleTrack: { width: 48, height: 26, backgroundColor: "#1e1b30", borderRadius: 13, borderWidth: 1, borderColor: "#2a2450", justifyContent: "center", paddingHorizontal: 3 },
  toggleTrackOn: { backgroundColor: "#a78bfa", borderColor: "#8b5cf6" },
  toggleThumb: { width: 20, height: 20, backgroundColor: "#fff", borderRadius: 10, alignSelf: "flex-start" },
  toggleThumbOn: { alignSelf: "flex-end" },
  djPanel: { maxHeight: 520 },
  djQueueDivider: { borderTopWidth: 1, borderTopColor: "#2a2450", marginTop: 16, paddingTop: 12 },
  djQueueLabel: { color: "#6a64a0", fontSize: 10, fontWeight: "800", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 },

  // CHAT FAB
  chatFab: { position: "absolute", bottom: 24, right: 16, zIndex: 20 },

  // MODAL OVERLAY
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(5,4,15,0.85)" },

  // GAME SHEET
  gameSheet: {
    backgroundColor: "#12101e", borderWidth: 1, borderColor: "#2a2450",
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: "85%", paddingBottom: 0,
  },
  sheetHandle: { width: 36, height: 4, backgroundColor: "#2a2450", borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 0 },
  modalHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: 20, paddingBottom: 0 },
  modalIconTitle: { flexDirection: "row", alignItems: "center", gap: 14, flex: 1 },
  modalBigIcon: { width: 60, height: 60, backgroundColor: "#1a1630", borderWidth: 1, borderColor: "#2a2450", borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  modalBigIconText: { fontSize: 32 },
  modalGameName: { fontSize: 22, fontWeight: "700", color: "#e8e6ff", lineHeight: 26 },
  modalTagline: { fontSize: 12, color: "#6a64a0", marginTop: 4 },
  modalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#1e1b30", borderWidth: 1, borderColor: "#2a2450", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  modalCloseText: { color: "#9990cc", fontSize: 14, fontWeight: "700" },

  // PILLS
  modalPills: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingTop: 16, flexWrap: "wrap" },
  pill: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1 },
  pillPlayers: { backgroundColor: "#1e1840", borderColor: "#3a2f70" },
  pillTime: { backgroundColor: "#0d1a12", borderColor: "#1a3a2a" },
  pillAge: { backgroundColor: "#1a1408", borderColor: "#3a2a10" },
  pillIcon: { fontSize: 13 },
  pillText: { fontSize: 11, color: "#9990cc" },

  modalDivider: { height: 1, backgroundColor: "#1e1b30", marginHorizontal: 20, marginTop: 18 },
  modalSection: { padding: 16, paddingTop: 16 },
  modalSectionTitle: { fontSize: 10, fontWeight: "800", letterSpacing: 2, textTransform: "uppercase", color: "#6a64a0", marginBottom: 10 },

  // HOW TO STEPS
  howToSteps: { gap: 10 },
  step: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#1e1840", borderWidth: 1, borderColor: "#3a2f70", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 },
  stepNumText: { color: "#a78bfa", fontSize: 11, fontWeight: "700" },
  stepText: { fontSize: 13, color: "#b0aed0", lineHeight: 20, flex: 1 },

  // RULES
  rulesList: { gap: 8 },
  ruleItem: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  ruleDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#a78bfa", flexShrink: 0, marginTop: 7 },
  ruleText: { fontSize: 13, color: "#b0aed0", lineHeight: 20, flex: 1 },

  gameSheetScroll: { maxHeight: 300 },

  // LAUNCH BUTTON
  launchBtn: { margin: 20, borderRadius: 12, overflow: "hidden" },
  launchBtnGrad: { paddingVertical: 14, alignItems: "center" },
  launchBtnText: { color: "#fff", fontSize: 14, fontWeight: "700", letterSpacing: 0.5 },

  // ALL OPTIONS SHEET
  allOptionsSheet: {
    backgroundColor: "#12101e", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: "88%", borderTopWidth: 1, borderColor: "#2a2450", paddingTop: 10,
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#1e1b30" },
  sheetTitle: { color: "#e8e6ff", fontSize: 17, fontWeight: "800" },
  sheetCloseBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#1e1b30", alignItems: "center", justifyContent: "center" },
  sheetCloseBtnText: { color: "#9990cc", fontSize: 13, fontWeight: "700" },
  sheetSection: { color: "#6a64a0", fontSize: 10, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 6 },
  sheetOption: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 13, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: "#1e1b30" },
  sheetOptionActive: { backgroundColor: "rgba(167,139,250,0.08)" },
  sheetOptionEmoji: { fontSize: 20, width: 26, textAlign: "center" },
  sheetOptionLabel: { color: "#b0aed0", fontSize: 14, fontWeight: "700" },
  sheetOptionLabelActive: { color: "#c4b5fd" },
  sheetOptionSub: { color: "#6a64a0", fontSize: 11, marginTop: 1 },
  sheetOptionCheck: { color: "#a78bfa", fontSize: 15, fontWeight: "900" },
  sheetDivider: { height: 1, backgroundColor: "#1e1b30", marginHorizontal: 20, marginTop: 8 },
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
