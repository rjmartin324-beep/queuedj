import React, { useRef, useEffect } from "react";
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, Alert, Image, ImageSourcePropType, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const CARD_W = 142;
const CARD_H = 192;
const CHAR_SIZE = 74;

interface FloatProp { e: string; top?: number; bottom?: number; left?: number; right?: number; size?: number }

interface Game {
  id: string; title: string; tagline: string;
  label: string; labelColor: string;
  bgColors: string[]; accent: string;
  bodyColor: string; blushColor: string;
  floatProps: FloatProp[];
  image?: ImageSourcePropType;
}

// ─── Game images (drop files into assets/games/ then uncomment) ───────────────
// To add an image: save the file then replace null with require("../../assets/games/dj.jpg")

const GAME_IMAGES: Record<string, ImageSourcePropType | null> = {
  dj:                    require("../../../assets/dj.jpg"),
  trivia:                require("../../../assets/trivia.jpg"),
  unpopular_opinions:    require("../../../assets/opinions.jpg"),
  scrapbook_sabotage:    require("../../../assets/scrapbook.jpg"),
  the_glitch:            require("../../../assets/glitch.jpg"),
  drawback:              require("../../../assets/drawback.jpg"),
  scavenger_snap:        require("../../../assets/snap.jpg"),
  geo_guesser:           require("../../../assets/geo.jpg"),
};

const GAMES: Game[] = [
  {
    id: "dj",
    title: "DJ Mode", tagline: "Drop the beat",
    label: "Party", labelColor: "#f97316",
    bgColors: ["#1a0a4a", "#0a0530"], accent: "#a78bfa",
    bodyColor: "#7ec8e3", blushColor: "#f9a8d4",
    floatProps: [{ e: "🎧", top: 8, right: 8, size: 22 }, { e: "🎵", top: 38, left: 6, size: 14 }, { e: "🎶", bottom: 52, right: 10, size: 12 }],
  },
  {
    id: "trivia",
    title: "Trivia", tagline: "Test your knowledge",
    label: "Think Fast", labelColor: "#f59e0b",
    bgColors: ["#0d2060", "#060e35"], accent: "#60a5fa",
    bodyColor: "#7ec8e3", blushColor: "#fda4af",
    floatProps: [{ e: "❓", top: 6, right: 8, size: 20 }, { e: "💡", top: 36, left: 5, size: 16 }, { e: "!", top: 8, left: 10, size: 18 }],
  },
  {
    id: "unpopular_opinions",
    title: "Opinions",
    tagline: "Guess who said it",
    label: "Funny", labelColor: "#eab308",
    bgColors: ["#3a0a1a", "#1a0510"], accent: "#f472b6",
    bodyColor: "#7ec8e3", blushColor: "#fda4af",
    floatProps: [{ e: "🎤", top: 6, right: 8, size: 20 }, { e: "💬", top: 34, left: 6, size: 14 }, { e: "❤️", bottom: 54, right: 8, size: 12 }],
  },
  {
    id: "scrapbook_sabotage",
    title: "Scrapbook", tagline: "Write & sabotage",
    label: "Creative", labelColor: "#8b5cf6",
    bgColors: ["#2a1a00", "#150d00"], accent: "#fbbf24",
    bodyColor: "#7ec8e3", blushColor: "#fde68a",
    floatProps: [{ e: "📒", top: 6, right: 6, size: 20 }, { e: "✏️", top: 36, left: 5, size: 16 }, { e: "💜", bottom: 52, right: 8, size: 12 }],
  },
  {
    id: "the_glitch",
    title: "The Glitch", tagline: "What did you watch?",
    label: "Glitchy", labelColor: "#a855f7",
    bgColors: ["#0a0630", "#050318"], accent: "#818cf8",
    bodyColor: "#7ec8e3", blushColor: "#c4b5fd",
    floatProps: [{ e: "👾", top: 6, right: 6, size: 20 }, { e: "📺", top: 36, left: 5, size: 15 }, { e: "⚡", bottom: 52, right: 8, size: 13 }],
  },
  {
    id: "drawback",
    title: "Drawback", tagline: "Draw what they say",
    label: "Draw It", labelColor: "#3b82f6",
    bgColors: ["#1a0a30", "#0a0518"], accent: "#c084fc",
    bodyColor: "#7ec8e3", blushColor: "#f0abfc",
    floatProps: [{ e: "🎨", top: 6, right: 8, size: 20 }, { e: "✏️", top: 36, left: 5, size: 15 }, { e: "🖼️", bottom: 52, right: 7, size: 12 }],
  },
  {
    id: "scavenger_snap",
    title: "Snap Hunt", tagline: "Find it, snap it",
    label: "Quick", labelColor: "#22d3ee",
    bgColors: ["#001a30", "#000d18"], accent: "#22d3ee",
    bodyColor: "#7ec8e3", blushColor: "#a5f3fc",
    floatProps: [{ e: "📷", top: 5, right: 7, size: 22 }, { e: "✨", top: 36, left: 5, size: 14 }, { e: "🏆", bottom: 52, right: 8, size: 13 }],
  },
  {
    id: "geo_guesser",
    title: "GeoGuesser", tagline: "Pin the location",
    label: "Guess", labelColor: "#34d399",
    bgColors: ["#002a18", "#001510"], accent: "#34d399",
    bodyColor: "#7ec8e3", blushColor: "#6ee7b7",
    floatProps: [{ e: "🗺️", top: 6, right: 6, size: 20 }, { e: "📍", top: 36, left: 5, size: 16 }, { e: "🌍", bottom: 52, right: 7, size: 14 }],
  },
];

