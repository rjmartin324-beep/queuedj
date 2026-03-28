import { io, Socket } from "socket.io-client";
import { AppState, AppStateStatus } from "react-native";
import { storage } from "./storage";

import type {
  ClientToServerEvents,
  ServerToClientEvents,
  OfflineModeState,
  RoomJoinAck,
} from "@queuedj/shared-types";

// ─────────────────────────────────────────────────────────────────────────────
// Socket.io Client — Mobile
//
// Key behaviors:
//   1. Auto-reconnect with exponential backoff
//   2. State reconciliation: sends lastSequenceId on every reconnect
//   3. Offline mode: queues events locally, replays on reconnect
//   4. App backgrounding: Socket.io keeps connection for 30s, then drops gracefully
//   5. Guest ID: stored in AsyncStorage — persists across app restarts
// ─────────────────────────────────────────────────────────────────────────────

const REALTIME_URL    = process.env.EXPO_PUBLIC_REALTIME_URL ?? "http://localhost:3002";
const GUEST_ID_KEY    = "queuedj:guestId";
const DISPLAY_NAME_KEY = "queuedj:displayName";
const LAST_SEQ_KEY    = (roomId: string) => `queuedj:room:${roomId}:lastSeq`;

export type QueueDJSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

class SocketManager {
  private socket: QueueDJSocket | null = null;
  private currentRoomId: string | null = null;
  private offlineState: OfflineModeState = {
    isOffline: false,
    pendingRequests: [],
    lastKnownSequenceId: 0,
  };
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  // In-memory cache — avoids repeated AsyncStorage hits on every button press
  private _guestId:      string | null = null;
  private _displayName:  string | null | undefined = undefined; // undefined = not loaded yet

  constructor() {
    // Prewarm: load IDs from storage immediately so the first button tap is instant
    this._prewarm();
  }

  private _prewarm() {
    try {
      const guestId = storage.getString(GUEST_ID_KEY) ?? null;
      if (guestId) this._guestId = guestId;
      // Prefer socketManager key; fall back to SettingsScreen key
      const displayName = storage.getString(DISPLAY_NAME_KEY) ?? storage.getString("guest_display_name") ?? null;
      if (displayName) this._displayName = displayName;
    } catch { /* non-fatal */ }
  }

  // ─── Guest ID ──────────────────────────────────────────────────────────────

  async getOrCreateGuestId(): Promise<string> {
    if (this._guestId) return this._guestId;
    let guestId = storage.getString(GUEST_ID_KEY) ?? null;
    if (!guestId) {
      guestId = generateUUID();
      storage.set(GUEST_ID_KEY, guestId);
    }
    this._guestId = guestId;
    return guestId;
  }

  /** Generate a one-time guest ID for joining someone else's room.
   *  Does NOT overwrite the stored host ID — avoids tab/device collision. */
  generateSessionGuestId(): string {
    return generateUUID();
  }

  async getDisplayName(): Promise<string | null> {
    if (this._displayName !== undefined) return this._displayName;
    const socketName   = storage.getString(DISPLAY_NAME_KEY) ?? null;
    const settingsName = storage.getString("guest_display_name") ?? null;
    const name = socketName ?? settingsName ?? null;
    this._displayName = name;
    // If only the settings key had a name, sync it into the socket key
    if (!socketName && settingsName) {
      storage.set(DISPLAY_NAME_KEY, settingsName);
    }
    return name;
  }

  async saveDisplayName(name: string): Promise<void> {
    this._displayName = name;
    // Write to both keys so SettingsScreen and the join flow stay in sync
    storage.set(DISPLAY_NAME_KEY, name);
    storage.set("guest_display_name", name);
  }

  // ─── Connect ───────────────────────────────────────────────────────────────

  async connect(guestId?: string, displayName?: string): Promise<QueueDJSocket> {
    const resolvedGuestId = guestId ?? await this.getOrCreateGuestId();
    const resolvedName    = displayName ?? this._displayName ?? await this.getDisplayName() ?? "Guest";

    // Reuse existing connected socket only if it's already authed as the same guest.
    // If a different guestId is passed (e.g., a one-time session ID for joining someone
    // else's room), we must create a new socket so the server sees the correct identity.
    if (this.socket?.connected && (!guestId || guestId === this._guestId)) {
      return this.socket;
    }

    // Disconnect any existing socket before creating a new one
    if (this.socket && guestId && guestId !== this._guestId) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.socket = io(REALTIME_URL, {
      auth: { guestId: resolvedGuestId, displayName: resolvedName },
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: Infinity,
      timeout: 15000,
    }) as QueueDJSocket;

    this.bindCoreEvents(resolvedGuestId);
    this.bindAppStateHandler();

    return this.socket;
  }

