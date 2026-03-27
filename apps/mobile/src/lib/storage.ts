import { MMKV } from "react-native-mmkv";

// ─────────────────────────────────────────────────────────────────────────────
// Shared MMKV storage instance
//
// Single instance used across identity, streak, socket, and onboarding.
// MMKV reads/writes are synchronous — no await needed.
// ─────────────────────────────────────────────────────────────────────────────

export const storage = new MMKV({ id: "queuedj" });
