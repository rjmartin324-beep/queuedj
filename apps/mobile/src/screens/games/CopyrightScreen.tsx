import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  TextInput, KeyboardAvoidingView, Platform, Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { PostGameCard } from "../../components/shared/PostGameCard";
import { StandaloneDrawingPad, DrawingDisplay } from "../../components/shared/StandaloneDrawingPad";
import type { DrawPath } from "../../components/shared/StandaloneDrawingPad";

const ACCENT      = "#f59e0b";
const TOTAL_ROUNDS = 5;

const ARTWORKS = [
  {
    title: "Starry Night",              emoji: "🌌", artist: "Van Gogh",
    description: "A swirling night sky over a village with a bright crescent moon, painted with thick swirling brushstrokes in deep blues and yellows",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg/800px-Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg",
  },
  {
    title: "Mona Lisa",                 emoji: "🖼️", artist: "Da Vinci",
    description: "A mysterious woman with an enigmatic smile sits before a vast landscape, her gaze following the viewer wherever they stand",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg/402px-Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg",
  },
  {
    title: "The Scream",                emoji: "😱", artist: "Munch",
    description: "A figure with a skull-like face holds its face in horror on a bridge while the sky swirls with red and orange behind it",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Edvard_Munch%2C_1893%2C_The_Scream%2C_oil%2C_tempera_and_pastel_on_cardboard%2C_91_x_73_cm%2C_National_Gallery_of_Norway.jpg/579px-Edvard_Munch%2C_1893%2C_The_Scream%2C_oil%2C_tempera_and_pastel_on_cardboard%2C_91_x_73_cm%2C_National_Gallery_of_Norway.jpg",
  },
  {
    title: "Girl with a Pearl Earring", emoji: "💎", artist: "Vermeer",
    description: "A young girl looks back over her shoulder wearing a large pearl earring and a blue and gold headscarf against a dark background",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/1665_Girl_with_a_Pearl_Earring.jpg/591px-1665_Girl_with_a_Pearl_Earring.jpg",
  },
  {
    title: "The Persistence of Memory", emoji: "⏰", artist: "Dalí",
    description: "Melting clocks draped over bizarre landscape objects in a surreal dreamscape. A distorted face lies on the ground",
    image: "https://upload.wikimedia.org/wikipedia/en/d/dd/The_Persistence_of_Memory.jpg",
  },
  {
    title: "American Gothic",           emoji: "🏚️", artist: "Wood",
    description: "A stern-faced farmer and his daughter stand in front of a gothic-style farmhouse. He holds a pitchfork",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Grant_DeVolson_Wood_-_American_Gothic.jpg/480px-Grant_DeVolson_Wood_-_American_Gothic.jpg",
  },
  {
    title: "The Birth of Venus",        emoji: "🐚", artist: "Botticelli",
    description: "A nude goddess emerges from the sea standing on a giant shell, blown to shore by winds while a woman rushes to clothe her",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Sandro_Botticelli_-_La_nascita_di_Venere_-_Google_Art_Project_-_edited.jpg/800px-Sandro_Botticelli_-_La_nascita_di_Venere_-_Google_Art_Project_-_edited.jpg",
  },
  {
    title: "Water Lilies",              emoji: "🌸", artist: "Monet",
    description: "Floating lily pads and flowers on a pond's surface, reflected light creating shimmering abstract shapes in soft pinks and greens",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Claude_Monet_-_Water_Lilies_-_1906%2C_Ryerson.jpg/800px-Claude_Monet_-_Water_Lilies_-_1906%2C_Ryerson.jpg",
  },
];

function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

type Phase = "welcome" | "viewing" | "drawing" | "guessing" | "reveal" | "results";

