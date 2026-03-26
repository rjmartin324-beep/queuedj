import AsyncStorage from "@react-native-async-storage/async-storage";

// ─────────────────────────────────────────────────────────────────────────────
// Persistent Identity
//
// Stores a stable anonymous identity in AsyncStorage that survives app restarts.
// The guestId is a UUID v4 generated once on first launch and never changed.
// displayName, avatarChoice, and vibeCredits are user-configurable.
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
 * Load the full identity from AsyncStorage.
 * Creates and persists a new guestId if one does not already exist.
 */
export async function getIdentity(): Promise<Identity> {
  const [guestId, displayName, avatarChoice, creditsRaw] = await Promise.all([
    AsyncStorage.getItem(KEYS.guestId),
    AsyncStorage.getItem(KEYS.displayName),
    AsyncStorage.getItem(KEYS.avatarChoice),
    AsyncStorage.getItem(KEYS.vibeCredits),
  ]);

  let resolvedGuestId = guestId;
  if (!resolvedGuestId) {
    resolvedGuestId = generateUUID();
    await AsyncStorage.setItem(KEYS.guestId, resolvedGuestId);
  }

  return {
    guestId:      resolvedGuestId,
    displayName:  displayName ?? null,
    avatarChoice: avatarChoice ?? null,
    vibeCredits:  creditsRaw ? parseInt(creditsRaw, 10) : 0,
  };
}

/**
 * Persist updated identity fields.
 * Only writes keys that are provided — partial updates are supported.
 */
export async function saveIdentity(updates: Partial<Omit<Identity, "guestId">>): Promise<void> {
  const pairs: [string, string][] = [];

  if (updates.displayName !== undefined) {
    pairs.push([KEYS.displayName, updates.displayName ?? ""]);
  }
  if (updates.avatarChoice !== undefined) {
    pairs.push([KEYS.avatarChoice, updates.avatarChoice ?? ""]);
  }
  if (updates.vibeCredits !== undefined) {
    pairs.push([KEYS.vibeCredits, String(updates.vibeCredits)]);
  }

  if (pairs.length > 0) {
    await AsyncStorage.multiSet(pairs);
  }
}

/**
 * Erase all identity data from AsyncStorage.
 * A fresh guestId will be generated on the next getIdentity() call.
 * Use with caution — this is permanent and cannot be undone.
 */
export async function clearIdentity(): Promise<void> {
  await AsyncStorage.multiRemove([
    KEYS.guestId,
    KEYS.displayName,
    KEYS.avatarChoice,
    KEYS.vibeCredits,
  ]);
}
