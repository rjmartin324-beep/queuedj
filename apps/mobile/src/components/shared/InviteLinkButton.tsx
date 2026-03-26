import React, { useState } from "react"
import { TouchableOpacity, Text, StyleSheet, View } from "react-native"
import { shareInviteLink, copyInviteLink } from "../../lib/inviteLink"

interface Props {
  roomCode: string;
  /** "compact" = default inline pill, "large" = prominent standalone display */
  size?: "compact" | "large";
}

export function InviteLinkButton({ roomCode, size = "compact" }: Props) {
  const [copied, setCopied] = useState(false)

  async function handlePress() {
    await shareInviteLink(roomCode)
  }

  async function handleLongPress() {
    await copyInviteLink(roomCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (size === "large") {
    return (
      <View style={styles.largeWrap}>
        <Text style={styles.largeLabel}>ROOM CODE</Text>
        <TouchableOpacity
          style={styles.largeBtn}
          onPress={handlePress}
          onLongPress={handleLongPress}
          delayLongPress={400}
          activeOpacity={0.8}
        >
          <Text style={styles.largeCode}>{roomCode}</Text>
          <Text style={styles.largeShare}>⬆ Share</Text>
        </TouchableOpacity>
        {copied && <Text style={styles.largeCopied}>✓ Copied!</Text>}
      </View>
    )
  }

  return (
    <View>
      <TouchableOpacity
        style={styles.btn}
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={400}
      >
        <Text style={styles.code}>{roomCode}</Text>
        <Text style={styles.icon}>⬆</Text>
      </TouchableOpacity>
      {copied && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>Copied!</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  btn:       { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#1a1a1a", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "#2a2a2a" },
  code:      { color: "#fff", fontSize: 15, fontWeight: "800", letterSpacing: 2 },
  icon:      { color: "#6c47ff", fontSize: 14, fontWeight: "700" },
  toast:     { position: "absolute", bottom: -28, left: 0, right: 0, alignItems: "center" },
  toastText: { color: "#22c55e", fontSize: 12, fontWeight: "700", backgroundColor: "#0a0a0a", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },

  largeWrap:   { alignItems: "center", gap: 6 },
  largeLabel:  { color: "#6b7280", fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  largeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(124,58,237,0.15)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.4)",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  largeCode:   { color: "#fff", fontSize: 32, fontWeight: "900", letterSpacing: 6 },
  largeShare:  { color: "#7c3aed", fontSize: 13, fontWeight: "700" },
  largeCopied: { color: "#22c55e", fontSize: 13, fontWeight: "700" },
})
