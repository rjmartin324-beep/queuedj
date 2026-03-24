import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, Alert, ScrollView, Modal, KeyboardAvoidingView,
  Platform, Animated, Dimensions, ImageBackground, Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useLocalSearchParams } from "expo-router";
import { socketManager } from "../lib/socket";
import { useRoom } from "../contexts/RoomContext";
import { NamePromptModal } from "../components/shared/NamePromptModal";
import { OutfitType } from "../components/avatar/AvatarSVG";
import { Avatar3D } from "../components/avatar/Avatar3D";
import { BottomTabBar, Tab } from "../components/home/BottomTabBar";
import { GamesCarousel } from "../components/home/GamesCarousel";
import { DJCard } from "../components/home/DJCard";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

// ─── Background depth ─────────────────────────────────────────────────────────

const SW = Dimensions.get("window").width;

const STAR_COLORS = ["#ffffff", "#ffffff", "#ffffff", "#e9d5ff", "#f9a8d4", "#fde68a", "#bfdbfe", "#ffffff"];
const STARS = Array.from({ length: 70 }, (_, i) => ({
  top:     ((Math.sin(i * 23.7 + 1) + 1) / 2) * 800,
  left:    ((Math.cos(i * 17.3 + 2) + 1) / 2) * (SW - 4),
  size:    (i % 4) === 0 ? 2.5 : (i % 4) === 1 ? 1.8 : (i % 4) === 2 ? 1.2 : 1,
  opacity: 0.12 + (i % 6) * 0.06,
  color:   STAR_COLORS[i % STAR_COLORS.length],
}));

const NEBULAS = [
  { top: -60,  left: -80,  size: 280, color: "rgba(120,40,220,0.18)" },
  { top: 60,   right: -100, size: 220, color: "rgba(200,40,140,0.10)" },
  { top: 260,  left: -60,  size: 240, color: "rgba(60,20,180,0.12)" },
  { top: 420,  right: -80, size: 200, color: "rgba(140,20,200,0.08)" },
  { top: 600,  left: -40,  size: 260, color: "rgba(80,10,160,0.10)" },
];

// ─── Animated PartyGlue logo text ────────────────────────────────────────────
const PARTY_COLORS = ["#f0abfc","#e879f9","#c026d3","#a855f7","#818cf8","#f472b6","#fbbf24","#e879f9"];

function PartyGlueName() {
  const glow   = useRef(new Animated.Value(0)).current;
  const colorIdx = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1,   duration: 700,  useNativeDriver: false }),
        Animated.timing(glow, { toValue: 0.3, duration: 700,  useNativeDriver: false }),
      ])
    ).start();
  }, []);

  const glowColor = glow.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: ["#e879f9","#f0abfc","#fbbf24","#818cf8","#e879f9"],
  });
  const shadowRadius = glow.interpolate({ inputRange: [0,1], outputRange: [4, 18] });

  return (
    <Animated.Text style={{
      fontSize: 22, fontWeight: "900", letterSpacing: -0.3,
      color: glowColor,
      textShadowColor: "#e879f9",
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 12,
    }}>
      PartyGlue
    </Animated.Text>
  );
}

function NebulaBg() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {NEBULAS.map((n, i) => (
        <View key={i} style={{
          position: "absolute",
          top: n.top, left: (n as any).left, right: (n as any).right,
          width: n.size, height: n.size,
          borderRadius: n.size / 2,
          backgroundColor: n.color,
        }} />
      ))}
    </View>
  );
}

function StarField() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {STARS.map((s, i) => (
        <View key={i} style={{
          position: "absolute",
          top: s.top, left: s.left,
          width: s.size, height: s.size,
          borderRadius: s.size / 2,
          backgroundColor: s.color,
          opacity: s.opacity,
        }} />
      ))}
    </View>
  );
}

// ─── Festival theme assets ────────────────────────────────────────────────────

// ─── Premium Confetti ─────────────────────────────────────────────────────────

const SCR_H = Dimensions.get("window").height;

const CONFETTI_COLORS = [
  "#FFD700","#FF6B9D","#00E5FF","#AAFF3E",
  "#FF3CAC","#7B61FF","#2BD2FF","#FF9500",
  "#FF2D55","#30D158","#BF5AF2","#FFD60A",
  "#FF6FD8","#45F3FF","#FFE259","#A18CD1",
];

interface CPiece {
  startY: number; left: number; color: string;
  rot: number; w: number; h: number; radius: number;
  speed: number; delay: number; drift: number; opacity: number;
}

const CONFETTI_DATA: CPiece[] = Array.from({ length: 72 }, (_, i) => {
  const isRibbon = i % 5 <= 1;
  const isDot    = i % 11 === 10;
  const w = isDot ? 7 + (i % 3) * 2 : isRibbon ? 3 + (i % 2) : 7 + (i % 4) * 1.5;
  const h = isDot ? w                : isRibbon ? 16 + (i % 5) * 3 : 7 + (i % 4) * 1.5;
  return {
    startY:  -20 - ((i * 53) % 240),
    left:    ((Math.cos(i * 17.1 + 1.2) + 1) / 2) * (SW - 28) + 14,
    color:   CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    rot:     (i * 73) % 360,
    w, h,
    radius:  isDot ? w / 2 : 1.5,
    speed:   3200 + (i % 10) * 480,
    delay:   (i * 290) % 5800,
    drift:   (i % 2 === 0 ? 1 : -1) * (18 + (i % 6) * 10),
    opacity: 0.78 + (i % 5) * 0.044,
  };
});

