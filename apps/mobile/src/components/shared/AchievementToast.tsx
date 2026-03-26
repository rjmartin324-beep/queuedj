import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { tapHeavy } from "../../lib/haptics";

// ─────────────────────────────────────────────────────────────────────────────
// AchievementToast
//
// Singleton toast that slides down from the top of the screen when an
// achievement is unlocked. Mount <AchievementToast /> once near the root of
// your app (e.g. inside your root layout), then call showAchievementToast()
// from anywhere without needing props or context.
// ─────────────────────────────────────────────────────────────────────────────

export interface Achievement {
  emoji: string;
  title: string;
  desc:  string;
}

// Module-level singleton ref — set when the component mounts.
let _show: ((a: Achievement) => void) | null = null;

/** Call this from anywhere in the app to trigger the toast. */
export function showAchievementToast(achievement: Achievement): void {
  _show?.(achievement);
}

const SLIDE_IN_DURATION  = 420;
const SLIDE_OUT_DURATION = 340;
const HOLD_DURATION      = 3000;

export function AchievementToast() {
  const translateY  = useRef(new Animated.Value(-120)).current;
  const currentData = useRef<Achievement>({ emoji: "", title: "", desc: "" });
  const [data, setData] = React.useState<Achievement>({ emoji: "", title: "", desc: "" });
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isVisible   = useRef(false);

  useEffect(() => {
    // Register singleton handler on mount.
    _show = (achievement: Achievement) => {
      // Cancel any in-flight hold timer.
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      currentData.current = achievement;
      setData(achievement);

      if (isVisible.current) {
        // Already on screen — snap back to top then re-enter so the new
        // achievement registers as a fresh pop.
        Animated.timing(translateY, {
          toValue: -120,
          duration: 160,
          useNativeDriver: true,
        }).start(() => enter());
      } else {
        enter();
      }
    };

    return () => {
      // Deregister on unmount so a stale ref is never called.
      _show = null;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function enter() {
    isVisible.current = true;
    tapHeavy();

    Animated.timing(translateY, {
      toValue: 0,
      duration: SLIDE_IN_DURATION,
      easing: Easing.out(Easing.back(1.5)),
      useNativeDriver: true,
    }).start(() => {
      timerRef.current = setTimeout(() => {
        exit();
      }, HOLD_DURATION);
    });
  }

  function exit() {
    Animated.timing(translateY, {
      toValue: -120,
      duration: SLIDE_OUT_DURATION,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      isVisible.current = false;
    });
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrapper, { transform: [{ translateY }] }]}
    >
      {/* Gold shimmer strip */}
      <LinearGradient
        colors={["rgba(251,191,36,0.55)", "rgba(251,191,36,0.08)", "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.shimmer}
      />

      {/* Purple left border accent */}
      <View style={styles.leftBorder} />

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.emoji}>{data.emoji}</Text>
        <View style={styles.textBlock}>
          <Text style={styles.label}>Achievement Unlocked!</Text>
          <Text style={styles.title} numberOfLines={1}>{data.title}</Text>
          <Text style={styles.desc}  numberOfLines={2}>{data.desc}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    top:      60,
    left:     16,
    right:    16,
    zIndex:   9999,
    backgroundColor: "#141414",
    borderRadius: 18,
    overflow: "hidden",
    // Subtle shadow for depth
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 12,
  },

  shimmer: {
    position: "absolute",
    top:    0,
    left:   0,
    right:  0,
    height: 3,
  },

  leftBorder: {
    position: "absolute",
    top:      0,
    bottom:   0,
    left:     0,
    width:    4,
    backgroundColor: "#7c3aed",
  },

  content: {
    flexDirection: "row",
    alignItems:    "center",
    paddingVertical:   14,
    paddingLeft:       20,  // clears the 4 px left border + breathing room
    paddingRight:      16,
    gap: 14,
  },

  emoji: {
    fontSize: 34,
  },

  textBlock: {
    flex: 1,
    gap:  2,
  },

  label: {
    color:       "#a78bfa",
    fontSize:    10,
    fontWeight:  "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },

  title: {
    color:      "#ffffff",
    fontSize:   15,
    fontWeight: "800",
  },

  desc: {
    color:      "#9ca3af",
    fontSize:   12,
    lineHeight: 16,
  },
});
