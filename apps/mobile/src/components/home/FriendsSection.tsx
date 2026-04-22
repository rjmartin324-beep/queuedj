import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Modal, Alert, Animated, Easing, ScrollView, Share,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AvatarSVG, type OutfitType } from "../avatar/AvatarSVG";
import { useRoom } from "../../contexts/RoomContext";
import { socketManager } from "../../lib/socket";
import { storage } from "../../lib/storage";

// ─────────────────────────────────────────────────────────────────────────────
// FriendsSection
//
// Local-first friends list stored in AsyncStorage.
// Each friend stores: guestId (their code), displayName, avatar config,
// lastSeen timestamp, totalPartiesTogether, gamesWonTogether.
//
// Add a friend by sharing/entering a 8-char friend code (their guestId prefix).
// Presence is inferred from lastSeen — not real-time yet (Phase 10: socket sync).
// ─────────────────────────────────────────────────────────────────────────────

const FRIENDS_KEY    = "partyglue_friends";
const GUEST_NAME_KEY = "guest_display_name";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Friend {
  id:                   string;   // their guestId
  displayName:          string;
  code:                 string;   // first 8 chars of guestId, uppercased
  addedAt:              number;
  lastSeenAt:           number;
  partiesTogether:      number;
  gamesWonTogether:     number;
  // Avatar snapshot — saved when they share their code
  avatarBody?:          string;
  avatarHp?:            string;
  avatarOutfit?:        OutfitType;
  avatarOutfitColor?:   string;
  avatarExpression?:    "happy" | "cool" | "party";
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

async function loadFriends(): Promise<Friend[]> {
  try {
    const raw = await AsyncStorage.getItem(FRIENDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveFriends(friends: Friend[]): Promise<void> {
  await AsyncStorage.setItem(FRIENDS_KEY, JSON.stringify(friends));
}

// ─── Status helpers ───────────────────────────────────────────────────────────

function getStatus(lastSeenAt: number): { label: string; color: string; emoji: string } {
  const diff = Date.now() - lastSeenAt;
  const mins = diff / 60_000;
  if (mins < 5)   return { label: "At a party 🎉", color: "#22c55e", emoji: "🟢" };
  if (mins < 60)  return { label: "Just active",   color: "#f59e0b", emoji: "🟡" };
  const days = diff / 86_400_000;
  if (days < 1)   return { label: "Today",          color: "#6b7280", emoji: "⚪" };
  if (days < 7)   return { label: `${Math.floor(days)}d ago`, color: "#4b5563", emoji: "⚪" };
  return { label: "A while ago", color: "#374151", emoji: "⚪" };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FriendsSection() {
  const { state } = useRoom();
  const [friends,      setFriends]      = useState<Friend[]>([]);
  const [myCode,       setMyCode]       = useState<string>("");
  const [myName,       setMyName]       = useState<string>("");
  const [addOpen,      setAddOpen]      = useState(false);
  const [codeInput,    setCodeInput]    = useState("");
  const [nameInput,    setNameInput]    = useState("");
  const [profileFriend, setProfile]     = useState<Friend | null>(null);
  const slideY = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    loadFriends().then(setFriends);
    const id = storage.getString("queuedj:guestId");
    if (id) setMyCode(id.slice(0, 8).toUpperCase());
    AsyncStorage.getItem(GUEST_NAME_KEY).then(n => setMyName(n ?? "You"));
  }, []);

  // Slide add modal in/out
  useEffect(() => {
    Animated.timing(slideY, {
      toValue: addOpen ? 0 : 400,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [addOpen]);

  async function handleAddFriend() {
    const code = codeInput.trim().toUpperCase();
    const name = nameInput.trim() || "Unknown";
    if (code.length < 4) {
      Alert.alert("Invalid code", "Friend codes are at least 4 characters.");
      return;
    }
    if (friends.find(f => f.code === code)) {
      Alert.alert("Already added", "This person is already your friend.");
      return;
    }

    const newFriend: Friend = {
      id:                code,
      displayName:       name,
      code,
      addedAt:           Date.now(),
      lastSeenAt:        Date.now() - 3_600_000, // default: 1hr ago
      partiesTogether:   0,
      gamesWonTogether:  0,
    };
    const updated = [...friends, newFriend];
    setFriends(updated);
    await saveFriends(updated);
    setCodeInput("");
    setNameInput("");
    setAddOpen(false);
  }

  async function handleRemoveFriend(id: string) {
    Alert.alert("Remove friend?", "They won't be notified.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive", onPress: async () => {
          const updated = friends.filter(f => f.id !== id);
          setFriends(updated);
          await saveFriends(updated);
          setProfile(null);
        },
      },
    ]);
  }

  function handleShareMyCode() {
    Share.share({
      message: `Add me on PartyGlue! My friend code is: ${myCode}  —  ${myName} 🎉`,
    });
  }

  const inRoom = !!state.room;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.heading}>FRIENDS</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setAddOpen(true)}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* My friend code */}
      <TouchableOpacity style={styles.myCodeCard} onPress={handleShareMyCode} activeOpacity={0.8}>
        <View>
          <Text style={styles.myCodeLabel}>YOUR FRIEND CODE</Text>
          <Text style={styles.myCodeValue}>{myCode || "..."}</Text>
        </View>
        <View style={styles.shareChip}>
          <Text style={styles.shareChipText}>Share 📤</Text>
        </View>
      </TouchableOpacity>

      {/* Friends list */}
      {friends.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>👥</Text>
          <Text style={styles.emptyTitle}>No friends yet</Text>
          <Text style={styles.emptyBody}>Share your code or enter a friend's code to connect</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => setAddOpen(true)}>
            <Text style={styles.emptyBtnText}>Add Your First Friend</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.list}>
          {friends.map(friend => {
            const inRoom = state.members.some(
              m => m.guestId.slice(0, 8).toUpperCase() === friend.code,
            );
            const status = inRoom
              ? { label: "In this room 🎉", color: "#22c55e", emoji: "🟢" }
              : getStatus(friend.lastSeenAt);
            return (
              <TouchableOpacity
                key={friend.id}
                style={styles.friendCard}
                onPress={() => setProfile(friend)}
                activeOpacity={0.8}
              >
                {/* Avatar */}
                <View style={styles.avatarWrap}>
                  <AvatarSVG
                    size={52}
                    bodyColor={friend.avatarBody ?? "#7c3aed"}
                    headphoneColor={friend.avatarHp ?? "#a78bfa"}
                    outfitColor={friend.avatarOutfitColor ?? "#6d28d9"}
                    expression={friend.avatarExpression ?? "happy"}
                    outfit={friend.avatarOutfit ?? "default"}
                  />
                  {/* Status dot */}
                  <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                </View>

                {/* Info */}
                <View style={styles.friendInfo}>
                  <Text style={styles.friendName} numberOfLines={1}>{friend.displayName}</Text>
                  <Text style={styles.friendStatus}>{status.label}</Text>
                  <View style={styles.friendStats}>
                    {friend.partiesTogether > 0 && (
                      <Text style={styles.friendStat}>🎉 {friend.partiesTogether} parties</Text>
                    )}
                    {friend.gamesWonTogether > 0 && (
                      <Text style={styles.friendStat}>🏆 {friend.gamesWonTogether} wins</Text>
                    )}
                  </View>
                </View>

                {/* Actions */}
                <View style={styles.friendActions}>
                  {inRoom && (
                    <View style={styles.inviteBadge}>
                      <Text style={styles.inviteBadgeText}>Invite</Text>
                    </View>
                  )}
                  <Text style={styles.friendCode}>#{friend.code.slice(0, 4)}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Add Friend Modal */}
      <Modal transparent animationType="none" visible={addOpen} onRequestClose={() => setAddOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setAddOpen(false)} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideY }] }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetTitleRow}>
            <Text style={styles.sheetTitle}>Add a Friend</Text>
            {state.room?.code && (
              <View style={styles.roomCodePill}>
                <Text style={styles.roomCodePillText}>Room {state.room.code}</Text>
              </View>
            )}
          </View>
          <Text style={styles.sheetBody}>Enter their friend code (8 characters, shown on their profile)</Text>

          <TextInput
            style={styles.input}
            placeholder="Friend code (e.g. A1B2C3D4)"
            placeholderTextColor="#555"
            value={codeInput}
            onChangeText={t => setCodeInput(t.toUpperCase())}
            maxLength={8}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="Their name (optional)"
            placeholderTextColor="#555"
            value={nameInput}
            onChangeText={setNameInput}
            maxLength={24}
          />

          <TouchableOpacity
            style={[styles.confirmBtn, codeInput.length < 4 && styles.btnDisabled]}
            onPress={handleAddFriend}
            disabled={codeInput.length < 4}
          >
            <Text style={styles.confirmBtnText}>Add Friend</Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.divider} />
          </View>

          <TouchableOpacity style={styles.shareCodeBtn} onPress={handleShareMyCode}>
            <Text style={styles.shareCodeBtnText}>Share my code instead 📤</Text>
          </TouchableOpacity>
        </Animated.View>
      </Modal>

      {/* Friend Profile Modal */}
      {profileFriend && (
        <Modal transparent animationType="fade" visible onRequestClose={() => setProfile(null)}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setProfile(null)}>
            <View style={styles.profileCard} onStartShouldSetResponder={() => true}>
              {/* Avatar */}
              <AvatarSVG
                size={80}
                bodyColor={profileFriend.avatarBody ?? "#7c3aed"}
                headphoneColor={profileFriend.avatarHp ?? "#a78bfa"}
                outfitColor={profileFriend.avatarOutfitColor ?? "#6d28d9"}
                expression={profileFriend.avatarExpression ?? "happy"}
                outfit={profileFriend.avatarOutfit ?? "default"}
              />

              <Text style={styles.profileName}>{profileFriend.displayName}</Text>
              <Text style={styles.profileCode}>#{profileFriend.code}</Text>

              {/* Stats */}
              <View style={styles.profileStats}>
                <View style={styles.profileStatItem}>
                  <Text style={styles.profileStatVal}>{profileFriend.partiesTogether}</Text>
                  <Text style={styles.profileStatLabel}>Parties Together</Text>
                </View>
                <View style={styles.profileStatDivider} />
                <View style={styles.profileStatItem}>
                  <Text style={styles.profileStatVal}>{profileFriend.gamesWonTogether}</Text>
                  <Text style={styles.profileStatLabel}>Wins Together</Text>
                </View>
                <View style={styles.profileStatDivider} />
                <View style={styles.profileStatItem}>
                  <Text style={styles.profileStatVal}>
                    {Math.floor((Date.now() - profileFriend.addedAt) / 86_400_000)}d
                  </Text>
                  <Text style={styles.profileStatLabel}>Friends For</Text>
                </View>
              </View>

              {/* Actions */}
              {inRoom && (
                <TouchableOpacity
                  style={styles.profileInviteBtn}
                  onPress={() => {
                    const socket = socketManager.get();
                    const roomCode = state.room?.code;
                    const roomId   = state.room?.id;
                    if (!socket || !roomCode || !roomId) return;
                    // Emit a targeted invite — server forwards as push notification
                    socket.emit("room:invite_friend" as any, {
                      roomId,
                      roomCode,
                      targetGuestId: profileFriend.id,
                    });
                    Alert.alert("Invite Sent!", `${profileFriend.displayName} will get a notification to join.`);
                    setProfile(null);
                  }}
                >
                  <Text style={styles.profileInviteBtnText}>Invite to Current Room 🎉</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.profileRemoveBtn}
                onPress={() => handleRemoveFriend(profileFriend.id)}
              >
                <Text style={styles.profileRemoveBtnText}>Remove Friend</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.profileCloseBtn} onPress={() => setProfile(null)}>
                <Text style={styles.profileCloseBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { marginTop: 24, paddingBottom: 8 },

  header: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16, marginBottom: 12,
  },
  heading:    { color: "#6b7280", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  addBtn:     { backgroundColor: "rgba(124,58,237,0.2)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(124,58,237,0.4)" },
  addBtnText: { color: "#a78bfa", fontWeight: "700", fontSize: 13 },

  myCodeCard: {
    marginHorizontal: 16, marginBottom: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", padding: 16,
  },
  myCodeLabel: { color: "#6b7280", fontSize: 9, fontWeight: "800", letterSpacing: 2 },
  myCodeValue: { color: "#a78bfa", fontSize: 22, fontWeight: "900", letterSpacing: 4, marginTop: 2 },
  shareChip:   { backgroundColor: "rgba(167,139,250,0.15)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(167,139,250,0.3)" },
  shareChipText: { color: "#a78bfa", fontWeight: "700", fontSize: 13 },

  empty:       { alignItems: "center", padding: 32, gap: 8 },
  emptyEmoji:  { fontSize: 40 },
  emptyTitle:  { color: "#fff", fontSize: 17, fontWeight: "700" },
  emptyBody:   { color: "#6b7280", fontSize: 13, textAlign: "center", lineHeight: 18 },
  emptyBtn:    { marginTop: 8, backgroundColor: "#7c3aed", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 24 },
  emptyBtnText:{ color: "#fff", fontWeight: "700", fontSize: 14 },

  list: { paddingHorizontal: 16, gap: 10 },

  friendCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    padding: 14, gap: 14,
  },
  avatarWrap:   { position: "relative" },
  statusDot:    { position: "absolute", bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: "#0a0a0a" },
  friendInfo:   { flex: 1, gap: 2 },
  friendName:   { color: "#fff", fontSize: 15, fontWeight: "700" },
  friendStatus: { color: "#6b7280", fontSize: 12 },
  friendStats:  { flexDirection: "row", gap: 10, marginTop: 2 },
  friendStat:   { color: "#4b5563", fontSize: 11 },
  friendActions:{ alignItems: "flex-end", gap: 6 },
  inviteBadge:  { backgroundColor: "rgba(124,58,237,0.25)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: "rgba(124,58,237,0.4)" },
  inviteBadgeText: { color: "#a78bfa", fontSize: 11, fontWeight: "700" },
  friendCode:   { color: "#374151", fontSize: 11, fontWeight: "600" },

  // Add modal
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.65)" },
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#0f0f0f",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderTopColor: "#1a1a1a",
    padding: 24, gap: 14,
  },
  sheetHandle:    { width: 40, height: 4, borderRadius: 2, backgroundColor: "#333", alignSelf: "center", marginBottom: 4 },
  sheetTitleRow:  { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  sheetTitle:     { color: "#fff", fontSize: 20, fontWeight: "800" },
  roomCodePill:   { backgroundColor: "rgba(124,58,237,0.25)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: "rgba(167,139,250,0.4)" },
  roomCodePillText: { color: "#a78bfa", fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
  sheetBody:      { color: "#6b7280", fontSize: 13, lineHeight: 18 },

  input: {
    backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    color: "#fff", fontSize: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    fontWeight: "700", letterSpacing: 1,
  },
  confirmBtn:     { backgroundColor: "#7c3aed", borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  confirmBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  btnDisabled:    { opacity: 0.4 },

  dividerRow:   { flexDirection: "row", alignItems: "center", gap: 12 },
  divider:      { flex: 1, height: 1, backgroundColor: "#1f1f1f" },
  dividerText:  { color: "#4b5563", fontSize: 13 },

  shareCodeBtn:     { borderRadius: 14, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  shareCodeBtnText: { color: "#9ca3af", fontWeight: "600", fontSize: 15 },

  // Profile modal
  profileCard: {
    backgroundColor: "#141414",
    borderRadius: 28, borderWidth: 1, borderColor: "#222",
    margin: 24, padding: 28, alignItems: "center", gap: 10,
  },
  profileName:    { color: "#fff", fontSize: 22, fontWeight: "900" },
  profileCode:    { color: "#4b5563", fontSize: 13, fontWeight: "600" },

  profileStats:      { flexDirection: "row", width: "100%", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 16, paddingVertical: 14, marginTop: 4 },
  profileStatItem:   { flex: 1, alignItems: "center", gap: 3 },
  profileStatVal:    { color: "#fff", fontSize: 20, fontWeight: "900" },
  profileStatLabel:  { color: "#6b7280", fontSize: 10, fontWeight: "700", textAlign: "center" },
  profileStatDivider:{ width: 1, backgroundColor: "rgba(255,255,255,0.06)" },

  profileInviteBtn:     { backgroundColor: "#7c3aed", borderRadius: 14, paddingVertical: 13, paddingHorizontal: 24, width: "100%", alignItems: "center", marginTop: 4 },
  profileInviteBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  profileRemoveBtn:     { paddingVertical: 10 },
  profileRemoveBtnText: { color: "#ef4444", fontSize: 13, fontWeight: "600" },
  profileCloseBtn:      { paddingVertical: 8 },
  profileCloseBtnText:  { color: "#6b7280", fontSize: 14 },
});
