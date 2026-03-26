import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useRoom } from "../../contexts/RoomContext";
import { tapLight, notifySuccess, notifyError } from "../../lib/haptics";

// ─────────────────────────────────────────────────────────────────────────────
// LocalTrackImporter — host picks a local audio file, submits to the API
// for fingerprinting (AcoustID), then adds the resolved track to the queue
// ─────────────────────────────────────────────────────────────────────────────

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

interface ResolvedTrack {
  isrc:      string;
  title:     string;
  artist:    string;
  bpm?:      number;
  confidence: number;
}

export function LocalTrackImporter() {
  const { state, sendAction } = useRoom();
  const [loading, setLoading] = useState(false);
  const [resolved, setResolved] = useState<ResolvedTrack | null>(null);

  async function pickFile() {
    tapLight();
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["audio/*"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setLoading(true);
      setResolved(null);

      // Send to fingerprinting endpoint
      const formData = new FormData();
      formData.append("file", {
        uri:  asset.uri,
        name: asset.name ?? "track.mp3",
        type: asset.mimeType ?? "audio/mpeg",
      } as any);

      const res = await fetch(`${API_URL}/tracks/fingerprint`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.isrc) {
        setResolved(data);
        notifySuccess();
      } else {
        Alert.alert("Could not identify", "Track fingerprint didn't match any known recordings. Try searching manually.");
        notifyError();
      }
    } catch (err) {
      console.warn("[LocalTrackImporter]", err);
      Alert.alert("Error", "Could not fingerprint this file. Make sure it's a valid audio file.");
      notifyError();
    } finally {
      setLoading(false);
    }
  }

  function addToQueue() {
    if (!resolved || !state.room) return;
    tapLight();
    sendAction("queue:request", {
      roomId:      state.room.id,
      guestId:     state.guestId,
      displayName: "Host",
      isrc:        resolved.isrc,
      title:       resolved.title,
      artist:      resolved.artist,
    });
    setResolved(null);
    notifySuccess();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>LOCAL FILE</Text>

      <TouchableOpacity
        style={styles.pickBtn}
        onPress={pickFile}
        disabled={loading}
        activeOpacity={0.7}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#a78bfa" />
        ) : (
          <>
            <Text style={styles.pickEmoji}>📁</Text>
            <Text style={styles.pickText}>Pick audio file…</Text>
          </>
        )}
      </TouchableOpacity>

      {resolved && (
        <View style={styles.resolved}>
          <View style={styles.resolvedInfo}>
            <Text style={styles.resolvedTitle} numberOfLines={1}>{resolved.title}</Text>
            <Text style={styles.resolvedArtist} numberOfLines={1}>{resolved.artist}</Text>
            <Text style={styles.resolvedConf}>
              Confidence: {Math.round(resolved.confidence * 100)}%
              {resolved.bpm ? `  ·  ${Math.round(resolved.bpm)} BPM` : ""}
            </Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={addToQueue}>
            <Text style={styles.addBtnText}>+ Queue</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  label:     { color: "#555", fontSize: 11, fontWeight: "700", letterSpacing: 1 },

  pickBtn: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             10,
    backgroundColor: "#0d0d0d",
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     "#2a2a2a",
    borderStyle:     "dashed",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pickEmoji: { fontSize: 22 },
  pickText:  { color: "#6b7280", fontSize: 14, fontWeight: "600" },

  resolved: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             12,
    backgroundColor: "rgba(124,58,237,0.12)",
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     "rgba(124,58,237,0.3)",
    padding:         12,
  },
  resolvedInfo:   { flex: 1, gap: 2 },
  resolvedTitle:  { color: "#fff", fontWeight: "700", fontSize: 14 },
  resolvedArtist: { color: "#9ca3af", fontSize: 12 },
  resolvedConf:   { color: "#6b7280", fontSize: 11, marginTop: 2 },

  addBtn:     { backgroundColor: "#7c3aed", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  addBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
});
