import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

// ─────────────────────────────────────────────────────────────────────────────
// MindMole — Guest View
// Role reveal → clue input → vote → reveal
// ─────────────────────────────────────────────────────────────────────────────

export function MindMoleView() {
  const { state, sendAction } = useRoom();
  const data = state.guestViewData as any ?? {};
  const myWord = state.experienceState?.myWord as string | undefined;
  const isMole = state.experienceState?.isMole as boolean | undefined;
  const moleHint = state.experienceState?.moleHint as string | undefined;

  const [clue, setClue] = useState("");
  const [clueLocked, setClueLocked] = useState(false);
  const [selectedVote, setSelectedVote] = useState<string | null>(null);
  const [voteLocked, setVoteLocked] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const pulseAnim = React.useRef(new Animated.Value(isMole ? 1 : 0)).current;

  const phase = data.phase ?? "waiting";
  const clues = data.clues as Record<string, string[]> ?? {};
  const clueNames = data.clueNames as Record<string, string> ?? {};

  useEffect(() => {
    if (phase === "cluing") {
      setClueLocked(false);
      setClue("");
    }
    if (phase === "voting") {
      setVoteLocked(false);
      setSelectedVote(null);
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== "cluing" || !data.cluePhaseStart) return;
    const interval = setInterval(() => {
      const elapsed = (Date.now() - data.cluePhaseStart) / 1000;
      setTimeLeft(Math.max(0, Math.ceil(30 - elapsed)));
    }, 500);
    return () => clearInterval(interval);
  }, [phase, data.cluePhaseStart]);

  useEffect(() => {
    if (isMole) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [isMole]);

  function submitClue() {
    if (!clue.trim() || clueLocked) return;
    setClueLocked(true);
    sendAction("submit_clue", { clue: clue.trim(), name: state.guestId });
  }

  function submitVote() {
    if (!selectedVote || voteLocked) return;
    setVoteLocked(true);
    sendAction("submit_vote", { targetGuestId: selectedVote });
  }

  // ── WAITING ────────────────────────────────────────────────────────────────
  if (phase === "waiting" && !myWord) {
    return (
      <LinearGradient colors={["#080810", "#131325"]} style={styles.center}>
        <Text style={{ fontSize: 56, marginBottom: 16 }}>🧠</Text>
        <Text style={styles.bigTitle}>MindMole</Text>
        <Text style={styles.subtitle}>Waiting for host to start…</Text>
      </LinearGradient>
    );
  }

  // ── ROLE REVEAL ────────────────────────────────────────────────────────────
  if (myWord && (phase === "waiting" || phase === "cluing")) {
    return (
      <LinearGradient colors={["#080810", "#131325"]} style={styles.root}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          {/* Role badge */}
          <View style={[styles.roleBadge, isMole ? styles.roleMole : styles.roleCrew]}>
            <View style={[styles.roleDot, { backgroundColor: isMole ? "#ff4466" : "#44ffaa" }]} />
            <Text style={[styles.roleText, { color: isMole ? "#ff4466" : "#44ffaa" }]}>
              {isMole ? "YOU ARE THE MOLE" : "YOU ARE CREW"}
            </Text>
          </View>

          {/* Word card */}
          <Animated.View style={[styles.wordCard, { transform: [{ scale: pulseAnim }] }]}>
            <LinearGradient
              colors={isMole ? ["#2d0a14", "#4a0f22"] : ["#0a2d1a", "#0f4a2a"]}
              style={styles.wordInner}
            >
              <Text style={styles.wordLabel}>YOUR WORD</Text>
              <Text style={[styles.wordValue, { color: isMole ? "#ff4466" : "#44ffaa" }]}>{myWord}</Text>
              {moleHint && <Text style={styles.moleHint}>{moleHint} — blend in</Text>}
            </LinearGradient>
          </Animated.View>

          {isMole && (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                ⚠ Your word is DIFFERENT. Give clues that could fit both. Get caught and the crew wins.
              </Text>
            </View>
          )}

          {/* Clue input (shown during cluing phase) */}
          {phase === "cluing" && (
            <View style={styles.clueSection}>
              <View style={styles.clueTopRow}>
                <Text style={styles.clueLabel}>ROUND {data.roundNumber} / {data.totalRounds} — Give ONE word</Text>
                <Text style={[styles.clueTimer, timeLeft <= 5 && { color: "#ef4444" }]}>{timeLeft}s</Text>
              </View>
              {clueLocked ? (
                <View style={styles.clueLocked}>
                  <Text style={styles.clueLockedText}>"{clue}" submitted ✓</Text>
                </View>
              ) : (
                <>
                  <TextInput
                    style={styles.clueInput}
                    value={clue}
                    onChangeText={t => setClue(t.replace(/\s/g, "").slice(0, 20))}
                    placeholder="One word…"
                    placeholderTextColor="rgba(255,255,255,0.2)"
                    autoCapitalize="characters"
                    returnKeyType="send"
                    onSubmitEditing={submitClue}
                  />
                  <TouchableOpacity
                    style={[styles.btn, !clue.trim() && { opacity: 0.4 }]}
                    onPress={submitClue}
                    disabled={!clue.trim()}
                  >
                    <LinearGradient colors={["#7c6fff", "#5b4fcf"]} style={styles.btnInner}>
                      <Text style={styles.btnText}>LOCK IN CLUE</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {/* All clues so far */}
          {Object.keys(clues).length > 0 && (
            <View style={styles.cluesList}>
              <Text style={styles.cluesTitle}>CLUES SO FAR</Text>
              {Object.entries(clues).map(([gid, words]) => (
                <View key={gid} style={styles.clueRow}>
                  <View style={[styles.clueAvatar, { backgroundColor: stringToColor(gid) }]}>
                    <Text style={styles.clueAvatarText}>{(clueNames[gid] ?? gid).charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.clueName}>{clueNames[gid] ?? "Guest"}</Text>
                    <Text style={styles.clueWords}>{words.join(" · ")}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </LinearGradient>
    );
  }

  // ── VOTING ─────────────────────────────────────────────────────────────────
  if (phase === "voting") {
    const players = Object.keys(clueNames).filter(id => id !== state.guestId);
    return (
      <LinearGradient colors={["#080810", "#131325"]} style={styles.root}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text style={styles.bigTitle}>Who's the Mole?</Text>
          <Text style={styles.subtitle}>Review the clues. One person's word doesn't quite fit.</Text>

          {/* Clue review */}
          {Object.entries(clues).map(([gid, words]) => (
            <TouchableOpacity
              key={gid}
              style={[styles.voteRow, selectedVote === gid && styles.voteRowSelected]}
              onPress={() => !voteLocked && setSelectedVote(gid)}
            >
              <View style={[styles.clueAvatar, { backgroundColor: stringToColor(gid) }]}>
                <Text style={styles.clueAvatarText}>{(clueNames[gid] ?? gid).charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.votePlayerName}>{clueNames[gid] ?? "Guest"}</Text>
                <Text style={styles.votePlayerClues}>{words.join(" · ")}</Text>
              </View>
              <View style={[styles.selectRing, selectedVote === gid && styles.selectRingFilled]}>
                {selectedVote === gid && <Text style={{ color: "#fff", fontSize: 11 }}>✓</Text>}
              </View>
            </TouchableOpacity>
          ))}

          {voteLocked ? (
            <View style={styles.clueLocked}>
              <Text style={styles.clueLockedText}>Vote cast — waiting for results…</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.btn, !selectedVote && { opacity: 0.4 }]}
              onPress={submitVote}
              disabled={!selectedVote}
            >
              <LinearGradient colors={["#ff4466", "#cc1133"]} style={styles.btnInner}>
                <Text style={styles.btnText}>CAST VOTE</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </ScrollView>
      </LinearGradient>
    );
  }

  // ── REVEALED ───────────────────────────────────────────────────────────────
  if (phase === "revealed") {
    const caught = data.caught as boolean;
    const moleName = data.moleName as string ?? "The Mole";
    return (
      <LinearGradient colors={["#080810", "#131325"]} style={styles.root}>
        <ScrollView contentContainerStyle={{ padding: 20, alignItems: "center" }}>
          <Text style={{ fontSize: 64, marginBottom: 16 }}>{caught ? "🎉" : "🕵️"}</Text>
          <Text style={styles.bigTitle}>{caught ? "Mole Exposed!" : "Mole Escaped!"}</Text>
          <Text style={styles.subtitle}>
            {caught
              ? `The crew correctly caught ${moleName}`
              : `${moleName} fooled everyone!`}
          </Text>

          <View style={[styles.wordCard, { width: "100%", marginTop: 20 }]}>
            <LinearGradient colors={["#1a1040", "#2d1b69"]} style={styles.wordInner}>
              <Text style={styles.wordLabel}>THE WORDS</Text>
              <Text style={{ color: "#44ffaa", fontSize: 18, fontWeight: "800" }}>Crew: {data.crewWord}</Text>
              <Text style={{ color: "#ff4466", fontSize: 18, fontWeight: "800", marginTop: 8 }}>Mole: {data.moleWord}</Text>
            </LinearGradient>
          </View>

          {data.scores && (
            <View style={{ width: "100%", marginTop: 20 }}>
              <Text style={styles.cluesTitle}>SCORES</Text>
              {Object.entries(data.scores as Record<string, number>)
                .sort((a, b) => b[1] - a[1])
                .map(([gid, pts], i) => (
                  <View key={gid} style={styles.scoreRow}>
                    <Text style={styles.scoreRank}>{i + 1}</Text>
                    <Text style={styles.scoreName}>{clueNames[gid] ?? gid}</Text>
                    <Text style={styles.scorePts}>+{pts}</Text>
                  </View>
                ))}
            </View>
          )}
        </ScrollView>
      </LinearGradient>
    );
  }

  return null;
}

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 50%, 30%)`;
}

const styles = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  bigTitle: { color: "#e8e6ff", fontSize: 26, fontWeight: "800", letterSpacing: -0.5, textAlign: "center", marginBottom: 8 },
  subtitle: { color: "rgba(232,230,255,0.4)", fontSize: 14, lineHeight: 22, textAlign: "center", marginBottom: 20 },

  roleBadge: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "center", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 30, borderWidth: 1, marginBottom: 20 },
  roleMole:  { backgroundColor: "rgba(255,68,102,0.1)", borderColor: "rgba(255,68,102,0.3)" },
  roleCrew:  { backgroundColor: "rgba(68,255,170,0.08)", borderColor: "rgba(68,255,170,0.25)" },
  roleDot:   { width: 8, height: 8, borderRadius: 4 },
  roleText:  { fontWeight: "800", fontSize: 12, letterSpacing: 2 },

  wordCard:  { borderRadius: 20, overflow: "hidden", marginBottom: 16 },
  wordInner: { padding: 28, alignItems: "center" },
  wordLabel: { color: "rgba(255,255,255,0.3)", fontSize: 11, fontWeight: "800", letterSpacing: 3, marginBottom: 12 },
  wordValue: { fontSize: 40, fontWeight: "900", letterSpacing: -1 },
  moleHint:  { color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 10, fontStyle: "italic" },

  warningBox:  { backgroundColor: "rgba(255,68,102,0.07)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,68,102,0.2)", padding: 14, marginBottom: 20 },
  warningText: { color: "rgba(255,68,102,0.85)", fontSize: 13, lineHeight: 20 },

  clueSection: { marginBottom: 20 },
  clueTopRow:  { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  clueLabel:   { color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  clueTimer:   { color: "#7c6fff", fontSize: 14, fontWeight: "900" },
  clueInput: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(124,111,255,0.2)",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  clueLocked:     { backgroundColor: "rgba(124,111,255,0.1)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(124,111,255,0.3)", padding: 16, alignItems: "center" },
  clueLockedText: { color: "#a090ff", fontWeight: "700", fontSize: 14 },

  btn:      { borderRadius: 14, overflow: "hidden", marginTop: 4 },
  btnInner: { paddingVertical: 16, alignItems: "center" },
  btnText:  { color: "#fff", fontWeight: "900", fontSize: 15, letterSpacing: 2 },

  cluesList: { marginTop: 8 },
  cluesTitle: { color: "rgba(255,255,255,0.3)", fontSize: 11, fontWeight: "800", letterSpacing: 3, marginBottom: 10 },
  clueRow:   { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 12, marginBottom: 8 },
  clueAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  clueAvatarText: { color: "#fff", fontWeight: "900", fontSize: 14 },
  clueName:   { color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 2 },
  clueWords:  { color: "#fff", fontWeight: "800", fontSize: 14, letterSpacing: 0.5 },

  voteRow:         { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  voteRowSelected: { borderColor: "#7c6fff", backgroundColor: "rgba(124,111,255,0.08)" },
  votePlayerName:  { color: "#fff", fontWeight: "800", fontSize: 15 },
  votePlayerClues: { color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 },
  selectRing:       { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  selectRingFilled: { borderColor: "#7c6fff", backgroundColor: "#7c6fff" },

  scoreRow:  { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 12, marginBottom: 8 },
  scoreRank: { color: "rgba(255,255,255,0.3)", fontWeight: "800", width: 24, textAlign: "center" },
  scoreName: { flex: 1, color: "#fff", fontWeight: "700" },
  scorePts:  { color: "#7c6fff", fontWeight: "900", fontSize: 16 },
});
