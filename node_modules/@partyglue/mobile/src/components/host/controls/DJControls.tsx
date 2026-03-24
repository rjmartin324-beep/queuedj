import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRoom } from "../../../contexts/RoomContext";
import { socketManager } from "../../../lib/socket";
import { Crossfader } from "../Crossfader";
import type { VibePreset } from "@partyglue/shared-types";

const VIBES: { preset: VibePreset; label: string; emoji: string }[] = [
  { preset: "open",       label: "Open",       emoji: "🌊" },
  { preset: "hype",       label: "Hype",        emoji: "🔥" },
  { preset: "chill",      label: "Chill",       emoji: "🧊" },
  { preset: "throwback",  label: "Throwback",   emoji: "📻" },
];

export function DJControls() {
  const { state } = useRoom();
  const [bathroomActive, setBathroomActive] = useState(false);
  const [activeVibe, setActiveVibe] = useState<VibePreset>("open");

  function toggleBathroom() {
    const socket = socketManager.get();
    if (!socket || !state.room) return;
    const next = !bathroomActive;
    setBathroomActive(next);
    socket.emit("bathroom:toggle" as any, { roomId: state.room.id, active: next });
  }

  function setVibe(preset: VibePreset) {
    const socket = socketManager.get();
    if (!socket || !state.room) return;
    setActiveVibe(preset);
    socket.emit("vibe:set" as any, { roomId: state.room.id, preset });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>CROSSFADER</Text>
      <Crossfader />

      <Text style={styles.sectionLabel}>VIBE</Text>
      <View style={styles.row}>
        {VIBES.map(({ preset, label, emoji }) => (
          <TouchableOpacity
            key={preset}
            style={[styles.vibeBtn, activeVibe === preset && styles.vibeBtnActive]}
            onPress={() => setVibe(preset)}
          >
            <Text style={styles.vibeEmoji}>{emoji}</Text>
            <Text style={styles.vibeLabel}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionLabel}>BREAK</Text>
      <TouchableOpacity
        style={[styles.bathroomBtn, bathroomActive && styles.bathroomBtnActive]}
        onPress={toggleBathroom}
      >
        <Text style={styles.bathroomText}>
          {bathroomActive ? "🚻 Bathroom Break — ON (tap to end)" : "🚻 Start Bathroom Break"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { gap: 12 },
  sectionLabel:     { color: "#555", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  row:              { flexDirection: "row", gap: 10 },
  vibeBtn:          { flex: 1, backgroundColor: "#1a1a1a", borderRadius: 10, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "#333", gap: 4 },
  vibeBtnActive:    { borderColor: "#6c47ff", backgroundColor: "#1e1e2e" },
  vibeEmoji:        { fontSize: 20 },
  vibeLabel:        { color: "#fff", fontSize: 11, fontWeight: "600" },
  bathroomBtn:      { backgroundColor: "#1a1a1a", borderRadius: 10, padding: 16, alignItems: "center", borderWidth: 1, borderColor: "#333" },
  bathroomBtnActive:{ borderColor: "#f59e0b", backgroundColor: "#1c1a0e" },
  bathroomText:     { color: "#fff", fontSize: 14, fontWeight: "600" },
});
