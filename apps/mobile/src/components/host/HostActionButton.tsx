import React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";

interface Props {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
}

export function HostActionButton({ label, onPress, variant = "primary", disabled }: Props) {
  return (
    <TouchableOpacity
      style={[styles.btn, styles[variant], disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.text}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn:       { paddingVertical: 16, paddingHorizontal: 20, borderRadius: 12, alignItems: "center" },
  primary:   { backgroundColor: "#6c47ff" },
  secondary: { backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "#444" },
  danger:    { backgroundColor: "#ef4444" },
  disabled:  { opacity: 0.35 },
  text:      { color: "#fff", fontSize: 15, fontWeight: "700" },
});
