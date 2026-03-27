import React, { useRef, useEffect, useState } from "react";
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, Alert, Image, ImageSourcePropType, Animated, Modal, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { GameLaunchModal } from "../shared/GameLaunchModal";
import { SkeletonShimmer } from "../shared/SkeletonShimmer";

const CARD_W = 142;
const CARD_H = 192;
const CHAR_SIZE = 74;

interface FloatProp { e: string; top?: number; bottom?: number; left?: number; right?: number; size?: number }

interface Game {
  id: string; title: string; tagline: string;
  label: string; labelColor: string;
  bgColors: string[]; accent: string;
  bodyColor: string; blushColor: string;
  floatProps: FloatProp[];
  image?: ImageSourcePropType;
}

// ─── Game images (drop files into assets/games/ then uncomment) ───────────────
// To add an image: save the file then replace null with require("../../assets/games/dj.jpg")

const GAME_IMAGES: Record<string, ImageSourcePropType | null> = {
  dj:                    require("../../../assets/dj.jpg"),
  trivia:                require("../../../assets/trivia.jpg"),
  unpopular_opinions:    require("../../../assets/opinions.jpg"),
  scrapbook_sabotage:    require("../../../assets/scrapbook.jpg"),
  the_glitch:            require("../../../assets/glitch.jpg"),
  drawback:              require("../../../assets/drawback.jpg"),
  scavenger_snap:        require("../../../assets/snap.jpg"),
  geo_guesser:           require("../../../assets/geo.jpg"),
};

// Map game IDs to their navigation route IDs
const GAME_ROUTES: Record<string, string> = {
  trivia:              "party_trivia",
  would_you_rather:    "would_you_rather",
  never_have_i_ever:   "never_have_i_ever",
  truth_or_dare:       "truth_or_dare",
  rank_it:             "rank_it",
  lyrics_drop:         "lyrics_drop",
  emoji_story:         "emoji_story",
  celebrity_head:      "celebrity_head",
  two_truths:          "two_truths_one_lie",
  word_association:    "word_association",
  who_knows_who:       "who_knows_who",
  fake_news:           "fake_news",
  pop_culture:         "pop_culture_quiz",
  improv:              "improv_challenge",
  alibi:               "alibi",
  cropped_look:        "cropped_look",
  mind_reading:        "mind_reading",
  speed_round:         "speed_round",
  musical_chairs:      "musical_chairs",
  thumb_war:           "thumb_war",
  hum_it:              "hum_it",
  mimic_me:            "mimic_me",
  accent:              "accent_challenge",
  connections:         "connections",
  chain_reaction:      "chain_reaction",
  party_dice:          "party_dice",
  geo_guesser:         "geo_guesser",
  unpopular_opinions:  "unpopular_opinions",
  drawback:            "drawback",
  the_glitch:          "the_glitch",
  scrapbook_sabotage:  "scrapbook_sabotage",
  scavenger_snap:      "scavenger_snap",
  copyright:           "copyright",
};

