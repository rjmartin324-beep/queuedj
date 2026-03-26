import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

interface Props {
  isOffline:           boolean;
  memberCount:         number;
  spotifyTokenExpired?: boolean;
  onReconnectSpotify?: () => void;
}

export function ConnectionBar({ isOffline, memberCount, spotifyTokenExpired, onReconnectSpotify }: Props) {
  const [showBackOnline, setShowBackOnline] = useState(false);
  const [wasOffline, setWasOffline]         = useState(false);

  // Flash "Back online" for 2s when reconnecting
  useEffect(() => {
    if (wasOffline && !isOffline) {
      setShowBackOnline(true);
      const t = setTimeout(() => setShowBackOnline(false), 2000);
      return () => clearTimeout(t);
    }
    setWasOffline(isOffline);
  }, [isOffline]);

  if (spotifyTokenExpired) {
    return (
      <TouchableOpacity style={[styles.bar, styles.spotifyBar]} onPress={onReconnectSpotify}>
        <Text style={styles.spotifyText}>⚠ Spotify session expired — tap to reconnect</Text>
      </TouchableOpacity>
    );
  }

  if (isOffline) {
    return (
      <View style={[styles.bar, styles.offlineBar]}>
        <Text style={styles.offline}>⚠ Offline — reconnecting…</Text>
      </View>
    );
  }

  if (showBackOnline) {
    return (
      <View style={[styles.bar, styles.onlineFlash]}>
        <Text style={styles.backOnline}>✓ Back online</Text>
      </View>
    );
  }

  return (
    <View style={styles.bar}>
      <Text style={styles.online}>● {memberCount} connected</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar:         { paddingHorizontal: 16, paddingVertical: 6, flexDirection: "row", alignItems: "center" },
  offlineBar:  { backgroundColor: "#2a1a00" },
  onlineFlash: { backgroundColor: "#0a2e14" },
  spotifyBar:  { backgroundColor: "#1a1200" },
  online:      { color: "#44ff88", fontSize: 11, fontWeight: "600" },
  offline:     { color: "#ffaa00", fontSize: 11, fontWeight: "600" },
  backOnline:  { color: "#22c55e", fontSize: 11, fontWeight: "600" },
  spotifyText: { color: "#facc15", fontSize: 11, fontWeight: "600" },
});