// ─── Mascot character (fallback when no image) ────────────────────────────────

function MascotCharacter({ bodyColor, blushColor, size: s }: { bodyColor: string; blushColor: string; size: number }) {
  return (
    <View style={{ width: s, height: s * 1.15, alignItems: "center" }}>
      {/* Tuft */}
      <View style={{ position: "absolute", top: 0, width: s * 0.13, height: s * 0.16, borderRadius: s * 0.08, backgroundColor: bodyColor, zIndex: 2 }} />
      <View style={{ position: "absolute", top: s * 0.04, left: s * 0.29, width: s * 0.10, height: s * 0.12, borderRadius: s * 0.06, backgroundColor: bodyColor, zIndex: 2 }} />
      <View style={{ position: "absolute", top: s * 0.04, right: s * 0.29, width: s * 0.10, height: s * 0.12, borderRadius: s * 0.06, backgroundColor: bodyColor, zIndex: 2 }} />

      {/* Left arm */}
      <View style={{ position: "absolute", bottom: s * 0.18, left: -s * 0.04, width: s * 0.17, height: s * 0.26, borderRadius: s * 0.085, backgroundColor: bodyColor, transform: [{ rotate: "20deg" }] }} />
      {/* Right arm */}
      <View style={{ position: "absolute", bottom: s * 0.18, right: -s * 0.04, width: s * 0.17, height: s * 0.26, borderRadius: s * 0.085, backgroundColor: bodyColor, transform: [{ rotate: "-20deg" }] }} />

      {/* Body */}
      <View style={{
        position: "absolute", bottom: s * 0.12,
        width: s * 0.94, height: s * 0.88,
        borderRadius: s * 0.47,
        backgroundColor: bodyColor,
        alignItems: "center",
        shadowColor: bodyColor, shadowRadius: 12, shadowOpacity: 0.45, shadowOffset: { width: 0, height: 5 },
      }}>
        {/* Eyes */}
        <View style={{ flexDirection: "row", gap: s * 0.16, marginTop: s * 0.16 }}>
          <View style={{ width: s * 0.15, height: s * 0.15, borderRadius: s * 0.075, backgroundColor: "#1a1030", alignItems: "center", justifyContent: "flex-start", paddingTop: s * 0.025 }}>
            <View style={{ width: s * 0.055, height: s * 0.055, borderRadius: s * 0.028, backgroundColor: "rgba(255,255,255,0.75)" }} />
          </View>
          <View style={{ width: s * 0.15, height: s * 0.15, borderRadius: s * 0.075, backgroundColor: "#1a1030", alignItems: "center", justifyContent: "flex-start", paddingTop: s * 0.025 }}>
            <View style={{ width: s * 0.055, height: s * 0.055, borderRadius: s * 0.028, backgroundColor: "rgba(255,255,255,0.75)" }} />
          </View>
        </View>

        {/* Blush */}
        <View style={{ flexDirection: "row", gap: s * 0.25, marginTop: s * 0.04 }}>
          <View style={{ width: s * 0.14, height: s * 0.07, borderRadius: s * 0.035, backgroundColor: blushColor, opacity: 0.6 }} />
          <View style={{ width: s * 0.14, height: s * 0.07, borderRadius: s * 0.035, backgroundColor: blushColor, opacity: 0.6 }} />
        </View>

        {/* Open mouth */}
        <View style={{ width: s * 0.30, height: s * 0.17, borderRadius: s * 0.085, backgroundColor: "#7f1d1d", marginTop: s * 0.04, overflow: "hidden", alignItems: "center" }}>
          <View style={{ width: "88%", height: s * 0.07, backgroundColor: "#fef2f2", borderBottomLeftRadius: s * 0.06, borderBottomRightRadius: s * 0.06 }} />
        </View>
      </View>

      {/* Feet */}
      <View style={{ flexDirection: "row", gap: s * 0.07, position: "absolute", bottom: 0 }}>
        <View style={{ width: s * 0.28, height: s * 0.14, borderRadius: s * 0.07, backgroundColor: bodyColor }} />
        <View style={{ width: s * 0.28, height: s * 0.14, borderRadius: s * 0.07, backgroundColor: bodyColor }} />
      </View>
    </View>
  );
}

// ─── Animated Game Card ───────────────────────────────────────────────────────

