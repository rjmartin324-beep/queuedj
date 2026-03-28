import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Animated, AppState,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { showAchievementToast } from "../shared/AchievementToast";

// ─────────────────────────────────────────────────────────────────────────────
// AchievementsSection
//
// 30 achievements across 5 categories. Unlock state stored in AsyncStorage.
// Call unlockAchievement(id) from anywhere in the app to unlock.
// Progress-based achievements read their own counters from AsyncStorage.
// ─────────────────────────────────────────────────────────────────────────────

const UNLOCKED_KEY    = "partyglue_achievements_unlocked";
const UNLOCKED_AT_KEY = "partyglue_achievements_unlocked_at"; // id → unix ms

export async function unlockAchievement(id: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(UNLOCKED_KEY);
    const unlocked: string[] = raw ? JSON.parse(raw) : [];
    if (unlocked.includes(id)) return false; // already unlocked
    unlocked.push(id);

    // Record the unlock timestamp for the activity feed
    const atRaw = await AsyncStorage.getItem(UNLOCKED_AT_KEY);
    const atMap: Record<string, number> = atRaw ? JSON.parse(atRaw) : {};
    atMap[id] = Date.now();

    await AsyncStorage.multiSet([
      [UNLOCKED_KEY,    JSON.stringify(unlocked)],
      [UNLOCKED_AT_KEY, JSON.stringify(atMap)],
    ]);

    // Show toast for the newly unlocked achievement.
    const match = ACHIEVEMENTS.find(a => a.id === id);
    if (match) {
      showAchievementToast({ emoji: match.emoji, title: match.title, desc: match.desc });
    }

    return true;
  } catch {
    return false;
  }
}