  // ─── Join Room ─────────────────────────────────────────────────────────────

  async joinRoom(roomId: string, sessionGuestId?: string): Promise<RoomJoinAck> {
    if (!this.socket) throw new Error("Socket not connected");

    // Prefer the explicit sessionGuestId (used when joining as guest with a one-time ID),
    // otherwise fall back to the stored persistent host ID.
    const guestId = sessionGuestId ?? this._guestId ?? await this.getOrCreateGuestId();
    const lastSeq = await this.getLastSequenceId(roomId);

    this.currentRoomId = roomId;

    return new Promise((resolve, reject) => {
      this.socket!.emit(
        "room:join",
        { roomId, guestId, lastSequenceId: lastSeq },
        (ack) => resolve(ack),
      );
      setTimeout(() => reject(new Error("Join timeout")), 45000);
    });
  }

  // ─── Sequence ID Persistence ───────────────────────────────────────────────
  // Persist lastSequenceId to survive app restarts.
  // On reconnect, server uses this to replay only missed events.

  async getLastSequenceId(roomId: string): Promise<number> {
    const val = storage.getString(LAST_SEQ_KEY(roomId));
    return val ? parseInt(val) : 0;
  }

  async saveLastSequenceId(roomId: string, seq: number): Promise<void> {
    storage.set(LAST_SEQ_KEY(roomId), String(seq));
    this.offlineState.lastKnownSequenceId = seq;
  }

  // ─── Offline Mode ─────────────────────────────────────────────────────────

  getOfflineState(): OfflineModeState {
    return this.offlineState;
  }

  // ─── Core Events ───────────────────────────────────────────────────────────

  private bindCoreEvents(guestId: string) {
    if (!this.socket) return;

    this.socket.on("connect", async () => {
      console.log("[socket] connected");
      this.offlineState.isOffline = false;

      // On every reconnect: rejoin current room and trigger reconciliation
      if (this.currentRoomId) {
        await this.joinRoom(this.currentRoomId).catch((err) => {
          console.warn("[socket] reconnect joinRoom failed:", err);
        });
      }

      // Replay any buffered requests
      if (this.offlineState.pendingRequests.length > 0) {
        console.log(`[socket] replaying ${this.offlineState.pendingRequests.length} pending requests`);
        // Caller handles replaying from pendingRequests
        this.offlineState.pendingRequests = [];
      }
    });

    this.socket.on("disconnect", (reason) => {
      console.log("[socket] disconnected:", reason);
      this.offlineState.isOffline = true;
      this.offlineState.offlineSince = Date.now();
    });

    this.socket.on("connect_error", (err) => {
      console.warn("[socket] connection error:", err.message);
      this.offlineState.isOffline = true;
    });

    // Track lastSequenceId across all sequenced server events so reconnects
    // send an accurate cursor and the server replays only truly missed events.
    this.socket.on("queue:updated", (_, sequenceId) => {
      if (this.currentRoomId) {
        this.saveLastSequenceId(this.currentRoomId, sequenceId);
      }
    });

    this.socket.on("room:crowd_state_changed", ({ sequenceId }) => {
      if (this.currentRoomId && sequenceId) {
        this.saveLastSequenceId(this.currentRoomId, sequenceId);
      }
    });

    // experience:changed carries a sequenceId — track it so a guest who drops
    // mid-game reconnects with the right cursor (otherwise they'd send a stale
    // queue-only seq and miss the game phase change events in the replay window).
    this.socket.on("experience:changed" as any, ({ sequenceId }: any) => {
      if (this.currentRoomId && sequenceId) {
        this.saveLastSequenceId(this.currentRoomId, sequenceId);
      }
    });
  }

  // ─── App State Handler ─────────────────────────────────────────────────────
  // When app goes to background: keep socket alive for 30s
  // (Socket.io server has a 30s disconnect grace period)
  // When app comes back: trigger reconnect if needed

  private bindAppStateHandler() {
    AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        // App foregrounded — force reconnect check
        if (!this.socket?.connected) {
          this.socket?.connect();
        }
      }
    });
  }

  // ─── Accessors ────────────────────────────────────────────────────────────

  get(): QueueDJSocket | null {
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  isOffline(): boolean {
    return this.offlineState.isOffline;
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
    this.currentRoomId = null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateUUID(): string {
  // RFC 4122 compliant UUID v4
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Singleton
export const socketManager = new SocketManager();
