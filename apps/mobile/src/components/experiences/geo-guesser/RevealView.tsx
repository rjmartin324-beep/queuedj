import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { useRoom } from "../../../contexts/RoomContext";

// ─────────────────────────────────────────────────────────────────────────────
// Geo Guesser — RevealView
// Shows actual location name + coordinates, distance from player's guess
// (Haversine), and a mini Leaflet map with green (correct) + red (guess) pins.
// ─────────────────────────────────────────────────────────────────────────────

const ACCENT = "#22c55e";

// ─── Haversine distance ───────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R     = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat  = toRad(lat2 - lat1);
  const dLng  = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km).toLocaleString()} km`;
}

function distanceColor(km: number): string {
  if (km < 250)  return ACCENT;
  if (km < 1500) return "#f59e0b";
  if (km < 4000) return "#f97316";
  return "#ef4444";
}

function distanceLabel(km: number): string {
  if (km < 50)   return "Incredible! Right on it!";
  if (km < 250)  return "Very close!";
  if (km < 750)  return "Getting warm!";
  if (km < 2000) return "In the right area.";
  if (km < 4000) return "Not too far off.";
  if (km < 7000) return "Miles away!";
  return "Another planet!";
}

// ─── Mini Leaflet map for reveal ─────────────────────────────────────────────

function buildRevealMapHtml(
  correctLat: number,
  correctLng: number,
  guessLat: number | null,
  guessLng: number | null,
): string {
  const hasGuess = guessLat !== null && guessLng !== null;

  // Centre the map between the two points, or just on correct
  const midLat = hasGuess ? (correctLat + guessLat!) / 2 : correctLat;
  const midLng = hasGuess ? (correctLng + guessLng!) / 2 : correctLng;

  const guessMarkerJS = hasGuess
    ? `
    var redIcon = L.divIcon({
      className: '',
      html: '<div style="width:18px;height:18px;background:#ef4444;border:3px solid #fff;border-radius:50%;box-shadow:0 0 8px rgba(239,68,68,0.8);"></div>',
      iconSize: [18,18], iconAnchor: [9,9],
    });
    var guessMarker = L.marker([${guessLat}, ${guessLng}], { icon: redIcon })
      .addTo(map)
      .bindPopup('Your guess');
    L.polyline([[${correctLat}, ${correctLng}], [${guessLat}, ${guessLng}]], {
      color: '#ef4444', weight: 2, dashArray: '5,5', opacity: 0.8
    }).addTo(map);
    map.fitBounds([[${correctLat}, ${correctLng}], [${guessLat}, ${guessLng}]], { padding: [30, 30] });
    `
    : `map.setView([${correctLat}, ${correctLng}], 5);`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body, #map { width:100%; height:100%; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false, attributionControl: false });
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      { subdomains: 'abcd', maxZoom: 19 }
    ).addTo(map);

    var greenIcon = L.divIcon({
      className: '',
      html: '<div style="width:20px;height:20px;background:#22c55e;border:3px solid #fff;border-radius:50%;box-shadow:0 0 8px rgba(34,197,94,0.9);"></div>',
      iconSize: [20,20], iconAnchor: [10,10],
    });
    L.marker([${correctLat}, ${correctLng}], { icon: greenIcon })
      .addTo(map)
      .bindPopup('Correct location');

    ${guessMarkerJS}
  </script>
</body>
</html>
`;
}

// ─── GuessEntry type ──────────────────────────────────────────────────────────

interface GuessEntry {
  guestId: string;
  lat: number;
  lng: number;
  points: number;
  isMe: boolean;
  playerNum: number;
}

// ─────────────────────────────────────────────────────────────────────────────

