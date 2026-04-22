import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../contexts/RoomContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

interface GuestStats {
  roomsHosted: number;
  partiesJoined: number;
  gameWins: number;
  totalCredits: number;
}

interface LeaderboardEntry {
  guestId: string;
  displayName?: string;
  votes: number;
  requests: number;
  game_wins: number;
  credits?: number;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? "")
    .join("");
}

function avatarColor(name: string): string {
  const COLORS = ["#7c3aed", "#0891b2", "#d97706", "#be185d", "#15803d", "#c2410c"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return COLORS[Math.abs(h) % COLORS.length];
}

interface Props {
  onClose?: () => void;
}

export function ProfileScreen({ onClose }: Props) {
  const { state } = useRoom();
  const guestId = state.guestId ?? "";

  const [displayName, setDisplayName] = useState<string>("");
  const [credits, setCredits] = useState<number | null>(null);
  const [stats, setStats] = useState<GuestStats | null>(null);
  const [recentGames, setRecentGames] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Resolve display name from context → AsyncStorage
  useEffect(() => {
    const memberName = state.members.find(m => m.guestId === guestId)?.displayName;
    if (memberName) { setDisplayName(memberName); return; }
    AsyncStorage.getItem("displayName").then(n => {
      if (n) setDisplayName(n);
      else setDisplayName(guestId.slice(0, 8));
    }).catch(() => setDisplayName(guestId.slice(0, 8)));
  }, [guestId]);

  useEffect(() => {
    if (!guestId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        // Credits
        const credRes = await fetch(`${API_URL}/credits/${encodeURIComponent(guestId)}`).catch(() => null);
        if (!cancelled && credRes?.ok) {
          const credData = await credRes.json();
          setCredits(credData.balance ?? credData.credits ?? 0);
        }

        // Stats — API returns { roomsHosted, partiesJoined, gameWins, totalCredits }
        const statsRes = await fetch(`${API_URL}/stats/${encodeURIComponent(guestId)}`).catch(() => null);
        if (!cancelled && statsRes?.ok) {
          const sd = await statsRes.json();
          setStats({
            roomsHosted:   sd.roomsHosted   ?? 0,
            partiesJoined: sd.partiesJoined ?? 0,
            gameWins:      sd.gameWins      ?? 0,
            totalCredits:  sd.totalCredits  ?? 0,
          });
        }

        // Recent game history — use current room leaderboard if in a room
        const roomId = state.room?.id;
        if (roomId) {
          const lbRes = await fetch(`${API_URL}/rooms/${encodeURIComponent(roomId)}/leaderboard`).catch(() => null);
          if (!cancelled && lbRes?.ok) {
            const lb = await lbRes.json();
            const entries: LeaderboardEntry[] = (lb.leaderboard ?? []).slice(0, 5);
            setRecentGames(entries);
          }
        }
      } catch {
        // Best-effort; offline is fine
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [guestId, state.room?.id]);

  const initials = getInitials(displayName || guestId.slice(0, 2));
  const avatarBg = avatarColor(displayName || guestId);

  return (
    <View style={s.root}>
      <LinearGradient colors={["#03001c", "#07001a", "#0a0018"]} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={s.topBar}>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Text style={s.closeText}>✕</Text>
          </TouchableOpacity>
        )}
        <Text style={s.screenTitle}>Profile</Text>
        <View style={s.spacer} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Avatar + name */}
        <View style={s.avatarSection}>
          <View style={[s.avatar, { backgroundColor: avatarBg }]}>
            <Text style={s.avatarText}>{initials || "?"}</Text>
          </View>
          <Text style={s.displayName}>{displayName || guestId.slice(0, 10)}</Text>
          <Text style={s.guestIdLabel}>{guestId.slice(0, 12)}...</Text>
        </View>

        {loading ? (
          <ActivityIndicator color="#7c3aed" size="large" style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Credits */}
            {credits !== null && (
              <View style={s.creditsCard}>
                <LinearGradient colors={["rgba(124,58,237,0.25)", "rgba(109,40,217,0.1)"]} style={StyleSheet.absoluteFill} />
                <Text style={s.creditsLabel}>VIBE CREDITS</Text>
                <Text style={s.creditsValue}>{credits}</Text>
              </View>
            )}

            {/* Stats row */}
            <View style={s.statsRow}>
              <View style={s.statBox}>
                <Text style={s.statNum}>{stats?.partiesJoined ?? 0}</Text>
                <Text style={s.statName}>Parties{"\n"}Joined</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statBox}>
                <Text style={s.statNum}>{stats?.gameWins ?? 0}</Text>
                <Text style={s.statName}>Game{"\n"}Wins</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statBox}>
                <Text style={s.statNum}>{stats?.roomsHosted ?? 0}</Text>
                <Text style={s.statName}>Rooms{"\n"}Hosted</Text>
              </View>
            </View>

            {/* Recent game history */}
            {recentGames.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>THIS SESSION</Text>
                {recentGames.map((entry, i) => (
                  <View key={entry.guestId} style={s.leaderRow}>
                    <Text style={s.leaderRank}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                    </Text>
                    <Text style={s.leaderName}>
                      {entry.guestId === guestId
                        ? "You"
                        : entry.displayName ?? entry.guestId.slice(0, 8)}
                    </Text>
                    <Text style={s.leaderStat}>🗳️ {entry.votes}</Text>
                    <Text style={s.leaderStat}>🎮 {entry.game_wins}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1 },
  topBar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12,
  },
  closeBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.07)", alignItems: "center", justifyContent: "center" },
  closeText:   { color: "#6b7fa0", fontSize: 14, fontWeight: "700" },
  screenTitle: { flex: 1, textAlign: "center", color: "#fff", fontSize: 17, fontWeight: "900", letterSpacing: 0.5 },
  spacer:      { width: 36 },

  content:     { padding: 20, paddingBottom: 60, gap: 16 },

  avatarSection: { alignItems: "center", gap: 10, paddingVertical: 8 },
  avatar:        { width: 90, height: 90, borderRadius: 45, alignItems: "center", justifyContent: "center" },
  avatarText:    { color: "#fff", fontSize: 32, fontWeight: "900" },
  displayName:   { color: "#fff", fontSize: 22, fontWeight: "900" },
  guestIdLabel:  { color: "#4b5563", fontSize: 12, fontFamily: "monospace" },

  creditsCard: {
    borderRadius: 20, overflow: "hidden", padding: 20,
    borderWidth: 1, borderColor: "rgba(124,58,237,0.4)",
    alignItems: "center", gap: 4,
  },
  creditsLabel:{ color: "#a78bfa", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  creditsValue:{ color: "#fff", fontSize: 42, fontWeight: "900" },

  statsRow:    { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", overflow: "hidden" },
  statBox:     { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 20, gap: 4 },
  statNum:     { color: "#fff", fontSize: 26, fontWeight: "900" },
  statName:    { color: "#6b7280", fontSize: 11, fontWeight: "700", textAlign: "center", lineHeight: 15 },
  statDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.07)", alignSelf: "stretch" },

  section:     { gap: 8 },
  sectionTitle:{ color: "#4b5563", fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  leaderRow:   {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  leaderRank:  { fontSize: 20, minWidth: 32 },
  leaderName:  { flex: 1, color: "#fff", fontSize: 14, fontWeight: "700" },
  leaderStat:  { color: "#6b7280", fontSize: 12, fontWeight: "600" },
});
