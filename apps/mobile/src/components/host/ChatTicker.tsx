import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import { socketManager } from "../../lib/socket";
import type { ChatMsg } from "../shared/PartyChatPanel";

// ─────────────────────────────────────────────────────────────────────────────
// ChatTicker — read-only chat strip for the host
//
// Shows the last 3 messages in a compact strip pinned above the host tab bar.
// New messages slide in from the right.  Older messages fade out.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_VISIBLE = 3;

interface Props {
  roomId: string;
}

export function ChatTicker({ roomId }: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const slideX = useRef(new Animated.Value(60)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const socket = socketManager.get();
    if (!socket) return;

    const handler = (msg: ChatMsg) => {
      if (msg.roomId !== roomId) return;

      setMessages(prev => {
        const updated = [...prev, msg];
        return updated.slice(-MAX_VISIBLE);
      });

      // Animate in
      slideX.setValue(40);
      opacity.setValue(0);
      Animated.parallel([
        Animated.timing(slideX,  { toValue: 0, duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    };

    socket.on("chat:received" as any, handler);
    return () => { socket.off("chat:received" as any, handler); };
  }, [roomId]);

  if (messages.length === 0) return null;

  return (
    <View style={styles.ticker}>
      <View style={styles.labelWrap}>
        <Text style={styles.label}>💬</Text>
      </View>
      <View style={styles.messages}>
        {messages.map((msg, i) => {
          const isLatest = i === messages.length - 1;
          return (
            <Animated.View
              key={msg.id}
              style={[
                styles.msgRow,
                isLatest && { transform: [{ translateX: slideX }], opacity },
              ]}
            >
              <Text style={styles.name} numberOfLines={1}>{msg.displayName}:</Text>
              <Text style={styles.text} numberOfLines={1}>{msg.text}</Text>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ticker: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderTopWidth: 1,
    borderTopColor: "rgba(124,58,237,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
    minHeight: 32,
  },
  labelWrap: {
    backgroundColor: "rgba(124,58,237,0.2)",
    borderRadius: 8,
    padding: 4,
  },
  label: { fontSize: 14 },
  messages: { flex: 1, gap: 1 },
  msgRow:   { flexDirection: "row", gap: 6, alignItems: "center" },
  name:     { color: "#a78bfa", fontSize: 11, fontWeight: "700", maxWidth: 80 },
  text:     { color: "#9ca3af", fontSize: 11, flex: 1 },
});