const GAMES: Game[] = [
  {
    id: "trivia",
    title: "Trivia", tagline: "Test your knowledge",
    label: "Think Fast", labelColor: "#f59e0b",
    bgColors: ["#0d2060", "#060e35"], accent: "#60a5fa",
    bodyColor: "#7ec8e3", blushColor: "#fda4af",
    floatProps: [{ e: "❓", top: 6, right: 8, size: 20 }, { e: "💡", top: 36, left: 5, size: 16 }, { e: "!", top: 8, left: 10, size: 18 }],
  },
  {
    id: "unpopular_opinions",
    title: "Opinions",
    tagline: "Guess who said it",
    label: "Funny", labelColor: "#eab308",
    bgColors: ["#3a0a1a", "#1a0510"], accent: "#f472b6",
    bodyColor: "#7ec8e3", blushColor: "#fda4af",
    floatProps: [{ e: "🎤", top: 6, right: 8, size: 20 }, { e: "💬", top: 34, left: 6, size: 14 }, { e: "❤️", bottom: 54, right: 8, size: 12 }],
  },
  {
    id: "scrapbook_sabotage",
    title: "Scrapbook", tagline: "Write & sabotage",
    label: "Creative", labelColor: "#8b5cf6",
    bgColors: ["#2a1a00", "#150d00"], accent: "#fbbf24",
    bodyColor: "#7ec8e3", blushColor: "#fde68a",
    floatProps: [{ e: "📒", top: 6, right: 6, size: 20 }, { e: "✏️", top: 36, left: 5, size: 16 }, { e: "💜", bottom: 52, right: 8, size: 12 }],
  },
  {
    id: "the_glitch",
    title: "The Glitch", tagline: "What did you watch?",
    label: "Glitchy", labelColor: "#a855f7",
    bgColors: ["#0a0630", "#050318"], accent: "#818cf8",
    bodyColor: "#7ec8e3", blushColor: "#c4b5fd",
    floatProps: [{ e: "👾", top: 6, right: 6, size: 20 }, { e: "📺", top: 36, left: 5, size: 15 }, { e: "⚡", bottom: 52, right: 8, size: 13 }],
  },
  {
    id: "drawback",
    title: "Drawback", tagline: "Draw what they say",
    label: "Draw It", labelColor: "#3b82f6",
    bgColors: ["#1a0a30", "#0a0518"], accent: "#c084fc",
    bodyColor: "#7ec8e3", blushColor: "#f0abfc",
    floatProps: [{ e: "🎨", top: 6, right: 8, size: 20 }, { e: "✏️", top: 36, left: 5, size: 15 }, { e: "🖼️", bottom: 52, right: 7, size: 12 }],
  },
  {
    id: "copyright",
    title: "Copyright", tagline: "Recreate famous art",
    label: "Art", labelColor: "#f59e0b",
    bgColors: ["#1a0a00", "#0d0800"], accent: "#f59e0b",
    bodyColor: "#fde68a", blushColor: "#fef3c7",
    floatProps: [{ e: "🎨", top: 6, right: 8, size: 20 }, { e: "🖼️", top: 36, left: 5, size: 15 }, { e: "✏️", bottom: 52, right: 7, size: 13 }],
  },
  {
    id: "scavenger_snap",
    title: "Snap Hunt", tagline: "Find it, snap it",
    label: "Quick", labelColor: "#22d3ee",
    bgColors: ["#001a30", "#000d18"], accent: "#22d3ee",
    bodyColor: "#7ec8e3", blushColor: "#a5f3fc",
    floatProps: [{ e: "📷", top: 5, right: 7, size: 22 }, { e: "✨", top: 36, left: 5, size: 14 }, { e: "🏆", bottom: 52, right: 8, size: 13 }],
  },
  {
    id: "geo_guesser",
    title: "GeoGuesser", tagline: "Pin the location",
    label: "Guess", labelColor: "#34d399",
    bgColors: ["#002a18", "#001510"], accent: "#34d399",
    bodyColor: "#7ec8e3", blushColor: "#6ee7b7",
    floatProps: [{ e: "🗺️", top: 6, right: 6, size: 20 }, { e: "📍", top: 36, left: 5, size: 16 }, { e: "🌍", bottom: 52, right: 7, size: 14 }],
  },
  {
    id: "would_you_rather",
    title: "Would You Rather", tagline: "Pick your poison",
    label: "Spicy", labelColor: "#ef4444",
    bgColors: ["#2a0010", "#150008"], accent: "#f87171",
    bodyColor: "#fca5a5", blushColor: "#fecdd3",
    floatProps: [{ e: "🤔", top: 6, right: 8, size: 20 }, { e: "⚡", top: 36, left: 5, size: 16 }, { e: "🔥", bottom: 52, right: 8, size: 13 }],
  },
  {
    id: "never_have_i_ever",
    title: "Never Have I Ever", tagline: "Confess or drink",
    label: "Party", labelColor: "#f97316",
    bgColors: ["#1a0a00", "#0d0500"], accent: "#fb923c",
    bodyColor: "#fdba74", blushColor: "#fed7aa",
    floatProps: [{ e: "🤫", top: 6, right: 8, size: 20 }, { e: "🥤", top: 36, left: 5, size: 16 }, { e: "😳", bottom: 52, right: 8, size: 14 }],
  },
  {
    id: "truth_or_dare",
    title: "Truth or Dare", tagline: "Brave enough?",
    label: "Bold", labelColor: "#dc2626",
    bgColors: ["#1a0000", "#0d0000"], accent: "#ef4444",
    bodyColor: "#fca5a5", blushColor: "#fecdd3",
    floatProps: [{ e: "💀", top: 6, right: 8, size: 20 }, { e: "🎯", top: 36, left: 5, size: 16 }, { e: "😈", bottom: 52, right: 8, size: 14 }],
  },
  {
    id: "rank_it",
    title: "Rank It", tagline: "Sort the list",
    label: "Strategy", labelColor: "#8b5cf6",
    bgColors: ["#12003a", "#080020"], accent: "#a78bfa",
    bodyColor: "#c4b5fd", blushColor: "#ddd6fe",
    floatProps: [{ e: "🏆", top: 6, right: 8, size: 20 }, { e: "📊", top: 36, left: 5, size: 16 }, { e: "1️⃣", bottom: 52, right: 8, size: 13 }],
  },
  {
    id: "lyrics_drop",
    title: "Lyrics Drop", tagline: "Fill the blank",
    label: "Music", labelColor: "#06b6d4",
    bgColors: ["#001a2a", "#000d14"], accent: "#22d3ee",
    bodyColor: "#67e8f9", blushColor: "#a5f3fc",
    floatProps: [{ e: "🎵", top: 6, right: 8, size: 20 }, { e: "🎤", top: 36, left: 5, size: 16 }, { e: "🎶", bottom: 52, right: 8, size: 13 }],
  },
  {
    id: "emoji_story",
    title: "Emoji Story", tagline: "Decode the emojis",
    label: "Creative", labelColor: "#f59e0b",
    bgColors: ["#1a0a30", "#0d0518"], accent: "#c084fc",
    bodyColor: "#e9d5ff", blushColor: "#f3e8ff",
    floatProps: [{ e: "😂", top: 6, right: 8, size: 20 }, { e: "🎬", top: 36, left: 5, size: 16 }, { e: "🤔", bottom: 52, right: 8, size: 14 }],
  },
  {
    id: "celebrity_head",
    title: "Celebrity Head", tagline: "Guess who you are",
    label: "Improv", labelColor: "#ec4899",
    bgColors: ["#1a0020", "#0d0010"], accent: "#f472b6",
    bodyColor: "#f9a8d4", blushColor: "#fbcfe8",
    floatProps: [{ e: "👑", top: 6, right: 8, size: 20 }, { e: "🌟", top: 36, left: 5, size: 16 }, { e: "🎭", bottom: 52, right: 8, size: 14 }],
  },
  {
    id: "two_truths",
    title: "Two Truths One Lie", tagline: "Spot the fake",
    label: "Bluff", labelColor: "#7c3aed",
    bgColors: ["#1a1000", "#0d0800"], accent: "#a78bfa",
    bodyColor: "#c4b5fd", blushColor: "#ddd6fe",
    floatProps: [{ e: "🤥", top: 6, right: 8, size: 20 }, { e: "🕵️", top: 36, left: 5, size: 16 }, { e: "✅", bottom: 52, right: 8, size: 14 }],
  },
  {
    id: "word_association",
    title: "Word Association", tagline: "First word that pops",
    label: "Fast", labelColor: "#10b981",
    bgColors: ["#00200a", "#001005"], accent: "#34d399",
    bodyColor: "#6ee7b7", blushColor: "#a7f3d0",
    floatProps: [{ e: "💭", top: 6, right: 8, size: 20 }, { e: "⚡", top: 36, left: 5, size: 16 }, { e: "🧠", bottom: 52, right: 8, size: 14 }],
  },
  {
    id: "who_knows_who",
    title: "Who Knows Who", tagline: "Who did it?",
    label: "Social", labelColor: "#0ea5e9",
    bgColors: ["#001a30", "#000d18"], accent: "#38bdf8",
    bodyColor: "#7dd3fc", blushColor: "#bae6fd",
    floatProps: [{ e: "👥", top: 6, right: 8, size: 20 }, { e: "🤔", top: 36, left: 5, size: 16 }, { e: "🏆", bottom: 52, right: 8, size: 14 }],
  },
  {
    id: "fake_news",
    title: "Fake News", tagline: "Real or fake headline?",
    label: "Think Fast", labelColor: "#f59e0b",
    bgColors: ["#1a1000", "#0d0800"], accent: "#fbbf24",
    bodyColor: "#fde68a", blushColor: "#fef3c7",
    floatProps: [{ e: "📰", top: 6, right: 8, size: 20 }, { e: "❓", top: 36, left: 5, size: 16 }, { e: "🗞️", bottom: 52, right: 8, size: 13 }],
  },
  {
    id: "pop_culture",
    title: "Pop Culture Quiz", tagline: "TV, film & music",
    label: "Think Fast", labelColor: "#f59e0b",
    bgColors: ["#0d2060", "#060e35"], accent: "#60a5fa",
    bodyColor: "#93c5fd", blushColor: "#bfdbfe",
    floatProps: [{ e: "🎬", top: 6, right: 8, size: 20 }, { e: "🌟", top: 36, left: 5, size: 16 }, { e: "🎵", bottom: 52, right: 8, size: 14 }],
  },
  {
    id: "improv",
    title: "Improv Challenge", tagline: "Act the scene out",
    label: "Improv", labelColor: "#ec4899",
    bgColors: ["#1a0020", "#0d0010"], accent: "#f472b6",
    bodyColor: "#f9a8d4", blushColor: "#fbcfe8",
    floatProps: [{ e: "🎭", top: 6, right: 8, size: 20 }, { e: "🎬", top: 36, left: 5, size: 16 }, { e: "🌟", bottom: 52, right: 8, size: 14 }],
  },
  {
    id: "alibi",
    title: "Alibi", tagline: "Who did the crime?",
    label: "Mystery", labelColor: "#6d28d9",
    bgColors: ["#0a0020", "#050010"], accent: "#7c3aed",
    bodyColor: "#a78bfa", blushColor: "#c4b5fd",
    floatProps: [{ e: "🔍", top: 6, right: 8, size: 20 }, { e: "🕵️", top: 36, left: 5, size: 16 }, { e: "⚖️", bottom: 52, right: 8, size: 14 }],
  },
  {
    id: "cropped_look",
    title: "Cropped Look", tagline: "Zoom in and guess",
    label: "Guess", labelColor: "#34d399",
    bgColors: ["#002a18", "#001510"], accent: "#34d399",
    bodyColor: "#6ee7b7", blushColor: "#a7f3d0",
    floatProps: [{ e: "🔎", top: 6, right: 8, size: 20 }, { e: "🖼️", top: 36, left: 5, size: 16 }, { e: "👁️", bottom: 52, right: 8, size: 14 }],
  },
  {
    id: "mind_reading",
    title: "Mind Reading", tagline: "What comes next?",
    label: "Brain", labelColor: "#8b5cf6",
    bgColors: ["#12003a", "#080020"], accent: "#a78bfa",
    bodyColor: "#c4b5fd", blushColor: "#ddd6fe",
    floatProps: [{ e: "🧠", top: 6, right: 8, size: 20 }, { e: "🔮", top: 36, left: 5, size: 16 }, { e: "✨", bottom: 52, right: 8, size: 14 }],
  },
  {
    id: "speed_round",
    title: "Speed Round", tagline: "30 seconds to name them",
    label: "Fast", labelColor: "#f97316",
    bgColors: ["#1a0a00", "#0d0500"], accent: "#fb923c",
    bodyColor: "#fdba74", blushColor: "#fed7aa",
    floatProps: [{ e: "⏱️", top: 6, right: 8, size: 20 }, { e: "⚡", top: 36, left: 5, size: 16 }, { e: "🏆", bottom: 52, right: 8, size: 14 }],
  },
  {
    id: "musical_chairs",
    title: "Musical Chairs", tagline: "Tap before the music stops",
    label: "Active", labelColor: "#22d3ee",
    bgColors: ["#001a30", "#000d18"], accent: "#22d3ee",
    bodyColor: "#67e8f9", blushColor: "#a5f3fc",
    floatProps: [{ e: "🪑", top: 6, right: 8, size: 20 }, { e: "🎵", top: 36, left: 5, size: 16 }, { e: "💨", bottom: 52, right: 8, size: 14 }],
  },
  {
    id: "thumb_war",
    title: "Thumb War", tagline: "Tap fastest to win",
    label: "Active", labelColor: "#ef4444",
    bgColors: ["#1a0000", "#0d0000"], accent: "#ef4444",
    bodyColor: "#fca5a5", blushColor: "#fecdd3",
    floatProps: [{ e: "👍", top: 6, right: 8, size: 20 }, { e: "⚡", top: 36, left: 5, size: 16 }, { e: "🏆", bottom: 52, right: 8, size: 14 }],
  },
  {
    id: "hum_it",
    title: "Hum It", tagline: "Hum the tune",
    label: "Music", labelColor: "#ec4899",
    bgColors: ["#1a0020", "#0d0010"], accent: "#f472b6",
    bodyColor: "#f9a8d4", blushColor: "#fbcfe8",
    floatProps: [{ e: "🎵", top: 6, right: 8, size: 20 }, { e: "🎤", top: 36, left: 5, size: 16 }, { e: "🎶", bottom: 52, right: 8, size: 13 }],
  },
  {
    id: "mimic_me",
    title: "Mimic Me", tagline: "Copy the move",
    label: "Active", labelColor: "#10b981",
    bgColors: ["#00200a", "#001005"], accent: "#34d399",
    bodyColor: "#6ee7b7", blushColor: "#a7f3d0",
    floatProps: [{ e: "🪞", top: 6, right: 8, size: 20 }, { e: "🕺", top: 36, left: 5, size: 16 }, { e: "💃", bottom: 52, right: 8, size: 14 }],
  },
  {
    id: "accent",
    title: "Accent Challenge", tagline: "Read it in the accent",
    label: "Improv", labelColor: "#f59e0b",
    bgColors: ["#1a0a00", "#0d0500"], accent: "#fbbf24",
    bodyColor: "#fde68a", blushColor: "#fef3c7",
    floatProps: [{ e: "🗣️", top: 6, right: 8, size: 20 }, { e: "🌍", top: 36, left: 5, size: 16 }, { e: "😂", bottom: 52, right: 8, size: 14 }],
  },
  {
    id: "connections",
    title: "Connections", tagline: "Find the 4 groups",
    label: "Brain", labelColor: "#f59e0b",
    bgColors: ["#1a1000", "#0d0800"], accent: "#fbbf24",
    bodyColor: "#fde68a", blushColor: "#fef3c7",
    floatProps: [{ e: "🔗", top: 6, right: 8, size: 20 }, { e: "🧩", top: 36, left: 5, size: 16 }, { e: "💡", bottom: 52, right: 8, size: 14 }],
  },
  {
    id: "chain_reaction",
    title: "Chain Reaction", tagline: "Word starts with last letter",
    label: "Word", labelColor: "#10b981",
    bgColors: ["#00200a", "#001005"], accent: "#34d399",
    bodyColor: "#6ee7b7", blushColor: "#a7f3d0",
    floatProps: [{ e: "🔗", top: 6, right: 8, size: 20 }, { e: "⚡", top: 36, left: 5, size: 16 }, { e: "🔤", bottom: 52, right: 8, size: 14 }],
  },
  {
    id: "party_dice",
    title: "Party Dice", tagline: "Roll for a challenge",
    label: "Party", labelColor: "#b5179e",
    bgColors: ["#1a0020", "#0d0010"], accent: "#b5179e",
    bodyColor: "#f0abfc", blushColor: "#fae8ff",
    floatProps: [{ e: "🎲", top: 6, right: 8, size: 20 }, { e: "🎯", top: 36, left: 5, size: 16 }, { e: "🎉", bottom: 52, right: 8, size: 14 }],
  },
];

