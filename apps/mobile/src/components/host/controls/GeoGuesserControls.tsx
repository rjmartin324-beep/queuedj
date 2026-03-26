import React, { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";
import { HostActionButton } from "../HostActionButton";
import { GuessingView } from "../../experiences/geo-guesser/GuessingView";
import { RevealView as GeoReveal } from "../../experiences/geo-guesser/RevealView";
import { LeaderboardView } from "../../experiences/trivia/LeaderboardView";

// ─────────────────────────────────────────────────────────────────────────────
// Content bank
// ─────────────────────────────────────────────────────────────────────────────

type Region = "Africa" | "Asia" | "Europe" | "North America" | "South America" | "Oceania" | "Middle East";

interface Location {
  clue: string;
  locationName: string;
  locationEmoji: string;
  actualLocation: string;
  actualRegion: Region;
  lat: number;
  lng: number;
  imageUrl: string;
}

const LOCATION_BANK: Location[] = [
  {
    clue: "A colossal ancient amphitheatre built by emperors, where gladiators once fought for glory in the heart of an empire.",
    locationName: "The Colosseum", locationEmoji: "🏟️", actualLocation: "Rome, Italy", actualRegion: "Europe",
    lat: 41.8902, lng: 12.4922,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Colosseo_2020.jpg/800px-Colosseo_2020.jpg",
  },
  {
    clue: "Enormous stone tombs that have stood in the desert for over 4,500 years, built by one of history's greatest civilisations.",
    locationName: "The Great Pyramids of Giza", locationEmoji: "🔺", actualLocation: "Giza, Egypt", actualRegion: "Africa",
    lat: 29.9792, lng: 31.1342,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Kheops-Pyramid.jpg/800px-Kheops-Pyramid.jpg",
  },
  {
    clue: "A red sandstone fort and palace complex that served as the main residence of Mughal emperors for generations.",
    locationName: "The Red Fort", locationEmoji: "🏯", actualLocation: "Delhi, India", actualRegion: "Asia",
    lat: 28.6562, lng: 77.2410,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Red_Fort_%28Lal_Qila%29_Delhi-02.jpg/800px-Red_Fort_%28Lal_Qila%29_Delhi-02.jpg",
  },
  {
    clue: "An iconic performance venue with a distinctive sail-shaped roof perched on a harbour in the southern hemisphere.",
    locationName: "Sydney Opera House", locationEmoji: "🎭", actualLocation: "Sydney, Australia", actualRegion: "Oceania",
    lat: -33.8568, lng: 151.2153,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Sydney_Opera_House_-_Dec_2008.jpg/800px-Sydney_Opera_House_-_Dec_2008.jpg",
  },
  {
    clue: "A towering iron lattice structure built as a temporary exhibit for a world's fair that became a permanent icon of its city.",
    locationName: "The Eiffel Tower", locationEmoji: "🗼", actualLocation: "Paris, France", actualRegion: "Europe",
    lat: 48.8584, lng: 2.2945,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Tour_Eiffel_Wikimedia_Commons.jpg/800px-Tour_Eiffel_Wikimedia_Commons.jpg",
  },
  {
    clue: "A massive stone citadel perched high in the Andes, built by an ancient civilisation and later abandoned.",
    locationName: "Machu Picchu", locationEmoji: "🏔️", actualLocation: "Cusco Region, Peru", actualRegion: "South America",
    lat: -13.1631, lng: -72.5450,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/Machu_Picchu%2C_Peru.jpg/800px-Machu_Picchu%2C_Peru.jpg",
  },
  {
    clue: "An ancient city carved into rose-red rock faces, once a thriving trade hub nestled inside a desert canyon.",
    locationName: "Petra", locationEmoji: "🪨", actualLocation: "Ma'an, Jordan", actualRegion: "Middle East",
    lat: 30.3285, lng: 35.4444,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Treasury_petra_crop.jpg/800px-Treasury_petra_crop.jpg",
  },
  {
    clue: "A serene mausoleum of white marble built beside a river by an emperor as an eternal tribute to his beloved wife.",
    locationName: "Taj Mahal", locationEmoji: "🕌", actualLocation: "Agra, India", actualRegion: "Asia",
    lat: 27.1751, lng: 78.0421,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Taj_Mahal_%28Edited%29.jpeg/800px-Taj_Mahal_%28Edited%29.jpeg",
  },
  {
    clue: "A vast defensive wall winding over mountains and valleys, built over centuries to protect an empire's northern border.",
    locationName: "The Great Wall of China", locationEmoji: "🧱", actualLocation: "Northern China", actualRegion: "Asia",
    lat: 40.4319, lng: 116.5704,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/The_Great_Wall_of_China_at_Jinshanling-edit.jpg/800px-The_Great_Wall_of_China_at_Jinshanling-edit.jpg",
  },
  {
    clue: "Giant mysterious stone statues on a remote Pacific island, carved by an isolated civilisation centuries ago.",
    locationName: "Easter Island Moai", locationEmoji: "🗿", actualLocation: "Easter Island, Chile", actualRegion: "South America",
    lat: -27.1127, lng: -109.3497,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Ahu_Tongariki_repaired.jpg/800px-Ahu_Tongariki_repaired.jpg",
  },
  {
    clue: "A still-unfinished basilica with organic stone towers that has been under construction in a Spanish city for over 140 years.",
    locationName: "Sagrada Familia", locationEmoji: "⛪", actualLocation: "Barcelona, Spain", actualRegion: "Europe",
    lat: 41.4036, lng: 2.1744,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Sagrada_familia_2006.jpg/800px-Sagrada_familia_2006.jpg",
  },
  {
    clue: "A vast temple complex hidden deep in the jungle, built by a medieval empire and dedicated to the Hindu god Vishnu.",
    locationName: "Angkor Wat", locationEmoji: "🛕", actualLocation: "Siem Reap, Cambodia", actualRegion: "Asia",
    lat: 13.4125, lng: 103.8670,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Sunrise_over_Angkor_Wat.jpg/800px-Sunrise_over_Angkor_Wat.jpg",
  },
  {
    clue: "A ring of enormous prehistoric standing stones on a windswept plain, whose exact purpose still baffles archaeologists.",
    locationName: "Stonehenge", locationEmoji: "🪨", actualLocation: "Wiltshire, England", actualRegion: "Europe",
    lat: 51.1789, lng: -1.8262,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Stonehenge2007_07_30.jpg/800px-Stonehenge2007_07_30.jpg",
  },
  {
    clue: "A nearly perfect volcanic cone often dusted with snow, considered sacred in its country and visible from a major city on a clear day.",
    locationName: "Mount Fuji", locationEmoji: "🗻", actualLocation: "Honshu, Japan", actualRegion: "Asia",
    lat: 35.3606, lng: 138.7274,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Fujisan_from_Fujiyoshida_2002-10.jpg/800px-Fujisan_from_Fujiyoshida_2002-10.jpg",
  },
  {
    clue: "Two massive curtains of water plunging over a cliff on the border between two countries, one of the world's largest waterfalls by volume.",
    locationName: "Niagara Falls", locationEmoji: "💧", actualLocation: "Ontario, Canada / New York, USA", actualRegion: "North America",
    lat: 43.0962, lng: -79.0377,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/All_three_falls_Niagara.jpg/800px-All_three_falls_Niagara.jpg",
  },
  {
    clue: "A giant open-armed statue atop a mountain overlooking a vibrant coastal city, one of the most recognisable figures on earth.",
    locationName: "Christ the Redeemer", locationEmoji: "✝️", actualLocation: "Rio de Janeiro, Brazil", actualRegion: "South America",
    lat: -22.9519, lng: -43.2105,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Cristo_Redentor_-_Tourism_shot.jpg/800px-Cristo_Redentor_-_Tourism_shot.jpg",
  },
  {
    clue: "The world's tallest building, a gleaming needle of steel and glass rising from a desert city that transformed itself in a single generation.",
    locationName: "Burj Khalifa", locationEmoji: "🏙️", actualLocation: "Dubai, UAE", actualRegion: "Middle East",
    lat: 25.1972, lng: 55.2744,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Burj_Khalifa.jpg/600px-Burj_Khalifa.jpg",
  },
  {
    clue: "A cluster of white-washed buildings with blue-domed roofs clinging to the edge of a volcanic caldera island in the Aegean Sea.",
    locationName: "Santorini", locationEmoji: "🏝️", actualLocation: "Santorini, Greece", actualRegion: "Europe",
    lat: 36.3932, lng: 25.4615,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Santorini_2_bg_090603.jpg/800px-Santorini_2_bg_090603.jpg",
  },
  {
    clue: "A spectacular curtain of water on the border of two countries in southern Africa, known locally as 'the smoke that thunders'.",
    locationName: "Victoria Falls", locationEmoji: "🌊", actualLocation: "Zambia / Zimbabwe", actualRegion: "Africa",
    lat: -17.9243, lng: 25.8572,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Victoria_Falls%2C_2012.jpg/800px-Victoria_Falls%2C_2012.jpg",
  },
  {
    clue: "Curtains of green and purple light dancing across the night sky, best seen in far northern countries during winter.",
    locationName: "Northern Lights", locationEmoji: "🌌", actualLocation: "Tromsø, Norway", actualRegion: "Europe",
    lat: 69.6492, lng: 18.9553,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Aurora_over_Troms%C3%B8%2C_2010.jpg/800px-Aurora_over_Troms%C3%B8%2C_2010.jpg",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const AI_PLAYERS = [
  { id: "ai_becca",  name: "Becca",  skill: 0.88 },
  { id: "ai_tim",    name: "Tim",    skill: 0.74 },
  { id: "ai_mazsle", name: "Mazsle", skill: 0.62 },
  { id: "ai_banks",  name: "Banks",  skill: 0.50 },
  { id: "ai_mel",    name: "Mel",    skill: 0.80 },
];

const MOCK_GUEST   = "host-player";
const ACCENT       = "#6c47ff";
const TOTAL_ROUNDS = 5;
const ALL_REGIONS: Region[] = ["Africa", "Asia", "Europe", "North America", "South America", "Oceania", "Middle East"];

// ─────────────────────────────────────────────────────────────────────────────
// State types
// ─────────────────────────────────────────────────────────────────────────────

type GeoPhase = "idle" | "guessing" | "reveal" | "final";

interface GeoState {
  phase: GeoPhase;
  locations: Location[];
  idx: number;
  scores: Record<string, number>;
}

const IDLE_STATE: GeoState = { phase: "idle", locations: [], idx: 0, scores: {} };

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickWrongRegion(correct: Region): Region {
  const wrong = ALL_REGIONS.filter(r => r !== correct);
  return wrong[Math.floor(Math.random() * wrong.length)];
}

function buildLbData(scores: Record<string, number>) {
  return [
    { guestId: MOCK_GUEST, score: scores[MOCK_GUEST] ?? 0, playerNum: 1, isMe: true, displayName: "You" },
    ...AI_PLAYERS.map((ai, i) => ({
      guestId: ai.id, score: scores[ai.id] ?? 0, playerNum: i + 2, isMe: false, displayName: ai.name,
    })),
  ].sort((a, b) => b.score - a.score);
}

// ─────────────────────────────────────────────────────────────────────────────
// View mode props
// ─────────────────────────────────────────────────────────────────────────────

interface ViewModeProps {
  viewMode: "player" | "host";
  onViewModeChange: (mode: "player" | "host") => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function GeoGuesserControls({ viewMode, onViewModeChange: setViewMode }: ViewModeProps) {
  const { dispatch } = useRoom();
  const [game, setGame]         = useState<GeoState>(IDLE_STATE);

  const isActive = game.phase !== "idle";
  const current  = game.locations[game.idx];

  useEffect(() => {
    if (game.phase !== "guessing") return;
    const t = setTimeout(() => {
      revealRound();
    }, 32000);
    return () => clearTimeout(t);
  }, [game.phase, game.idx]);

  // ── Start game ─────────────────────────────────────────────────────────────

  function startGame() {
    const locations = shuffled(LOCATION_BANK).slice(0, TOTAL_ROUNDS);
    const scores: Record<string, number> = { [MOCK_GUEST]: 0 };
    AI_PLAYERS.forEach(p => { scores[p.id] = 0; });

    setGame({ phase: "guessing", locations, idx: 0, scores });
    setViewMode("player");

    dispatch({
      type: "SET_EXPERIENCE",
      experience: "geo_guesser",
      view: "geo_guessing",
      viewData: {
        clue: locations[0].clue,
        locationName: locations[0].locationName,
        locationEmoji: locations[0].locationEmoji,
        imageUrl: locations[0].imageUrl,
      },
      expState: { phase: "guessing", round: 1, totalRounds: TOTAL_ROUNDS },
    });
  }

  // ── Reveal round ───────────────────────────────────────────────────────────

  function revealRound() {
    if (!current) return;

    const newScores = { ...game.scores };
    // Host always correct in demo
    newScores[MOCK_GUEST] = (newScores[MOCK_GUEST] ?? 0) + 300;

    const aiGuesses = AI_PLAYERS.map((ai, i) => {
      const correct = Math.random() < ai.skill;
      const pts     = correct ? 300 : 0;
      newScores[ai.id] = (newScores[ai.id] ?? 0) + pts;
      return {
        guestId:     ai.id,
        region:      correct ? current.actualRegion : pickWrongRegion(current.actualRegion),
        points:      pts,
        isMe:        false,
        playerNum:   i + 2,
        displayName: ai.name,
      };
    });

    const allGuesses = [
      { guestId: MOCK_GUEST, region: current.actualRegion, points: 300, isMe: true, playerNum: 1, displayName: "You" },
      ...aiGuesses,
    ];

    const isLast    = game.idx + 1 >= TOTAL_ROUNDS;
    const newPhase: GeoPhase = isLast ? "final" : "reveal";

    setGame(prev => ({ ...prev, phase: newPhase, scores: newScores }));

    dispatch({
      type: "SET_EXPERIENCE",
      experience: "geo_guesser",
      view: "geo_reveal",
      viewData: {
        actualLocation: current.actualLocation,
        actualRegion:   current.actualRegion,
        clue:           current.clue,
        guesses:        allGuesses,
      },
      expState: { phase: "reveal", round: game.idx + 1, totalRounds: TOTAL_ROUNDS, scores: newScores },
    });
    setViewMode("player");
  }

  // ── Next round ─────────────────────────────────────────────────────────────

  function nextRound() {
    const nextIdx = game.idx + 1;
    const next    = game.locations[nextIdx];
    if (!next) return;

    setGame(prev => ({ ...prev, phase: "guessing", idx: nextIdx }));

    dispatch({
      type: "SET_EXPERIENCE",
      experience: "geo_guesser",
      view: "geo_guessing",
      viewData: {
        clue:          next.clue,
        locationName:  next.locationName,
        locationEmoji: next.locationEmoji,
        imageUrl:      next.imageUrl,
      },
      expState: { phase: "guessing", round: nextIdx + 1, totalRounds: TOTAL_ROUNDS },
    });
    setViewMode("player");
  }

  // ── Show leaderboard ───────────────────────────────────────────────────────

  function showLeaderboard() {
    dispatch({
      type: "SET_EXPERIENCE",
      experience: "geo_guesser",
      view: "leaderboard",
      viewData: buildLbData(game.scores),
      expState: { phase: "leaderboard", scores: game.scores },
    });
  }

  // ── Reset ──────────────────────────────────────────────────────────────────

  function resetGame() {
    setGame(IDLE_STATE);
    setViewMode("player");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Player view
  // ─────────────────────────────────────────────────────────────────────────

  if (isActive && viewMode === "player") {
    return (
      <View style={{ flex: 1, minHeight: 500 }}>
        {game.phase === "guessing" && <GuessingView />}
        {(game.phase === "reveal" || game.phase === "final") && <GeoReveal />}
        {game.phase === "final" && <LeaderboardView />}
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Host controls — active game
  // ─────────────────────────────────────────────────────────────────────────

  if (isActive) {
    const score   = game.scores[MOCK_GUEST] ?? 0;
    const isFinal = game.phase === "final";

    return (
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={["#1a0840", "#2a1060"]} style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.pill}>
              <Text style={s.pillText}>🗺  GEO GUESSER</Text>
            </View>
            <Text style={s.headerRound}>Round {game.idx + 1} / {TOTAL_ROUNDS}</Text>
          </View>
          <View style={s.headerRight}>
            <View style={s.scoreChip}>
              <Text style={s.scoreEmoji}>⭐</Text>
              <Text style={s.scoreVal}>{score}</Text>
            </View>
            <TouchableOpacity style={s.playerViewBtn} onPress={() => setViewMode("player")}>
              <Text style={s.playerViewBtnText}>👁  Player View</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Current location card */}
        {current && (
          <View style={s.card}>
            <View style={s.cardRow}>
              <Text style={s.locationEmoji}>{current.locationEmoji}</Text>
              <View style={s.cardRowText}>
                <Text style={s.locationName}>{current.locationName}</Text>
                <Text style={s.regionTag}>{current.actualRegion} · {current.actualLocation}</Text>
              </View>
            </View>
            <View style={s.divider} />
            <Text style={s.labelSmall}>CLUE SHOWN TO PLAYERS</Text>
            <Text style={s.clueText}>{current.clue}</Text>
          </View>
        )}

        {/* Mini leaderboard on final */}
        {isFinal && (
          <View style={s.lbMini}>
            <Text style={s.lbTitle}>🏆  Final Standings</Text>
            {buildLbData(game.scores).map((e, i) => (
              <View key={e.guestId} style={[s.lbRow, e.isMe && s.lbRowMe]}>
                <Text style={[s.lbRank, i === 0 && { color: "#FFD700" }]}>#{i + 1}</Text>
                <Text style={[s.lbName, e.isMe && { color: "#c4b5fd" }]}>{e.displayName}</Text>
                <Text style={[s.lbScore, e.isMe && { color: ACCENT }]}>{e.score} pts</Text>
              </View>
            ))}
          </View>
        )}

        {/* Controls */}
        <View style={s.controls}>
          {game.phase === "guessing" && (
            <HostActionButton label="🗺  Reveal Location" onPress={revealRound} />
          )}
          {game.phase === "reveal" && (
            <>
              <HostActionButton label={`▶  Next Round (${game.idx + 2}/${TOTAL_ROUNDS})`} onPress={nextRound} />
              <HostActionButton label="📊  Show Leaderboard" onPress={showLeaderboard} variant="secondary" />
            </>
          )}
          {game.phase === "final" && (
            <>
              <HostActionButton label="🏆  Final Standings" onPress={showLeaderboard} />
              <HostActionButton label="🔄  Play Again" onPress={startGame} variant="secondary" />
            </>
          )}
          <TouchableOpacity style={s.stopBtn} onPress={resetGame}>
            <Text style={s.stopBtnText}>⏹  Stop Game</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Idle — launch screen
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
      <View style={s.card}>
        <Text style={s.idleTitle}>🗺  Geo Guesser</Text>
        <Text style={s.idleSubtitle}>5 rounds · World landmarks · Guess the region · 300 pts for correct</Text>
        <View style={s.divider} />
        <Text style={s.labelSmall}>HOW IT WORKS</Text>
        <Text style={s.infoText}>
          Players read a clue about a famous world landmark and must guess which region it belongs to.
          Correct answers earn 300 points. The player with the most points after 5 rounds wins.
        </Text>
      </View>
      <TouchableOpacity onPress={startGame} activeOpacity={0.85}>
        <LinearGradient colors={["#4c1d95", "#6c47ff"]} style={s.launchBtn}>
          <Text style={s.launchEmoji}>🗺</Text>
          <View>
            <Text style={s.launchLabel}>Start Geo Guesser</Text>
            <Text style={s.launchSub}>Offline · 5 rounds · 6 players</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────


const s = StyleSheet.create({
  container:        { gap: 14, paddingBottom: 20 },

  header:           { borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 },
  headerLeft:       { gap: 6 },
  headerRight:      { alignItems: "flex-end", gap: 8 },
  pill:             { alignSelf: "flex-start", backgroundColor: "rgba(108,71,255,0.25)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: ACCENT + "55" },
  pillText:         { color: "#c4b5fd", fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  headerRound:      { color: "#fff", fontSize: 20, fontWeight: "900" },
  scoreChip:        { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(99,102,241,0.25)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(99,102,241,0.3)" },
  scoreEmoji:       { fontSize: 14 },
  scoreVal:         { color: "#fff", fontWeight: "900", fontSize: 16 },
  playerViewBtn:    { backgroundColor: "#1a1040", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: ACCENT + "44" },
  playerViewBtnText:{ color: "#8b5cf6", fontSize: 11, fontWeight: "700" },

  card:             { backgroundColor: "#111", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#222", gap: 10 },
  cardRow:          { flexDirection: "row", alignItems: "center", gap: 12 },
  cardRowText:      { flex: 1, gap: 3 },
  locationEmoji:    { fontSize: 36 },
  locationName:     { color: "#fff", fontSize: 17, fontWeight: "800" },
  regionTag:        { color: ACCENT, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  divider:          { height: 1, backgroundColor: "#222" },
  labelSmall:       { color: "#444", fontSize: 9, fontWeight: "800", letterSpacing: 2 },
  clueText:         { color: "#bbb", fontSize: 14, lineHeight: 21 },

  lbMini:           { backgroundColor: "#111", borderRadius: 14, borderWidth: 1, borderColor: "#222", padding: 14, gap: 8 },
  lbTitle:          { color: "#fff", fontSize: 15, fontWeight: "900", marginBottom: 4 },
  lbRow:            { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#1a1a1a" },
  lbRowMe:          { backgroundColor: "rgba(108,71,255,0.1)", borderRadius: 8, paddingHorizontal: 8 },
  lbRank:           { color: "#555", fontSize: 14, fontWeight: "800", minWidth: 32 },
  lbName:           { flex: 1, color: "#ccc", fontSize: 14, fontWeight: "600" },
  lbScore:          { color: "#888", fontSize: 16, fontWeight: "900" },

  controls:         { gap: 8, borderTopWidth: 1, borderTopColor: "#1a1a1a", paddingTop: 12, marginTop: 4 },
  stopBtn:          { alignItems: "center", paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: "#1e1e1e" },
  stopBtnText:      { color: "#444", fontSize: 13, fontWeight: "700" },

  idleTitle:        { color: "#fff", fontSize: 22, fontWeight: "900" },
  idleSubtitle:     { color: "#666", fontSize: 13 },
  infoText:         { color: "#777", fontSize: 13, lineHeight: 20 },
  launchBtn:        { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 16 },
  launchEmoji:      { fontSize: 28 },
  launchLabel:      { color: "#fff", fontSize: 16, fontWeight: "800" },
  launchSub:        { color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 2 },
});
