import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";
import { HostActionButton } from "../HostActionButton";
import { ChallengeView }              from "../../experiences/scavenger-snap/ChallengeView";
import { GalleryView as SnapGallery } from "../../experiences/scavenger-snap/GalleryView";
import { ResultsView as SnapResults } from "../../experiences/scavenger-snap/ResultsView";

// ─── Content ─────────────────────────────────────────────────────────────────

const CHALLENGES = [
  { challenge: "Find something red, round, and edible", emoji: "🍎", timeLimit: 60 },
  { challenge: "Take a photo with something older than you", emoji: "🏺", timeLimit: 60 },
  { challenge: "Find something that starts with the letter B", emoji: "🅱️", timeLimit: 60 },
  { challenge: "Photograph the most colorful thing you can find", emoji: "🌈", timeLimit: 60 },
  { challenge: "Find something that makes a sound", emoji: "🔔", timeLimit: 60 },
  { challenge: "Take a photo of something in pairs", emoji: "👯", timeLimit: 60 },
  { challenge: "Find something that could survive a zombie apocalypse", emoji: "🧟", timeLimit: 60 },
  { challenge: "Photograph something unexpectedly beautiful nearby", emoji: "✨", timeLimit: 60 },
  { challenge: "Find something that belongs in a museum", emoji: "🏛️", timeLimit: 60 },
  { challenge: "Take a photo of the most boring thing you can find", emoji: "😴", timeLimit: 60 },
  { challenge: "Find something that could be used as a weapon in a pillow fight", emoji: "🛌", timeLimit: 60 },
  { challenge: "Photograph something that tells a story", emoji: "📖", timeLimit: 60 },
];

