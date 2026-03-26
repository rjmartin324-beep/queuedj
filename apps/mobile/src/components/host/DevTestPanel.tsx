import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, SafeAreaView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../contexts/RoomContext";
import type { ExperienceType } from "@queuedj/shared-types";

// Guest view components for preview modal
import { TriviaWaitingView }  from "../experiences/trivia/TriviaWaitingView";
import { TriviaQuestionView } from "../experiences/trivia/TriviaQuestionView";
import { LeaderboardView }    from "../experiences/trivia/LeaderboardView";

function GuestViewPreview({ guestView }: { guestView: string }) {
  switch (guestView) {
    case "trivia_waiting":  return <TriviaWaitingView />;
    case "trivia_question": return <TriviaQuestionView />;
    case "trivia_result":   return <TriviaQuestionView showResult />;
    case "leaderboard":     return <LeaderboardView />;
    default:
      return (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0a0a0a" }}>
          <Text style={{ color: "#555", fontSize: 16, textAlign: "center", padding: 32 }}>
            Preview not available for{"\n"}
            <Text style={{ color: "#6c47ff", fontWeight: "700" }}>{guestView}</Text>
            {"\n\n"}Open the Guest screen on another device to see this view.
          </Text>
        </View>
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dev / Test Panel — all game states with rich mock data
// ─────────────────────────────────────────────────────────────────────────────

interface TestState {
  label: string;
  emoji: string;
  guestView: string;
  guestViewData: unknown;
  expState: unknown;
}

const MOCK_GUEST_ID = "demo-guest";

const TEST_STATES: Record<ExperienceType, TestState[]> = {
  // ── DJ ──────────────────────────────────────────────────────────────────
  dj: [
    {
      label: "DJ Queue",
      emoji: "🎛️",
      guestView: "dj_queue",
      guestViewData: { nowPlaying: { title: "Blinding Lights", artist: "The Weeknd" } },
      expState: { phase: "playing" },
    },
  ],

  // ── Trivia ──────────────────────────────────────────────────────────────
  trivia: [
    {
      label: "Waiting Room",
      emoji: "⏳",
      guestView: "trivia_waiting",
      guestViewData: { playerCount: 8 },
      expState: { phase: "waiting", playerCount: 8 },
    },
    {
      label: "Question — Geography",
      emoji: "🌍",
      guestView: "trivia_question",
      guestViewData: {
        id: "q_geo_1",
        text: "What is the capital of Australia?",
        answers: ["Sydney", "Melbourne", "Canberra", "Brisbane"],
        options: [
          { id: "a", text: "Sydney" },
          { id: "b", text: "Melbourne" },
          { id: "c", text: "Canberra" },
          { id: "d", text: "Brisbane" },
        ],
        correctOptionId: "c",
        category: "Geography",
        timeLimitSeconds: 20,
        roundNumber: 1,
        totalRounds: 10,
      },
      expState: { phase: "question", roundNumber: 1, totalRounds: 10, scores: { [MOCK_GUEST_ID]: 0 } },
    },
    {
      label: "Question — Science",
      emoji: "⚗️",
      guestView: "trivia_question",
      guestViewData: {
        id: "q_sci_1",
        text: "What is the chemical symbol for gold?",
        options: [
          { id: "a", text: "Gd" },
          { id: "b", text: "Go" },
          { id: "c", text: "Au" },
          { id: "d", text: "Ag" },
        ],
        correctOptionId: "c",
        category: "Science",
        timeLimitSeconds: 20,
        roundNumber: 2,
        totalRounds: 10,
      },
      expState: { phase: "question", roundNumber: 2, totalRounds: 10, scores: { [MOCK_GUEST_ID]: 100 } },
    },
    {
      label: "Question — Music",
      emoji: "🎵",
      guestView: "trivia_question",
      guestViewData: {
        id: "q_mus_1",
        text: "Which band released the iconic album 'Abbey Road'?",
        options: [
          { id: "a", text: "The Rolling Stones" },
          { id: "b", text: "The Beatles" },
          { id: "c", text: "Led Zeppelin" },
          { id: "d", text: "Pink Floyd" },
        ],
        correctOptionId: "b",
        category: "Music",
        timeLimitSeconds: 20,
        roundNumber: 3,
        totalRounds: 10,
      },
      expState: { phase: "question", roundNumber: 3, totalRounds: 10, scores: { [MOCK_GUEST_ID]: 200 } },
    },
    {
      label: "Question — Pop Culture",
      emoji: "🎬",
      guestView: "trivia_question",
      guestViewData: {
        id: "q_pop_1",
        text: "What year was the first iPhone released?",
        options: [
          { id: "a", text: "2005" },
          { id: "b", text: "2006" },
          { id: "c", text: "2007" },
          { id: "d", text: "2008" },
        ],
        correctOptionId: "c",
        category: "Pop Culture",
        timeLimitSeconds: 20,
        roundNumber: 4,
        totalRounds: 10,
      },
      expState: { phase: "question", roundNumber: 4, totalRounds: 10, scores: { [MOCK_GUEST_ID]: 300 } },
    },
    {
      label: "Question — Sports",
      emoji: "⚽",
      guestView: "trivia_question",
      guestViewData: {
        id: "q_sp_1",
        text: "Which country has won the most FIFA World Cups?",
        options: [
          { id: "a", text: "Germany" },
          { id: "b", text: "Argentina" },
          { id: "c", text: "Italy" },
          { id: "d", text: "Brazil" },
        ],
        correctOptionId: "d",
        category: "Sports",
        timeLimitSeconds: 20,
        roundNumber: 5,
        totalRounds: 10,
      },
      expState: { phase: "question", roundNumber: 5, totalRounds: 10, scores: { [MOCK_GUEST_ID]: 400 } },
    },
    {
      label: "Question — Food",
      emoji: "🍕",
      guestView: "trivia_question",
      guestViewData: {
        id: "q_food_1",
        text: "Which country is the original home of pizza?",
        options: [
          { id: "a", text: "France" },
          { id: "b", text: "Greece" },
          { id: "c", text: "Italy" },
          { id: "d", text: "Spain" },
        ],
        correctOptionId: "c",
        category: "Food",
        timeLimitSeconds: 20,
        roundNumber: 6,
        totalRounds: 10,
      },
      expState: { phase: "question", roundNumber: 6, totalRounds: 10, scores: { [MOCK_GUEST_ID]: 500 } },
    },
    {
      label: "Answer Reveal",
      emoji: "✅",
      guestView: "trivia_result",
      guestViewData: {
        id: "q_geo_1",
        text: "What is the capital of Australia?",
        options: [
          { id: "a", text: "Sydney" },
          { id: "b", text: "Melbourne" },
          { id: "c", text: "Canberra" },
          { id: "d", text: "Brisbane" },
        ],
        correctOptionId: "c",
        category: "Geography",
        timeLimitSeconds: 20,
        roundNumber: 1,
        totalRounds: 10,
      },
      expState: { phase: "reveal", roundNumber: 1, totalRounds: 10, scores: { [MOCK_GUEST_ID]: 100 } },
    },
    {
      label: "Leaderboard",
      emoji: "🏆",
      guestView: "leaderboard",
      guestViewData: [
        { guestId: MOCK_GUEST_ID, score: 800, playerNum: 1, isMe: true },
        { guestId: "p2", score: 650, playerNum: 2 },
        { guestId: "p3", score: 500, playerNum: 3 },
        { guestId: "p4", score: 350, playerNum: 4 },
        { guestId: "p5", score: 200, playerNum: 5 },
      ],
      expState: { phase: "leaderboard" },
    },
  ],

  // ── Unpopular Opinions ──────────────────────────────────────────────────
  unpopular_opinions: [
    {
      label: "Judge — Pineapple on Pizza",
      emoji: "🍕",
      guestView: "opinions_judging",
      guestViewData: { opinion: "Pineapple belongs on pizza", options: ["Popular opinion", "Unpopular opinion"] },
      expState: { phase: "judging" },
    },
    {
      label: "Judge — Die Hard Xmas Movie",
      emoji: "🎄",
      guestView: "opinions_judging",
      guestViewData: { opinion: "Die Hard is a Christmas movie", options: ["Popular opinion", "Unpopular opinion"] },
      expState: { phase: "judging" },
    },
    {
      label: "Judge — Cats vs Dogs",
      emoji: "🐱",
      guestView: "opinions_judging",
      guestViewData: { opinion: "Cats are better pets than dogs", options: ["Popular opinion", "Unpopular opinion"] },
      expState: { phase: "judging" },
    },
    {
      label: "Judge — Sleeping with Socks",
      emoji: "🧦",
      guestView: "opinions_judging",
      guestViewData: { opinion: "Sleeping with socks on is comfortable", options: ["Popular opinion", "Unpopular opinion"] },
      expState: { phase: "judging" },
    },
    {
      label: "Judge — Hot Dogs are Sandwiches",
      emoji: "🌭",
      guestView: "opinions_judging",
      guestViewData: { opinion: "Hot dogs are a type of sandwich", options: ["Popular opinion", "Unpopular opinion"] },
      expState: { phase: "judging" },
    },
    {
      label: "Judge — Raisins in Cookies",
      emoji: "🍪",
      guestView: "opinions_judging",
      guestViewData: { opinion: "Raisins in cookies are an upgrade, not a downgrade", options: ["Popular opinion", "Unpopular opinion"] },
      expState: { phase: "judging" },
    },
    {
      label: "Guessing",
      emoji: "🤔",
      guestView: "opinions_guessing",
      guestViewData: {
        opinion: "Pineapple belongs on pizza",
        options: ["Popular opinion", "Unpopular opinion"],
        judgeName: "Player 1",
      },
      expState: { phase: "guessing" },
    },
    {
      label: "Reveal",
      emoji: "🌶️",
      guestView: "opinions_reveal",
      guestViewData: {
        opinion: "Pineapple belongs on pizza",
        answer: "Unpopular opinion",
        correctGuessers: [{ guestId: MOCK_GUEST_ID, playerNum: 1, isMe: true }],
        wrongGuessers: [{ guestId: "p2", playerNum: 2 }, { guestId: "p3", playerNum: 3 }],
      },
      expState: { phase: "reveal" },
    },
  ],

  // ── Scrapbook Sabotage ──────────────────────────────────────────────────
  scrapbook_sabotage: [
    {
      label: "Word Input — Terrible Vacation",
      emoji: "✍️",
      guestView: "scrapbook_word_input",
      guestViewData: { prompt: "A terrible vacation to remember", timeLimit: 30 },
      expState: { phase: "word_input" },
    },
    {
      label: "Word Input — Worst Birthday",
      emoji: "🎂",
      guestView: "scrapbook_word_input",
      guestViewData: { prompt: "The worst birthday party ever thrown", timeLimit: 30 },
      expState: { phase: "word_input" },
    },
    {
      label: "Word Input — Awkward Date",
      emoji: "💔",
      guestView: "scrapbook_word_input",
      guestViewData: { prompt: "An awkward first date that went sideways", timeLimit: 30 },
      expState: { phase: "word_input" },
    },
    {
      label: "Word Input — Cooking Disaster",
      emoji: "🔥",
      guestView: "scrapbook_word_input",
      guestViewData: { prompt: "A disastrous cooking attempt that almost burned the house down", timeLimit: 30 },
      expState: { phase: "word_input" },
    },
    {
      label: "Word Input — Road Trip Gone Wrong",
      emoji: "🚗",
      guestView: "scrapbook_word_input",
      guestViewData: { prompt: "A road trip that completely fell apart from the start", timeLimit: 30 },
      expState: { phase: "word_input" },
    },
    {
      label: "Word Bank",
      emoji: "📚",
      guestView: "scrapbook_word_bank",
      guestViewData: {
        words: ["sunburn", "cancelled", "lost luggage", "food poisoning", "rainstorm", "no wifi", "flat tire", "wrong hotel", "crying child", "missed flight"],
      },
      expState: { phase: "word_bank" },
    },
    {
      label: "Writing Phase",
      emoji: "📝",
      guestView: "scrapbook_writing",
      guestViewData: {
        prompt: "A terrible vacation to remember",
        wordBank: ["sunburn", "cancelled", "lost luggage", "food poisoning", "rainstorm", "no wifi", "flat tire"],
        timeLimit: 60,
      },
      expState: { phase: "writing" },
    },
    {
      label: "Voting",
      emoji: "🗳️",
      guestView: "scrapbook_voting",
      guestViewData: {
        entries: [
          { guestId: "p2", playerNum: 2, text: "Our flight got cancelled so we sat in the airport eating overpriced food poisoning sandwiches with a sunburn from waiting outside for 4 hours." },
          { guestId: "p3", playerNum: 3, text: "The rainstorm flooded our lost luggage. No wifi to even cry online about it. The wrong hotel charged us double and we missed our flight home." },
          { guestId: "p4", playerNum: 4, text: "I packed everything except a flat tire. The crying child next to us had sunburn and food poisoning. It was cancelled twice before we even boarded." },
        ],
      },
      expState: { phase: "voting" },
    },
  ],

  // ── The Glitch ──────────────────────────────────────────────────────────
  the_glitch: [
    {
      label: "Watching — Cat Falls",
      emoji: "🐱",
      guestView: "glitch_watching",
      guestViewData: { videoTitle: "Cat dramatically falls off table", timeLimit: 15 },
      expState: { phase: "watching" },
    },
    {
      label: "Watching — Dog Slides",
      emoji: "🐕",
      guestView: "glitch_watching",
      guestViewData: { videoTitle: "Dog slides across freshly mopped floor", timeLimit: 15 },
      expState: { phase: "watching" },
    },
    {
      label: "Watching — Grandma VR",
      emoji: "👵",
      guestView: "glitch_watching",
      guestViewData: { videoTitle: "Grandma tries VR for the first time", timeLimit: 15 },
      expState: { phase: "watching" },
    },
    {
      label: "Watching — Baby Lemon",
      emoji: "🍋",
      guestView: "glitch_watching",
      guestViewData: { videoTitle: "Baby tastes lemon for the very first time", timeLimit: 15 },
      expState: { phase: "watching" },
    },
    {
      label: "Watching — Seagull Steals",
      emoji: "🐦",
      guestView: "glitch_watching",
      guestViewData: { videoTitle: "Seagull aggressively steals entire ice cream cone", timeLimit: 15 },
      expState: { phase: "watching" },
    },
    {
      label: "Watching — Glass Door",
      emoji: "🚪",
      guestView: "glitch_watching",
      guestViewData: { videoTitle: "Man confidently walks into sliding glass door", timeLimit: 15 },
      expState: { phase: "watching" },
    },
    {
      label: "Describing",
      emoji: "🗣️",
      guestView: "glitch_describing",
      guestViewData: { timeLimit: 30 },
      expState: { phase: "describing" },
    },
    {
      label: "Voting",
      emoji: "🗳️",
      guestView: "glitch_voting",
      guestViewData: {
        descriptions: [
          { guestId: MOCK_GUEST_ID, playerNum: 1, isMe: true, text: "A cat falls dramatically off a table in slow motion and stares back like nothing happened." },
          { guestId: "p2", playerNum: 2, text: "Cat jumps off table, lands perfectly, looks embarrassed, then walks away pretending it was on purpose." },
          { guestId: "p3", playerNum: 3, text: "The cat is sitting on a table. It falls off. It is very dramatic. The cat does not care." },
        ],
      },
      expState: { phase: "voting" },
    },
    {
      label: "Reveal",
      emoji: "👾",
      guestView: "glitch_reveal",
      guestViewData: {
        videoTitle: "Cat dramatically falls off table",
        winner: { guestId: MOCK_GUEST_ID },
        entries: [
          { guestId: MOCK_GUEST_ID, playerNum: 1, votes: 2, text: "A cat falls dramatically off a table in slow motion.", isMe: true },
          { guestId: "p2", playerNum: 2, votes: 1, text: "Cat jumps off table, lands perfectly, looks embarrassed." },
          { guestId: "p3", playerNum: 3, votes: 0, text: "The cat is sitting on a table. It falls off." },
        ],
      },
      expState: { phase: "reveal" },
    },
  ],

  // ── Copyright Infringement ──────────────────────────────────────────────
  copyright_infringement: [
    {
      label: "Viewing — Mona Lisa",
      emoji: "👁️",
      guestView: "copyright_viewing",
      guestViewData: { title: "The Mona Lisa", artist: "Leonardo da Vinci", year: "1503", timeLimit: 15 },
      expState: { phase: "viewing" },
    },
    {
      label: "Viewing — Starry Night",
      emoji: "🌙",
      guestView: "copyright_viewing",
      guestViewData: { title: "The Starry Night", artist: "Vincent van Gogh", year: "1889", timeLimit: 15 },
      expState: { phase: "viewing" },
    },
    {
      label: "Viewing — The Scream",
      emoji: "😱",
      guestView: "copyright_viewing",
      guestViewData: { title: "The Scream", artist: "Edvard Munch", year: "1893", timeLimit: 15 },
      expState: { phase: "viewing" },
    },
    {
      label: "Viewing — Girl with Pearl Earring",
      emoji: "💎",
      guestView: "copyright_viewing",
      guestViewData: { title: "Girl with a Pearl Earring", artist: "Johannes Vermeer", year: "1665", timeLimit: 15 },
      expState: { phase: "viewing" },
    },
    {
      label: "Drawing Canvas",
      emoji: "🎨",
      guestView: "copyright_drawing",
      guestViewData: { title: "The Mona Lisa", timeLimit: 90 },
      expState: { phase: "drawing" },
    },
    {
      label: "Gallery Vote",
      emoji: "🖼️",
      guestView: "copyright_gallery",
      guestViewData: {
        title: "The Mona Lisa",
        drawings: [
          { guestId: MOCK_GUEST_ID, playerNum: 1, isMe: true, dataUrl: null },
          { guestId: "p2", playerNum: 2, dataUrl: null },
          { guestId: "p3", playerNum: 3, dataUrl: null },
          { guestId: "p4", playerNum: 4, dataUrl: null },
        ],
      },
      expState: { phase: "gallery" },
    },
    {
      label: "Results",
      emoji: "🏆",
      guestView: "copyright_results",
      guestViewData: {
        title: "The Mona Lisa",
        winner: { guestId: MOCK_GUEST_ID },
        entries: [
          { guestId: MOCK_GUEST_ID, playerNum: 1, votes: 4, isMe: true },
          { guestId: "p2", playerNum: 2, votes: 2 },
          { guestId: "p3", playerNum: 3, votes: 1 },
          { guestId: "p4", playerNum: 4, votes: 0 },
        ],
      },
      expState: { phase: "results" },
    },
  ],

  // ── Drawback ────────────────────────────────────────────────────────────
  drawback: [
    {
      label: "Drawing — Dragon + Sushi",
      emoji: "🐉",
      guestView: "drawback_drawing",
      guestViewData: { prompt: "A dragon eating sushi at a fancy restaurant" },
      expState: { phase: "drawing", prompt: "A dragon eating sushi at a fancy restaurant", roundNumber: 1, totalRounds: 5 },
    },
    {
      label: "Drawing — Cat Yoga",
      emoji: "🧘",
      guestView: "drawback_drawing",
      guestViewData: { prompt: "A cat teaching yoga to confused penguins" },
      expState: { phase: "drawing", prompt: "A cat teaching yoga to confused penguins", roundNumber: 2, totalRounds: 5 },
    },
    {
      label: "Drawing — Superhero Sandwich",
      emoji: "🦸",
      guestView: "drawback_drawing",
      guestViewData: { prompt: "A superhero whose only power is making incredible sandwiches" },
      expState: { phase: "drawing", prompt: "A superhero whose only power is making incredible sandwiches", roundNumber: 3, totalRounds: 5 },
    },
    {
      label: "Drawing — Aliens Find Pizza",
      emoji: "👽",
      guestView: "drawback_drawing",
      guestViewData: { prompt: "Aliens discovering pizza for the very first time" },
      expState: { phase: "drawing", prompt: "Aliens discovering pizza for the very first time", roundNumber: 4, totalRounds: 5 },
    },
    {
      label: "Drawing — Robot Coffee",
      emoji: "🤖",
      guestView: "drawback_drawing",
      guestViewData: { prompt: "A robot having an existential crisis at a coffee shop" },
      expState: { phase: "drawing", prompt: "A robot having an existential crisis at a coffee shop", roundNumber: 5, totalRounds: 5 },
    },
    {
      label: "Drawing — Dino Smartphones",
      emoji: "🦕",
      guestView: "drawback_drawing",
      guestViewData: { prompt: "Dinosaurs discovering smartphones for the first time" },
      expState: { phase: "drawing", prompt: "Dinosaurs discovering smartphones for the first time", roundNumber: 1, totalRounds: 5 },
    },
    {
      label: "Voting Phase",
      emoji: "🗳️",
      guestView: "drawback_voting",
      guestViewData: {
        drawings: [
          { guestId: MOCK_GUEST_ID, playerNum: 1, isMe: true },
          { guestId: "p2", playerNum: 2 },
          { guestId: "p3", playerNum: 3 },
          { guestId: "p4", playerNum: 4 },
        ],
      },
      expState: { phase: "voting", roundNumber: 1, totalRounds: 5 },
    },
    {
      label: "Results Reveal",
      emoji: "🏆",
      guestView: "drawback_reveal",
      guestViewData: {
        prompt: "A dragon eating sushi at a fancy restaurant",
        winner: { guestId: "p2" },
        entries: [
          { guestId: "p2", votes: 4, playerNum: 2 },
          { guestId: MOCK_GUEST_ID, votes: 2, playerNum: 1 },
          { guestId: "p3", votes: 1, playerNum: 3 },
          { guestId: "p4", votes: 0, playerNum: 4 },
        ],
      },
      expState: { phase: "reveal", roundNumber: 1, totalRounds: 5 },
    },
  ],

  // ── Scavenger Snap ──────────────────────────────────────────────────────
  scavenger_snap: [
    {
      label: "Challenge — Red + Round + Edible",
      emoji: "🍎",
      guestView: "snap_challenge",
      guestViewData: { challenge: "Find something red, round, and edible", timeLimit: 60 },
      expState: { phase: "challenge" },
    },
    {
      label: "Challenge — Older Than You",
      emoji: "🏺",
      guestView: "snap_challenge",
      guestViewData: { challenge: "Take a photo with something older than you", timeLimit: 60 },
      expState: { phase: "challenge" },
    },
    {
      label: "Challenge — Interesting Texture",
      emoji: "🪨",
      guestView: "snap_challenge",
      guestViewData: { challenge: "Find the most interesting texture in the room", timeLimit: 60 },
      expState: { phase: "challenge" },
    },
    {
      label: "Challenge — Something Broken",
      emoji: "💔",
      guestView: "snap_challenge",
      guestViewData: { challenge: "Photograph something broken or imperfect", timeLimit: 60 },
      expState: { phase: "challenge" },
    },
    {
      label: "Challenge — Letter Q",
      emoji: "🔤",
      guestView: "snap_challenge",
      guestViewData: { challenge: "Find something with the letter 'Q' on it", timeLimit: 60 },
      expState: { phase: "challenge" },
    },
    {
      label: "Challenge — Made in Another Country",
      emoji: "🌏",
      guestView: "snap_challenge",
      guestViewData: { challenge: "Find something made in another country and photograph the label", timeLimit: 60 },
      expState: { phase: "challenge" },
    },
    {
      label: "Challenge — Most Colorful Thing",
      emoji: "🌈",
      guestView: "snap_challenge",
      guestViewData: { challenge: "Photograph the most colorful thing you can find", timeLimit: 60 },
      expState: { phase: "challenge" },
    },
    {
      label: "Gallery Vote",
      emoji: "🖼️",
      guestView: "snap_gallery",
      guestViewData: {
        challenge: "Find something red, round, and edible",
        photos: [
          { guestId: MOCK_GUEST_ID, playerNum: 1, isMe: true, dataUrl: null },
          { guestId: "p2", playerNum: 2, dataUrl: null },
          { guestId: "p3", playerNum: 3, dataUrl: null },
        ],
      },
      expState: { phase: "gallery" },
    },
    {
      label: "Results",
      emoji: "🏆",
      guestView: "snap_results",
      guestViewData: {
        challenge: "Find something red, round, and edible",
        winner: { guestId: MOCK_GUEST_ID },
        entries: [
          { guestId: MOCK_GUEST_ID, playerNum: 1, votes: 3, isMe: true },
          { guestId: "p2", playerNum: 2, votes: 1 },
          { guestId: "p3", playerNum: 3, votes: 0 },
        ],
      },
      expState: { phase: "results" },
    },
  ],

  // ── Poll ────────────────────────────────────────────────────────────────
  poll: [],

  // ── Raffle ──────────────────────────────────────────────────────────────
  raffle: [],

  // ── Countdown ───────────────────────────────────────────────────────────
  countdown: [],

  // ── Karaoke ─────────────────────────────────────────────────────────────
  karaoke: [],

  // ── GeoGuesser ──────────────────────────────────────────────────────────
  geo_guesser: [
    {
      label: "🗼 Eiffel Tower",
      emoji: "🗼",
      guestView: "geo_guessing",
      guestViewData: {
        clue: "Iron lattice tower built in 1889 for a World's Fair — now the most visited paid monument on Earth with 7 million annual visitors",
        locationName: "Eiffel Tower, Paris",
        locationEmoji: "🗼",
      },
      expState: { phase: "guessing", roundNumber: 1, totalRounds: 5, location: { name: "Eiffel Tower, Paris" } },
    },
    {
      label: "🏯 Great Wall of China",
      emoji: "🏯",
      guestView: "geo_guessing",
      guestViewData: {
        clue: "Ancient wonder stretching over 13,000 miles — built to protect an empire from northern invaders. Took centuries and millions of workers to construct",
        locationName: "Great Wall of China",
        locationEmoji: "🏯",
      },
      expState: { phase: "guessing", roundNumber: 2, totalRounds: 5, location: { name: "Great Wall of China" } },
    },
    {
      label: "🌳 Amazon Rainforest",
      emoji: "🌳",
      guestView: "geo_guessing",
      guestViewData: {
        clue: "Home to 10% of all species on Earth. Covers 5.5 million square kilometers. Called 'the lungs of the planet' — produces 20% of the world's oxygen",
        locationName: "Amazon Rainforest, Brazil",
        locationEmoji: "🌳",
      },
      expState: { phase: "guessing", roundNumber: 3, totalRounds: 5, location: { name: "Amazon Rainforest" } },
    },
    {
      label: "🏛️ Colosseum, Rome",
      emoji: "🏛️",
      guestView: "geo_guessing",
      guestViewData: {
        clue: "Ancient amphitheater completed in 80 AD, capable of holding 80,000 spectators. Once hosted gladiator battles and public spectacles for the masses",
        locationName: "Colosseum, Rome",
        locationEmoji: "🏛️",
      },
      expState: { phase: "guessing", roundNumber: 4, totalRounds: 5, location: { name: "Colosseum, Rome" } },
    },
    {
      label: "🌊 Great Barrier Reef",
      emoji: "🌊",
      guestView: "geo_guessing",
      guestViewData: {
        clue: "World's largest coral reef system — stretches 2,300 km and is visible from space. Home to 1,500 species of fish and 4,000 types of mollusk",
        locationName: "Great Barrier Reef, Australia",
        locationEmoji: "🌊",
      },
      expState: { phase: "guessing", roundNumber: 5, totalRounds: 5, location: { name: "Great Barrier Reef" } },
    },
    {
      label: "🗽 Statue of Liberty",
      emoji: "🗽",
      guestView: "geo_guessing",
      guestViewData: {
        clue: "A gift from France in 1886, standing 93 meters tall on a small island. She holds a torch in one hand and a tablet inscribed with July 4, 1776 in the other",
        locationName: "Statue of Liberty, New York",
        locationEmoji: "🗽",
      },
      expState: { phase: "guessing", roundNumber: 1, totalRounds: 5, location: { name: "Statue of Liberty" } },
    },
    {
      label: "🏔️ Mount Everest",
      emoji: "🏔️",
      guestView: "geo_guessing",
      guestViewData: {
        clue: "The highest point on Earth at 8,849 meters. First summited in 1953 by Sir Edmund Hillary and Tenzing Norgay. Over 300 people have died attempting the climb",
        locationName: "Mount Everest, Nepal/Tibet",
        locationEmoji: "🏔️",
      },
      expState: { phase: "guessing", roundNumber: 2, totalRounds: 5, location: { name: "Mount Everest" } },
    },
    {
      label: "🌅 Sahara Desert",
      emoji: "🌅",
      guestView: "geo_guessing",
      guestViewData: {
        clue: "The world's largest hot desert at 9 million square kilometers. Temperatures reach 58°C. Despite the heat, it receives less than 25mm of rainfall per year",
        locationName: "Sahara Desert, Africa",
        locationEmoji: "🌅",
      },
      expState: { phase: "guessing", roundNumber: 3, totalRounds: 5, location: { name: "Sahara Desert" } },
    },
    {
      label: "📍 Reveal — Europe",
      emoji: "📍",
      guestView: "geo_reveal",
      guestViewData: {
        actualLocation: "Eiffel Tower, Paris",
        actualRegion: "Europe",
        clue: "Iron lattice tower built in 1889 for a World's Fair",
        guesses: [
          { guestId: MOCK_GUEST_ID, region: "Europe", points: 100, isMe: true, playerNum: 1 },
          { guestId: "p2", region: "Asia", points: 0, isMe: false, playerNum: 2 },
          { guestId: "p3", region: "North America", points: 0, isMe: false, playerNum: 3 },
          { guestId: "p4", region: "Europe", points: 100, isMe: false, playerNum: 4 },
        ],
      },
      expState: { phase: "reveal", roundNumber: 1, totalRounds: 5, location: { name: "Eiffel Tower, Paris" } },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────

export function DevTestPanel() {
  const { state, dispatch } = useRoom();
  const experience = state.activeExperience;
  const states = TEST_STATES[experience] ?? [];
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  function loadState(idx: number) {
    const s = states[idx];
    if (!s) return;
    setActiveIdx(idx);
    dispatch({
      type: "SET_EXPERIENCE",
      experience,
      view: s.guestView as any,
      viewData: s.guestViewData,
      expState: s.expState,
    });
    if (!state.guestId) {
      dispatch({ type: "SET_GUEST_ID", guestId: MOCK_GUEST_ID, role: "HOST" });
    }
    setPreviewVisible(true);
  }

  if (states.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>No demo states for this experience yet.</Text>
      </View>
    );
  }

  const active = activeIdx !== null ? states[activeIdx] : null;

  return (
    <>
      {/* ── Full-screen guest view preview modal ── */}
      <Modal visible={previewVisible} animationType="slide" statusBarTranslucent>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
          {/* Close bar */}
          <View style={styles.previewBar}>
            <View style={styles.previewBarLeft}>
              <Text style={styles.previewBarEmoji}>{active?.emoji ?? "👁"}</Text>
              <Text style={styles.previewBarLabel}>{active?.label ?? ""}</Text>
            </View>
            <TouchableOpacity style={styles.previewCloseBtn} onPress={() => setPreviewVisible(false)}>
              <Text style={styles.previewCloseText}>✕  Close Preview</Text>
            </TouchableOpacity>
          </View>
          {/* Guest view */}
          <View style={{ flex: 1 }}>
            {active && <GuestViewPreview guestView={active.guestView} />}
          </View>
        </SafeAreaView>
      </Modal>

    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <LinearGradient colors={["#1a1a0a", "#0a0a00"]} style={styles.header}>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>🧪  DEMO MODE</Text>
        </View>
        <Text style={styles.headerSub}>
          Simulate any guest view instantly. No server needed.
        </Text>
      </LinearGradient>

      {/* Active state indicator */}
      {active && (
        <LinearGradient colors={["#1a1a2e", "#12122a"]} style={styles.activeCard}>
          <Text style={styles.activeEmoji}>{active.emoji}</Text>
          <View style={styles.activeInfo}>
            <Text style={styles.activeLabel}>NOW SHOWING</Text>
            <Text style={styles.activeName}>{active.label}</Text>
          </View>
          <View style={styles.activeDotWrap}>
            <View style={styles.activeDot} />
          </View>
        </LinearGradient>
      )}

      {/* State count */}
      <Text style={styles.sectionLabel}>
        {states.length} STATES — {experience.replace(/_/g, " ").toUpperCase()}
      </Text>

      {/* State buttons */}
      <View style={styles.stateList}>
        {states.map((s, idx) => {
          const isActive = activeIdx === idx;
          return (
            <TouchableOpacity
              key={idx}
              style={[styles.stateBtn, isActive && styles.stateBtnActive]}
              onPress={() => loadState(idx)}
              activeOpacity={0.75}
            >
              <Text style={styles.stateBtnEmoji}>{s.emoji}</Text>
              <View style={styles.stateBtnMid}>
                <Text style={[styles.stateBtnLabel, isActive && styles.stateBtnLabelActive]}>
                  {s.label}
                </Text>
                <Text style={styles.stateBtnView}>{s.guestView}</Text>
              </View>
              {isActive
                ? <View style={styles.activeIndicatorDot} />
                : <Text style={styles.stateBtnArrow}>›</Text>
              }
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Reset */}
      <TouchableOpacity
        style={styles.resetBtn}
        onPress={() => {
          setActiveIdx(null);
          dispatch({ type: "SET_EXPERIENCE", experience, view: "intermission" as any });
        }}
      >
        <Text style={styles.resetBtnText}>Reset to Intermission</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
    </>
  );
}

const ACCENT = "#6c47ff";

const styles = StyleSheet.create({
  container:           { padding: 16, gap: 12 },

  // Preview modal
  previewBar:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#111", borderBottomWidth: 1, borderBottomColor: "#222" },
  previewBarLeft:      { flexDirection: "row", alignItems: "center", gap: 8 },
  previewBarEmoji:     { fontSize: 20 },
  previewBarLabel:     { color: "#fff", fontSize: 13, fontWeight: "700" },
  previewCloseBtn:     { backgroundColor: "#1a1a1a", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: "#333" },
  previewCloseText:    { color: "#aaa", fontSize: 13, fontWeight: "600" },
  emptyWrap:           { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyText:           { color: "#555", fontSize: 14, textAlign: "center" },

  header:              { borderRadius: 16, padding: 16, gap: 8, borderWidth: 1, borderColor: "#2a2a00" },
  headerBadge:         { alignSelf: "flex-start", backgroundColor: "rgba(200,200,0,0.12)", borderRadius: 8, borderWidth: 1, borderColor: "rgba(200,200,0,0.25)", paddingHorizontal: 10, paddingVertical: 5 },
  headerBadgeText:     { color: "#d4d400", fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  headerSub:           { color: "#666", fontSize: 13, lineHeight: 18 },

  activeCard:          { borderRadius: 14, borderWidth: 1, borderColor: ACCENT + "44", padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  activeEmoji:         { fontSize: 28, width: 36, textAlign: "center" },
  activeInfo:          { flex: 1 },
  activeLabel:         { color: "#8b5cf6", fontSize: 9, fontWeight: "800", letterSpacing: 2 },
  activeName:          { color: "#c4b5fd", fontSize: 15, fontWeight: "700", marginTop: 2 },
  activeDotWrap:       { padding: 4 },
  activeDot:           { width: 10, height: 10, borderRadius: 5, backgroundColor: "#22c55e" },

  sectionLabel:        { color: "#333", fontSize: 10, fontWeight: "800", letterSpacing: 1.5, paddingHorizontal: 2 },

  stateList:           { gap: 6 },
  stateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#141414",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1e1e1e",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  stateBtnActive:      { borderColor: ACCENT + "88", backgroundColor: "#1a1a2e" },
  stateBtnEmoji:       { fontSize: 20, width: 28, textAlign: "center" },
  stateBtnMid:         { flex: 1 },
  stateBtnLabel:       { color: "#ccc", fontSize: 14, fontWeight: "700" },
  stateBtnLabelActive: { color: "#c4b5fd" },
  stateBtnView:        { color: "#333", fontSize: 10, fontFamily: "monospace", marginTop: 2 },
  stateBtnArrow:       { color: "#333", fontSize: 18 },
  activeIndicatorDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT },

  resetBtn:            { alignItems: "center", paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: "#1e1e1e", marginTop: 4 },
  resetBtnText:        { color: "#444", fontSize: 13, fontWeight: "600" },
});
