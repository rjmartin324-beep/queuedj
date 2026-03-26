import React, { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Easing, StyleSheet, View } from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// ConfettiBlast — one-shot confetti particle animation
// Trigger with `active` prop. Renders over its sibling (position: absolute).
// ─────────────────────────────────────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get("window");

const COLORS = [
  "#a78bfa", "#34d399", "#f59e0b", "#f472b6",
  "#60a5fa", "#fb923c", "#4ade80", "#e879f9",
];

const PARTICLE_COUNT = 48;

function randomBetween(a: number, b: number) {
  return a + Math.random() * (b - a);
}

interface Particle {
  id:     number;
  x:      number;
  color:  string;
  size:   number;
  angle:  number;  // degrees
  speed:  number;
  delay:  number;
  transX: Animated.Value;
  transY: Animated.Value;
  rot:    Animated.Value;
  opacity: Animated.Value;
}

function buildParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id:      i,
    x:       randomBetween(0, SCREEN_W),
    color:   COLORS[i % COLORS.length],
    size:    randomBetween(5, 11),
    angle:   randomBetween(-60, 60),
    speed:   randomBetween(0.7, 1.3),
    delay:   randomBetween(0, 300),
    transX:  new Animated.Value(0),
    transY:  new Animated.Value(0),
    rot:     new Animated.Value(0),
    opacity: new Animated.Value(1),
  }));
}

interface Props {
  active: boolean;
  /** Called when all particles have finished — useful to reset `active` */
  onDone?: () => void;
  /** Origin Y offset from top — defaults to 0 (top of screen) */
  originY?: number;
}

export function ConfettiBlast({ active, onDone, originY = 0 }: Props) {
  const [particles] = useState<Particle[]>(() => buildParticles());
  const animsRef = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    if (!active) return;

    // Reset
    particles.forEach((p) => {
      p.transX.setValue(0);
      p.transY.setValue(0);
      p.rot.setValue(0);
      p.opacity.setValue(1);
    });

    const DURATION = 1400;

    animsRef.current = particles.map((p) => {
      const dx = Math.sin((p.angle * Math.PI) / 180) * randomBetween(60, 200);
      const dy = randomBetween(180, 400) * p.speed;

      return Animated.parallel([
        Animated.timing(p.transX, {
          toValue: dx,
          duration: DURATION * p.speed,
          delay: p.delay,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(p.transY, {
          toValue: dy,
          duration: DURATION * p.speed,
          delay: p.delay,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(p.rot, {
          toValue: randomBetween(2, 6),
          duration: DURATION * p.speed,
          delay: p.delay,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(DURATION * p.speed * 0.6 + p.delay),
          Animated.timing(p.opacity, {
            toValue: 0,
            duration: DURATION * p.speed * 0.4,
            useNativeDriver: true,
          }),
        ]),
      ]);
    });

    Animated.parallel(animsRef.current).start(() => {
      onDone?.();
    });

    return () => {
      animsRef.current.forEach((a) => a.stop());
    };
  }, [active]);

  if (!active) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { top: originY }]} pointerEvents="none">
      {particles.map((p) => {
        const rotate = p.rot.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", "360deg"],
        });
        return (
          <Animated.View
            key={p.id}
            style={[
              styles.particle,
              {
                left:            p.x,
                top:             0,
                width:           p.size,
                height:          p.size * (Math.random() > 0.5 ? 1 : 0.4), // mix squares and strips
                borderRadius:    p.size * 0.2,
                backgroundColor: p.color,
                transform: [
                  { translateX: p.transX },
                  { translateY: p.transY },
                  { rotate },
                ],
                opacity: p.opacity,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  particle: { position: "absolute" },
});