export async function getUnlockedAchievements(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(UNLOCKED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ─── Achievement definitions ──────────────────────────────────────────────────

export interface Achievement {
  id:       string;
  emoji:    string;
  title:    string;
  desc:     string;
  category: "dj" | "music" | "games" | "social" | "special" | "game_specific";
  // Optional progress tracking — reads from AsyncStorage key
  progressKey?: string;
  progressMax?: number;
}

const ACHIEVEMENTS: Achievement[] = [
  // ── DJ / Host ──────────────────────────────────────────────────────────────
  {
    id: "first_drop", emoji: "🎵", title: "First Drop",
    desc: "Host your very first party room.",
    category: "dj",
  },
  {
    id: "crowd_pleaser", emoji: "🔥", title: "Crowd Pleaser",
    desc: "Earn 50 guest votes in a single session.",
    category: "dj",
  },
  {
    id: "vibe_master", emoji: "🌊", title: "Vibe Master",
    desc: "Hold PEAK crowd energy for 10 minutes straight.",
    category: "dj",
  },
  {
    id: "night_owl", emoji: "🌙", title: "Night Owl",
    desc: "Host a room after midnight.",
    category: "dj",
  },
  {
    id: "marathon_dj", emoji: "⏱️", title: "Marathon DJ",
    desc: "Keep a session going for 3+ hours.",
    category: "dj",
  },
  {
    id: "clean_mix", emoji: "✨", title: "Clean Mix",
    desc: "Play 10+ tracks with zero vibe guardrail rejections.",
    category: "dj",
  },
  {
    id: "the_regular_host", emoji: "🏠", title: "The Regular",
    desc: "Host 10 rooms total.",
    category: "dj",
    progressKey: "stat_rooms_hosted",
    progressMax: 10,
  },
  {
    id: "legend_status", emoji: "👑", title: "Legend Status",
    desc: "Host 50 rooms. You're the party.",
    category: "dj",
    progressKey: "stat_rooms_hosted",
    progressMax: 50,
  },
  {
    id: "big_room", emoji: "🏟️", title: "Big Room",
    desc: "Have 20+ guests in a single session.",
    category: "dj",
  },
  {
    id: "festival_host", emoji: "🎪", title: "Festival Mode",
    desc: "Host a room with 50+ guests.",
    category: "dj",
  },

  // ── Music ──────────────────────────────────────────────────────────────────
  {
    id: "first_request", emoji: "🙋", title: "First Request",
    desc: "Submit your first song request.",
    category: "music",
  },
  {
    id: "song_whisperer", emoji: "🎯", title: "Song Whisperer",
    desc: "Your request hits #1 in the queue by crowd votes.",
    category: "music",
  },
  {
    id: "request_royalty", emoji: "📚", title: "Request Royalty",
    desc: "Submit 100 total song requests.",
    category: "music",
    progressKey: "stat_requests_total",
    progressMax: 100,
  },
  {
    id: "library_linked", emoji: "🎧", title: "Library Linked",
    desc: "Connect your Spotify library to browse playlists.",
    category: "music",
  },
  {
    id: "anthem_set", emoji: "🎙️", title: "Walk-In Ready",
    desc: "Set your personal walk-in anthem.",
    category: "music",
  },
  {
    id: "genre_hopper", emoji: "🌍", title: "Genre Hopper",
    desc: "Request tracks from 5 different genres in one session.",
    category: "music",
  },

  // ── Games ──────────────────────────────────────────────────────────────────
  {
    id: "game_on", emoji: "🎮", title: "Game On",
    desc: "Win your first party game.",
    category: "games",
  },
  {
    id: "triple_threat", emoji: "🃏", title: "Triple Threat",
    desc: "Win 3 different game types.",
    category: "games",
  },
  {
    id: "trivia_brain", emoji: "🧠", title: "Trivia Brain",
    desc: "Win 5 trivia games.",
    category: "games",
    progressKey: "stat_trivia_wins",
    progressMax: 5,
  },
  {
    id: "artist", emoji: "🎨", title: "The Artist",
    desc: "Win 3 drawing games (Drawback or Copyright).",
    category: "games",
    progressKey: "stat_drawing_wins",
    progressMax: 3,
  },
  {
    id: "champion", emoji: "🏆", title: "Champion",
    desc: "Win 25 games total.",
    category: "games",
    progressKey: "stat_game_wins_total",
    progressMax: 25,
  },
  {
    id: "undefeated", emoji: "⚡", title: "Undefeated",
    desc: "Win 5 games in a row without losing.",
    category: "games",
  },
  {
    id: "party_pro", emoji: "🎲", title: "Party Pro",
    desc: "Play 50 games total.",
    category: "games",
    progressKey: "stat_games_played",
    progressMax: 50,
  },
  {
    id: "all_rounder", emoji: "🌟", title: "All-Rounder",
    desc: "Win at least one game from every category.",
    category: "games",
  },

  // ── Social ─────────────────────────────────────────────────────────────────
  {
    id: "first_party", emoji: "🎉", title: "First Party",
    desc: "Join your first room as a guest.",
    category: "social",
  },
  {
    id: "party_animal", emoji: "🐾", title: "Party Animal",
    desc: "Attend 25 parties as a guest.",
    category: "social",
    progressKey: "stat_parties_attended",
    progressMax: 25,
  },
  {
    id: "connector", emoji: "🔗", title: "Connector",
    desc: "Join 10 different rooms.",
    category: "social",
    progressKey: "stat_rooms_joined",
    progressMax: 10,
  },
  {
    id: "hype_machine", emoji: "😄", title: "Hype Machine",
    desc: "Send 20 emotes in a single session.",
    category: "social",
  },
  {
    id: "shoutout_king", emoji: "📣", title: "Shoutout King",
    desc: "Send 10 shoutouts across all your sessions.",
    category: "social",
    progressKey: "stat_shoutouts_sent",
    progressMax: 10,
  },

  // ── Special ────────────────────────────────────────────────────────────────
  {
    id: "on_fire", emoji: "🔥", title: "On Fire",
    desc: "DJ 7 nights in a row without missing a day.",
    category: "special",
    progressKey: "stat_dj_streak",
    progressMax: 7,
  },
  {
    id: "taste_maker", emoji: "📊", title: "Taste Maker",
    desc: "Receive your Weekly Taste Report 4 weeks in a row.",
    category: "special",
    progressKey: "stat_taste_reports",
    progressMax: 4,
  },

  // ── Game Specific ──────────────────────────────────────────────────────────
  {
    id: "trivia_royale", emoji: "🧠", title: "Trivia Royale",
    desc: "Win a trivia game with a perfect score — zero wrong answers.",
    category: "game_specific",
  },
  {
    id: "picasso", emoji: "🎨", title: "Picasso",
    desc: "Win Drawback and have your drawing guessed on the very first try.",
    category: "game_specific",
  },
  {
    id: "snap_happy", emoji: "📸", title: "Snap Happy",
    desc: "Complete 5 Scavenger Snap challenges.",
    category: "game_specific",
    progressKey: "stat_snap_completed",
    progressMax: 5,
  },
  {
    id: "globe_trotter", emoji: "🗺️", title: "Globe Trotter",
    desc: "Guess within 100 miles of the real location in GeoGuesser.",
    category: "game_specific",
  },
  {
    id: "master_liar", emoji: "🤥", title: "Master Liar",
    desc: "Fool every single person in Two Truths One Lie.",
    category: "game_specific",
  },
  {
    id: "detective", emoji: "🕵️", title: "The Detective",
    desc: "Correctly identify the lie in Two Truths One Lie 5 times.",
    category: "game_specific",
    progressKey: "stat_ttol_correct",
    progressMax: 5,
  },
  {
    id: "lyric_legend", emoji: "🎤", title: "Lyric Legend",
    desc: "Finish 10 song lyrics correctly across all sessions.",
    category: "game_specific",
    progressKey: "stat_lyrics_correct",
    progressMax: 10,
  },
  {
    id: "genre_guru", emoji: "🎸", title: "Genre Guru",
    desc: "Correctly name 5 genres in a row in Name That Genre.",
    category: "game_specific",
  },
  {
    id: "mind_reader", emoji: "🔮", title: "Mind Reader",
    desc: "Win Mind Reading 3 times — the crowd thought exactly like you.",
    category: "game_specific",
    progressKey: "stat_mindreading_wins",
    progressMax: 3,
  },
  {
    id: "storyteller", emoji: "📖", title: "The Storyteller",
    desc: "Win Story Time 3 times with the crowd's favourite ending.",
    category: "game_specific",
    progressKey: "stat_storytime_wins",
    progressMax: 3,
  },
  {
    id: "unanimous", emoji: "🎯", title: "Unanimous",
    desc: "Win Would You Rather with a 100% crowd vote on your side.",
    category: "game_specific",
  },
  {
    id: "hot_take_king", emoji: "🌶️", title: "Hot Take King",
    desc: "Win Hot Takes with the most controversial opinion in the room.",
    category: "game_specific",
  },
  {
    id: "alibi_pro", emoji: "🚪", title: "Alibi Pro",
    desc: "Avoid suspicion and survive Alibi without being voted out — 5 times.",
    category: "game_specific",
    progressKey: "stat_alibi_survived",
    progressMax: 5,
  },
  {
    id: "night_shifter", emoji: "🌙", title: "Night Shifter",
    desc: "Complete a full round of NightShift without being eliminated.",
    category: "game_specific",
  },
  {
    id: "mole_buster", emoji: "🪲", title: "Mole Buster",
    desc: "Correctly catch the MindMole 5 times.",
    category: "game_specific",
    progressKey: "stat_mole_caught",
    progressMax: 5,
  },
  {
    id: "artifact_hunter", emoji: "🏺", title: "Artifact Hunter",
    desc: "Find every artifact in a full round of ArtifactHunt.",
    category: "game_specific",
  },
  {
    id: "fake_news", emoji: "📰", title: "Fake News Detector",
    desc: "Correctly spot the fake headline in Fake News 5 times.",
    category: "game_specific",
    progressKey: "stat_fakenews_correct",
    progressMax: 5,
  },
  {
    id: "speed_demon", emoji: "⚡", title: "Speed Demon",
    desc: "Win Speed Round 3 times back to back.",
    category: "game_specific",
  },
  {
    id: "emoji_poet", emoji: "😂", title: "Emoji Poet",
    desc: "Win Emoji Story with everyone guessing your story correctly.",
    category: "game_specific",
  },
  {
    id: "dice_god", emoji: "🎲", title: "Dice God",
    desc: "Win Party Dice 10 times total.",
    category: "game_specific",
    progressKey: "stat_dice_wins",
    progressMax: 10,
  },
];

const CATEGORIES: { id: Achievement["category"]; label: string; emoji: string }[] = [
  { id: "dj",            label: "DJ / Host",  emoji: "🎛️" },
  { id: "music",         label: "Music",      emoji: "🎵" },
  { id: "games",         label: "Games",      emoji: "🎮" },
  { id: "game_specific", label: "Game Modes", emoji: "🃏" },
  { id: "social",        label: "Social",     emoji: "👥" },
  { id: "special",       label: "Special",    emoji: "⭐" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function AchievementsSection() {
  const [unlocked, setUnlocked]       = useState<Set<string>>(new Set());
  const [progress, setProgress]       = useState<Record<string, number>>({});
  const [activeCategory, setCategory] = useState<Achievement["category"]>("game_specific");
  const [detail, setDetail]           = useState<Achievement | null>(null);

  useEffect(() => {
    loadState();
    // Reload when app comes back to foreground (e.g. after winning a game)
    const sub = AppState.addEventListener("change", state => {
      if (state === "active") loadState();
    });
    return () => sub.remove();
  }, []);

  async function loadState() {
    const ids = await getUnlockedAchievements();
    setUnlocked(new Set(ids));

    // Read progress counters
    const keys = ACHIEVEMENTS
      .filter(a => a.progressKey)
      .map(a => a.progressKey!) ;
    const unique = [...new Set(keys)];
    const pairs = await AsyncStorage.multiGet(unique);
    const map: Record<string, number> = {};
    pairs.forEach(([k, v]) => { map[k] = v ? Number(v) : 0; });
    setProgress(map);
  }

  const filtered = ACHIEVEMENTS.filter(a => a.category === activeCategory);
  const totalUnlocked = unlocked.size;
  const pct = Math.round((totalUnlocked / ACHIEVEMENTS.length) * 100);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.heading}>ACHIEVEMENTS</Text>
        <View style={styles.progressPill}>
          <Text style={styles.progressText}>{totalUnlocked}/{ACHIEVEMENTS.length} · {pct}%</Text>
        </View>
      </View>

      {/* Overall progress bar */}
      <View style={styles.masterBar}>
        <View style={[styles.masterFill, { width: `${pct}%` as any }]} />
      </View>

      {/* Category tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catScroll}
      >
        {CATEGORIES.map(cat => {
          const catAchievements = ACHIEVEMENTS.filter(a => a.category === cat.id);
          const catUnlocked = catAchievements.filter(a => unlocked.has(a.id)).length;
          const active = activeCategory === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.catTab, active && styles.catTabActive]}
              onPress={() => setCategory(cat.id)}
            >
              <Text style={styles.catEmoji}>{cat.emoji}</Text>
              <Text style={[styles.catLabel, active && styles.catLabelActive]}>{cat.label}</Text>
              <Text style={[styles.catCount, active && styles.catCountActive]}>
                {catUnlocked}/{catAchievements.length}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Achievement cards */}
      <View style={styles.grid}>
        {filtered.map(a => {
          const isUnlocked = unlocked.has(a.id);
          const curr = a.progressKey ? (progress[a.progressKey] ?? 0) : 0;
          const max  = a.progressMax ?? 1;
          const pctProgress = Math.min(curr / max, 1);

          return (
            <TouchableOpacity
              key={a.id}
              style={[styles.card, isUnlocked && styles.cardUnlocked]}
              onPress={() => setDetail(a)}
              activeOpacity={0.75}
            >
              {/* Glow overlay when unlocked */}
              {isUnlocked && <View style={styles.cardGlow} />}

              <Text style={[styles.cardEmoji, !isUnlocked && styles.locked]}>{a.emoji}</Text>
              <Text style={[styles.cardTitle, !isUnlocked && styles.lockedText]} numberOfLines={1}>
                {a.title}
              </Text>
              <Text style={[styles.cardDesc, !isUnlocked && styles.lockedText]} numberOfLines={2}>
                {a.desc}
              </Text>

              {/* Progress bar for countable achievements */}
              {a.progressKey && !isUnlocked && (
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${pctProgress * 100}%` as any }]} />
                  <Text style={styles.progressLabel}>{curr}/{max}</Text>
                </View>
              )}

              {isUnlocked && (
                <View style={styles.unlockedBadge}>
                  <Text style={styles.unlockedBadgeText}>✓ Unlocked</Text>
                </View>
              )}
              {!isUnlocked && !a.progressKey && (
                <Text style={styles.lockIcon}>🔒</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Detail modal */}
      {detail && (
        <Modal transparent animationType="fade" visible onRequestClose={() => setDetail(null)}>
          <TouchableOpacity style={styles.detailBackdrop} activeOpacity={1} onPress={() => setDetail(null)}>
            <View style={styles.detailCard}>
              <Text style={styles.detailEmoji}>{detail.emoji}</Text>
              <Text style={styles.detailTitle}>{detail.title}</Text>
              <Text style={styles.detailDesc}>{detail.desc}</Text>
              {unlocked.has(detail.id) ? (
                <View style={styles.detailUnlocked}>
                  <Text style={styles.detailUnlockedText}>✓ Achievement Unlocked!</Text>
                </View>
              ) : (
                detail.progressKey && (
                  <Text style={styles.detailProgress}>
                    Progress: {progress[detail.progressKey] ?? 0} / {detail.progressMax}
                  </Text>
                )
              )}
              <TouchableOpacity style={styles.detailClose} onPress={() => setDetail(null)}>
                <Text style={styles.detailCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { paddingBottom: 16 },

  header: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16, marginBottom: 8, marginTop: 24,
  },
  heading:      { color: "#6b7280", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  progressPill: { backgroundColor: "rgba(167,139,250,0.15)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: "rgba(167,139,250,0.3)" },
  progressText: { color: "#a78bfa", fontSize: 11, fontWeight: "700" },

  masterBar: { height: 3, backgroundColor: "#1a1a1a", marginHorizontal: 16, borderRadius: 2, marginBottom: 16, overflow: "hidden" },
  masterFill: { height: "100%", backgroundColor: "#7c3aed", borderRadius: 2 },

  catScroll: { paddingHorizontal: 16, gap: 8, marginBottom: 16 },
  catTab: {
    alignItems: "center", paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 14, backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", gap: 2, minWidth: 80,
  },
  catTabActive:    { backgroundColor: "rgba(124,58,237,0.2)", borderColor: "#7c3aed" },
  catEmoji:        { fontSize: 18 },
  catLabel:        { color: "#6b7280", fontSize: 11, fontWeight: "700" },
  catLabelActive:  { color: "#a78bfa" },
  catCount:        { color: "#374151", fontSize: 10, fontWeight: "600" },
  catCountActive:  { color: "#7c3aed" },

  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 10 },

  card: {
    width: "47%",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    gap: 4, overflow: "hidden", position: "relative",
  },
  cardUnlocked: {
    backgroundColor: "rgba(124,58,237,0.1)",
    borderColor: "rgba(124,58,237,0.35)",
  },
  cardGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(167,139,250,0.05)",
    borderRadius: 16,
  },

  cardEmoji:  { fontSize: 28 },
  cardTitle:  { color: "#fff", fontSize: 13, fontWeight: "800", marginTop: 4 },
  cardDesc:   { color: "#6b7280", fontSize: 11, lineHeight: 15 },
  locked:     { opacity: 0.35 },
  lockedText: { color: "#4b5563" },
  lockIcon:   { fontSize: 16, marginTop: 4, opacity: 0.4 },

  progressBar:   { height: 4, backgroundColor: "#1f1f1f", borderRadius: 2, marginTop: 6, overflow: "hidden" },
  progressFill:  { height: "100%", backgroundColor: "#6c47ff", borderRadius: 2 },
  progressLabel: { color: "#4b5563", fontSize: 10, marginTop: 2 },

  unlockedBadge:     { backgroundColor: "rgba(34,197,94,0.15)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start", marginTop: 4 },
  unlockedBadgeText: { color: "#22c55e", fontSize: 10, fontWeight: "800" },

  // Detail modal
  detailBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", alignItems: "center", justifyContent: "center", padding: 32 },
  detailCard:     { backgroundColor: "#141414", borderRadius: 24, padding: 28, alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#2a2a2a", width: "100%" },
  detailEmoji:    { fontSize: 56 },
  detailTitle:    { color: "#fff", fontSize: 22, fontWeight: "900", textAlign: "center" },
  detailDesc:     { color: "#9ca3af", fontSize: 15, textAlign: "center", lineHeight: 22 },
  detailUnlocked: { backgroundColor: "rgba(34,197,94,0.15)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(34,197,94,0.3)" },
  detailUnlockedText: { color: "#22c55e", fontWeight: "800", fontSize: 14 },
  detailProgress: { color: "#6b7280", fontSize: 13 },
  detailClose:    { marginTop: 8, backgroundColor: "#7c3aed", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 32 },
  detailCloseText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
