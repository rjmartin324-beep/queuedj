import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, ActivityIndicator, Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WardrobeShop } from "../components/avatar/WardrobeShop";
import { notifySuccess, notifyError } from "../lib/haptics";
import type { OutfitType } from "../components/avatar/AvatarSVG";

// ─────────────────────────────────────────────────────────────────────────────
// Credits Store Screen
//
// Tabs:
//   Wallet  — balance, earn rates, transaction history
//   Wardrobe — buy / equip avatar outfits
//   Emotes  — unlock premium emote packs
// ─────────────────────────────────────────────────────────────────────────────

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

// Same body colors as HomeScreen so WardrobeShop preview matches current avatar
const BODY_COLORS = ["#38bdf8", "#f472b6", "#4ade80", "#fb923c", "#a78bfa"];

type StoreTab = "wallet" | "wardrobe" | "emotes";

// ─── Emote packs ─────────────────────────────────────────────────────────────

interface EmotePack {
  id: string;
  name: string;
  emotes: string[];
  cost: number;
  color: string;
}

const EMOTE_PACKS: EmotePack[] = [
  { id: "free",   name: "Starter Pack", emotes: ["🔥", "❤️", "😂", "🎉"],     cost: 0,  color: "#22c55e" },
  { id: "music",  name: "Music Pack",   emotes: ["🎵", "🎸", "🥁", "🎹"],     cost: 20, color: "#7c3aed" },
  { id: "vibe",   name: "Vibe Pack",    emotes: ["💜", "✨", "🌊", "🫶"],     cost: 20, color: "#c026d3" },
  { id: "hype",   name: "Hype Pack",    emotes: ["👏", "🙌", "💥", "⚡"],     cost: 25, color: "#f59e0b" },
  { id: "party",  name: "Party Pack",   emotes: ["🎊", "🥳", "🍾", "🎈"],     cost: 30, color: "#ec4899" },
  { id: "cosmic", name: "Cosmic Pack",  emotes: ["🌙", "⭐", "🚀", "🪐"],     cost: 35, color: "#818cf8" },
];

const OWNED_PACKS_KEY = "queuedj_owned_emote_packs";

// ─── History row types ────────────────────────────────────────────────────────

interface HistoryRow {
  delta:         number;
  balance_after: number;
  reason:        string;
  created_at:    string;
}

const REASON_LABELS: Record<string, { emoji: string; label: string }> = {
  vote_cast:       { emoji: "✓",  label: "Voted" },
  track_request:   { emoji: "🎵", label: "Track requested" },
  game_win:        { emoji: "🏆", label: "Game win" },
  full_session:    { emoji: "🎉", label: "Full session" },
  admin_grant:     { emoji: "⭐", label: "Admin bonus" },
  wardrobe_unlock: { emoji: "👗", label: "Wardrobe unlock" },
  emote_purchase:  { emoji: "🎭", label: "Emote pack" },
  refund:          { emoji: "↩️", label: "Refund" },
};

// ─── Wallet Tab ───────────────────────────────────────────────────────────────

