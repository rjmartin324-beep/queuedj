import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { localNotifyCreditsEarned } from "../../lib/notifications";
import { socketManager } from "../../lib/socket";
import { SkeletonShimmer } from "./SkeletonShimmer";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";
const EARN_LABELS: Record<string, string> = {
  vote_cast:     "+1 ✓ vote",
  track_request: "+2 🎵 request",
  game_win:      "+10 🏆 win",
  full_session:  "+5 🎉 session",
};

// ─── Earn Toast ───────────────────────────────────────────────────────────────

interface EarnToast { id: number; reason: string; amount: number }

function EarnBadge({ toast, onDone }: { toast: EarnToast; onDone: () => void }) {
  const slideY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(slideY, { toValue: -28, duration: 500, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
      Animated.delay(1200),
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(onDone);
  }, []);

  const label = EARN_LABELS[toast.reason] ?? `+${toast.amount} ⚡`;
  return (
    <Animated.View style={[styles.earnBadge, { transform: [{ translateY: slideY }], opacity }]}>
      <Text style={styles.earnText}>{label}</Text>
    </Animated.View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

let _toastId = 0;

interface Props {
  guestId: string | null;
  compact?: boolean;
}

export function VibeCreditsBar({ guestId, compact = false }: Props) {
  const [balance, setBalance] = useState<number | null>(null);
  const [toasts, setToasts] = useState<EarnToast[]>([]);
  const prevBalance = useRef<number | null>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Load balance from API
  async function fetchBalance() {
    if (!guestId) return;
    try {
      const res = await fetch(`${API_URL}/credits/${encodeURIComponent(guestId)}`);
      if (res.ok) {
        const data = await res.json();
        const newBal: number = data.balance ?? 0;

        if (prevBalance.current !== null && newBal > prevBalance.current) {
          const earned = newBal - prevBalance.current;
          // Pulse animation on earn
          Animated.sequence([
            Animated.timing(scaleAnim, { toValue: 1.3, duration: 180, useNativeDriver: true }),
            Animated.timing(scaleAnim, { toValue: 1,   duration: 200, useNativeDriver: true }),
          ]).start();
          // Local notification when app is backgrounded
          localNotifyCreditsEarned(earned, "credits_earned");
        }

        prevBalance.current = newBal;
        setBalance(newBal);
      }
    } catch { /* offline */ }
  }

  useEffect(() => {
    fetchBalance();
    // Poll every 15s as fallback
    const interval = setInterval(fetchBalance, 15_000);

    // Real-time: listen for credit award events from socket
    const socket = socketManager.get();
    const handler = (data: { guestId: string; delta: number; balance: number }) => {
      if (data.guestId !== guestId) return;
      const newBal = data.balance;
      if (prevBalance.current !== null && newBal > prevBalance.current) {
        const earned = newBal - prevBalance.current;
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.3, duration: 180, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1,   duration: 200, useNativeDriver: true }),
        ]).start();
        localNotifyCreditsEarned(earned, "credits_earned");
      }
      prevBalance.current = newBal;
      setBalance(newBal);
    };
    socket?.on("credits:awarded" as any, handler);

    return () => {
      clearInterval(interval);
      socket?.off("credits:awarded" as any, handler);
    };
  }, [guestId]);

  if (compact) {
    if (balance === null) {
      return <SkeletonShimmer width={60} height={28} borderRadius={16} />;
    }
    return (
      <Animated.View style={[styles.compactBadge, { transform: [{ scale: scaleAnim }] }]}>
        <Text style={styles.compactEmoji}>⚡</Text>
        <Text style={styles.compactBalance}>{balance}</Text>
      </Animated.View>
    );
  }

  if (balance === null) return null;

  return (
    <View style={styles.container}>
      {toasts.map((t) => (
        <EarnBadge
          key={t.id}
          toast={t}
          onDone={() => setToasts((p) => p.filter((x) => x.id !== t.id))}
        />
      ))}
      <Animated.View style={[styles.bar, { transform: [{ scale: scaleAnim }] }]}>
        <Text style={styles.emoji}>⚡</Text>
        <Text style={styles.label}>VIBE CREDITS</Text>
        <Text style={styles.balance}>{balance.toLocaleString()}</Text>
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:      { alignItems: "center", position: "relative" },

  bar: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            8,
    backgroundColor: "rgba(124,58,237,0.18)",
    borderWidth:    1,
    borderColor:    "rgba(167,139,250,0.3)",
    borderRadius:   24,
    paddingHorizontal: 16,
    paddingVertical:   8,
  },
  emoji:   { fontSize: 16 },
  label:   { color: "#a78bfa", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  balance: { color: "#fff", fontSize: 18, fontWeight: "900" },

  compactBadge: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            4,
    backgroundColor: "rgba(124,58,237,0.25)",
    borderRadius:   16,
    paddingHorizontal: 10,
    paddingVertical:    5,
    borderWidth:    1,
    borderColor:    "rgba(167,139,250,0.3)",
  },
  compactEmoji:   { fontSize: 13 },
  compactBalance: { color: "#a78bfa", fontWeight: "900", fontSize: 13 },

  earnBadge: {
    position:       "absolute",
    bottom:         44,
    alignSelf:      "center",
    backgroundColor: "#7c3aed",
    borderRadius:   20,
    paddingHorizontal: 14,
    paddingVertical:    6,
    zIndex:         10,
  },
  earnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
});
