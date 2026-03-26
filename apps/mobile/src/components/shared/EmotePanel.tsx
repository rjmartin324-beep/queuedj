import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated, Dimensions, Easing, StyleSheet, Text,
  TouchableOpacity, View,
} from "react-native";
import { tapLight } from "../../lib/haptics";
import { useRoom } from "../../contexts/RoomContext";

// ─────────────────────────────────────────────────────────────────────────────
// EmotePanel — floating emoji reaction bar + float-up animations
// Drop anywhere in a screen; emotes fly up and fade out above the trigger
// ─────────────────────────────────────────────────────────────────────────────

const EMOTES = ["🔥", "❤️", "😂", "🎉", "👏", "😮", "💜", "🎵"];

const COOLDOWN_MS = 800; // prevent spam

interface FlyingEmote {
  id:      number;
  emoji:   string;
  x:       number;
  transY:  Animated.Value;
  opacity: Animated.Value;
  scale:   Animated.Value;
}

let _id = 0;

// ─── Flying emote particle ────────────────────────────────────────────────────

function FlyParticle({ fe }: { fe: FlyingEmote }) {
  return (
    <Animated.Text
      style={[
        styles.flying,
        {
          left:      fe.x,
          transform: [{ translateY: fe.transY }, { scale: fe.scale }],
          opacity:   fe.opacity,
        },
      ]}
    >
      {fe.emoji}
    </Animated.Text>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  /** Whether the panel is visible */
  visible: boolean;
  onClose?: () => void;
}

const SCREEN_W = Dimensions.get("window").width;

export function EmotePanel({ visible, onClose }: Props) {
  const { sendAction } = useRoom();
  const [flying, setFlying] = useState<FlyingEmote[]>([]);
  const lastSentRef = useRef<Record<string, number>>({});
  const panelAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(panelAnim, {
      toValue:  visible ? 1 : 0,
      duration: 200,
      easing:   Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible]);

  const sendEmote = useCallback((emoji: string) => {
    const now = Date.now();
    if ((lastSentRef.current[emoji] ?? 0) + COOLDOWN_MS > now) return;
    lastSentRef.current[emoji] = now;

    tapLight();
    sendAction("send_emote", { emoji });

    // Launch a flying particle
    const id = ++_id;
    const x  = Math.random() * (SCREEN_W - 60) + 10;
    const fe: FlyingEmote = {
      id,
      emoji,
      x,
      transY:  new Animated.Value(0),
      opacity: new Animated.Value(1),
      scale:   new Animated.Value(0.8),
    };

    setFlying(prev => [...prev, fe]);

    Animated.parallel([
      Animated.timing(fe.transY, {
        toValue:  -180,
        duration: 1400,
        easing:   Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(fe.opacity, {
        toValue:  0,
        duration: 1400,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(fe.scale, { toValue: 1.4, duration: 200, useNativeDriver: true }),
        Animated.timing(fe.scale, { toValue: 1,   duration: 200, useNativeDriver: true }),
      ]),
    ]).start(() => {
      setFlying(prev => prev.filter(p => p.id !== id));
    });
  }, [sendAction]);

  const translateY = panelAnim.interpolate({ inputRange: [0, 1], outputRange: [80, 0] });
  const opacity    = panelAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <>
      {/* Flying particles (always rendered so they outlive a closed panel) */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {flying.map(fe => <FlyParticle key={fe.id} fe={fe} />)}
      </View>

      {/* Panel */}
      {visible && (
        <Animated.View
          style={[styles.panel, { transform: [{ translateY }], opacity }]}
        >
          <View style={styles.row}>
            {EMOTES.map(emoji => (
              <TouchableOpacity
                key={emoji}
                style={styles.emoteBtn}
                onPress={() => sendEmote(emoji)}
                activeOpacity={0.7}
              >
                <Text style={styles.emoteText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {onClose && (
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  panel: {
    position:        "absolute",
    bottom:          90,
    left:            12,
    right:           12,
    backgroundColor: "rgba(20,10,40,0.95)",
    borderRadius:    24,
    borderWidth:     1,
    borderColor:     "rgba(167,139,250,0.2)",
    padding:         12,
    flexDirection:   "row",
    alignItems:      "center",
  },
  row: {
    flex:           1,
    flexDirection:  "row",
    flexWrap:       "wrap",
    gap:            6,
    justifyContent: "center",
  },
  emoteBtn: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems:      "center",
    justifyContent:  "center",
  },
  emoteText: { fontSize: 22 },

  closeBtn: {
    width:           32,
    height:          32,
    borderRadius:    16,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems:      "center",
    justifyContent:  "center",
    marginLeft:      8,
  },
  closeText: { color: "#9ca3af", fontSize: 14, fontWeight: "700" },

  flying: {
    position: "absolute",
    bottom:   100,
    fontSize: 28,
  },
});
