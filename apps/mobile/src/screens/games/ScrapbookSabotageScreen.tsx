import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { PostGameCard } from "../../components/shared/PostGameCard";

const ACCENT = "#fbbf24";
const SENTENCES_PER_PLAYER = 5;

const SABOTAGE_CARDS = [
  "The next sentence must include an animal 🐾",
  "The next sentence must happen underwater 🌊",
  "Suddenly, it all turns into a musical 🎵",
  "The next sentence must be about food 🍕",
  "A ghost appears from nowhere 👻",
  "The entire story is now set in space 🚀",
  "Someone starts speaking in rhymes 🎭",
  "A time machine appears ⏰",
  "It was all a dream... or was it? 💭",
  "Add a completely random character 👤",
  "The weather becomes extremely weird ⛈️",
  "Someone reveals a shocking secret 😱",
  "A portal to another dimension opens 🌀",
  "Everyone suddenly can't remember anything 🤔",
  "An explosion occurs for no reason 💥",
];

function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

type Phase = "welcome" | "playing" | "story";

export default function ScrapbookSabotageScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("welcome");
  const [playerCount, setPlayerCount] = useState(3);
  const [turnIndex, setTurnIndex] = useState(0); // global turn counter
  const [text, setText] = useState("");
  const [story, setStory] = useState<{ player: number; sentence: string; sabotage: string | null }[]>([]);
  const [sabotageCards, setSabotageCards] = useState<string[]>([]);
  const [currentSabotage, setCurrentSabotage] = useState<string | null>(null);

  const totalTurns = playerCount * SENTENCES_PER_PLAYER;
  const currentPlayer = (turnIndex % playerCount) + 1;

  function startGame() {
    setTurnIndex(0);
    setText("");
    setStory([]);
    setCurrentSabotage(null);
    // Pre-generate sabotage cards for every 2nd turn
    const saboturns = Math.floor(totalTurns / 2);
    setSabotageCards(pickRandom(SABOTAGE_CARDS, saboturns));
    setPhase("playing");
  }

  // A sabotage triggers at turns 2, 4, 6, ... (every 2nd turn, 0-indexed)
  function getSabotageForTurn(turn: number): string | null {
    if (turn > 0 && turn % 2 === 0) {
      const sabIndex = (turn / 2) - 1;
      return sabotageCards[sabIndex] ?? null;
    }
    return null;
  }

  // When we advance to a new turn, compute the sabotage for that turn
  function advanceTurn(nextTurn: number) {
    const sabotage = getSabotageForTurn(nextTurn);
    setCurrentSabotage(sabotage);
    setTurnIndex(nextTurn);
    setText("");
  }

  function submitSentence() {
    if (!text.trim()) return;
    const newEntry = { player: currentPlayer, sentence: text.trim(), sabotage: currentSabotage };
    const newStory = [...story, newEntry];
    setStory(newStory);

    const nextTurn = turnIndex + 1;
    if (nextTurn >= totalTurns) {
      setPhase("story");
    } else {
      advanceTurn(nextTurn);
    }
  }

  if (phase === "welcome") {
    return (
      <LinearGradient colors={["#1a1200", "#08081a"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <TouchableOpacity style={s.back} onPress={() => router.back()}>
            <Text style={s.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={s.center}>
            <Text style={s.emoji}>📒</Text>
            <Text style={s.title}>Scrapbook Sabotage</Text>
            <Text style={s.sub}>Build a story together — with unexpected twists!</Text>
            <View style={s.rulesBox}>
              <Text style={s.ruleItem}>• Each player adds one sentence per turn</Text>
              <Text style={s.ruleItem}>• Every 2 turns a Sabotage Card appears</Text>
              <Text style={s.ruleItem}>• The sabotage must be included!</Text>
              <Text style={s.ruleItem}>• Read the full story at the end</Text>
            </View>

            {/* Player count selector */}
            <View style={s.selectorContainer}>
              <Text style={s.selectorLabel}>How many players?</Text>
              <View style={s.selectorRow}>
                {[2, 3, 4, 5, 6].map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={[s.selectorBtn, playerCount === n && s.selectorBtnActive]}
                    onPress={() => setPlayerCount(n)}
                  >
                    <Text style={[s.selectorBtnText, playerCount === n && s.selectorBtnTextActive]}>
                      {n}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity style={s.startBtn} onPress={startGame}>
              <LinearGradient colors={["#b45309", ACCENT]} style={s.startBtnInner}>
                <Text style={s.startBtnText}>START STORY</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (phase === "story") {
    return (
      <PostGameCard
        score={0}
        gameEmoji="📒"
        gameTitle="Scrapbook Sabotage"
        onPlayAgain={startGame}
      />
    );
  }

  // Playing phase
  const progress = (turnIndex / totalTurns) * 100;
  const nextPlayer = ((turnIndex + 1) % playerCount) + 1;

  return (
    <LinearGradient colors={["#1a1200", "#08081a"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          {/* Progress */}
          <View style={s.progressContainer}>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={s.progressLabel}>Turn {turnIndex + 1} / {totalTurns}</Text>
          </View>

          <ScrollView contentContainerStyle={s.playContent} keyboardShouldPersistTaps="handled">
            {/* Player turn badge */}
            <View style={s.playerBadge}>
              <Text style={s.playerBadgeText}>Player {currentPlayer}'s turn ✏️</Text>
            </View>

            {/* Sabotage card if active */}
            {currentSabotage && (
              <View style={s.sabotageCard}>
                <Text style={s.sabotageTitle}>SABOTAGE CARD!</Text>
                <Text style={s.sabotageText}>{currentSabotage}</Text>
              </View>
            )}

            {/* Story so far (last 3 sentences) */}
            {story.length > 0 && (
              <View style={s.storyPreview}>
                <Text style={s.storyPreviewLabel}>Story so far...</Text>
                <Text style={s.storyPreviewText} numberOfLines={6}>
                  {story.slice(-3).map((e) => e.sentence).join(" ")}
                  {story.length > 3 ? "..." : ""}
                </Text>
              </View>
            )}
            {story.length === 0 && (
              <View style={s.storyPreview}>
                <Text style={s.storyPreviewLabel}>Start the story!</Text>
                <Text style={s.storyPreviewText}>Write the very first sentence...</Text>
              </View>
            )}

            {/* Input */}
            <TextInput
              style={s.input}
              value={text}
              onChangeText={setText}
              placeholder="Add your sentence..."
              placeholderTextColor="#555"
              multiline
              returnKeyType="done"
              blurOnSubmit
            />

            <TouchableOpacity
              style={[s.actionBtn, !text.trim() && s.actionBtnDisabled]}
              onPress={submitSentence}
              disabled={!text.trim()}
            >
              <LinearGradient
                colors={text.trim() ? ["#b45309", ACCENT] : ["#333", "#444"]}
                style={s.actionBtnInner}
              >
                <Text style={s.actionBtnText}>
                  {turnIndex + 1 >= totalTurns
                    ? "Finish Story →"
                    : `Submit → Pass to Player ${nextPlayer}`}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  back: { padding: 16, paddingTop: 8 },
  backText: { color: ACCENT, fontSize: 16, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  emoji: { fontSize: 64, marginBottom: 16, textAlign: "center" },
  title: { color: "#fff", fontSize: 30, fontWeight: "900", marginBottom: 8, textAlign: "center" },
  sub: { color: "#888", fontSize: 14, textAlign: "center", marginBottom: 24 },
  rulesBox: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 16, width: "100%", marginBottom: 24 },
  ruleItem: { color: "#ccc", fontSize: 14, marginBottom: 6 },
  startBtn: { width: "100%", borderRadius: 14, overflow: "hidden", marginBottom: 12 },
  startBtnInner: { padding: 18, alignItems: "center" },
  startBtnText: { color: "#fff", fontSize: 17, fontWeight: "900", letterSpacing: 1 },
  homeBtn: { padding: 12, marginTop: 4 },
  homeBtnText: { color: "#666", fontSize: 15 },

  selectorContainer: { width: "100%", marginBottom: 24 },
  selectorLabel: { color: "#ccc", fontSize: 14, fontWeight: "700", marginBottom: 10, textAlign: "center" },
  selectorRow: { flexDirection: "row", justifyContent: "center", gap: 10 },
  selectorBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: "rgba(251,191,36,0.25)", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(251,191,36,0.06)" },
  selectorBtnActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  selectorBtnText: { color: "#888", fontSize: 16, fontWeight: "800" },
  selectorBtnTextActive: { color: "#000" },

  progressContainer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  progressTrack: { height: 6, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 3, marginBottom: 6 },
  progressFill: { height: 6, backgroundColor: ACCENT, borderRadius: 3 },
  progressLabel: { color: "#888", fontSize: 12, fontWeight: "700", textAlign: "right" },

  playContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  playerBadge: { alignSelf: "center", backgroundColor: "rgba(251,191,36,0.12)", borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8, marginBottom: 16, borderWidth: 1, borderColor: "rgba(251,191,36,0.3)" },
  playerBadgeText: { color: ACCENT, fontSize: 15, fontWeight: "800" },

  sabotageCard: { backgroundColor: "rgba(251,191,36,0.1)", borderWidth: 1.5, borderColor: ACCENT, borderRadius: 16, padding: 16, marginBottom: 16 },
  sabotageTitle: { color: ACCENT, fontSize: 11, fontWeight: "900", letterSpacing: 2, marginBottom: 6 },
  sabotageText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  storyPreview: { backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 14, padding: 16, marginBottom: 16 },
  storyPreviewLabel: { color: "#555", fontSize: 11, fontWeight: "900", letterSpacing: 1, marginBottom: 8 },
  storyPreviewText: { color: "#aaa", fontSize: 14, lineHeight: 22, fontStyle: "italic" },

  input: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.3)",
    borderRadius: 14,
    padding: 16,
    color: "#fff",
    fontSize: 16,
    minHeight: 90,
    marginBottom: 16,
    textAlignVertical: "top",
  },

  actionBtn: { borderRadius: 14, overflow: "hidden" },
  actionBtnDisabled: { opacity: 0.45 },
  actionBtnInner: { padding: 18, alignItems: "center" },
  actionBtnText: { color: "#fff", fontSize: 16, fontWeight: "900" },

  scrollContent: { alignItems: "center", paddingHorizontal: 24, paddingVertical: 40 },
  storyEmoji: { fontSize: 64, textAlign: "center", marginBottom: 12 },
  storyBox: { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 18, padding: 20, width: "100%", marginBottom: 28 },
  sabotageInline: { backgroundColor: "rgba(251,191,36,0.12)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 4, marginTop: 8, alignSelf: "flex-start" },
  sabotageInlineText: { color: ACCENT, fontSize: 11, fontWeight: "700" },
  storySentence: { color: "#ddd", fontSize: 15, lineHeight: 24, marginBottom: 4 },
  storyPlayerTag: { color: ACCENT, fontWeight: "900", fontSize: 12 },
});
