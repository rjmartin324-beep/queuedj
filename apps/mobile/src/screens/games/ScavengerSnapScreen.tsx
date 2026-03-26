import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  Image, ScrollView, Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { PostGameCard } from "../../components/shared/PostGameCard";

const ACCENT = "#10b981";
const TOTAL_CHALLENGES = 5;

const ALL_CHALLENGES = [
  "Something red",
  "Something older than you",
  "The tallest thing in the room",
  "Something that makes you happy",
  "Your left shoe",
  "Something with a pattern",
  "The weirdest thing nearby",
  "Something round",
  "A reflection of yourself",
  "Something green",
  "The most colourful thing you can find",
  "Something you never usually photograph",
  "Something that represents your mood right now",
  "The best view from where you are",
  "Something broken or messy",
  "Something that smells amazing",
  "A perfect shadow",
  "Something you're grateful for",
  "The most interesting texture nearby",
  "Something yellow",
];

function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

type Phase = "welcome" | "playing" | "results";

export default function ScavengerSnapScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("welcome");
  const [challenges, setChallenges] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  function startGame() {
    setChallenges(pickRandom(ALL_CHALLENGES, TOTAL_CHALLENGES));
    setCurrentIndex(0);
    setPhotos([]);
    setPendingPhoto(null);
    setPermissionDenied(false);
    setPhase("playing");
  }

  async function snapPhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      setPermissionDenied(true);
      Alert.alert(
        "Camera Access Needed",
        "Please allow camera access in your device settings to use Scavenger Snap.",
        [{ text: "OK" }]
      );
      return;
    }
    setPermissionDenied(false);
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.7,
    });
    if (!result.canceled && result.assets.length > 0) {
      setPendingPhoto(result.assets[0].uri);
    }
  }

  function submitAndNext() {
    if (!pendingPhoto) return;
    const newPhotos = [...photos, pendingPhoto];
    setPhotos(newPhotos);
    setPendingPhoto(null);
    const next = currentIndex + 1;
    if (next >= TOTAL_CHALLENGES) {
      setPhase("results");
    } else {
      setCurrentIndex(next);
    }
  }

  if (phase === "welcome") {
    return (
      <LinearGradient colors={["#001a0f", "#08081a"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <TouchableOpacity style={s.back} onPress={() => router.back()}>
            <Text style={s.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={s.center}>
            <Text style={s.emoji}>📸</Text>
            <Text style={s.title}>Scavenger Snap</Text>
            <Text style={s.sub}>Hunt down and photograph 5 challenges around you!</Text>
            <View style={s.rulesBox}>
              <Text style={s.ruleItem}>• 5 random photo challenges</Text>
              <Text style={s.ruleItem}>• Use your camera to snap each one</Text>
              <Text style={s.ruleItem}>• See your scrapbook at the end</Text>
              <Text style={s.ruleItem}>• Camera access required</Text>
            </View>
            <TouchableOpacity style={s.startBtn} onPress={startGame}>
              <LinearGradient colors={["#065f46", ACCENT]} style={s.startBtnInner}>
                <Text style={s.startBtnText}>START HUNT</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (phase === "results") {
    return (
      <PostGameCard
        score={0}
        gameEmoji="📷"
        gameTitle="Scavenger Snap"
        onPlayAgain={startGame}
      />
    );
  }

  // Playing phase
  const challenge = challenges[currentIndex];
  const progress = (currentIndex / TOTAL_CHALLENGES) * 100;

  return (
    <LinearGradient colors={["#001a0f", "#08081a"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        {/* Progress */}
        <View style={s.progressContainer}>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={s.progressLabel}>{currentIndex + 1} / {TOTAL_CHALLENGES}</Text>
        </View>

        <View style={s.center}>
          {/* Challenge */}
          <View style={s.challengeCard}>
            <Text style={s.challengeLabel}>FIND & PHOTOGRAPH</Text>
            <Text style={s.challengeText}>{challenge}</Text>
          </View>

          {/* Camera denied notice */}
          {permissionDenied && (
            <View style={s.permissionCard}>
              <Text style={s.permissionIcon}>🚫</Text>
              <Text style={s.permissionText}>
                Camera access was denied. Go to your device settings to enable it.
              </Text>
            </View>
          )}

          {/* Pending photo preview */}
          {pendingPhoto ? (
            <View style={s.previewContainer}>
              <Image source={{ uri: pendingPhoto }} style={s.previewImage} />
              <View style={s.previewActions}>
                <TouchableOpacity style={s.retakeBtn} onPress={snapPhoto}>
                  <Text style={s.retakeBtnText}>📷 Retake</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.submitBtn} onPress={submitAndNext}>
                  <LinearGradient colors={["#065f46", ACCENT]} style={s.submitBtnInner}>
                    <Text style={s.submitBtnText}>
                      {currentIndex + 1 >= TOTAL_CHALLENGES ? "Finish! →" : "Submit & Next →"}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={s.snapBtn} onPress={snapPhoto} activeOpacity={0.8}>
              <LinearGradient colors={["#065f46", ACCENT]} style={s.snapBtnInner}>
                <Text style={s.snapBtnEmoji}>📸</Text>
                <Text style={s.snapBtnText}>SNAP IT</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Thumbnail strip of completed photos */}
          {photos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.thumbStrip}>
              {photos.map((uri, i) => (
                <Image key={i} source={{ uri }} style={s.thumb} />
              ))}
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  back: { padding: 16, paddingTop: 8 },
  backText: { color: ACCENT, fontSize: 16, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  emoji: { fontSize: 64, marginBottom: 16, textAlign: "center" },
  title: { color: "#fff", fontSize: 30, fontWeight: "900", marginBottom: 8, textAlign: "center" },
  sub: { color: "#888", fontSize: 14, textAlign: "center", marginBottom: 24 },
  rulesBox: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 16, width: "100%", marginBottom: 32 },
  ruleItem: { color: "#ccc", fontSize: 14, marginBottom: 6 },
  startBtn: { width: "100%", borderRadius: 14, overflow: "hidden", marginBottom: 12 },
  startBtnInner: { padding: 18, alignItems: "center" },
  startBtnText: { color: "#fff", fontSize: 17, fontWeight: "900", letterSpacing: 1 },
  homeBtn: { padding: 12, marginTop: 4 },
  homeBtnText: { color: "#666", fontSize: 15 },

  progressContainer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  progressTrack: { height: 6, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 3, marginBottom: 6 },
  progressFill: { height: 6, backgroundColor: ACCENT, borderRadius: 3 },
  progressLabel: { color: "#888", fontSize: 12, fontWeight: "700", textAlign: "right" },

  challengeCard: {
    backgroundColor: "rgba(16,185,129,0.08)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.25)",
    borderRadius: 24,
    padding: 28,
    width: "100%",
    alignItems: "center",
    marginBottom: 24,
  },
  challengeLabel: { color: ACCENT, fontSize: 11, fontWeight: "900", letterSpacing: 2, marginBottom: 14 },
  challengeText: { color: "#fff", fontSize: 24, fontWeight: "900", textAlign: "center", lineHeight: 32 },

  permissionCard: {
    backgroundColor: "rgba(248,113,113,0.1)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.3)",
    borderRadius: 16,
    padding: 16,
    width: "100%",
    alignItems: "center",
    marginBottom: 16,
  },
  permissionIcon: { fontSize: 28, marginBottom: 8 },
  permissionText: { color: "#f87171", fontSize: 13, textAlign: "center", lineHeight: 20 },

  snapBtn: { width: "100%", borderRadius: 20, overflow: "hidden" },
  snapBtnInner: { padding: 24, alignItems: "center" },
  snapBtnEmoji: { fontSize: 40, marginBottom: 8 },
  snapBtnText: { color: "#fff", fontSize: 20, fontWeight: "900", letterSpacing: 2 },

  previewContainer: { width: "100%", alignItems: "center", marginBottom: 16 },
  previewImage: { width: "100%", height: 220, borderRadius: 18, marginBottom: 14 },
  previewActions: { flexDirection: "row", gap: 12, width: "100%" },
  retakeBtn: { flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  retakeBtnText: { color: "#ccc", fontSize: 15, fontWeight: "700" },
  submitBtn: { flex: 2, borderRadius: 12, overflow: "hidden" },
  submitBtnInner: { padding: 14, alignItems: "center" },
  submitBtnText: { color: "#fff", fontSize: 15, fontWeight: "900" },

  thumbStrip: { marginTop: 16, maxHeight: 64 },
  thumb: { width: 56, height: 56, borderRadius: 10, marginRight: 8, borderWidth: 2, borderColor: "rgba(16,185,129,0.4)" },

  scrollContent: { alignItems: "center", paddingHorizontal: 20, paddingVertical: 32 },
  resultEmoji: { fontSize: 64, textAlign: "center", marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, width: "100%", marginBottom: 28, justifyContent: "center" },
  gridItem: { width: "47%", borderRadius: 14, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.04)" },
  gridImage: { width: "100%", height: 130 },
  gridLabel: { padding: 8 },
  gridLabelText: { color: "#aaa", fontSize: 12, fontWeight: "600", lineHeight: 17 },
});