function WalletTab({ guestId, balance }: { guestId: string; balance: number }) {
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/credits/${encodeURIComponent(guestId)}/history?limit=30`)
      .then((r) => r.json())
      .then((d) => setHistory(d.history ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [guestId]);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={wStyles.scroll}>
      {/* Earn rates */}
      <Text style={wStyles.sectionLabel}>HOW TO EARN</Text>
      <View style={wStyles.ratesGrid}>
        {[
          { emoji: "✓",  label: "Vote",        pts: "+1" },
          { emoji: "🎵", label: "Request",      pts: "+2" },
          { emoji: "🏆", label: "Win a game",   pts: "+10" },
          { emoji: "🎉", label: "Full session", pts: "+5" },
        ].map((r) => (
          <View key={r.label} style={wStyles.rateCard}>
            <Text style={wStyles.rateEmoji}>{r.emoji}</Text>
            <Text style={wStyles.rateLabel}>{r.label}</Text>
            <Text style={wStyles.ratePts}>{r.pts}</Text>
          </View>
        ))}
      </View>

      {/* History */}
      <Text style={[wStyles.sectionLabel, { marginTop: 20 }]}>TRANSACTION HISTORY</Text>
      {loading ? (
        <ActivityIndicator color="#a78bfa" style={{ marginTop: 16 }} />
      ) : history.length === 0 ? (
        <Text style={wStyles.empty}>No credits yet — go party! 🎉</Text>
      ) : (
        history.map((row, i) => {
          const info = REASON_LABELS[row.reason] ?? { emoji: "⚡", label: row.reason };
          const isEarn = row.delta > 0;
          return (
            <View key={i} style={wStyles.histRow}>
              <Text style={wStyles.histEmoji}>{info.emoji}</Text>
              <View style={wStyles.histInfo}>
                <Text style={wStyles.histLabel}>{info.label}</Text>
                <Text style={wStyles.histDate}>
                  {new Date(row.created_at).toLocaleDateString()} · Balance: {row.balance_after}
                </Text>
              </View>
              <Text style={[wStyles.histDelta, { color: isEarn ? "#22c55e" : "#ef4444" }]}>
                {isEarn ? "+" : ""}{row.delta}
              </Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const wStyles = StyleSheet.create({
  scroll:       { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },
  sectionLabel: { color: "#6b7280", fontSize: 10, fontWeight: "800", letterSpacing: 2, marginBottom: 12 },
  ratesGrid:    { flexDirection: "row", gap: 8 },
  rateCard:     {
    flex: 1, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 14,
    padding: 12, alignItems: "center", gap: 4,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  rateEmoji:    { fontSize: 20 },
  rateLabel:    { color: "#9ca3af", fontSize: 10, fontWeight: "600", textAlign: "center" },
  ratePts:      { color: "#22c55e", fontWeight: "900", fontSize: 15 },
  histRow:      {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 10, borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  histEmoji:    { fontSize: 20, width: 28, textAlign: "center" },
  histInfo:     { flex: 1 },
  histLabel:    { color: "#fff", fontWeight: "600", fontSize: 13 },
  histDate:     { color: "#6b7280", fontSize: 11, marginTop: 2 },
  histDelta:    { fontWeight: "900", fontSize: 16, minWidth: 36, textAlign: "right" },
  empty:        { color: "#6b7280", fontSize: 14, textAlign: "center", paddingVertical: 24 },
});

// ─── Emotes Tab ───────────────────────────────────────────────────────────────

function EmotesTab({ guestId, balance, onSpend }: {
  guestId: string;
  balance: number;
  onSpend: (newBalance: number) => void;
}) {
  const [ownedPacks, setOwnedPacks] = useState<Set<string>>(new Set(["free"]));
  const [buying, setBuying] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(OWNED_PACKS_KEY).then((v) => {
      if (v) setOwnedPacks(new Set(["free", ...JSON.parse(v)]));
    });
  }, []);

  async function handleBuy(pack: EmotePack) {
    if (ownedPacks.has(pack.id)) return;
    if (balance < pack.cost) {
      Alert.alert("Not enough credits", `You need ${pack.cost} ⚡ to unlock ${pack.name}.`);
      return;
    }
    setBuying(pack.id);
    try {
      const res = await fetch(`${API_URL}/credits/spend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestId,
          amount:   pack.cost,
          reason:   "emote_purchase",
          itemId:   pack.id,
          itemType: "emote_pack",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onSpend(data.balance);
        const newOwned = new Set([...ownedPacks, pack.id]);
        setOwnedPacks(newOwned);
        await AsyncStorage.setItem(
          OWNED_PACKS_KEY,
          JSON.stringify([...newOwned].filter((x) => x !== "free")),
        );
        notifySuccess();
      } else if (res.status === 402) {
        notifyError();
        Alert.alert("Not enough credits", `You need ${pack.cost} ⚡ to unlock ${pack.name}.`);
      }
    } catch {
      notifyError();
      Alert.alert("Error", "Could not complete purchase. Try again.");
    } finally {
      setBuying(null);
    }
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={eStyles.scroll}>
      <Text style={eStyles.hint}>Unlock emote packs to use in any room</Text>
      {EMOTE_PACKS.map((pack) => {
        const owned = ownedPacks.has(pack.id);
        const canAfford = balance >= pack.cost;
        const isBuying = buying === pack.id;
        return (
          <View key={pack.id} style={[eStyles.packCard, owned && { borderColor: pack.color + "66" }]}>
            <View style={eStyles.packLeft}>
              <View style={[eStyles.packDot, { backgroundColor: pack.color + "33", borderColor: pack.color + "88" }]}>
                <Text style={eStyles.packEmojis}>{pack.emotes.join(" ")}</Text>
              </View>
              <View style={eStyles.packInfo}>
                <Text style={eStyles.packName}>{pack.name}</Text>
                <Text style={eStyles.packCount}>{pack.emotes.length} emotes</Text>
              </View>
            </View>
            {isBuying ? (
              <ActivityIndicator color="#a78bfa" />
            ) : owned ? (
              <View style={[eStyles.ownedBadge, { borderColor: pack.color }]}>
                <Text style={[eStyles.ownedText, { color: pack.color }]}>Unlocked ✓</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[eStyles.buyBtn, !canAfford && eStyles.buyBtnDisabled]}
                onPress={() => handleBuy(pack)}
                disabled={!canAfford}
              >
                <Text style={eStyles.buyBtnText}>⚡ {pack.cost}</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const eStyles = StyleSheet.create({
  scroll:       { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },
  hint:         { color: "#6b7280", fontSize: 12, marginBottom: 16 },
  packCard: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 14, marginBottom: 10,
  },
  packLeft:     { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  packDot: {
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  packEmojis:   { fontSize: 16, letterSpacing: 2 },
  packInfo:     { flex: 1 },
  packName:     { color: "#fff", fontWeight: "700", fontSize: 14 },
  packCount:    { color: "#6b7280", fontSize: 11, marginTop: 2 },
  ownedBadge: {
    borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  ownedText:    { fontWeight: "700", fontSize: 12 },
  buyBtn: {
    backgroundColor: "#7c3aed", borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 14,
  },
  buyBtnDisabled: { backgroundColor: "rgba(124,58,237,0.3)" },
  buyBtnText:   { color: "#fff", fontWeight: "800", fontSize: 13 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

interface Props {
  guestId: string;
  onClose: () => void;
}

export function CreditsStoreScreen({ guestId, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<StoreTab>("wallet");
  const [balance, setBalance]     = useState<number | null>(null);
  const [bodyColor, setBodyColor] = useState(BODY_COLORS[0]);

  // Load balance + current body color from storage
  useEffect(() => {
    fetch(`${API_URL}/credits/${encodeURIComponent(guestId)}`)
      .then((r) => r.json())
      .then((d) => setBalance(d.balance ?? 0))
      .catch(() => setBalance(0));

    AsyncStorage.getItem("pg_avatar_body").then((v) => {
      const idx = parseInt(v ?? "0");
      setBodyColor(BODY_COLORS[idx] ?? BODY_COLORS[0]);
    });
  }, [guestId]);

  const tabs: { id: StoreTab; label: string; emoji: string }[] = [
    { id: "wallet",   label: "Wallet",   emoji: "💳" },
    { id: "wardrobe", label: "Wardrobe", emoji: "👗" },
    { id: "emotes",   label: "Emotes",   emoji: "🎭" },
  ];

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onClose} style={s.backBtn}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Vibe Credits</Text>
        <View style={s.headerRight} />
      </View>

      {/* Balance card */}
      <LinearGradient
        colors={["rgba(124,58,237,0.28)", "rgba(109,40,217,0.12)"]}
        style={s.balanceCard}
      >
        <Text style={s.balanceLabel}>YOUR BALANCE</Text>
        {balance === null ? (
          <ActivityIndicator color="#a78bfa" style={{ marginVertical: 8 }} />
        ) : (
          <Text style={s.balanceValue}>⚡ {balance.toLocaleString()}</Text>
        )}
        <Text style={s.balanceSub}>Earned by voting, requesting tracks, and winning games</Text>
      </LinearGradient>

      {/* Tab pills */}
      <View style={s.tabRow}>
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[s.tabPill, activeTab === t.id && s.tabPillActive]}
            onPress={() => setActiveTab(t.id)}
            activeOpacity={0.75}
          >
            <Text style={s.tabPillEmoji}>{t.emoji}</Text>
            <Text style={[s.tabPillLabel, activeTab === t.id && s.tabPillLabelActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content */}
      <View style={s.content}>
        {activeTab === "wallet" && guestId && (
          <WalletTab guestId={guestId} balance={balance ?? 0} />
        )}
        {activeTab === "wardrobe" && (
          <WardrobeShop
            guestId={guestId}
            bodyColor={bodyColor}
            onEquip={(outfit: OutfitType) => {
              // Persist the newly equipped outfit (same key as HomeScreen)
              AsyncStorage.setItem("queuedj_selected_outfit", outfit);
            }}
          />
        )}
        {activeTab === "emotes" && (
          <EmotesTab
            guestId={guestId}
            balance={balance ?? 0}
            onSpend={(newBal) => setBalance(newBal)}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: "#03001c" },

  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)",
  },
  backBtn:      { padding: 4 },
  backText:     { color: "#a78bfa", fontSize: 15, fontWeight: "700" },
  headerTitle:  { flex: 1, color: "#fff", fontWeight: "800", fontSize: 18, textAlign: "center" },
  headerRight:  { width: 60 },

  balanceCard: {
    marginHorizontal: 16, marginVertical: 12,
    borderRadius: 20, padding: 20,
    alignItems: "center",
    borderWidth: 1, borderColor: "rgba(124,58,237,0.4)",
  },
  balanceLabel: { color: "rgba(167,139,250,0.7)", fontSize: 10, fontWeight: "800", letterSpacing: 2, marginBottom: 6 },
  balanceValue: { color: "#fff", fontSize: 40, fontWeight: "900", letterSpacing: -1 },
  balanceSub:   { color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 6, textAlign: "center" },

  tabRow: {
    flexDirection: "row", gap: 8,
    paddingHorizontal: 16, marginBottom: 4,
  },
  tabPill: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 9, borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
  },
  tabPillActive: {
    backgroundColor: "rgba(124,58,237,0.25)",
    borderColor: "rgba(167,139,250,0.5)",
  },
  tabPillEmoji:       { fontSize: 14 },
  tabPillLabel:       { color: "#9ca3af", fontWeight: "700", fontSize: 12 },
  tabPillLabelActive: { color: "#a78bfa" },

  content: { flex: 1 },
});
