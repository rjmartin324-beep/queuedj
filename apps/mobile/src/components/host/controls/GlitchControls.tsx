import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";
import { HostActionButton } from "../HostActionButton";
import { WatchingView }    from "../../experiences/the-glitch/WatchingView";
import { DescribingView }  from "../../experiences/the-glitch/DescribingView";
import { GlitchVotingView as GlitchVoting }  from "../../experiences/the-glitch/VotingView";
import { GlitchRevealView as GlitchReveal }  from "../../experiences/the-glitch/RevealView";

// ─── Content ─────────────────────────────────────────────────────────────────

const VIDEOS = [
  { title: "Cat dramatically falls off a table", category: "Animals", emoji: "🐱", description: "A cat knocks something off a table, then dramatically falls off itself trying to catch it" },
  { title: "Dog slides across freshly mopped floor", category: "Animals", emoji: "🐕", description: "A dog runs full speed into a room, then slides helplessly across a freshly mopped floor" },
  { title: "Grandma tries VR for the first time", category: "People", emoji: "👵", description: "An elderly woman puts on a VR headset and immediately starts screaming and swatting at invisible things" },
  { title: "Baby tastes lemon for the first time", category: "Food", emoji: "🍋", description: "A baby is given a slice of lemon, their face contorts through every emotion in seconds" },
  { title: "Seagull aggressively steals ice cream cone", category: "Animals", emoji: "🐦", description: "A seagull swoops down and snatches a massive ice cream cone directly from someone's hand" },
  { title: "Man walks into sliding glass door", category: "People", emoji: "🚪", description: "A very confident man strides towards a sliding glass door that does not open — walks directly into it" },
  { title: "Toddler tries to pet a butterfly", category: "Kids", emoji: "🦋", description: "A toddler chases a butterfly with both arms outstretched, trips, then lands perfectly in a sitting position" },
  { title: "Dog steals entire birthday cake", category: "Animals", emoji: "🎂", description: "A golden retriever sneaks onto the table mid-birthday song and eats the entire cake in one motion" },
  { title: "Kid discovers escalator for the first time", category: "Kids", emoji: "⬆️", description: "A small child steps onto an escalator, freezes with panic, and rides it like a statue back up and down four times" },
  { title: "Office chair spins out of control", category: "People", emoji: "🪑", description: "Someone pushes off their desk in an office chair and spins uncontrollably across the entire open-plan office" },
];

const AI_PLAYERS = [
  { id: "ai_becca", name: "Becca", skill: 0.88 },
  { id: "ai_tim",   name: "Tim",   skill: 0.74 },
  { id: "ai_mazsle",name: "Mazsle",skill: 0.62 },
  { id: "ai_banks", name: "Banks", skill: 0.50 },
  { id: "ai_mel",   name: "Mel",   skill: 0.80 },
];

const AI_DESCRIPTIONS = [
  ["Absolute chaos from start to finish", "I've never seen anything like it in my life", "This is why we can't have nice things"],
  ["Pure unfiltered disaster energy", "Peak comedy — no notes", "The confidence before the fail was immaculate"],
  ["Didn't see that coming at all", "The slow motion replay would be incredible", "This made my whole week honestly"],
  ["I felt that in my soul", "The commitment was there, the execution was not", "Nature always wins in the end"],
  ["Someone got this on video and I respect them", "The 0.5 second delay before panic is so real", "10/10 timing by the universe"],
];

// ─── Types ────────────────────────────────────────────────────────────────────

