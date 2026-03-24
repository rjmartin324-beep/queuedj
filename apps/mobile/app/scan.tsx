import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";

// ─────────────────────────────────────────────────────────────────────────────
// QR Scanner Screen — guest scans host's QR code to join
//
// Decodes queuedj://join/XXXX deep link and navigates to the join flow
// with the room code pre-filled.
// ─────────────────────────────────────────────────────────────────────────────

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permText}>Camera access is needed to scan QR codes.</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Allow Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function handleBarcode({ data }: { data: string }) {
    if (scanned) return;
    setScanned(true);

    // Parse queuedj://join/XXXX
    const match = data.match(/queuedj:\/\/join\/([A-Z0-9]{4,8})/i);
    if (match) {
      const code = match[1].toUpperCase();
      // Navigate back to home with the code as a param — HomeScreen reads it
      router.replace({ pathname: "/", params: { code } });
    } else {
      // Not a valid QR code — let them try again
      setTimeout(() => setScanned(false), 1500);
    }
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanned ? undefined : handleBarcode}
      />

      {/* Viewfinder overlay */}
      <View style={styles.overlay}>
        <View style={styles.topDim} />
        <View style={styles.middleRow}>
          <View style={styles.sideDim} />
          <View style={styles.viewfinder}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
          </View>
          <View style={styles.sideDim} />
        </View>
        <View style={styles.bottomDim}>
          <Text style={styles.scanLabel}>
            {scanned ? "Got it!" : "Point at the host's QR code"}
          </Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const VF = 220; // viewfinder size
const C  = 20;  // corner size

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: "#000" },
  camera:      { flex: 1 },
  overlay:     { ...StyleSheet.absoluteFillObject },
  topDim:      { flex: 1, backgroundColor: "#000000aa" },
  middleRow:   { flexDirection: "row", height: VF },
  sideDim:     { flex: 1, backgroundColor: "#000000aa" },
  viewfinder:  { width: VF, height: VF },
  bottomDim:   { flex: 1, backgroundColor: "#000000aa", alignItems: "center", justifyContent: "center", gap: 20 },
  scanLabel:   { color: "#fff", fontSize: 16, fontWeight: "600" },

  // Corner markers
  corner:      { position: "absolute", width: C, height: C, borderColor: "#6c47ff", borderWidth: 3 },
  tl:          { top: 0,      left: 0,      borderRightWidth: 0, borderBottomWidth: 0 },
  tr:          { top: 0,      right: 0,     borderLeftWidth: 0,  borderBottomWidth: 0 },
  bl:          { bottom: 0,   left: 0,      borderRightWidth: 0, borderTopWidth: 0    },
  br:          { bottom: 0,   right: 0,     borderLeftWidth: 0,  borderTopWidth: 0    },

  permText:    { color: "#fff", fontSize: 16, textAlign: "center", marginBottom: 24, paddingHorizontal: 32 },
  permBtn:     { backgroundColor: "#6c47ff", paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 },
  permBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  backBtn:     { paddingVertical: 12, paddingHorizontal: 24 },
  backBtnText: { color: "#888", fontSize: 14 },
});
