import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export type Tab = "home" | "avatar" | "social" | "account";

type Theme = "festival" | "space" | "studio";

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
  onStartRoom: () => void;
  theme?: Theme;
}

// ─── Theme tokens ─────────────────────────────────────────────────────────────

function themeTokens(theme?: Theme) {
  if (theme === "studio") {
    return {
      activeColor:   "#1DB954",
      inactiveColor: "#4a5568",
      glowColor:     "rgba(29,185,84,0.45)",
      centerColors:  ["#1DB954", "#15803d"] as [string, string],
      bgColors:      ["rgba(8,8,8,0.97)", "rgba(4,4,4,0.99)"] as [string, string],
    };
  }
  return {
    activeColor:   "#e879f9",
    inactiveColor: "#4a5568",
    glowColor:     "rgba(192,38,211,0.4)",
    centerColors:  ["#f0abfc", "#c026d3", "#7c3aed"] as unknown as [string, string],
    bgColors:      ["rgba(10,5,22,0.97)", "rgba(6,2,14,0.99)"] as [string, string],
  };
}

// ─── Icon components ──────────────────────────────────────────────────────────

function HomeIcon({ on, color }: { on: boolean; color: string }) {
  const c = on ? color : "#4a5568";
  return (
    <View style={{ width: 24, height: 22, alignItems: "center", justifyContent: "flex-end" }}>
      <View style={{ width: 0, height: 0, borderLeftWidth: 13, borderRightWidth: 13, borderBottomWidth: 10, borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomColor: c }} />
      <View style={{ width: 18, height: 10, borderWidth: 1.5, borderColor: c, borderTopWidth: 0, alignItems: "center", justifyContent: "flex-end" }}>
        <View style={{ width: 5, height: 6, borderTopLeftRadius: 2, borderTopRightRadius: 2, borderWidth: 1.5, borderColor: c, borderBottomWidth: 0 }} />
      </View>
    </View>
  );
}

function AvatarIcon({ on, color }: { on: boolean; color: string }) {
  const c = on ? color : "#4a5568";
  return (
    <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: c, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c, marginTop: 2 }} />
      <View style={{ width: 16, height: 7, borderRadius: 8, backgroundColor: c, marginTop: 1, opacity: 0.75 }} />
    </View>
  );
}

function SocialIcon({ on, color }: { on: boolean; color: string }) {
  const c = on ? color : "#4a5568";
  return (
    <View style={{ width: 24, height: 22, position: "relative", alignItems: "center" }}>
      <View style={{ width: 22, height: 17, borderRadius: 8, borderWidth: 1.5, borderColor: c }} />
      <View style={{ position: "absolute", bottom: 0, left: 6, width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 2, borderTopWidth: 6, borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: c }} />
      <View style={{ position: "absolute", top: 5, flexDirection: "row", gap: 3 }}>
        {[0, 1, 2].map(i => <View key={i} style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: c }} />)}
      </View>
    </View>
  );
}

function AccountIcon({ on, color }: { on: boolean; color: string }) {
  const c = on ? color : "#4a5568";
  return (
    <View style={{ width: 24, height: 22, alignItems: "center", justifyContent: "flex-end", gap: 2 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: c }} />
      <View style={{ width: 20, height: 8, borderTopLeftRadius: 10, borderTopRightRadius: 10, borderWidth: 1.5, borderColor: c, borderBottomWidth: 0 }} />
    </View>
  );
}

// ─── Tab item ─────────────────────────────────────────────────────────────────

function TabItem({ id, label, active, activeColor, onChange, children }: {
  id: Tab; label: string; active: Tab; activeColor: string;
  onChange: (t: Tab) => void; children: React.ReactNode;
}) {
  const on = active === id;
  return (
    <TouchableOpacity style={styles.tab} onPress={() => onChange(id)} activeOpacity={0.7}>
      {children}
      <Text style={[styles.tabLabel, on && { color: activeColor }]}>{label}</Text>
      {on && <View style={[styles.activeDot, { backgroundColor: activeColor }]} />}
    </TouchableOpacity>
  );
}

// ─── Main bar ─────────────────────────────────────────────────────────────────

export function BottomTabBar({ active, onChange, onStartRoom, theme }: Props) {
  const tk = themeTokens(theme);

  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={tk.bgColors as any}
        style={StyleSheet.absoluteFill}
      />
      {/* Top border glow */}
      <View style={[styles.topGlow, { backgroundColor: tk.glowColor }]} />

      <View style={styles.bar}>
        <TabItem id="home" label="Home" active={active} activeColor={tk.activeColor} onChange={onChange}>
          <HomeIcon on={active === "home"} color={tk.activeColor} />
        </TabItem>
        <TabItem id="avatar" label="Avatar" active={active} activeColor={tk.activeColor} onChange={onChange}>
          <AvatarIcon on={active === "avatar"} color={tk.activeColor} />
        </TabItem>

        {/* Center button — floats above bar */}
        <View style={styles.centerSlot}>
          <TouchableOpacity onPress={onStartRoom} activeOpacity={0.85} style={styles.centerTouch}>
            <LinearGradient
              colors={tk.centerColors as any}
              start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
              style={styles.centerBtn}
            >
              <Text style={styles.centerPlus}>+</Text>
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.centerLabel}>Start Room</Text>
        </View>

        <TabItem id="social" label="Social" active={active} activeColor={tk.activeColor} onChange={onChange}>
          <SocialIcon on={active === "social"} color={tk.activeColor} />
        </TabItem>
        <TabItem id="account" label="Account" active={active} activeColor={tk.activeColor} onChange={onChange}>
          <AccountIcon on={active === "account"} color={tk.activeColor} />
        </TabItem>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: "visible",
    borderTopWidth: 0,
    paddingBottom: Platform.OS === "ios" ? 24 : 0,
  },
  topGlow: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: 1,
  },

  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 0 : 10,
    minHeight: 72,
    overflow: "visible",
  },

  tab: {
    flex: 1, alignItems: "center",
    gap: 4, paddingTop: 4, paddingBottom: 2,
  },
  tabLabel:   { color: "#6b7fa0", fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
  activeDot:  { width: 4, height: 4, borderRadius: 2, marginTop: 1 },

  // Center button
  centerSlot: {
    flex: 1.3,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingTop: 2,
    overflow: "visible",
  },
  centerTouch: {
    borderRadius: 30,
    overflow: "visible",
    ...Platform.select({
      ios: {
        shadowColor: "#c026d3",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 20,
      },
    }),
  },
  centerBtn: {
    width: 60, height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.25)",
  },
  centerPlus:  { color: "#fff", fontSize: 32, fontWeight: "200", lineHeight: 36, marginTop: -2 },
  centerLabel: { color: "#9ca3af", fontSize: 10, fontWeight: "700", letterSpacing: 0.4 },
});
