import React from "react";
import { View, Text, StyleSheet } from "react-native";

export function ConnectionBar({ isOffline, memberCount }: { isOffline: boolean; memberCount: number }) {
  if (!isOffline) {
    return (
      <View style={styles.bar}>
        <Text style={styles.online}>● {memberCount} connected</Text>
      </View>
    );
  }
  return (
    <View style={[styles.bar, styles.offlineBar]}>
      <Text style={styles.offline}>⚠ Offline — reconnecting...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar:        { paddingHorizontal: 16, paddingVertical: 6, flexDirection: "row", alignItems: "center" },
  offlineBar: { backgroundColor: "#2a1a00" },
  online:     { color: "#44ff88", fontSize: 11, fontWeight: "600" },
  offline:    { color: "#ffaa00", fontSize: 11, fontWeight: "600" },
});
