import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";

// ─────────────────────────────────────────────────────────────────────────────
// ActivityFeed
//
// Unified timeline for the Social tab. Merges:
//   • Session history  (hosted rooms — from API)
//   • Notable credits  (game wins, purchases, session bonuses — from API)
//   • Recent achievement unlocks (local AsyncStorage)
//
// Low-signal events (individual votes / track requests) are intentionally
// excluded — they'd flood the feed. Only "headline" moments surface here.
// ─────────────────────────────────────────────────────────────────────────────

const API_URL           = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";
const UNLOCKED_KEY      = "partyglue_achievements_unlocked";
const ACH_UNLOCKED_AT   = "partyglue_achievements_unlocked_at"; // JSON map id→timestamp

// ─── Types ────────────────────────────────────────────────────────────────────

type FeedKind =
  | "session_hosted"
  | "game_win"
  | "wardrobe_unlock"
  | "emote_purchase"
  | "session_bonus"
  | "admin_grant"
  | "achievement";

interface FeedItem {
  id:        string;
  kind:      FeedKind;
  timestamp: number; // unix ms

  // session_hosted
  session?: {
    roomCode:   string;
    guestCount: number;
    trackCount: number;
    durationMs: number;
    topTrack?:  { title: string; artist: string };
  };

  // credit events
  credit?: {
    delta:   number;
    balance: number;
    reason:  string;
  };

  // achievement
  achievement?: {
    emoji: string;
    title: string;
    desc:  string;
  };
}

// ─── Date grouping ────────────────────────────────────────────────────────────

function dateGroup(ts: number): string {
  const now     = Date.now();
  const diffMs  = now - ts;
  const diffDay = Math.floor(diffMs / 86_400_000);
  if (diffDay === 0) return "Today";
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7)  return "This Week";
  if (diffDay < 30) return "This Month";
  return "Earlier";
}

const GROUP_ORDER = ["Today", "Yesterday", "This Week", "This Month", "Earlier"];

// ─── Achievement catalog (mirrors AchievementsSection) ────────────────────────
// Only storing what we need for feed display (emoji, title, desc).
// Keep in sync with AchievementsSection.ACHIEVEMENTS if that list grows.

