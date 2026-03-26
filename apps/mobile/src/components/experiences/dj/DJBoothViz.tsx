import React, { useEffect, useRef } from "react";
import {
  Animated, Easing, PanResponder, StyleSheet, Text, View,
} from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// DJBoothViz — decorative crossfader + EQ band display
// Visual-only; reflects current BPM/energy. Crossfader is draggable for fun.
// ─────────────────────────────────────────────────────────────────────────────

const EQ_BANDS = ["32", "125", "500", "2k", "8k", "16k"];

interface Props {
  bpm?:    number | null;
  energy?: number | null;
  /** Width of the component — defaults to "100%" */
  width?:  number;
}

// ─── EQ Bars ─────────────────────────────────────────────────────────────────

function EQDisplay({ energy }: { energy: number }) {
  const anims = useRef(EQ_BANDS.map(() => new Animated.Value(0.2))).current;
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Randomize bar heights on a fast interval, scaled by energy
    function tick() {
      const base = 0.15 + energy * 0.5;
      anims.forEach((a, i) => {
        // Each band has different character: bass is higher at high energy
        const bandBoost = i < 2 ? energy * 0.3 : 0;
        const target = Math.min(1, Math.max(0.05, base + bandBoost + (Math.random() - 0.5) * 0.4));
        Animated.timing(a, { toValue: target, duration: 100, useNativeDriver: false }).start();
      });
    }
    tickRef.current = setInterval(tick, 130);
    tick();
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [energy]);

  return (
    <View style={styles.eqContainer}>
      <Text style={styles.eqTitle}>EQ</Text>
      <View style={styles.eqBars}>
        {anims.map((a, i) => {
          const barH = a.interpolate({ inputRange: [0, 1], outputRange: ["5%", "95%"] });
          // Color: green → yellow → red based on height
          const color = a.interpolate({
            inputRange:  [0, 0.5, 0.8, 1],
            outputRange: ["#22c55e", "#f59e0b", "#f97316", "#ef4444"],
          });
          return (
            <View key={i} style={styles.eqBarTrack}>
              <Animated.View style={[styles.eqBarFill, { height: barH, backgroundColor: color }]} />
              <Text style={styles.eqBandLabel}>{EQ_BANDS[i]}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Crossfader ───────────────────────────────────────────────────────────────

const TRACK_W = 200;
const KNOB_W  = 32;

function Crossfader() {
  const posX = useRef(new Animated.Value(TRACK_W / 2 - KNOB_W / 2)).current;
  const posXRef = useRef(TRACK_W / 2 - KNOB_W / 2);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderMove: (_, gs) => {
        const newX = Math.max(0, Math.min(TRACK_W - KNOB_W, posXRef.current + gs.dx));
        posX.setValue(newX);
      },
      onPanResponderRelease: (_, gs) => {
        posXRef.current = Math.max(0, Math.min(TRACK_W - KNOB_W, posXRef.current + gs.dx));
      },
    }),
  ).current;

  // Left/Right labels
  const labelA_opacity = posX.interpolate({
    inputRange:  [0, TRACK_W / 2 - KNOB_W / 2],
    outputRange: [1, 0.3],
    extrapolate: "clamp",
  });
  const labelB_opacity = posX.interpolate({
    inputRange:  [TRACK_W / 2 - KNOB_W / 2, TRACK_W - KNOB_W],
    outputRange: [0.3, 1],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.faderSection}>
      <Text style={styles.faderTitle}>CROSSFADER</Text>
      <View style={styles.faderRow}>
        <Animated.Text style={[styles.deckLabel, { opacity: labelA_opacity }]}>A</Animated.Text>
        <View style={[styles.faderTrack, { width: TRACK_W }]}>
          <View style={styles.faderLine} />
          <Animated.View
            style={[styles.faderKnob, { left: posX }]}
            {...panResponder.panHandlers}
          />
        </View>
        <Animated.Text style={[styles.deckLabel, { opacity: labelB_opacity }]}>B</Animated.Text>
      </View>
    </View>
  );
}

// ─── BPM Dial ─────────────────────────────────────────────────────────────────

function BPMDial({ bpm }: { bpm: number }) {
  const rotAnim = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (loopRef.current) loopRef.current.stop();
    const msPerBeat = (60 / bpm) * 1000;
    const loop = Animated.loop(
      Animated.timing(rotAnim, { toValue: 1, duration: msPerBeat, easing: Easing.linear, useNativeDriver: true }),
    );
    loopRef.current = loop;
    loop.start();
    return () => loop.stop();
  }, [bpm]);

  const rotate = rotAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <View style={styles.dialSection}>
      <Animated.View style={[styles.dial, { transform: [{ rotate }] }]}>
        <View style={styles.dialLine} />
      </Animated.View>
      <Text style={styles.dialBpm}>{Math.round(bpm)}</Text>
      <Text style={styles.dialLabel}>BPM</Text>
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DJBoothViz({ bpm, energy }: Props) {
  const safeEnergy = Math.max(0, Math.min(1, energy ?? 0.5));

  return (
    <View style={styles.container}>
      <EQDisplay energy={safeEnergy} />
      <View style={styles.divider} />
      <Crossfader />
      {bpm && bpm >= 40 && bpm <= 250 && (
        <>
          <View style={styles.divider} />
          <BPMDial bpm={bpm} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(10,5,25,0.98)",
    borderRadius:    20,
    borderWidth:     1,
    borderColor:     "rgba(124,58,237,0.25)",
    padding:         16,
    gap:             12,
  },

  // EQ
  eqContainer: {},
  eqTitle:     { color: "#6b7280", fontSize: 9, fontWeight: "800", letterSpacing: 2, marginBottom: 8, textAlign: "center" },
  eqBars:      { flexDirection: "row", height: 60, alignItems: "flex-end", justifyContent: "center", gap: 4 },
  eqBarTrack:  { width: 22, alignItems: "center" },
  eqBarFill:   { width: 14, borderRadius: 3, position: "absolute", bottom: 14 },
  eqBandLabel: { color: "#4b5563", fontSize: 8, fontWeight: "600", marginTop: 2, position: "absolute", bottom: 0 },

  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.05)" },

  // Fader
  faderSection: { alignItems: "center" },
  faderTitle:   { color: "#6b7280", fontSize: 9, fontWeight: "800", letterSpacing: 2, marginBottom: 10 },
  faderRow:     { flexDirection: "row", alignItems: "center", gap: 12 },
  deckLabel:    { color: "#a78bfa", fontWeight: "900", fontSize: 14, width: 20, textAlign: "center" },
  faderTrack:   { height: 20, justifyContent: "center", position: "relative" },
  faderLine:    {
    height: 4, backgroundColor: "#1f2937", borderRadius: 2,
    position: "absolute", left: 0, right: 0, top: 8,
  },
  faderKnob:    {
    position:        "absolute",
    width:           KNOB_W,
    height:          20,
    backgroundColor: "#7c3aed",
    borderRadius:    6,
    shadowColor:     "#7c3aed",
    shadowOpacity:   0.8,
    shadowRadius:    8,
    shadowOffset:    { width: 0, height: 0 },
    elevation:       4,
  },

  // BPM Dial
  dialSection: { alignItems: "center", gap: 4 },
  dial:        {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: "rgba(124,58,237,0.15)",
    borderWidth:     2,
    borderColor:     "#7c3aed",
    alignItems:      "center",
    justifyContent:  "flex-start",
    paddingTop:      4,
  },
  dialLine:  { width: 2, height: 14, backgroundColor: "#a78bfa", borderRadius: 1 },
  dialBpm:   { color: "#fff", fontWeight: "900", fontSize: 18, marginTop: 4 },
  dialLabel: { color: "#6b7280", fontSize: 9, fontWeight: "700", letterSpacing: 2 },
});
