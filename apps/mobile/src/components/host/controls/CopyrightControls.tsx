import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";
import { HostActionButton } from "../HostActionButton";
import { ViewingView }   from "../../experiences/copyright-infringement/ViewingView";
import { DrawingCanvas } from "../../experiences/copyright-infringement/DrawingCanvas";
import { GalleryView as CopyGallery }  from "../../experiences/copyright-infringement/GalleryView";
import { CopyrightResultsView as CopyResults }  from "../../experiences/copyright-infringement/ResultsView";

// ─── Content ─────────────────────────────────────────────────────────────────

const ARTWORKS = [
  { title: "Starry Night", emoji: "🌌", artist: "Van Gogh", description: "A swirling night sky over a village with a bright crescent moon, painted with thick swirling brushstrokes in deep blues and yellows" },
  { title: "Mona Lisa", emoji: "🖼️", artist: "Da Vinci", description: "A mysterious woman with an enigmatic smile sits before a vast landscape. Her gaze follows the viewer wherever they stand" },
  { title: "The Scream", emoji: "😱", artist: "Munch", description: "A figure with a skull-like face holds its face in horror on a bridge while the sky swirls with red and orange behind it" },
  { title: "Girl with a Pearl Earring", emoji: "💎", artist: "Vermeer", description: "A young girl looks back over her shoulder wearing a large pearl earring and a blue and gold headscarf against a dark background" },
  { title: "The Persistence of Memory", emoji: "⏰", artist: "Dalí", description: "Melting clocks draped over bizarre landscape objects in a surreal dreamscape. A distorted face lies on the ground" },
  { title: "American Gothic", emoji: "🏚️", artist: "Wood", description: "A stern-faced farmer and his daughter stand in front of a gothic-style farmhouse. He holds a pitchfork" },
  { title: "The Birth of Venus", emoji: "🐚", artist: "Botticelli", description: "A nude goddess emerges from the sea standing on a giant shell, blown to shore by winds while a woman rushes to clothe her" },
  { title: "Water Lilies", emoji: "🌸", artist: "Monet", description: "Floating lily pads and flowers on a pond's surface, reflected light creating shimmering abstract shapes in soft pinks and greens" },
];

