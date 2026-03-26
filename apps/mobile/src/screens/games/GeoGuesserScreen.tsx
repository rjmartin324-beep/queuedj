import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, Image, Animated, Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRoom } from "../../contexts/RoomContext";
import { WorldMap } from "../../components/experiences/geo-guesser/WorldMap";
import { PostGameCard } from "../../components/shared/PostGameCard";

// ─────────────────────────────────────────────────────────────────────────────
// Geo Guesser — standalone solo screen
// Two modes: Region (pick continent, 300 pts) | Pin (drop pin, up to 5000 pts)
// ─────────────────────────────────────────────────────────────────────────────

const ACCENT      = "#22c55e";
const TIMER_TOTAL = 30;
const TOTAL_ROUNDS = 5;
const { width: SW } = Dimensions.get("window");
const MAP_H = Math.round(SW * 0.55);

type Region = "Africa" | "Asia" | "Europe" | "North America" | "South America" | "Oceania" | "Middle East";
const ALL_REGIONS: Region[] = ["Africa","Asia","Europe","North America","South America","Oceania","Middle East"];
const REGION_EMOJIS: Record<Region, string> = {
  "Africa":"🌍","Asia":"🌏","Europe":"🏰",
  "North America":"🗽","South America":"🦜",
  "Oceania":"🦘","Middle East":"🕌",
};

