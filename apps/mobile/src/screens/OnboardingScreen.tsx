import React, { useRef, useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Animated, Dimensions, Platform, KeyboardAvoidingView, SafeAreaView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";

export const ONBOARDED_KEY  = "queuedj_onboarded";
export const GUEST_NAME_KEY = "guest_display_name";

const { width: SW, height: SH } = Dimensions.get("window");

// ─── Random name generator ────────────────────────────────────────────────────
const ADJECTIVES = ["Funky","Electric","Cosmic","Wild","Smooth","Hyped","Neon","Blazing","Groovy","Stellar","Savage","Turbo","Legendary","Spicy","Chaotic"];
const NOUNS      = ["Panda","Llama","Gecko","Falcon","Otter","Walrus","Cobra","Shark","Phoenix","Mango","Wizard","Goblin","Viking","Ninja","Dragon"];
function randomName() {
  return `${ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]} ${NOUNS[Math.floor(Math.random() * NOUNS.length)]}`;
}

// ─── Tutorial steps ───────────────────────────────────────────────────────────
const STEPS = [
  {
    emoji: "🎉",
    gradient: ["#2a0060", "#1a0040"] as [string,string],
    accent: "#a78bfa",
    title: "Host or Join Any Party",
    body: "Start a room and share the code. Friends join on their own phones in seconds. No accounts needed.",
  },
  {
    emoji: "🎵",
    gradient: ["#001a30", "#000d18"] as [string,string],
    accent: "#22d3ee",
    title: "Control the Music",
    body: "Request tracks, vote up your favorites, and shape the vibe. The crowd decides what plays next.",
  },
  {
    emoji: "🎮",
    gradient: ["#1a0020", "#0d0010"] as [string,string],
    accent: "#f0abfc",
    title: "40+ Party Games",
    body: "Trivia, Truth or Dare, Never Have I Ever, Draw It, and 36 more. Switch games without leaving the room.",
  },
  {
    emoji: "⚡",
    gradient: ["#1a0a00", "#0d0500"] as [string,string],
    accent: "#fb923c",
    title: "Earn Vibe Credits",
    body: "Win games, vote, make good requests. Credits unlock avatar outfits and emotes.",
  },
];

// ─── Floating particle ────────────────────────────────────────────────────────
const PARTICLES = ["🎵","🎉","⚡","🎮","🔥","✨","🎤","🎲"];
function FloatingParticle({ emoji, x, delay }: { emoji: string; x: number; delay: number }) {
  const ty  = useRef(new Animated.Value(SH * 0.6)).current;
  const op  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    function loop() {
      ty.setValue(SH * 0.7);
      op.setValue(0);
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(ty, { toValue: SH * 0.05, duration: 6000 + delay % 3000, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(op, { toValue: 0.45, duration: 800,  useNativeDriver: true }),
            Animated.timing(op, { toValue: 0.45, duration: 4000, useNativeDriver: true }),
            Animated.timing(op, { toValue: 0,    duration: 800,  useNativeDriver: true }),
          ]),
        ]),
      ]).start(loop);
    }
    loop();
  }, []);

  return (
    <Animated.Text pointerEvents="none" style={{
      position: "absolute", left: x, fontSize: 20,
      transform: [{ translateY: ty }], opacity: op,
    }}>
      {emoji}
    </Animated.Text>
  );
}

