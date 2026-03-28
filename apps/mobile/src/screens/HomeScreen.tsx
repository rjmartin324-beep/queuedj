import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, Alert, ScrollView, Modal, KeyboardAvoidingView,
  Platform, Animated, Dimensions, ImageBackground, Image, Easing, AppState, BackHandler,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useLocalSearchParams } from "expo-router";
import type { Room } from "@queuedj/shared-types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { socketManager } from "../lib/socket";
import { storage } from "../lib/storage";
import { useRoom } from "../contexts/RoomContext";
import { useTheme } from "../contexts/ThemeContext";
import { NamePromptModal } from "../components/shared/NamePromptModal";
import { AvatarSVG, OutfitType } from "../components/avatar/AvatarSVG";
import { Avatar3D } from "../components/avatar/Avatar3D";
import { BottomTabBar, Tab } from "../components/home/BottomTabBar";
import { GamesCarousel } from "../components/home/GamesCarousel";
import { DJCard } from "../components/home/DJCard";
import { VibeCreditsBar }   from "../components/shared/VibeCreditsBar";
import { ThemeToggle }      from "../components/shared/ThemeToggle";
import { SettingsScreen }   from "./SettingsScreen";
import { HostLeaderboard }  from "../components/shared/HostLeaderboard";
import { WardrobeShop }     from "../components/avatar/WardrobeShop";
import { RoomHistory }         from "../components/host/RoomHistory";
import { AchievementsSection } from "../components/home/AchievementsSection";
import { FriendsSection }      from "../components/home/FriendsSection";
import { SongOfTheDayCard }    from "../components/home/SongOfTheDayCard";
import { StreakBadge }         from "../components/home/StreakBadge";
import { WeeklyTasteReport }   from "../components/home/WeeklyTasteReport";
import { ActivityFeed }        from "../components/home/ActivityFeed";
import { recordActivity }      from "../lib/streak";
import { computeXP, XPInfo }  from "../lib/xp";
import { LavaLampBg }          from "../components/shared/LavaLampBg";
import { SpotifyConnectButton } from "../components/shared/SpotifyConnectButton";
import { PublicRoomsSheet }    from "../components/home/PublicRoomsSheet";

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

