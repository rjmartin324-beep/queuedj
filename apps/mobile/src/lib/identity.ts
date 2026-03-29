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

// Canonical key — used by all code going forward
const SOCKET_GUEST_ID_KEY = "queuedj:guestId";

const KEYS = {
  // Keep the identity key as an alias that stays in sync
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
  // ── guestId unification ──────────────────────────────────────────────────
  // socket.ts uses "queuedj:guestId"; identity.ts uses "queuedj:identity:guestId".
  // On first load after this change, unify both to the socket key (the one that
  // credits in Postgres are already tied to). New installs get a fresh UUID.
  const socketKey   = storage.getString(SOCKET_GUEST_ID_KEY) ?? null;
  const identityKey = storage.getString(KEYS.guestId) ?? null;

  let guestId: string;
  if (socketKey) {
    // socket key is canonical — ensure identity key matches
    guestId = socketKey;
    if (identityKey !== socketKey) storage.set(KEYS.guestId, socketKey);
  } else if (identityKey) {
    // only identity key — promote it to socket key
    guestId = identityKey;
    storage.set(SOCKET_GUEST_ID_KEY, identityKey);
  } else {
    // neither exists — fresh install
    guestId = generateUUID();
    storage.set(SOCKET_GUEST_ID_KEY, guestId);
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
 * Override the local guestId — called when an account sign-in returns a
 * canonical guestId from the server (e.g., returning user on a new device).
 * Writes both keys to keep them in sync.
 */
export function setCanonicalGuestId(id: string): void {
  storage.set(SOCKET_GUEST_ID_KEY, id);
  storage.set(KEYS.guestId, id);
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
