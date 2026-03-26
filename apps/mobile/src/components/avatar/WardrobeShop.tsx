import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { OutfitType } from "./AvatarSVG";
import { AvatarSVG } from "./AvatarSVG";
import { notifySuccess, notifyError } from "../../lib/haptics";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

// ─── Shop catalogue ───────────────────────────────────────────────────────────

interface WardrobeItem {
  id:      OutfitType;
  label:   string;
  emoji:   string;
  cost:    number;  // 0 = free / already owned
  description: string;
}

const WARDROBE_ITEMS: WardrobeItem[] = [
  { id: "default",   label: "Classic",    emoji: "😊", cost: 0,  description: "Your original look. Always free." },
  { id: "suit",      label: "DJ Suit",    emoji: "🎩", cost: 15, description: "Sharp. Professional. Ready to drop." },
  { id: "knight",    label: "Knight",     emoji: "⚔️", cost: 20, description: "Defend the queue at all costs." },
  { id: "astronaut", label: "Astronaut",  emoji: "🚀", cost: 25, description: "One small step for DJs." },
  { id: "pirate",    label: "Pirate",     emoji: "🏴‍☠️", cost: 20, description: "Arr, request that sea shanty!" },
  { id: "ninja",     label: "Ninja",      emoji: "🥷", cost: 30, description: "Shadow vote. Silent request." },
  { id: "wizard",    label: "Wizard",     emoji: "🧙", cost: 35, description: "Conjure the perfect playlist." },
  { id: "dino",      label: "Dino",       emoji: "🦕", cost: 20, description: "Prehistoric party energy." },
  { id: "angel",     label: "Angel",      emoji: "😇", cost: 25, description: "Blessed with good taste." },
  { id: "devil",     label: "Devil",      emoji: "😈", cost: 25, description: "Requests are always suspicious." },
  { id: "robot",     label: "Robot",      emoji: "🤖", cost: 40, description: "Algorithmic party mode engaged." },
];

const OWNED_KEY   = "queuedj_owned_outfits";
const OUTFIT_KEY  = "queuedj_selected_outfit";

// ─── Item Card ────────────────────────────────────────────────────────────────