// ─── Brand wordmark ───────────────────────────────────────────────────────────
function QueueDJName() {
  return (
    <Text style={{ fontSize: 21, fontWeight: "900", letterSpacing: -0.5, lineHeight: 24 }}>
      <Text style={{ color: "#ffffff" }}>Party</Text>
      <Text style={{ color: "#a78bfa" }}>Glue</Text>
    </Text>
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
  const prog    = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    function fall() {
      prog.setValue(0);
      animRef.current = Animated.sequence([
        Animated.delay(piece.delay),
        Animated.timing(prog, { toValue: 1, duration: piece.speed, useNativeDriver: true }),
      ]);
      animRef.current.start(fall);
    }
    fall();

    const sub = AppState.addEventListener("change", s => {
      if (s !== "active") animRef.current?.stop();
      else fall();
    });
    return () => { animRef.current?.stop(); sub.remove(); };
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

// ─── Lava Lamp ────────────────────────────────────────────────────────────────
const LAMP_H = Dimensions.get("window").height;
const LAMP_W = SW;

const WAX_COLOR    = "#b5179e";
const FLUID_COLOR  = "#03001c";
const POOL_SURFACE = LAMP_H * 0.90;

// ── Wave segment — wide flat ellipse that independently bobs ──────────────────
const WAVE_SEGS = 13;
const SEG_W = (LAMP_W / WAVE_SEGS) * 1.7;

function WaveSeg({ index }: { index: number }) {
  const ty      = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);
  useEffect(() => {
    const amp = 3 + (index * 7) % 8;
    const dur = 1500 + (index * 313) % 900;
    const del = (index * 197) % 1600;
    function startLoop() {
      loopRef.current = Animated.loop(
        Animated.sequence([
          Animated.delay(del),
          Animated.timing(ty, { toValue: -amp,        duration: dur, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
          Animated.timing(ty, { toValue:  amp * 0.35,  duration: dur, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        ])
      );
      loopRef.current.start();
    }
    startLoop();
    const sub = AppState.addEventListener("change", s => {
      if (s !== "active") loopRef.current?.stop();
      else startLoop();
    });
    return () => { loopRef.current?.stop(); sub.remove(); };
  }, []);

  const segH = SEG_W * 0.30;  // very flat — width >> height
  const x    = (index / (WAVE_SEGS - 1)) * LAMP_W - SEG_W * 0.28;
  return (
    <Animated.View pointerEvents="none" style={{
      position: "absolute",
      left: x,
      top: -segH * 0.55,        // sit half-above the pool surface
      width: SEG_W, height: segH,
      borderRadius: segH / 2,
      backgroundColor: WAX_COLOR,
      transform: [{ translateY: ty }],
    }} />
  );
}

// ── Pool surface — flat base with gently undulating top edge ─────────────────
function BottomPool() {
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: POOL_SURFACE, left: 0, right: 0, bottom: 0, backgroundColor: WAX_COLOR }}>
      {Array.from({ length: WAVE_SEGS }, (_, i) => <WaveSeg key={i} index={i} />)}
    </View>
  );
}

// ── Lava tendril — rises from pool, floats, sinks back seamlessly ─────────────
function LavaTendril({
  centerX, size, initialDelay, riseDur, sinkDur, floatDur,
}: {
  centerX: number; size: number; initialDelay: number;
  riseDur: number; sinkDur: number; floatDur: number;
}) {
  const submergedY  = POOL_SURFACE - size * 0.2;
  const emergeY     = POOL_SURFACE - size * 1.05;
  const floatTopY   = LAMP_H * 0.07;
  const left        = centerX - size / 2;

  const ty = useRef(new Animated.Value(submergedY)).current;
  const tx = useRef(new Animated.Value(0)).current;
  const sy = useRef(new Animated.Value(1)).current;
  const sx = useRef(new Animated.Value(1)).current;
  const op = useRef(new Animated.Value(0)).current;

  // Inner highlight for realism
  const hlOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const easeUp   = Easing.out(Easing.cubic);
    const easeDown = Easing.in(Easing.cubic);
    const easeSin  = Easing.inOut(Easing.sin);

    function cycle() {
      const rv    = riseDur  + (Math.random() - 0.5) * 2000;
      const fv    = floatDur + (Math.random() - 0.5) * 1500;
      const sv    = sinkDur  + (Math.random() - 0.5) * 2000;
      const drift = LAMP_W * 0.055 * (Math.random() > 0.5 ? 1 : -1);

      ty.setValue(submergedY);
      tx.setValue(0);
      sy.setValue(0.75);
      sx.setValue(1.3);
      op.setValue(0);
      hlOp.setValue(0);

      // Phase 1 — pierce surface (invisible, stretch up through pool top)
      Animated.parallel([
        Animated.timing(ty, { toValue: emergeY,  duration: rv * 0.16, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
        Animated.timing(sy, { toValue: 1.6,      duration: rv * 0.16, useNativeDriver: true }),
        Animated.timing(sx, { toValue: 0.68,     duration: rv * 0.16, useNativeDriver: true }),
      ]).start(() => {

        // Phase 2 — emerge + rise  (fade in section-by-section over short window)
        Animated.parallel([
          // Opacity: 0→full in first 12% of rise — tight window = "drip from pond" effect
          Animated.timing(op,   { toValue: 0.75, duration: rv * 0.12, useNativeDriver: true }),
          Animated.timing(hlOp, { toValue: 0.13, duration: rv * 0.20, useNativeDriver: true }),
          Animated.timing(ty,   { toValue: floatTopY, duration: rv * 0.72, useNativeDriver: true, easing: easeUp }),
          Animated.timing(tx,   { toValue: drift * 0.4, duration: rv * 0.72, useNativeDriver: true, easing: easeUp }),
          Animated.sequence([
            Animated.timing(sy, { toValue: 1.25, duration: rv * 0.22, useNativeDriver: true }),
            Animated.timing(sy, { toValue: 1.0,  duration: rv * 0.50, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(sx, { toValue: 0.82, duration: rv * 0.22, useNativeDriver: true }),
            Animated.timing(sx, { toValue: 1.0,  duration: rv * 0.50, useNativeDriver: true }),
          ]),
        ]).start(() => {

          // Phase 3 — float + gentle swirl
          Animated.parallel([
            Animated.sequence([
              Animated.timing(ty, { toValue: floatTopY + 20, duration: fv * 0.5, useNativeDriver: true, easing: easeSin }),
              Animated.timing(ty, { toValue: floatTopY,      duration: fv * 0.5, useNativeDriver: true, easing: easeSin }),
            ]),
            Animated.sequence([
              Animated.timing(tx, { toValue:  drift,         duration: fv * 0.5, useNativeDriver: true, easing: easeSin }),
              Animated.timing(tx, { toValue: -drift * 0.35,  duration: fv * 0.5, useNativeDriver: true, easing: easeSin }),
            ]),
            Animated.sequence([
              Animated.timing(sy, { toValue: 0.91, duration: fv * 0.5, useNativeDriver: true, easing: easeSin }),
              Animated.timing(sy, { toValue: 1.0,  duration: fv * 0.5, useNativeDriver: true, easing: easeSin }),
            ]),
          ]).start(() => {

            // Phase 4 — sink back with gravity + fade out before hitting surface
            Animated.parallel([
              Animated.timing(ty, { toValue: submergedY, duration: sv, useNativeDriver: true, easing: easeDown }),
              Animated.timing(tx, { toValue: 0, duration: sv * 0.75, useNativeDriver: true, easing: easeSin }),
              Animated.sequence([
                Animated.timing(sy, { toValue: 1.4,  duration: sv * 0.42, useNativeDriver: true }),
                Animated.timing(sy, { toValue: 0.82, duration: sv * 0.58, useNativeDriver: true }),
              ]),
              Animated.sequence([
                Animated.timing(sx, { toValue: 0.80, duration: sv * 0.42, useNativeDriver: true }),
                Animated.timing(sx, { toValue: 1.22, duration: sv * 0.58, useNativeDriver: true }),
              ]),
              // Fade out only in final 15% — blob stays fully visible all the way down
              Animated.sequence([
                Animated.delay(sv * 0.85),
                Animated.timing(op,   { toValue: 0, duration: sv * 0.15, useNativeDriver: true }),
                Animated.timing(hlOp, { toValue: 0, duration: sv * 0.12, useNativeDriver: true }),
              ]),
            ]).start(() => {
              setTimeout(cycle, 1800 + Math.random() * 2800);
            });
          });
        });
      });
    }

    setTimeout(cycle, initialDelay);
  }, []);

  return (
    <Animated.View pointerEvents="none" style={{
      position: "absolute", left, top: 0,
      width: size, height: size,
      opacity: op,
      transform: [{ translateY: ty }, { translateX: tx }, { scaleY: sy }, { scaleX: sx }],
    }}>
      {/* Main wax — same color as pool, no border */}
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: WAX_COLOR }} />
      {/* Soft glow halo — same color, slightly larger */}
      <View style={{
        position: "absolute", top: -size * 0.1, left: -size * 0.1,
        width: size * 1.2, height: size * 1.2, borderRadius: size * 0.6,
        backgroundColor: WAX_COLOR, opacity: 0.22,
      }} />
      {/* Inner highlight */}
      <Animated.View style={{
        position: "absolute", top: size * 0.15, left: size * 0.18,
        width: size * 0.40, height: size * 0.30, borderRadius: size * 0.18,
        backgroundColor: "#fff", opacity: hlOp,
      }} />
    </Animated.View>
  );
}

function FestivalBg() {
  return (
    <>
      {/* Deep fluid */}
      <LinearGradient
        colors={[FLUID_COLOR, "#070018", "#040010"]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Tendrils — staggered so only 1-2 visible at a time */}
      <LavaTendril centerX={LAMP_W * 0.28} size={LAMP_W * 0.46} initialDelay={500}   riseDur={9200}  sinkDur={10200} floatDur={5200} />
      <LavaTendril centerX={LAMP_W * 0.66} size={LAMP_W * 0.36} initialDelay={8500}  riseDur={8800}  sinkDur={9800}  floatDur={4600} />
      <LavaTendril centerX={LAMP_W * 0.46} size={LAMP_W * 0.28} initialDelay={15500} riseDur={7800}  sinkDur={9000}  floatDur={3800} />

      {/* Bottom pool with wavy surface */}
      <BottomPool />

      {/* Heat glow — lamp bulb warmth */}
      <LinearGradient
        colors={["transparent", "transparent", "rgba(181,23,158,0.10)", "rgba(114,9,183,0.30)"]}
        locations={[0, 0.60, 0.82, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Top readability */}
      <LinearGradient
        colors={["rgba(3,0,20,0.60)", "transparent"]}
        locations={[0, 0.20]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
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

      {/* Subtle deep-space nebula glow — very faint, just adds color to the void */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={{ position:"absolute", top:-120, left:-80, width:340, height:340,
          borderRadius:170, backgroundColor:"rgba(109,40,217,0.10)" }} />
        <View style={{ position:"absolute", top:-40, right:-70, width:280, height:280,
          borderRadius:140, backgroundColor:"rgba(236,72,153,0.08)" }} />
        <View style={{ position:"absolute", bottom:SH*0.10, right:-50, width:260, height:260,
          borderRadius:130, backgroundColor:"rgba(190,24,93,0.07)" }} />
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

// ── Studio (Spotify-dark) background ────────────────────────────────────────

function StudioBg() {
  const barAnims = useRef(
    Array.from({ length: 18 }, (_, i) => new Animated.Value(0.15 + (i % 5) * 0.12))
  ).current;

  useEffect(() => {
    function animateBar(anim: Animated.Value, delay: number) {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 0.3 + Math.random() * 0.65, duration: 280 + Math.random() * 320, useNativeDriver: false }),
          Animated.timing(anim, { toValue: 0.05 + Math.random() * 0.20, duration: 220 + Math.random() * 280, useNativeDriver: false }),
        ])
      ).start();
    }
    barAnims.forEach((a, i) => animateBar(a, i * 55));
  }, []);

  return (
    <>
      {/* Base: very dark charcoal */}
      <LinearGradient
        colors={["#0a0a0a", "#111111", "#0d0d0d", "#080808"]}
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Subtle green glow at top */}
      <View style={{ position: "absolute", top: -60, left: SW * 0.2, right: SW * 0.2, height: 160, borderRadius: 80, backgroundColor: "rgba(29,185,84,0.10)" }} pointerEvents="none" />
      {/* EQ bars at bottom */}
      <View style={{ position: "absolute", bottom: 60, left: 0, right: 0, flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 4, height: 80, paddingHorizontal: 40 }} pointerEvents="none">
        {barAnims.map((anim, i) => (
          <Animated.View
            key={i}
            style={{
              flex: 1,
              height: anim.interpolate({ inputRange: [0, 1], outputRange: [4, 72] }),
              backgroundColor: i % 3 === 0 ? "rgba(29,185,84,0.60)" : i % 3 === 1 ? "rgba(29,185,84,0.35)" : "rgba(29,185,84,0.22)",
              borderRadius: 3,
            }}
          />
        ))}
      </View>
      {/* Bottom tint */}
      <LinearGradient
        colors={["transparent", "rgba(29,185,84,0.06)", "rgba(0,0,0,0.4)"]}
        locations={[0, 0.7, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Home Screen — QueueDJ
//
// Layout (Home tab):
//   ┌──────────────────────────────┐
//   │ QueueDJ logo / greeting    │
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
  const { state: roomState, dispatch } = useRoom();
  const { bgTheme: theme, setBgTheme: saveTheme } = useTheme();
  const params = useLocalSearchParams<{ code?: string; openJoin?: string }>();

  const [activeTab, setActiveTab]     = useState<Tab>("home");
  const [roomCode, setRoomCode]       = useState(params.code ?? "");
  const [loading, setLoading]         = useState(false);
  const [pendingAction, setPending]   = useState<PendingAction>(null);
  const [joinModalVisible, setJoinModal]       = useState(false);
  const [nameModalVisible, setNameModal]       = useState(false);
  const [roomNameInput,    setRoomNameInput]   = useState("");
  const [pendingGuestId,   setPendingGuestId]  = useState<string | null>(null);
  const [pendingHostName,  setPendingHostName] = useState<string | null>(null);
  const [browseVisible,   setBrowseVisible] = useState(false);
  const [errorMsg, setErrorMsg]            = useState("");
  const errorOpacity = useRef(new Animated.Value(0)).current;

  function showError(msg: string) {
    setErrorMsg(msg);
    Animated.sequence([
      Animated.timing(errorOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(3200),
      Animated.timing(errorOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setErrorMsg(""));
  }

  // ─── Lifted avatar state ─────────────────────────────────────────────────
  const [bodyIdx, setBodyIdx]               = useState(0);
  const [hpIdx, setHpIdx]                   = useState(0);
  const [outfitColorIdx, setOutfitColorIdx] = useState(0);
  const [outfitId, setOutfitId]             = useState<OutfitType>("default");
  const [exprIdx, setExprIdx]               = useState(0);
  const [avatarLoaded, setAvatarLoaded]     = useState(false);
  const [welcomeDismissed, setWelcomeDismissed] = useState(true);
  const [myGuestId, setMyGuestId] = useState<string | null>(() => storage.getString("queuedj:guestId") ?? null);
  const [myXP, setMyXP] = useState<XPInfo | null>(null);
  const [heroStats, setHeroStats] = useState<{ parties: number; tracks: number; guests: number } | null>(null);

  // Load guestId, then fetch credits (XP) and session history (hero stats)
  useEffect(() => {
    socketManager.getOrCreateGuestId().then((id) => {
      setMyGuestId(id);
      fetch(`${API_URL}/credits/${encodeURIComponent(id)}`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => { if (data) setMyXP(computeXP(data.balance ?? 0)); })
        .catch(() => {});
      fetch(`${API_URL}/history/${encodeURIComponent(id)}`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data?.sessions) {
            const s = data.sessions as Array<{ trackCount?: number; guestCount?: number }>;
            setHeroStats({
              parties: s.length,
              tracks:  s.reduce((a, x) => a + (x.trackCount ?? 0), 0),
              guests:  s.reduce((a, x) => a + (x.guestCount ?? 0), 0),
            });
          }
        })
        .catch(() => {});
    }).catch(() => {});
  }, []);

  // Auto-open join modal when arriving from a push notification (room_closing / room_invite)
  useEffect(() => {
    if (params.openJoin === "1" && params.code) {
      setJoinModal(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Persist avatar across app restarts ──────────────────────────────────
  useEffect(() => {
    AsyncStorage.multiGet([
      "pg_avatar_body", "pg_avatar_hp", "pg_avatar_outfit_color",
      "pg_avatar_outfit_id", "pg_avatar_expr",
    ]).then((pairs) => {
      const m = Object.fromEntries(pairs);
      if (m["pg_avatar_body"]         !== null) setBodyIdx(Number(m["pg_avatar_body"]));
      if (m["pg_avatar_hp"]           !== null) setHpIdx(Number(m["pg_avatar_hp"]));
      if (m["pg_avatar_outfit_color"] !== null) setOutfitColorIdx(Number(m["pg_avatar_outfit_color"]));
      if (m["pg_avatar_outfit_id"]    !== null) setOutfitId(m["pg_avatar_outfit_id"] as OutfitType);
      if (m["pg_avatar_expr"]         !== null) setExprIdx(Number(m["pg_avatar_expr"]));
      setAvatarLoaded(true);
    }).catch(() => setAvatarLoaded(true));
  }, []);

  useEffect(() => {
    if (!avatarLoaded) return; // don't overwrite on first mount before load
    AsyncStorage.multiSet([
      ["pg_avatar_body",         String(bodyIdx)],
      ["pg_avatar_hp",           String(hpIdx)],
      ["pg_avatar_outfit_color", String(outfitColorIdx)],
      ["pg_avatar_outfit_id",    outfitId],
      ["pg_avatar_expr",         String(exprIdx)],
    ]);
  }, [bodyIdx, hpIdx, outfitColorIdx, outfitId, exprIdx, avatarLoaded]);

  // Android back button: go to Home tab instead of exiting the app
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (activeTab !== "home") {
        setActiveTab("home");
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [activeTab]);

  // ─── Name confirmed → execute the pending action ─────────────────────────
  async function onNameConfirmed(name: string) {
    await socketManager.saveDisplayName(name);
    setPending(null);
    if (pendingAction?.type === "create") {
      const guestId = await socketManager.getOrCreateGuestId();
      setPendingHostName(name);
      setPendingGuestId(guestId);
      setRoomNameInput("");
      setNameModal(true);
    }
    if (pendingAction?.type === "join") await doJoinRoom(pendingAction.code, name);
  }

  // ─── Create Room (Host) ───────────────────────────────────────────────────
  async function handleStartRoom() {
    try {
      const [saved, guestId] = await Promise.all([
        socketManager.getDisplayName(),
        socketManager.getOrCreateGuestId(),
      ]);
      if (!saved) { setPending({ type: "create" }); return; }
      // Show room name modal before creating
      setPendingHostName(saved);
      setPendingGuestId(guestId);
      setRoomNameInput("");
      setNameModal(true);
    } catch (e: any) {
      showError(e?.message ?? "Could not start room");
    }
  }

  async function handleConfirmRoomName() {
    setNameModal(false);
    const name = roomNameInput.trim() || "My Party";
    await doCreateRoom(pendingHostName!, pendingGuestId!, name);
  }

  async function doCreateRoom(displayName: string, prefetchedGuestId?: string, roomName?: string) {
    setLoading(true);
    try {
      const guestId = prefetchedGuestId ?? await socketManager.getOrCreateGuestId();

      // ── Try live API; fall back to offline demo room ──────────────────────
      let roomId: string;
      let roomData: Room;

      // Kick off socket connect immediately — runs in parallel with API call
      const socketPromise = Promise.race([
        socketManager.connect(guestId, displayName),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 12000)),
      ]).catch(() => null); // silently absorb — offline is fine

      const controller = new AbortController();
      const fetchTimeout = setTimeout(() => controller.abort(), 10000);
      try {
        const res = await fetch(`${API_URL}/rooms`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hostGuestId: guestId, name: roomName ?? "My Party", vibePreset: "open" }),
          signal: controller.signal,
        });
        clearTimeout(fetchTimeout);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "API error");
        roomData = data.room;
        roomId   = data.room.id;

        // Socket should already be connected (or connecting) — join room
        await socketPromise;
        const hostAck = await socketManager.joinRoom(roomId).catch((err) => {
          console.warn("[host] joinRoom failed after room creation:", err);
          dispatch({ type: "SET_OFFLINE", isOffline: true });
          return null;
        });
        if (hostAck?.members && hostAck.members.length > 0) {
          dispatch({ type: "SET_MEMBERS", members: hostAck.members as any });
        }
      } catch (err: any) {
        clearTimeout(fetchTimeout);
        // Surface the actual error so the host knows why room creation failed.
        // Demo/offline mode was silently hiding connection issues — removed.
        throw new Error(
          err?.name === "AbortError"
            ? "Server took too long to respond. Check your connection."
            : (err?.message ?? "Could not create room. Check your connection."),
        );
      }

      dispatch({ type: "SET_ROOM",     room: roomData });
      dispatch({ type: "SET_GUEST_ID", guestId, role: "HOST" });

      router.push(`/host/${roomId}` as any);
      recordActivity().catch(() => {});
    } catch (e: any) {
      showError(e.message ?? "Could not create room");
    } finally {
      setLoading(false);
    }
  }

  // ─── Join Room (Guest) ────────────────────────────────────────────────────
  async function handleJoinRoom() {
    const code = roomCode.trim();
    if (code.length < 4) return; // button already disabled below 4 chars
    const saved = await socketManager.getDisplayName();
    setJoinModal(false);
    if (!saved) { setPending({ type: "join", code }); return; }
    await doJoinRoom(code, saved);
  }

  async function doJoinRoom(code: string, displayName: string) {
    setLoading(true);
    try {
      const controller = new AbortController();
      const fetchTimeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(`${API_URL}/rooms/${code.toUpperCase()}`, { signal: controller.signal }).finally(() => clearTimeout(fetchTimeout));
      const data = await res.json();
      if (!res.ok) throw new Error("Room not found");

      const guestId = socketManager.generateSessionGuestId();
      await socketManager.connect(guestId, displayName);
      const ack = await socketManager.joinRoom(data.id, guestId);

      if (!ack.success) throw new Error(ack.error ?? "Could not join room");

      console.log("[doJoinRoom] ack received", JSON.stringify({ members: ack.members?.length, experienceType: ack.experienceType, awaitingReady: ack.awaitingReady }));

      const safeRole = (["HOST", "CO_HOST", "GUEST"] as const).includes(ack.role as any) ? ack.role : "GUEST";
      dispatch({ type: "SET_ROOM", room: { ...data, sequenceId: ack.currentSequenceId } as any });
      dispatch({ type: "SET_GUEST_ID", guestId, role: safeRole });

      // Apply bootstrap data from ack — arrives in-band, no socket race possible
      if (ack.members && ack.members.length > 0) {
        dispatch({ type: "SET_MEMBERS", members: ack.members as any });
      }
      console.log("[doJoinRoom] dispatched, members count:", ack.members?.length ?? 0);
      if (ack.experienceType && ack.guestView) {
        dispatch({ type: "SET_EXPERIENCE", experience: ack.experienceType as any, view: ack.guestView as any });
      }
      if (ack.awaitingReady === true) {
        dispatch({ type: "SET_READY_UP", active: true, readyCount: ack.readyCount ?? 0, totalCount: ack.readyTotalCount ?? 0 });
      }

      // Belt-and-suspenders: emit room:request_sync directly (bypasses React useEffect timing)
      // This runs synchronously after ack, before any re-render, so handlers may not be
      // registered yet — but the useEffect + fallback timer below will also fire.
      const syncSocket = socketManager.get();
      if (syncSocket) {
        syncSocket.emit("room:request_sync" as any, { roomId: data.id });
      }

      router.push(`/guest/${data.id}`);
      recordActivity().catch(() => {});
    } catch (e: any) {
      showError(e.message ?? "Could not join room");
    } finally {
      setLoading(false);
    }
  }

  // ─── Browse join (from public room discovery) ────────────────────────────
  async function handleBrowseJoin(code: string) {
    setBrowseVisible(false);
    const saved = await AsyncStorage.getItem("displayName");
    if (!saved) { setPending({ type: "join", code }); return; }
    await doJoinRoom(code, saved);
  }

  // ─── Tab content ─────────────────────────────────────────────────────────
  function renderTabContent() {
    switch (activeTab) {
      case "home":
        return (
          <HomeTab
            onStartRoom={handleStartRoom}
            onJoinRoom={() => setJoinModal(true)}
            onBrowseRooms={() => setBrowseVisible(true)}
            loading={loading}
            bodyColor={BODY_COLORS[bodyIdx]}
            hpColor={HP_COLORS[hpIdx]}
            outfitColor={OUTFIT_COLORS[outfitColorIdx]}
            outfitId={outfitId}
            expression={EXPRESSIONS[exprIdx]}
            welcomeDismissed={welcomeDismissed}
            onDismissWelcome={() => setWelcomeDismissed(true)}
            theme={theme}
            onToggleTheme={saveTheme}
            guestId={myGuestId}
            xp={myXP}
            heroStats={heroStats}
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
            guestId={myGuestId}
            theme={theme}
            xp={myXP}
          />
        );
      case "social":
        return (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 60 }}>
            {/* Page header */}
            <View style={styles.tabHeader}>
              <Text style={styles.tabHeaderTitle}>Social</Text>
            </View>

            <Text style={{ color: "#6b7280", fontSize: 10, fontWeight: "800", letterSpacing: 2, paddingHorizontal: 16, marginBottom: 4 }}>
              ACTIVITY
            </Text>
            <ActivityFeed guestId={myGuestId} />

            <Text style={{ color: "#6b7280", fontSize: 10, fontWeight: "800", letterSpacing: 2, paddingHorizontal: 16, marginTop: 24, marginBottom: 8 }}>
              GLOBAL LEADERBOARD
            </Text>
            <HostLeaderboard limit={20} />
            <Text style={{ color: "#6b7280", fontSize: 10, fontWeight: "800", letterSpacing: 2, paddingHorizontal: 16, marginTop: 24, marginBottom: 8 }}>
              YOUR SESSIONS
            </Text>
            <RoomHistory />
            <FriendsSection />
            <AchievementsSection />
            {myGuestId && <WeeklyTasteReport guestId={myGuestId} />}
          </ScrollView>
        );
      case "account":
        return <SettingsScreen guestId={myGuestId} />;
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      {theme === "festival" ? <LavaLampBg /> : theme === "studio" ? <StudioBg /> : <SpaceBg />}
      <NamePromptModal visible={pendingAction !== null} onConfirm={onNameConfirmed} />

      {/* Room Name Modal */}
      <Modal visible={nameModalVisible} transparent animationType="slide" onRequestClose={() => setNameModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOuter}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setNameModal(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHead}>
              <View style={styles.modalIconWrap}>
                <Text style={{ fontSize: 28 }}>🎛️</Text>
              </View>
              <Text style={styles.modalTitle}>Name Your Party</Text>
              <Text style={styles.modalSub}>Give your room a name guests will see</Text>
            </View>
            <TextInput
              style={styles.nameInput}
              placeholder="My Party"
              placeholderTextColor="#555"
              value={roomNameInput}
              onChangeText={setRoomNameInput}
              maxLength={32}
              autoFocus
              returnKeyType="go"
              onSubmitEditing={handleConfirmRoomName}
            />
            <TouchableOpacity onPress={handleConfirmRoomName} disabled={loading} activeOpacity={0.85}>
              <LinearGradient
                colors={["#7c3aed", "#6d28d9"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.joinBtn}
              >
                <Text style={styles.joinBtnText}>{loading ? "Creating..." : "Create Party"}</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelRow} onPress={() => setNameModal(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Join Room Modal */}
      <Modal visible={joinModalVisible} transparent animationType="slide" onRequestClose={() => { setJoinModal(false); setRoomCode(""); }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOuter}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => { setJoinModal(false); setRoomCode(""); }} />
          <View style={styles.modalSheet}>
            {/* Handle */}
            <View style={styles.modalHandle} />

            {/* Icon + heading */}
            <View style={styles.modalHead}>
              <View style={styles.modalIconWrap}>
                <Text style={{ fontSize: 28 }}>🎉</Text>
              </View>
              <Text style={styles.modalTitle}>Join a Room</Text>
              <Text style={styles.modalSub}>Enter the 4-letter code from the host</Text>
            </View>

            {/* 4-box letter input */}
            <JoinCodeInput value={roomCode} onChange={setRoomCode} />

            {/* Join button */}
            <TouchableOpacity
              onPress={handleJoinRoom}
              disabled={roomCode.length < 4 || loading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={roomCode.length < 4 ? ["#2a2a2a", "#2a2a2a"] : ["#7c3aed", "#6d28d9"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[styles.joinBtn, roomCode.length < 4 && styles.btnDisabled]}
              >
                <Text style={styles.joinBtnText}>{loading ? "Joining..." : "Join Party"}</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* QR scan */}
            <TouchableOpacity style={styles.qrRow} onPress={() => { setJoinModal(false); router.push("/scan"); }}>
              <Text style={styles.qrText}>📷  Scan QR code instead</Text>
            </TouchableOpacity>

            {/* Cancel */}
            <TouchableOpacity style={styles.cancelRow} onPress={() => { setJoinModal(false); setRoomCode(""); }}>
              <Text style={styles.cancelText}>Cancel</Text>
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
        theme={theme}
      />

      {/* Error toast — slides up above the tab bar */}
      {!!errorMsg && (
        <Animated.View style={[styles.errorToast, { opacity: errorOpacity }]} pointerEvents="none">
          <Text style={styles.errorToastText}>⚠️  {errorMsg}</Text>
        </Animated.View>
      )}

      <PublicRoomsSheet
        visible={browseVisible}
        onClose={() => setBrowseVisible(false)}
        onJoin={handleBrowseJoin}
        myGuestId={myGuestId}
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
  onBrowseRooms,
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
  xp,
  guestId,
  heroStats,
}: {
  onStartRoom: () => void;
  onJoinRoom: () => void;
  onBrowseRooms: () => void;
  loading: boolean;
  bodyColor: string;
  hpColor: string;
  outfitColor: string;
  outfitId: OutfitType;
  expression: "happy" | "cool" | "party";
  welcomeDismissed: boolean;
  guestId?: string | null;
  xp?: XPInfo | null;
  heroStats?: { parties: number; tracks: number; guests: number } | null;
  onDismissWelcome: () => void;
  theme: "festival" | "space" | "studio";
  onToggleTheme: (t: "festival" | "space" | "studio") => void;
}) {
  const [howItWorksVisible, setHowItWorksVisible] = useState(false);
  const avatarSize = Math.min(Dimensions.get("window").width * 0.82, 380);
  const isStudio = theme === "studio";
  const { state: roomState } = useRoom();

  return (
    <ScrollView
      style={{ flex: 1 }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.homeScroll}
    >
      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <LinearGradient
            colors={["#3b1f7a", "#6c47ff"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.logoWrap}
          >
            <Image source={require("../../assets/logo.png")} style={styles.logoImg} resizeMode="contain" />
          </LinearGradient>
          <View>
            <QueueDJName />
            <Text style={styles.brandTagline}>The glue that holds the party together</Text>
          </View>
        </View>
        <View style={styles.topRight}>
          <TouchableOpacity style={styles.notifBtn} activeOpacity={0.8}>
            <Text style={{ fontSize: 16 }}>🔔</Text>
            <View style={styles.notifDot} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Avatar Hero Card ──────────────────────────────────────────── */}
      <View style={styles.avatarHeroCard}>
        {/* Card background glow */}
        <View style={styles.avatarCardGlow} pointerEvents="none" />

        {/* Avatar + emote bubble */}
        <View style={styles.avatarCardTop}>
          <View style={styles.emoteBubble}>
            <Text style={styles.emoteBubbleText}>✨ Feeling fresh</Text>
          </View>
          <Avatar3D
            size={avatarSize}
            bodyColor={bodyColor}
            headphoneColor={hpColor}
            outfitColor={outfitColor}
            expression={expression}
            outfit={outfitId}
          />
        </View>

        {/* Name, level, XP */}
        <View style={styles.avatarCardInfo}>
          <View>
            <Text style={styles.avatarCardName}>{xp?.rank ?? "DJ Rookie"}</Text>
            <View style={styles.avatarCardLevel}>
              <Text style={styles.avatarCardLevelText}>
                {xp ? `⭐ Level ${xp.level}  ·  ${xp.currentXP} / ${xp.levelXP} XP` : "⭐ Level 1"}
              </Text>
            </View>
          </View>
          {guestId && <VibeCreditsBar guestId={guestId} compact />}
        </View>

        {/* Stats row */}
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={[styles.heroStatNum, { color: "#a78bfa" }]}>
              {heroStats != null ? heroStats.parties : "—"}
            </Text>
            <Text style={styles.heroStatLabel}>Parties</Text>
          </View>
          <View style={[styles.heroStat, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: "#221d3a" }]}>
            <Text style={styles.heroStatNum}>
              {heroStats != null ? heroStats.tracks : "—"}
            </Text>
            <Text style={styles.heroStatLabel}>Tracks</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={[styles.heroStatNum, { color: "#fb923c" }]}>
              {heroStats != null ? heroStats.guests : "—"}
            </Text>
            <Text style={styles.heroStatLabel}>Guests</Text>
          </View>
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

      {/* ── Mode Cards ───────────────────────────────────────────────── */}
      <ModeCards onStartRoom={onStartRoom} onJoinRoom={onJoinRoom} onBrowseRooms={onBrowseRooms} loading={loading} />

      {/* ── Live Now ─────────────────────────────────────────────────── */}
      <LiveNowSection onJoinRoom={onJoinRoom} activeRoom={roomState.room} isConnected={roomState.isConnected} />

      {/* ── Spotify Connect ──────────────────────────────────────────── */}
      <SpotifyConnectButton />

      {/* ── Song of the Day ──────────────────────────────────────────── */}
      <SongOfTheDayCard />

      {/* ── Games Carousel ───────────────────────────────────────────── */}
      <GamesCarousel onSelectGame={(_gameId) => onStartRoom()} />

      {/* ── Recently Played ──────────────────────────────────────────── */}
      <RecentlyPlayedSection />

      {/* ── DJ Section ───────────────────────────────────────────────── */}
      <View style={styles.djHomeSection}>
        <View style={styles.djHomeSectionHeader}>
          <Text style={styles.djHomeSectionLabel}>🎛️  DJ MODE</Text>
        </View>
        <View style={styles.djHomeCard}>
          <View style={styles.djHomeCardLeft}>
            <Text style={styles.djHomeCardTitle}>Drop the Beat</Text>
            <Text style={styles.djHomeCardSub}>BPM-synced crossfades · AI DJ · Spotify queue</Text>
          </View>
          <TouchableOpacity style={styles.djHomeBtn} onPress={onStartRoom} activeOpacity={0.85}>
            <Text style={styles.djHomeBtnText}>Start</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.djHomePillRow}>
          {["🎵 Queue", "🤖 AI DJ", "🎚️ Decks", "🔀 Crossfader"].map(f => (
            <View key={f} style={styles.djHomePill}><Text style={styles.djHomePillText}>{f}</Text></View>
          ))}
        </View>
      </View>

      {/* Bottom padding */}
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mode Cards — the two big primary CTAs
// ─────────────────────────────────────────────────────────────────────────────

// ─── 4-box room code input ────────────────────────────────────────────────────
function JoinCodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputs = useRef<(TextInput | null)[]>([null, null, null, null]);

  function handleChange(idx: number, raw: string) {
    // Support paste / autocomplete: if more than 1 char arrives, distribute across boxes
    const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cleaned.length > 1) {
      const full = cleaned.slice(0, 4);
      onChange(full);
      const nextIdx = Math.min(full.length, 3);
      inputs.current[nextIdx]?.focus();
      return;
    }
    const arr = (value + "    ").slice(0, 4).split("");
    if (cleaned) {
      arr[idx] = cleaned;
      onChange(arr.join("").trimEnd());
      if (idx < 3) inputs.current[idx + 1]?.focus();
    } else {
      arr[idx] = " ";
      onChange(arr.join("").trimEnd());
      if (idx > 0) inputs.current[idx - 1]?.focus();
    }
  }

  return (
    <View style={joinBoxStyles.row}>
      {[0, 1, 2, 3].map((i) => {
        const filled = i < value.length;
        return (
          <View key={i} style={[joinBoxStyles.box, filled && joinBoxStyles.boxFilled]}>
            <TextInput
              ref={(r) => { inputs.current[i] = r; }}
              style={joinBoxStyles.letter}
              value={value[i] ?? ""}
              onChangeText={(t) => handleChange(i, t)}
              maxLength={4}
              autoCapitalize="characters"
              autoCorrect={false}
              keyboardType="default"
              onFocus={() => {}}
              caretHidden
              selectTextOnFocus
            />
          </View>
        );
      })}
    </View>
  );
}

const joinBoxStyles = StyleSheet.create({
  row:      { flexDirection: "row", gap: 12, justifyContent: "center", marginVertical: 28 },
  box:      { width: 62, height: 72, borderRadius: 16, backgroundColor: "#1a1a2e", borderWidth: 2, borderColor: "#2a2a4a", alignItems: "center", justifyContent: "center" },
  boxFilled:{ borderColor: "#7c3aed", backgroundColor: "#1e1040", shadowColor: "#7c3aed", shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  letter:   { color: "#fff", fontSize: 28, fontWeight: "900", textAlign: "center", width: "100%", textTransform: "uppercase" },
});

// ─── Mascot for mode cards ─────────────────────────────────────────────────────
function ModeMascot({ variant }: { variant: "dj" | "guest" }) {
  const s = 72;
  const bodyColor  = "#7ec8e3";
  const blushColor = variant === "dj" ? "#f9a8d4" : "#fda4af";
  return (
    <View style={{ width: s, height: s * 1.15, alignItems: "center" }}>
      {/* Tuft */}
      <View style={{ position:"absolute", top:0, width:s*0.13, height:s*0.16, borderRadius:s*0.08, backgroundColor:bodyColor, zIndex:2 }} />
      <View style={{ position:"absolute", top:s*0.04, left:s*0.29, width:s*0.10, height:s*0.12, borderRadius:s*0.06, backgroundColor:bodyColor, zIndex:2 }} />
      <View style={{ position:"absolute", top:s*0.04, right:s*0.29, width:s*0.10, height:s*0.12, borderRadius:s*0.06, backgroundColor:bodyColor, zIndex:2 }} />
      {/* Arms */}
      {variant === "dj" ? (
        <>
          <View style={{ position:"absolute", bottom:s*0.22, left:-s*0.06, width:s*0.17, height:s*0.28, borderRadius:s*0.085, backgroundColor:bodyColor, transform:[{rotate:"-30deg"}] }} />
          <View style={{ position:"absolute", bottom:s*0.22, right:-s*0.06, width:s*0.17, height:s*0.28, borderRadius:s*0.085, backgroundColor:bodyColor, transform:[{rotate:"30deg"}] }} />
        </>
      ) : (
        <>
          <View style={{ position:"absolute", bottom:s*0.18, left:-s*0.04, width:s*0.17, height:s*0.26, borderRadius:s*0.085, backgroundColor:bodyColor, transform:[{rotate:"20deg"}] }} />
          <View style={{ position:"absolute", bottom:s*0.18, right:-s*0.04, width:s*0.17, height:s*0.26, borderRadius:s*0.085, backgroundColor:bodyColor, transform:[{rotate:"-20deg"}] }} />
        </>
      )}
      {/* Body */}
      <View style={{ position:"absolute", bottom:s*0.12, width:s*0.94, height:s*0.88, borderRadius:s*0.47, backgroundColor:bodyColor, alignItems:"center", shadowColor:bodyColor, shadowRadius:12, shadowOpacity:0.5, shadowOffset:{width:0,height:5} }}>
        <View style={{ flexDirection:"row", gap:s*0.16, marginTop:s*0.16 }}>
          <View style={{ width:s*0.15, height:s*0.15, borderRadius:s*0.075, backgroundColor:"#1a1030", alignItems:"center", justifyContent:"flex-start", paddingTop:s*0.025 }}>
            <View style={{ width:s*0.055, height:s*0.055, borderRadius:s*0.028, backgroundColor:"rgba(255,255,255,0.75)" }} />
          </View>
          <View style={{ width:s*0.15, height:s*0.15, borderRadius:s*0.075, backgroundColor:"#1a1030", alignItems:"center", justifyContent:"flex-start", paddingTop:s*0.025 }}>
            <View style={{ width:s*0.055, height:s*0.055, borderRadius:s*0.028, backgroundColor:"rgba(255,255,255,0.75)" }} />
          </View>
        </View>
        <View style={{ flexDirection:"row", gap:s*0.25, marginTop:s*0.04 }}>
          <View style={{ width:s*0.14, height:s*0.07, borderRadius:s*0.035, backgroundColor:blushColor, opacity:0.65 }} />
          <View style={{ width:s*0.14, height:s*0.07, borderRadius:s*0.035, backgroundColor:blushColor, opacity:0.65 }} />
        </View>
        <View style={{ width:s*0.30, height:s*0.17, borderRadius:s*0.085, backgroundColor:"#7f1d1d", marginTop:s*0.04, overflow:"hidden", alignItems:"center" }}>
          <View style={{ width:"88%", height:s*0.07, backgroundColor:"#fef2f2", borderBottomLeftRadius:s*0.06, borderBottomRightRadius:s*0.06 }} />
        </View>
      </View>
      {/* Feet */}
      <View style={{ flexDirection:"row", gap:s*0.07, position:"absolute", bottom:0 }}>
        <View style={{ width:s*0.28, height:s*0.14, borderRadius:s*0.07, backgroundColor:bodyColor }} />
        <View style={{ width:s*0.28, height:s*0.14, borderRadius:s*0.07, backgroundColor:bodyColor }} />
      </View>
      {/* DJ headphones */}
      {variant === "dj" && (
        <View style={{ position:"absolute", top:-4, width:s*0.88, height:s*0.22, borderTopLeftRadius:s*0.44, borderTopRightRadius:s*0.44, borderWidth:s*0.07, borderColor:"#1a1030", borderBottomWidth:0 }}>
          <View style={{ position:"absolute", left:-s*0.09, top:s*0.01, width:s*0.14, height:s*0.18, borderRadius:s*0.04, backgroundColor:"#1a1030" }} />
          <View style={{ position:"absolute", right:-s*0.09, top:s*0.01, width:s*0.14, height:s*0.18, borderRadius:s*0.04, backgroundColor:"#1a1030" }} />
        </View>
      )}
      {/* Guest confetti */}
      {variant === "guest" && (
        <>
          <Text style={{ position:"absolute", top:2, right:-4, fontSize:14 }}>🎉</Text>
          <Text style={{ position:"absolute", top:16, left:-6, fontSize:11 }}>✨</Text>
        </>
      )}
    </View>
  );
}

function ModeCards({
  onStartRoom, onJoinRoom, onBrowseRooms, loading,
}: { onStartRoom: () => void; onJoinRoom: () => void; onBrowseRooms: () => void; loading: boolean }) {
  const hostScale  = useRef(new Animated.Value(1)).current;
  const guestScale = useRef(new Animated.Value(1)).current;

  function press(scale: Animated.Value, cb: () => void) {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50 }),
      Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 20 }),
    ]).start();
    cb();
  }

  return (
    <>
    <View style={modeStyles.row}>
      {/* ── Start a Party ── */}
      <Animated.View style={[modeStyles.cardWrap, modeStyles.hostShadow, { transform: [{ scale: hostScale }] }]}>
        <TouchableOpacity style={modeStyles.card} onPress={() => press(hostScale, onStartRoom)} disabled={loading} activeOpacity={1}>
          <LinearGradient colors={["rgba(45,16,96,0.30)", "rgba(108,71,255,0.22)", "rgba(139,92,246,0.18)"]} start={{ x: 0.2, y: 0 }} end={{ x: 1, y: 1 }} style={modeStyles.cardGradient}>
            {/* Glow orb */}
            <View style={[modeStyles.glowOrb, { backgroundColor: "#a78bfa" }]} />
            <View style={modeStyles.cardTopRow}>
              <View style={[modeStyles.cardBadge, modeStyles.hostBadge]}>
                <Text style={modeStyles.cardBadgeText}>HOST</Text>
              </View>
            </View>
            <View style={modeStyles.cardBottom}>
              <Text style={modeStyles.cardTitle}>Start a Party</Text>
              <Text style={modeStyles.cardSub}>DJ mode + crowd games</Text>
              <View style={modeStyles.cardCta}>
                <Text style={modeStyles.cardCtaText}>Let's go →</Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* ── Join a Party ── */}
      <Animated.View style={[modeStyles.cardWrap, modeStyles.guestShadow, { transform: [{ scale: guestScale }] }]}>
        <TouchableOpacity style={modeStyles.card} onPress={() => press(guestScale, onJoinRoom)} disabled={loading} activeOpacity={1}>
          <LinearGradient colors={["rgba(15,10,46,0.28)", "rgba(30,27,75,0.22)", "rgba(49,46,129,0.18)"]} start={{ x: 0.2, y: 0 }} end={{ x: 1, y: 1 }} style={modeStyles.cardGradient}>
            {/* Glow orb */}
            <View style={[modeStyles.glowOrb, { backgroundColor: "#818cf8" }]} />
            <View style={modeStyles.cardTopRow}>
              <View style={[modeStyles.cardBadge, modeStyles.guestBadge]}>
                <Text style={[modeStyles.cardBadgeText, { color: "#a5b4fc" }]}>GUEST</Text>
              </View>
            </View>
            <View style={modeStyles.cardBottom}>
              <Text style={modeStyles.cardTitle}>Join a Party</Text>
              <Text style={modeStyles.cardSub}>Enter a room code</Text>
              <View style={[modeStyles.cardCta, modeStyles.cardCtaGuest]}>
                <Text style={[modeStyles.cardCtaText, { color: "#c7d2fe" }]}>Enter code →</Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </View>

    {/* ── Browse Live Rooms ── */}
    <TouchableOpacity style={modeStyles.browseBtn} onPress={onBrowseRooms} activeOpacity={0.8}>
      <View style={modeStyles.browseBtnInner}>
        <Text style={modeStyles.browseBtnEmoji}>🌐</Text>
        <Text style={modeStyles.browseBtnText}>Browse Live Rooms</Text>
        <Text style={modeStyles.browseBtnArrow}>›</Text>
      </View>
    </TouchableOpacity>
    </>
  );
}