// ─── Step card ────────────────────────────────────────────────────────────────
function StepCard({ step }: { step: typeof STEPS[0] }) {
  const scale = useRef(new Animated.Value(0.9)).current;
  const op    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1,   useNativeDriver: true, damping: 16, stiffness: 140 }),
      Animated.timing(op,    { toValue: 1,   useNativeDriver: true, duration: 280 }),
    ]).start();
    return () => { scale.stopAnimation(); op.stopAnimation(); };
  }, []);

  return (
    <Animated.View style={[styles.stepCard, { transform: [{ scale }], opacity: op }]}>
      <LinearGradient colors={step.gradient} style={StyleSheet.absoluteFill} />
      <View style={[styles.stepCardBorder, { borderColor: step.accent + "44" }]} />
      <View style={[styles.stepIconWrap, { backgroundColor: step.accent + "22", borderColor: step.accent + "44" }]}>
        <Text style={styles.stepEmoji}>{step.emoji}</Text>
      </View>
      <Text style={[styles.stepTitle, { color: "#fff" }]}>{step.title}</Text>
      <Text style={styles.stepBody}>{step.body}</Text>
    </Animated.View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface Props { onComplete: () => void }

export function OnboardingScreen({ onComplete }: Props) {
  const [phase, setPhase]     = useState<"welcome" | "name" | "tutorial">("welcome");
  const [name, setName]       = useState(randomName);
  const [step, setStep]       = useState(0);
  const [stepKey, setStepKey] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  function fadeTransition(to: typeof phase) {
    Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      setPhase(to);
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    });
  }

  async function confirmName() {
    const trimmed = name.trim() || randomName();
    await AsyncStorage.setItem(GUEST_NAME_KEY, trimmed);
    fadeTransition("tutorial");
  }

  function nextStep() {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      setStepKey(k => k + 1);
    } else {
      finish();
    }
  }

  function prevStep() {
    if (step > 0) {
      setStep(step - 1);
      setStepKey(k => k + 1);
    }
  }

  async function finish() {
    await AsyncStorage.setItem(ONBOARDED_KEY, "1");
    onComplete();
  }

  // ── Welcome ─────────────────────────────────────────────────────────────────
  if (phase === "welcome") {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={["#03001c", "#07001a", "#12003a"]} style={StyleSheet.absoluteFill} />

        {/* Floating particles */}
        {PARTICLES.map((e, i) => (
          <FloatingParticle key={i} emoji={e} x={20 + (i * (SW - 40) / (PARTICLES.length - 1))} delay={i * 600} />
        ))}

        {/* Bottom pool glow */}
        <LinearGradient
          colors={["transparent", "rgba(181,23,158,0.15)", "rgba(114,9,183,0.35)"]}
          style={[StyleSheet.absoluteFill, { top: "60%" }]}
          pointerEvents="none"
        />

        <Animated.View style={[styles.welcomeContent, { opacity: fadeAnim }]}>
          {/* Logo */}
          <View style={styles.logoWrap}>
            <LinearGradient colors={["#2a0060", "#1a0040"]} style={styles.logoGlow} />
            <Text style={styles.logoEmoji}>🎉</Text>
          </View>

          <Text style={styles.wordmark}>
            <Text style={{ color: "#ffffff" }}>Party</Text>
            <Text style={{ color: "#a78bfa" }}>Glue</Text>
          </Text>
          <Text style={styles.tagline}>The glue that holds the party together</Text>

          {/* CTA */}
          <TouchableOpacity onPress={() => fadeTransition("name")} activeOpacity={0.85} style={styles.ctaWrap}>
            <LinearGradient
              colors={["#f0abfc", "#c026d3", "#7c3aed"]}
              start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
              style={styles.ctaBtn}
            >
              <Text style={styles.ctaBtnText}>Get Started</Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.noAccount}>No account needed · Free to join</Text>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // ── Name Entry ───────────────────────────────────────────────────────────────
  if (phase === "name") {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={["#03001c", "#07001a", "#12003a"]} style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={["transparent", "rgba(181,23,158,0.12)", "rgba(114,9,183,0.28)"]}
          style={[StyleSheet.absoluteFill, { top: "55%" }]}
          pointerEvents="none"
        />

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <Animated.View style={[styles.nameContent, { opacity: fadeAnim }]}>

            <Text style={styles.nameEmoji}>👋</Text>
            <Text style={styles.nameTitle}>What should we{"\n"}call you?</Text>
            <Text style={styles.nameSub}>Shows up in games and the queue. You can change it later.</Text>

            <View style={styles.nameInputRow}>
              <TextInput
                style={styles.nameInput}
                value={name}
                onChangeText={setName}
                placeholder="Your party name"
                placeholderTextColor="#4a5568"
                maxLength={24}
                autoFocus
                onSubmitEditing={confirmName}
                returnKeyType="done"
                selectionColor="#a78bfa"
              />
              <TouchableOpacity style={styles.diceBtn} onPress={() => setName(randomName())}>
                <Text style={{ fontSize: 22 }}>🎲</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={confirmName}
              disabled={!name.trim()}
              activeOpacity={0.85}
              style={[styles.ctaWrap, !name.trim() && { opacity: 0.35 }]}
            >
              <LinearGradient
                colors={["#f0abfc", "#c026d3", "#7c3aed"]}
                start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
                style={styles.ctaBtn}
              >
                <Text style={styles.ctaBtnText}>Continue →</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Tutorial ─────────────────────────────────────────────────────────────────
  const current = STEPS[step];
  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={["#03001c", "#07001a", "#0f0028"]} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={["transparent", current.accent + "18", current.accent + "08"]}
        style={[StyleSheet.absoluteFill, { top: "40%" }]}
        pointerEvents="none"
      />

      {/* Skip */}
      <TouchableOpacity style={styles.skipBtn} onPress={finish}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <Animated.View style={[styles.tutContent, { opacity: fadeAnim }]}>
        {/* Progress dots */}
        <View style={styles.dots}>
          {STEPS.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => { setStep(i); setStepKey(k => k + 1); }}>
              <Animated.View style={[
                styles.dot,
                i === step && { backgroundColor: current.accent, width: 24 },
                i < step  && { backgroundColor: current.accent + "60" },
              ]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Step card */}
        <StepCard key={stepKey} step={current} />

        {/* Step counter */}
        <Text style={styles.stepCounter}>{step + 1} of {STEPS.length}</Text>

        {/* Buttons */}
        <TouchableOpacity onPress={nextStep} activeOpacity={0.85} style={styles.ctaWrap}>
          <LinearGradient
            colors={["#f0abfc", "#c026d3", "#7c3aed"]}
            start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
            style={styles.ctaBtn}
          >
            <Text style={styles.ctaBtnText}>
              {step < STEPS.length - 1 ? "Next →" : "Let's Party! 🎉"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {step > 0 && (
          <TouchableOpacity style={styles.backBtn} onPress={prevStep}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#03001c" },

  // Welcome
  welcomeContent: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 32, paddingBottom: 40,
  },
  logoWrap: {
    width: 100, height: 100, borderRadius: 28, overflow: "hidden",
    alignItems: "center", justifyContent: "center",
    marginBottom: 24,
    borderWidth: 1, borderColor: "rgba(167,139,250,0.3)",
  },
  logoGlow:  { ...StyleSheet.absoluteFillObject },
  logoEmoji: { fontSize: 52 },
  wordmark:  { fontSize: 42, fontWeight: "900", letterSpacing: -1, marginBottom: 10 },
  tagline:   { color: "#6b7fa0", fontSize: 15, textAlign: "center", fontWeight: "500", marginBottom: 48, lineHeight: 22 },
  noAccount: { color: "#4a5568", fontSize: 12, fontWeight: "600", marginTop: 16, letterSpacing: 0.3 },

  // CTA button (shared)
  ctaWrap: { width: "100%", borderRadius: 18, overflow: "hidden" },
  ctaBtn:  { paddingVertical: 18, alignItems: "center", borderRadius: 18 },
  ctaBtnText: { color: "#fff", fontSize: 17, fontWeight: "900", letterSpacing: 0.2 },

  // Name
  nameContent: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 28, gap: 0,
  },
  nameEmoji: { fontSize: 52, marginBottom: 16 },
  nameTitle: { color: "#fff", fontSize: 28, fontWeight: "900", textAlign: "center", marginBottom: 10, letterSpacing: -0.3 },
  nameSub:   { color: "#6b7fa0", fontSize: 14, textAlign: "center", marginBottom: 32, lineHeight: 20 },
  nameInputRow: { flexDirection: "row", gap: 10, alignItems: "center", width: "100%", marginBottom: 24 },
  nameInput: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 16, padding: 18,
    color: "#fff", fontSize: 18, fontWeight: "600",
    borderWidth: 1, borderColor: "rgba(167,139,250,0.25)",
  },
  diceBtn: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },

  // Tutorial
  tutContent: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 24, paddingBottom: 24,
  },
  dots: { flexDirection: "row", gap: 8, marginBottom: 28 },
  dot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.15)" },

  stepCard: {
    width: SW - 48, borderRadius: 24, padding: 28,
    alignItems: "center", overflow: "hidden", marginBottom: 20,
    borderWidth: 1,
    minHeight: 240,
    justifyContent: "center",
  },
  stepCardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24, borderWidth: 1,
  },
  stepIconWrap: {
    width: 72, height: 72, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, marginBottom: 16,
  },
  stepEmoji: { fontSize: 36 },
  stepTitle: { fontSize: 22, fontWeight: "900", textAlign: "center", marginBottom: 10, letterSpacing: -0.2 },
  stepBody:  { color: "#9ca3af", fontSize: 15, textAlign: "center", lineHeight: 22 },

  stepCounter: { color: "#4a5568", fontSize: 12, fontWeight: "700", marginBottom: 20 },

  backBtn:  { marginTop: 12 },
  backText: { color: "#6b7fa0", fontSize: 14, fontWeight: "600" },
  skipBtn:  { position: "absolute", top: Platform.OS === "ios" ? 54 : 20, right: 20, zIndex: 10 },
  skipText: { color: "#4a5568", fontSize: 14, fontWeight: "600" },
});