type GameMode = "region" | "pin";

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
  { clue:"A colossal ancient amphitheatre built by emperors, where gladiators once fought for glory in the heart of an empire.", locationName:"The Colosseum", locationEmoji:"🏟️", actualLocation:"Rome, Italy", actualRegion:"Europe", lat:41.8902, lng:12.4922, imageUrl:"https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Colosseo_2020.jpg/800px-Colosseo_2020.jpg" },
  { clue:"Enormous stone tombs that have stood in the desert for over 4,500 years, built by one of history's greatest civilisations.", locationName:"The Great Pyramids of Giza", locationEmoji:"🔺", actualLocation:"Giza, Egypt", actualRegion:"Africa", lat:29.9792, lng:31.1342, imageUrl:"https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Kheops-Pyramid.jpg/800px-Kheops-Pyramid.jpg" },
  { clue:"A red sandstone fort and palace complex that served as the main residence of Mughal emperors for generations.", locationName:"The Red Fort", locationEmoji:"🏯", actualLocation:"Delhi, India", actualRegion:"Asia", lat:28.6562, lng:77.2410, imageUrl:"https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Red_Fort_%28Lal_Qila%29_Delhi-02.jpg/800px-Red_Fort_%28Lal_Qila%29_Delhi-02.jpg" },
  { clue:"An iconic performance venue with a distinctive sail-shaped roof perched on a harbour in the southern hemisphere.", locationName:"Sydney Opera House", locationEmoji:"🎭", actualLocation:"Sydney, Australia", actualRegion:"Oceania", lat:-33.8568, lng:151.2153, imageUrl:"https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Sydney_Opera_House_-_Dec_2008.jpg/800px-Sydney_Opera_House_-_Dec_2008.jpg" },
  { clue:"A towering iron lattice structure built as a temporary exhibit for a world's fair that became a permanent icon of its city.", locationName:"The Eiffel Tower", locationEmoji:"🗼", actualLocation:"Paris, France", actualRegion:"Europe", lat:48.8584, lng:2.2945, imageUrl:"https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Tour_Eiffel_Wikimedia_Commons.jpg/800px-Tour_Eiffel_Wikimedia_Commons.jpg" },
  { clue:"A massive stone citadel perched high in the Andes, built by an ancient civilisation and later abandoned.", locationName:"Machu Picchu", locationEmoji:"🏔️", actualLocation:"Cusco Region, Peru", actualRegion:"South America", lat:-13.1631, lng:-72.5450, imageUrl:"https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/Machu_Picchu%2C_Peru.jpg/800px-Machu_Picchu%2C_Peru.jpg" },
  { clue:"An ancient city carved into rose-red rock faces, once a thriving trade hub nestled inside a desert canyon.", locationName:"Petra", locationEmoji:"🪨", actualLocation:"Ma'an, Jordan", actualRegion:"Middle East", lat:30.3285, lng:35.4444, imageUrl:"https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Treasury_petra_crop.jpg/800px-Treasury_petra_crop.jpg" },
  { clue:"A serene mausoleum of white marble built beside a river by an emperor as an eternal tribute to his beloved wife.", locationName:"Taj Mahal", locationEmoji:"🕌", actualLocation:"Agra, India", actualRegion:"Asia", lat:27.1751, lng:78.0421, imageUrl:"https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Taj_Mahal_%28Edited%29.jpeg/800px-Taj_Mahal_%28Edited%29.jpeg" },
  { clue:"A vast defensive wall winding over mountains and valleys, built over centuries to protect an empire's northern border.", locationName:"The Great Wall of China", locationEmoji:"🧱", actualLocation:"Northern China", actualRegion:"Asia", lat:40.4319, lng:116.5704, imageUrl:"https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/The_Great_Wall_of_China_at_Jinshanling-edit.jpg/800px-The_Great_Wall_of_China_at_Jinshanling-edit.jpg" },
  { clue:"Giant mysterious stone statues on a remote Pacific island, carved by an isolated civilisation centuries ago.", locationName:"Easter Island Moai", locationEmoji:"🗿", actualLocation:"Easter Island, Chile", actualRegion:"South America", lat:-27.1127, lng:-109.3497, imageUrl:"https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Ahu_Tongariki_repaired.jpg/800px-Ahu_Tongariki_repaired.jpg" },
  { clue:"A still-unfinished basilica with organic stone towers that has been under construction in a Spanish city for over 140 years.", locationName:"Sagrada Familia", locationEmoji:"⛪", actualLocation:"Barcelona, Spain", actualRegion:"Europe", lat:41.4036, lng:2.1744, imageUrl:"https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Sagrada_familia_2006.jpg/800px-Sagrada_familia_2006.jpg" },
  { clue:"A vast temple complex hidden deep in the jungle, built by a medieval empire and dedicated to the Hindu god Vishnu.", locationName:"Angkor Wat", locationEmoji:"🛕", actualLocation:"Siem Reap, Cambodia", actualRegion:"Asia", lat:13.4125, lng:103.8670, imageUrl:"https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Sunrise_over_Angkor_Wat.jpg/800px-Sunrise_over_Angkor_Wat.jpg" },
  { clue:"A ring of enormous prehistoric standing stones on a windswept plain, whose exact purpose still baffles archaeologists.", locationName:"Stonehenge", locationEmoji:"🪨", actualLocation:"Wiltshire, England", actualRegion:"Europe", lat:51.1789, lng:-1.8262, imageUrl:"https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Stonehenge2007_07_30.jpg/800px-Stonehenge2007_07_30.jpg" },
  { clue:"A nearly perfect volcanic cone often dusted with snow, considered sacred in its country and visible from a major city on a clear day.", locationName:"Mount Fuji", locationEmoji:"🗻", actualLocation:"Honshu, Japan", actualRegion:"Asia", lat:35.3606, lng:138.7274, imageUrl:"https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Fujisan_from_Fujiyoshida_2002-10.jpg/800px-Fujisan_from_Fujiyoshida_2002-10.jpg" },
  { clue:"Two massive curtains of water plunging over a cliff on the border between two countries, one of the world's largest waterfalls by volume.", locationName:"Niagara Falls", locationEmoji:"💧", actualLocation:"Ontario, Canada / New York, USA", actualRegion:"North America", lat:43.0962, lng:-79.0377, imageUrl:"https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/All_three_falls_Niagara.jpg/800px-All_three_falls_Niagara.jpg" },
  { clue:"A giant open-armed statue atop a mountain overlooking a vibrant coastal city, one of the most recognisable figures on earth.", locationName:"Christ the Redeemer", locationEmoji:"✝️", actualLocation:"Rio de Janeiro, Brazil", actualRegion:"South America", lat:-22.9519, lng:-43.2105, imageUrl:"https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Cristo_Redentor_-_Tourism_shot.jpg/800px-Cristo_Redentor_-_Tourism_shot.jpg" },
  { clue:"The world's tallest building, a gleaming needle of steel and glass rising from a desert city that transformed itself in a single generation.", locationName:"Burj Khalifa", locationEmoji:"🏙️", actualLocation:"Dubai, UAE", actualRegion:"Middle East", lat:25.1972, lng:55.2744, imageUrl:"https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Burj_Khalifa.jpg/600px-Burj_Khalifa.jpg" },
  { clue:"A cluster of white-washed buildings with blue-domed roofs clinging to the edge of a volcanic caldera island in the Aegean Sea.", locationName:"Santorini", locationEmoji:"🏝️", actualLocation:"Santorini, Greece", actualRegion:"Europe", lat:36.3932, lng:25.4615, imageUrl:"https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Santorini_2_bg_090603.jpg/800px-Santorini_2_bg_090603.jpg" },
  { clue:"A spectacular curtain of water on the border of two countries in southern Africa, known locally as 'the smoke that thunders'.", locationName:"Victoria Falls", locationEmoji:"🌊", actualLocation:"Zambia / Zimbabwe", actualRegion:"Africa", lat:-17.9243, lng:25.8572, imageUrl:"https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Victoria_Falls%2C_2012.jpg/800px-Victoria_Falls%2C_2012.jpg" },
  { clue:"Curtains of green and purple light dancing across the night sky, best seen in far northern countries during winter.", locationName:"Northern Lights", locationEmoji:"🌌", actualLocation:"Tromsø, Norway", actualRegion:"Europe", lat:69.6492, lng:18.9553, imageUrl:"https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Aurora_over_Troms%C3%B8%2C_2010.jpg/800px-Aurora_over_Troms%C3%B8%2C_2010.jpg" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distanceScore(km: number): number {
  if (km < 50)   return 5000;
  if (km < 200)  return 4000;
  if (km < 500)  return 3000;
  if (km < 1500) return 2000;
  if (km < 3000) return 1000;
  if (km < 5000) return 500;
  return 0;
}

function distanceLabel(km: number): string {
  if (km < 50)   return "On it! 🎯";
  if (km < 200)  return "Very close!";
  if (km < 500)  return "Getting warm!";
  if (km < 1500) return "In the right area.";
  if (km < 3000) return "Not too far off.";
  if (km < 5000) return "Miles away!";
  return "Another planet!";
}

function distanceColor(km: number): string {
  if (km < 200)  return ACCENT;
  if (km < 1000) return "#f59e0b";
  if (km < 3000) return "#f97316";
  return "#ef4444";
}

function formatKm(km: number): string {
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km).toLocaleString()} km`;
}

// ─────────────────────────────────────────────────────────────────────────────

type Phase = "welcome" | "lobby" | "guessing" | "reveal" | "final";

export default function GeoGuesserScreen() {
  const router  = useRouter();
  const { state } = useRoom();
  const startedInRoom = useRef(!!state.room);
  const inRoom = startedInRoom.current && !!state.room;

  const [mode,       setMode]       = useState<GameMode>("region");
  const [phase,      setPhase]      = useState<Phase>("welcome");
  const [locations,  setLocations]  = useState<Location[]>([]);
  const [idx,        setIdx]        = useState(0);
  const [score,      setScore]      = useState(0);
  const [roundPts,   setRoundPts]   = useState(0);
  const [distKm,     setDistKm]     = useState<number | null>(null);
  // Region mode
  const [selected,   setSelected]   = useState<Region | null>(null);
  // Pin mode
  const [pendingPin, setPendingPin] = useState<{ lat: number; lng: number } | null>(null);
  const [lockedPin,  setLockedPin]  = useState<{ lat: number; lng: number } | null>(null);
  // Timer
  const [timeLeft,   setTimeLeft]   = useState(TIMER_TOTAL);
  const [lobbyCount, setLobbyCount] = useState(3);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(Date.now());
  const fadeAnim  = useRef(new Animated.Value(1)).current;

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const MAX_SCORE = mode === "pin" ? TOTAL_ROUNDS * 5000 : TOTAL_ROUNDS * 300;

  // ── Lobby countdown ────────────────────────────────────────────────────────
  function startLobby(m: GameMode) {
    const locs = shuffled(LOCATION_BANK).slice(0, TOTAL_ROUNDS);
    setLocations(locs);
    setIdx(0);
    setScore(0);
    setPhase("lobby");

    let count = 3;
    setLobbyCount(count);
    const iv = setInterval(() => {
      count--;
      if (count <= 0) { clearInterval(iv); startRound(locs, 0); }
      else { setLobbyCount(count); }
    }, 1000);
  }

  // ── Start round ────────────────────────────────────────────────────────────
  function startRound(locs: Location[], roundIdx: number) {
    setIdx(roundIdx);
    setSelected(null);
    setPendingPin(null);
    setLockedPin(null);
    setTimeLeft(TIMER_TOTAL);
    startedAt.current = Date.now();
    setPhase("guessing");

    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startedAt.current) / 1000;
      const rem = Math.max(0, TIMER_TOTAL - Math.floor(elapsed));
      setTimeLeft(rem);
      if (rem <= 0) {
        clearInterval(timerRef.current!);
        if (mode === "region") revealRegion(locs, roundIdx, null);
        else revealPin(locs, roundIdx, null);
      }
    }, 500);
  }

  // ── Region mode guess ──────────────────────────────────────────────────────
  function guessRegion(region: Region) {
    if (selected || phase !== "guessing") return;
    if (timerRef.current) clearInterval(timerRef.current);
    setSelected(region);
    revealRegion(locations, idx, region);
  }

  function revealRegion(locs: Location[], roundIdx: number, picked: Region | null) {
    const correct = picked === locs[roundIdx].actualRegion;
    const pts = correct ? 300 : 0;
    setRoundPts(pts);
    setDistKm(null);
    setScore(prev => prev + pts);
    setSelected(picked ?? ("" as Region));
    setPhase("reveal");
  }

  // ── Pin mode guess ─────────────────────────────────────────────────────────
  function handleMapTap(lat: number, lng: number) {
    if (phase !== "guessing") return;
    setPendingPin({ lat, lng });
  }

  function lockPin() {
    if (!pendingPin || phase !== "guessing") return;
    if (timerRef.current) clearInterval(timerRef.current);
    setLockedPin(pendingPin);
    revealPin(locations, idx, pendingPin);
  }

  function revealPin(locs: Location[], roundIdx: number, pin: { lat: number; lng: number } | null) {
    const loc = locs[roundIdx];
    let pts = 0;
    let km: number | null = null;
    if (pin) {
      km = haversineKm(loc.lat, loc.lng, pin.lat, pin.lng);
      pts = distanceScore(km);
    }
    setRoundPts(pts);
    setDistKm(km);
    setLockedPin(pin);
    setScore(prev => prev + pts);
    setPhase("reveal");
  }

  // ── Next round ─────────────────────────────────────────────────────────────
  function next() {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    const nextIdx = idx + 1;
    if (nextIdx >= TOTAL_ROUNDS) setPhase("final");
    else startRound(locations, nextIdx);
  }

  const current    = locations[idx];
  const timerPct   = timeLeft / TIMER_TOTAL;
  const timerColor = timerPct > 0.5 ? ACCENT : timerPct > 0.2 ? "#f59e0b" : "#ef4444";
  const isUrgent   = timeLeft <= 8;

  // ─── Welcome ───────────────────────────────────────────────────────────────
  if (phase === "welcome") {
    return (
      <SafeAreaView style={styles.root}>
        <ScrollView contentContainerStyle={styles.welcomeContainer}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.welcomeEmoji}>🗺️</Text>
          <Text style={styles.welcomeTitle}>Geo Guesser</Text>
          <Text style={styles.welcomeSub}>Mystery location photo drops. Read the clue and guess where in the world it is.</Text>

          {/* Mode toggle */}
          <View style={styles.modeToggleCard}>
            <Text style={styles.modeToggleLabel}>CHOOSE MODE</Text>
            <View style={styles.modeToggleRow}>
              <TouchableOpacity
                style={[styles.modeBtn, mode === "region" && styles.modeBtnActive]}
                onPress={() => setMode("region")}
              >
                <Text style={styles.modeBtnEmoji}>🌍</Text>
                <Text style={[styles.modeBtnTitle, mode === "region" && styles.modeBtnTitleActive]}>Region</Text>
                <Text style={styles.modeBtnSub}>Pick the continent</Text>
                <Text style={styles.modeBtnPts}>300 pts max</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, mode === "pin" && styles.modeBtnActive]}
                onPress={() => setMode("pin")}
              >
                <Text style={styles.modeBtnEmoji}>📍</Text>
                <Text style={[styles.modeBtnTitle, mode === "pin" && styles.modeBtnTitleActive]}>Pin Drop</Text>
                <Text style={styles.modeBtnSub}>Tap the exact spot</Text>
                <Text style={styles.modeBtnPts}>5,000 pts max</Text>
              </TouchableOpacity>
            </View>
            {mode === "pin" && (
              <View style={styles.modeHint}>
                <Text style={styles.modeHintText}>
                  📌  Closer your pin to the real location = more points. Up to 5,000 per round.
                </Text>
              </View>
            )}
          </View>

          <View style={styles.welcomeStats}>
            <View style={styles.statChip}><Text style={styles.statChipText}>🔁  5 rounds</Text></View>
            <View style={styles.statChip}><Text style={styles.statChipText}>⏱  30 s each</Text></View>
            <View style={styles.statChip}><Text style={styles.statChipText}>🏆  {MAX_SCORE} pts max</Text></View>
          </View>

          <TouchableOpacity onPress={() => startLobby(mode)} activeOpacity={0.85}>
            <LinearGradient colors={["#065f46","#022c22"]} style={styles.startBtn}>
              <Text style={styles.startBtnText}>Start Game</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Lobby countdown ───────────────────────────────────────────────────────
  if (phase === "lobby") {
    return (
      <SafeAreaView style={styles.root}>
        <LinearGradient colors={["#001a0a","#002a14"]} style={styles.countdownScreen}>
          <Text style={styles.countdownNum}>{lobbyCount}</Text>
          <Text style={styles.countdownLabel}>Get ready!</Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // ─── Final ─────────────────────────────────────────────────────────────────
  if (phase === "final") {
    return (
      <PostGameCard
        score={score}
        maxScore={25000}
        gameEmoji="🗺️"
        gameTitle="Geo Guesser"
        onPlayAgain={() => setPhase("welcome")}
      />
    );
  }

  if (!current) return null;

  // ─── Guessing ──────────────────────────────────────────────────────────────
  if (phase === "guessing") {
    return (
      <SafeAreaView style={styles.root}>
        <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>
          {/* Timer bar */}
          <View style={styles.timerTrack}>
            <View style={[styles.timerFill, { width: `${timerPct * 100}%`, backgroundColor: timerColor }]} />
          </View>

          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={styles.eyebrow}>GEO GUESSER · ROUND {idx + 1}/{TOTAL_ROUNDS} · {mode === "pin" ? "PIN MODE" : "REGION MODE"}</Text>
            <Text style={[styles.timerText, isUrgent && styles.timerTextUrgent]}>{timeLeft}s</Text>
          </View>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreLabel}>Score</Text>
            <Text style={styles.scoreVal}>{score.toLocaleString()} pts</Text>
          </View>

          {/* Location image + clue */}
          <View style={styles.imageContainer}>
            <Image source={{ uri: current.imageUrl }} style={styles.locationImage} resizeMode="cover" />
            <LinearGradient colors={["transparent","rgba(0,0,0,0.85)"]} style={styles.imageGradient} />
            <View style={styles.mysteryBadge}><Text style={styles.mysteryText}>MYSTERY LOCATION</Text></View>
            <View style={styles.clueOverlay}>
              <Text style={styles.clueLabel}>CLUE</Text>
              <Text style={styles.clueText}>{current.clue}</Text>
            </View>
          </View>

          {/* Region buttons */}
          {mode === "region" && (
            <ScrollView contentContainerStyle={styles.regionsContainer}>
              <Text style={styles.regionPrompt}>Which region is this?</Text>
              <View style={styles.regionsGrid}>
                {ALL_REGIONS.map((region) => (
                  <TouchableOpacity key={region} style={styles.regionBtn} onPress={() => guessRegion(region)} activeOpacity={0.7}>
                    <Text style={styles.regionEmoji}>{REGION_EMOJIS[region]}</Text>
                    <Text style={styles.regionName}>{region}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

          {/* Pin drop map */}
          {mode === "pin" && (
            <View style={styles.pinModeContainer}>
              <Text style={styles.pinInstruction}>Tap the map to drop your pin</Text>
              <View style={styles.mapWrapper}>
                <WorldMap
                  width={SW}
                  height={MAP_H}
                  pendingPin={pendingPin}
                  onTap={handleMapTap}
                />
              </View>
              <TouchableOpacity
                style={[styles.lockInBtn, !pendingPin && styles.lockInBtnDisabled]}
                onPress={lockPin}
                disabled={!pendingPin}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={pendingPin ? ["#065f46","#022c22"] : ["#1a1a1a","#1a1a1a"]}
                  style={styles.lockInBtnGradient}
                >
                  <Text style={[styles.lockInBtnText, !pendingPin && styles.lockInBtnTextDisabled]}>
                    {pendingPin ? "📍  Lock In Pin" : "Tap map to place pin"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </SafeAreaView>
    );
  }

  // ─── Reveal ────────────────────────────────────────────────────────────────
  const isRegionCorrect = mode === "region" && selected === current.actualRegion;
  const resultColor = mode === "pin"
    ? (distKm !== null ? distanceColor(distKm) : "#555")
    : (isRegionCorrect ? ACCENT : "#ef4444");

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.revealContainer}>
        <Text style={styles.eyebrow}>ROUND {idx + 1} · REVEAL</Text>

        {/* Result banner */}
        <View style={[styles.resultBanner, { borderColor: resultColor, backgroundColor: resultColor + "18" }]}>
          <Text style={styles.resultIcon}>
            {mode === "region"
              ? (isRegionCorrect ? "✅" : "❌")
              : (distKm !== null && distKm < 500 ? "🎯" : "📍")}
          </Text>
          <View style={{ flex: 1 }}>
            {mode === "region" ? (
              <>
                <Text style={[styles.resultTitle, { color: resultColor }]}>
                  {isRegionCorrect ? "Correct!" : "Wrong!"}
                </Text>
                {!isRegionCorrect && selected ? (
                  <Text style={styles.resultSub}>You guessed {selected}</Text>
                ) : null}
              </>
            ) : (
              <>
                <Text style={[styles.resultTitle, { color: resultColor }]}>
                  {distKm !== null ? distanceLabel(distKm) : "Time's up!"}
                </Text>
                {distKm !== null && (
                  <Text style={[styles.resultSub, { color: resultColor }]}>
                    {formatKm(distKm)} from the real location
                  </Text>
                )}
              </>
            )}
          </View>
          <View style={[styles.ptsBubble, { borderColor: resultColor }]}>
            <Text style={[styles.ptsNum, { color: resultColor }]}>+{roundPts.toLocaleString()}</Text>
            <Text style={styles.ptsLabel}>pts</Text>
          </View>
        </View>

        {/* Location card */}
        <View style={[styles.locationCard, { borderColor: ACCENT }]}>
          <Text style={styles.locationCardLabel}>THE LOCATION WAS</Text>
          <Text style={styles.locationCardEmoji}>{current.locationEmoji}</Text>
          <Text style={styles.locationCardName}>{current.locationName}</Text>
          <Text style={styles.locationCardSub}>{current.actualLocation}</Text>
          <View style={[styles.regionTag, { borderColor: ACCENT + "55", backgroundColor: ACCENT + "15" }]}>
            <Text style={[styles.regionTagText, { color: ACCENT }]}>
              {REGION_EMOJIS[current.actualRegion]}  {current.actualRegion}
            </Text>
          </View>
        </View>

        {/* Pin mode: show map with correct + guess pins */}
        {mode === "pin" && (
          <View style={styles.revealMapWrapper}>
            <WorldMap
              width={SW - 40}
              height={Math.round((SW - 40) * 0.5)}
              correctPin={{ lat: current.lat, lng: current.lng }}
              pins={lockedPin ? [{ lat: lockedPin.lat, lng: lockedPin.lng, color: "#ef4444", label: "You" }] : []}
            />
            <View style={styles.mapLegend}>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: "#FFD700" }]} />
                <Text style={styles.legendText}>Correct location</Text>
              </View>
              {lockedPin && (
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: "#ef4444" }]} />
                  <Text style={styles.legendText}>Your pin</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Score so far */}
        <View style={styles.scoreSoFar}>
          <Text style={styles.scoreSoFarLabel}>TOTAL SCORE</Text>
          <Text style={styles.scoreSoFarVal}>{score.toLocaleString()} pts</Text>
        </View>

        <TouchableOpacity onPress={next} activeOpacity={0.85}>
          <LinearGradient colors={["#065f46","#022c22"]} style={styles.nextBtn}>
            <Text style={styles.nextBtnText}>
              {idx + 1 >= TOTAL_ROUNDS ? "See Final Results →" : `Round ${idx + 2} →`}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#08081a" },

  // Timer
  timerTrack: { height: 5, backgroundColor: "#1e1e3a" },
  timerFill:  { height: "100%", borderRadius: 2 },

  // Header
  headerRow:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8 },
  eyebrow:         { color: ACCENT, fontSize: 9, fontWeight: "800", letterSpacing: 1.2, flex: 1 },
  timerText:       { color: "#fff", fontSize: 24, fontWeight: "900" },
  timerTextUrgent: { color: "#ef4444" },
  scoreRow:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 4 },
  scoreLabel:      { color: "#555", fontSize: 11, fontWeight: "700" },
  scoreVal:        { color: "#fff", fontSize: 14, fontWeight: "900" },

  // Image
  imageContainer:  { height: 160, position: "relative" },
  locationImage:   { width: "100%", height: 160 },
  imageGradient:   { position: "absolute", bottom: 0, left: 0, right: 0, height: 100 },
  mysteryBadge:    { position: "absolute", top: 10, left: 12, backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: ACCENT + "55" },
  mysteryText:     { color: ACCENT, fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  clueOverlay:     { position: "absolute", bottom: 10, left: 12, right: 12, gap: 2 },
  clueLabel:       { color: ACCENT + "cc", fontSize: 9, fontWeight: "800", letterSpacing: 2 },
  clueText:        { color: "#fff", fontSize: 13, fontWeight: "700", lineHeight: 18 },

  // Region mode
  regionsContainer:{ padding: 12, paddingBottom: 30 },
  regionPrompt:    { color: "#888", fontSize: 13, fontWeight: "700", marginBottom: 10, textAlign: "center" },
  regionsGrid:     { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  regionBtn:       { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#12122a", borderRadius: 12, borderWidth: 1, borderColor: "#1e1e3a", paddingHorizontal: 12, paddingVertical: 10, width: "47%" },
  regionEmoji:     { fontSize: 18 },
  regionName:      { color: "#ccc", fontSize: 13, fontWeight: "700", flex: 1 },

  // Pin mode
  pinModeContainer:{ flex: 1 },
  pinInstruction:  { color: "#888", fontSize: 12, textAlign: "center", paddingVertical: 6, backgroundColor: "#0d0d20" },
  mapWrapper:      { flex: 1 },
  lockInBtn:       { margin: 12 },
  lockInBtnDisabled: { opacity: 0.5 },
  lockInBtnGradient:{ borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  lockInBtnText:   { color: "#fff", fontSize: 15, fontWeight: "900" },
  lockInBtnTextDisabled: { color: "#555" },

  // Welcome
  welcomeContainer:{ alignItems: "center", padding: 24, paddingTop: 32, gap: 16 },
  backBtn:         { alignSelf: "flex-start", marginBottom: 4 },
  backBtnText:     { color: "#666", fontSize: 14, fontWeight: "600" },
  welcomeEmoji:    { fontSize: 68 },
  welcomeTitle:    { color: "#fff", fontSize: 30, fontWeight: "900" },
  welcomeSub:      { color: "#888", fontSize: 15, textAlign: "center", lineHeight: 22 },

  modeToggleCard:  { width: "100%", backgroundColor: "#12122a", borderRadius: 18, borderWidth: 1, borderColor: "#1e1e3a", padding: 16, gap: 12 },
  modeToggleLabel: { color: "#555", fontSize: 10, fontWeight: "800", letterSpacing: 2, textAlign: "center" },
  modeToggleRow:   { flexDirection: "row", gap: 10 },
  modeBtn:         { flex: 1, backgroundColor: "#0d0d20", borderRadius: 14, borderWidth: 2, borderColor: "#1e1e3a", padding: 14, alignItems: "center", gap: 4 },
  modeBtnActive:   { borderColor: ACCENT, backgroundColor: ACCENT + "18" },
  modeBtnEmoji:    { fontSize: 28 },
  modeBtnTitle:    { color: "#888", fontSize: 14, fontWeight: "800" },
  modeBtnTitleActive: { color: ACCENT },
  modeBtnSub:      { color: "#555", fontSize: 11, textAlign: "center" },
  modeBtnPts:      { color: "#444", fontSize: 10, fontWeight: "700", marginTop: 2 },
  modeHint:        { backgroundColor: ACCENT + "18", borderRadius: 10, padding: 10 },
  modeHintText:    { color: ACCENT, fontSize: 12, lineHeight: 18 },

  welcomeStats:    { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" },
  statChip:        { backgroundColor: "#12122a", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: "#1e1e3a" },
  statChipText:    { color: "#aaa", fontSize: 12, fontWeight: "700" },
  startBtn:        { borderRadius: 16, paddingVertical: 18, paddingHorizontal: 48, alignItems: "center", marginTop: 4 },
  startBtnText:    { color: "#fff", fontSize: 18, fontWeight: "900" },

  // Countdown
  countdownScreen: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  countdownNum:    { color: ACCENT, fontSize: 96, fontWeight: "900" },
  countdownLabel:  { color: "#888", fontSize: 20, fontWeight: "700" },

  // Reveal
  revealContainer: { padding: 20, gap: 14 },
  resultBanner:    { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 2, padding: 16 },
  resultIcon:      { fontSize: 28 },
  resultTitle:     { fontSize: 20, fontWeight: "900" },
  resultSub:       { color: "#888", fontSize: 13, marginTop: 2 },
  ptsBubble:       { alignItems: "center", borderWidth: 2, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  ptsNum:          { fontSize: 20, fontWeight: "900", lineHeight: 22 },
  ptsLabel:        { color: "#888", fontSize: 10 },

  locationCard:    { backgroundColor: "#12122a", borderRadius: 20, borderWidth: 2, padding: 18, alignItems: "center", gap: 6 },
  locationCardLabel: { color: "#888", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  locationCardEmoji: { fontSize: 40, marginVertical: 4 },
  locationCardName:  { color: "#fff", fontSize: 20, fontWeight: "900", textAlign: "center" },
  locationCardSub:   { color: "#666", fontSize: 13 },
  regionTag:         { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6, marginTop: 4 },
  regionTagText:     { fontSize: 13, fontWeight: "800" },

  revealMapWrapper:{ borderRadius: 16, overflow: "hidden", marginHorizontal: -20, position: "relative" },
  mapLegend:       { position: "absolute", bottom: 10, right: 10, backgroundColor: "rgba(0,0,0,0.75)", borderRadius: 10, padding: 8, gap: 5 },
  legendRow:       { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot:       { width: 10, height: 10, borderRadius: 5 },
  legendText:      { color: "#fff", fontSize: 11, fontWeight: "600" },

  scoreSoFar:      { backgroundColor: "#12122a", borderRadius: 14, borderWidth: 1, borderColor: "#1e1e3a", padding: 14, alignItems: "center" },
  scoreSoFarLabel: { color: "#888", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  scoreSoFarVal:   { color: "#fff", fontSize: 28, fontWeight: "900", marginTop: 4 },
  nextBtn:         { borderRadius: 16, paddingVertical: 18, alignItems: "center" },
  nextBtnText:     { color: "#fff", fontSize: 16, fontWeight: "900" },

  // Final
  finalContainer:  { alignItems: "center", padding: 24, gap: 16 },
  finalEmoji:      { fontSize: 80 },
  finalTitle:      { color: "#fff", fontSize: 32, fontWeight: "900" },
  finalGrade:      { color: ACCENT, fontSize: 20, fontWeight: "800" },
  finalScoreCard:  { backgroundColor: "#12122a", borderRadius: 20, borderWidth: 2, borderColor: ACCENT, padding: 24, alignItems: "center", width: "100%" },
  finalScoreLabel: { color: "#888", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  finalScoreNum:   { color: ACCENT, fontSize: 56, fontWeight: "900", lineHeight: 60, marginVertical: 4 },
  finalScoreMax:   { color: "#555", fontSize: 14 },
  exitBtn:         { paddingVertical: 14, alignItems: "center", width: "100%" },
  exitBtnText:     { color: "#555", fontSize: 15, fontWeight: "700" },
});