const modeStyles = StyleSheet.create({
  row:      { flexDirection: "row", gap: 14, marginHorizontal: 16, marginBottom: 24 },
  cardWrap: { flex: 1, borderRadius: 22 },
  card:     { borderRadius: 22, overflow: "hidden", aspectRatio: 0.78, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" },
  cardGradient: { flex: 1, padding: 16, justifyContent: "space-between", position: "relative" },
  glowOrb:  { position: "absolute", width: 120, height: 120, borderRadius: 60, opacity: 0.18, top: -20, right: -20 },
  hostShadow:  { shadowColor: "#7c3aed", shadowOpacity: 0.65, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  guestShadow: { shadowColor: "#4f46e5", shadowOpacity: 0.5,  shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  cardTopRow:  { flexDirection: "row", justifyContent: "flex-start", zIndex: 2 },
  mascotWrap:  { alignItems: "center", justifyContent: "center", flex: 1, zIndex: 2 },
  cardBottom:  { gap: 3, zIndex: 2 },
  cardBadge:   { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  hostBadge:   { backgroundColor: "rgba(124,58,237,0.55)", borderColor: "#a78bfa66" },
  guestBadge:  { backgroundColor: "rgba(79,70,229,0.4)",  borderColor: "#818cf866" },
  cardBadgeText: { color: "#fff", fontSize: 9, fontWeight: "900", letterSpacing: 1.4 },
  cardTitle: { color: "#fff", fontSize: 18, fontWeight: "900" },
  cardSub:   { color: "rgba(255,255,255,0.6)", fontSize: 12, marginBottom: 8 },
  cardCta:      { alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  cardCtaGuest: { backgroundColor: "rgba(255,255,255,0.1)" },
  cardCtaText:  { color: "#fff", fontSize: 12, fontWeight: "800" },

  browseBtn: { marginHorizontal: 16, marginTop: -10, marginBottom: 10 },
  browseBtnInner: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14, paddingVertical: 11, paddingHorizontal: 18,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
  },
  browseBtnEmoji: { fontSize: 15 },
  browseBtnText:  { color: "rgba(255,255,255,0.65)", fontSize: 13, fontWeight: "700", flex: 1, textAlign: "center" },
  browseBtnArrow: { color: "rgba(255,255,255,0.4)", fontSize: 16, fontWeight: "700" },
});

// ─────────────────────────────────────────────────────────────────────────────
// Live Now Section
// ─────────────────────────────────────────────────────────────────────────────

function LiveNowSection({ onJoinRoom, activeRoom, isConnected }: {
  onJoinRoom: () => void;
  activeRoom: { code?: string; name?: string } | null;
  isConnected: boolean;
}) {
  const inRoom = !!activeRoom && isConnected;
  return (
    <View style={styles.liveBanner}>
      <View style={[styles.liveBannerDot, inRoom && { backgroundColor: "#22c55e" }]} />
      <Text style={styles.liveBannerText} numberOfLines={1}>
        {inRoom
          ? <Text><Text style={{ color: "#fff", fontWeight: "700" }}>Room {activeRoom?.code}</Text> · Tap to rejoin</Text>
          : <Text><Text style={{ color: "#fff", fontWeight: "700" }}>No active party</Text> · Start one or join with a code</Text>
        }
      </Text>
      <TouchableOpacity style={styles.liveBannerBtn} onPress={inRoom ? onJoinRoom : onJoinRoom} activeOpacity={0.8}>
        <Text style={styles.liveBannerBtnText}>{inRoom ? "Rejoin ›" : "+ Start"}</Text>
      </TouchableOpacity>
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
// Avatar Tab — Premium redesign
// ─────────────────────────────────────────────────────────────────────────────

const EMOTES = [
  { id: "wave",    emoji: "👋", label: "Wave"    },
  { id: "dance",   emoji: "💃", label: "Dance"   },
  { id: "fire",    emoji: "🔥", label: "Fire"    },
  { id: "clap",    emoji: "👏", label: "Clap"    },
  { id: "hype",    emoji: "🙌", label: "Hype"    },
  { id: "cool",    emoji: "😎", label: "Cool"    },
  { id: "love",    emoji: "❤️", label: "Love"   },
  { id: "laugh",   emoji: "😂", label: "Laugh"   },
  { id: "shocked", emoji: "😱", label: "Shock"   },
  { id: "flex",    emoji: "💪", label: "Flex"    },
  { id: "peace",   emoji: "✌️", label: "Peace"  },
  { id: "money",   emoji: "💸", label: "Money"   },
];

function AvatarTab({
  bodyIdx, setBodyIdx,
  hpIdx, setHpIdx,
  outfitColorIdx, setOutfitColorIdx,
  outfitId, setOutfitId,
  exprIdx, setExprIdx,
  guestId,
  theme,
  xp,
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
  guestId?: string | null;
  theme?: "festival" | "space" | "studio";
  xp?: XPInfo | null;
}) {
  const avatarSize = Math.min(Dimensions.get("window").width * 0.82, 380);
  const [activeEmote, setActiveEmote] = React.useState<string | null>(null);
  const emoteScale = React.useRef(new Animated.Value(1)).current;

  const isStudio = theme === "studio";
  const accentColor   = isStudio ? "#1DB954" : "#a78bfa";
  const accentColor2  = isStudio ? "#34d399" : "#7c3aed";
  const xpGradient: [string, string] = isStudio ? ["#1DB954", "#34d399"] : ["#7c3aed", "#a78bfa"];
  const platformRings = isStudio
    ? [
        { w: SW * 0.90, h: 58, color: "#064e3b", opacity: 0.22 },
        { w: SW * 0.70, h: 44, color: "#065f46", opacity: 0.30 },
        { w: SW * 0.50, h: 32, color: "#059669", opacity: 0.38 },
        { w: SW * 0.32, h: 22, color: "#10b981", opacity: 0.50 },
        { w: SW * 0.16, h: 12, color: "#6ee7b7", opacity: 0.68 },
      ]
    : [
        { w: SW * 0.90, h: 58, color: "#6d28d9", opacity: 0.20 },
        { w: SW * 0.70, h: 44, color: "#7c3aed", opacity: 0.28 },
        { w: SW * 0.50, h: 32, color: "#a021c9", opacity: 0.36 },
        { w: SW * 0.32, h: 22, color: "#d946ef", opacity: 0.48 },
        { w: SW * 0.16, h: 12, color: "#f0abfc", opacity: 0.65 },
      ];
  const stageGlowColor1 = isStudio ? "rgba(29,185,84,0.18)" : "rgba(124,58,237,0.18)";
  const stageGlowColor2 = isStudio ? "rgba(52,211,153,0.10)" : "rgba(167,139,250,0.10)";

  function pressEmote(id: string) {
    setActiveEmote(id);
    Animated.sequence([
      Animated.spring(emoteScale, { toValue: 1.18, useNativeDriver: true, speed: 60 }),
      Animated.spring(emoteScale, { toValue: 1,    useNativeDriver: true, speed: 30 }),
    ]).start();
    setTimeout(() => setActiveEmote(null), 1400);
  }

  return (
    <ScrollView contentContainerStyle={avStyles.scroll} showsVerticalScrollIndicator={false}>

      {/* ── Page header ── */}
      <View style={avStyles.pageHeader}>
        <Text style={avStyles.pageTitle}>My Avatar</Text>
        <View style={[avStyles.levelBadge, { borderColor: isStudio ? "rgba(52,211,153,0.4)" : "rgba(167,139,250,0.4)", backgroundColor: isStudio ? "rgba(29,185,84,0.15)" : "rgba(124,58,237,0.15)" }]}>
          <Text style={[avStyles.levelBadgeText, { color: accentColor }]}>
            {xp ? `⭐ Lv ${xp.level}  ·  ${xp.rank}` : "⭐ Lv 1  ·  DJ Rookie"}
          </Text>
        </View>
      </View>

      {/* ── Hero stage ── */}
      <View style={avStyles.stage}>
        {/* Background glow rings */}
        <View style={[avStyles.stageGlow1, { backgroundColor: stageGlowColor1 }]} pointerEvents="none" />
        <View style={[avStyles.stageGlow2, { backgroundColor: stageGlowColor2 }]} pointerEvents="none" />
        {/* Stage platform rings */}
        {platformRings.map((r, i) => (
          <View key={i} style={{
            position: "absolute", bottom: 0,
            width: r.w, height: r.h, borderRadius: r.h / 2,
            backgroundColor: r.color, opacity: r.opacity,
          }} />
        ))}

        {/* Active emote float */}
        {activeEmote && (
          <Animated.View style={[avStyles.emoteFloat, { transform: [{ scale: emoteScale }] }]}>
            <Text style={avStyles.emoteFloatText}>
              {EMOTES.find(e => e.id === activeEmote)?.emoji}
            </Text>
          </Animated.View>
        )}

        <Avatar3D
          size={avatarSize}
          bodyColor={BODY_COLORS[bodyIdx]}
          headphoneColor={HP_COLORS[hpIdx]}
          outfitColor={OUTFIT_COLORS[outfitColorIdx]}
          expression={EXPRESSIONS[exprIdx]}
          outfit={outfitId}
        />

        {/* Level pill */}
        <View style={[avStyles.levelPill, {
          backgroundColor: isStudio ? "rgba(29,185,84,0.28)" : "rgba(124,58,237,0.30)",
          borderColor: isStudio ? "rgba(52,211,153,0.45)" : "rgba(167,139,250,0.4)",
        }]}>
          <Text style={[avStyles.levelPillText, { color: accentColor }]}>
            {xp ? `⭐ Lv ${xp.level}  ·  ${xp.rank}` : "⭐ Lv 1  ·  DJ Rookie"}
          </Text>
        </View>
      </View>

      {/* ── XP bar ── */}
      <View style={avStyles.xpBar}>
        <View style={avStyles.xpRow}>
          <Text style={avStyles.xpLabel}>XP Progress</Text>
          <Text style={[avStyles.xpValue, { color: accentColor }]}>
            {xp ? `${xp.currentXP} / ${xp.levelXP}` : "0 / 100"}
          </Text>
        </View>
        <View style={avStyles.xpTrack}>
          <LinearGradient colors={xpGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[avStyles.xpFill, { width: `${Math.round((xp?.progress ?? 0) * 100)}%` }]} />
        </View>
      </View>

      {/* ── Customizer card ── */}
      <View style={avStyles.card}>
        <Text style={avStyles.cardTitle}>Customize</Text>

        {/* Outfit row */}
        <Text style={avStyles.sectionLabel}>Outfit</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={avStyles.outfitRow}>
          {OUTFITS.map((o) => (
            <TouchableOpacity
              key={o.id}
              style={[avStyles.outfitChip, outfitId === o.id && avStyles.outfitChipActive]}
              onPress={() => setOutfitId(o.id)}
            >
              <Text style={avStyles.outfitEmoji}>{o.emoji}</Text>
              <Text style={[avStyles.outfitLabel, outfitId === o.id && avStyles.outfitLabelActive]}>{o.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Color rows */}
        <CustomizerRow label="Body" colors={BODY_COLORS}   selectedIdx={bodyIdx}       onSelect={setBodyIdx} />
        <CustomizerRow label="Headphones" colors={HP_COLORS} selectedIdx={hpIdx}        onSelect={setHpIdx} />
        <CustomizerRow label="Outfit" colors={OUTFIT_COLORS} selectedIdx={outfitColorIdx} onSelect={setOutfitColorIdx} />

        {/* Expression */}
        <Text style={avStyles.sectionLabel}>Expression</Text>
        <View style={avStyles.exprRow}>
          {EXPRESSIONS.map((e, i) => (
            <TouchableOpacity
              key={e}
              style={[avStyles.exprBtn, exprIdx === i && avStyles.exprBtnOn]}
              onPress={() => setExprIdx(i)}
            >
              <Text style={avStyles.exprEmoji}>
                {e === "happy" ? "😄" : e === "cool" ? "😎" : "🥳"}
              </Text>
              <Text style={[avStyles.exprLabel, exprIdx === i && avStyles.exprLabelOn]}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Emotes section ── */}
      <View style={avStyles.card}>
        <View style={avStyles.emotesHeader}>
          <Text style={avStyles.cardTitle}>Emotes</Text>
          <Text style={avStyles.emotesHint}>Tap to preview · Use in rooms</Text>
        </View>
        <View style={avStyles.emoteGrid}>
          {EMOTES.map((em) => (
            <TouchableOpacity
              key={em.id}
              style={[avStyles.emoteBtn, activeEmote === em.id && avStyles.emoteBtnActive]}
              onPress={() => pressEmote(em.id)}
              activeOpacity={0.75}
            >
              <Text style={avStyles.emoteEmoji}>{em.emoji}</Text>
              <Text style={avStyles.emoteLabel}>{em.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Wardrobe shop ── */}
      <View style={avStyles.shopHeader}>
        <Text style={avStyles.shopTitle}>Wardrobe Shop</Text>
        <Text style={avStyles.shopSub}>Unlock with Vibe Credits</Text>
      </View>
      <WardrobeShop
        guestId={guestId ?? null}
        bodyColor={BODY_COLORS[bodyIdx]}
        onEquip={(outfit) => setOutfitId(outfit)}
      />
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const avStyles = StyleSheet.create({
  scroll: { paddingBottom: 40 },

  // Page header
  pageHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)",
    marginBottom: 0,
  },
  pageTitle:      { color: "#fff", fontSize: 26, fontWeight: "900" },
  levelBadge:     { borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 5 },
  levelBadgeText: { fontSize: 12, fontWeight: "700" },

  // Stage
  stage: {
    height: 380, alignItems: "center", justifyContent: "flex-end",
    position: "relative", overflow: "hidden",
  },
  stageGlow1: {
    position: "absolute", top: 20, width: SW * 0.8, height: SW * 0.8,
    borderRadius: SW * 0.4, backgroundColor: "rgba(124,58,237,0.18)",
  },
  stageGlow2: {
    position: "absolute", top: 60, width: SW * 0.5, height: SW * 0.5,
    borderRadius: SW * 0.25, backgroundColor: "rgba(167,139,250,0.10)",
  },
  emoteFloat: {
    position: "absolute", top: 40, zIndex: 10,
  },
  emoteFloatText: { fontSize: 56 },
  levelPill: {
    position: "absolute", bottom: 16,
    backgroundColor: "rgba(124,58,237,0.30)",
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6,
    borderWidth: 1, borderColor: "rgba(167,139,250,0.4)",
  },
  levelPillText: { color: "#a78bfa", fontSize: 13, fontWeight: "700" },

  // XP bar (avatar tab — kept for reference)
  xpBar: { marginHorizontal: 16, marginTop: 12, marginBottom: 4 },
  xpValue: { color: "#a78bfa", fontSize: 12, fontWeight: "700" },

  // XP bar (home hero card)
  xpRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingBottom: 14 },
  xpTrack: { flex: 1, height: 5, backgroundColor: "#1e1b30", borderRadius: 3, overflow: "hidden" },
  xpFill:  { width: "18%", height: "100%", backgroundColor: "#7c3aed", borderRadius: 3 },
  xpLabel: { color: "#6b63a0", fontSize: 10 } as any,

  // Cards
  card: {
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    gap: 12,
  },
  cardTitle:    { color: "#fff", fontSize: 17, fontWeight: "800" },
  sectionLabel: { color: "#9ca3af", fontSize: 12, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },

  // Outfit
  outfitRow: { gap: 10, paddingBottom: 4 },
  outfitChip: {
    alignItems: "center", paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 14, backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.08)", minWidth: 72,
  },
  outfitChipActive: { borderColor: "#a78bfa", backgroundColor: "rgba(124,58,237,0.20)" },
  outfitEmoji:      { fontSize: 26, marginBottom: 4 },
  outfitLabel:      { color: "#6b7280", fontSize: 11, fontWeight: "600" },
  outfitLabelActive:{ color: "#a78bfa" },

  // Expression
  exprRow: { flexDirection: "row", gap: 10 },
  exprBtn: {
    flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.08)",
  },
  exprBtnOn:   { borderColor: "#a78bfa", backgroundColor: "rgba(124,58,237,0.20)" },
  exprEmoji:   { fontSize: 26, marginBottom: 4 },
  exprLabel:   { color: "#6b7280", fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  exprLabelOn: { color: "#a78bfa" },

  // Emotes
  emotesHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  emotesHint:   { color: "#6b7280", fontSize: 11 },
  emoteGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 10,
  },
  emoteBtn: {
    width: (SW - 32 - 36 - 36) / 4,
    alignItems: "center", paddingVertical: 12, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.07)",
  },
  emoteBtnActive: { borderColor: "#a78bfa", backgroundColor: "rgba(124,58,237,0.22)" },
  emoteEmoji:  { fontSize: 26, marginBottom: 4 },
  emoteLabel:  { color: "#6b7280", fontSize: 10, fontWeight: "600" },

  // Shop header
  shopHeader: { marginHorizontal: 16, marginTop: 24, marginBottom: 4, flexDirection: "row", alignItems: "baseline", gap: 8 },
  shopTitle:  { color: "#fff", fontSize: 17, fontWeight: "800" },
  shopSub:    { color: "#6b7280", fontSize: 12 },
});

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

  // Error toast
  errorToast: {
    position: "absolute",
    bottom: 90,           // sits just above the tab bar
    left: 16, right: 16,
    backgroundColor: "#2d0a0a",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ef444455",
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  errorToastText: { color: "#fca5a5", fontSize: 14, fontWeight: "600", flex: 1 },

  // Home tab scroll
  homeScroll: { paddingTop: 8, backgroundColor: "transparent" },

  // Top bar
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoWrap: {
    width: 44, height: 44,
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImg: {
    width: 34, height: 34,
  },
  brandName:    { color: "#fff", fontSize: 22, fontWeight: "900", letterSpacing: -0.3 },
  brandTagline: { color: "rgba(255,255,255,0.55)", fontSize: 11, marginTop: 1, fontWeight: "600", letterSpacing: 0.3 },
  topRight: { flexDirection: "row", alignItems: "center", gap: 8 },
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
    position: "absolute",
    bottom: 10,
    right: 16,
    backgroundColor: "rgba(26,26,46,0.85)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#2d2d4e",
  },
  heroPillText: { color: "#a5b4fc", fontSize: 12, fontWeight: "700" },

  // Streak pill + notif button (top bar)
  streakPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#1c1208", borderWidth: 1, borderColor: "#3a2410",
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  streakPillText: { color: "#fb923c", fontSize: 11, fontWeight: "600" },

  notifBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "#110e1e", borderWidth: 1, borderColor: "#221d3a",
    alignItems: "center", justifyContent: "center", position: "relative",
  },
  notifDot: {
    position: "absolute", top: 5, right: 5,
    width: 6, height: 6, borderRadius: 3, backgroundColor: "#ef4444",
    borderWidth: 1.5, borderColor: "#07050e",
  },

  // Avatar hero card (home tab)
  avatarHeroCard: {
    marginHorizontal: 16, marginBottom: 14,
    backgroundColor: "#110e1e", borderWidth: 1, borderColor: "#221d3a",
    borderRadius: 22, overflow: "hidden",
  },
  avatarCardGlow: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "transparent",
  },
  avatarCardTop: {
    height: 280, alignItems: "center", justifyContent: "flex-end",
    position: "relative", paddingBottom: 8,
  },
  emoteBubble: {
    position: "absolute", top: 14, right: 14, zIndex: 5,
    backgroundColor: "#1e1840", borderWidth: 1, borderColor: "#3a2f70",
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6,
  },
  emoteBubbleText: { color: "#c4b5fd", fontSize: 11, fontWeight: "600" },

  avatarCardInfo: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4,
  },
  avatarCardName: { color: "#f0ecff", fontSize: 18, fontWeight: "900" },
  avatarCardLevel: { marginTop: 3 },
  avatarCardLevelText: { color: "#a78bfa", fontSize: 11, fontWeight: "600" },

  heroStats: {
    flexDirection: "row", borderTopWidth: 1, borderTopColor: "#221d3a",
  },
  heroStat: { flex: 1, paddingVertical: 12, alignItems: "center" },
  heroStatNum: { color: "#f0ecff", fontSize: 18, fontWeight: "900", lineHeight: 22 },
  heroStatLabel: { color: "#6b63a0", fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 3 },

  // Live banner (replaces liveSection cards)
  liveBanner: {
    marginHorizontal: 16, marginBottom: 12,
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#110e1e", borderWidth: 1, borderColor: "#221d3a",
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11,
  },
  liveBannerDot: {
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: "#ef4444", flexShrink: 0,
  },
  liveBannerText: { flex: 1, fontSize: 12, color: "#9490c0" },
  liveBannerBtn: {
    backgroundColor: "#1e1840", borderWidth: 1, borderColor: "#3a2f70",
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  liveBannerBtnText: { color: "#a78bfa", fontSize: 11, fontWeight: "600" },

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
  modalOuter: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.75)" },
  modalSheet: {
    backgroundColor: "#0d0d1a",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderColor: "#2a2a4a",
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#333", alignSelf: "center", marginBottom: 24 },
  modalHead:  { alignItems: "center", marginBottom: 4, gap: 8 },
  modalIconWrap: { width: 64, height: 64, borderRadius: 20, backgroundColor: "#1a1040", borderWidth: 1, borderColor: "#7c3aed44", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  modalTitle: { color: "#fff", fontSize: 24, fontWeight: "900" },
  modalSub:   { color: "#666", fontSize: 14, textAlign: "center" },
  joinBtn:    { borderRadius: 16, padding: 18, alignItems: "center", marginTop: 4 },
  joinBtnText:{ color: "#fff", fontWeight: "800", fontSize: 17, letterSpacing: 0.3 },
  btnDisabled: { opacity: 0.45 },
  qrRow:      { alignItems: "center", marginTop: 20 },
  qrText:     { color: "#555", fontSize: 14 },
  cancelRow:  { alignItems: "center", marginTop: 14 },
  cancelText: { color: "#444", fontSize: 15, fontWeight: "600" },
  nameInput: {
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#333",
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 20,
    textAlign: "center",
  },
  // legacy — kept so other refs don't break
  codeInput:  { height: 0, overflow: "hidden" },
  modalRow:   { flexDirection: "row", gap: 12 },
  modalBtn:   { flex: 1, borderRadius: 14, padding: 16, alignItems: "center" },
  modalBtnPrimary:   { backgroundColor: "#7c3aed" },
  modalBtnSecondary: { backgroundColor: "#1a1a1a" },
  modalBtnTextPrimary:   { color: "#fff", fontWeight: "700", fontSize: 16 },
  modalBtnTextSecondary: { color: "#888", fontWeight: "700", fontSize: 16 },

  // Tab page headers
  tabHeader: {
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)",
    marginBottom: 8,
  },
  tabHeaderTitle: { color: "#fff", fontSize: 26, fontWeight: "900" },

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
  themeChipIcon:  { fontSize: 11 },
  themeChipLabel: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "600", letterSpacing: 0.4 },
  themeChipLabelOn: { color: "#fff", fontWeight: "700", letterSpacing: 0.4 },
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

  // DJ home section
  djHomeSection:       { marginHorizontal: 16, marginBottom: 20 },
  djHomeSectionHeader: { marginBottom: 8 },
  djHomeSectionLabel:  { color: "#6b7280", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  djHomeCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#110e1e", borderWidth: 1, borderColor: "#2a2450",
    borderRadius: 16, padding: 16, marginBottom: 10,
  },
  djHomeCardLeft:  { flex: 1 },
  djHomeCardTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },
  djHomeCardSub:   { color: "#7c6fa0", fontSize: 11, marginTop: 3 },
  djHomeBtn: {
    backgroundColor: "#7c3aed", borderRadius: 10,
    paddingHorizontal: 18, paddingVertical: 9,
  },
  djHomeBtnText:   { color: "#fff", fontSize: 13, fontWeight: "800" },
  djHomePillRow:   { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  djHomePill: {
    backgroundColor: "#1a1530", borderWidth: 1, borderColor: "#2a2450",
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  djHomePillText:  { color: "#a78bfa", fontSize: 11, fontWeight: "700" },
});
