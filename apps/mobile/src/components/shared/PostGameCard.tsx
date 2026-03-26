import React, { useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, SafeAreaView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";

const { width: SW } = Dimensions.get("window");

interface Props {
  score: number;
  maxScore?: number;       // if provided, shows a grade
  gameEmoji: string;
  gameTitle: string;
  onPlayAgain: () => void;
  extraContent?: React.ReactNode; // optional extra stats below score
}

const CONFETTI = ["🎉","✨","🔥","🎊","⭐","💜","🎮","🏆"];

function ConfettiPiece({ emoji, delay, x }: { emoji: string; delay: number; x: number }) {
  const ty = useRef(new Animated.Value(-60)).current;
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(ty, { toValue: 180, duration: 1400, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(op, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.timing(op, { toValue: 1, duration: 900, useNativeDriver: true }),
          Animated.timing(op, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
      ]),
    ]).start();
  }, []);
  return (
    <Animated.Text pointerEvents="none"
      style={{ position: "absolute", top: 0, left: x, fontSize: 24, opacity: op, transform: [{ translateY: ty }] }}>
      {emoji}
    </Animated.Text>
  );
}

function getGrade(score: number, maxScore: number): { grade: string; color: string; label: string } {
  const pct = score / maxScore;
  if (pct >= 0.9) return { grade: "S", color: "#fbbf24", label: "Legendary!" };
  if (pct >= 0.7) return { grade: "A", color: "#4ade80", label: "Impressive!" };
  if (pct >= 0.5) return { grade: "B", color: "#60a5fa", label: "Solid!" };
  if (pct >= 0.3) return { grade: "C", color: "#a78bfa", label: "Getting there!" };
  return { grade: "D", color: "#f87171", label: "Keep practicing!" };
}

function getCredits(score: number): number {
  return Math.min(100, Math.max(5, Math.floor(score / 10)));
}

export function PostGameCard({ score, maxScore, gameEmoji, gameTitle, onPlayAgain, extraContent }: Props) {
  const router = useRouter();
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const opAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 120 }),
      Animated.timing(opAnim, { toValue: 1, useNativeDriver: true, duration: 300 }),
    ]).start();
  }, []);

  const grade = maxScore ? getGrade(score, maxScore) : null;
  const credits = getCredits(score);

  return (
    <LinearGradient colors={["#08081a", "#12003a", "#08081a"]} style={styles.root}>
      <SafeAreaView style={styles.safe}>
        {/* Confetti burst */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {CONFETTI.map((e, i) => (
            <ConfettiPiece key={i} emoji={e} delay={i * 120} x={20 + (i * (SW - 40) / (CONFETTI.length - 1))} />
          ))}
        </View>

        <Animated.View style={[styles.content, { opacity: opAnim, transform: [{ scale: scaleAnim }] }]}>

          {/* Game identity */}
          <Text style={styles.gameEmoji}>{gameEmoji}</Text>
          <Text style={styles.gameTitle}>{gameTitle}</Text>
          <Text style={styles.finishedLabel}>FINISHED!</Text>

          {/* Score */}
          <View style={styles.scoreWrap}>
            <Text style={styles.scoreBig}>{score.toLocaleString()}</Text>
            <Text style={styles.scoreLabel}>POINTS</Text>
          </View>

          {/* Grade badge */}
          {grade && (
            <View style={[styles.gradeBadge, { borderColor: grade.color + "66", backgroundColor: grade.color + "18" }]}>
              <Text style={[styles.gradeText, { color: grade.color }]}>{grade.grade}</Text>
              <Text style={[styles.gradeSub, { color: grade.color }]}>{grade.label}</Text>
            </View>
          )}

          {/* Extra content slot */}
          {extraContent}

          {/* Vibe Credits */}
          <View style={styles.creditsRow}>
            <LinearGradient colors={["#7c3aed22", "#b5179e22"]} style={styles.creditsPill}>
              <Text style={styles.creditsEmoji}>⚡</Text>
              <Text style={styles.creditsText}>+{credits} Vibe Credits earned</Text>
            </LinearGradient>
          </View>

          {/* Actions */}
          <TouchableOpacity style={styles.playAgainBtn} onPress={onPlayAgain} activeOpacity={0.85}>
            <LinearGradient colors={["#f0abfc", "#c026d3", "#7c3aed"]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={styles.playAgainInner}>
              <Text style={styles.playAgainText}>PLAY AGAIN</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.browseBtn} onPress={() => router.push("/games" as any)} activeOpacity={0.8}>
            <Text style={styles.browseBtnText}>Browse All Games →</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.homeBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.homeBtnText}>← Home</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1 },
  safe:         { flex: 1 },
  content:      { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, gap: 12 },
  gameEmoji:    { fontSize: 64 },
  gameTitle:    { color: "#fff", fontSize: 22, fontWeight: "900", letterSpacing: -0.3 },
  finishedLabel:{ color: "#a78bfa", fontSize: 11, fontWeight: "800", letterSpacing: 3 },
  scoreWrap:    { alignItems: "center", marginVertical: 4 },
  scoreBig:     { color: "#fff", fontSize: 72, fontWeight: "900", letterSpacing: -2, lineHeight: 76 },
  scoreLabel:   { color: "#6b7fa0", fontSize: 13, fontWeight: "700", letterSpacing: 2, marginTop: -4 },
  gradeBadge:   { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 20, borderWidth: 1, paddingHorizontal: 20, paddingVertical: 10 },
  gradeText:    { fontSize: 28, fontWeight: "900" },
  gradeSub:     { fontSize: 15, fontWeight: "700" },
  creditsRow:   { width: "100%" },
  creditsPill:  { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 18, borderWidth: 1, borderColor: "rgba(167,139,250,0.25)" },
  creditsEmoji: { fontSize: 18 },
  creditsText:  { color: "#a78bfa", fontSize: 14, fontWeight: "700" },
  playAgainBtn: { width: "100%", borderRadius: 18, overflow: "hidden" },
  playAgainInner:{ paddingVertical: 18, alignItems: "center", borderRadius: 18 },
  playAgainText: { color: "#fff", fontSize: 17, fontWeight: "900", letterSpacing: 0.3 },
  browseBtn:    { paddingVertical: 10 },
  browseBtnText:{ color: "#a78bfa", fontSize: 15, fontWeight: "700" },
  homeBtn:      { paddingVertical: 8 },
  homeBtnText:  { color: "#4a5568", fontSize: 14, fontWeight: "600" },
});
