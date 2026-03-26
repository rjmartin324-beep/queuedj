import React, { useState } from "react";
import {
  View, Text, StyleSheet, SafeAreaView,
  TouchableOpacity, Dimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─────────────────────────────────────────────────────────────────────────────
// HostOnboardingScreen
//
// 5-step first-time walkthrough for new DJs. Shown once per device, gated by
// an AsyncStorage flag ("host_onboarding_done"). After completion the parent
// navigation replaces with the actual HostScreen.
// ─────────────────────────────────────────────────────────────────────────────

const ONBOARDING_KEY = "host_onboarding_done";
const { width } = Dimensions.get("window");

interface Step {
  emoji: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    emoji: "🎛️",
    title: "Welcome, DJ",
    body: "You're in the hot seat. PartyGlue turns your phone into a full party controller — music, crowd games, and real-time vibes all in one place.",
  },
  {
    emoji: "🎵",
    title: "Load a Track",
    body: "Tap the DJ tab and hit the track card to load a song on Deck A or Deck B. Use the crossfader to blend between decks. Your crowd sees what's playing in real time.",
  },
  {
    emoji: "🌊",
    title: "Set the Vibe Guardrail",
    body: "Each track gets a vibe score. Use the Vibe settings to lock the energy range — PartyGlue will warn you before a track kills the mood.",
  },
  {
    emoji: "🙌",
    title: "Read the Crowd",
    body: "The Crowd State bar shows the room energy live. Tap Fire, Chill, or Hype to manually set the vibe — or let guests react and watch the score shift.",
  },
  {
    emoji: "🎮",
    title: "Mix in Games",
    body: "Switch experiences anytime from the top row. Trivia, Drawback, Scavenger Snap — keep the energy up between sets. Guests join automatically.",
  },
];

interface Props {
  onDone: () => void;
}

export default function HostOnboardingScreen({ onDone }: Props) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  async function advance() {
    if (isLast) {
      await AsyncStorage.setItem(ONBOARDING_KEY, "1");
      onDone();
    } else {
      setStep((s) => s + 1);
    }
  }

  async function skip() {
    await AsyncStorage.setItem(ONBOARDING_KEY, "1");
    onDone();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Skip */}
        <TouchableOpacity style={styles.skipBtn} onPress={skip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>

        {/* Step dots */}
        <View style={styles.dots}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
          ))}
        </View>

        {/* Content */}
        <View style={styles.card}>
          <Text style={styles.emoji}>{current.emoji}</Text>
          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.body}>{current.body}</Text>
        </View>

        {/* CTA */}
        <TouchableOpacity style={styles.cta} onPress={advance}>
          <Text style={styles.ctaText}>{isLast ? "Let's Go" : "Next"}</Text>
        </TouchableOpacity>

        <Text style={styles.stepCounter}>{step + 1} / {STEPS.length}</Text>
      </View>
    </SafeAreaView>
  );
}

/** Call this before navigating to HostScreen to decide if onboarding is needed. */
export async function shouldShowHostOnboarding(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(ONBOARDING_KEY);
    return val !== "1";
  } catch {
    return false;
  }
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  skipBtn: {
    position: "absolute",
    top: 16,
    right: 20,
    padding: 8,
  },
  skipText: {
    color: "#666",
    fontSize: 14,
  },
  dots: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 40,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#333",
  },
  dotActive: {
    backgroundColor: "#8b5cf6",
    width: 24,
  },
  card: {
    width: "100%",
    backgroundColor: "#141414",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    marginBottom: 40,
    borderWidth: 1,
    borderColor: "#222",
  },
  emoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    marginBottom: 14,
  },
  body: {
    fontSize: 16,
    color: "#aaa",
    textAlign: "center",
    lineHeight: 24,
  },
  cta: {
    backgroundColor: "#8b5cf6",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 48,
    width: "100%",
    alignItems: "center",
    marginBottom: 16,
  },
  ctaText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  stepCounter: {
    color: "#555",
    fontSize: 13,
  },
});