export function RevealView() {
  const { state } = useRoom();
  const data = state.guestViewData as any;

  if (!data) return null;

  const location           = data.location ?? {};
  const actualName: string = location.name ?? data.actualLocation ?? "Unknown Location";
  const actualLat: number  = location.lat  ?? data.lat  ?? 0;
  const actualLng: number  = location.lng  ?? data.lng  ?? 0;
  const clue: string       = location.hint ?? data.clue ?? "";
  const guesses: GuessEntry[] = data.guesses
    ? Object.entries(data.guesses as Record<string, { lat: number; lng: number }>).map(
        ([guestId, g], i) => ({
          guestId,
          lat: g.lat,
          lng: g.lng,
          points: data.roundScores?.[guestId] ?? 0,
          isMe: guestId === state.guestId,
          playerNum: i + 1,
        })
      )
    : [];

  const myGuess  = guesses.find(g => g.isMe || g.guestId === state.guestId) ?? null;
  const myDistKm = myGuess ? haversineKm(actualLat, actualLng, myGuess.lat, myGuess.lng) : null;

  const sorted = [...guesses].sort((a, b) => b.points - a.points);

  const mapHtml = buildRevealMapHtml(
    actualLat, actualLng,
    myGuess?.lat ?? null, myGuess?.lng ?? null,
  );

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Text style={styles.eyebrow}>GEO GUESSER  ·  REVEAL</Text>

      {/* Location reveal card */}
      <View style={styles.locationCard}>
        <Text style={styles.locationRevealLabel}>THE LOCATION WAS</Text>
        <Text style={styles.locationName}>{actualName}</Text>
        <Text style={styles.locationCoords}>
          {actualLat.toFixed(3)}, {actualLng.toFixed(3)}
        </Text>
        {clue ? (
          <View style={styles.clueRow}>
            <Text style={styles.clueIcon}>CLUE</Text>
            <Text style={styles.clueText}>{clue}</Text>
          </View>
        ) : null}
      </View>

      {/* My distance card */}
      {myDistKm !== null && (
        <View style={[styles.distanceCard, { borderColor: distanceColor(myDistKm) + "88" }]}>
          <View style={styles.distanceLeft}>
            <Text style={styles.distanceLabel}>YOUR DISTANCE</Text>
            <Text style={[styles.distanceKm, { color: distanceColor(myDistKm) }]}>
              {formatKm(myDistKm)}
            </Text>
            <Text style={styles.distanceVerdict}>{distanceLabel(myDistKm)}</Text>
          </View>
          <View style={[styles.myPointsBubble, { borderColor: distanceColor(myDistKm) }]}>
            <Text style={[styles.myPointsNum, { color: distanceColor(myDistKm) }]}>
              +{myGuess?.points ?? 0}
            </Text>
            <Text style={styles.myPointsLabel}>pts</Text>
          </View>
        </View>
      )}

      {/* Mini map — correct (green) vs my guess (red) */}
      <View style={styles.mapContainer}>
        <WebView
          style={styles.miniMap}
          originWhitelist={["*"]}
          source={{ html: mapHtml }}
          javaScriptEnabled
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          pointerEvents="none"
        />
        <View style={styles.mapLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: ACCENT }]} />
            <Text style={styles.legendText}>Correct</Text>
          </View>
          {myGuess && (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#ef4444" }]} />
              <Text style={styles.legendText}>Your guess</Text>
            </View>
          )}
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerLabel}>ALL RESULTS</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Player results */}
      {sorted.map((entry, i) => {
        const isMe    = entry.isMe || entry.guestId === state.guestId;
        const distKm  = haversineKm(actualLat, actualLng, entry.lat, entry.lng);
        const color   = distanceColor(distKm);

        return (
          <View
            key={entry.guestId}
            style={[styles.guessRow, isMe && styles.guessRowMe]}
          >
            <Text style={[styles.rank, { color: i === 0 ? ACCENT : "#555" }]}>
              #{i + 1}
            </Text>
            <View style={styles.guessInfo}>
              <Text style={styles.guestName}>
                {isMe ? "You" : `Player ${entry.playerNum}`}
              </Text>
              <Text style={[styles.guessDistance, { color }]}>
                {formatKm(distKm)} away
              </Text>
            </View>
            <View style={[styles.pointsBubble, { borderColor: color }]}>
              <Text style={[styles.pointsNum, { color }]}>+{entry.points}</Text>
              <Text style={styles.pointsLabel}>pts</Text>
            </View>
          </View>
        );
      })}

      {guesses.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No guesses were submitted.</Text>
        </View>
      )}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: "#08081a" },
  container: { padding: 20, paddingTop: 24 },

  eyebrow: { color: ACCENT, fontSize: 11, fontWeight: "800", letterSpacing: 2, marginBottom: 16 },

  // Location card
  locationCard: {
    backgroundColor: "#12122a",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: ACCENT,
    padding: 18,
    marginBottom: 14,
    gap: 6,
  },
  locationRevealLabel: { color: "#888", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  locationName:        { color: "#fff", fontSize: 22, fontWeight: "900", lineHeight: 27 },
  locationCoords:      { color: "#555", fontSize: 12, fontWeight: "600" },
  clueRow:             { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: "#0f0f20", borderRadius: 10, padding: 10, marginTop: 4 },
  clueIcon:            { color: ACCENT, fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  clueText:            { color: "#888", fontSize: 13, flex: 1, lineHeight: 18 },

  // Distance card
  distanceCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#12122a",
    borderRadius: 16,
    borderWidth: 2,
    padding: 16,
    marginBottom: 14,
    gap: 12,
  },
  distanceLeft:   { flex: 1, gap: 3 },
  distanceLabel:  { color: "#888", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  distanceKm:     { fontSize: 30, fontWeight: "900" },
  distanceVerdict:{ color: "#ccc", fontSize: 13, fontWeight: "600" },

  myPointsBubble: { alignItems: "center", borderWidth: 2, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8 },
  myPointsNum:    { fontSize: 24, fontWeight: "900", lineHeight: 26 },
  myPointsLabel:  { color: "#888", fontSize: 10 },

  // Mini map
  mapContainer:   { borderRadius: 16, overflow: "hidden", height: 220, marginBottom: 16, position: "relative" },
  miniMap:        { flex: 1 },
  mapLegend: {
    position: "absolute",
    bottom: 10, right: 10,
    backgroundColor: "rgba(0,0,0,0.75)",
    borderRadius: 10,
    padding: 8,
    gap: 5,
  },
  legendItem:     { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot:      { width: 10, height: 10, borderRadius: 5 },
  legendText:     { color: "#fff", fontSize: 11, fontWeight: "600" },

  // Divider
  divider:        { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  dividerLine:    { flex: 1, height: 1, backgroundColor: "#1e1e3a" },
  dividerLabel:   { color: "#555", fontSize: 10, fontWeight: "700", letterSpacing: 2 },

  // Guess rows
  guessRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#12122a",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1e1e3a",
    padding: 14,
    marginBottom: 8,
  },
  guessRowMe:     { borderColor: "#2a3a2a", backgroundColor: "#0a1a0f" },
  rank:           { fontSize: 13, fontWeight: "800", minWidth: 28 },
  guessInfo:      { flex: 1, gap: 3 },
  guestName:      { color: "#fff", fontSize: 15, fontWeight: "700" },
  guessDistance:  { fontSize: 12, fontWeight: "600" },

  pointsBubble:   { alignItems: "center", borderWidth: 2, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  pointsNum:      { fontSize: 20, fontWeight: "900", lineHeight: 22 },
  pointsLabel:    { color: "#888", fontSize: 10 },

  emptyState:     { alignItems: "center", paddingVertical: 40 },
  emptyText:      { color: "#555", fontSize: 15 },

  bottomSpacer:   { height: 32 },
});