// ─── Mascot character (fallback when no image) ────────────────────────────────

function MascotCharacter({ bodyColor, blushColor, size: s }: { bodyColor: string; blushColor: string; size: number }) {
  return (
    <View style={{ width: s, height: s * 1.15, alignItems: "center" }}>
      {/* Tuft */}
      <View style={{ position: "absolute", top: 0, width: s * 0.13, height: s * 0.16, borderRadius: s * 0.08, backgroundColor: bodyColor, zIndex: 2 }} />
      <View style={{ position: "absolute", top: s * 0.04, left: s * 0.29, width: s * 0.10, height: s * 0.12, borderRadius: s * 0.06, backgroundColor: bodyColor, zIndex: 2 }} />
      <View style={{ position: "absolute", top: s * 0.04, right: s * 0.29, width: s * 0.10, height: s * 0.12, borderRadius: s * 0.06, backgroundColor: bodyColor, zIndex: 2 }} />

      {/* Left arm */}
      <View style={{ position: "absolute", bottom: s * 0.18, left: -s * 0.04, width: s * 0.17, height: s * 0.26, borderRadius: s * 0.085, backgroundColor: bodyColor, transform: [{ rotate: "20deg" }] }} />
      {/* Right arm */}
      <View style={{ position: "absolute", bottom: s * 0.18, right: -s * 0.04, width: s * 0.17, height: s * 0.26, borderRadius: s * 0.085, backgroundColor: bodyColor, transform: [{ rotate: "-20deg" }] }} />

      {/* Body */}
      <View style={{
        position: "absolute", bottom: s * 0.12,
        width: s * 0.94, height: s * 0.88,
        borderRadius: s * 0.47,
        backgroundColor: bodyColor,
        alignItems: "center",
        shadowColor: bodyColor, shadowRadius: 12, shadowOpacity: 0.45, shadowOffset: { width: 0, height: 5 },
      }}>
        {/* Eyes */}
        <View style={{ flexDirection: "row", gap: s * 0.16, marginTop: s * 0.16 }}>
          <View style={{ width: s * 0.15, height: s * 0.15, borderRadius: s * 0.075, backgroundColor: "#1a1030", alignItems: "center", justifyContent: "flex-start", paddingTop: s * 0.025 }}>
            <View style={{ width: s * 0.055, height: s * 0.055, borderRadius: s * 0.028, backgroundColor: "rgba(255,255,255,0.75)" }} />
          </View>
          <View style={{ width: s * 0.15, height: s * 0.15, borderRadius: s * 0.075, backgroundColor: "#1a1030", alignItems: "center", justifyContent: "flex-start", paddingTop: s * 0.025 }}>
            <View style={{ width: s * 0.055, height: s * 0.055, borderRadius: s * 0.028, backgroundColor: "rgba(255,255,255,0.75)" }} />
          </View>
        </View>

        {/* Blush */}
        <View style={{ flexDirection: "row", gap: s * 0.25, marginTop: s * 0.04 }}>
          <View style={{ width: s * 0.14, height: s * 0.07, borderRadius: s * 0.035, backgroundColor: blushColor, opacity: 0.6 }} />
          <View style={{ width: s * 0.14, height: s * 0.07, borderRadius: s * 0.035, backgroundColor: blushColor, opacity: 0.6 }} />
        </View>

        {/* Open mouth */}
        <View style={{ width: s * 0.30, height: s * 0.17, borderRadius: s * 0.085, backgroundColor: "#7f1d1d", marginTop: s * 0.04, overflow: "hidden", alignItems: "center" }}>
          <View style={{ width: "88%", height: s * 0.07, backgroundColor: "#fef2f2", borderBottomLeftRadius: s * 0.06, borderBottomRightRadius: s * 0.06 }} />
        </View>
      </View>

      {/* Feet */}
      <View style={{ flexDirection: "row", gap: s * 0.07, position: "absolute", bottom: 0 }}>
        <View style={{ width: s * 0.28, height: s * 0.14, borderRadius: s * 0.07, backgroundColor: bodyColor }} />
        <View style={{ width: s * 0.28, height: s * 0.14, borderRadius: s * 0.07, backgroundColor: bodyColor }} />
      </View>
    </View>
  );
}

