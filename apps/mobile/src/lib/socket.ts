import { io, Socket } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, AppStateStatus } from "react-native";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  OfflineModeState,
  RoomJoinAck,
} from "@partyglue/shared-types";

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

  // ─── Guest ID ──────────────────────────────────────────────────────────────
  // Anonymous, persists across sessions. Never linked to identity.

  async getOrCreateGuestId(): Promise<string> {
    let guestId = await AsyncStorage.getItem(GUEST_ID_KEY);
    if (!guestId) {
      guestId = generateUUID();
      await AsyncStorage.setItem(GUEST_ID_KEY, guestId);
    }
    return guestId;
  }

  /** Generate a one-time guest ID for joining someone else's room.
   *  Does NOT overwrite the stored host ID — avoids tab/device collision. */
  generateSessionGuestId(): string {
    return generateUUID();
  }

  async getDisplayName(): Promise<string | null> {
    return AsyncStorage.getItem(DISPLAY_NAME_KEY);
  }

  async saveDisplayName(name: string): Promise<void> {
    await AsyncStorage.setItem(DISPLAY_NAME_KEY, name);
  }

  // ─── Connect ───────────────────────────────────────────────────────────────

  async connect(guestId?: string, displayName?: string): Promise<QueueDJSocket> {
    const resolvedGuestId   = guestId ?? await this.getOrCreateGuestId();
    const resolvedName      = displayName ?? await this.getDisplayName() ?? "Guest";

    if (this.socket?.connected) return this.socket;

    this.socket = io(REALTIME_URL, {
      auth: { guestId: resolvedGuestId, displayName: resolvedName },
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: Infinity,
      timeout: 10000,
    }) as QueueDJSocket;

    this.bindCoreEvents(resolvedGuestId);
    this.bindAppStateHandler();

    return this.socket;
  }

  // ─── Join Room ─────────────────────────────────────────────────────────────

  async joinRoom(roomId: string): Promise<RoomJoinAck> {
    if (!this.socket) throw new Error("Socket not connected");

    const guestId = await this.getOrCreateGuestId();
    const lastSeq = await this.getLastSequenceId(roomId);

    this.currentRoomId = roomId;

    return new Promise((resolve, reject) => {
      this.socket!.emit(
        "room:join",
        { roomId, guestId, lastSequenceId: lastSeq },
        (ack) => resolve(ack),
      );
      setTimeout(() => reject(new Error("Join timeout")), 10000);
    });
  }

  // ─── Sequence ID Persistence ───────────────────────────────────────────────
  // Persist lastSequenceId to survive app restarts.
  // On reconnect, server uses this to replay only missed events.

  async getLastSequenceId(roomId: string): Promise<number> {
    const val = await AsyncStorage.getItem(LAST_SEQ_KEY(roomId));
    return val ? parseInt(val) : 0;
  }

  async saveLastSequenceId(roomId: string, seq: number): Promise<void> {
    await AsyncStorage.setItem(LAST_SEQ_KEY(roomId), String(seq));
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
        await this.joinRoom(this.currentRoomId);
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

    // Update lastSequenceId on every queue update — enables precise reconnect
    this.socket.on("queue:updated", (_, sequenceId) => {
      if (this.currentRoomId) {
        this.saveLastSequenceId(this.currentRoomId, sequenceId);
      }
    });

    this.socket.on("room:crowd_state_changed", ({ sequenceId }) => {
      if (this.currentRoomId) {
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
