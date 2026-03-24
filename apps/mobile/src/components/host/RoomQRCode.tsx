import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from "react-native";
import QRCode from "react-native-qrcode-svg";

// ─────────────────────────────────────────────────────────────────────────────
// RoomQRCode — shows a tappable QR code badge in the host header
// Tapping opens a full-screen modal so guests across the room can scan it
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  roomCode: string;
}

// Encode the room code as a deep link — the guest app handles queuedj://join/XXXX
function buildJoinUrl(code: string) {
  return `queuedj://join/${code}`;
}

export function RoomQRCode({ roomCode }: Props) {
  const [enlarged, setEnlarged] = useState(false);
  const joinUrl = buildJoinUrl(roomCode);

  return (
    <>
      {/* Small badge in header — tap to enlarge */}
      <TouchableOpacity style={styles.badge} onPress={() => setEnlarged(true)}>
        <QRCode value={joinUrl} size={48} color="#ffffff" backgroundColor="#0a0a0a" />
        <Text style={styles.tapHint}>tap to enlarge</Text>
      </TouchableOpacity>

      {/* Full-screen modal for room scan */}
      <Modal visible={enlarged} transparent animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setEnlarged(false)}>
          <View style={styles.modal}>
            <Text style={styles.modalCode}>{roomCode}</Text>
            <Text style={styles.modalHint}>Scan to join</Text>
            <View style={styles.qrWrapper}>
              <QRCode value={joinUrl} size={240} color="#ffffff" backgroundColor="#141414" />
            </View>
            <Text style={styles.dismiss}>tap anywhere to close</Text>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  badge:      { alignItems: "center", gap: 4 },
  tapHint:    { color: "#555", fontSize: 9 },
  overlay:    { flex: 1, backgroundColor: "#000000dd", alignItems: "center", justifyContent: "center" },
  modal:      { backgroundColor: "#141414", borderRadius: 24, padding: 36, alignItems: "center", gap: 12 },
  modalCode:  { color: "#fff", fontSize: 42, fontWeight: "900", letterSpacing: 8 },
  modalHint:  { color: "#666", fontSize: 14 },
  qrWrapper:  { padding: 16, backgroundColor: "#141414", borderRadius: 16, marginVertical: 8 },
  dismiss:    { color: "#444", fontSize: 12, marginTop: 8 },
});
