import React, { useState } from "react";
import {
  Modal, View, Text, TextInput,
  TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform,
} from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// NamePromptModal — shown once before a guest enters a room
// The name is stored locally and sent to the server on join
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onConfirm: (name: string) => void;
}

const ADJECTIVES = ["Funky", "Electric", "Cosmic", "Wild", "Smooth", "Hyped", "Neon", "Blazing"];
const NOUNS      = ["Panda", "Llama", "Gecko", "Falcon", "Otter", "Walrus", "Cobra", "Shark"];

function randomName() {
  const adj  = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj} ${noun}`;
}

export function NamePromptModal({ visible, onConfirm }: Props) {
  const [name, setName] = useState(() => randomName());

  function confirm() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  }

  function shuffle() {
    setName(randomName());
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.sheet}>
          <Text style={styles.title}>What's your name?</Text>
          <Text style={styles.subtitle}>Everyone will see this in the game.</Text>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor="#555"
              maxLength={24}
              autoFocus
              onSubmitEditing={confirm}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.shuffleBtn} onPress={shuffle}>
              <Text style={styles.shuffleText}>🎲</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.confirmBtn, !name.trim() && styles.confirmBtnDisabled]}
            onPress={confirm}
            disabled={!name.trim()}
          >
            <Text style={styles.confirmText}>Let's Go</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:           { flex: 1, backgroundColor: "#000000cc", justifyContent: "flex-end" },
  sheet:             { backgroundColor: "#141414", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, paddingBottom: 48, gap: 16 },
  title:             { color: "#fff", fontSize: 22, fontWeight: "800" },
  subtitle:          { color: "#666", fontSize: 14, marginTop: -8 },
  inputRow:          { flexDirection: "row", gap: 10, alignItems: "center" },
  input:             { flex: 1, backgroundColor: "#1e1e1e", borderRadius: 12, padding: 16, color: "#fff", fontSize: 18, fontWeight: "600", borderWidth: 1, borderColor: "#333" },
  shuffleBtn:        { backgroundColor: "#1e1e1e", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#333" },
  shuffleText:       { fontSize: 20 },
  confirmBtn:        { backgroundColor: "#6c47ff", borderRadius: 14, paddingVertical: 18, alignItems: "center" },
  confirmBtnDisabled:{ opacity: 0.4 },
  confirmText:       { color: "#fff", fontSize: 17, fontWeight: "700" },
});
