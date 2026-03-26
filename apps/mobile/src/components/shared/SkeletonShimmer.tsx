import React, { useEffect, useRef } from "react";
import { Animated, ViewStyle } from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// SkeletonShimmer — pulsing placeholder for loading states
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonShimmer({ width = "100%", height = 20, borderRadius = 8, style }: Props) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 850, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.52] });

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius, backgroundColor: "#2a2a4a", opacity },
        style,
      ]}
    />
  );
}