const AI_PLAYERS = [
  { id: "ai_becca", name: "Becca", skill: 0.88 },
  { id: "ai_tim",   name: "Tim",   skill: 0.74 },
  { id: "ai_mazsle",name: "Mazsle",skill: 0.62 },
  { id: "ai_banks", name: "Banks", skill: 0.50 },
  { id: "ai_mel",   name: "Mel",   skill: 0.80 },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type LocalPhase = "idle" | "viewing" | "drawing" | "gallery" | "results" | "final";
interface LocalState { phase: LocalPhase; artworks: typeof ARTWORKS; idx: number; scores: Record<string, number> }
const IDLE: LocalState = { phase: "idle", artworks: [], idx: 0, scores: {} };
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

export function CopyrightControls({ viewMode, onViewModeChange: setViewMode }: ViewModeProps) {
  const { state, sendAction, dispatch } = useRoom();
  const [local, setLocal] = useState<LocalState>(IDLE);
  const isLocal = local.phase !== "idle";

  function startGame() {
    const artworks = shuffled(ARTWORKS).slice(0, 4);
    const scores: Record<string, number> = { [MOCK_GUEST]: 0 };
    AI_PLAYERS.forEach(p => { scores[p.id] = 0; });
    if (!state.guestId) dispatch({ type: "SET_GUEST_ID", guestId: MOCK_GUEST, role: "HOST" });
    setLocal({ phase: "viewing", artworks, idx: 0, scores });
    setViewMode("player");
    pushViewing(artworks, 0);
  }

  function pushViewing(artworks: typeof ARTWORKS, idx: number) {
    const art = artworks[idx];
    dispatch({
      type: "SET_EXPERIENCE", experience: "copyright_infringement", view: "copyright_viewing",
      viewData: { artworkTitle: art.title, artworkEmoji: art.emoji, artworkDescription: art.description },
      expState: { phase: "viewing", roundNumber: idx + 1, totalRounds: artworks.length },
    });
    setLocal(prev => ({ ...prev, phase: "viewing", idx }));
  }

  function startDrawing() {
    const art = local.artworks[local.idx];
    dispatch({
      type: "SET_EXPERIENCE", experience: "copyright_infringement", view: "copyright_drawing",
      viewData: { prompt: art.title, artworkTitle: art.title, artworkEmoji: art.emoji, artworkDescription: art.description, drawingMs: 60000 },
      expState: { phase: "drawing" },
    });
    setLocal(prev => ({ ...prev, phase: "drawing" }));
    setViewMode("player");
  }

  function showGallery() {
    const art = local.artworks[local.idx];
    const photos = [
      { guestId: MOCK_GUEST, playerNum: 1, isMe: true, dataUrl: null },
      ...AI_PLAYERS.map((ai, i) => ({ guestId: ai.id, playerNum: i + 2, isMe: false, dataUrl: null, displayName: ai.name })),
    ];
    dispatch({
      type: "SET_EXPERIENCE", experience: "copyright_infringement", view: "copyright_gallery",
      viewData: { artworkTitle: art.title, artworkEmoji: art.emoji, photos },
      expState: { phase: "gallery" },
    });
    setLocal(prev => ({ ...prev, phase: "gallery" }));
    setViewMode("player");
  }

  function revealResults() {
    const art = local.artworks[local.idx];
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
    const isLast = local.idx + 1 >= local.artworks.length;
    dispatch({
      type: "SET_EXPERIENCE", experience: "copyright_infringement", view: "copyright_results",
      viewData: { artworkTitle: art.title, artworkEmoji: art.emoji, winner: { guestId: winner.guestId }, entries },
      expState: { phase: "results" },
    });
    setLocal(prev => ({ ...prev, phase: isLast ? "final" : "results", scores: newScores }));
    setViewMode("player");
  }

  function nextRound() { pushViewing(local.artworks, local.idx + 1); setViewMode("player"); }

  function buildLbData(scores: Record<string, number>) {
    return [
      { guestId: MOCK_GUEST, score: scores[MOCK_GUEST] ?? 0, playerNum: 1, isMe: true },
      ...AI_PLAYERS.map((ai, i) => ({ guestId: ai.id, score: scores[ai.id] ?? 0, playerNum: i + 2, isMe: false, displayName: ai.name })),
    ].sort((a, b) => b.score - a.score);
  }

  function stopGame() {
    setLocal(IDLE); setViewMode("host");
    dispatch({ type: "SET_EXPERIENCE", experience: "copyright_infringement", view: "intermission" as any });
  }

  // Player view
  if (isLocal && viewMode === "player") {
    return (
      <View style={{ flex: 1, minHeight: 500 }}>
        {local.phase === "viewing"  && <ViewingView />}
        {local.phase === "drawing"  && <DrawingCanvas />}
        {local.phase === "gallery"  && <CopyGallery />}
        {(local.phase === "results" || local.phase === "final") && <CopyResults />}
      </View>
    );
  }

  // Host controls — active game
  if (isLocal) {
    const art = local.artworks[local.idx];
    return (
      <ScrollView contentContainerStyle={ls.container} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={["#1a0a0a","#3b0e0e"]} style={ls.header}>
          <View>
            <Text style={ls.headerLabel}>🎨  COPYRIGHT</Text>
            <Text style={ls.headerRound}>Round {local.idx + 1} / {local.artworks.length}</Text>
          </View>
          <TouchableOpacity style={ls.playerViewBtn} onPress={() => setViewMode("player")}>
            <Text style={ls.playerViewBtnText}>👁 Player View</Text>
          </TouchableOpacity>
        </LinearGradient>

        {art && (
          <View style={ls.card}>
            <Text style={ls.cardEmoji}>{art.emoji}</Text>
            <Text style={ls.cardTitle}>{art.title}</Text>
            <Text style={ls.cardArtist}>by {art.artist}</Text>
            <Text style={ls.cardSub}>{art.description}</Text>
          </View>
        )}

        {(local.phase === "results" || local.phase === "final") && (
          <View style={ls.lbMini}>
            <Text style={ls.lbTitle}>{local.phase === "final" ? "🏆 Final" : `🎨 After Round ${local.idx + 1}`}</Text>
            {buildLbData(local.scores).map((e, i) => (
              <View key={e.guestId} style={[ls.lbRow, e.isMe && ls.lbRowMe]}>
                <Text style={[ls.lbRank, i === 0 && { color: "#FFD700" }]}>#{i + 1}</Text>
                <Text style={[ls.lbName, e.isMe && { color: "#fca5a5" }]}>{e.isMe ? "You" : (e as any).displayName}</Text>
                <Text style={ls.lbScore}>{e.score} pts</Text>
              </View>
            ))}
          </View>
        )}

        <View style={ls.controls}>
          {local.phase === "viewing"  && <HostActionButton label="🖌️  Start Drawing"  onPress={startDrawing} />}
          {local.phase === "drawing"  && <HostActionButton label="🖼️  Open Gallery"   onPress={showGallery} />}
          {local.phase === "gallery"  && <HostActionButton label="🏆  Reveal Results" onPress={revealResults} />}
          {local.phase === "results"  && <HostActionButton label={`▶  Next Round (${local.idx + 2}/${local.artworks.length})`} onPress={nextRound} />}
          {local.phase === "final"    && <HostActionButton label="🔄  Play Again"     onPress={startGame} />}
          {(local.phase === "viewing" || local.phase === "drawing" || local.phase === "gallery") && (
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
        <LinearGradient colors={["#1a0a0a","#7f1d1d"]} style={s.launchBtn}>
          <Text style={s.launchEmoji}>🎨</Text>
          <View><Text style={s.launchLabel}>Start Copyright</Text><Text style={s.launchSub}>4 rounds · View art · Draw it · Vote · Offline</Text></View>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const ls = StyleSheet.create({
  container:   { gap: 14, paddingBottom: 20 },
  header:      { borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 },
  headerLabel: { color: "#fca5a5", fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 4 },
  headerRound: { color: "#fff", fontSize: 20, fontWeight: "900" },
  playerViewBtn:     { backgroundColor: "#1a0a0a", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "#7f1d1d44" },
  playerViewBtnText: { color: "#f87171", fontSize: 11, fontWeight: "700" },
  card:        { backgroundColor: "#111", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#222", alignItems: "center", gap: 6 },
  cardEmoji:   { fontSize: 44 },
  cardTitle:   { color: "#fff", fontSize: 18, fontWeight: "900" },
  cardArtist:  { color: "#ef4444", fontSize: 12, fontWeight: "700" },
  cardSub:     { color: "#888", fontSize: 12, lineHeight: 18, textAlign: "center" },
  lbMini:      { backgroundColor: "#111", borderRadius: 14, borderWidth: 1, borderColor: "#222", padding: 14, gap: 8 },
  lbTitle:     { color: "#fff", fontSize: 15, fontWeight: "900", marginBottom: 4 },
  lbRow:       { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#1a1a1a" },
  lbRowMe:     { backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 8, paddingHorizontal: 8 },
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
