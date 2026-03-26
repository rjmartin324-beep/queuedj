import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// AudioWaveform — animated bar waveform that simulates audio playback
// Used as a "now playing" visual indicator. Energy drives the amplitude.
// ─────────────────────────────────────────────────────────────────────────────

const BAR_COUNT = 24;

interface Props {
  /** 0–1 energy drives amplitude */
  energy?: number | null;
  /** Whether audio is "playing" — bars animate when true */
  playing?: boolean;
  color?:   string;
  height?:  number;
}

function buildBars() {
  return Array.from({ length: BAR_COUNT }, () => new Animated.Value(0.15));
}

export function AudioWaveform({ energy = 0.5, playing = true, color = "#a78bfa", height = 40 }: Props) {
  const bars     = useRef(buildBars()).current;
  const tickRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const loopRef  = useRef<Animated.CompositeAnimation | null>(null);

  const safeEnergy = Math.max(0, Math.min(1, energy ?? 0.5));

  useEffect(() => {
    if (!playing) {
      // Decay all bars to minimum
      bars.forEach(b => Animated.timing(b, { toValue: 0.08, duration: 400, useNativeDriver: false }).start());
      if (tickRef.current) clearInterval(tickRef.current);
      return;
    }

    function tick() {
      const base = 0.15 + safeEnergy * 0.55;
      bars.forEach((b, i) => {
        // Center bars are taller (frequency shape)
        const center = 1 - Math.abs(i - BAR_COUNT / 2) / (BAR_COUNT / 2);
        const target = Math.min(0.98, Math.max(0.05, base * (0.5 + center * 0.7) + (Math.random() - 0.5) * 0.35));
        Animated.timing(b, { toValue: target, duration: 120, useNativeDriver: false }).start();
      });
    }

    tick();
    tickRef.current = setInterval(tick, 130);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [playing, safeEnergy]);

  return (
    <View style={[styles.container, { height }]}>
      {bars.map((anim, i) => {
        const barH = anim.interpolate({
          inputRange:  [0, 1],
          outputRange: [height * 0.05, height * 0.95],
        });
        return (
          <Animated.View
            key={i}
            style={[
              styles.bar,
              {
                height:          barH,
                backgroundColor: color,
                opacity:         0.6 + (i % 3 === 0 ? 0.4 : 0),
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection:  "row",
    alignItems:     "flex-end",
    gap:            2,
    overflow:       "hidden",
  },
  bar: {
    flex:         1,
    minWidth:     3,
    borderRadius: 2,
  },
});