function GameCard({ game, img, isTrending, onPress }: {
  game: Game; img: ImageSourcePropType | null; isTrending: boolean; onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const glow  = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  // Pulsing border for trending card
  useEffect(() => {
    if (!isTrending) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.5, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,   duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const onPressIn = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 0.95, useNativeDriver: true }),
      Animated.timing(glow,  { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  };
  const onPressOut = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
      Animated.timing(glow,  { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  return (
    <Animated.View style={[styles.cardWrap, { transform: [{ scale }] }]}>
      {/* Trending pulse ring */}
      {isTrending && (
        <Animated.View style={[styles.trendingRing, {
          borderColor: game.accent,
          opacity: pulse.interpolate({ inputRange: [1, 1.5], outputRange: [0.6, 0.0] }),
          transform: [{ scale: pulse }],
        }]} />
      )}
      <TouchableOpacity
        style={[styles.card, { borderColor: game.accent + "88" }]}
        activeOpacity={1}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
        {img ? (
          <>
            <Image source={img} style={styles.cardImage} resizeMode="cover" />
            <LinearGradient colors={["transparent", "rgba(10,5,20,0.95)"]} style={styles.cardImageOverlay} />
            {/* Game label badge — top left */}
            <View style={[styles.labelBadge, { backgroundColor: game.labelColor }]}>
              <Text style={styles.labelText}>{game.label}</Text>
            </View>
          </>
        ) : (
          <LinearGradient colors={game.bgColors as any} style={styles.cardTop}>
            <View style={[styles.charGlow, { backgroundColor: game.accent + "1a" }]} />
            {game.floatProps.map((p, i) => (
              <Text key={i} style={[styles.floatProp, {
                top: p.top, bottom: p.bottom, left: p.left, right: p.right, fontSize: p.size ?? 16,
              }]}>{p.e}</Text>
            ))}
            <MascotCharacter bodyColor={game.bodyColor} blushColor={game.blushColor} size={CHAR_SIZE} />
          </LinearGradient>
        )}
        {/* Press glow overlay */}
        <Animated.View style={[StyleSheet.absoluteFill, {
          borderRadius: 18,
          backgroundColor: game.accent + "22",
          opacity: glow,
        }]} />
        <View style={styles.cardFooter}>
          {isTrending && <Text style={[styles.trendingBadge, { color: game.accent }]}>🔥 Trending</Text>}
          <Text style={styles.cardTitle}>{game.title}</Text>
          <Text style={styles.cardSub}>{game.tagline}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Carousel ─────────────────────────────────────────────────────────────────

interface Props { onSelectGame?: (gameId: string) => void }

export function GamesCarousel({ onSelectGame }: Props) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.fire}>🔥</Text>
          <Text style={styles.title}>POPULAR PARTY GAMES</Text>
        </View>
        <TouchableOpacity><Text style={styles.viewAll}>View All ›</Text></TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        decelerationRate="fast"
        style={styles.scrollView}
      >
        {GAMES.map((game, idx) => {
          const img = GAME_IMAGES[game.id];
          const isTrending = idx === 0;
          return (
            <GameCard
              key={game.id}
              game={game}
              img={img}
              isTrending={isTrending}
              onPress={() => onSelectGame ? onSelectGame(game.id) : Alert.alert(game.title, `${game.tagline}\n\nStart a room to play!`)}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 20, overflow: "hidden" },
  scrollView: { height: CARD_H + 20, flexGrow: 0 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 12 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  fire:    { fontSize: 16 },
  title:   { color: "#fff", fontSize: 14, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase" },
  viewAll: { color: "#c084fc", fontSize: 13, fontWeight: "700" },

  scroll: { paddingHorizontal: 20, gap: 12, paddingBottom: 8, paddingTop: 4 },

  cardWrap: {
    position: "relative",
    flexShrink: 0,
  },
  trendingRing: {
    position: "absolute",
    top: -4, left: -4, right: -4, bottom: -4,
    borderRadius: 22,
    borderWidth: 2,
    zIndex: 0,
  },
  trendingBadge: {
    fontSize: 9, fontWeight: "800", letterSpacing: 0.5, marginBottom: 2,
  },
  card: {
    width: CARD_W, height: CARD_H,
    borderRadius: 18, borderWidth: 1.5,
    overflow: "hidden", backgroundColor: "#0d0117",
    shadowColor: "#a855f7", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 14, elevation: 8,
  },

  // Photo art
  cardImage: {
    width: CARD_W,
    height: CARD_H,
    position: "absolute",
    top: 0, left: 0,
    borderRadius: 18,
  },
  cardImageOverlay: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    height: 80,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },

  // Drawn mascot fallback
  cardTop: {
    flex: 1, alignItems: "center", justifyContent: "center",
    position: "relative", paddingTop: 8,
  },
  charGlow: {
    position: "absolute",
    width: CHAR_SIZE * 1.5, height: CHAR_SIZE * 1.5,
    borderRadius: CHAR_SIZE * 0.75,
  },
  floatProp: { position: "absolute" },

  // Label badge
  labelBadge: {
    position: "absolute",
    top: 9, left: 9,
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    shadowColor: "#000",
    shadowOpacity: 0.55,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  labelText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // Footer (shared)
  cardFooter: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: "rgba(10,5,20,0.80)",
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  cardTitle: { fontSize: 12, fontWeight: "800", color: "#fff" },
  cardSub:   { color: "rgba(255,255,255,0.5)", fontSize: 9, lineHeight: 13, marginTop: 1 },
});
