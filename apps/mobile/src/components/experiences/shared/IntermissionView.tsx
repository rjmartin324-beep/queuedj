import React from "react";
import { View, Text, StyleSheet } from "react-native";

export function IntermissionView() {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>⏳</Text>
      <Text style={styles.text}>Host is setting up the next experience</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0a0a0a" },
  emoji:     { fontSize: 48, marginBottom: 16 },
  text:      { color: "#555", fontSize: 16, textAlign: "center", paddingHorizontal: 32 },
});
