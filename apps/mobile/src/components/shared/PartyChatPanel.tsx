import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  FlatList, KeyboardAvoidingView, Platform, Modal, Animated, Easing,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { socketManager } from "../../lib/socket";
import { useRoom } from "../../contexts/RoomContext";
import { tapLight, notifyError } from "../../lib/haptics";

// ─────────────────────────────────────────────────────────────────────────────
// PartyChatPanel
//
// Slide-up modal chat for guests. Floating 💬 button lives in GuestScreen.
// Messages arrive via  chat:received  socket event and are kept in local state.
// History (last 50) fetched on open via  chat:history  ack.
// ─────────────────────────────────────────────────────────────────────────────

const GUEST_NAME_KEY = "guest_display_name";

export interface ChatMsg {
  id:          string;
  guestId:     string;
  displayName: string;
  text:        string;
  ts:          number;
}

interface Props {
  visible:  boolean;
  onClose:  () => void;
  unreadCount: number;
  onRead:   () => void;
}

export function PartyChatPanel({ visible, onClose, onRead }: Props) {
  const { state } = useRoom();
  const [messages,     setMessages]     = useState<ChatMsg[]>([]);
  const [inputText,    setInputText]    = useState("");
  const [myName,       setMyName]       = useState("Guest");
  const [sending,      setSending]      = useState(false);
  const [sendError,    setSendError]    = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const listRef  = useRef<FlatList>(null);
  const slideY   = useRef(new Animated.Value(700)).current;

  useEffect(() => {
    AsyncStorage.getItem(GUEST_NAME_KEY).then(n => { if (n) setMyName(n); });
  }, []);

  // Slide in/out
  useEffect(() => {
    Animated.timing(slideY, {
      toValue:         visible ? 0 : 700,
      duration:        320,
      easing:          Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    if (visible) {
      onRead();
      fetchHistory();
    }
  }, [visible]);

  // Listen for incoming messages
  useEffect(() => {
    const socket = socketManager.get();
    if (!socket) return;

    const handler = (msg: ChatMsg) => {
      setMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    };

    socket.on("chat:received" as any, handler);
    return () => { socket.off("chat:received" as any, handler); };
  }, []);

  function fetchHistory() {
    const socket = socketManager.get();
    const roomId = state.room?.id;
    if (!socket || !roomId) return;
    setLoadingHistory(true);
    (socket as any).emit("chat:history", { roomId }, (history: ChatMsg[]) => {
      setMessages(history);
      setLoadingHistory(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 80);
    });
  }

  function handleSend() {
    const text = inputText.trim();
    if (!text || sending) return;
    const socket = socketManager.get();
    const roomId = state.room?.id;
    const guestId = state.guestId;
    if (!socket || !roomId || !guestId) return;

    setSending(true);
    setSendError(false);
    setInputText("");

    (socket as any).emit("chat:message", { roomId, guestId, displayName: myName, text },
      (ack: { ok: boolean; error?: string } | undefined) => {
        setSending(false);
        if (ack && !ack.ok) {
          setSendError(true);
          setInputText(text); // restore so they can retry
          notifyError();
          setTimeout(() => setSendError(false), 3000);
        } else {
          tapLight();
        }
      },
    );

    // Fallback: if server doesn't use ack pattern, clear sending after 2s
    setTimeout(() => setSending(false), 2000);
  }

  const myGuestId = state.guestId ?? "";

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible onRequestClose={onClose}>
      {/* Backdrop */}
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideY }] }]}>
        {/* Handle + header */}
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Party Chat 💬</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Send error banner */}
        {sendError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>⚠️ Message failed — tap send to retry</Text>
          </View>
        )}

        {/* Messages */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isMe = item.guestId === myGuestId;
            return (
              <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
                {!isMe && (
                  <Text style={styles.msgName}>{item.displayName}</Text>
                )}
                <View style={[styles.bubble, isMe && styles.bubbleMe]}>
                  <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>
                    {item.text}
                  </Text>
                </View>
                <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>
                  {new Date(item.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              {loadingHistory
                ? <Text style={styles.emptyText}>Loading messages...</Text>
                : <>
                    <Text style={styles.emptyEmoji}>💬</Text>
                    <Text style={styles.emptyText}>No messages yet — say hi!</Text>
                  </>
              }
            </View>
          }
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        {/* Input */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={20}
        >
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Say something..."
              placeholderTextColor="#555"
              multiline
              maxLength={200}
              returnKeyType="send"
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!inputText.trim() || sending}
            >
              <Text style={styles.sendBtnText}>↑</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

// ─── Floating trigger button (rendered in GuestScreen) ───────────────────────

export function ChatFloatingButton({
  onPress,
  unreadCount,
}: {
  onPress: () => void;
  unreadCount: number;
}) {
  return (
    <TouchableOpacity style={styles.floatBtn} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.floatBtnIcon}>💬</Text>
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },

  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    height: "78%",
    backgroundColor: "#0d0d0d",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderTopColor: "#1a1a1a",
  },

  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "#333", alignSelf: "center",
    marginTop: 10, marginBottom: 4,
  },

  header: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#1a1a1a",
  },
  headerTitle:  { color: "#fff", fontSize: 17, fontWeight: "800" },
  closeBtn:     { padding: 10, margin: -6 },
  closeBtnText: { color: "#555", fontSize: 18 },

  errorBanner: {
    backgroundColor: "rgba(239,68,68,0.15)", borderBottomWidth: 1,
    borderBottomColor: "rgba(239,68,68,0.3)", paddingHorizontal: 16, paddingVertical: 8,
  },
  errorBannerText: { color: "#fca5a5", fontSize: 13, fontWeight: "600" },

  list:        { flex: 1 },
  listContent: { padding: 16, gap: 12 },

  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 8 },
  emptyEmoji:{ fontSize: 40 },
  emptyText: { color: "#4b5563", fontSize: 14 },

  msgRow:   { gap: 2 },
  msgRowMe: { alignItems: "flex-end" },

  msgName: { color: "#6b7280", fontSize: 11, fontWeight: "600", paddingLeft: 12, marginBottom: 2 },

  bubble: {
    alignSelf: "flex-start",
    backgroundColor: "#1f1f1f",
    borderRadius: 18, borderBottomLeftRadius: 4,
    paddingHorizontal: 14, paddingVertical: 9,
    maxWidth: "80%",
  },
  bubbleMe: {
    alignSelf: "flex-end",
    backgroundColor: "#7c3aed",
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4,
  },
  bubbleText:   { color: "#e5e7eb", fontSize: 15, lineHeight: 20 },
  bubbleTextMe: { color: "#fff" },

  msgTime:   { color: "#374151", fontSize: 10, paddingLeft: 12, marginTop: 2 },
  msgTimeMe: { paddingLeft: 0, paddingRight: 12 },

  inputRow: {
    flexDirection: "row", alignItems: "flex-end",
    padding: 12, gap: 10,
    borderTopWidth: 1, borderTopColor: "#1a1a1a",
    paddingBottom: Platform.OS === "ios" ? 28 : 12,
  },
  input: {
    flex: 1, backgroundColor: "#1a1a1a",
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
    color: "#fff", fontSize: 15, maxHeight: 100,
    borderWidth: 1, borderColor: "#2a2a2a",
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#7c3aed",
    alignItems: "center", justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: "#2a2a2a" },
  sendBtnText:     { color: "#fff", fontSize: 20, fontWeight: "700", lineHeight: 24 },

  // Floating button
  floatBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(124,58,237,0.85)",
    alignItems: "center", justifyContent: "center",
    ...Platform.select({
      ios: { shadowColor: "#7c3aed", shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
    }),
  },
  floatBtnIcon: { fontSize: 22 },
  badge: {
    position: "absolute", top: -4, right: -4,
    backgroundColor: "#ef4444", borderRadius: 10,
    minWidth: 18, height: 18, alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "#03001c",
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "900" },
});
