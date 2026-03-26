import React, { useState } from "react";
import {
  View, Text, StyleSheet, Switch, TouchableOpacity, TextInput, Alert,
} from "react-native";
import { useRoom } from "../../contexts/RoomContext";
import { socketManager } from "../../lib/socket";
import { tapLight, selectionTick } from "../../lib/haptics";

// ─────────────────────────────────────────────────────────────────────────────
// RoomSettingsPanel — host-only room configuration controls
// Settings are emitted to the server via socket
// ─────────────────────────────────────────────────────────────────────────────

interface RoomSettings {
  requestsLocked:   boolean;
  votingEnabled:    boolean;
  maxGuests:        number;
  allowLateJoin:    boolean;
  showQueueToGuests: boolean;
}

const DEFAULT: RoomSettings = {
  requestsLocked:    false,
  votingEnabled:     true,
  maxGuests:         50,
  allowLateJoin:     true,
  showQueueToGuests: true,
};

function SettingRow({
  label, sub, right,
}: {
  label: string; sub?: string; right: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub && <Text style={styles.rowSub}>{sub}</Text>}
      </View>
      {right}
    </View>
  );
}

export function RoomSettingsPanel() {
  const { state } = useRoom();
  const [settings, setSettings] = useState<RoomSettings>(DEFAULT);
  const [maxGuestsText, setMaxGuestsText] = useState("50");

  function emit(key: string, value: unknown) {
    const socket = socketManager.getSocket();
    if (!socket || !state.room) return;
    socket.emit("room:setting" as any, { roomId: state.room.id, key, value });
  }

  function toggle(key: keyof RoomSettings) {
    selectionTick();
    const next = !settings[key] as boolean;
    setSettings(s => ({ ...s, [key]: next }));
    emit(key, next);
  }

  function saveMaxGuests() {
    const n = parseInt(maxGuestsText, 10);
    if (isNaN(n) || n < 2 || n > 500) {
      Alert.alert("Invalid", "Max guests must be between 2 and 500.");
      return;
    }
    tapLight();
    setSettings(s => ({ ...s, maxGuests: n }));
    emit("maxGuests", n);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>REQUESTS</Text>
      <View style={styles.card}>
        <SettingRow
          label="Lock requests"
          sub="Guests can't add new tracks"
          right={
            <Switch
              value={settings.requestsLocked}
              onValueChange={() => toggle("requestsLocked")}
              trackColor={{ false: "#333", true: "#7c3aed" }}
              thumbColor="#fff"
            />
          }
        />
        <SettingRow
          label="Enable voting"
          sub="Guests can upvote queue items"
          right={
            <Switch
              value={settings.votingEnabled}
              onValueChange={() => toggle("votingEnabled")}
              trackColor={{ false: "#333", true: "#7c3aed" }}
              thumbColor="#fff"
            />
          }
        />
        <SettingRow
          label="Show queue to guests"
          sub="Guests see upcoming tracks"
          right={
            <Switch
              value={settings.showQueueToGuests}
              onValueChange={() => toggle("showQueueToGuests")}
              trackColor={{ false: "#333", true: "#7c3aed" }}
              thumbColor="#fff"
            />
          }
        />
      </View>

      <Text style={[styles.sectionLabel, { marginTop: 16 }]}>ACCESS</Text>
      <View style={styles.card}>
        <SettingRow
          label="Allow late join"
          sub="Guests can join mid-session"
          right={
            <Switch
              value={settings.allowLateJoin}
              onValueChange={() => toggle("allowLateJoin")}
              trackColor={{ false: "#333", true: "#7c3aed" }}
              thumbColor="#fff"
            />
          }
        />
        <SettingRow
          label="Max guests"
          sub="0 = unlimited"
          right={
            <View style={styles.maxGuestsRow}>
              <TextInput
                style={styles.maxGuestsInput}
                value={maxGuestsText}
                onChangeText={setMaxGuestsText}
                keyboardType="number-pad"
                maxLength={3}
              />
              <TouchableOpacity style={styles.saveBtn} onPress={saveMaxGuests}>
                <Text style={styles.saveBtnText}>Set</Text>
              </TouchableOpacity>
            </View>
          }
        />
      </View>

      <Text style={[styles.info, { marginTop: 12 }]}>
        Changes apply immediately to all connected guests.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  sectionLabel: { color: "#555", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  card: {
    backgroundColor: "#0d0d0d",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1a1a1a",
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#111",
    gap: 12,
  },
  rowLabel: { color: "#e5e7eb", fontSize: 14 },
  rowSub:   { color: "#555", fontSize: 11 },

  maxGuestsRow:  { flexDirection: "row", alignItems: "center", gap: 8 },
  maxGuestsInput:{
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#333",
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    width: 52,
    textAlign: "center",
  },
  saveBtn:     { backgroundColor: "#7c3aed", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  saveBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  info: { color: "#374151", fontSize: 11, textAlign: "center" },
});