export default function CopyrightScreen() {
  const router = useRouter();
  const [phase, setPhase]   = useState<Phase>("welcome");
  const [artworks, setArtworks] = useState<typeof ARTWORKS>([]);
  const [round, setRound]   = useState(0);
  const [score, setScore]   = useState(0);
  const [guess, setGuess]   = useState("");
  const [drawing, setDrawing] = useState<DrawPath[]>([]);
  const [roundResults, setRoundResults] = useState<{ title: string; guess: string; correct: boolean }[]>([]);

  const drawerName  = round % 2 === 0 ? "Player 1" : "Player 2";
  const guesserName = round % 2 === 0 ? "Player 2" : "Player 1";

  function startGame() {
    setArtworks(pickRandom(ARTWORKS, TOTAL_ROUNDS));
    setRound(0);
    setScore(0);
    setGuess("");
    setRoundResults([]);
    setPhase("viewing");
  }

  function doneViewing() { setPhase("drawing"); }

  function doneDrawing(paths: DrawPath[]) {
    setDrawing(paths);
    setGuess("");
    setPhase("guessing");
  }

  function submitGuess() {
    if (!guess.trim()) return;
    const art     = artworks[round];
    const correct = guess.trim().toLowerCase() === art.title.toLowerCase();
    if (correct) setScore((s) => s + 100);
    setRoundResults((r) => [...r, { title: art.title, guess: guess.trim(), correct }]);
    setPhase("reveal");
  }

  function nextRound() {
    const next = round + 1;
    if (next >= TOTAL_ROUNDS) {
      setPhase("results");
    } else {
      setRound(next);
      setGuess("");
      setDrawing([]);
      setPhase("viewing");
    }
  }

  // ── Welcome ──────────────────────────────────────────────────────────────────

  if (phase === "welcome") {
    return (
      <LinearGradient colors={["#1a0a00", "#0d0800"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <TouchableOpacity style={s.back} onPress={() => router.back()}>
            <Text style={s.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={s.center}>
            <Text style={s.emoji}>🎨</Text>
            <Text style={s.title}>Copyright</Text>
            <Text style={s.sub}>Recreate famous artworks from memory — pass &amp; play for 2</Text>
            <View style={s.rulesBox}>
              <Text style={s.ruleItem}>• {TOTAL_ROUNDS} rounds — players alternate</Text>
              <Text style={s.ruleItem}>• {drawerName === "Player 1" ? "Player 1" : "Player 2"} studies the artwork description</Text>
              <Text style={s.ruleItem}>• Then recreates it on paper while the other guesses</Text>
              <Text style={s.ruleItem}>• Correct artwork name = +100 pts</Text>
            </View>
            <TouchableOpacity style={s.startBtn} onPress={startGame}>
              <LinearGradient colors={["#b45309", ACCENT]} style={s.startBtnInner}>
                <Text style={s.startBtnText}>START GAME</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── Viewing ───────────────────────────────────────────────────────────────────

  if (phase === "viewing") {
    const art = artworks[round];
    return (
      <LinearGradient colors={["#1a0a00", "#0d0800"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <View style={s.topBar}>
            <Text style={s.roundPill}>Round {round + 1} / {TOTAL_ROUNDS}</Text>
            <Text style={s.scoreChip}>Score: {score}</Text>
          </View>
          <View style={[s.playerBadge, { marginHorizontal: 16, alignSelf: "flex-start" }]}>
            <Text style={s.playerBadgeText}>👁️ {drawerName} — study this artwork</Text>
          </View>
          {/* Artwork image */}
          <Image
            source={{ uri: art.image }}
            style={s.artImage}
            resizeMode="contain"
          />
          <View style={{ paddingHorizontal: 16, flex: 1 }}>
            <View style={s.promptCard}>
              <Text style={s.promptLabel}>ARTWORK DESCRIPTION</Text>
              <Text style={s.promptText}>{art.description}</Text>
              <Text style={s.artistHint}>— {art.artist}</Text>
            </View>
            <Text style={s.hint}>{guesserName} — look away! You'll be guessing next.</Text>
            <TouchableOpacity style={s.actionBtn} onPress={doneViewing}>
              <LinearGradient colors={["#b45309", ACCENT]} style={s.actionBtnInner}>
                <Text style={s.actionBtnText}>I've Memorised It →</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── Drawing ───────────────────────────────────────────────────────────────────

  if (phase === "drawing") {
    return (
      <LinearGradient colors={["#1a0a00", "#0d0800"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <View style={s.topBar}>
            <Text style={s.roundPill}>Round {round + 1} / {TOTAL_ROUNDS}</Text>
            <Text style={s.scoreChip}>Score: {score}</Text>
          </View>
          <Text style={s.subHint}>{guesserName} — look away!</Text>
          <StandaloneDrawingPad
            prompt={artworks[round].title}
            onDone={doneDrawing}
            accentColor={ACCENT}
          />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── Guessing ─────────────────────────────────────────────────────────────────

  if (phase === "guessing") {
    return (
      <LinearGradient colors={["#1a0a00", "#0d0800"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={s.topBar}>
              <Text style={s.roundPill}>Round {round + 1} / {TOTAL_ROUNDS}</Text>
              <Text style={s.scoreChip}>Score: {score}</Text>
            </View>
            <View style={[s.playerBadge, { marginHorizontal: 16, alignSelf: "flex-start" }]}>
              <Text style={s.playerBadgeText}>🔍 {guesserName} — name this artwork!</Text>
            </View>
            {/* Show the drawing */}
            <DrawingDisplay paths={drawing} style={s.drawingDisplay} />
            {/* Guess input */}
            <View style={s.guessPad}>
              <TextInput
                style={s.input}
                value={guess}
                onChangeText={setGuess}
                placeholder="e.g. Starry Night"
                placeholderTextColor="#555"
                autoFocus
                returnKeyType="done"
                onSubmitEditing={submitGuess}
              />
              <TouchableOpacity
                style={[s.actionBtn, !guess.trim() && s.actionBtnDisabled]}
                onPress={submitGuess}
                disabled={!guess.trim()}
              >
                <LinearGradient
                  colors={guess.trim() ? ["#b45309", ACCENT] : ["#333", "#444"]}
                  style={s.actionBtnInner}
                >
                  <Text style={s.actionBtnText}>Submit Guess</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── Reveal ────────────────────────────────────────────────────────────────────

  if (phase === "reveal") {
    const last = roundResults[roundResults.length - 1];
    const art  = artworks[round];
    return (
      <LinearGradient colors={["#1a0a00", "#0d0800"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <View style={s.topBar}>
            <Text style={s.roundPill}>Round {round + 1} / {TOTAL_ROUNDS}</Text>
            <Text style={s.scoreChip}>Score: {score}</Text>
          </View>
          <View style={s.center}>
            <Text style={s.revealEmoji}>{last.correct ? "🎉" : "😅"}</Text>
            <Text style={[s.revealVerdict, { color: last.correct ? "#4ade80" : "#f87171" }]}>
              {last.correct ? "Correct! +100" : "Not quite..."}
            </Text>
            <View style={s.revealCard}>
              <View style={s.revealRow}>
                <Text style={s.revealLabel}>THE ARTWORK WAS</Text>
                <Text style={s.revealValue}>{art.emoji} {art.title}</Text>
                <Text style={s.revealArtist}>by {art.artist}</Text>
              </View>
              <View style={s.divider} />
              <View style={s.revealRow}>
                <Text style={s.revealLabel}>THE GUESS WAS</Text>
                <Text style={[s.revealValue, { color: last.correct ? "#4ade80" : "#f87171" }]}>
                  "{last.guess}"
                </Text>
              </View>
            </View>
            <TouchableOpacity style={s.actionBtn} onPress={nextRound}>
              <LinearGradient colors={["#b45309", ACCENT]} style={s.actionBtnInner}>
                <Text style={s.actionBtnText}>
                  {round + 1 >= TOTAL_ROUNDS ? "See Results" : "Next Round →"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── Results ───────────────────────────────────────────────────────────────────

  if (phase === "results") {
    return (
      <PostGameCard
        score={score}
        maxScore={TOTAL_ROUNDS * 100}
        gameEmoji="🎨"
        gameTitle="Copyright"
        onPlayAgain={startGame}
      />
    );
  }

  return null;
}

const s = StyleSheet.create({
  flex:            { flex: 1 },
  back:            { padding: 16, paddingTop: 8 },
  backText:        { color: ACCENT, fontSize: 16, fontWeight: "700" },
  center:          { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  emoji:           { fontSize: 64, marginBottom: 16, textAlign: "center" },
  title:           { color: "#fff", fontSize: 30, fontWeight: "900", marginBottom: 8, textAlign: "center" },
  sub:             { color: "#888", fontSize: 14, textAlign: "center", marginBottom: 24 },
  rulesBox:        { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 16, width: "100%", marginBottom: 32 },
  ruleItem:        { color: "#ccc", fontSize: 14, marginBottom: 6 },
  startBtn:        { width: "100%", borderRadius: 14, overflow: "hidden" },
  startBtnInner:   { padding: 18, alignItems: "center" },
  startBtnText:    { color: "#fff", fontSize: 17, fontWeight: "900", letterSpacing: 1 },

  topBar:          { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12 },
  roundPill:       { color: "#888", fontWeight: "700", fontSize: 13 },
  scoreChip:       { color: ACCENT, fontWeight: "800", fontSize: 14 },

  playerBadge:     { backgroundColor: "rgba(245,158,11,0.12)", borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8, marginBottom: 20, borderWidth: 1, borderColor: "rgba(245,158,11,0.25)" },
  playerBadgeText: { color: ACCENT, fontSize: 14, fontWeight: "800" },

  artEmoji:        { fontSize: 48, marginBottom: 12 },
  artImage:        { width: "100%", height: 200, marginBottom: 12 },

  promptCard:      { backgroundColor: "rgba(245,158,11,0.08)", borderRadius: 24, padding: 24, width: "100%", marginBottom: 16, borderWidth: 1, borderColor: "rgba(245,158,11,0.2)" },
  promptLabel:     { color: ACCENT, fontSize: 11, fontWeight: "900", letterSpacing: 2, marginBottom: 12 },
  promptText:      { color: "#fff", fontSize: 16, fontWeight: "600", textAlign: "center", lineHeight: 24 },
  artistHint:      { color: "#888", fontSize: 13, marginTop: 12, textAlign: "center", fontStyle: "italic" },

  subHint:         { color: "#555", fontSize: 12, paddingHorizontal: 16, marginBottom: 4 },
  hint:            { color: "#555", fontSize: 13, textAlign: "center", marginBottom: 16 },

  drawingDisplay:  { flex: 1, marginHorizontal: 10, marginVertical: 8, minHeight: 200 },
  guessPad:        { paddingHorizontal: 16, paddingBottom: 16 },

  actionBtn:       { width: "100%", borderRadius: 14, overflow: "hidden", marginTop: 8 },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnInner:  { padding: 18, alignItems: "center" },
  actionBtnText:   { color: "#fff", fontSize: 17, fontWeight: "900" },
  input: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.3)",
    borderRadius: 14,
    padding: 18,
    color: "#fff",
    fontSize: 18,
    marginBottom: 20,
    textAlign: "center",
  },

  revealEmoji:   { fontSize: 64, marginBottom: 12, textAlign: "center" },
  revealVerdict: { fontSize: 24, fontWeight: "900", marginBottom: 24 },
  revealCard:    { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 20, padding: 24, width: "100%", marginBottom: 28 },
  revealRow:     { paddingVertical: 8 },
  revealLabel:   { color: "#666", fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: 4 },
  revealValue:   { color: "#fff", fontSize: 18, fontWeight: "700" },
  revealArtist:  { color: "#888", fontSize: 13, marginTop: 4, fontStyle: "italic" },
  divider:       { height: 1, backgroundColor: "rgba(255,255,255,0.08)", marginVertical: 8 },
});