type LocalPhase = "idle" | "watching" | "describing" | "voting" | "reveal" | "final";
interface LocalState { phase: LocalPhase; videos: typeof VIDEOS; idx: number; scores: Record<string, number> }
const IDLE: LocalState = { phase: "idle", videos: [], idx: 0, scores: {} };
const MOCK_GUEST = "host-player";

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ViewModeProps {
  viewMode: "player" | "host";
  onViewModeChange: (mode: "player" | "host") => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function GlitchControls({ viewMode, onViewModeChange: setViewMode }: ViewModeProps) {
  const { state, sendAction, dispatch } = useRoom();
  const [local, setLocal] = useState<LocalState>(IDLE);
  const isLocal = local.phase !== "idle";

  useEffect(() => {
    if (local.phase !== "watching") return;
    const t = setTimeout(() => {
      startDescribing();
    }, 8000);
    return () => clearTimeout(t);
  }, [local.phase, local.idx]);

  function startGame() {
    const videos = shuffled(VIDEOS).slice(0, 4);
    const scores: Record<string, number> = { [MOCK_GUEST]: 0 };
    AI_PLAYERS.forEach(p => { scores[p.id] = 0; });
    if (!state.guestId) dispatch({ type: "SET_GUEST_ID", guestId: MOCK_GUEST, role: "HOST" });
    setLocal({ phase: "watching", videos, idx: 0, scores });
    setViewMode("player");
    pushWatching(videos, 0);
  }

  function pushWatching(videos: typeof VIDEOS, idx: number) {
    const v = videos[idx];
    dispatch({
      type: "SET_EXPERIENCE", experience: "the_glitch", view: "glitch_watching",
      viewData: { revealedAt: Date.now(), viewingMs: 8000, myPrompt: { description: v.description, category: v.category } },
      expState: { phase: "watching", roundNumber: idx + 1, totalRounds: videos.length },
    });
    setLocal(prev => ({ ...prev, phase: "watching", idx }));
  }

  function startDescribing() {
    dispatch({
      type: "SET_EXPERIENCE", experience: "the_glitch", view: "glitch_describing",
      viewData: {},
      expState: { phase: "describing", roundNumber: local.idx + 1, totalRounds: local.videos.length },
    });
    setLocal(prev => ({ ...prev, phase: "describing" }));
    setViewMode("player");
  }

  function startVoting() {
    const descriptions = [
      { guestId: MOCK_GUEST, playerNum: 1, isMe: true, text: "I cannot believe what I just saw honestly" },
      ...AI_PLAYERS.map((ai, i) => ({
        guestId: ai.id, playerNum: i + 2, isMe: false,
        text: AI_DESCRIPTIONS[i % AI_DESCRIPTIONS.length][local.idx % 3],
        displayName: ai.name,
      })),
    ];
    dispatch({
      type: "SET_EXPERIENCE", experience: "the_glitch", view: "glitch_voting",
      viewData: { descriptions },
      expState: { phase: "voting" },
    });
    setLocal(prev => ({ ...prev, phase: "voting" }));
    setViewMode("player");
  }

  function revealRound() {
    const newScores = { ...local.scores };
    // Random votes weighted by skill — highest skill AI most likely to win
    const allPlayers = [
      { guestId: MOCK_GUEST, playerNum: 1, isMe: true, displayName: "You" },
      ...AI_PLAYERS.map((ai, i) => ({ guestId: ai.id, playerNum: i + 2, isMe: false, displayName: ai.name })),
    ];
    const votes: Record<string, number> = {};
    allPlayers.forEach(p => { votes[p.guestId] = 0; });
    // Each player votes for someone else
    allPlayers.forEach(voter => {
      const others = allPlayers.filter(p => p.guestId !== voter.guestId);
      const picked = others[Math.floor(Math.random() * others.length)];
      votes[picked.guestId] = (votes[picked.guestId] ?? 0) + 1;
    });
    const entries = allPlayers.map(p => {
      const v = votes[p.guestId] ?? 0;
      newScores[p.guestId] = (newScores[p.guestId] ?? 0) + v * 100;
      return { ...p, votes: v };
    }).sort((a, b) => b.votes - a.votes);
    const winner = entries[0];
    const isLast = local.idx + 1 >= local.videos.length;
    dispatch({
      type: "SET_EXPERIENCE", experience: "the_glitch", view: "glitch_reveal",
      viewData: { winner: { guestId: winner.guestId }, entries },
      expState: { phase: "reveal", roundNumber: local.idx + 1, totalRounds: local.videos.length },
    });
    setLocal(prev => ({ ...prev, phase: isLast ? "final" : "reveal", scores: newScores }));
    setViewMode("player");
  }

  function nextRound() { pushWatching(local.videos, local.idx + 1); setViewMode("player"); }

  function buildLbData(scores: Record<string, number>) {
    return [
      { guestId: MOCK_GUEST, score: scores[MOCK_GUEST] ?? 0, playerNum: 1, isMe: true },
      ...AI_PLAYERS.map((ai, i) => ({ guestId: ai.id, score: scores[ai.id] ?? 0, playerNum: i + 2, isMe: false, displayName: ai.name })),
    ].sort((a, b) => b.score - a.score);
  }

  function stopGame() {
    setLocal(IDLE); setViewMode("host");
    dispatch({ type: "SET_EXPERIENCE", experience: "the_glitch", view: "intermission" as any });
  }

  // Player view
  if (isLocal && viewMode === "player") {
    return (
      <View style={{ flex: 1, minHeight: 500 }}>
        {local.phase === "watching"   && <WatchingView />}
        {local.phase === "describing" && <DescribingView />}
        {local.phase === "voting"     && <GlitchVoting />}
        {(local.phase === "reveal" || local.phase === "final") && <GlitchReveal />}
      </View>
    );
  }

  // Host controls — active game
  if (isLocal) {
    const video = local.videos[local.idx];
    return (
      <ScrollView contentContainerStyle={ls.container} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={["#0f0a28","#1a0e40"]} style={ls.header}>
          <View>
            <Text style={ls.headerLabel}>📺  THE GLITCH</Text>
            <Text style={ls.headerRound}>Round {local.idx + 1} / {local.videos.length}</Text>
          </View>
          <TouchableOpacity style={ls.playerViewBtn} onPress={() => setViewMode("player")}>
            <Text style={ls.playerViewBtnText}>👁 Player View</Text>
          </TouchableOpacity>
        </LinearGradient>

        {video && (
          <View style={ls.card}>
            <Text style={ls.cardEmoji}>{video.emoji}</Text>
            <Text style={ls.cardTitle}>{video.title}</Text>
            <Text style={ls.cardSub}>{video.category}</Text>
          </View>
        )}

        {(local.phase === "reveal" || local.phase === "final") && (
          <View style={ls.lbMini}>
            <Text style={ls.lbTitle}>{local.phase === "final" ? "🏆 Final" : `📊 After Round ${local.idx + 1}`}</Text>
            {buildLbData(local.scores).map((e, i) => (
              <View key={e.guestId} style={[ls.lbRow, e.isMe && ls.lbRowMe]}>
                <Text style={[ls.lbRank, i === 0 && { color: "#FFD700" }]}>#{i + 1}</Text>
                <Text style={[ls.lbName, e.isMe && { color: "#c4b5fd" }]}>{e.isMe ? "You" : (e as any).displayName}</Text>
                <Text style={ls.lbScore}>{e.score} pts</Text>
              </View>
            ))}
          </View>
        )}

        <View style={ls.controls}>
          {local.phase === "watching"   && <HostActionButton label="🎤  Start Describing" onPress={startDescribing} />}
          {local.phase === "describing" && <HostActionButton label="🗳  Start Voting"     onPress={startVoting} />}
          {local.phase === "voting"     && <HostActionButton label="🏆  Reveal Winner"    onPress={revealRound} />}
          {local.phase === "reveal"     && <HostActionButton label={`▶  Next Round (${local.idx + 2}/${local.videos.length})`} onPress={nextRound} />}
          {local.phase === "final"      && <HostActionButton label="🔄  Play Again"       onPress={startGame} />}
          {(local.phase === "describing" || local.phase === "voting") && (
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
        <LinearGradient colors={["#0f0a28","#4c1d95"]} style={s.launchBtn}>
          <Text style={s.launchEmoji}>📺</Text>
          <View><Text style={s.launchLabel}>Start The Glitch</Text><Text style={s.launchSub}>4 rounds · Watch · Describe · Vote · Offline</Text></View>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const ls = StyleSheet.create({
  container:   { gap: 14, paddingBottom: 20 },
  header:      { borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 },
  headerLabel: { color: "#c4b5fd", fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 4 },
  headerRound: { color: "#fff", fontSize: 20, fontWeight: "900" },
  playerViewBtn:     { backgroundColor: "#0f0a28", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "#4c1d9544" },
  playerViewBtnText: { color: "#a78bfa", fontSize: 11, fontWeight: "700" },
  card:        { backgroundColor: "#111", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#222", alignItems: "center", gap: 8 },
  cardEmoji:   { fontSize: 44 },
  cardTitle:   { color: "#fff", fontSize: 16, fontWeight: "900", textAlign: "center" },
  cardSub:     { color: "#6c47ff", fontSize: 11, fontWeight: "700", letterSpacing: 1.5 },
  lbMini:      { backgroundColor: "#111", borderRadius: 14, borderWidth: 1, borderColor: "#222", padding: 14, gap: 8 },
  lbTitle:     { color: "#fff", fontSize: 15, fontWeight: "900", marginBottom: 4 },
  lbRow:       { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#1a1a1a" },
  lbRowMe:     { backgroundColor: "rgba(108,71,255,0.1)", borderRadius: 8, paddingHorizontal: 8 },
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
