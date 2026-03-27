import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Switch, Alert, ActivityIndicator, Modal, Linking, Share,
} from "react-native";
import { useRouter } from "expo-router";
import { CreditsWalletView } from "../components/shared/CreditsWalletView";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme, type ThemePref, type BgTheme } from "../contexts/ThemeContext";
import { selectionTick, tapLight } from "../lib/haptics";

// ─────────────────────────────────────────────────────────────────────────────
// Settings Screen
// ─────────────────────────────────────────────────────────────────────────────

const GUEST_NAME_KEY   = "guest_display_name";
const NOTIF_KEY        = "queuedj_notifications_enabled";
const HAPTICS_KEY      = "queuedj_haptics_enabled";
const ANTHEM_ISRC_KEY  = "queuedj_walkin_anthem_isrc";
const ANTHEM_LABEL_KEY = "queuedj_walkin_anthem_label";
const API_URL          = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

const APP_VERSION = "1.0.0";
const STORE_URL   = "https://apps.apple.com/app/partyglue"; // update when live
const SUPPORT_EMAIL = "support@partyglue.app";

interface AnthemResult { isrc: string; title: string; artist: string; }

interface CreditEntry {
  delta:        number;
  balance_after: number;
  reason:       string;
  created_at:   string;
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function Row({
  label, value, onPress, right,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  right?: React.ReactNode;
}) {
  const inner = (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {value !== undefined && <Text style={styles.rowValue}>{value}</Text>}
      {right}
    </View>
  );
  return onPress ? (
    <TouchableOpacity onPress={onPress} activeOpacity={0.6}>{inner}</TouchableOpacity>
  ) : inner;
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ProfileStats {
  roomsHosted:    number;
  partiesJoined:  number;
  gameWins:       number;
  totalCredits:   number;
}

interface Props {
  guestId?: string | null;
  onClose?:  () => void;
}

export function SettingsScreen({ guestId, onClose }: Props) {
  const router = useRouter();
  const { pref, setTheme, bgTheme, setBgTheme } = useTheme();
  const [name, setName]             = useState("");
  const [editingName, setEditingName] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [hapticsOn, setHapticsOn]         = useState(true);
  const [credits, setCredits]             = useState<CreditEntry[]>([]);
  const [walletOpen, setWalletOpen]       = useState(false);
  const [anthemLabel, setAnthemLabel]     = useState<string | null>(null);
  const [anthemSearch, setAnthemSearch]   = useState("");
  const [anthemResults, setAnthemResults] = useState<AnthemResult[]>([]);
  const [searchingAnthem, setSearchingAnthem] = useState(false);
  const [profileStats, setProfileStats]   = useState<ProfileStats>({ roomsHosted: 0, partiesJoined: 0, gameWins: 0, totalCredits: 0 });
  const [nameSaved,    setNameSaved]      = useState(false);
  const anthemTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(GUEST_NAME_KEY).then((v) => setName(v ?? ""));
    AsyncStorage.getItem(NOTIF_KEY).then((v)   => setNotifications(v !== "0"));
    AsyncStorage.getItem(HAPTICS_KEY).then((v) => setHapticsOn(v !== "0"));
    AsyncStorage.getItem(ANTHEM_LABEL_KEY).then((v) => setAnthemLabel(v));

    // Load lifetime stats from AsyncStorage
    AsyncStorage.multiGet([
      "stat_rooms_hosted", "stat_parties_attended",
      "stat_game_wins_total", "stat_credits_total",
    ]).then((pairs) => {
      const m = Object.fromEntries(pairs.map(([k, v]) => [k, Number(v ?? 0)]));
      setProfileStats({
        roomsHosted:   m["stat_rooms_hosted"]      ?? 0,
        partiesJoined: m["stat_parties_attended"]  ?? 0,
        gameWins:      m["stat_game_wins_total"]   ?? 0,
        totalCredits:  m["stat_credits_total"]     ?? 0,
      });
    });

    if (guestId) {
      fetch(`${API_URL}/credits/${encodeURIComponent(guestId)}/history?limit=20`)
        .then((r) => r.json())
        .then((d) => setCredits(d.history ?? []))
        .catch(() => {});
    }
  }, [guestId]);

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed) return;
    // Write to both keys so the room join flow picks it up without re-prompting
    await AsyncStorage.multiSet([
      [GUEST_NAME_KEY,        trimmed],   // Account tab display
      ["queuedj:displayName", trimmed],   // socketManager / room join key
    ]);
    tapLight();
    setEditingName(false);
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2500);
  }

  function toggleNotifications(val: boolean) {
    selectionTick();
    setNotifications(val);
    AsyncStorage.setItem(NOTIF_KEY, val ? "1" : "0");
  }

  function toggleHaptics(val: boolean) {
    selectionTick();
    setHapticsOn(val);
    AsyncStorage.setItem(HAPTICS_KEY, val ? "1" : "0");
  }

  useEffect(() => {
    const q = anthemSearch.trim();
    if (q.length < 2) { setAnthemResults([]); return; }
    if (anthemTimer.current) clearTimeout(anthemTimer.current);
    anthemTimer.current = setTimeout(async () => {
      setSearchingAnthem(true);
      try {
        const res = await fetch(`${API_URL}/tracks/search?q=${encodeURIComponent(q)}&limit=5`);
        if (res.ok) {
          const d = await res.json();
          setAnthemResults((d.tracks ?? []).map((t: any) => ({ isrc: t.isrc, title: t.title, artist: t.artist })));
        }
      } catch { /* offline */ } finally { setSearchingAnthem(false); }
    }, 350);
    return () => { if (anthemTimer.current) clearTimeout(anthemTimer.current); };
  }, [anthemSearch]);

  async function pickAnthem(track: AnthemResult) {
    tapLight();
    const label = `${track.title} — ${track.artist}`;
    await AsyncStorage.setItem(ANTHEM_ISRC_KEY, track.isrc);
    await AsyncStorage.setItem(ANTHEM_LABEL_KEY, label);
    setAnthemLabel(label);
    setAnthemSearch("");
    setAnthemResults([]);
  }

  async function clearAnthem() {
    await AsyncStorage.removeItem(ANTHEM_ISRC_KEY);
    await AsyncStorage.removeItem(ANTHEM_LABEL_KEY);
    setAnthemLabel(null);
  }

  function handleShareApp() {
    Share.share({
      message: "I'm using PartyGlue to run my parties 🎉 Download it and join my next room!",
    });
  }

  function handleRateApp() {
    Linking.openURL(STORE_URL).catch(() => {});
  }

  function handleContactSupport() {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=PartyGlue Support`).catch(() => {});
  }

  function handlePrivacyPolicy() {
    router.push("/privacy");
  }

  function handleTerms() {
    router.push("/terms");
  }

  const THEME_OPTIONS: { label: string; value: ThemePref; emoji: string }[] = [
    { label: "Dark",   value: "dark",   emoji: "🌙" },
    { label: "Light",  value: "light",  emoji: "☀️" },
    { label: "System", value: "system", emoji: "📱" },
  ];

  const BG_OPTIONS: { label: string; value: BgTheme; emoji: string; accent: string }[] = [
    { label: "Lava Lamp", value: "festival", emoji: "🫧", accent: "#a78bfa" },
    { label: "Space",     value: "space",    emoji: "🌌", accent: "#818cf8" },
    { label: "Studio",    value: "studio",   emoji: "🎵", accent: "#1DB954" },
  ];

  const REASON_LABELS: Record<string, string> = {
    vote_cast:     "Voted",
    track_request: "Requested track",
    game_win:      "Won a game",
    full_session:  "Completed session",
    wardrobe_unlock: "Wardrobe purchase",
    emote_purchase:  "Emote purchase",
    admin_grant:     "Admin grant",
    refund:          "Refund",
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {onClose && (
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.screenTitle}>Account</Text>

      {/* Profile stats header */}
      <View style={styles.statsHeader}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{profileStats.roomsHosted}</Text>
          <Text style={styles.statLabel}>Rooms Hosted</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{profileStats.partiesJoined}</Text>
          <Text style={styles.statLabel}>Parties Joined</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{profileStats.gameWins}</Text>
          <Text style={styles.statLabel}>Games Won</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>⚡{profileStats.totalCredits}</Text>
          <Text style={styles.statLabel}>Credits</Text>
        </View>
      </View>

      {/* Profile */}
      <Section title="PROFILE">
        {editingName ? (
          <View style={styles.nameEditRow}>
            <TextInput
              style={styles.nameInput}
              value={name}
              onChangeText={setName}
              autoFocus
              maxLength={24}
              returnKeyType="done"
              onSubmitEditing={saveName}
              placeholderTextColor="#555"
              placeholder="Your name"
            />
            <TouchableOpacity style={styles.saveBtn} onPress={saveName}>
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Row
            label="Display name"
            value={nameSaved ? "✓ Saved!" : (name || "—")}
            onPress={() => setEditingName(true)}
          />
        )}
      </Section>

      {/* Background */}
      <Section title="BACKGROUND">
        <View style={styles.themeRow}>
          {BG_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.themeChip, bgTheme === opt.value && { backgroundColor: opt.accent + "22", borderColor: opt.accent }]}
              onPress={() => { selectionTick(); setBgTheme(opt.value); }}
            >
              <Text style={styles.themeChipEmoji}>{opt.emoji}</Text>
              <Text style={[styles.themeChipLabel, bgTheme === opt.value && { color: opt.accent }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Section>

      {/* Preferences */}
      <Section title="PREFERENCES">
        <Row
          label="Notifications"
          right={
            <Switch
              value={notifications}
              onValueChange={toggleNotifications}
              trackColor={{ false: "#333", true: "#7c3aed" }}
              thumbColor="#fff"
            />
          }
        />
        <Row
          label="Haptic feedback"
          right={
            <Switch
              value={hapticsOn}
              onValueChange={toggleHaptics}
              trackColor={{ false: "#333", true: "#7c3aed" }}
              thumbColor="#fff"
            />
          }
        />
      </Section>

      {/* Walk-in Anthem */}
      <Section title="WALK-IN ANTHEM">
        {anthemLabel ? (
          <View style={styles.anthemSet}>
            <Text style={styles.anthemLabel} numberOfLines={2}>🎵 {anthemLabel}</Text>
            <TouchableOpacity onPress={clearAnthem} style={styles.anthemClear}>
              <Text style={styles.anthemClearText}>Remove</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.anthemSearch}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <TextInput
                style={[styles.nameInput, { flex: 1 }]}
                value={anthemSearch}
                onChangeText={setAnthemSearch}
                placeholder="Search for your anthem…"
                placeholderTextColor="#555"
              />
              {searchingAnthem && <ActivityIndicator size="small" color="#7c3aed" />}
            </View>
            {anthemResults.map(r => (
              <TouchableOpacity key={r.isrc} style={styles.anthemResult} onPress={() => pickAnthem(r)}>
                <Text style={styles.anthemResultTitle} numberOfLines={1}>{r.title}</Text>
                <Text style={styles.anthemResultArtist} numberOfLines={1}>{r.artist}</Text>
              </TouchableOpacity>
            ))}
            {!anthemSearch && (
              <Text style={styles.anthemHint}>Plays for the room when you join 🎉</Text>
            )}
          </View>
        )}
      </Section>

      {/* Credits wallet */}
      {guestId && (
        <Modal visible={walletOpen} animationType="slide" onRequestClose={() => setWalletOpen(false)}>
          <View style={{ flex: 1, backgroundColor: "#03001c" }}>
            <View style={{ flexDirection: "row", alignItems: "center", padding: 16, paddingTop: 52 }}>
              <TouchableOpacity onPress={() => setWalletOpen(false)}>
                <Text style={{ color: "#a78bfa", fontSize: 15, fontWeight: "700" }}>← Back</Text>
              </TouchableOpacity>
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 18, marginLeft: 16 }}>Vibe Wallet</Text>
            </View>
            <CreditsWalletView guestId={guestId} />
          </View>
        </Modal>
      )}

      {/* Credits history */}
      {credits.length > 0 && (
        <Section title="VIBE CREDITS HISTORY">
          {credits.map((entry, i) => (
            <View key={i} style={styles.creditRow}>
              <Text style={[styles.creditDelta, entry.delta > 0 ? styles.creditPos : styles.creditNeg]}>
                {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.creditReason}>{REASON_LABELS[entry.reason] ?? entry.reason}</Text>
                <Text style={styles.creditDate}>
                  {new Date(entry.created_at).toLocaleDateString()} · Balance: {entry.balance_after}
                </Text>
              </View>
            </View>
          ))}
          <TouchableOpacity style={styles.walletBtn} onPress={() => setWalletOpen(true)}>
            <Text style={styles.walletBtnText}>View Full Wallet →</Text>
          </TouchableOpacity>
        </Section>
      )}

      {/* Danger zone */}
      <Section title="DATA">
        <Row
          label="Clear all local data"
          onPress={() => {
            Alert.alert(
              "Clear data?",
              "This will reset your name, theme preferences, and onboarding state.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Clear",
                  style: "destructive",
                  onPress: async () => {
                    await AsyncStorage.clear();
                    Alert.alert("Cleared", "Restart the app to re-onboard.");
                  },
                },
              ],
            );
          }}
        />
      </Section>

      {/* About */}
      <Section title="ABOUT">
        <Row label="Version" value={`v${APP_VERSION}`} />
        <Row label="Rate PartyGlue ⭐" onPress={handleRateApp} />
        <Row label="Share with friends" onPress={handleShareApp} />
        <Row label="Contact support" onPress={handleContactSupport} />
      </Section>

      {/* Legal */}
      <Section title="LEGAL">
        <Row label="Privacy Policy" onPress={handlePrivacyPolicy} />
        <Row label="Terms of Service" onPress={handleTerms} />
        <Row label="Licenses" value="Open source" />
      </Section>

      <Text style={styles.version}>PartyGlue · v{APP_VERSION} · Made with ❤️</Text>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#03001c" },
  content:   { padding: 20, paddingBottom: 60 },

  closeBtn:     { alignSelf: "flex-end", padding: 8, marginBottom: 4 },
  closeBtnText: { color: "#9ca3af", fontSize: 20 },

  screenTitle: { color: "#fff", fontSize: 28, fontWeight: "900", marginBottom: 16 },

  statsHeader: {
    flexDirection: "row", backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    paddingVertical: 16, marginBottom: 24,
  },
  statItem:    { flex: 1, alignItems: "center", gap: 4 },
  statValue:   { color: "#fff", fontSize: 18, fontWeight: "900" },
  statLabel:   { color: "#6b7280", fontSize: 10, fontWeight: "700", letterSpacing: 0.5, textAlign: "center" },
  statDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.06)" },

  section:      { marginBottom: 24 },
  sectionTitle: { color: "#6b7280", fontSize: 10, fontWeight: "800", letterSpacing: 2, marginBottom: 10 },
  sectionCard:  {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },

  row:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)" },
  rowLabel:  { flex: 1, color: "#e5e7eb", fontSize: 15 },
  rowValue:  { color: "#6b7280", fontSize: 15 },

  nameEditRow: { flexDirection: "row", padding: 12, gap: 10, alignItems: "center" },
  nameInput:   { flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 10, padding: 12, color: "#fff", fontSize: 15 },
  saveBtn:     { backgroundColor: "#7c3aed", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 },
  saveBtnText: { color: "#fff", fontWeight: "700" },

  themeRow:  { flexDirection: "row", padding: 12, gap: 8 },
  themeChip: {
    flex: 1,
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  themeChipActive:      { backgroundColor: "rgba(124,58,237,0.2)", borderColor: "#7c3aed" },
  themeChipEmoji:       { fontSize: 20, marginBottom: 4 },
  themeChipLabel:       { color: "#6b7280", fontSize: 11, fontWeight: "700" },
  themeChipLabelActive: { color: "#a78bfa" },

  creditRow:   { flexDirection: "row", gap: 12, alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)" },
  creditDelta: { fontWeight: "900", fontSize: 16, width: 36, textAlign: "right" },
  creditPos:   { color: "#22c55e" },
  creditNeg:   { color: "#ef4444" },
  creditReason: { color: "#e5e7eb", fontSize: 13, fontWeight: "600" },
  creditDate:   { color: "#6b7280", fontSize: 11, marginTop: 2 },

  walletBtn:     { marginTop: 12, padding: 12, alignItems: "center", borderRadius: 12, backgroundColor: "rgba(124,58,237,0.15)", borderWidth: 1, borderColor: "rgba(124,58,237,0.3)" },
  walletBtnText: { color: "#a78bfa", fontWeight: "700", fontSize: 13 },

  version: { color: "#374151", fontSize: 12, textAlign: "center", marginTop: 8 },

  anthemSet:         { padding: 16, gap: 10 },
  anthemLabel:       { color: "#a78bfa", fontSize: 14, fontWeight: "700", flex: 1 },
  anthemClear:       { alignSelf: "flex-start", backgroundColor: "rgba(239,68,68,0.15)", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  anthemClearText:   { color: "#ef4444", fontWeight: "700", fontSize: 13 },
  anthemSearch:      { padding: 12, gap: 8 },
  anthemResult:      { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 10, padding: 12 },
  anthemResultTitle: { color: "#fff", fontWeight: "700", fontSize: 14 },
  anthemResultArtist:{ color: "#9ca3af", fontSize: 12, marginTop: 2 },
  anthemHint:        { color: "#4b5563", fontSize: 12, textAlign: "center", paddingVertical: 4 },
});
