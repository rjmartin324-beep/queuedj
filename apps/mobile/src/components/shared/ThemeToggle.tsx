import React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { selectionTick } from "../../lib/haptics";

interface Props {
  size?: number;
}

export function ThemeToggle({ size = 38 }: Props) {
  const { pref, theme, setTheme } = useTheme();

  function toggle() {
    selectionTick();
    setTheme(pref === "dark" ? "light" : "dark");
  }

  return (
    <TouchableOpacity
      onPress={toggle}
      style={[
        styles.btn,
        {
          width:           size,
          height:          size,
          borderRadius:    size / 2,
          backgroundColor: theme.surface,
          borderColor:     theme.border,
        },
      ]}
      accessibilityLabel={pref === "dark" ? "Switch to light theme" : "Switch to dark theme"}
    >
      <Text style={{ fontSize: size * 0.45 }}>
        {pref === "dark" ? "☀️" : "🌙"}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