const AI_PLAYERS = [
  { id: "ai_becca", name: "Becca", skill: 0.88 },
  { id: "ai_tim",   name: "Tim",   skill: 0.74 },
  { id: "ai_mazsle",name: "Mazsle",skill: 0.62 },
  { id: "ai_banks", name: "Banks", skill: 0.50 },
  { id: "ai_mel",   name: "Mel",   skill: 0.80 },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type LocalPhase = "idle" | "challenge" | "gallery" | "results" | "final";
interface LocalState { phase: LocalPhase; challenges: typeof CHALLENGES; idx: number; scores: Record<string, number> }
const IDLE: LocalState = { phase: "idle", challenges: [], idx: 0, scores: {} };
const MOCK_GUEST = "host-player";

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ─── View mode props ──────────────────────────────────────────────────────────

interface ViewModeProps {
  viewMode: "player" | "host";
  onViewModeChange: (mode: "player" | "host") => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ScavengerSnapControls({ viewMode, onViewModeChange: setViewMode }: ViewModeProps) {
  const { state, sendAction, dispatch } = useRoom();
  const [local, setLocal] = useState<LocalState>(IDLE);
  const isLocal = local.phase !== "idle";

  function startGame() {
    const challenges = shuffled(CHALLENGES).slice(0, 5);
    const scores: Record<string, number> = { [MOCK_GUEST]: 0 };
    AI_PLAYERS.forEach(p => { scores[p.id] = 0; });
    if (!state.guestId) dispatch({ type: "SET_GUEST_ID", guestId: MOCK_GUEST, role: "HOST" });
    setLocal({ phase: "challenge", challenges, idx: 0, scores });
    setViewMode("player");
    pushChallenge(challenges, 0);
  }

  function pushChallenge(challenges: typeof CHALLENGES, idx: number) {
    const c = challenges[idx];
    dispatch({
      type: "SET_EXPERIENCE", experience: "scavenger_snap", view: "snap_challenge",
      viewData: { challenge: c.challenge, timeLimit: c.timeLimit },
      expState: { phase: "challenge", roundNumber: idx + 1, totalRounds: challenges.length },
    });
    setLocal(prev => ({ ...prev, phase: "challenge", idx }));
  }

  function showGallery() {
    const c = local.challenges[local.idx];
    const photos = [
      { guestId: MOCK_GUEST, playerNum: 1, isMe: true, dataUrl: null },
      ...AI_PLAYERS.map((ai, i) => ({ guestId: ai.id, playerNum: i + 2, isMe: false, dataUrl: null, displayName: ai.name })),
    ];
    dispatch({
      type: "SET_EXPERIENCE", experience: "scavenger_snap", view: "snap_gallery",
      viewData: { challenge: c.challenge, photos },
      expState: { phase: "gallery" },
    });
    setLocal(prev => ({ ...prev, phase: "gallery" }));
    setViewMode("player");
  }

  function revealResults() {
    const c = local.challenges[local.idx];
    const newScores = { ...local.scores };
    const allPlayers = [
      { guestId: MOCK_GUEST, playerNum: 1, isMe: true, displayName: "You" },
      ...AI_PLAYERS.map((ai, i) => ({ guestId: ai.id, playerNum: i + 2, isMe: false, displayName: ai.name })),
    ];
    const votes: Record<string, number> = {};
    allPlayers.forEach(p => { votes[p.guestId] = 0; });
    allPlayers.forEach(voter => {
      const others = allPlayers.filter(p => p.guestId !== voter.guestId);
      const picked = others[Math.floor(Math.random() * others.length)];
      votes[picked.guestId] = (votes[picked.guestId] ?? 0) + 1;
    });
    const entries = allPlayers.map(p => {
      const v = votes[p.guestId] ?? 0;
      newScores[p.guestId] = (newScores[p.guestId] ?? 0) + v * 100;
      return { ...p, votes: v, dataUrl: null };
    }).sort((a, b) => b.votes - a.votes);
    const winner = entries[0];
    const isLast = local.idx + 1 >= local.challenges.length;
    dispatch({
      type: "SET_EXPERIENCE", experience: "scavenger_snap", view: "snap_results",
      viewData: { challenge: c.challenge, winner: { guestId: winner.guestId }, entries },
      expState: { phase: "results" },
    });
    setLocal(prev => ({ ...prev, phase: isLast ? "final" : "results", scores: newScores }));
    setViewMode("player");
  }

  function nextRound() { pushChallenge(local.challenges, local.idx + 1); setViewMode("player"); }

  function buildLbData(scores: Record<string, number>) {
    return [
      { guestId: MOCK_GUEST, score: scores[MOCK_GUEST] ?? 0, playerNum: 1, isMe: true },
      ...AI_PLAYERS.map((ai, i) => ({ guestId: ai.id, score: scores[ai.id] ?? 0, playerNum: i + 2, isMe: false, displayName: ai.name })),
    ].sort((a, b) => b.score - a.score);
  }

  function stopGame() {
    setLocal(IDLE); setViewMode("host");
    dispatch({ type: "SET_EXPERIENCE", experience: "scavenger_snap", view: "intermission" as any });
  }

  // Player view
  if (isLocal && viewMode === "player") {
    return (
      <View style={{ flex: 1, minHeight: 500 }}>
        {local.phase === "challenge" && <ChallengeView />}
        {local.phase === "gallery"   && <SnapGallery />}
        {(local.phase === "results" || local.phase === "final") && <SnapResults />}
      </View>
    );
  }

  // Host controls — active game
  if (isLocal) {
    const ch = local.challenges[local.idx];
    return (
      <ScrollView contentContainerStyle={ls.container} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={["#0a2010","#14532d"]} style={ls.header}>
          <View>
            <Text style={ls.headerLabel}>📸  SCAVENGER SNAP</Text>
            <Text style={ls.headerRound}>Round {local.idx + 1} / {local.challenges.length}</Text>
          </View>
          <TouchableOpacity style={ls.playerViewBtn} onPress={() => setViewMode("player")}>
            <Text style={ls.playerViewBtnText}>👁 Player View</Text>
          </TouchableOpacity>
        </LinearGradient>

        {ch && (
          <View style={ls.card}>
            <Text style={ls.cardEmoji}>{ch.emoji}</Text>
            <Text style={ls.cardTitle}>{ch.challenge}</Text>
            <Text style={ls.cardSub}>{ch.timeLimit}s to find it</Text>
          </View>
        )}

        {(local.phase === "results" || local.phase === "final") && (
          <View style={ls.lbMini}>
            <Text style={ls.lbTitle}>{local.phase === "final" ? "🏆 Final" : `📸 After Round ${local.idx + 1}`}</Text>
            {buildLbData(local.scores).map((e, i) => (
              <View key={e.guestId} style={[ls.lbRow, e.isMe && ls.lbRowMe]}>
                <Text style={[ls.lbRank, i === 0 && { color: "#FFD700" }]}>#{i + 1}</Text>
                <Text style={[ls.lbName, e.isMe && { color: "#6ee7b7" }]}>{e.isMe ? "You" : (e as any).displayName}</Text>
                <Text style={ls.lbScore}>{e.score} pts</Text>
              </View>
            ))}
          </View>
        )}

        <View style={ls.controls}>
          {local.phase === "challenge" && <HostActionButton label="🖼️  See Everyone's Snaps" onPress={showGallery} />}
          {local.phase === "gallery"   && <HostActionButton label="🏆  Reveal Winner"        onPress={revealResults} />}
          {local.phase === "results"   && <HostActionButton label={`▶  Next Round (${local.idx + 2}/${local.challenges.length})`} onPress={nextRound} />}
          {local.phase === "final"     && <HostActionButton label="🔄  Play Again"            onPress={startGame} />}
          {(local.phase === "challenge" || local.phase === "gallery") && (
            <TouchableOpacity style={ls.skipBtn} onPress={() => sendAction("skip_round", {})}>
              <Text style={ls.skipBtnText}>⏭  Skip Phase (server)</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={ls.stopBtn} onPress={stopGame}><Text style={ls.stopBtnText}>⏹  Stop Game</Text></TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // Idle
  return (
    <View style={s.container}>
      <TouchableOpacity onPress={startGame} activeOpacity={0.85}>
        <LinearGradient colors={["#0a2010","#15803d"]} style={s.launchBtn}>
          <Text style={s.launchEmoji}>📸</Text>
          <View><Text style={s.launchLabel}>Start Scavenger Snap</Text><Text style={s.launchSub}>5 rounds · Snap · Vote · Win · Offline</Text></View>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const ls = StyleSheet.create({
  container:   { gap: 14, paddingBottom: 20 },
  header:      { borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 },
  headerLabel: { color: "#6ee7b7", fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 4 },
  headerRound: { color: "#fff", fontSize: 20, fontWeight: "900" },
  playerViewBtn:     { backgroundColor: "#0a2010", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "#14532d44" },
  playerViewBtnText: { color: "#4ade80", fontSize: 11, fontWeight: "700" },
  card:        { backgroundColor: "#111", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#222", alignItems: "center", gap: 8 },
  cardEmoji:   { fontSize: 44 },
  cardTitle:   { color: "#fff", fontSize: 16, fontWeight: "900", textAlign: "center" },
  cardSub:     { color: "#4ade80", fontSize: 12, fontWeight: "700" },
  lbMini:      { backgroundColor: "#111", borderRadius: 14, borderWidth: 1, borderColor: "#222", padding: 14, gap: 8 },
  lbTitle:     { color: "#fff", fontSize: 15, fontWeight: "900", marginBottom: 4 },
  lbRow:       { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#1a1a1a" },
  lbRowMe:     { backgroundColor: "rgba(74,222,128,0.08)", borderRadius: 8, paddingHorizontal: 8 },
  lbRank:      { color: "#555", fontSize: 14, fontWeight: "800", minWidth: 32 },
  lbName:      { flex: 1, color: "#ccc", fontSize: 14, fontWeight: "600" },
  lbScore:     { color: "#888", fontSize: 16, fontWeight: "900" },
  controls:    { gap: 8, borderTopWidth: 1, borderTopColor: "#1a1a1a", paddingTop: 12 },
  skipBtn:     { alignItems: "center", paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: "#f59e0b44", backgroundColor: "#f59e0b11" },
  skipBtnText: { color: "#f59e0b", fontSize: 12, fontWeight: "700" },
  stopBtn:     { alignItems: "center", paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: "#1e1e1e" },
  stopBtnText: { color: "#444", fontSize: 13, fontWeight: "700" },
});
const s = StyleSheet.create({
  container:   { gap: 16, paddingBottom: 20 },
  launchBtn:   { borderRadius: 16, padding: 18, flexDirection: "row", alignItems: "center", gap: 14 },
  launchEmoji: { fontSize: 32 },
  launchLabel: { color: "#fff", fontSize: 18, fontWeight: "900", marginBottom: 4 },
  launchSub:   { color: "rgba(255,255,255,0.55)", fontSize: 12 },
});
