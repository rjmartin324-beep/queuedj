import React, { useEffect, useRef, useState } from "react";
import {
  Animated, Easing, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// OfflineBanner — persistent offline state indicator with retry countdown
// Automatically collapses when back online
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  isOffline: boolean;
  onRetry?:  () => void;
}

const RETRY_INTERVALS = [5, 10, 20, 30]; // seconds between retries

export function OfflineBanner({ isOffline, onRetry }: Props) {
  const heightAnim  = useRef(new Animated.Value(0)).current;
  const opacity     = useRef(new Animated.Value(0)).current;
  const [retryIn, setRetryIn]     = useState(RETRY_INTERVALS[0]);
  const [attempt, setAttempt]     = useState(0);
  const [visible, setVisible]     = useState(false);
  const pulseAnim   = useRef(new Animated.Value(1)).current;

  // Pulse animation for the offline dot
  useEffect(() => {
    if (!isOffline) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.5, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isOffline]);

  // Show/hide with animation
  useEffect(() => {
    if (isOffline && !visible) {
      setVisible(true);
      Animated.parallel([
        Animated.timing(heightAnim, { toValue: 52, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.timing(opacity,    { toValue: 1,  duration: 250, useNativeDriver: false }),
      ]).start();
    } else if (!isOffline && visible) {
      Animated.parallel([
        Animated.timing(heightAnim, { toValue: 0, duration: 250, useNativeDriver: false }),
        Animated.timing(opacity,    { toValue: 0, duration: 200, useNativeDriver: false }),
      ]).start(() => setVisible(false));
    }
  }, [isOffline]);

  // Auto-retry countdown
  useEffect(() => {
    if (!isOffline) {
      setAttempt(0);
      setRetryIn(RETRY_INTERVALS[0]);
      return;
    }

    let left = retryIn;
    const interval = setInterval(() => {
      left--;
      setRetryIn(left);
      if (left <= 0) {
        clearInterval(interval);
        const nextAttempt = attempt + 1;
        setAttempt(nextAttempt);
        const interval_secs = RETRY_INTERVALS[Math.min(nextAttempt, RETRY_INTERVALS.length - 1)];
        setRetryIn(interval_secs);
        onRetry?.();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isOffline, retryIn <= 0]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.banner, { height: heightAnim, opacity }]}>
      <Animated.View style={[styles.dot, { transform: [{ scale: pulseAnim }] }]} />
      <Text style={styles.label}>No connection</Text>
      <Text style={styles.sub}>Retry in {retryIn}s</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
        <Text style={styles.retryText}>↺ Retry now</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "#1c0f00",
    borderBottomWidth: 1,
    borderBottomColor: "#f97316",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 10,
    overflow: "hidden",
  },
  dot: {
    width:  8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#f97316",
  },
  label: { color: "#fb923c", fontWeight: "700", fontSize: 13, flex: 1 },
  sub:   { color: "#92400e", fontSize: 12 },
  retryBtn: {
    backgroundColor: "rgba(251,146,60,0.15)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(251,146,60,0.3)",
  },
  retryText: { color: "#fb923c", fontSize: 12, fontWeight: "700" },
});