function AnimatedConfetti({ piece }: { piece: CPiece }) {
  const prog = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    function fall() {
      prog.setValue(0);
      Animated.sequence([
        Animated.delay(piece.delay),
        Animated.timing(prog, { toValue: 1, duration: piece.speed, useNativeDriver: true }),
      ]).start(fall);
    }
    fall();
  }, []);

  const translateY = prog.interpolate({ inputRange: [0, 1], outputRange: [piece.startY, SCR_H + 60] });
  const translateX = prog.interpolate({ inputRange: [0, 0.35, 0.65, 1], outputRange: [0, piece.drift * 0.6, piece.drift, piece.drift * 0.8] });
  const rotate     = prog.interpolate({ inputRange: [0, 1], outputRange: [`${piece.rot}deg`, `${piece.rot + 420}deg`] });
  const opacity    = prog.interpolate({ inputRange: [0, 0.04, 0.78, 1], outputRange: [0, piece.opacity, piece.opacity, 0] });

  return (
    <Animated.View pointerEvents="none" style={{
      position: "absolute", top: 0, left: piece.left,
      width: piece.w, height: piece.h, borderRadius: piece.radius,
      backgroundColor: piece.color, opacity,
      transform: [{ translateY }, { translateX }, { rotate }],
    }} />
  );
}

