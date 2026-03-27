import { Platform } from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// Shared storage instance — MMKV on native, localStorage shim on web.
// MMKV reads/writes are synchronous — no await needed.
// ─────────────────────────────────────────────────────────────────────────────

interface Storage {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
}

function makeWebStorage(): Storage {
  return {
    getString: (key) => {
      try { return localStorage.getItem(key) ?? undefined; } catch { return undefined; }
    },
    set: (key, value) => {
      try { localStorage.setItem(key, value); } catch {}
    },
    delete: (key) => {
      try { localStorage.removeItem(key); } catch {}
    },
  };
}

function makeNativeStorage(): Storage {
  const { MMKV } = require("react-native-mmkv");
  return new MMKV({ id: "queuedj" });
}

export const storage: Storage = Platform.OS === "web"
  ? makeWebStorage()
  : makeNativeStorage();
