import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme } from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// Theme Context
//
// Supports: "dark" | "light" | "system"
// Default: "dark" (QueueDJ is always dark by default)
// ─────────────────────────────────────────────────────────────────────────────

const THEME_KEY    = "queuedj_theme_pref";
const BG_THEME_KEY = "partyglue_bg_theme";

export type ThemePref = "dark" | "light" | "system";
export type BgTheme   = "festival" | "space" | "studio";

export interface ThemeTokens {
  bg:           string;
  surface:      string;
  surfaceHigh:  string;
  border:       string;
  text:         string;
  textSub:      string;
  accent:       string;
  accentText:   string;
  isDark:       boolean;
}

const DARK: ThemeTokens = {
  bg:          "#0a0a0a",
  surface:     "rgba(255,255,255,0.05)",
  surfaceHigh: "rgba(255,255,255,0.10)",
  border:      "rgba(255,255,255,0.08)",
  text:        "#ffffff",
  textSub:     "#9ca3af",
  accent:      "#7c3aed",
  accentText:  "#a78bfa",
  isDark:      true,
};

const LIGHT: ThemeTokens = {
  bg:          "#f5f3ff",
  surface:     "rgba(0,0,0,0.04)",
  surfaceHigh: "rgba(0,0,0,0.08)",
  border:      "rgba(0,0,0,0.08)",
  text:        "#0f0f0f",
  textSub:     "#6b7280",
  accent:      "#7c3aed",
  accentText:  "#5b21b6",
  isDark:      false,
};

interface ThemeContextValue {
  pref:       ThemePref;
  theme:      ThemeTokens;
  setTheme:   (pref: ThemePref) => void;
  bgTheme:    BgTheme;
  setBgTheme: (bg: BgTheme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  pref:       "dark",
  theme:      DARK,
  setTheme:   () => {},
  bgTheme:    "festival",
  setBgTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [pref,    setPref]    = useState<ThemePref>("dark");
  const [bgTheme, setBgThemeState] = useState<BgTheme>("festival");

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((saved) => {
      if (saved === "dark" || saved === "light" || saved === "system") setPref(saved);
    });
    AsyncStorage.getItem(BG_THEME_KEY).then((saved) => {
      if (saved === "festival" || saved === "space" || saved === "studio") setBgThemeState(saved);
    });
  }, []);

  async function setTheme(newPref: ThemePref) {
    setPref(newPref);
    await AsyncStorage.setItem(THEME_KEY, newPref);
  }

  async function setBgTheme(bg: BgTheme) {
    setBgThemeState(bg);
    await AsyncStorage.setItem(BG_THEME_KEY, bg);
  }

  const resolved: ThemePref =
    pref === "system" ? (systemScheme === "light" ? "light" : "dark") : pref;
  const theme = resolved === "light" ? LIGHT : DARK;

  return (
    <ThemeContext.Provider value={{ pref, theme, setTheme, bgTheme, setBgTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