function FestivalBg() {
  const screenH = Dimensions.get("window").height;
  return (
    <>
      {/* Background image */}
      <Image
        source={require("../../assets/festival-bg.jpg")}
        style={{
          position: "absolute", width: SW,
          height: screenH * 1.06, top: -screenH * 0.10, left: 0,
        }}
        resizeMode="cover"
      />

      {/* Vignette — subtle top+bottom darkening only */}
      <LinearGradient
        colors={["rgba(0,0,0,0.22)","rgba(0,0,0,0.0)","rgba(0,0,0,0.0)","rgba(4,0,14,0.60)"]}
        locations={[0, 0.12, 0.50, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Premium confetti */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {CONFETTI_DATA.map((c, i) => <AnimatedConfetti key={i} piece={c} />)}
      </View>
    </>
  );
}

// ─── Deep space layers ────────────────────────────────────────────────────────

const SH = Dimensions.get("window").height;

// Dense distant star field
const STARS_FAR = Array.from({ length: 180 }, (_, i) => ({
  top:  ((Math.sin(i * 13.7 + 0.3) + 1) / 2) * SH,
  left: ((Math.cos(i * 19.1 + 1.1) + 1) / 2) * SW,
  size: 0.6 + (i % 4) * 0.22,
  opacity: 0.14 + (i % 7) * 0.06,
  color: ["#ffffff","#e0d4ff","#c4b5fd","#bfdbfe","#fde68a","#f0abfc","#a5f3fc"][i % 7],
}));

// Mid-layer stars
const STARS_MID = Array.from({ length: 90 }, (_, i) => ({
  top:  ((Math.sin(i * 7.3 + 2.1) + 1) / 2) * SH,
  left: ((Math.cos(i * 11.7 + 0.8) + 1) / 2) * SW,
  size: 1.2 + (i % 4) * 0.5,
  opacity: 0.28 + (i % 5) * 0.11,
  color: ["#ffffff","#f0e6ff","#fde68a","#bae6fd","#c4b5fd","#fca5a5","#6ee7b7"][i % 7],
}));

// Twinkling bright stars
const TWINKLE_DATA = Array.from({ length: 24 }, (_, i) => ({
  top:      ((Math.sin(i * 31.2 + 1.5) + 1) / 2) * SH,
  left:     ((Math.cos(i * 23.4 + 2.3) + 1) / 2) * SW,
  size:     2.5 + (i % 5) * 1.1,
  baseOp:   0.55 + (i % 3) * 0.14,
  color:    ["#ffffff","#fde68a","#c4b5fd","#7dd3fc","#f0abfc","#a5f3fc","#fbbf24"][i % 7],
  duration: 700 + (i * 197) % 1300,
  delay:    (i * 389) % 3200,
}));

function TwinklingStar({ top, left, size, baseOp, color, duration, delay }: typeof TWINKLE_DATA[0]) {
  const op = useRef(new Animated.Value(baseOp)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(op, { toValue: 1,           duration,           useNativeDriver: true }),
        Animated.timing(op, { toValue: baseOp * 0.2, duration: duration * 1.1, useNativeDriver: true }),
        Animated.timing(op, { toValue: baseOp,      duration: duration * 0.7, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View pointerEvents="none" style={{
      position: "absolute", top, left,
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color, opacity: op,
      shadowColor: color, shadowOpacity: 1, shadowRadius: size * 3,
    }} />
  );
}

// Shooting star — supports colored tails
function ShootingStar({ delay, tailColor = "rgba(255,255,255,0.9)", angle = "20deg" }: {
  delay: number; tailColor?: string; angle?: string;
}) {
  const x  = useRef(new Animated.Value(0)).current;
  const op = useRef(new Animated.Value(0)).current;
  const startX = useRef(Math.random() * SW * 0.55).current;
  const startY = useRef(30 + Math.random() * SH * 0.38).current;

  useEffect(() => {
    function shoot() {
      x.setValue(0); op.setValue(0);
      Animated.sequence([
        Animated.delay(delay + Math.random() * 4000),
        Animated.parallel([
          Animated.timing(x,  { toValue: 1, duration: 650, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(op, { toValue: 1, duration: 70,  useNativeDriver: true }),
            Animated.timing(op, { toValue: 0, duration: 580, useNativeDriver: true }),
          ]),
        ]),
        Animated.delay(5500 + Math.random() * 9000),
      ]).start(shoot);
    }
    shoot();
  }, []);

  const translateX = x.interpolate({ inputRange: [0,1], outputRange: [0, 240] });
  const translateY = x.interpolate({ inputRange: [0,1], outputRange: [0, 90] });

  return (
    <Animated.View pointerEvents="none" style={{
      position: "absolute", top: startY, left: startX,
      opacity: op, transform: [{ translateX }, { translateY }, { rotate: angle }],
    }}>
      <View style={{ width: 90, height: 1.5, borderRadius: 1 }}>
        <LinearGradient
          colors={["transparent", tailColor]}
          start={{ x:0, y:0.5 }} end={{ x:1, y:0.5 }}
          style={{ flex: 1, borderRadius: 1 }}
        />
      </View>
      <View style={{
        position: "absolute", right: 0, top: -2.5,
        width: 6, height: 6, borderRadius: 3,
        backgroundColor: "#fff",
        shadowColor: tailColor, shadowOpacity: 1, shadowRadius: 8,
      }} />
    </Animated.View>
  );
}

function SpaceBg() {
  return (
    <>
      {/* Ultra-deep base — pitch black to rich indigo */}
      <LinearGradient
        colors={["#000003","#04000e","#080120","#0c0230","#060014","#000002"]}
        locations={[0, 0.15, 0.38, 0.62, 0.82, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Aurora ribbon at top */}
      <LinearGradient
        colors={["rgba(56,189,248,0.18)","rgba(124,58,237,0.22)","rgba(236,72,153,0.14)","transparent"]}
        start={{ x:0, y:0 }} end={{ x:1, y:0 }}
        style={{ position:"absolute", top:0, left:0, right:0, height:SH*0.18 }}
        pointerEvents="none"
      />

      {/* VIVID nebula clouds — layered for depth */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Electric violet — top left, large */}
        <View style={{ position:"absolute", top:-140, left:-100, width:420, height:420,
          borderRadius:210, backgroundColor:"rgba(109,40,217,0.52)" }} />
        {/* Hot magenta — top right */}
        <View style={{ position:"absolute", top:-60, right:-90, width:340, height:340,
          borderRadius:170, backgroundColor:"rgba(236,72,153,0.40)" }} />
        {/* Cosmic cyan — center-left band */}
        <View style={{ position:"absolute", top:SH*0.28, left:-60, width:360, height:260,
          borderRadius:180, backgroundColor:"rgba(6,182,212,0.38)" }} />
        {/* Royal blue — center */}
        <View style={{ position:"absolute", top:SH*0.18, left:SW*0.25, width:300, height:220,
          borderRadius:150, backgroundColor:"rgba(37,99,235,0.42)" }} />
        {/* Deep rose — bottom right */}
        <View style={{ position:"absolute", bottom:SH*0.05, right:-80, width:320, height:320,
          borderRadius:160, backgroundColor:"rgba(190,24,93,0.34)" }} />
        {/* Teal accent — bottom left */}
        <View style={{ position:"absolute", bottom:SH*0.15, left:-50, width:260, height:200,
          borderRadius:130, backgroundColor:"rgba(20,184,166,0.28)" }} />
        {/* Inner galactic core glow — upper center */}
        <View style={{ position:"absolute", top:SH*0.04, left:SW*0.22, width:240, height:160,
          borderRadius:120, backgroundColor:"rgba(253,230,138,0.10)" }} />
        <View style={{ position:"absolute", top:SH*0.08, left:SW*0.35, width:90, height:90,
          borderRadius:45, backgroundColor:"rgba(255,255,200,0.13)" }} />
      </View>

      {/* Dense distant star field */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {STARS_FAR.map((s, i) => (
          <View key={i} style={{ position:"absolute", top:s.top, left:s.left,
            width:s.size, height:s.size, borderRadius:s.size/2,
            backgroundColor:s.color, opacity:s.opacity }} />
        ))}
      </View>

      {/* Mid-layer stars */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {STARS_MID.map((s, i) => (
          <View key={i} style={{ position:"absolute", top:s.top, left:s.left,
            width:s.size, height:s.size, borderRadius:s.size/2,
            backgroundColor:s.color, opacity:s.opacity }} />
        ))}
      </View>

      {/* Twinkling bright stars */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {TWINKLE_DATA.map((s, i) => <TwinklingStar key={i} {...s} />)}
      </View>

      {/* Gas giant planet — bottom right, vivid violet */}
      <View pointerEvents="none" style={{
        position:"absolute", bottom:SH*0.15, right:-65,
        width:190, height:190, borderRadius:95,
        backgroundColor:"#12052e",
        borderWidth:1.5, borderColor:"rgba(167,139,250,0.55)",
        shadowColor:"#7c3aed", shadowOpacity:0.8, shadowRadius:50,
        overflow:"hidden",
      }}>
        <LinearGradient
          colors={["rgba(124,58,237,0.70)","rgba(109,40,217,0.35)","transparent"]}
          style={{ position:"absolute", top:0, left:0, right:0, height:65, borderRadius:95 }}
        />
        <View style={{ position:"absolute", top:42, left:0, right:0, height:18, backgroundColor:"rgba(139,92,246,0.38)" }} />
        <View style={{ position:"absolute", top:68, left:0, right:0, height:10, backgroundColor:"rgba(167,139,250,0.28)" }} />
        <View style={{ position:"absolute", top:88, left:0, right:0, height:24, backgroundColor:"rgba(124,58,237,0.32)" }} />
        <View style={{ position:"absolute", top:124, left:0, right:0, height:16, backgroundColor:"rgba(139,92,246,0.22)" }} />
        <LinearGradient
          colors={["transparent","rgba(196,167,255,0.45)"]}
          style={{ position:"absolute", bottom:0, left:0, right:0, height:55, borderRadius:95 }}
        />
      </View>

      {/* Small ice-blue moon — upper left area */}
      <View pointerEvents="none" style={{
        position:"absolute", top:SH*0.28, left:-28,
        width:72, height:72, borderRadius:36,
        backgroundColor:"#071428",
        borderWidth:1, borderColor:"rgba(56,189,248,0.50)",
        shadowColor:"#38bdf8", shadowOpacity:0.7, shadowRadius:20,
        overflow:"hidden",
      }}>
        <LinearGradient
          colors={["rgba(56,189,248,0.55)","transparent"]}
          style={{ position:"absolute", top:0, left:0, right:0, height:28, borderRadius:36 }}
        />
        <View style={{ position:"absolute", top:18, left:0, right:0, height:7, backgroundColor:"rgba(56,189,248,0.22)" }} />
        <LinearGradient
          colors={["transparent","rgba(56,189,248,0.35)"]}
          style={{ position:"absolute", bottom:0, left:0, right:0, height:20, borderRadius:36 }}
        />
      </View>

      {/* Shooting stars — varied colors */}
      <ShootingStar delay={600}   tailColor="rgba(255,255,255,0.95)"    angle="18deg" />
      <ShootingStar delay={3200}  tailColor="rgba(196,167,255,0.90)"    angle="22deg" />
      <ShootingStar delay={6800}  tailColor="rgba(56,189,248,0.90)"     angle="15deg" />
      <ShootingStar delay={11000} tailColor="rgba(249,168,212,0.85)"    angle="25deg" />
      <ShootingStar delay={15500} tailColor="rgba(255,255,255,0.95)"    angle="20deg" />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Home Screen — PartyGlue
//
// Layout (Home tab):
//   ┌──────────────────────────────┐
//   │ PartyGlue logo / greeting    │
//   │ Avatar (large, Fall Guys)    │
//   │ Welcome card (dismissable)   │
//   │ DJ Card                      │
//   │ Games Carousel               │
//   └──────────────────────────────┘
//   [ Home | Avatar | START ROOM | Social | Account ]
// ─────────────────────────────────────────────────────────────────────────────

const BODY_COLORS   = ["#38bdf8", "#f472b6", "#4ade80", "#fb923c", "#a78bfa"];
const HP_COLORS     = ["#f97316", "#22d3ee", "#f59e0b", "#e879f9", "#34d399"];
const OUTFIT_COLORS = ["#7c3aed", "#db2777", "#0891b2", "#b45309", "#065f46"];
const EXPRESSIONS   = ["happy", "cool", "party"] as const;

const OUTFITS: { id: OutfitType; emoji: string; label: string }[] = [
  { id: "default",   emoji: "👕", label: "Default"   },
  { id: "knight",    emoji: "⚔️",  label: "Knight"    },
  { id: "astronaut", emoji: "🚀", label: "Astro"     },
  { id: "pirate",    emoji: "☠️",  label: "Pirate"    },
  { id: "ninja",     emoji: "🥷", label: "Ninja"     },
  { id: "wizard",    emoji: "🧙", label: "Wizard"    },
  { id: "dino",      emoji: "🦕", label: "Dino"      },
  { id: "angel",     emoji: "😇", label: "Angel"     },
  { id: "devil",     emoji: "😈", label: "Devil"     },
  { id: "robot",     emoji: "🤖", label: "Robot"     },
];

type PendingAction = { type: "create" } | { type: "join"; code: string } | null;

export default function HomeScreen() {
  const router = useRouter();
  const { dispatch } = useRoom();
  const params = useLocalSearchParams<{ code?: string }>();

  const [activeTab, setActiveTab]     = useState<Tab>("home");
  const [roomCode, setRoomCode]       = useState(params.code ?? "");
  const [loading, setLoading]         = useState(false);
  const [pendingAction, setPending]   = useState<PendingAction>(null);
  const [joinModalVisible, setJoinModal] = useState(false);

  // ─── Lifted avatar state ─────────────────────────────────────────────────
  const [bodyIdx, setBodyIdx]               = useState(0);
  const [hpIdx, setHpIdx]                   = useState(0);
  const [outfitColorIdx, setOutfitColorIdx] = useState(0);
  const [outfitId, setOutfitId]             = useState<OutfitType>("default");
  const [exprIdx, setExprIdx]               = useState(0);
  const [welcomeDismissed, setWelcomeDismissed] = useState(true);
  const [theme, setTheme] = useState<"festival" | "space">("festival");

  // ─── Name confirmed → execute the pending action ─────────────────────────
  async function onNameConfirmed(name: string) {
    await socketManager.saveDisplayName(name);
    setPending(null);
    if (pendingAction?.type === "create") await doCreateRoom(name);
    if (pendingAction?.type === "join")   await doJoinRoom(pendingAction.code, name);
  }

  // ─── Create Room (Host) ───────────────────────────────────────────────────
  async function handleStartRoom() {
    const saved = await socketManager.getDisplayName();
    if (!saved) { setPending({ type: "create" }); return; }
    await doCreateRoom(saved);
  }

  async function doCreateRoom(displayName: string) {
    setLoading(true);
    try {
      const guestId = await socketManager.getOrCreateGuestId();
      const res = await fetch(`${API_URL}/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostGuestId: guestId, name: "My Party", vibePreset: "open" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      dispatch({ type: "SET_ROOM", room: data.room });
      dispatch({ type: "SET_GUEST_ID", guestId, role: "HOST" });

      await socketManager.connect(guestId, displayName);
      await socketManager.joinRoom(data.room.id);

      router.push(`/host/${data.room.id}`);
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not create room");
    } finally {
      setLoading(false);
    }
  }

  // ─── Join Room (Guest) ────────────────────────────────────────────────────
  async function handleJoinRoom() {
    const code = roomCode.trim();
    if (code.length < 4) { Alert.alert("Enter the 4-digit room code"); return; }
    const saved = await socketManager.getDisplayName();
    if (!saved) { setPending({ type: "join", code }); return; }
    setJoinModal(false);
    await doJoinRoom(code, saved);
  }

  async function doJoinRoom(code: string, displayName: string) {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/rooms/${code.toUpperCase()}`);
      const data = await res.json();
      if (!res.ok) throw new Error("Room not found");

      const guestId = socketManager.generateSessionGuestId();
      await socketManager.connect(guestId, displayName);
      const ack = await socketManager.joinRoom(data.id);

      if (!ack.success) throw new Error(ack.error ?? "Could not join room");

      dispatch({ type: "SET_ROOM", room: { ...data, sequenceId: ack.currentSequenceId } as any });
      dispatch({ type: "SET_GUEST_ID", guestId, role: ack.role });

      router.push(`/guest/${data.id}`);
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not join room");
    } finally {
      setLoading(false);
    }
  }

  // ─── Tab content ─────────────────────────────────────────────────────────
  function renderTabContent() {
    switch (activeTab) {
      case "home":
        return (
          <HomeTab
            onStartRoom={handleStartRoom}
            onJoinRoom={() => setJoinModal(true)}
            loading={loading}
            bodyColor={BODY_COLORS[bodyIdx]}
            hpColor={HP_COLORS[hpIdx]}
            outfitColor={OUTFIT_COLORS[outfitColorIdx]}
            outfitId={outfitId}
            expression={EXPRESSIONS[exprIdx]}
            welcomeDismissed={welcomeDismissed}
            onDismissWelcome={() => setWelcomeDismissed(true)}
            theme={theme}
            onToggleTheme={() => setTheme(t => t === "festival" ? "space" : "festival")}
          />
        );
      case "avatar":
        return (
          <AvatarTab
            bodyIdx={bodyIdx}
            setBodyIdx={setBodyIdx}
            hpIdx={hpIdx}
            setHpIdx={setHpIdx}
            outfitColorIdx={outfitColorIdx}
            setOutfitColorIdx={setOutfitColorIdx}
            outfitId={outfitId}
            setOutfitId={setOutfitId}
            exprIdx={exprIdx}
            setExprIdx={setExprIdx}
          />
        );
      case "social":
        return <PlaceholderTab icon="🏆" label="Social" sub="Leaderboards & friends coming soon" />;
      case "account":
        return <PlaceholderTab icon="⚙️" label="Account" sub="Profile settings coming soon" />;
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      {theme === "festival" ? <FestivalBg /> : <SpaceBg />}
      <NamePromptModal visible={pendingAction !== null} onConfirm={onNameConfirmed} />

      {/* Join Room Modal */}
      <Modal visible={joinModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOuter}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Join a Room</Text>
            <Text style={styles.modalSub}>Ask the host for the 4-letter code</Text>
            <TextInput
              style={styles.codeInput}
              placeholder="Room code (e.g. TRAP)"
              placeholderTextColor="#555"
              value={roomCode}
              onChangeText={(t) => setRoomCode(t.toUpperCase())}
              maxLength={4}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
            />
            <View style={styles.modalRow}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSecondary]}
                onPress={() => { setJoinModal(false); setRoomCode(""); }}
              >
                <Text style={styles.modalBtnTextSecondary}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary, !roomCode && styles.btnDisabled]}
                onPress={handleJoinRoom}
                disabled={!roomCode || loading}
              >
                <Text style={styles.modalBtnTextPrimary}>
                  {loading ? "Joining..." : "Join"}
                </Text>
              </TouchableOpacity>
            </View>
            {/* QR scan shortcut */}
            <TouchableOpacity
              style={styles.qrRow}
              onPress={() => { setJoinModal(false); router.push("/scan"); }}
            >
              <Text style={styles.qrText}>📷  Scan QR Code instead</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Main content */}
      <View style={styles.content}>
        {renderTabContent()}
      </View>

      {/* Bottom tab bar */}
      <BottomTabBar
        active={activeTab}
        onChange={setActiveTab}
        onStartRoom={handleStartRoom}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Home Tab
// ─────────────────────────────────────────────────────────────────────────────

function HomeTab({
  onStartRoom,
  onJoinRoom,
  loading,
  bodyColor,
  hpColor,
  outfitColor,
  outfitId,
  expression,
  welcomeDismissed,
  onDismissWelcome,
  theme,
  onToggleTheme,
}: {
  onStartRoom: () => void;
  onJoinRoom: () => void;
  loading: boolean;
  bodyColor: string;
  hpColor: string;
  outfitColor: string;
  outfitId: OutfitType;
  expression: "happy" | "cool" | "party";
  welcomeDismissed: boolean;
  onDismissWelcome: () => void;
  theme: "festival" | "space";
  onToggleTheme: () => void;
}) {
  const [howItWorksVisible, setHowItWorksVisible] = useState(false);
  const avatarSize = Math.min(Dimensions.get("window").width * 0.62, 300);

  return (
    <ScrollView
      style={{ flex: 1 }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.homeScroll}
    >
      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <View style={styles.topBar}>
        {/* Logo + brand left */}
        <View style={styles.brandRow}>
          <View style={styles.logoWrap}>
            <Image
              source={require("../../assets/logo.png")}
              style={styles.logoImg}
              resizeMode="cover"
            />
          </View>
          <View>
            <PartyGlueName />
            <Text style={styles.brandTagline}>Party games + Auto DJ</Text>
          </View>
        </View>

        {/* Join Room + theme toggle stacked right */}
        <View style={styles.topRight}>
          <TouchableOpacity onPress={onJoinRoom} style={styles.joinChip}>
            <Text style={styles.joinChipText}>Join Room</Text>
          </TouchableOpacity>
          <View style={styles.themePicker}>
            <TouchableOpacity
              style={[styles.themeChip, theme === "festival" && styles.themeChipOn]}
              onPress={onToggleTheme}
            >
              <Text style={styles.themeChipIcon}>🎪</Text>
              <Text style={[styles.themeChipLabel, theme === "festival" && styles.themeChipLabelOn]}>Festival</Text>
            </TouchableOpacity>
            <View style={styles.themeChipDivider} />
            <TouchableOpacity
              style={[styles.themeChip, theme === "space" && styles.themeChipOn]}
              onPress={onToggleTheme}
            >
              <Text style={styles.themeChipIcon}>🌌</Text>
              <Text style={[styles.themeChipLabel, theme === "space" && styles.themeChipLabelOn]}>Space</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Avatar hero ──────────────────────────────────────────────── */}
      <View style={styles.avatarHero}>
        {/* Stage platform rings — reinforce the background rings at foot level */}
        <View style={styles.stageWrap} pointerEvents="none">
          {[
            { w: SW * 1.1, h: 70,  color: "#7c1fa2", opacity: 0.22 },
            { w: SW * 0.85, h: 54, color: "#a021c9", opacity: 0.30 },
            { w: SW * 0.65, h: 40, color: "#c026d3", opacity: 0.38 },
            { w: SW * 0.46, h: 28, color: "#d946ef", opacity: 0.50 },
            { w: SW * 0.28, h: 18, color: "#f0abfc", opacity: 0.70 },
            { w: SW * 0.14, h: 10, color: "#fff",    opacity: 0.55 },
          ].map((r, i) => (
            <View key={i} style={{
              position: "absolute",
              width: r.w, height: r.h,
              borderRadius: r.h / 2,
              backgroundColor: r.color,
              opacity: r.opacity,
            }} />
          ))}
        </View>
        <Avatar3D
          size={avatarSize}
          bodyColor={bodyColor}
          headphoneColor={hpColor}
          outfitColor={outfitColor}
          expression={expression}
          outfit={outfitId}
        />
        <View style={styles.heroPill}>
          <Text style={styles.heroPillText}>Player  ·  Lv 1</Text>
        </View>
      </View>

      {/* ── Welcome / how it works ───────────────────────────────────── */}
      {!welcomeDismissed && (
        <View style={styles.welcomeCard}>
          {/* X dismiss button */}
          <TouchableOpacity style={styles.welcomeDismiss} onPress={onDismissWelcome} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Text style={styles.welcomeDismissText}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.welcomeTitle}>Welcome to PartyGlue 🎉</Text>
          <Text style={styles.welcomeText}>
            Hit <Text style={styles.welcomeHighlight}>Start Room</Text> to host a party — play DJ, run trivia, drawing games and more. Friends join by scanning your QR code or typing the room code.
          </Text>

          <TouchableOpacity onPress={() => setHowItWorksVisible(true)} style={styles.howItWorksBtn}>
            <Text style={styles.howItWorksBtnText}>How it works →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── How It Works Modal ───────────────────────────────────────── */}
      <Modal visible={howItWorksVisible} transparent animationType="fade">
        <View style={styles.howModalOverlay}>
          <View style={styles.howModalSheet}>
            <TouchableOpacity style={styles.howModalClose} onPress={() => setHowItWorksVisible(false)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <Text style={styles.howModalCloseText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.howModalTitle}>How it works</Text>
            <View style={styles.howStep}>
              <Text style={styles.howStepEmoji}>🎛️</Text>
              <Text style={styles.howStepText}>Hit <Text style={styles.howStepBold}>Start Room</Text> (bottom center button) to host a party</Text>
            </View>
            <View style={styles.howStep}>
              <Text style={styles.howStepEmoji}>📱</Text>
              <Text style={styles.howStepText}>Friends scan the QR code or type the room code to join</Text>
            </View>
            <View style={styles.howStep}>
              <Text style={styles.howStepEmoji}>🎮</Text>
              <Text style={styles.howStepText}>Switch between DJ mode, trivia, drawing games and more — all from one screen</Text>
            </View>
            <View style={styles.howStep}>
              <Text style={styles.howStepEmoji}>🏆</Text>
              <Text style={styles.howStepText}>Everyone plays on their own phone — no extra app needed</Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Live Now ─────────────────────────────────────────────────── */}
      <LiveNowSection onJoinRoom={onJoinRoom} />

      {/* ── DJ Card ──────────────────────────────────────────────────── */}
      <DJCard onPress={onStartRoom} />

      {/* ── Games Carousel ───────────────────────────────────────────── */}
      <GamesCarousel onSelectGame={(_gameId) => handleStartRoom()} />

      {/* ── Recently Played ──────────────────────────────────────────── */}
      <RecentlyPlayedSection />

      {/* Bottom padding */}
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Live Now Section
// ─────────────────────────────────────────────────────────────────────────────

function LiveNowSection({ onJoinRoom }: { onJoinRoom: () => void }) {
  return (
    <View style={styles.liveSection}>
      <View style={styles.liveSectionHeader}>
        <View style={styles.liveHeaderLeft}>
          <View style={styles.liveDot} />
          <Text style={styles.liveSectionTitle}>LIVE NOW</Text>
        </View>
      </View>

      <View style={styles.liveCard}>
        <Text style={styles.liveEmptyIcon}>🎉</Text>
        <Text style={styles.liveCardTitle}>No Active Party</Text>
        <Text style={styles.liveCardSub}>Start a room to kick off the party, or join one with a room code.</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Recently Played Section
// ─────────────────────────────────────────────────────────────────────────────

const RECENT_GAMES = [
  { id: "trivia",   title: "Trivia",   lastPlayed: "Yesterday",  players: 8, accent: "#3b82f6", image: require("../../assets/trivia.jpg") },
  { id: "drawback", title: "Drawback", lastPlayed: "2 days ago", players: 6, accent: "#ec4899", image: require("../../assets/drawback.jpg") },
];

function RecentlyPlayedSection() {
  return (
    <View style={styles.recentSection}>
      <Text style={styles.recentSectionTitle}>Recently Played</Text>
      {RECENT_GAMES.map((game) => (
        <TouchableOpacity key={game.id} style={[styles.recentRow, { borderColor: game.accent + "44" }]} activeOpacity={0.8}>
          <View style={styles.recentThumb}>
            <Image source={game.image} style={styles.recentThumbImg} resizeMode="cover" />
          </View>
          <View style={styles.recentInfo}>
            <Text style={styles.recentGameName}>{game.title}</Text>
            <Text style={styles.recentMeta}>{game.lastPlayed} · {game.players} players</Text>
          </View>
          <Text style={styles.recentArrow}>›</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Avatar Tab
// ─────────────────────────────────────────────────────────────────────────────

function AvatarTab({
  bodyIdx, setBodyIdx,
  hpIdx, setHpIdx,
  outfitColorIdx, setOutfitColorIdx,
  outfitId, setOutfitId,
  exprIdx, setExprIdx,
}: {
  bodyIdx: number;
  setBodyIdx: (i: number) => void;
  hpIdx: number;
  setHpIdx: (i: number) => void;
  outfitColorIdx: number;
  setOutfitColorIdx: (i: number) => void;
  outfitId: OutfitType;
  setOutfitId: (o: OutfitType) => void;
  exprIdx: number;
  setExprIdx: (i: number) => void;
}) {
  const avatarSize = Math.min(Dimensions.get("window").width * 0.7, 340);

  return (
    <ScrollView contentContainerStyle={styles.avatarTabScroll}>
      <Text style={styles.tabPageTitle}>My Avatar</Text>

      <View style={styles.avatarTabStage}>
        <View style={styles.avatarTabGlow} />
        <Avatar3D
          size={avatarSize}
          bodyColor={BODY_COLORS[bodyIdx]}
          headphoneColor={HP_COLORS[hpIdx]}
          outfitColor={OUTFIT_COLORS[outfitColorIdx]}
          expression={EXPRESSIONS[exprIdx]}
          outfit={outfitId}
        />
      </View>

      <View style={styles.customizerCard}>

        {/* ── Outfits row ── */}
        <Text style={styles.custLabel}>Outfit</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.outfitsScroll}
          contentContainerStyle={styles.outfitsScrollContent}
        >
          {OUTFITS.map((o) => (
            <TouchableOpacity
              key={o.id}
              style={[styles.outfitCard, outfitId === o.id && styles.outfitCardActive]}
              onPress={() => setOutfitId(o.id)}
            >
              <Text style={styles.outfitCardEmoji}>{o.emoji}</Text>
              <Text style={styles.outfitCardLabel}>{o.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Color pickers ── */}
        <CustomizerRow
          label="Body Color"
          colors={BODY_COLORS}
          selectedIdx={bodyIdx}
          onSelect={(i) => setBodyIdx(i)}
        />
        <CustomizerRow
          label="Headphones"
          colors={HP_COLORS}
          selectedIdx={hpIdx}
          onSelect={(i) => setHpIdx(i)}
        />
        <CustomizerRow
          label="Outfit Color"
          colors={OUTFIT_COLORS}
          selectedIdx={outfitColorIdx}
          onSelect={(i) => setOutfitColorIdx(i)}
        />

        {/* Expression picker */}
        <Text style={styles.custLabel}>Expression</Text>
        <View style={styles.exprRow}>
          {EXPRESSIONS.map((e, i) => (
            <TouchableOpacity
              key={e}
              style={[styles.exprBtn, exprIdx === i && styles.exprBtnActive]}
              onPress={() => setExprIdx(i)}
            >
              <Text style={styles.exprBtnText}>{e === "happy" ? "😄" : e === "cool" ? "😎" : "🥳"}</Text>
              <Text style={styles.exprBtnLabel}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function CustomizerRow({
  label, colors, selectedIdx, onSelect,
}: {
  label: string;
  colors: string[];
  selectedIdx: number;
  onSelect: (i: number) => void;
}) {
  return (
    <>
      <Text style={styles.custLabel}>{label}</Text>
      <View style={styles.colorRow}>
        {colors.map((c, i) => (
          <TouchableOpacity
            key={c}
            style={[styles.colorSwatch, { backgroundColor: c }, selectedIdx === i && styles.colorSwatchActive]}
            onPress={() => onSelect(i)}
          />
        ))}
      </View>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Placeholder Tab
// ─────────────────────────────────────────────────────────────────────────────

function PlaceholderTab({ icon, label, sub }: { icon: string; label: string; sub: string }) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderIcon}>{icon}</Text>
      <Text style={styles.placeholderLabel}>{label}</Text>
      <Text style={styles.placeholderSub}>{sub}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: "#0d0818" },
  content: { flex: 1 },

  // Home tab scroll
  homeScroll: { paddingTop: 8, backgroundColor: "transparent" },

  // Top bar
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 8,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoWrap: {
    width: 46, height: 46,
    borderRadius: 23,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(192,132,252,0.5)",
  },
  logoImg: {
    width: 60, height: 60,
    marginTop: -4, marginLeft: -4,
  },
  brandName:    { color: "#fff", fontSize: 22, fontWeight: "900", letterSpacing: -0.3 },
  brandTagline: { color: "rgba(255,255,255,0.55)", fontSize: 11, marginTop: 1, fontWeight: "600", letterSpacing: 0.3 },
  topRight: {
    alignItems: "flex-end",
    gap: 6,
  },
  joinChip: {
    backgroundColor: "rgba(124,58,237,0.55)",
    borderWidth: 1.5,
    borderColor: "rgba(192,132,252,0.85)",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 9,
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  joinChipText: { color: "#fff", fontSize: 13, fontWeight: "800" },

  // Avatar hero
  avatarHero: {
    alignItems: "center",
    paddingTop: 0,
    paddingBottom: 0,
    position: "relative",
    marginTop: 20,
  },
  stageWrap: {
    position: "absolute",
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    width: SW,
    height: 80,
  },
  heroPill: {
    marginTop: 8,
    backgroundColor: "#1a1a2e",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#2d2d4e",
  },
  heroPillText: { color: "#a5b4fc", fontSize: 13, fontWeight: "600" },

  // Welcome card
  welcomeCard: {
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: "#111",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1e1e1e",
  },
  welcomeDismiss: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 1,
    padding: 4,
  },
  welcomeDismissText: { color: "#555", fontSize: 14, fontWeight: "700" },
  welcomeTitle:     { color: "#fff", fontSize: 15, fontWeight: "800", marginBottom: 6, paddingRight: 24 },
  welcomeText:      { color: "#777", fontSize: 13, lineHeight: 19, marginBottom: 12 },
  welcomeHighlight: { color: "#a855f7", fontWeight: "700" },
  howItWorksBtn:    { alignSelf: "flex-start" },
  howItWorksBtnText: { color: "#7c3aed", fontSize: 13, fontWeight: "700" },

  // How It Works modal
  howModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  howModalSheet: {
    backgroundColor: "#111",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  howModalClose: {
    position: "absolute",
    top: 16,
    right: 16,
    padding: 4,
  },
  howModalCloseText: { color: "#555", fontSize: 16, fontWeight: "700" },
  howModalTitle: { color: "#fff", fontSize: 20, fontWeight: "800", marginBottom: 20, paddingRight: 24 },
  howStep: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
    gap: 12,
  },
  howStepEmoji: { fontSize: 24, lineHeight: 30 },
  howStepText:  { color: "#aaa", fontSize: 14, lineHeight: 20, flex: 1 },
  howStepBold:  { color: "#fff", fontWeight: "700" },

  // Join modal
  modalOuter: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.7)" },
  modalSheet: {
    backgroundColor: "#111",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    borderTopWidth: 1,
    borderColor: "#2a2a2a",
  },
  modalTitle: { color: "#fff", fontSize: 22, fontWeight: "800", marginBottom: 4 },
  modalSub:   { color: "#555", fontSize: 13, marginBottom: 24 },
  codeInput: {
    backgroundColor: "#1a1a1a",
    color: "#fff",
    borderRadius: 14,
    padding: 18,
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 10,
    borderWidth: 1,
    borderColor: "#333",
    marginBottom: 16,
  },
  modalRow: { flexDirection: "row", gap: 12 },
  modalBtn: { flex: 1, borderRadius: 14, padding: 16, alignItems: "center" },
  modalBtnPrimary:   { backgroundColor: "#7c3aed" },
  modalBtnSecondary: { backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "#333" },
  modalBtnTextPrimary:   { color: "#fff", fontWeight: "700", fontSize: 16 },
  modalBtnTextSecondary: { color: "#888", fontWeight: "700", fontSize: 16 },
  btnDisabled: { opacity: 0.4 },
  qrRow: { alignItems: "center", marginTop: 20 },
  qrText: { color: "#555", fontSize: 14 },

  // Avatar tab
  avatarTabScroll: { padding: 20, alignItems: "center" },
  tabPageTitle: { color: "#fff", fontSize: 22, fontWeight: "800", marginBottom: 20, alignSelf: "flex-start" },
  avatarTabStage: { alignItems: "center", marginBottom: 24, position: "relative" },
  avatarTabGlow: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(124,58,237,0.2)",
    top: 20,
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
  },

  // Outfits
  outfitsScroll: { marginBottom: 8 },
  outfitsScrollContent: { gap: 10, paddingBottom: 4 },
  outfitCard: {
    width: 80,
    height: 90,
    borderRadius: 14,
    backgroundColor: "#1a1a1a",
    borderWidth: 1.5,
    borderColor: "#2a2a2a",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  outfitCardActive: {
    borderColor: "#7c3aed",
    backgroundColor: "#1e1b2e",
  },
  outfitCardEmoji: { fontSize: 28 },
  outfitCardLabel: { color: "#888", fontSize: 10, fontWeight: "600" },

  customizerCard: {
    width: "100%",
    backgroundColor: "#111",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#1e1e1e",
    gap: 4,
  },
  custLabel: { color: "#888", fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8, marginTop: 8 },
  colorRow: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginBottom: 4 },
  colorSwatch: { width: 32, height: 32, borderRadius: 16 },
  colorSwatchActive: { borderWidth: 3, borderColor: "#fff" },
  exprRow: { flexDirection: "row", gap: 12 },
  exprBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#2a2a2a",
    gap: 4,
  },
  exprBtnActive: { borderColor: "#7c3aed", backgroundColor: "#1e1b2e" },
  exprBtnText:  { fontSize: 22 },
  exprBtnLabel: { color: "#888", fontSize: 10, fontWeight: "600", textTransform: "capitalize" },

  // Placeholder
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 12 },
  placeholderIcon:  { fontSize: 56 },
  placeholderLabel: { color: "#fff", fontSize: 22, fontWeight: "800" },
  placeholderSub:   { color: "#555", fontSize: 14, textAlign: "center" },

  // Live Now section
  liveSection: { paddingHorizontal: 20, marginTop: 4, marginBottom: 4 },
  liveSectionHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 10,
  },
  liveHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  liveDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: "#ef4444",
    shadowColor: "#ef4444", shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 4,
  },
  liveSectionTitle: { color: "#fff", fontSize: 15, fontWeight: "800", letterSpacing: 0.8 },
  liveArrow: { color: "#a855f7", fontSize: 13, fontWeight: "600" },
  liveCard: {
    backgroundColor: "rgba(15,10,35,0.75)",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.25)",
    alignItems: "center",
    gap: 8,
  },
  liveEmptyIcon: { fontSize: 36, marginBottom: 2 },
  liveCardTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },
  liveCardSub:   { color: "#6b7280", fontSize: 12, textAlign: "center", lineHeight: 18 },
  joinBtn: {
    backgroundColor: "rgba(124,58,237,0.30)",
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.55)",
    borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10,
    marginTop: 4,
  },
  joinBtnText: { color: "#e9d5ff", fontSize: 13, fontWeight: "800" },

  // Theme picker
  themePicker: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(20,5,45,0.72)",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "rgba(168,85,247,0.50)",
    padding: 3,
  },
  themeChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 13,
  },
  themeChipOn: {
    backgroundColor: "rgba(168,85,247,0.55)",
    borderRadius: 13,
  },
  themeChipIcon:  { fontSize: 12 },
  themeChipLabel: { color: "rgba(255,255,255,0.60)", fontSize: 10, fontWeight: "700" },
  themeChipLabelOn: { color: "#fff", fontWeight: "800" },
  themeChipDivider: { width: 1, height: 18, backgroundColor: "rgba(255,255,255,0.12)" },

  // Recently Played
  recentSection: { paddingHorizontal: 20, marginTop: 20 },
  recentSectionTitle: {
    color: "#fff", fontSize: 18, fontWeight: "800", marginBottom: 12,
  },
  recentRow: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "rgba(10,5,25,0.50)",
    borderRadius: 14, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: "rgba(168,85,247,0.18)",
  },
  recentThumb: {
    width: 52, height: 52, borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4, shadowRadius: 6, elevation: 4,
  },
  recentThumbImg: { width: 52, height: 52 },
  recentInfo:    { flex: 1 },
  recentGameName:{ color: "#fff", fontSize: 14, fontWeight: "700" },
  recentMeta:    { color: "#6b7280", fontSize: 12, marginTop: 2 },
  recentArrow:   { color: "#4a5568", fontSize: 22 },
});
