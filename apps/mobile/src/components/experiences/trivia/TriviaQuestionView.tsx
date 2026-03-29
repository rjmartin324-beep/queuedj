import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  Dimensions, Easing,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

const { width: SW } = Dimensions.get("window");

// ─── Answer card themes ───────────────────────────────────────────────────────
const THEMES = [
  { grad: ["#4f46e5", "#6d28d9"] as [string,string], accent: "#818cf8" },
  { grad: ["#0891b2", "#0e7490"] as [string,string], accent: "#22d3ee" },
  { grad: ["#db2777", "#be185d"] as [string,string], accent: "#f472b6" },
  { grad: ["#059669", "#047857"] as [string,string], accent: "#34d399" },
];
const CORRECT_GRAD: [string,string] = ["#16a34a", "#15803d"];
const WRONG_GRAD:   [string,string] = ["#dc2626", "#b91c1c"];

// ─── Category config ──────────────────────────────────────────────────────────
const CAT_CFG: Record<string, { grad: [string,string]; emojis: string[] }> = {
  music:         { grad: ["#4c1d95", "#7c3aed"], emojis: ["🎵","🎸","🎤","🎶"] },
  "pop culture": { grad: ["#9d174d", "#db2777"], emojis: ["⭐","🎬","🎭","📺"] },
  food:          { grad: ["#92400e", "#d97706"], emojis: ["🍕","🍔","🌮","🍣"] },
  science:       { grad: ["#1e3a8a", "#2563eb"], emojis: ["⚛️","🔭","🧬","🚀"] },
  geography:     { grad: ["#064e3b", "#059669"], emojis: ["🌍","🗺️","🏔️","🌊"] },
  history:       { grad: ["#78350f", "#b45309"], emojis: ["🏛️","⚔️","📜","🏰"] },
  sports:        { grad: ["#14532d", "#16a34a"], emojis: ["⚽","🏀","🏆","🎾"] },
  general:       { grad: ["#1e1b4b", "#4338ca"], emojis: ["🎯","🎮","🧩","💡"] },
};
const DEF_CFG = { grad: ["#0f0a2e","#1a0950"] as [string,string], emojis: ["🎮","✨","🎯","⚡"] };
function getCat(cat?: string) { return cat ? (CAT_CFG[cat.toLowerCase()] ?? DEF_CFG) : DEF_CFG; }

const REACTIONS = ["😱","🔥","💀","🎉","😂","😭","🤯","👏","💯","🎯"];
const LETTERS   = ["A","B","C","D"];
let _rid = 0;

interface FloatEmoji { id: number; emoji: string; x: number; ty: Animated.Value; op: Animated.Value }

