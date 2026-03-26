import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

// ─────────────────────────────────────────────────────────────────────────────
// ArtifactHunt — Guest View
// Tabs: Hunt (clues) / Scan (QR) / Board (leaderboard)
// ─────────────────────────────────────────────────────────────────────────────

export function ArtifactHuntView() {
  const { state, sendAction } = useRoom();
  const data = state.guestViewData as any ?? {};

  const [tab, setTab] = useState<"hunt" | "scan" | "board">("hunt");
  const [timeLeft, setTimeLeft] = useState("");
  const [recentFind, setRecentFind] = useState<string | null>(null);
  const alertAnim = useRef(new Animated.Value(1)).current;

  const phase = data.phase ?? "setup";
  const artifacts = (data.artifacts ?? []) as any[];
  const scores = data.scores as Record<string, number> ?? {};
  const playerNames = data.playerNames as Record<string, string> ?? {};
  const myScore = scores[state.guestId ?? ""] ?? 0;
  const foundCount = data.foundCount ?? 0;
  const total = data.totalArtifacts ?? 5;

  // Timer
  useEffect(() => {
    if (!data.startedAt || !data.durationMs) return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - data.startedAt;
      const remaining = Math.max(0, data.durationMs - elapsed);
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setTimeLeft(`${mins}:${secs.toString().padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [data.startedAt, data.durationMs]);

  // Pulse alert animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(alertAnim, { toValue: 0.75, duration: 1000, useNativeDriver: true }),
        Animated.timing(alertAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Listen for find events
  useEffect(() => {
    const lastEvent = state.experienceState?.lastFind as any;
    if (lastEvent) {
      setRecentFind(`${lastEvent.guestName} found the ${lastEvent.artifactName}!`);
      setTimeout(() => setRecentFind(null), 5000);
    }
  }, [state.experienceState?.lastFind]);

  function simulateScan(qrCode: string) {
    sendAction("scan_qr", { qrCode, guestName: state.guestId });
  }

  const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const myRank = sortedScores.findIndex(([id]) => id === state.guestId) + 1;

  // ── WAITING ────────────────────────────────────────────────────────────────
  if (phase === "setup") {
    return (
      <LinearGradient colors={["#0c1014", "#131a20"]} style={styles.center}>
        <Text style={{ fontSize: 56, marginBottom: 16 }}>🏺</Text>
        <Text style={styles.bigTitle}>ArtifactHunt</Text>
        <Text style={styles.subtitle}>Host is hiding artifacts around the venue…</Text>
      </LinearGradient>
    );
  }

  // ── ENDED ──────────────────────────────────────────────────────────────────
  if (phase === "ended") {
    return (
      <LinearGradient colors={["#0c1014", "#131a20"]} style={styles.root}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text style={styles.bigTitle}>Hunt Over!</Text>
          <Text style={styles.subtitle}>{foundCount} / {total} artifacts found</Text>

          {sortedScores.map(([gid, pts], i) => (
            <View key={gid} style={[styles.lbRow, gid === state.guestId && styles.lbRowMe]}>
              <Text style={[styles.lbRank, i === 0 && { color: "#ffc83c" }]}>{i + 1}</Text>
              <View style={[styles.lbAvatar, { backgroundColor: stringToColor(gid) }]}>
                <Text style={styles.lbAvatarText}>{(playerNames[gid] ?? gid).charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={styles.lbName}>{playerNames[gid] ?? gid}</Text>
              <Text style={styles.lbPts}>{pts}</Text>
            </View>
          ))}
        </ScrollView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#0c1014", "#131a20"]} style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}><Text style={{ color: "#ffc83c" }}>Artifact</Text>Hunt</Text>
          <View style={styles.progressRow}>
            <Text style={styles.progressText}>Your score: </Text>
            <Text style={styles.progressScore}>{myScore}pts</Text>
            {myRank > 0 && <Text style={styles.progressRank}> · #{myRank}</Text>}
          </View>
        </View>
        <View style={styles.timerBox}>
          <Text style={styles.timerLabel}>TIME</Text>
          <Text style={styles.timerVal}>{timeLeft}</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${(foundCount / total) * 100}%` }]} />
      </View>

      {/* Alert */}
      {recentFind && (
        <Animated.View style={[styles.alertBanner, { opacity: alertAnim }]}>
          <Text style={styles.alertText}>⚡ {recentFind}</Text>
        </Animated.View>
      )}

      {/* Tabs */}
      <View style={styles.tabs}>
        {(["hunt", "scan", "board"] as const).map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── HUNT TAB ── */}
      {tab === "hunt" && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          {artifacts.map((a: any, i: number) => {
            const isFound = a.status === "found";
            const isActive = a.status === "active";
            const isLocked = a.status === "locked";
            return (
              <View key={a.id} style={[styles.clueCard, isActive && styles.clueCardActive, isLocked && styles.clueCardLocked]}>
                <View style={styles.clueCardHeader}>
                  <Text style={styles.clueNum}>Artifact 0{i + 1}</Text>
                  <View style={[styles.statusBadge, isFound ? styles.statusFound : isActive ? styles.statusActive : styles.statusLocked]}>
                    <Text style={styles.statusText}>{isFound ? "Found ✓" : isActive ? "Active ›" : "Locked 🔒"}</Text>
                  </View>
                </View>
                <View style={styles.clueCardBody}>
                  {isLocked ? (
                    <Text style={[styles.clueText, styles.clueBlur]}>Find the previous artifact to unlock this clue.</Text>
                  ) : (
                    <Text style={styles.clueText}>{a.clue}</Text>
                  )}
                  {a.hint && (
                    <View style={styles.hintRow}>
                      <Text style={styles.hintIcon}>💡</Text>
                      <Text style={styles.hintText}>Hint: {a.hint}</Text>
                    </View>
                  )}
                  {isFound && a.foundBy?.length > 0 && (
                    <View style={styles.foundBadge}>
                      <Text style={styles.foundEmoji}>{a.emoji}</Text>
                      <View>
                        <Text style={styles.foundName}>{a.name}</Text>
                        <Text style={styles.foundBy}>Found by {a.foundBy[0]}</Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            );
          })}

          <TouchableOpacity style={styles.scanBtn} onPress={() => setTab("scan")}>
            <Text style={styles.scanBtnText}>📷 Scan a QR code</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── SCAN TAB ── */}
      {tab === "scan" && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          {/* Active clue reminder */}
          {artifacts.find((a: any) => a.status === "active") && (
            <View style={styles.activeClueBanner}>
              <Text style={{ fontSize: 24 }}>🗺️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.activeClueLabel}>CURRENTLY HUNTING</Text>
                <Text style={styles.activeClueText} numberOfLines={2}>
                  {artifacts.find((a: any) => a.status === "active")?.clue}
                </Text>
              </View>
            </View>
          )}

          {/* Scan viewport */}
          <View style={styles.scanArea}>
            <View style={styles.scanViewport}>
              {/* Corner markers */}
              {[styles.scTL, styles.scTR, styles.scBL, styles.scBR].map((s, i) => (
                <View key={i} style={[styles.scanCorner, s]} />
              ))}
              <Text style={{ fontSize: 40, opacity: 0.2 }}>📷</Text>
              <Text style={styles.scanText}>POINT AT A HIDDEN QR CODE</Text>
            </View>
            <View style={styles.scanInfo}>
              <Text style={styles.scanInfoTitle}>How to find QR codes</Text>
              <Text style={styles.scanInfoText}>The host hid {total} small QR stickers before the game. Use your clues to find the right location — scanning the wrong code won't score.</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.goldBtn}>
            <LinearGradient colors={["#ffc83c", "#e8a820"]} style={styles.goldBtnInner}>
              <Text style={styles.goldBtnText}>OPEN CAMERA TO SCAN</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── BOARD TAB ── */}
      {tab === "board" && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          {sortedScores.map(([gid, pts], i) => (
            <View key={gid} style={[styles.lbRow, gid === state.guestId && styles.lbRowMe]}>
              <Text style={[styles.lbRank, i === 0 && { color: "#ffc83c" }]}>{i + 1}</Text>
              <View style={[styles.lbAvatar, { backgroundColor: stringToColor(gid) }]}>
                <Text style={styles.lbAvatarText}>{(playerNames[gid] ?? gid).charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.lbName}>{gid === state.guestId ? "You" : (playerNames[gid] ?? gid)}</Text>
                <View style={{ flexDirection: "row", gap: 4, marginTop: 4 }}>
                  {artifacts.filter((a: any) => a.foundBy?.includes(gid)).map((a: any) => (
                    <Text key={a.id} style={{ fontSize: 12 }}>{a.emoji}</Text>
                  ))}
                </View>
              </View>
              <Text style={styles.lbPts}>{pts}</Text>
            </View>
          ))}
          <Text style={styles.timeLeftText}>⏱ {timeLeft} remaining</Text>
        </ScrollView>
      )}
    </LinearGradient>
  );
}

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 45%, 28%)`;
}

const styles = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  bigTitle: { color: "#eef2f5", fontSize: 24, fontWeight: "900", marginBottom: 8 },
  subtitle: { color: "rgba(238,242,245,0.4)", fontSize: 14, textAlign: "center" },

  header:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,200,60,0.12)" },
  brand:        { color: "#eef2f5", fontSize: 20, fontWeight: "900", letterSpacing: 1 },
  progressRow:  { flexDirection: "row", alignItems: "center", marginTop: 4 },
  progressText: { color: "rgba(238,242,245,0.4)", fontSize: 12 },
  progressScore:{ color: "#ffc83c", fontWeight: "900", fontSize: 14 },
  progressRank: { color: "rgba(238,242,245,0.4)", fontSize: 12 },
  timerBox:     { alignItems: "flex-end" },
  timerLabel:   { color: "rgba(238,242,245,0.3)", fontSize: 9, fontWeight: "800", letterSpacing: 3 },
  timerVal:     { color: "#ffc83c", fontWeight: "900", fontSize: 20 },

  progressBar:  { height: 5, backgroundColor: "rgba(255,255,255,0.05)" },
  progressFill: { height: "100%", backgroundColor: "#ffc83c", borderRadius: 2 },

  alertBanner: { backgroundColor: "rgba(0,232,122,0.08)", borderBottomWidth: 1, borderBottomColor: "rgba(0,232,122,0.2)", padding: 10, paddingHorizontal: 16 },
  alertText:   { color: "#00e87a", fontWeight: "700", fontSize: 13 },

  tabs:         { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "rgba(255,200,60,0.12)" },
  tab:          { flex: 1, paddingVertical: 11, alignItems: "center" },
  tabActive:    { borderBottomWidth: 2, borderBottomColor: "#ffc83c" },
  tabText:      { color: "rgba(238,242,245,0.35)", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  tabTextActive:{ color: "#ffc83c" },

  clueCard:       { backgroundColor: "#192028", borderWidth: 1, borderColor: "rgba(255,200,60,0.12)", borderRadius: 12, marginBottom: 12, overflow: "hidden" },
  clueCardActive: { borderColor: "rgba(255,200,60,0.3)" },
  clueCardLocked: { opacity: 0.55 },
  clueCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 10, paddingHorizontal: 14, backgroundColor: "rgba(255,200,60,0.05)", borderBottomWidth: 1, borderBottomColor: "rgba(255,200,60,0.1)" },
  clueNum:        { color: "#ffc83c", fontSize: 10, fontWeight: "900", letterSpacing: 3 },
  statusBadge:    { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  statusFound:    { backgroundColor: "rgba(0,232,122,0.12)" },
  statusActive:   { backgroundColor: "rgba(255,200,60,0.12)" },
  statusLocked:   { backgroundColor: "rgba(255,255,255,0.05)" },
  statusText:     { color: "#eef2f5", fontSize: 10, fontWeight: "800" },
  clueCardBody:   { padding: 14 },
  clueText:       { color: "#eef2f5", fontSize: 14, fontWeight: "600", lineHeight: 22 },
  clueBlur:       { opacity: 0.3 },
  hintRow:        { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 10 },
  hintIcon:       { fontSize: 14 },
  hintText:       { color: "rgba(238,242,245,0.5)", fontSize: 13, fontStyle: "italic", flex: 1 },
  foundBadge:     { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(0,232,122,0.08)", borderRadius: 8, padding: 10, marginTop: 10, borderWidth: 1, borderColor: "rgba(0,232,122,0.2)" },
  foundEmoji:     { fontSize: 20 },
  foundName:      { color: "#00e87a", fontWeight: "900", fontSize: 14 },
  foundBy:        { color: "rgba(0,232,122,0.6)", fontSize: 11, marginTop: 2 },

  scanBtn:     { backgroundColor: "rgba(64,180,255,0.12)", borderWidth: 1, borderColor: "rgba(64,180,255,0.3)", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  scanBtnText: { color: "#40b4ff", fontWeight: "800", fontSize: 15, letterSpacing: 1 },

  activeClueBanner: { backgroundColor: "rgba(255,200,60,0.07)", borderWidth: 1, borderColor: "rgba(255,200,60,0.2)", borderRadius: 10, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  activeClueLabel:  { color: "#ffc83c", fontSize: 9, fontWeight: "800", letterSpacing: 2, marginBottom: 4 },
  activeClueText:   { color: "#eef2f5", fontWeight: "600", fontSize: 14, lineHeight: 20 },

  scanArea:     { backgroundColor: "#192028", borderWidth: 1, borderColor: "rgba(255,200,60,0.12)", borderRadius: 12, overflow: "hidden", marginBottom: 14 },
  scanViewport: { aspectRatio: 1, backgroundColor: "#0a0f14", justifyContent: "center", alignItems: "center", gap: 12, position: "relative" },
  scanCorner:   { position: "absolute", width: 32, height: 32, borderColor: "#ffc83c", borderStyle: "solid" },
  scTL:         { top: 24, left: 24, borderTopWidth: 2, borderLeftWidth: 2 },
  scTR:         { top: 24, right: 24, borderTopWidth: 2, borderRightWidth: 2 },
  scBL:         { bottom: 24, left: 24, borderBottomWidth: 2, borderLeftWidth: 2 },
  scBR:         { bottom: 24, right: 24, borderBottomWidth: 2, borderRightWidth: 2 },
  scanText:     { color: "rgba(238,242,245,0.4)", fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  scanInfo:     { padding: 14, borderTopWidth: 1, borderTopColor: "rgba(255,200,60,0.1)" },
  scanInfoTitle:{ color: "#eef2f5", fontWeight: "800", fontSize: 14, marginBottom: 6 },
  scanInfoText: { color: "rgba(238,242,245,0.45)", fontSize: 13, lineHeight: 20 },

  goldBtn:      { borderRadius: 10, overflow: "hidden" },
  goldBtnInner: { paddingVertical: 15, alignItems: "center" },
  goldBtnText:  { color: "#0c1014", fontWeight: "900", fontSize: 15, letterSpacing: 2 },

  lbRow:       { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#192028", borderWidth: 1, borderColor: "rgba(255,200,60,0.12)", borderRadius: 10, padding: 14, marginBottom: 8 },
  lbRowMe:     { borderColor: "rgba(64,180,255,0.35)", backgroundColor: "rgba(64,180,255,0.04)" },
  lbRank:      { color: "rgba(238,242,245,0.35)", fontWeight: "900", fontSize: 18, width: 28, textAlign: "center" },
  lbAvatar:    { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  lbAvatarText:{ color: "#fff", fontWeight: "900", fontSize: 14 },
  lbName:      { flex: 1, color: "#eef2f5", fontWeight: "700", fontSize: 14 },
  lbPts:       { color: "#ffc83c", fontWeight: "900", fontSize: 18 },
  timeLeftText:{ color: "rgba(238,242,245,0.3)", fontSize: 13, textAlign: "center", marginTop: 8 },
});
