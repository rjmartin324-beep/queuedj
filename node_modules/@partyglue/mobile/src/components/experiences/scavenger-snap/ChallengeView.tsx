import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, Image, StyleSheet, Animated,
} from "react-native";
import { launchCameraAsync, requestCameraPermissionsAsync, MediaType } from "expo-image-picker";
import { useRoom } from "../../../contexts/RoomContext";

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

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
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
    const { status } = await requestCameraPermissionsAsync();
    if (status !== "granted") return;
    const result = await launchCameraAsync({
      quality: 0.6,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0].uri) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  function submit() {
    if (!photoUri || submitted) return;
    setSubmitted(true);
    sendAction("submit_snap", { photoUri });
  }

  // Submitted screen
  if (submitted) {
    return (
      <View style={styles.root}>
        <View style={styles.submittedScreen}>
          {photoUri && <Image source={{ uri: photoUri }} style={styles.submittedThumb} />}
          <Text style={styles.submittedTitle}>Snap Submitted!</Text>
          <Text style={styles.submittedSub}>Waiting for everyone else to snap...</Text>
        </View>
      </View>
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
            <TouchableOpacity style={styles.submitBtn} onPress={submit}>
              <Text style={styles.submitBtnText}>SUBMIT SNAP</Text>
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

  // Preview
  previewArea:       { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  thumbnail:         { width: "100%", height: 280, borderRadius: 20, backgroundColor: "#12122a" },
  previewActions:    { flexDirection: "row", gap: 10 },
  retakeBtn:         { flex: 1, paddingVertical: 16, backgroundColor: "#12122a", borderRadius: 14, alignItems: "center", borderWidth: 1, borderColor: "#1e1e3a" },
  retakeBtnText:     { color: "#888", fontWeight: "700", fontSize: 15 },
  submitBtn:         { flex: 2, paddingVertical: 16, backgroundColor: ACCENT, borderRadius: 14, alignItems: "center" },
  submitBtnText:     { color: "#fff", fontWeight: "900", fontSize: 15, letterSpacing: 1 },

  // Submitted
  submittedScreen:   { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 32 },
  submittedThumb:    { width: 200, height: 200, borderRadius: 20, borderWidth: 3, borderColor: ACCENT },
  submittedTitle:    { color: "#fff", fontSize: 26, fontWeight: "900" },
  submittedSub:      { color: "#888", fontSize: 14, textAlign: "center" },
});
