import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// ServerTimer — countdown synced to a server-provided start time
// Counts down from total seconds, flashes red when < 5s
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  /** Server timestamp (ms) when the phase started */
  startedAt: number;
  /** Total duration in seconds */
  durationSec: number;
  /** Called when timer reaches 0 */
  onExpiry?: () => void;
  /** Show large display — default false */
  large?: boolean;
}

export function ServerTimer({ startedAt, durationSec, onExpiry, large = false }: Props) {
  const [remaining, setRemaining] = useState(durationSec);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const expiredRef = useRef(false);

  useEffect(() => {
    expiredRef.current = false;

    function tick() {
      const elapsed = (Date.now() - startedAt) / 1000;
      const left = Math.max(0, durationSec - elapsed);
      setRemaining(Math.ceil(left));

      if (left <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpiry?.();
      }
    }

    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [startedAt, durationSec]);

  // Flash animation at < 5s
  useEffect(() => {
    if (remaining <= 5 && remaining > 0) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,   duration: 200, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [remaining <= 5]);

  const urgent = remaining <= 5;
  const color  = remaining <= 5 ? "#ef4444" : remaining <= 10 ? "#f97316" : "#22c55e";

  const pct = durationSec > 0 ? remaining / durationSec : 0;

  return (
    <Animated.View style={[styles.container, large && styles.large, { opacity: pulseAnim }]}>
      {large ? (
        <View style={styles.dialWrap}>
          <Text style={[styles.dialText, { color }]}>{remaining}</Text>
          <Text style={styles.dialLabel}>SEC</Text>
          {/* Arc hint */}
          <View style={[styles.arcTrack]}>
            <View style={[styles.arcFill, { width: `${pct * 100}%` as any, backgroundColor: color }]} />
          </View>
        </View>
      ) : (
        <View style={[styles.pill, { borderColor: color + "55", backgroundColor: color + "15" }]}>
          <Text style={[styles.pillText, { color }]}>{remaining}s</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {},
  large:     { alignItems: "center" },

  pill:     { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7 },
  pillText: { fontWeight: "900", fontSize: 15 },

  dialWrap:  { alignItems: "center", gap: 4 },
  dialText:  { fontSize: 52, fontWeight: "900", lineHeight: 56 },
  dialLabel: { color: "#6b7280", fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  arcTrack:  {
    width: 120, height: 6, backgroundColor: "#1f2937",
    borderRadius: 3, overflow: "hidden", marginTop: 4,
  },
  arcFill:   { height: 6, borderRadius: 3 },
});