const ACH_MAP: Record<string, { emoji: string; title: string; desc: string }> = {
  first_request:   { emoji: "🎵", title: "First Request",    desc: "Requested your first track" },
  first_vote:      { emoji: "✓",  title: "First Vote",       desc: "Cast your first vote" },
  first_win:       { emoji: "🏆", title: "First Win",        desc: "Won your first game" },
  first_host:      { emoji: "🎛️", title: "First Party",      desc: "Hosted your first room" },
  party_animal:    { emoji: "🦁", title: "Party Animal",     desc: "Hosted 10 rooms" },
  crowd_pleaser:   { emoji: "👏", title: "Crowd Pleaser",    desc: "Had 20+ guests in a room" },
  game_master:     { emoji: "🎮", title: "Game Master",      desc: "Won 5 games" },
  wardrobe_hero:   { emoji: "👗", title: "Wardrobe Hero",    desc: "Unlocked an outfit" },
  // … any additional IDs just won't show in feed (safe fallback)
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const KIND_META: Record<FeedKind, { emoji: string; accent: string }> = {
  session_hosted: { emoji: "🎛️", accent: "#7c3aed" },
  game_win:       { emoji: "🏆", accent: "#f59e0b" },
  wardrobe_unlock:{ emoji: "👗", accent: "#ec4899" },
  emote_purchase: { emoji: "🎭", accent: "#8b5cf6" },
  session_bonus:  { emoji: "🎉", accent: "#22c55e" },
  admin_grant:    { emoji: "⭐", accent: "#f97316" },
  achievement:    { emoji: "🥇", accent: "#facc15" },
};

function fmt(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function fmtDuration(ms: number): string {
  const m = Math.round(ms / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

// ─── Individual feed card ─────────────────────────────────────────────────────

function FeedCard({ item, onExpand, expanded }: {
  item:     FeedItem;
  onExpand: () => void;
  expanded: boolean;
}) {
  const meta = KIND_META[item.kind] ?? KIND_META.session_hosted;

  if (item.kind === "session_hosted" && item.session) {
    const s = item.session;
    const dur = fmtDuration(s.durationMs);
    return (
      <TouchableOpacity style={s_.card} onPress={onExpand} activeOpacity={0.8}>
        <View style={s_.cardRow}>
          <LinearGradient
            colors={[meta.accent + "44", meta.accent + "22"]}
            style={s_.iconCircle}
          >
            <Text style={s_.iconEmoji}>{meta.emoji}</Text>
          </LinearGradient>

          <View style={s_.cardBody}>
            <Text style={s_.cardTitle}>Hosted Room <Text style={[s_.roomCode, { color: meta.accent }]}>{s.roomCode}</Text></Text>
            <View style={s_.pillRow}>
              <Text style={s_.pill}>👥 {s.guestCount}</Text>
              <Text style={s_.pill}>🎵 {s.trackCount} tracks</Text>
              {s.durationMs > 0 && <Text style={s_.pill}>⏱ {dur}</Text>}
            </View>
          </View>

          <Text style={s_.timestamp}>{fmt(item.timestamp)}</Text>
        </View>

        {expanded && s.topTrack && (
          <View style={s_.expandedSection}>
            <Text style={s_.expandedLabel}>TOP TRACK</Text>
            <Text style={s_.expandedTrack} numberOfLines={1}>
              🎵 {s.topTrack.title} — {s.topTrack.artist}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  if (item.kind === "game_win" && item.credit) {
    return (
      <View style={s_.card}>
        <View style={s_.cardRow}>
          <LinearGradient
            colors={[meta.accent + "44", meta.accent + "22"]}
            style={s_.iconCircle}
          >
            <Text style={s_.iconEmoji}>{meta.emoji}</Text>
          </LinearGradient>
          <View style={s_.cardBody}>
            <Text style={s_.cardTitle}>Won a game!</Text>
            <Text style={s_.cardSub}>Balance: ⚡ {item.credit.balance}</Text>
          </View>
          <View style={s_.deltaChip}>
            <Text style={[s_.deltaText, { color: "#22c55e" }]}>+{item.credit.delta} ⚡</Text>
          </View>
        </View>
      </View>
    );
  }

  if (item.kind === "wardrobe_unlock" && item.credit) {
    return (
      <View style={s_.card}>
        <View style={s_.cardRow}>
          <LinearGradient
            colors={[meta.accent + "44", meta.accent + "22"]}
            style={s_.iconCircle}
          >
            <Text style={s_.iconEmoji}>{meta.emoji}</Text>
          </LinearGradient>
          <View style={s_.cardBody}>
            <Text style={s_.cardTitle}>Outfit unlocked</Text>
            <Text style={s_.cardSub}>Wardrobe · Balance: ⚡ {item.credit.balance}</Text>
          </View>
          <Text style={s_.timestamp}>{fmt(item.timestamp)}</Text>
        </View>
      </View>
    );
  }

  if (item.kind === "emote_purchase" && item.credit) {
    return (
      <View style={s_.card}>
        <View style={s_.cardRow}>
          <LinearGradient
            colors={[meta.accent + "44", meta.accent + "22"]}
            style={s_.iconCircle}
          >
            <Text style={s_.iconEmoji}>{meta.emoji}</Text>
          </LinearGradient>
          <View style={s_.cardBody}>
            <Text style={s_.cardTitle}>Emote pack unlocked</Text>
            <Text style={s_.cardSub}>Balance: ⚡ {item.credit.balance}</Text>
          </View>
          <Text style={s_.timestamp}>{fmt(item.timestamp)}</Text>
        </View>
      </View>
    );
  }

  if (item.kind === "session_bonus" && item.credit) {
    return (
      <View style={s_.card}>
        <View style={s_.cardRow}>
          <LinearGradient
            colors={[meta.accent + "44", meta.accent + "22"]}
            style={s_.iconCircle}
          >
            <Text style={s_.iconEmoji}>{meta.emoji}</Text>
          </LinearGradient>
          <View style={s_.cardBody}>
            <Text style={s_.cardTitle}>Full session bonus</Text>
            <Text style={s_.cardSub}>Stayed for the whole party 🥳</Text>
          </View>
          <View style={s_.deltaChip}>
            <Text style={[s_.deltaText, { color: "#22c55e" }]}>+{item.credit.delta} ⚡</Text>
          </View>
        </View>
      </View>
    );
  }

  if (item.kind === "admin_grant" && item.credit) {
    return (
      <View style={s_.card}>
        <View style={s_.cardRow}>
          <LinearGradient
            colors={[meta.accent + "44", meta.accent + "22"]}
            style={s_.iconCircle}
          >
            <Text style={s_.iconEmoji}>{meta.emoji}</Text>
          </LinearGradient>
          <View style={s_.cardBody}>
            <Text style={s_.cardTitle}>Bonus credits</Text>
            <Text style={s_.cardSub}>Admin grant · Balance: ⚡ {item.credit.balance}</Text>
          </View>
          <View style={s_.deltaChip}>
            <Text style={[s_.deltaText, { color: "#22c55e" }]}>+{item.credit.delta} ⚡</Text>
          </View>
        </View>
      </View>
    );
  }

  if (item.kind === "achievement" && item.achievement) {
    const a = item.achievement;
    return (
      <View style={s_.card}>
        <View style={s_.cardRow}>
          <LinearGradient
            colors={[meta.accent + "44", meta.accent + "22"]}
            style={s_.iconCircle}
          >
            <Text style={s_.iconEmoji}>{a.emoji}</Text>
          </LinearGradient>
          <View style={s_.cardBody}>
            <Text style={s_.cardTitle}>Achievement: {a.title}</Text>
            <Text style={s_.cardSub}>{a.desc}</Text>
          </View>
          <Text style={s_.timestamp}>{fmt(item.timestamp)}</Text>
        </View>
      </View>
    );
  }

  return null;
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  guestId: string | null | undefined;
}

export function ActivityFeed({ guestId }: Props) {
  const [items, setItems]     = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!guestId) { setLoading(false); return; }
    loadFeed(guestId).then((data) => {
      setItems(data);
      setLoading(false);
    });
  }, [guestId]);

  if (loading) {
    return (
      <View style={s_.center}>
        <ActivityIndicator color="#a78bfa" />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={s_.empty}>
        <Text style={s_.emptyEmoji}>🎉</Text>
        <Text style={s_.emptyTitle}>Nothing yet</Text>
        <Text style={s_.emptySub}>Host or join a room to start your feed</Text>
      </View>
    );
  }

  // Group items by date bucket
  const grouped: Record<string, FeedItem[]> = {};
  for (const item of items) {
    const g = dateGroup(item.timestamp);
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(item);
  }

  return (
    <View>
      {GROUP_ORDER.filter((g) => grouped[g]?.length).map((group) => (
        <View key={group}>
          <Text style={s_.groupLabel}>{group}</Text>
          {grouped[group].map((item) => (
            <FeedCard
              key={item.id}
              item={item}
              expanded={expanded === item.id}
              onExpand={() => setExpanded((prev) => (prev === item.id ? null : item.id))}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── Data loading ─────────────────────────────────────────────────────────────

async function loadFeed(guestId: string): Promise<FeedItem[]> {
  const items: FeedItem[] = [];

  await Promise.all([
    // Session history
    fetch(`${API_URL}/history/${encodeURIComponent(guestId)}`)
      .then((r) => r.json())
      .then((d) => {
        for (const s of (d.sessions ?? [])) {
          const ts = new Date(s.startedAt ?? s.date ?? 0).getTime();
          if (!ts) continue;
          items.push({
            id:        `session_${s.id ?? ts}`,
            kind:      "session_hosted",
            timestamp: ts,
            session: {
              roomCode:   s.roomCode ?? "????",
              guestCount: s.guestCount ?? 0,
              trackCount: s.trackCount ?? 0,
              durationMs: s.durationMs ?? 0,
              topTrack:   s.topTracks?.[0]
                ? { title: s.topTracks[0].title, artist: s.topTracks[0].artist }
                : undefined,
            },
          });
        }
      })
      .catch(() => {}),

    // Credits history — notable events only (no individual votes/requests)
    fetch(`${API_URL}/credits/${encodeURIComponent(guestId)}/history?limit=50`)
      .then((r) => r.json())
      .then((d) => {
        for (const c of (d.history ?? [])) {
          const ts = new Date(c.created_at).getTime();
          const kind = creditKind(c.reason);
          if (!kind) continue; // skip low-signal entries
          items.push({
            id:        `credit_${ts}_${c.reason}`,
            kind,
            timestamp: ts,
            credit: {
              delta:   c.delta,
              balance: c.balance_after,
              reason:  c.reason,
            },
          });
        }
      })
      .catch(() => {}),

    // Recent achievement unlocks (timestamps stored separately)
    AsyncStorage.getItem(ACH_UNLOCKED_AT)
      .then((raw) => {
        if (!raw) return;
        const map: Record<string, number> = JSON.parse(raw);
        for (const [id, ts] of Object.entries(map)) {
          const info = ACH_MAP[id];
          if (!info) continue;
          items.push({
            id:        `ach_${id}`,
            kind:      "achievement",
            timestamp: ts,
            achievement: info,
          });
        }
      })
      .catch(() => {}),
  ]);

  // Sort newest first
  items.sort((a, b) => b.timestamp - a.timestamp);
  return items.slice(0, 60); // cap at 60 items
}

function creditKind(reason: string): FeedKind | null {
  switch (reason) {
    case "game_win":        return "game_win";
    case "wardrobe_unlock": return "wardrobe_unlock";
    case "emote_purchase":  return "emote_purchase";
    case "full_session":    return "session_bonus";
    case "admin_grant":     return "admin_grant";
    // vote_cast and track_request are intentionally excluded (too noisy)
    default:                return null;
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s_ = StyleSheet.create({
  center: { paddingVertical: 24, alignItems: "center" },
  empty:  { paddingVertical: 32, alignItems: "center", gap: 6 },
  emptyEmoji: { fontSize: 36 },
  emptyTitle: { color: "#fff", fontWeight: "700", fontSize: 15 },
  emptySub:   { color: "#6b7280", fontSize: 13, textAlign: "center" },

  groupLabel: {
    color: "#4b5563", fontSize: 10, fontWeight: "800", letterSpacing: 2,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
  },

  card: {
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  cardRow: {
    flexDirection: "row", alignItems: "center",
    padding: 14, gap: 12,
  },
  iconCircle: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: "center", justifyContent: "center",
  },
  iconEmoji:  { fontSize: 20 },
  cardBody:   { flex: 1, gap: 4 },
  cardTitle:  { color: "#fff", fontWeight: "700", fontSize: 14 },
  cardSub:    { color: "#6b7280", fontSize: 12 },
  roomCode:   { fontWeight: "900", letterSpacing: 1 },
  timestamp:  { color: "#4b5563", fontSize: 11, fontWeight: "600" },
  pillRow:    { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  pill:       { color: "#6b7280", fontSize: 11, fontWeight: "600" },
  deltaChip:  {
    backgroundColor: "rgba(34,197,94,0.12)",
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: "rgba(34,197,94,0.2)",
  },
  deltaText:  { fontWeight: "800", fontSize: 13 },

  expandedSection: {
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 14, paddingVertical: 10, gap: 4,
  },
  expandedLabel: { color: "#4b5563", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  expandedTrack: { color: "#a78bfa", fontSize: 13, fontWeight: "600" },
});