// ─── Animated Game Card ───────────────────────────────────────────────────────

function GameCard({ game, img, isTrending, onPress }: {
  game: Game; img: ImageSourcePropType | null; isTrending: boolean; onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const glow  = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  // Pulsing border for trending card
  useEffect(() => {
    if (!isTrending) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.5, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,   duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const onPressIn = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 0.95, useNativeDriver: true }),
      Animated.timing(glow,  { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  };
  const onPressOut = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
      Animated.timing(glow,  { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  return (
    <Animated.View style={[styles.cardWrap, { transform: [{ scale }] }]}>
      {/* Trending pulse ring */}
      {isTrending && (
        <Animated.View style={[styles.trendingRing, {
          borderColor: game.accent,
          opacity: pulse.interpolate({ inputRange: [1, 1.5], outputRange: [0.6, 0.0] }),
          transform: [{ scale: pulse }],
        }]} />
      )}
      <TouchableOpacity
        style={[styles.card, { borderColor: game.accent + "88" }]}
        activeOpacity={1}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
        {img ? (
          <>
            <Image source={img} style={styles.cardImage} resizeMode="cover" />
            <LinearGradient colors={["transparent", "rgba(10,5,20,0.95)"]} style={styles.cardImageOverlay} />
            {/* Game label badge — top left */}
            <View style={[styles.labelBadge, { backgroundColor: game.labelColor }]}>
              <Text style={styles.labelText}>{game.label}</Text>
            </View>
          </>
        ) : (
          <LinearGradient colors={game.bgColors as any} style={styles.cardTop}>
            <View style={[styles.charGlow, { backgroundColor: game.accent + "1a" }]} />
            {game.floatProps.map((p, i) => (
              <Text key={i} style={[styles.floatProp, {
                top: p.top, bottom: p.bottom, left: p.left, right: p.right, fontSize: p.size ?? 16,
              }]}>{p.e}</Text>
            ))}
            <Text style={{ fontSize: 52 }}>{game.floatProps[0]?.e ?? "🎮"}</Text>
          </LinearGradient>
        )}
        {/* Press glow overlay */}
        <Animated.View style={[StyleSheet.absoluteFill, {
          borderRadius: 18,
          backgroundColor: game.accent + "22",
          opacity: glow,
        }]} />
        <View style={styles.cardFooter}>
          {isTrending && <Text style={[styles.trendingBadge, { color: game.accent }]}>🔥 Trending</Text>}
          <Text style={styles.cardTitle}>{game.title}</Text>
          <Text style={styles.cardSub}>{game.tagline}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Game detail data ──────────────────────────────────────────────────────────
export const GAME_DETAILS: Record<string, { description: string; howToPlay: string[]; players: string; category: string }> = {
  dj:                    { description: "Take control of the room. Load tracks onto two decks, mix with the crossfader, and read the crowd state to keep energy high all night.", howToPlay: ["Load a track onto Deck A or B", "Use the crossfader to blend between decks", "Watch the crowd state — adjust your set to match", "Guests vote and request songs in real time"], players: "1 DJ + up to 50 guests", category: "Music" },
  trivia:                { description: "Music trivia battles where everyone plays. The host reads questions, guests buzz in, and points stack up on the leaderboard.", howToPlay: ["Host picks a trivia category", "Questions appear on all screens", "First to answer correctly scores a point", "Most points after 10 rounds wins"], players: "2–20 players", category: "Think Fast" },
  unpopular_opinions:    { description: "Someone submits a hot take. Everyone else guesses who said it. Points for fooling people — and for being unpredictable.", howToPlay: ["Each player submits an unpopular opinion", "Opinions are read aloud anonymously", "Guess who said it to score", "Be sneaky — fool people for bonus points"], players: "3–12 players", category: "Funny" },
  scrapbook_sabotage:    { description: "Build a collaborative story — but someone is secretly sabotaging it. Write chapters, spot the saboteur, vote them out.", howToPlay: ["One player is secretly the saboteur", "Everyone writes one chapter per round", "Vote on who you think is sabotaging", "Saboteur wins if they stay hidden"], players: "4–10 players", category: "Creative" },
  the_glitch:            { description: "TV clips play with the sound cut at key moments. Fill in what you think they said. Funniest answer wins the round.", howToPlay: ["A clip plays with the audio muted at a key moment", "Submit what you think was said", "Everyone votes on the funniest answer", "Most votes wins the round"], players: "3–15 players", category: "Glitchy" },
  drawback:              { description: "One player draws. Everyone else submits captions. The host picks the funniest one. Rotate and repeat.", howToPlay: ["Drawer gets a secret prompt", "Draw it in 60 seconds", "Others submit captions for your drawing", "Host picks the winner"], players: "3–10 players", category: "Draw It" },
  scavenger_snap:        { description: "Race to find real objects around you matching the clue. First to snap a photo and submit wins the point.", howToPlay: ["A clue appears on all screens", "Find the object in your surroundings", "Snap a photo and submit it", "Fastest verified snap wins the round"], players: "2–20 players", category: "Quick" },
  geo_guesser:           { description: "A location photo drops — pin it on the map. Closest guess wins. Bonus points for nailing the country and city.", howToPlay: ["A mystery location photo appears", "Drop a pin on the world map", "Closest pin to the real spot scores highest", "5 rounds, cumulative score wins"], players: "2–20 players", category: "Guess" },
  would_you_rather:      { description: "Two terrible choices, one decision. Pick your option and see how the rest of the group voted — are you in the majority or the wild card?", howToPlay: ["Read the two options carefully", "Tap the one you'd rather do", "See how the group voted after locking in", "+200 pts for majority, +50 pts for minority"], players: "2–20 players", category: "Spicy" },
  never_have_i_ever:     { description: "Classic party confessional game. Read the prompt — if you've done it, you've got to fess up (or take a sip). Tallies mount as the truths come out.", howToPlay: ["A 'Never have I ever…' prompt appears", "Tap 'I HAVE' or 'NEVER'", "Your drink counter goes up for each I HAVE", "See the full results after 15 rounds"], players: "2–15 players", category: "Party" },
  truth_or_dare:         { description: "The classic! Spin to pick a player, choose Truth or Dare, and either spill the tea or take the challenge. One pass allowed per game.", howToPlay: ["Tap SPIN to pick a player", "Choose TRUTH or DARE", "Complete the challenge to earn points", "You get 1 pass — use it wisely!"], players: "3–10 players", category: "Bold" },
  rank_it:               { description: "5 items. 1 correct order. Use the ↑↓ buttons to rank them, then see how you compare to the 'official' ranking. Exact matches score big.", howToPlay: ["Tap ↑↓ to reorder the items", "Submit when you're happy with your ranking", "Compare to the correct ranking", "+300 for exact matches, +200 for one-off"], players: "1–20 players", category: "Strategy" },
  lyrics_drop:           { description: "A famous lyric appears with one word missing. Type the missing word before the timer runs out. Speed bonus for fast correct answers.", howToPlay: ["Read the song lyric with the blank", "Type the missing word in the box", "Submit before the 15-second timer runs out", "Faster correct answers score more points"], players: "1–20 players", category: "Music" },
  emoji_story:           { description: "An emoji sequence represents a movie or show. Decode it! Use the hint if you're stuck (costs points). Type your best guess to score.", howToPlay: ["Look at the emoji sequence", "Think of what movie or show it represents", "Type your answer and tap Submit", "Use the hint button if stuck (costs -100 pts)"], players: "1–20 players", category: "Creative" },
  celebrity_head:        { description: "A celebrity name is on your head — but you can't see it! Ask yes/no questions to figure out who you are before the 60 seconds runs out.", howToPlay: ["Hold your phone to your forehead", "Ask yes/no questions to your group", "Your group answers GOT IT or PASS for each", "Figure out your celebrity before time's up!"], players: "2–10 players", category: "Improv" },
  two_truths:            { description: "Submit 3 facts about yourself — 2 true, 1 a lie. Everyone votes on which one is fake. Fool the most people for maximum points.", howToPlay: ["Type your 3 facts (2 truths, 1 lie)", "The group votes on which is the lie", "+300 pts for each person you fool", "+100 pts for correctly spotting others' lies"], players: "3–10 players", category: "Bluff" },
  word_association:      { description: "One word leads to another. Each player has 5 seconds to say the first word that comes to mind. Keep the chain going — hesitate and you're out!", howToPlay: ["A starter word appears", "Type the first word you associate with it", "You have 5 seconds per turn", "Bots take turns between players"], players: "2–10 players", category: "Fast" },
  who_knows_who:         { description: "'Who in this group is most likely to…' — vote and see how the group agrees. Match the majority answer for points. Reveals who people really see you as.", howToPlay: ["Read the 'who in this group' question", "Vote for the person you think fits best", "See how everyone voted after submitting", "+250 pts for matching the majority"], players: "3–12 players", category: "Social" },
  fake_news:             { description: "Real headline or fabricated fiction? A headline appears and you call it: REAL or FAKE. Build a streak multiplier for maximum points.", howToPlay: ["Read the headline carefully", "Tap REAL or FAKE", "Build streaks for bonus multipliers", "10 headlines total — highest score wins"], players: "1–20 players", category: "Think Fast" },
  pop_culture:           { description: "10 questions across TV, Film, Music, and Social Media. Beat the 12-second timer for max points. A true pop culture champion earns over 800.", howToPlay: ["Read the question and 4 answer options", "Tap your answer before time runs out", "Faster correct answers score more", "Cover TV, Film, Music & Social categories"], players: "1–20 players", category: "Think Fast" },
  improv:                { description: "You get a WHO, WHERE, and WHAT. Act out the scene for 60 seconds. Your group rates your performance. The best improv actor wins.", howToPlay: ["Get your WHO, WHERE, and WHAT scenario", "Perform the scene for 60 seconds", "Your group shouts 'Scene!' when they rate it", "+300 pts for a completed performance"], players: "3–10 players", category: "Improv" },
  alibi:                 { description: "A silly crime has been committed! Four suspects each have an alibi. Listen carefully, then vote for who you think is guilty. 3 cases to crack.", howToPlay: ["Read the crime that was committed", "Hear each suspect's alibi", "Vote for who you think is guilty", "+400 pts for a correct accusation"], players: "3–12 players", category: "Mystery" },
  cropped_look:          { description: "A zoomed-in emoji grid represents a famous thing. Slowly zoom out as you type guesses. Hit it early for maximum points.", howToPlay: ["Look at the zoomed-in emoji representation", "Type your guess into the text box", "The zoom will reveal more over time", "Tap the hint button if you're stuck"], players: "1–20 players", category: "Guess" },
  mind_reading:          { description: "A number sequence appears — spot the pattern and predict the next number. 4 options given. Pattern rule revealed after each answer.", howToPlay: ["Study the number sequence", "Select the next number in the pattern", "The rule is revealed after you answer", "+points based on speed and accuracy"], players: "1–20 players", category: "Brain" },
  speed_round:           { description: "7 categories, 30 seconds each. Name as many things as you can in the category before time runs out. Tap DONE when finished, SKIP to bail.", howToPlay: ["Read the category challenge", "Complete the challenge within 30 seconds", "Tap DONE when finished for +pts", "Tap SKIP if it's too hard (no points)"], players: "1–20 players", category: "Fast" },
  musical_chairs:        { description: "Digital musical chairs! Seats pulse while the 'music plays' — tap your seat the instant it stops. Last one to tap each round is eliminated.", howToPlay: ["Watch the seats pulse to the beat", "When the music stops, tap your seat FAST", "Last person to tap is eliminated", "+500 pts for surviving each round"], players: "3–12 players", category: "Active" },
  thumb_war:             { description: "Rapid-tap thumb war! Mash the big TAP button as fast as you can in 5 seconds. Out-tap the bot to win the round. 5 rounds total.", howToPlay: ["Tap TAP! as fast as you can", "You have 5 seconds per round", "Out-tap the bot to win the round", "Most rounds won after 5 total wins"], players: "1–10 players", category: "Active" },
  hum_it:                { description: "The hummer sees a song title and has 10 seconds to hum it. Everyone else votes whether they got it right. Audience scores points for correct calls.", howToPlay: ["The hummer sees a secret song title", "They have 10 seconds to hum it", "Tap GOT IT or DIDN'T GET IT to vote", "+200 pts for correct votes"], players: "3–10 players", category: "Music" },
  mimic_me:              { description: "An emoji + instruction appears. Study it for 3 seconds, then perform it for 10. Group rates you: Bad, Good, or Perfect. Highest-rated performance wins.", howToPlay: ["Study the emoji and instruction for 3 seconds", "Perform the action when the timer starts", "Group rates your performance", "+0 / +150 / +300 pts for Bad/Good/Perfect"], players: "2–10 players", category: "Active" },
  accent:                { description: "You get a random accent and a phrase. Read it convincingly for 30 seconds — then your group rates your performance. Spot On scores max points.", howToPlay: ["Get your random accent and phrase", "Practice reading it in the accent", "Your group rates: Bad / OK / Good / Spot On", "Higher rating = more points earned"], players: "2–10 players", category: "Improv" },
  connections:           { description: "16 words, 4 hidden groups of 4. Find all the connections to solve the puzzle. The fewer mistakes, the higher your score. Can you get a perfect run?", howToPlay: ["Select 4 words you think share a connection", "Tap Submit to check your group", "Correct groups are revealed with color coding", "Minimize mistakes for a perfect score"], players: "1–20 players", category: "Brain" },
  chain_reaction:        { description: "Each word in the chain must start with the last letter of the previous word. Pick a category and keep the chain going. Bots compete against you!", howToPlay: ["Pick a category to start", "Type a word that starts with the required letter", "Submit before the 8-second timer runs out", "+100 + timer bonus per word added"], players: "1–10 players", category: "Word" },
  party_dice:            { description: "Roll the dice! Each number gets a different party challenge — higher numbers mean spicier dares and bigger point rewards. Complete 6 rounds!", howToPlay: ["Tap ROLL to roll the dice", "Complete the challenge shown", "Tap DONE to advance to the next round", "Complete all 6 rounds for a final score"], players: "1–20 players", category: "Party" },
};

// ─── Game Detail Modal ────────────────────────────────────────────────────────
function GameDetailModal({ game, img, onClose }: { game: Game; img: ImageSourcePropType | null; onClose: () => void }) {
  const router = useRouter();
  const slideY = useRef(new Animated.Value(400)).current;
  const detail = GAME_DETAILS[game.id];

  useEffect(() => {
    Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 180 }).start();
  }, []);

  function close() {
    Animated.timing(slideY, { toValue: 500, duration: 200, useNativeDriver: true }).start(onClose);
  }

  // Mock stats
  const stats = [
    { label: "Games Played", value: "0" },
    { label: "Wins",         value: "0" },
    { label: "Best Streak",  value: "—" },
  ];

  return (
    <Modal transparent animationType="fade" onRequestClose={close}>
      <TouchableOpacity style={detailStyles.backdrop} activeOpacity={1} onPress={close} />
      <Animated.View style={[detailStyles.sheet, { transform: [{ translateY: slideY }] }]}>
        {/* Header image or gradient */}
        <View style={detailStyles.imgWrap}>
          {img ? (
            <Image source={img} style={detailStyles.img} resizeMode="cover" />
          ) : (
            <LinearGradient colors={game.bgColors as any} style={detailStyles.img} />
          )}
          <LinearGradient colors={["transparent", "#111"]} style={detailStyles.imgFade} />
          <View style={[detailStyles.labelPill, { backgroundColor: game.labelColor }]}>
            <Text style={detailStyles.labelPillText}>{game.label}</Text>
          </View>
          <TouchableOpacity style={detailStyles.closeBtn} onPress={close}>
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={detailStyles.body}>
          {/* Handle */}
          <View style={detailStyles.handle} />

          <Text style={detailStyles.title}>{game.title}</Text>
          <Text style={detailStyles.tagline}>{game.tagline}</Text>

          {detail && (
            <>
              <Text style={detailStyles.desc}>{detail.description}</Text>

              <View style={detailStyles.metaRow}>
                <Text style={detailStyles.metaChip}>👥 {detail.players}</Text>
                <Text style={detailStyles.metaChip}>🎮 {detail.category}</Text>
              </View>

              <Text style={detailStyles.sectionHead}>HOW TO PLAY</Text>
              {detail.howToPlay.map((step, i) => (
                <View key={i} style={detailStyles.stepRow}>
                  <View style={[detailStyles.stepNum, { backgroundColor: game.accent + "33" }]}>
                    <Text style={[detailStyles.stepNumText, { color: game.accent }]}>{i + 1}</Text>
                  </View>
                  <Text style={detailStyles.stepText}>{step}</Text>
                </View>
              ))}

              <Text style={detailStyles.sectionHead}>YOUR STATS</Text>
              <View style={detailStyles.statsRow}>
                {stats.map((s) => (
                  <View key={s.label} style={[detailStyles.statBox, { borderColor: game.accent + "44" }]}>
                    <Text style={[detailStyles.statVal, { color: game.accent }]}>{s.value}</Text>
                    <Text style={detailStyles.statLabel}>{s.label}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          <TouchableOpacity
            style={[detailStyles.playBtn, { backgroundColor: game.accent }]}
            activeOpacity={0.85}
            onPress={() => {
              const routeId = GAME_ROUTES[game.id];
              if (routeId) { close(); router.push(`/games/${routeId}` as any); }
              else { close(); }
            }}
          >
            <Text style={detailStyles.playBtnText}>
              {GAME_ROUTES[game.id] ? "Play Now" : "Play in a Room"}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const detailStyles = StyleSheet.create({
  backdrop:   { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.7)" },
  sheet:      { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#111", borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "88%", overflow: "hidden" },
  imgWrap:    { height: 180, position: "relative" },
  img:        { width: "100%", height: "100%" },
  imgFade:    { position: "absolute", bottom: 0, left: 0, right: 0, height: 80 },
  labelPill:  { position: "absolute", top: 14, left: 16, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  labelPillText: { color: "#fff", fontSize: 9, fontWeight: "900", letterSpacing: 1.1, textTransform: "uppercase" },
  closeBtn:   { position: "absolute", top: 12, right: 14, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  handle:     { width: 36, height: 4, borderRadius: 2, backgroundColor: "#333", alignSelf: "center", marginBottom: 16 },
  body:       { padding: 20, paddingTop: 12 },
  title:      { color: "#fff", fontSize: 26, fontWeight: "900", marginBottom: 2 },
  tagline:    { color: "#888", fontSize: 14, marginBottom: 14 },
  desc:       { color: "#ccc", fontSize: 14, lineHeight: 21, marginBottom: 16 },
  metaRow:    { flexDirection: "row", gap: 8, marginBottom: 20, flexWrap: "wrap" },
  metaChip:   { backgroundColor: "#1e1e1e", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, color: "#aaa", fontSize: 12, fontWeight: "600" },
  sectionHead:{ color: "#555", fontSize: 10, fontWeight: "900", letterSpacing: 1.4, marginBottom: 10 },
  stepRow:    { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 10 },
  stepNum:    { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  stepNumText:{ fontSize: 12, fontWeight: "900" },
  stepText:   { color: "#ccc", fontSize: 13, lineHeight: 19, flex: 1 },
  statsRow:   { flexDirection: "row", gap: 10, marginBottom: 24, marginTop: 6 },
  statBox:    { flex: 1, backgroundColor: "#1a1a1a", borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1 },
  statVal:    { fontSize: 22, fontWeight: "900", marginBottom: 2 },
  statLabel:  { color: "#555", fontSize: 10, fontWeight: "600", textAlign: "center" },
  playBtn:    { borderRadius: 14, padding: 16, alignItems: "center", marginBottom: 8 },
  playBtnText:{ color: "#fff", fontSize: 16, fontWeight: "800" },
});

// ─── Carousel ─────────────────────────────────────────────────────────────────

const SNAP_INTERVAL = CARD_W + 12; // card width + gap
const PAD_H = 20; // matches contentContainerStyle paddingHorizontal

interface Props { onSelectGame?: (gameId: string) => void }

export function GamesCarousel({ onSelectGame }: Props) {
  const router = useRouter();
  const [selectedGame, setSelectedGame]   = useState<Game | null>(null);
  const [launchGame,   setLaunchGame]     = useState<Game | null>(null);
  const [showLaunch,   setShowLaunch]     = useState(false);
  const [showAll, setShowAll]             = useState(false);
  const [ready, setReady]                 = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 550);
    return () => clearTimeout(t);
  }, []);

  function handleCardPress(game: Game) {
    // Always show the Solo vs Party chooser first
    setLaunchGame(game);
    setShowLaunch(true);
  }

  function handleScrollEnd(e: any) {
    const x      = e.nativeEvent.contentOffset.x;
    const index  = Math.round((x - PAD_H) / SNAP_INTERVAL);
    const snapX  = Math.max(0, index) * SNAP_INTERVAL;
    scrollRef.current?.scrollTo({ x: snapX, animated: true });
  }

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.fire}>🔥</Text>
          <Text style={styles.title}>POPULAR PARTY GAMES</Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/games" as any)}>
          <Text style={styles.viewAll}>View All ›</Text>
        </TouchableOpacity>
      </View>

      {!ready ? (
        <View style={styles.skeletonRow}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonCard}>
              <SkeletonShimmer width={CARD_W} height={CARD_H * 0.62} borderRadius={18} />
              <View style={styles.skeletonFooter}>
                <SkeletonShimmer width={CARD_W * 0.7} height={13} borderRadius={6} />
                <SkeletonShimmer width={CARD_W * 0.9} height={10} borderRadius={6} style={{ marginTop: 6 }} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          decelerationRate="fast"
          snapToInterval={SNAP_INTERVAL}
          snapToAlignment="start"
          onMomentumScrollEnd={handleScrollEnd}
          onScrollEndDrag={handleScrollEnd}
          style={styles.scrollView}
        >
          {GAMES.map((game, idx) => {
            const img = GAME_IMAGES[game.id];
            const isTrending = idx === 0;
            return (
              <GameCard
                key={game.id}
                game={game}
                img={img}
                isTrending={isTrending}
                onPress={() => handleCardPress(game)}
              />
            );
          })}
        </ScrollView>
      )}

      {/* View All sheet */}
      {showAll && (
        <Modal transparent animationType="slide" onRequestClose={() => setShowAll(false)}>
          <TouchableOpacity style={detailStyles.backdrop} activeOpacity={1} onPress={() => setShowAll(false)} />
          <View style={allStyles.sheet}>
            <View style={allStyles.handle} />
            <Text style={allStyles.title}>All Party Games</Text>
            <ScrollView contentContainerStyle={allStyles.grid}>
              {GAMES.map((game) => {
                const img = GAME_IMAGES[game.id];
                return (
                  <TouchableOpacity key={game.id} style={allStyles.row} activeOpacity={0.8}
                    onPress={() => {
                      setShowAll(false);
                      const routeId = GAME_ROUTES[game.id];
                      if (routeId) { setTimeout(() => router.push(`/games/${routeId}` as any), 200); }
                      else { setTimeout(() => setSelectedGame(game), 200); }
                    }}>
                    <View style={[allStyles.thumb, { backgroundColor: game.accent + "33" }]}>
                      {img
                        ? <Image source={img} style={allStyles.thumbImg} resizeMode="cover" />
                        : <Text style={{ fontSize: 22 }}>{game.floatProps[0]?.e ?? "🎮"}</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={allStyles.rowTitle}>{game.title}</Text>
                      <Text style={allStyles.rowSub}>{game.tagline}</Text>
                    </View>
                    <View style={[allStyles.badge, { backgroundColor: game.labelColor + "33" }]}>
                      <Text style={[allStyles.badgeText, { color: game.labelColor }]}>{game.label}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </Modal>
      )}

      {selectedGame && (
        <GameDetailModal
          game={selectedGame}
          img={GAME_IMAGES[selectedGame.id]}
          onClose={() => setSelectedGame(null)}
        />
      )}

      <GameLaunchModal
        game={launchGame ? {
          id:          launchGame.id,
          title:       launchGame.title,
          tagline:     launchGame.tagline,
          emoji:       launchGame.floatProps[0]?.e ?? "🎮",
          routeId:     GAME_ROUTES[launchGame.id],
          description: GAME_DETAILS[launchGame.id]?.description,
          rules:       GAME_DETAILS[launchGame.id]?.howToPlay,
          players:     GAME_DETAILS[launchGame.id]?.players,
        } : null}
        visible={showLaunch}
        onClose={() => setShowLaunch(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 20, overflow: "hidden" },
  scrollView: { height: CARD_H + 20, flexGrow: 0 },
  skeletonRow: { flexDirection: "row", paddingHorizontal: 20, gap: 12, height: CARD_H + 20, alignItems: "flex-start", paddingTop: 4 },
  skeletonCard: { width: CARD_W, height: CARD_H, borderRadius: 18, overflow: "hidden", backgroundColor: "#12122a" },
  skeletonFooter: { padding: 10, gap: 0 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 12 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  fire:    { fontSize: 16 },
  title:   { color: "#fff", fontSize: 14, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase" },
  viewAll: { color: "#c084fc", fontSize: 13, fontWeight: "700" },

  scroll: { paddingHorizontal: 20, gap: 12, paddingBottom: 8, paddingTop: 4 },

  cardWrap: {
    position: "relative",
    flexShrink: 0,
  },
  trendingRing: {
    position: "absolute",
    top: -4, left: -4, right: -4, bottom: -4,
    borderRadius: 22,
    borderWidth: 2,
    zIndex: 0,
  },
  trendingBadge: {
    fontSize: 9, fontWeight: "800", letterSpacing: 0.5, marginBottom: 2,
  },
  card: {
    width: CARD_W, height: CARD_H,
    borderRadius: 18, borderWidth: 1.5,
    overflow: "hidden", backgroundColor: "#0d0117",
    shadowColor: "#a855f7", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 14, elevation: 8,
  },

  // Photo art
  cardImage: {
    width: CARD_W,
    height: CARD_H,
    position: "absolute",
    top: 0, left: 0,
    borderRadius: 18,
  },
  cardImageOverlay: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    height: 80,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },

  // Drawn mascot fallback
  cardTop: {
    flex: 1, alignItems: "center", justifyContent: "center",
    position: "relative", paddingTop: 8,
  },
  charGlow: {
    position: "absolute",
    width: CHAR_SIZE * 1.5, height: CHAR_SIZE * 1.5,
    borderRadius: CHAR_SIZE * 0.75,
  },
  floatProp: { position: "absolute" },

  // Label badge
  labelBadge: {
    position: "absolute",
    top: 9, left: 9,
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    shadowColor: "#000",
    shadowOpacity: 0.55,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  labelText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // Footer (shared)
  cardFooter: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: "rgba(10,5,20,0.80)",
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  cardTitle: { fontSize: 12, fontWeight: "800", color: "#fff" },
  cardSub:   { color: "rgba(255,255,255,0.5)", fontSize: 9, lineHeight: 13, marginTop: 1 },
});

const allStyles = StyleSheet.create({
  sheet:     { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#0d0d1a", borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "85%", paddingBottom: 24 },
  handle:    { width: 36, height: 4, borderRadius: 2, backgroundColor: "#333", alignSelf: "center", marginTop: 10, marginBottom: 16 },
  title:     { color: "#fff", fontSize: 20, fontWeight: "900", paddingHorizontal: 20, marginBottom: 12 },
  grid:      { paddingHorizontal: 16, gap: 4, paddingBottom: 20 },
  row:       { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: 14, backgroundColor: "#111" },
  thumb:     { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  thumbImg:  { width: 48, height: 48 },
  rowTitle:  { color: "#fff", fontSize: 14, fontWeight: "700" },
  rowSub:    { color: "#555", fontSize: 11, marginTop: 1 },
  badge:     { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
});
