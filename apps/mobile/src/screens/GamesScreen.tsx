import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Modal, Animated, Dimensions, Platform, SafeAreaView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { GameLaunchModal, LaunchGame } from "../components/shared/GameLaunchModal";
import { GAME_DETAILS } from "../components/home/GamesCarousel";

const SW = Dimensions.get("window").width;
const CARD_W = (SW - 48) / 2;

// ─── Category definitions ────────────────────────────────────────────────────

interface GameEntry {
  id: string;
  title: string;
  tagline: string;
  emoji: string;
}

interface Category {
  id: string;
  label: string;
  emoji: string;
  colors: [string, string];
  accent: string;
  games: GameEntry[];
}

const CATEGORIES: Category[] = [
  {
    id: "trivia",
    label: "Trivia & Knowledge",
    emoji: "🧠",
    colors: ["#1a0060", "#0d0035"],
    accent: "#a78bfa",
    games: [
      { id: "trivia",       title: "Party Trivia",    tagline: "10 rounds, 10s each",        emoji: "🧠" },
      { id: "connections",  title: "Connections",     tagline: "Find the 4 groups",          emoji: "🔗" },
      { id: "fake_news",    title: "Fake News",       tagline: "Real or fake headline?",     emoji: "📰" },
      { id: "pop_culture",  title: "Pop Culture Quiz",tagline: "TV, film & music",           emoji: "🎬" },
      { id: "cropped_look", title: "Cropped Look",    tagline: "Zoom in and guess",          emoji: "🔎" },
      { id: "mind_reading", title: "Mind Reading",    tagline: "What comes next?",           emoji: "🔮" },
      { id: "speed_round",  title: "Speed Round",     tagline: "30 seconds to name them",   emoji: "⏱️" },
    ],
  },
  {
    id: "party",
    label: "Party Classics",
    emoji: "🎉",
    colors: ["#2a0010", "#150008"],
    accent: "#f87171",
    games: [
      { id: "never_have_i_ever", title: "Never Have I Ever", tagline: "Confess or drink",  emoji: "🤫" },
      { id: "truth_or_dare",     title: "Truth or Dare",     tagline: "Brave enough?",      emoji: "💀" },
      { id: "would_you_rather",  title: "Would You Rather",  tagline: "Pick your poison",   emoji: "🤔" },
      { id: "two_truths",        title: "Two Truths One Lie",tagline: "Spot the fake",       emoji: "🤥" },
      { id: "fight_or_flight",   title: "Fight or Flight",   tagline: "What would you do?", emoji: "💪" },
      { id: "who_knows_who",     title: "Who Knows Who",     tagline: "Who did it?",         emoji: "👥" },
      { id: "bucket_list",       title: "Bucket List",       tagline: "Guess who dreamed it",emoji: "🌍" },
      { id: "party_dice",        title: "Party Dice",        tagline: "Roll for a challenge",emoji: "🎲" },
    ],
  },
  {
    id: "music",
    label: "Music",
    emoji: "🎵",
    colors: ["#001a2a", "#000d14"],
    accent: "#22d3ee",
    games: [
      { id: "lyrics_drop",    title: "Lyrics Drop",    tagline: "Fill the blank",             emoji: "🎤" },
      { id: "hum_it",         title: "Hum It",         tagline: "Hum the tune",               emoji: "🎵" },
      { id: "musical_chairs", title: "Musical Chairs", tagline: "Tap before the music stops", emoji: "🪑" },
    ],
  },
  {
    id: "creative",
    label: "Creative",
    emoji: "🎨",
    colors: ["#1a0a30", "#0d0518"],
    accent: "#c084fc",
    games: [
      { id: "draw_it",     title: "Draw It",          tagline: "Draw, others guess",         emoji: "🎨" },
      { id: "emoji_story", title: "Emoji Story",      tagline: "Decode the emojis",          emoji: "😂" },
      { id: "story_time",  title: "Story Time",       tagline: "Build it word by word",      emoji: "📖" },
      { id: "improv",      title: "Improv Challenge", tagline: "Act the scene out",          emoji: "🎭" },
      { id: "accent",      title: "Accent Challenge", tagline: "Read it in the accent",      emoji: "🗣️" },
      { id: "mimic_me",    title: "Mimic Me",         tagline: "Copy the move",              emoji: "🪞" },
    ],
  },
  {
    id: "words",
    label: "Word Games",
    emoji: "🔤",
    colors: ["#00200a", "#001005"],
    accent: "#34d399",
    games: [
      { id: "word_association", title: "Word Association", tagline: "First word that pops",       emoji: "💭" },
      { id: "chain_reaction",   title: "Chain Reaction",   tagline: "Word starts with last letter",emoji: "🔗" },
      { id: "speed_typing",     title: "Speed Typing",     tagline: "Type it fastest",             emoji: "⌨️" },
    ],
  },
  {
    id: "mystery",
    label: "Mystery",
    emoji: "🕵️",
    colors: ["#0a0020", "#050010"],
    accent: "#a78bfa",
    games: [
      { id: "alibi",      title: "Alibi",    tagline: "Who did the crime?",   emoji: "🔍" },
      { id: "photo_bomb", title: "Photo Bomb",tagline: "Spot the odd one out", emoji: "💣" },
    ],
  },
  {
    id: "voting",
    label: "Voting & Opinions",
    emoji: "🗳️",
    colors: ["#1a1000", "#0d0800"],
    accent: "#fbbf24",
    games: [
      { id: "hot_takes",      title: "Hot Takes",      tagline: "Slide your opinion",  emoji: "🌡️" },
      { id: "rank_it",        title: "Rank It",        tagline: "Sort the list",       emoji: "🏆" },
      { id: "celebrity_head", title: "Celebrity Head", tagline: "Guess who you are",   emoji: "👑" },
    ],
  },
  {
    id: "active",
    label: "Fast & Active",
    emoji: "⚡",
    colors: ["#1a0000", "#0d0000"],
    accent: "#f87171",
    games: [
      { id: "thumb_war",    title: "Thumb War",    tagline: "Tap fastest to win",     emoji: "👍" },
      { id: "speed_round",  title: "Speed Round",  tagline: "30 seconds to name them",emoji: "⏱️" },
      { id: "photo_bomb",   title: "Photo Bomb",   tagline: "Spot the odd one out",   emoji: "💣" },
    ],
  },
];

