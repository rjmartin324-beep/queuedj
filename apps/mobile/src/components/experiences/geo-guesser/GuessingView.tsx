import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, Image,
} from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

// ─────────────────────────────────────────────────────────────────────────────
// Geo Guesser — GuessingView
// Shows a real-photo header, then a Leaflet.js OpenStreetMap for pin dropping.
// 30s countdown lives in React Native above the WebView.
// ─────────────────────────────────────────────────────────────────────────────

const ACCENT = "#22c55e";
const TIMER_TOTAL = 30;

// ─── Leaflet HTML ─────────────────────────────────────────────────────────────

const LEAFLET_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link
    rel="stylesheet"
    href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
  />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #0a0a1a; }
    #map { width: 100%; height: calc(100% - 60px); }
    #lock-btn {
      position: fixed;
      bottom: 0; left: 0; right: 0;
      height: 60px;
      background: #22c55e;
      color: #fff;
      font-size: 18px;
      font-weight: 900;
      border: none;
      display: none;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      letter-spacing: 1px;
    }
    #lock-btn.visible { display: flex; }
    #lock-btn:active { background: #16a34a; }
  </style>
</head>
<body>
  <div id="map"></div>
  <button id="lock-btn" onclick="lockIn()">PIN DROP — LOCK IN</button>
  <script>
    var map = L.map('map', {
      center: [20, 0],
      zoom: 2,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        subdomains: 'abcd',
        maxZoom: 19
      }
    ).addTo(map);

    var marker = null;
    var pendingLat = null;
    var pendingLng = null;

    var redIcon = L.divIcon({
      className: '',
      html: '<div style="width:20px;height:20px;background:#ef4444;border:3px solid #fff;border-radius:50%;box-shadow:0 0 8px rgba(239,68,68,0.8);"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    map.on('click', function(e) {
      pendingLat = e.latlng.lat;
      pendingLng = e.latlng.lng;

      if (marker) {
        marker.setLatLng(e.latlng);
      } else {
        marker = L.marker(e.latlng, { icon: redIcon }).addTo(map);
      }

      document.getElementById('lock-btn').classList.add('visible');
    });

    function lockIn() {
      if (pendingLat === null || pendingLng === null) return;
      var msg = JSON.stringify({ lat: pendingLat, lng: pendingLng });
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(msg);
      }
    }
  </script>
</body>
</html>
`;

// ─────────────────────────────────────────────────────────────────────────────

export function GuessingView() {
  const { state, sendAction } = useRoom();
  const data = state.guestViewData as any;

  const clue: string       = data?.hint ?? data?.clue ?? "Where in the world is this place?";
  const imageUrl: string | undefined = data?.imageUrl;

  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft]   = useState(TIMER_TOTAL);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    const iv = setInterval(() => {
      const elapsed  = (Date.now() - startedAt.current) / 1000;
      const remaining = Math.max(0, TIMER_TOTAL - Math.floor(elapsed));
      setTimeLeft(remaining);
      if (remaining <= 0) clearInterval(iv);
    }, 500);
    return () => clearInterval(iv);
  }, []);

  const timerPct   = timeLeft / TIMER_TOTAL;
  const timerColor =
    timerPct > 0.5 ? ACCENT : timerPct > 0.2 ? "#f59e0b" : "#ef4444";
  const isUrgent   = timeLeft <= 8;

  function handleMessage(event: WebViewMessageEvent) {
    if (submitted) return;
    try {
      const { lat, lng } = JSON.parse(event.nativeEvent.data);
      setSubmitted(true);
      sendAction("submit_guess", { lat, lng });
    } catch (_) {
      // ignore malformed messages
    }
  }

  if (submitted) {
    return (
      <View style={styles.root}>
        <View style={styles.submittedScreen}>
          <Text style={styles.submittedEmoji}>📍</Text>
          <Text style={styles.submittedTitle}>Guess Locked!</Text>
          <Text style={styles.submittedSub}>Waiting for the reveal...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Timer bar */}
      <View style={styles.timerTrack}>
        <View style={[styles.timerFill, { width: `${timerPct * 100}%`, backgroundColor: timerColor }]} />
      </View>

      {/* Header row */}
      <View style={styles.headerRow}>
        <Text style={styles.eyebrow}>GEO GUESSER</Text>
        <Text style={[styles.timerText, isUrgent && styles.timerTextUrgent]}>
          {timeLeft}s
        </Text>
      </View>

      {/* Location image + clue overlay */}
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.locationImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.locationImage, styles.imagePlaceholder]} />
        )}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.82)"]}
          style={styles.imageGradient}
        />
        {/* Mystery badge */}
        <View style={styles.mysteryBadge}>
          <Text style={styles.mysteryText}>MYSTERY LOCATION</Text>
        </View>
        {/* Clue */}
        <View style={styles.clueOverlay}>
          <Text style={styles.clueLabel}>LOCATION CLUE</Text>
          <Text style={styles.clueText}>{clue}</Text>
        </View>
      </View>

      {/* Instruction label */}
      <View style={styles.instructionRow}>
        <Text style={styles.instruction}>Tap the map to drop your pin, then lock in.</Text>
      </View>

      {/* Leaflet map WebView */}
      <WebView
        style={styles.map}
        originWhitelist={["*"]}
        source={{ html: LEAFLET_HTML }}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#08081a" },

  // Timer
  timerTrack: { height: 5, backgroundColor: "#1e1e3a" },
  timerFill:  { height: "100%", borderRadius: 2 },

  // Header
  headerRow:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8 },
  eyebrow:          { color: ACCENT, fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  timerText:        { color: "#fff", fontSize: 26, fontWeight: "900" },
  timerTextUrgent:  { color: "#ef4444" },

  // Image
  imageContainer:   { height: 160, position: "relative" },
  locationImage:    { width: "100%", height: 160 },
  imagePlaceholder: { backgroundColor: "#0f2027" },
  imageGradient:    { position: "absolute", bottom: 0, left: 0, right: 0, height: 100 },
  mysteryBadge: {
    position: "absolute",
    top: 10, left: 12,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.4)",
  },
  mysteryText:      { color: ACCENT, fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  clueOverlay:      { position: "absolute", bottom: 10, left: 12, right: 12, gap: 2 },
  clueLabel:        { color: "rgba(34,197,94,0.9)", fontSize: 9, fontWeight: "800", letterSpacing: 2 },
  clueText:         { color: "#fff", fontSize: 14, fontWeight: "700", lineHeight: 19 },

  // Instruction
  instructionRow:   { paddingHorizontal: 16, paddingVertical: 6, backgroundColor: "#0d0d20" },
  instruction:      { color: "#888", fontSize: 12, textAlign: "center" },

  // Map
  map: { flex: 1 },

  // Submitted
  submittedScreen:  { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  submittedEmoji:   { fontSize: 64 },
  submittedTitle:   { color: "#fff", fontSize: 28, fontWeight: "900" },
  submittedSub:     { color: "#888", fontSize: 15, textAlign: "center" },
});
