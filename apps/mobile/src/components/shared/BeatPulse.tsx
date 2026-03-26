import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// BeatPulse — pulsing dot that syncs to BPM
// Used in the now-playing bar to give a visual beat indicator
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  bpm:   number | null;
  color?: string;
  size?:  number;
}

export function BeatPulse({ bpm, color = "#a78bfa", size = 10 }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (animRef.current) {
      animRef.current.stop();
      animRef.current = null;
    }

    if (!bpm || bpm < 40 || bpm > 250) {
      scale.setValue(1);
      opacity.setValue(0.3);
      return;
    }

    const intervalMs = (60 / bpm) * 1000;
    const beatDuration = Math.min(intervalMs * 0.35, 150); // attack
    const releaseDuration = intervalMs - beatDuration;     // release

    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale,   { toValue: 1.6,  duration: beatDuration,    useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1,    duration: beatDuration,    useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale,   { toValue: 1,    duration: releaseDuration, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.5,  duration: releaseDuration, useNativeDriver: true }),
        ]),
      ]),
    );
    animRef.current = loop;
    loop.start();

    return () => { loop.stop(); };
  }, [bpm]);

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          width:           size,
          height:          size,
          borderRadius:    size / 2,
          backgroundColor: color,
          transform:       [{ scale }],
          opacity,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: { alignSelf: "center" },
});
