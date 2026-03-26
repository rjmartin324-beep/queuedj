import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, Image, StyleSheet, Animated, Linking, Alert,
} from "react-native";
import { launchCameraAsync, requestCameraPermissionsAsync, MediaType } from "expo-image-picker";
import { useRoom } from "../../../contexts/RoomContext";
import { WaitingForPlayersView } from "../shared/WaitingForPlayersView";

// ─────────────────────────────────────────────────────────────────────────────
// Scavenger Snap — ChallengeView
// Full-screen challenge display with 120s countdown, big camera button,
// thumbnail preview, and submit. Uses expo-image-picker launchCameraAsync.
// ─────────────────────────────────────────────────────────────────────────────

const ACCENT = "#10b981";
const TIMER_TOTAL = 120;

export function ChallengeView() {
  const { state, sendAction } = useRoom();
  const data = state.guestViewData as any;
  const challenge: string = data?.challenge ?? "Find something interesting!";

  const [photoUri, setPhotoUri]     = useState<string | null>(null);
  const [photoBase64, setBase64]    = useState<string | null>(null);
  const [uploading, setUploading]   = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [permDenied, setPermDenied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIMER_TOTAL);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const startedAt = useRef(Date.now());

  // Pulse animation on the camera button
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Countdown
  useEffect(() => {
    const iv = setInterval(() => {
      const elapsed = (Date.now() - startedAt.current) / 1000;
      const remaining = Math.max(0, TIMER_TOTAL - Math.floor(elapsed));
      setTimeLeft(remaining);
      if (remaining <= 0) clearInterval(iv);
    }, 500);
    return () => clearInterval(iv);
  }, []);

  const timerPct = timeLeft / TIMER_TOTAL;
  const timerColor =
    timerPct > 0.5 ? ACCENT : timerPct > 0.2 ? "#f59e0b" : "#ef4444";
  const isUrgent = timeLeft <= 20;

  async function takePhoto() {
    const { status, canAskAgain } = await requestCameraPermissionsAsync();
    if (status !== "granted") {
      setPermDenied(true);
      if (!canAskAgain) {
        Alert.alert(
          "Camera Access Required",
          "Camera permission was permanently denied. Open Settings to allow access, then come back.",
          [
            { text: "Open Settings", onPress: () => Linking.openSettings() },
            { text: "Cancel", style: "cancel" },
          ],
        );
      } else {
        Alert.alert(
          "Camera Access Required",
          "Please allow camera access so you can snap your photo for the challenge.",
          [
            { text: "Try Again", onPress: takePhoto },
            { text: "Cancel", style: "cancel" },
          ],
        );
      }
      return;
    }
    setPermDenied(false);
    const result = await launchCameraAsync({
      quality: 0.4,       // lower quality keeps base64 payload small enough for socket
      allowsEditing: true,
      aspect: [1, 1],
      base64: true,       // get base64 directly — no file-system read needed
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      setBase64(result.assets[0].base64 ?? null);
    }
  }

  function submit() {
    if (!photoBase64 || submitted || uploading) return;
    setUploading(true);
    setSubmitted(true);
    sendAction("submit_photo", { photo: `data:image/jpeg;base64,${photoBase64}` });
  }

  // Submitted screen
  if (submitted) {
    const d = state.guestViewData as any;
    return (
      <WaitingForPlayersView
        emoji="📸"
        accent={ACCENT}
        title="Snap Submitted!"
        subtitle="Waiting for everyone else to find theirs..."
        submittedCount={d?.submittedCount}
        tips={[
          "Your photo is already a work of art 🎨",
          "Someone is sprinting around the room right now 🏃",
          "The challenge is harder than it looks 👀",
          "Points for creativity too, right? 😅",
          "Speed isn't everything — composition is 📐",
        ]}
      />
    );
  }

  return (
    <View style={styles.root}>
      {/* Timer bar */}
      <View style={styles.timerTrack}>
        <View
          style={[
            styles.timerFill,
            { width: `${timerPct * 100}%`, backgroundColor: timerColor },
          ]}
        />
      </View>

      {/* Timer text */}
      <View style={styles.timerRow}>
        <Text style={styles.eyebrow}>SCAVENGER SNAP</Text>
        <Text style={[styles.timerNum, isUrgent && styles.timerNumUrgent]}>
          {timeLeft}s
        </Text>
      </View>

      {/* Challenge text — big and centered */}
      <View style={styles.challengeArea}>
        <Text style={styles.challengeInstruction}>YOUR CHALLENGE</Text>
        <Text style={styles.challengeText}>{challenge}</Text>
      </View>

      {/* Photo area or camera button */}
      {photoUri ? (
        <View style={styles.previewArea}>
          <Image source={{ uri: photoUri }} style={styles.thumbnail} />
          <View style={styles.previewActions}>
            <TouchableOpacity style={styles.retakeBtn} onPress={takePhoto}>
              <Text style={styles.retakeBtnText}>📷  Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, (!photoBase64 || uploading) && styles.submitBtnDisabled]}
              onPress={submit}
              disabled={!photoBase64 || uploading}
            >
              <Text style={styles.submitBtnText}>{uploading ? "Sending..." : "SUBMIT SNAP"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : permDenied ? (
        <View style={styles.cameraArea}>
          <View style={styles.permDeniedCard}>
            <Text style={styles.permDeniedIcon}>🚫</Text>
            <Text style={styles.permDeniedTitle}>Camera Access Denied</Text>
            <Text style={styles.permDeniedBody}>
              PartyGlue needs your camera to snap the challenge.
            </Text>
            <TouchableOpacity style={styles.permSettingsBtn} onPress={() => Linking.openSettings()}>
              <Text style={styles.permSettingsBtnText}>Open Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.permRetryBtn} onPress={takePhoto}>
              <Text style={styles.permRetryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.cameraArea}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity style={styles.cameraBtn} onPress={takePhoto}>
              <Text style={styles.cameraIcon}>📸</Text>
              <Text style={styles.cameraBtnText}>SNAP IT</Text>
            </TouchableOpacity>
          </Animated.View>
          <Text style={styles.cameraHint}>Tap to open your camera</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:              { flex: 1, backgroundColor: "#08081a" },

  // Timer
  timerTrack:        { height: 5, backgroundColor: "#1e1e3a", overflow: "hidden" },
  timerFill:         { height: "100%", borderRadius: 2 },
  timerRow:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  eyebrow:           { color: ACCENT, fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  timerNum:          { color: "#fff", fontSize: 28, fontWeight: "900" },
  timerNumUrgent:    { color: "#ef4444" },

  // Challenge
  challengeArea:     { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, gap: 16 },
  challengeInstruction: { color: "#888", fontSize: 12, fontWeight: "700", letterSpacing: 3 },
  challengeText: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "900",
    textAlign: "center",
    lineHeight: 40,
    textShadowColor: ACCENT + "66",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },

  // Camera button
  cameraArea:        { paddingBottom: 48, alignItems: "center", gap: 14 },
  cameraBtn: {
    backgroundColor: ACCENT,
    borderRadius: 60,
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 10,
  },
  cameraIcon:        { fontSize: 48 },
  cameraBtnText:     { color: "#fff", fontWeight: "900", fontSize: 16, letterSpacing: 1 },
  cameraHint:        { color: "#555", fontSize: 13 },

  // Permission denied
  permDeniedCard:    { margin: 24, backgroundColor: "#1a0808", borderRadius: 20, borderWidth: 2, borderColor: "#ef444455", padding: 24, alignItems: "center", gap: 12 },
  permDeniedIcon:    { fontSize: 52 },
  permDeniedTitle:   { color: "#ef4444", fontSize: 20, fontWeight: "900", textAlign: "center" },
  permDeniedBody:    { color: "#888", fontSize: 14, textAlign: "center", lineHeight: 20 },
  permSettingsBtn:   { backgroundColor: ACCENT, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, marginTop: 4 },
  permSettingsBtnText: { color: "#fff", fontWeight: "900", fontSize: 15 },
  permRetryBtn:      { paddingVertical: 10 },
  permRetryBtnText:  { color: "#555", fontSize: 13, fontWeight: "700" },

  // Preview
  previewArea:       { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  thumbnail:         { width: "100%", height: 280, borderRadius: 20, backgroundColor: "#12122a" },
  previewActions:    { flexDirection: "row", gap: 10 },
  retakeBtn:         { flex: 1, paddingVertical: 16, backgroundColor: "#12122a", borderRadius: 14, alignItems: "center", borderWidth: 1, borderColor: "#1e1e3a" },
  retakeBtnText:     { color: "#888", fontWeight: "700", fontSize: 15 },
  submitBtn:         { flex: 2, paddingVertical: 16, backgroundColor: ACCENT, borderRadius: 14, alignItems: "center" },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText:     { color: "#fff", fontWeight: "900", fontSize: 15, letterSpacing: 1 },

  // Submitted
  submittedScreen:   { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 32 },
  submittedThumb:    { width: 200, height: 200, borderRadius: 20, borderWidth: 3, borderColor: ACCENT },
  submittedTitle:    { color: "#fff", fontSize: 26, fontWeight: "900" },
  submittedSub:      { color: "#888", fontSize: 14, textAlign: "center" },
});