function ItemCard({
  item, owned, selected, balance, bodyColor, onBuy, onEquip,
}: {
  item:       WardrobeItem;
  owned:      boolean;
  selected:   boolean;
  balance:    number;
  bodyColor:  string;
  onBuy:      () => void;
  onEquip:    () => void;
}) {
  const canAfford = balance >= item.cost;

  return (
    <View style={[styles.card, selected && styles.cardSelected]}>
      <View style={styles.avatarPreview}>
        <AvatarSVG
          size={72}
          bodyColor={bodyColor}
          outfit={item.id}
          expression="happy"
        />
      </View>
      <Text style={styles.cardEmoji}>{item.emoji}</Text>
      <Text style={styles.cardLabel}>{item.label}</Text>
      <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>

      {item.cost === 0 || owned ? (
        <TouchableOpacity
          style={[styles.equipBtn, selected && styles.equipBtnSelected]}
          onPress={onEquip}
          disabled={selected}
        >
          <Text style={styles.equipBtnText}>{selected ? "Equipped ✓" : "Equip"}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.buyBtn, !canAfford && styles.buyBtnDisabled]}
          onPress={onBuy}
          disabled={!canAfford}
        >
          <Text style={styles.buyBtnText}>⚡ {item.cost}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  guestId:   string | null;
  bodyColor: string;
  onEquip:   (outfit: OutfitType) => void;
}

export function WardrobeShop({ guestId, bodyColor, onEquip }: Props) {
  const [balance, setBalance]     = useState(0);
  const [owned, setOwned]         = useState<Set<OutfitType>>(new Set(["default"]));
  const [selected, setSelected]   = useState<OutfitType>("default");
  const [buying, setBuying]       = useState<OutfitType | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(OWNED_KEY).then((v) => {
      if (v) setOwned(new Set(["default", ...JSON.parse(v)]));
    });
    AsyncStorage.getItem(OUTFIT_KEY).then((v) => {
      if (v) setSelected(v as OutfitType);
    });
  }, []);

  useEffect(() => {
    if (!guestId) return;
    fetch(`${API_URL}/credits/${encodeURIComponent(guestId)}`)
      .then((r) => r.json())
      .then((d) => setBalance(d.balance ?? 0))
      .catch(() => {});
  }, [guestId]);

  async function handleBuy(item: WardrobeItem) {
    if (!guestId || !item.cost || owned.has(item.id)) return;
    setBuying(item.id);
    try {
      const res = await fetch(`${API_URL}/credits/spend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestId,
          amount:   item.cost,
          reason:   "wardrobe_unlock",
          itemId:   item.id,
          itemType: "outfit",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setBalance(data.balance);
        const newOwned = new Set([...owned, item.id]);
        setOwned(newOwned);
        await AsyncStorage.setItem(
          OWNED_KEY,
          JSON.stringify([...newOwned].filter((x) => x !== "default")),
        );
        notifySuccess();
        handleEquip(item.id);
      } else if (res.status === 402) {
        notifyError();
        Alert.alert("Not enough credits", `You need ${item.cost} ⚡ to unlock this outfit.`);
      }
    } catch {
      notifyError();
      Alert.alert("Error", "Could not complete purchase. Try again.");
    } finally {
      setBuying(null);
    }
  }

  async function handleEquip(outfitId: OutfitType) {
    setSelected(outfitId);
    await AsyncStorage.setItem(OUTFIT_KEY, outfitId);
    onEquip(outfitId);
  }

  return (
    <View style={styles.container}>
      {/* Balance bar */}
      <View style={styles.balanceBar}>
        <Text style={styles.balanceLabel}>VIBE CREDITS</Text>
        <Text style={styles.balanceValue}>⚡ {balance.toLocaleString()}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {WARDROBE_ITEMS.map((item) => (
          buying === item.id ? (
            <View key={item.id} style={[styles.card, styles.cardBuying]}>
              <ActivityIndicator color="#a78bfa" />
            </View>
          ) : (
            <ItemCard
              key={item.id}
              item={item}
              owned={owned.has(item.id)}
              selected={selected === item.id}
              balance={balance}
              bodyColor={bodyColor}
              onBuy={() => handleBuy(item)}
              onEquip={() => handleEquip(item.id)}
            />
          )
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:    { flex: 1 },

  balanceBar: {
    flexDirection:    "row",
    alignItems:       "center",
    justifyContent:   "space-between",
    paddingHorizontal: 20,
    paddingVertical:   12,
    backgroundColor:  "rgba(124,58,237,0.12)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(167,139,250,0.15)",
  },
  balanceLabel: { color: "#a78bfa", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  balanceValue: { color: "#fff", fontSize: 18, fontWeight: "900" },

  grid: {
    flexDirection: "row",
    flexWrap:      "wrap",
    padding:       12,
    gap:           12,
  },

  card: {
    width:           "47%",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius:    16,
    borderWidth:     1,
    borderColor:     "rgba(255,255,255,0.07)",
    padding:         14,
    alignItems:      "center",
    gap:             6,
  },
  cardSelected: {
    borderColor:     "#7c3aed",
    backgroundColor: "rgba(124,58,237,0.15)",
  },
  cardBuying: { justifyContent: "center", minHeight: 160 },

  avatarPreview: { marginBottom: 4 },
  cardEmoji:     { fontSize: 22 },
  cardLabel:     { color: "#fff", fontWeight: "800", fontSize: 14 },
  cardDesc:      { color: "#6b7280", fontSize: 11, textAlign: "center", lineHeight: 16 },

  equipBtn: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius:    10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop:       4,
  },
  equipBtnSelected: { backgroundColor: "rgba(124,58,237,0.3)" },
  equipBtnText: { color: "#a78bfa", fontWeight: "700", fontSize: 12 },

  buyBtn: {
    backgroundColor: "#7c3aed",
    borderRadius:    10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop:       4,
  },
  buyBtnDisabled: { backgroundColor: "rgba(124,58,237,0.3)" },
  buyBtnText:     { color: "#fff", fontWeight: "800", fontSize: 13 },
});
