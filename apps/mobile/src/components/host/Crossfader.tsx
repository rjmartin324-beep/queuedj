import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, PanResponder, LayoutChangeEvent } from "react-native";
import { audioEngine } from "../../lib/engines/audioEngineSingleton";

// ─────────────────────────────────────────────────────────────────────────────
// Crossfader — horizontal drag slider, 0 (Deck A) → 1 (Deck B)
//
// Calls audioEngine.setCrossfader() directly — the host device IS the engine.
// No socket event needed; crossfader is local to the host's audio context.
// ─────────────────────────────────────────────────────────────────────────────

const THUMB_SIZE = 36;

export function Crossfader() {
  const [value, setValue]       = useState(0.5); // 0 = full A, 1 = full B
  const [trackWidth, setTrackWidth] = useState(0);
  const valueRef = useRef(0.5);

  function onTrackLayout(e: LayoutChangeEvent) {
    setTrackWidth(e.nativeEvent.layout.width);
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,

      onPanResponderGrant: (e) => {
        // Allow tapping anywhere on the track to jump
        const { locationX } = e.nativeEvent;
        const width = trackWidth - THUMB_SIZE;
        if (width <= 0) return;
        const next = Math.max(0, Math.min(1, locationX / width));
        valueRef.current = next;
        setValue(next);
        audioEngine.setCrossfader(next);
      },

      onPanResponderMove: (_, gesture) => {
        const width = trackWidth - THUMB_SIZE;
        if (width <= 0) return;
        const startX = valueRef.current * width;
        const next   = Math.max(0, Math.min(1, (startX + gesture.dx) / width));
        setValue(next);
        audioEngine.setCrossfader(next);
      },

      onPanResponderRelease: () => {
        valueRef.current = value;
      },
    })
  ).current;

  const thumbLeft = value * Math.max(0, trackWidth - THUMB_SIZE);
  const atCenter  = Math.abs(value - 0.5) < 0.02;

  return (
    <View style={styles.container}>
      <View style={styles.labels}>
        <Text style={[styles.deckLabel, value < 0.5 && styles.deckLabelActive]}>A</Text>
        <Text style={styles.centerLabel}>{atCenter ? "CENTER" : value < 0.5 ? `←` : `→`}</Text>
        <Text style={[styles.deckLabel, value > 0.5 && styles.deckLabelActive]}>B</Text>
      </View>

      <View style={styles.track} onLayout={onTrackLayout} {...panResponder.panHandlers}>
        {/* Filled portion left of thumb */}
        <View style={[styles.fill, styles.fillLeft,  { width: thumbLeft }]} />
        {/* Filled portion right of thumb */}
        <View style={[styles.fill, styles.fillRight, { right: 0, width: trackWidth - thumbLeft - THUMB_SIZE }]} />

        <View style={[styles.thumb, { left: thumbLeft }, atCenter && styles.thumbCenter]} />
      </View>

      {/* Reset to center on double-tap approximation */}
      <Text
        style={styles.resetHint}
        onPress={() => { setValue(0.5); valueRef.current = 0.5; audioEngine.setCrossfader(0.5); }}
      >
        reset
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { gap: 8 },
  labels:          { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  deckLabel:       { color: "#444", fontSize: 16, fontWeight: "900", width: 28, textAlign: "center" },
  deckLabelActive: { color: "#6c47ff" },
  centerLabel:     { color: "#555", fontSize: 11, fontWeight: "600", letterSpacing: 1 },
  track:           { height: THUMB_SIZE, backgroundColor: "#1a1a1a", borderRadius: THUMB_SIZE / 2, borderWidth: 1, borderColor: "#333", justifyContent: "center", position: "relative" },
  fill:            { position: "absolute", height: 4, top: (THUMB_SIZE - 4) / 2, backgroundColor: "#333" },
  fillLeft:        { left: 0, borderRadius: 2 },
  fillRight:       { borderRadius: 2 },
  thumb:           { position: "absolute", width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: THUMB_SIZE / 2, backgroundColor: "#fff", borderWidth: 3, borderColor: "#6c47ff", shadowColor: "#6c47ff", shadowOpacity: 0.4, shadowRadius: 8, elevation: 4 },
  thumbCenter:     { borderColor: "#22c55e" },
  resetHint:       { color: "#444", fontSize: 11, textAlign: "center" },
});