// ─── Answer Card ──────────────────────────────────────────────────────────────
function AnswerCard({ option, index, onPress, isSelected, isCorrect, isWrong, showResult, disabled }: {
  option: { id: string; text: string };
  index: number; onPress: () => void;
  isSelected: boolean; isCorrect: boolean; isWrong: boolean;
  showResult: boolean; disabled: boolean;
}) {
  const flip    = useRef(new Animated.Value(0)).current;
  const scale   = useRef(new Animated.Value(1)).current;
  const shake   = useRef(new Animated.Value(0)).current;
  const flash   = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (showResult && !isCorrect && !isSelected) {
      Animated.timing(fadeOut, { toValue: 0.3, duration: 400, useNativeDriver: true }).start();
    } else if (!showResult) {
      fadeOut.setValue(1);
    }
  }, [showResult, isCorrect, isSelected]);

  useEffect(() => {
    flip.setValue(0);
    Animated.timing(flip, {
      toValue: 1, duration: 400, delay: index * 80,
      easing: Easing.out(Easing.back(1.1)), useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (!isWrong) return;
    Animated.sequence(
      [14,-14,10,-10,6,-6,2,0].map(v =>
        Animated.timing(shake, { toValue: v, duration: 44, useNativeDriver: true })
      )
    ).start();
  }, [isWrong]);

  useEffect(() => {
    if (!isCorrect) return;
    Animated.sequence([
      Animated.timing(flash, { toValue: 0.7, duration: 90,  useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0,   duration: 90,  useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0.7, duration: 90,  useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0.3, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [isCorrect]);

  const rotY  = flip.interpolate({ inputRange: [0,1], outputRange: ["90deg","0deg"] });
  const theme = THEMES[index % 4];
  const grad: [string,string] = isCorrect ? CORRECT_GRAD : isWrong ? WRONG_GRAD : theme.grad;

  const borderColor = isCorrect ? "#4ade80"
                    : isWrong   ? "#f87171"
                    : isSelected && !showResult ? theme.accent
                    : "rgba(255,255,255,0.08)";

  return (
    <Animated.View style={[styles.cardWrap, {
      transform: [{ perspective: 1200 }, { rotateY: rotY }, { translateX: shake }, { scale }],
      opacity: fadeOut,
    }]}>
      <TouchableOpacity
        onPress={onPress} disabled={disabled} activeOpacity={1}
        onPressIn ={() => Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 80 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 80 }).start()}
        style={{ flex: 1 }}
      >
        <LinearGradient colors={grad} style={[styles.card, { borderColor }]}>
          {/* Flash overlay */}
          <Animated.View style={[StyleSheet.absoluteFill, {
            borderRadius: 20, backgroundColor: "#fff", opacity: isCorrect ? flash : 0,
          }]} pointerEvents="none" />

          {/* Selected shimmer */}
          {isSelected && !showResult && (
            <View style={[StyleSheet.absoluteFill, {
              borderRadius: 20, backgroundColor: "rgba(255,255,255,0.08)",
            }]} pointerEvents="none" />
          )}

          {/* Letter badge */}
          <View style={[styles.badge, { backgroundColor: "rgba(255,255,255,0.18)" }]}>
            <Text style={styles.badgeText}>{LETTERS[index]}</Text>
          </View>

          <Text style={styles.cardText} numberOfLines={3}>{option.text}</Text>

          {isCorrect && <Text style={styles.mark}>✓</Text>}
          {isWrong   && <Text style={styles.mark}>✗</Text>}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function TriviaQuestionView({ showResult = false }: { showResult?: boolean }) {
  const { state, sendAction } = useRoom();

  const rawData = state.guestViewData as any;

  // Stabilize question reference — server sends guestViewData every tick (timeLeft updates).
  // Without memoization, the component re-renders each second causing the text to flicker.
  const questionRaw = showResult ? rawData?.currentQuestion : rawData;
  const question = useMemo(() => questionRaw, [questionRaw?.id, showResult]);

  const correctId = showResult ? rawData?.currentQuestion?.correctOptionId : null;
  const timeLimit = question?.timeLimitSeconds ?? 20;

  const exp   = state.experienceState as any;
  const score = (exp?.scores?.[state.guestId ?? ""] ?? 0) as number;
  const round = (exp?.roundNumber ?? 1) as number;
  const total = (exp?.totalRounds  ?? 10) as number;
  const streak = Math.max(0, round - 1);

  const [selected, setSelected] = useState<string | null>(null);
  const [floats,   setFloats]   = useState<FloatEmoji[]>([]);
  const timerAnim   = useRef(new Animated.Value(1)).current;
  const lockedAnim  = useRef(new Animated.Value(0)).current;
  const revealTimer = useRef(new Animated.Value(1)).current;

  // Score delta animation
  const prevScoreRef = useRef(score);
  const [scoreDelta, setScoreDelta] = useState(0);
  const deltaAnim = useRef(new Animated.Value(0)).current;
  const deltaOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (score !== prevScoreRef.current) {
      const delta = score - prevScoreRef.current;
      prevScoreRef.current = score;
      if (delta > 0) {
        setScoreDelta(delta);
        deltaAnim.setValue(-20);
        deltaOpacity.setValue(1);
        Animated.parallel([
          Animated.timing(deltaAnim, { toValue: -60, duration: 1200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.sequence([
            Animated.delay(600),
            Animated.timing(deltaOpacity, { toValue: 0, duration: 600, useNativeDriver: true }),
          ]),
        ]).start();
      }
    }
  }, [score]);

  useEffect(() => {
    if (showResult) { timerAnim.stopAnimation(); return; }
    timerAnim.setValue(1);
    Animated.timing(timerAnim, {
      toValue: 0, duration: timeLimit * 1000,
      easing: Easing.linear, useNativeDriver: false,
    }).start();
    return () => timerAnim.stopAnimation();
  }, [question?.id, showResult]);

  useEffect(() => {
    if (!showResult) { revealTimer.setValue(1); return; }
    revealTimer.setValue(1);
    Animated.timing(revealTimer, {
      toValue: 0, duration: 7000,
      easing: Easing.linear, useNativeDriver: false,
    }).start();
    return () => revealTimer.stopAnimation();
  }, [showResult, question?.id]);

  useEffect(() => { setSelected(null); }, [question?.id]);

  const timerWidth = timerAnim.interpolate({ inputRange: [0,1], outputRange: ["0%","100%"] });
  const timerColor = timerAnim.interpolate({
    inputRange: [0, 0.25, 0.55, 1],
    outputRange: ["#ef4444","#f97316","#eab308","#22c55e"],
  });

  function spawnFloat() {
    const emoji = REACTIONS[Math.floor(Math.random() * REACTIONS.length)];
    const id = ++_rid;
    const ty = new Animated.Value(0);
    const op = new Animated.Value(1);
    const x  = 24 + Math.random() * (SW - 80);
    setFloats(p => [...p, { id, emoji, x, ty, op }]);
    Animated.parallel([
      Animated.timing(ty, { toValue: -300, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(900),
        Animated.timing(op, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    ]).start(() => setFloats(p => p.filter(r => r.id !== id)));
  }

  function submitAnswer(optionId: string) {
    if (selected || showResult) return;
    setSelected(optionId);
    sendAction("submit_answer", { optionId });
    Animated.timing(lockedAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    const burst = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < burst; i++) setTimeout(spawnFloat, i * 180);
  }

  const cat  = getCat(question?.category);
  const opts = (question?.options ?? []) as { id: string; text: string }[];

  if (!question) {
    return (
      <LinearGradient colors={["#0c0620","#1a0840","#0c0620"]} style={styles.loader}>
        <Text style={styles.loaderEmoji}>🎯</Text>
        <Text style={styles.loaderText}>Loading question…</Text>
      </LinearGradient>
    );
  }

  return (
    <View style={styles.root}>

      {/* ── TOP BAR ──────────────────────────────────────────────── */}
      <LinearGradient colors={["#0d0820","#0d0820"]} style={styles.topBar}>
        {/* Score */}
        <View>
          <LinearGradient colors={["rgba(99,102,241,0.3)","rgba(139,92,246,0.2)"]} style={styles.chip}>
            <Text style={styles.chipEmoji}>⭐</Text>
            <Text style={styles.chipVal}>{score.toLocaleString()}</Text>
          </LinearGradient>
          {scoreDelta > 0 && (
            <Animated.Text style={[styles.scoreDelta, { transform: [{ translateY: deltaAnim }], opacity: deltaOpacity }]}>
              +{scoreDelta}
            </Animated.Text>
          )}
        </View>

        {/* Round */}
        <View style={styles.roundBadge}>
          <Text style={styles.roundLabel}>{showResult ? "REVEALED" : "ROUND"}</Text>
          <Text style={styles.roundVal}>{showResult ? "✓" : `${round} / ${total}`}</Text>
        </View>

        {/* Streak */}
        <LinearGradient colors={["rgba(249,115,22,0.3)","rgba(234,88,12,0.2)"]} style={styles.chip}>
          <Text style={styles.chipEmoji}>🔥</Text>
          <Text style={[styles.chipVal, { color: "#fb923c" }]}>{streak}x</Text>
        </LinearGradient>
      </LinearGradient>

      {/* ── TIMER BAR ─────────────────────────────────────────────── */}
      <View style={styles.timerTrack}>
        <View style={styles.timerBg} />
        {showResult ? (
          <Animated.View style={[styles.timerFill, {
            width: revealTimer.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
            backgroundColor: "#22c55e",
          }]} />
        ) : (
          <Animated.View style={[styles.timerFill, { width: timerWidth, backgroundColor: timerColor }]} />
        )}
      </View>

      {/* ── QUESTION AREA ──────────────────────────────────────────── */}
      <View style={styles.questionArea}>
        <LinearGradient colors={cat.grad} start={{ x:0.1, y:0 }} end={{ x:0.9, y:1 }} style={StyleSheet.absoluteFill} />

        {/* Decorative bg emojis */}
        {cat.emojis.map((e, i) => (
          <Text key={i} style={[styles.bgEmoji, {
            top: `${[8,42,58,16][i]}%`, left: `${[6,56,18,70][i]}%`,
            transform: [{ rotate: `${[-18,22,-10,30][i]}deg` }],
          }]}>{e}</Text>
        ))}

        <LinearGradient
          colors={["rgba(0,0,0,0.0)","rgba(0,0,0,0.85)"]}
          start={{ x:0, y:0 }} end={{ x:0, y:1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Category pill */}
        {!!question.category && (
          <View style={styles.catPill}>
            <Text style={styles.catPillText}>{question.category.toUpperCase()}</Text>
          </View>
        )}

        <Text style={styles.questionTxt}>{question.text}</Text>
      </View>

      {/* ── ANSWER GRID ────────────────────────────────────────────── */}
      <View style={styles.answers}>
        <View style={styles.row}>
          {opts.slice(0,2).map((opt, i) => (
            <AnswerCard
              key={`${question.id}-${opt.id}`}
              option={opt} index={i}
              onPress={() => submitAnswer(opt.id)}
              isSelected={selected === opt.id}
              isCorrect={showResult && opt.id === correctId}
              isWrong={showResult && opt.id === selected && selected !== correctId}
              showResult={showResult}
              disabled={!!selected || showResult}
            />
          ))}
        </View>
        <View style={styles.row}>
          {opts.slice(2,4).map((opt, i) => (
            <AnswerCard
              key={`${question.id}-${opt.id}`}
              option={opt} index={i+2}
              onPress={() => submitAnswer(opt.id)}
              isSelected={selected === opt.id}
              isCorrect={showResult && opt.id === correctId}
              isWrong={showResult && opt.id === selected && selected !== correctId}
              showResult={showResult}
              disabled={!!selected || showResult}
            />
          ))}
        </View>

        {/* Locked in banner */}
        {selected && !showResult && (
          <Animated.View style={[styles.lockedBanner, { opacity: lockedAnim }]}>
            <LinearGradient colors={["rgba(99,102,241,0.3)","rgba(139,92,246,0.2)"]} style={styles.lockedInner}>
              <Text style={styles.lockedEmoji}>⏳</Text>
              <Text style={styles.lockedText}>Locked in — waiting for reveal</Text>
            </LinearGradient>
          </Animated.View>
        )}
      </View>

      {/* ── FLOATING REACTIONS ─────────────────────────────────────── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {floats.map(r => (
          <Animated.Text key={r.id} style={{
            position: "absolute", bottom: 90, left: r.x,
            fontSize: 34, transform: [{ translateY: r.ty }], opacity: r.op,
          }}>{r.emoji}</Animated.Text>
        ))}
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: "#08081a" },

  loader:    { flex: 1, justifyContent: "center", alignItems: "center" },
  loaderEmoji: { fontSize: 56, marginBottom: 16 },
  loaderText:  { color: "rgba(255,255,255,0.4)", fontSize: 15 },

  // Top bar
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
  },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 24, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  chipEmoji:  { fontSize: 15 },
  chipVal:    { color: "#fff", fontWeight: "900", fontSize: 16 },
  scoreDelta: { position: "absolute", top: 0, left: "50%", color: "#4ade80", fontWeight: "900", fontSize: 14, textAlign: "center" },

  roundBadge: { alignItems: "center" },
  roundLabel: { color: "rgba(255,255,255,0.35)", fontSize: 9, fontWeight: "800", letterSpacing: 2 },
  roundVal:   { color: "#fff", fontSize: 18, fontWeight: "900" },

  // Timer
  timerTrack: { height: 6, backgroundColor: "#0d0820", position: "relative" },
  timerBg:    { ...StyleSheet.absoluteFillObject, backgroundColor: "#1a1040" },
  timerFill:  { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 3 },

  // Question
  questionArea: {
    flex: 5, justifyContent: "flex-end",
    padding: 20, paddingBottom: 24, overflow: "hidden",
  },
  bgEmoji: { position: "absolute", fontSize: 110, opacity: 0.10 },
  catPill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5,
    marginBottom: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  catPillText: { color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 2.5 },
  questionTxt: {
    color: "#fff", fontSize: 23, fontWeight: "900", lineHeight: 32,
    textShadowColor: "rgba(0,0,0,0.9)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 12,
  },

  // Answers
  answers: { flex: 7, padding: 12, paddingTop: 10, gap: 10 },
  row:     { flex: 1, flexDirection: "row", gap: 10 },
  cardWrap: { flex: 1 },
  card: {
    flex: 1, borderRadius: 20, padding: 14,
    flexDirection: "row", alignItems: "center", gap: 10,
    borderWidth: 1.5,
    shadowColor: "#000", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5, shadowRadius: 14,
  },
  badge: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: "center", alignItems: "center", flexShrink: 0,
  },
  badgeText: { color: "#fff", fontWeight: "900", fontSize: 13 },
  cardText:  { color: "#fff", fontSize: 16, fontWeight: "800", flex: 1, lineHeight: 22 },
  mark:      { fontSize: 24, color: "#fff", fontWeight: "900" },

  lockedBanner: { marginTop: 4 },
  lockedInner: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, borderRadius: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: "rgba(99,102,241,0.35)",
  },
  lockedEmoji: { fontSize: 16 },
  lockedText:  { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "700" },
});
