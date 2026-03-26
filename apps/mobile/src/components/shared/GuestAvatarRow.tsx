import React, { useEffect, useRef } from "react";
import { Animated, ScrollView, StyleSheet, Text, View } from "react-native";
import { AvatarSVG, type OutfitType } from "../avatar/AvatarSVG";

// ─────────────────────────────────────────────────────────────────────────────
// GuestAvatarRow — scrollable strip of avatars for guests in the room
// Each guest entry is { guestId, displayName, outfit?, bodyColor? }
// ─────────────────────────────────────────────────────────────────────────────

export interface GuestPresence {
  guestId:     string;
  displayName: string;
  outfit?:     OutfitType;
  bodyColor?:  string;
  isMe?:       boolean;
}

// Deterministic color from guestId (no randomness so it's stable)
function colorFromId(id: string): string {
  const COLORS = [
    "#38bdf8", "#f472b6", "#34d399", "#a78bfa",
    "#fb923c", "#60a5fa", "#4ade80", "#e879f9",
    "#fbbf24", "#f87171",
  ];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

function GuestChip({ guest, index }: { guest: GuestPresence; index: number }) {
  const slideY  = useRef(new Animated.Value(20)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideY, {
        toValue: 0,
        duration: 280,
        delay: index * 40,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        delay: index * 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const color = guest.bodyColor ?? colorFromId(guest.guestId);
  const shortName = guest.displayName.length > 8
    ? guest.displayName.slice(0, 7) + "…"
    : guest.displayName;

  return (
    <Animated.View
      style={[
        styles.chip,
        guest.isMe && styles.chipMe,
        { transform: [{ translateY: slideY }], opacity },
      ]}
    >
      <View style={styles.avatarWrap}>
        <AvatarSVG
          size={54}
          bodyColor={color}
          outfit={guest.outfit ?? "default"}
          expression="happy"
        />
        {guest.isMe && <View style={styles.meDot} />}
      </View>
      <Text style={[styles.name, guest.isMe && styles.nameMe]} numberOfLines={1}>
        {shortName}
      </Text>
    </Animated.View>
  );
}

interface Props {
  guests: GuestPresence[];
  /** Show max N guests — defaults to show all */
  maxVisible?: number;
}

export function GuestAvatarRow({ guests, maxVisible }: Props) {
  const visible = maxVisible ? guests.slice(0, maxVisible) : guests;
  const overflow = maxVisible && guests.length > maxVisible ? guests.length - maxVisible : 0;

  if (!visible.length) return null;

  return (
    <View style={styles.wrapper}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>IN THE ROOM</Text>
        <Text style={styles.count}>{guests.length} {guests.length === 1 ? "guest" : "guests"}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {visible.map((g, i) => (
          <GuestChip key={g.guestId} guest={g} index={i} />
        ))}
        {overflow > 0 && (
          <View style={styles.overflowChip}>
            <Text style={styles.overflowText}>+{overflow}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { paddingVertical: 8 },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  title: {
    color: "#6b7280",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
  },
  count: {
    color: "#4b5563",
    fontSize: 10,
    fontWeight: "600",
  },

  scroll: {
    paddingHorizontal: 12,
    gap: 8,
    alignItems: "flex-end",
  },

  chip: {
    alignItems: "center",
    width: 64,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  chipMe: {
    backgroundColor: "rgba(124,58,237,0.18)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.3)",
  },

  avatarWrap: { position: "relative" },
  meDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#22c55e",
    borderWidth: 1.5,
    borderColor: "#0a0a1a",
  },

  name:   { color: "#9ca3af", fontSize: 10, fontWeight: "600", marginTop: 3, textAlign: "center" },
  nameMe: { color: "#a78bfa" },

  overflowChip: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  overflowText: { color: "#6b7280", fontWeight: "800", fontSize: 13 },
});