// ─── Game Routes map ──────────────────────────────────────────────────────────
// Games that have a standalone screen in app/games/[id].tsx
const ROUTED_GAMES = new Set([
  "trivia","would_you_rather","never_have_i_ever","truth_or_dare","hot_takes",
  "rank_it","lyrics_drop","emoji_story","celebrity_head","two_truths",
  "word_association","who_knows_who","story_time","fake_news","bucket_list",
  "fight_or_flight","pop_culture","improv","alibi","cropped_look","mind_reading",
  "speed_round","musical_chairs","thumb_war","photo_bomb","hum_it","mimic_me",
  "accent","draw_it","speed_typing","connections","chain_reaction","party_dice",
]);

// ─── Featured Banner ─────────────────────────────────────────────────────────
function FeaturedBanner({ onPress }: { onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const slideY = useRef(new Animated.Value(20)).current;
  const op     = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 120 }),
      Animated.timing(op,     { toValue: 1, useNativeDriver: true, duration: 350 }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ transform: [{ translateY: slideY }, { scale }], opacity: op, marginBottom: 20 }}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 30 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 20 }).start()}
      >
        <LinearGradient colors={["#2a0060", "#b5179e", "#7c3aed"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.featCard}>
          <View style={styles.featLeft}>
            <View style={styles.featBadge}>
              <Text style={styles.featBadgeText}>🔥 MOST PLAYED</Text>
            </View>
            <Text style={styles.featTitle}>Never Have{"\n"}I Ever</Text>
            <Text style={styles.featTagline}>Confess or drink — the party classic</Text>
            <View style={styles.featPlayBtn}>
              <Text style={styles.featPlayText}>Play Now →</Text>
            </View>
          </View>
          <Text style={styles.featEmoji}>🤫</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Category Card ────────────────────────────────────────────────────────────
function CategoryCard({ cat, onPress, index }: { cat: Category; onPress: () => void; index: number }) {
  const scale  = useRef(new Animated.Value(1)).current;
  const slideY = useRef(new Animated.Value(30)).current;
  const op     = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 120, delay: index * 55 } as any),
      Animated.timing(op,     { toValue: 1, useNativeDriver: true, duration: 300, delay: index * 55 }),
    ]).start();
  }, []);

  function handlePressIn() {
    Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 30 }).start();
  }
  function handlePressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20 }).start();
  }

  return (
    <Animated.View style={{ transform: [{ scale }, { translateY: slideY }], opacity: op, width: CARD_W }}>
      <TouchableOpacity activeOpacity={1} onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
        <LinearGradient colors={cat.colors} style={styles.catCard}>
          <View style={[styles.catGlow, { backgroundColor: cat.accent + "20" }]} />
          {/* Corner accent dot */}
          <View style={[styles.catDot, { backgroundColor: cat.accent }]} />
          <Text style={styles.catEmoji}>{cat.emoji}</Text>
          <Text style={styles.catLabel}>{cat.label}</Text>
          <View style={[styles.catCount, { backgroundColor: cat.accent + "20", borderColor: cat.accent + "40" }]}>
            <Text style={[styles.catCountText, { color: cat.accent }]}>
              {cat.games.length} games
            </Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Category Sheet ───────────────────────────────────────────────────────────
function CategorySheet({
  cat, visible, onClose, onPress,
}: { cat: Category | null; visible: boolean; onClose: () => void; onPress: (game: GameEntry) => void }) {
  const router = useRouter();
  const slideY = useRef(new Animated.Value(600)).current;
  const bgOp   = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideY, { toValue: 0,   useNativeDriver: true, damping: 22, stiffness: 180 }),
        Animated.timing(bgOp,   { toValue: 1,   useNativeDriver: true, duration: 200 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideY, { toValue: 600, useNativeDriver: true, duration: 220 }),
        Animated.timing(bgOp,   { toValue: 0,   useNativeDriver: true, duration: 180 }),
      ]).start();
    }
  }, [visible]);

  if (!cat) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.sheetBg, { opacity: bgOp }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideY }] }]}>
        {/* Drag handle */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetEmoji}>{cat.emoji}</Text>
          <View>
            <Text style={styles.sheetTitle}>{cat.label}</Text>
            <Text style={styles.sheetSubtitle}>{cat.games.length} games</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.sheetClose}>
            <Text style={styles.sheetCloseText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={[styles.sheetDivider, { backgroundColor: cat.accent + "33" }]} />

        {/* Game list */}
        <ScrollView contentContainerStyle={styles.sheetList} showsVerticalScrollIndicator={false}>
          {cat.games.map((game) => {
            const hasRoute = ROUTED_GAMES.has(game.id);
            return (
              <TouchableOpacity
                key={game.id}
                style={styles.gameRow}
                activeOpacity={0.75}
                onPress={() => onPress(game)}
              >
                <View style={[styles.gameRowIcon, { backgroundColor: cat.accent + "22" }]}>
                  <Text style={styles.gameRowEmoji}>{game.emoji}</Text>
                </View>
                <View style={styles.gameRowInfo}>
                  <Text style={styles.gameRowTitle}>{game.title}</Text>
                  <Text style={styles.gameRowTagline}>{game.tagline}</Text>
                </View>
                {hasRoute ? (
                  <View style={[styles.playBadge, { backgroundColor: cat.accent + "22", borderColor: cat.accent + "55" }]}>
                    <Text style={[styles.playBadgeText, { color: cat.accent }]}>Play</Text>
                  </View>
                ) : (
                  <View style={styles.roomBadge}>
                    <Text style={styles.roomBadgeText}>In Room</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function GamesScreen() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [sheetVisible,   setSheetVisible]   = useState(false);
  const [launchGame,     setLaunchGame]     = useState<LaunchGame | null>(null);
  const [showLaunch,     setShowLaunch]     = useState(false);

  function openCategory(cat: Category) {
    setActiveCategory(cat);
    setSheetVisible(true);
  }

  function closeSheet() {
    setSheetVisible(false);
    setTimeout(() => setActiveCategory(null), 300);
  }

  function openLaunch(game: GameEntry) {
    closeSheet();
    setTimeout(() => {
      setLaunchGame({
        id:          game.id,
        title:       game.title,
        tagline:     game.tagline,
        emoji:       game.emoji,
        routeId:     ROUTED_GAMES.has(game.id) ? game.id : undefined,
        description: GAME_DETAILS[game.id]?.description,
        rules:       GAME_DETAILS[game.id]?.howToPlay,
        players:     GAME_DETAILS[game.id]?.players,
      });
      setShowLaunch(true);
    }, 280);
  }

  function openRandomGame() {
    const allGames = CATEGORIES.flatMap(c => c.games);
    const pick = allGames[Math.floor(Math.random() * allGames.length)];
    setLaunchGame({
      id:          pick.id,
      title:       pick.title,
      tagline:     pick.tagline,
      emoji:       pick.emoji,
      routeId:     ROUTED_GAMES.has(pick.id) ? pick.id : undefined,
      description: GAME_DETAILS[pick.id]?.description,
      rules:       GAME_DETAILS[pick.id]?.howToPlay,
      players:     GAME_DETAILS[pick.id]?.players,
    });
    setShowLaunch(true);
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Background */}
      <LinearGradient
        colors={["#03001c", "#07001a", "#0a0020"]}
        style={StyleSheet.absoluteFill}
      />
      {/* Ambient glow */}
      <View style={styles.topGlow} pointerEvents="none" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Party Games</Text>
          <Text style={styles.headerSub}>40 games · 8 categories</Text>
        </View>
        <TouchableOpacity onPress={openRandomGame} style={styles.randomBtn}>
          <Text style={styles.randomBtnText}>🎲</Text>
        </TouchableOpacity>
      </View>

      {/* Category grid */}
      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>

        {/* Featured banner */}
        <FeaturedBanner onPress={() => openLaunch({
          id: "never_have_i_ever", title: "Never Have I Ever",
          tagline: "Confess or drink — the party classic", emoji: "🤫",
        })} />

        {/* Section label */}
        <Text style={styles.sectionLabel}>BROWSE BY CATEGORY</Text>

        {/* 2-column category grid */}
        <View style={styles.row}>
          {CATEGORIES.map((cat, i) => (
            <CategoryCard key={cat.id} cat={cat} index={i} onPress={() => openCategory(cat)} />
          ))}
        </View>
      </ScrollView>

      {/* Category sheet */}
      <CategorySheet cat={activeCategory} visible={sheetVisible} onClose={closeSheet} onPress={openLaunch} />

      <GameLaunchModal
        game={launchGame}
        visible={showLaunch}
        onClose={() => setShowLaunch(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#03001c" },

  topGlow: {
    position: "absolute", top: -80, left: SW * 0.15, right: SW * 0.15,
    height: 160, borderRadius: 80,
    backgroundColor: "rgba(167,139,250,0.12)",
  },

  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16,
  },
  backBtn:      { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  backArrow:    { color: "#fff", fontSize: 20, fontWeight: "600" },
  randomBtn:    { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(167,139,250,0.15)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(167,139,250,0.35)" },
  randomBtnText: { fontSize: 22 },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle:  { color: "#fff", fontSize: 22, fontWeight: "900", letterSpacing: -0.3 },
  headerSub:    { color: "#6b7fa0", fontSize: 12, fontWeight: "600", marginTop: 2 },

  grid: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  row: {
    flexDirection: "row", flexWrap: "wrap", gap: 12,
    justifyContent: "space-between",
  },

  sectionLabel: {
    color: "#4a5568", fontSize: 11, fontWeight: "700", letterSpacing: 1.4,
    marginBottom: 14,
  },

  // Featured banner
  featCard: {
    borderRadius: 20, padding: 22, flexDirection: "row",
    alignItems: "center", justifyContent: "space-between",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    minHeight: 140, overflow: "hidden",
  },
  featLeft:       { flex: 1, gap: 6 },
  featBadge:      { alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  featBadgeText:  { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  featTitle:      { color: "#fff", fontSize: 26, fontWeight: "900", letterSpacing: -0.5, lineHeight: 30 },
  featTagline:    { color: "rgba(255,255,255,0.65)", fontSize: 13, fontWeight: "500" },
  featPlayBtn:    { alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginTop: 4 },
  featPlayText:   { color: "#fff", fontSize: 13, fontWeight: "800" },
  featEmoji:      { fontSize: 64, marginLeft: 8 },

  // Category card
  catCard: {
    width: CARD_W, borderRadius: 18, padding: 18, gap: 8,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    marginBottom: 4, overflow: "hidden",
    minHeight: 148,
  },
  catGlow: {
    position: "absolute", top: 0, left: 0, right: 0,
    height: 70, borderTopLeftRadius: 18, borderTopRightRadius: 18,
  },
  catDot: {
    position: "absolute", top: 14, right: 14,
    width: 7, height: 7, borderRadius: 4, opacity: 0.7,
  },
  catEmoji: { fontSize: 38 },
  catLabel: { color: "#fff", fontSize: 13, fontWeight: "800", letterSpacing: -0.2 },
  catCount: {
    alignSelf: "flex-start",
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1,
  },
  catCountText: { fontSize: 11, fontWeight: "700" },

  // Sheet backdrop
  sheetBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.65)",
  },

  // Sheet
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#0f0020",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: 1, borderColor: "rgba(167,139,250,0.2)",
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    maxHeight: Dimensions.get("window").height * 0.75,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "center", marginTop: 12, marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 20, paddingVertical: 16,
  },
  sheetEmoji:    { fontSize: 32 },
  sheetTitle:    { color: "#fff", fontSize: 20, fontWeight: "900", letterSpacing: -0.3 },
  sheetSubtitle: { color: "#6b7fa0", fontSize: 13, fontWeight: "600", marginTop: 2 },
  sheetClose:    { marginLeft: "auto", width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  sheetCloseText:{ color: "#888", fontSize: 14, fontWeight: "700" },
  sheetDivider:  { height: 1, marginHorizontal: 20 },

  sheetList: { paddingHorizontal: 16, paddingTop: 12, gap: 6 },

  // Game row
  gameRow: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  gameRowIcon:    { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  gameRowEmoji:   { fontSize: 22 },
  gameRowInfo:    { flex: 1, gap: 2 },
  gameRowTitle:   { color: "#fff", fontSize: 15, fontWeight: "800" },
  gameRowTagline: { color: "#6b7fa0", fontSize: 12, fontWeight: "500" },

  playBadge: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1,
  },
  playBadgeText: { fontSize: 12, fontWeight: "800" },
  roomBadge:     { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.06)" },
  roomBadgeText: { color: "#4a5568", fontSize: 11, fontWeight: "700" },
});
