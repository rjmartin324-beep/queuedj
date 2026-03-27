import { storage } from "./storage";

// ─────────────────────────────────────────────────────────────────────────────
// Persistent Identity
//
// Stores a stable anonymous identity via MMKV (synchronous) that survives
// app restarts. The guestId is a UUID v4 generated once on first launch
// and never changed. displayName, avatarChoice, and vibeCredits are
// user-configurable.
//
// This is the single source of truth for local identity — used by SocketManager,
// RoomContext, and any screen that needs the guest's profile.
// ─────────────────────────────────────────────────────────────────────────────

const KEYS = {
  guestId:      "queuedj:identity:guestId",
  displayName:  "queuedj:identity:displayName",
  avatarChoice: "queuedj:identity:avatarChoice",
  vibeCredits:  "queuedj:identity:vibeCredits",
} as const;

export interface Identity {
  guestId:      string;
  displayName:  string | null;
  avatarChoice: string | null;
  vibeCredits:  number;
}

// ─── UUID v4 ─────────────────────────────────────────────────────────────────

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Load the full identity from MMKV (synchronous).
 * Creates and persists a new guestId if one does not already exist.
 * Kept async for backward compatibility with call sites.
 */
export async function getIdentity(): Promise<Identity> {
  let guestId = storage.getString(KEYS.guestId) ?? null;
  if (!guestId) {
    guestId = generateUUID();
    storage.set(KEYS.guestId, guestId);
  }

  return {
    guestId,
    displayName:  storage.getString(KEYS.displayName) ?? null,
    avatarChoice: storage.getString(KEYS.avatarChoice) ?? null,
    vibeCredits:  parseInt(storage.getString(KEYS.vibeCredits) ?? "0", 10),
  };
}

/**
 * Persist updated identity fields.
 * Only writes keys that are provided — partial updates are supported.
 */
export async function saveIdentity(updates: Partial<Omit<Identity, "guestId">>): Promise<void> {
  if (updates.displayName !== undefined) {
    storage.set(KEYS.displayName, updates.displayName ?? "");
  }
  if (updates.avatarChoice !== undefined) {
    storage.set(KEYS.avatarChoice, updates.avatarChoice ?? "");
  }
  if (updates.vibeCredits !== undefined) {
    storage.set(KEYS.vibeCredits, String(updates.vibeCredits));
  }
}

/**
 * Erase all identity data from MMKV.
 * A fresh guestId will be generated on the next getIdentity() call.
 * Use with caution — this is permanent and cannot be undone.
 */
export async function clearIdentity(): Promise<void> {
  storage.delete(KEYS.guestId);
  storage.delete(KEYS.displayName);
  storage.delete(KEYS.avatarChoice);
  storage.delete(KEYS.vibeCredits);
}
