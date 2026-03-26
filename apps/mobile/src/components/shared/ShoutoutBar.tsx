import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated, Easing, Keyboard, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from "react-native";
import { tapLight, notifySuccess } from "../../lib/haptics";
import { useRoom } from "../../contexts/RoomContext";
import { socketManager } from "../../lib/socket";

// ─────────────────────────────────────────────────────────────────────────────
// ShoutoutBar — send & receive scrolling shoutout messages
// Shows a floating toast for each incoming shoutout
// Includes a compact compose area
// ─────────────────────────────────────────────────────────────────────────────

const MAX_LEN      = 80;
const TOAST_MS     = 3500; // how long each toast stays
const COOLDOWN_MS  = 8000; // per-client send cooldown

interface Toast {
  id:      number;
  message: string;
  transY:  Animated.Value;
  opacity: Animated.Value;
}

let _tid = 0;

// ─── Single Toast ─────────────────────────────────────────────────────────────

function ShoutoutToast({ toast }: { toast: Toast }) {
  return (
    <Animated.View
      style={[
        styles.toast,
        { transform: [{ translateY: toast.transY }], opacity: toast.opacity },
      ]}
      pointerEvents="none"
    >
      <Text style={styles.toastText} numberOfLines={2}>📣 {toast.message}</Text>
    </Animated.View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  /** Whether the compose input is visible */
  composeOpen: boolean;
  onComposeClose?: () => void;
}

export function ShoutoutBar({ composeOpen, onComposeClose }: Props) {
  const { state, sendAction } = useRoom();
  const [toasts, setToasts]   = useState<Toast[]>([]);
  const [text, setText]       = useState("");
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Listen for incoming shoutouts ─────────────────────────────────────────
  useEffect(() => {
    const socket = socketManager.getSocket();
    if (!socket) return;

    function onShoutout({ message }: { message: string }) {
      notifySuccess();
      const id = ++_tid;
      const transY  = new Animated.Value(-30);
      const opacity = new Animated.Value(0);
      const t: Toast = { id, message, transY, opacity };

      setToasts(prev => [...prev.slice(-2), t]); // keep max 3 visible

      Animated.parallel([
        Animated.timing(transY,  { toValue: 0,   duration: 250, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1,   duration: 200, useNativeDriver: true }),
      ]).start();

      setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 350, useNativeDriver: true }).start(() => {
          setToasts(prev => prev.filter(x => x.id !== id));
        });
      }, TOAST_MS);
    }

    socket.on("shoutout:received" as any, onShoutout);
    return () => { socket.off("shoutout:received" as any, onShoutout); };
  }, []);

  // ── Cooldown timer ────────────────────────────────────────────────────────
  const startCooldown = useCallback(() => {
    setCooldown(Math.ceil(COOLDOWN_MS / 1000));
    const end = Date.now() + COOLDOWN_MS;
    cooldownRef.current = setInterval(() => {
      const remaining = Math.ceil((end - Date.now()) / 1000);
      if (remaining <= 0) {
        clearInterval(cooldownRef.current!);
        setCooldown(0);
      } else {
        setCooldown(remaining);
      }
    }, 500);
  }, []);

  // ── Send ──────────────────────────────────────────────────────────────────
  function sendShoutout() {
    const msg = text.trim().slice(0, MAX_LEN);
    if (!msg || cooldown > 0 || !state.room) return;
    tapLight();
    Keyboard.dismiss();
    sendAction("send_shoutout", { message: msg });
    setText("");
    startCooldown();
    onComposeClose?.();
  }

  return (
    <>
      {/* Toast stack */}
      <View style={styles.toastStack} pointerEvents="none">
        {toasts.map(t => <ShoutoutToast key={t.id} toast={t} />)}
      </View>

      {/* Compose area */}
      {composeOpen && (
        <View style={styles.compose}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={t => setText(t.slice(0, MAX_LEN))}
            placeholder="Send a shoutout…"
            placeholderTextColor="rgba(255,255,255,0.25)"
            maxLength={MAX_LEN}
            autoFocus
            returnKeyType="send"
            onSubmitEditing={sendShoutout}
          />
          <Text style={styles.charCount}>{text.length}/{MAX_LEN}</Text>
          <TouchableOpacity
            style={[styles.sendBtn, (cooldown > 0 || !text.trim()) && styles.sendBtnDisabled]}
            onPress={sendShoutout}
            disabled={cooldown > 0 || !text.trim()}
          >
            <Text style={styles.sendBtnText}>
              {cooldown > 0 ? `${cooldown}s` : "📣 SHOUT"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  toastStack: {
    position:  "absolute",
    top:       60,
    left:      12,
    right:     12,
    gap:       8,
    zIndex:    999,
  },
  toast: {
    backgroundColor: "rgba(124,58,237,0.92)",
    borderRadius:    16,
    paddingHorizontal: 16,
    paddingVertical:   10,
    borderWidth:     1,
    borderColor:     "rgba(167,139,250,0.35)",
  },
  toastText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  compose: {
    position:        "absolute",
    bottom:          90,
    left:            12,
    right:           12,
    backgroundColor: "rgba(20,10,40,0.97)",
    borderRadius:    20,
    borderWidth:     1,
    borderColor:     "rgba(167,139,250,0.25)",
    padding:         14,
    gap:             10,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     "rgba(255,255,255,0.1)",
    paddingHorizontal: 14,
    paddingVertical:   12,
    color:           "#fff",
    fontSize:        15,
  },
  charCount: {
    color:       "#4b5563",
    fontSize:    10,
    textAlign:   "right",
    marginTop:   -6,
  },
  sendBtn:         { backgroundColor: "#7c3aed", borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText:     { color: "#fff", fontWeight: "800", fontSize: 15 },
});
