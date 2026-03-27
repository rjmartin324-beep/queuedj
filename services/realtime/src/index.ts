import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? "",
  environment: process.env.NODE_ENV ?? "development",
  enabled: !!process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
});

import { createServer } from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  QueueRequestPayload,
  DeckCommand,
  VibePreset,
  RoomRole,
} from "@queuedj/shared-types";
import { ROLE_PERMISSIONS } from "@queuedj/shared-types";
import {
  reconcile,
  storeEvent,
  getNextSequenceId,
  buildJoinAck,
  getRoomSnapshot,
} from "./rooms/stateReconciliation";
import {
  registerActiveRoom,
  unregisterActiveRoom,
  startPeriodicSnapshots,
  stopPeriodicSnapshots,
  snapshotAllActiveRooms,
} from "./rooms/snapshotService";
import {
  getMember,
  setMember,
  removeMember,
  getMemberRole,
  requirePermission,
  promoteMember,
  kickMember,
  getAllMembers,
  getMemberCount,
} from "./handlers/roles";
import { handleQueueRequest, handleQueueReorder, handleQueueRemove, handleVoteCast } from "./handlers/queue";
import { handleChatMessage, getChatHistory } from "./handlers/chat";
import { logTrackComplete } from "./lib/rlhf";
import { handleVibeCast, handleTapBeat, handlePollRespond } from "./handlers/vibe";
import { setCrowdState } from "./experiences/dj/vibe";
import { getExperience, isValidExperience } from "./experiences";
import { redisClient, redisSub, connectRedis } from "./redis";

// ─────────────────────────────────────────────────────────────────────────────
// Realtime Service — Socket.io with Redis Adapter
//
// Redis Adapter: Required from Day 1, even on single server.
// Why: When you add a second server instance (Phase 6), room events published
// on Server A automatically reach clients connected to Server B via Redis pub/sub.
// Without this, guests in the same room on different servers can't communicate.
//
// Rate Limiting: Per-socket event rate limits enforced here.
// Roles: Every mutating event checks permissions before processing.
// ─────────────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? "3002");
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

// ─── Rate Limiter (per socket) ────────────────────────────────────────────────

class SocketRateLimiter {
  private counts: Map<string, Map<string, number[]>> = new Map();

  check(socketId: string, event: string, maxPerWindow: number, windowMs: number): boolean {
    if (!this.counts.has(socketId)) this.counts.set(socketId, new Map());
    const socketCounts = this.counts.get(socketId)!;

    if (!socketCounts.has(event)) socketCounts.set(event, []);
    const timestamps = socketCounts.get(event)!;

    const now = Date.now();
    const windowStart = now - windowMs;
    const recent = timestamps.filter((t) => t > windowStart);
    socketCounts.set(event, recent);

    if (recent.length >= maxPerWindow) return false;

    recent.push(now);
    return true;
  }

  clear(socketId: string): void {
    this.counts.delete(socketId);
  }
}

const rateLimiter = new SocketRateLimiter();

// ─── Profanity Filter ─────────────────────────────────────────────────────────
// Word-boundary regex list. Extend BLOCKED_WORDS to add more terms.
// Words are replaced with *** to keep the message length predictable.

const BLOCKED_WORDS = [
  "fuck", "shit", "cunt", "nigger", "nigga", "faggot", "fag",
  "bitch", "asshole", "bastard", "cock", "dick", "pussy", "whore",
  "slut", "kike", "spic", "chink", "retard",
];

const PROFANITY_RE = new RegExp(
  `\\b(${BLOCKED_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
  "gi",
);

function filterProfanity(text: string): string {
  return text.replace(PROFANITY_RE, (match) => "*".repeat(match.length));
}

const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  "queue:request":     { max: 10,  windowMs: 60_000 },  // 10/min
  "vote:cast":         { max: 60,  windowMs: 60_000 },  // 1/sec
  "tap:beat":          { max: 120, windowMs: 60_000 },  // 2/sec
  "shoutout:send":     { max: 5,   windowMs: 60_000 },  // 5/min
  "chat:message":      { max: 20,  windowMs: 60_000 },  // 20/min (~1 per 3s)
  "deck:command":      { max: 300, windowMs: 60_000 },  // 5/sec (host only)
  "experience:action": { max: 300, windowMs: 60_000 },  // 5/sec (game actions)
};

// ─── Server Setup ─────────────────────────────────────────────────────────────

async function main() {
  // Connect Redis clients before anything else
  await connectRedis();

  const httpServer = createServer();

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : "*",
      methods: ["GET", "POST"],
    },
    // Tune for mobile clients: longer ping intervals, generous timeout for cold starts
    pingInterval: 25_000,
    pingTimeout: 20_000,
    transports: ["websocket", "polling"],
  });

  // ─── Redis Adapter (critical — enables multi-server scaling) ───────────────
  const pubClient = createClient({ url: REDIS_URL });
  const subClient = pubClient.duplicate();
  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));

  // ─── Crash Recovery: periodic snapshots to PostgreSQL ────────────────────
  startPeriodicSnapshots();

  // ─── Room Closed Pub/Sub (from API service via Redis publish) ────────────
  redisSub.subscribe("room:closed", (message) => {
    try {
      const { roomId } = JSON.parse(message);
      if (roomId) {
        io.to(roomId).emit("room:closed" as any, { roomId });
      }
    } catch { /* malformed message */ }
  });

  // ─── Connection Handler ────────────────────────────────────────────────────

  /** Strip HTML tags and limit length — used for any user-supplied strings */
  function sanitizeString(value: unknown, maxLen = 64): string {
    if (typeof value !== "string") return "";
    return value.replace(/<[^>]*>/g, "").replace(/[^\w\s\-'.!?,]/g, "").trim().slice(0, maxLen);
  }

  io.on("connection", (socket) => {
    const rawGuestId      = socket.handshake.auth?.guestId     as string | undefined;
    const rawDisplayName  = socket.handshake.auth?.displayName as string | undefined;
    const socketGuestId   = rawGuestId   ? sanitizeString(rawGuestId, 64) : undefined;
    const socketDisplayName = rawDisplayName ? sanitizeString(rawDisplayName, 24) : undefined;

    // ─── room:join ───────────────────────────────────────────────────────────
    socket.on("room:join", async ({ roomId, guestId, lastSequenceId }, ack) => {
      try {
        // Validate: guestId must match socket auth or be new guest
        const resolvedGuestId = socketGuestId ?? guestId;

        // Determine role
        let role: RoomRole = "GUEST";
        const existing = await getMember(roomId, resolvedGuestId);

        if (existing) {
          // Reconnecting member — keep their role
          role = existing.role;
        } else {
          // New member — check if room exists
          const snapshot = await getRoomSnapshot(roomId);
          if (!snapshot) {
            return ack(buildJoinAck({
              success: false,
              role: "GUEST",
              guestId: resolvedGuestId,
              currentSequenceId: 0,
              guestLastSequenceId: lastSequenceId,
              error: "ROOM_NOT_FOUND",
            }));
          }
          // If this guestId created the room, they are the HOST
          role = snapshot.room.hostGuestId === resolvedGuestId ? "HOST" : "GUEST";
          await setMember(roomId, {
            guestId: resolvedGuestId,
            role,
            displayName: socketDisplayName,
            joinedAt: Date.now(),
            isWorkerNode: false,
          });
        }

        // Join the Socket.io room (scopes broadcasts)
        await socket.join(roomId);
        // Also join a personal room so credits:awarded reaches this guest directly
        await socket.join(`guest:${resolvedGuestId}`);
        await registerActiveRoom(roomId);

        // Record daily activity for streak-at-risk push reminders (49h TTL covers today + tomorrow job run)
        const activityKey = `guest:active:${new Date().toISOString().slice(0, 10)}`;
        redisClient.sAdd(activityKey, resolvedGuestId).then(() =>
          redisClient.expire(activityKey, 49 * 60 * 60),
        ).catch(() => {/* non-critical */});

        // Associate socket with guestId in Redis for disconnect cleanup
        await redisClient.set(`socket:${socket.id}`, JSON.stringify({ roomId, guestId: resolvedGuestId }));

        // Determine what sync is needed
        const { strategy, snapshot, events, currentSequenceId } = await reconcile(roomId, lastSequenceId);

        const joinAck = buildJoinAck({
          success: true,
          role,
          guestId: resolvedGuestId,
          currentSequenceId,
          guestLastSequenceId: lastSequenceId,
        });

        ack(joinAck);

        // Send sync data after ack
        if (strategy === "full_snapshot" && snapshot) {
          socket.emit("room:state_snapshot", snapshot);
        } else if (strategy === "event_replay" && events) {
          socket.emit("room:event_replay", events);
        }
        // strategy === "already_current": no sync needed

        // ── Restore active experience state for reconnecting guests ──────────
        // The snapshot/event_replay covers queue + members, but NOT which game
        // is active or what phase it's in. Without this, a guest who drops
        // mid-game rejoins to the wrong screen and must wait for the next
        // server-pushed state event (which may never come).
        try {
          const activeExp = await redisClient.get(`room:${roomId}:experience`);
          const expType   = (activeExp && isValidExperience(activeExp)) ? activeExp : "dj";
          const view      = await getExperience(expType).getGuestViewDescriptor(roomId);
          socket.emit("experience:state" as any, {
            experienceType: expType,
            state: null,   // view.data carries the phase; full state only needed by host controls
            view,
          });
        } catch { /* non-critical — best effort; client will sync on next state push */ }

        // Notify room of new member (excluding push token — private)
        const { pushToken, ...publicMember } = { ...existing, role, guestId: resolvedGuestId, joinedAt: Date.now(), isWorkerNode: false, pushToken: existing?.pushToken };
        socket.to(roomId).emit("room:member_joined", {
          ...publicMember,
          roomId,
        });

        // Walk-in anthem — emit to host if guest has one set
        const memberRecord = await getMember(roomId, resolvedGuestId);
        if (memberRecord?.walkInAnthemIsrc && role === "GUEST") {
          io.to(`host:${roomId}`).emit("room:walk_in_anthem" as any, {
            guestId: resolvedGuestId,
            displayName: memberRecord.displayName ?? "Guest",
            isrc: memberRecord.walkInAnthemIsrc,
          });
        }

      } catch (err) {
        console.error("[room:join] error", err);
        socket.emit("error", { code: "ROOM_NOT_FOUND", message: "Failed to join room" });
      }
    });

    // ─── room:leave ──────────────────────────────────────────────────────────
    socket.on("room:leave", async ({ roomId, guestId }) => {
      await handleDisconnect(socket, io, roomId, guestId);
    });

    // ─── queue:request ───────────────────────────────────────────────────────
    socket.on("queue:request", async (payload: QueueRequestPayload, ack) => {
      if (!checkRate(socket, "queue:request")) return ack({ accepted: false });

      const { allowed } = await requirePermission(payload.roomId, payload.guestId, "canRequestTrack");
      if (!allowed) return ack({ accepted: false });

      const result = await handleQueueRequest(payload, io);
      ack(result);
    });

    // ─── queue:reorder ───────────────────────────────────────────────────────
    socket.on("queue:reorder", async ({ roomId, itemId, newPosition }) => {
      const guestId = socketGuestId!;
      const { allowed } = await requirePermission(roomId, guestId, "canReorderQueue");
      if (!allowed) {
        socket.emit("error", { code: "UNAUTHORIZED", message: "Cannot reorder queue" });
        return;
      }
      await handleQueueReorder(roomId, itemId, newPosition, io);
    });

    // ─── queue:remove ────────────────────────────────────────────────────────
    socket.on("queue:remove", async ({ roomId, itemId }) => {
      const guestId = socketGuestId!;
      const { allowed } = await requirePermission(roomId, guestId, "canRemoveFromQueue");
      if (!allowed) {
        socket.emit("error", { code: "UNAUTHORIZED", message: "Cannot remove from queue" });
        return;
      }
      await handleQueueRemove(roomId, itemId, io);
    });

    // ─── vote:cast ───────────────────────────────────────────────────────────
    socket.on("vote:cast", async (payload) => {
      if (!checkRate(socket, "vote:cast")) return;
      const { allowed } = await requirePermission(payload.roomId, payload.guestId, "canVote");
      if (!allowed) return;
      await handleVoteCast(payload.roomId, payload.targetItemId, payload.vote, io, payload.guestId);
    });

    // ─── poll:respond ────────────────────────────────────────────────────────
    socket.on("poll:respond", async (payload) => {
      await handlePollRespond(payload, io);
    });

    // ─── tap:beat (Tap-to-Sync) ──────────────────────────────────────────────
    socket.on("tap:beat", async (payload) => {
      if (!checkRate(socket, "tap:beat")) return;
      await handleTapBeat(payload, io);
    });

    // ─── shoutout:send ───────────────────────────────────────────────────────
    socket.on("shoutout:send", async ({ roomId, guestId, message }) => {
      if (!checkRate(socket, "shoutout:send")) return;

      // Check mute status — muted guests' messages are silently dropped
      const senderId = guestId ?? socketGuestId;
      if (senderId) {
        const muted = await redisClient.sIsMember(`room:${roomId}:muted`, senderId);
        if (muted) return;
      }

      // Sanitize message — strip HTML, enforce max length
      let sanitized = message.replace(/<[^>]*>/g, "").slice(0, 100).trim();

      // Profanity filter — replace blocked words with ***
      sanitized = filterProfanity(sanitized);
      if (!sanitized) return;

      io.to(roomId).emit("shoutout:received", { message: sanitized, guestId: senderId });
    });

    // ─── chat:message ────────────────────────────────────────────────────────
    socket.on("chat:message" as any, async ({ roomId, guestId, displayName, text }: any) => {
      if (!checkRate(socket, "chat:message")) return;

      // Check mute status
      const senderId = guestId ?? socketGuestId;
      if (senderId) {
        const muted = await redisClient.sIsMember(`room:${roomId}:muted`, senderId);
        if (muted) return;
      }

      // Sanitize
      const cleanText = filterProfanity(
        String(text ?? "").replace(/<[^>]*>/g, "").trim().slice(0, 200)
      );
      if (!cleanText) return;

      const cleanName = sanitizeString(displayName ?? socketDisplayName ?? "Guest", 24);

      await handleChatMessage({
        roomId,
        guestId: senderId ?? "unknown",
        displayName: cleanName,
        text: cleanText,
      }, io);
    });

    // ─── chat:history ─────────────────────────────────────────────────────────
    socket.on("chat:history" as any, async ({ roomId }: { roomId: string }, ack: any) => {
      const history = await getChatHistory(roomId);
      if (typeof ack === "function") ack(history);
    });

    // ─── guest:mute (HOST/CO_HOST) ────────────────────────────────────────────
    socket.on("guest:mute" as any, async ({ roomId, targetGuestId, muted }: { roomId: string; targetGuestId: string; muted: boolean }) => {
      const guestId = socketGuestId!;
      const { allowed } = await requirePermission(roomId, guestId, "canKickGuest");
      if (!allowed) {
        socket.emit("error", { code: "UNAUTHORIZED", message: "Only host or co-host can mute guests" });
        return;
      }
      if (muted) {
        await redisClient.sAdd(`room:${roomId}:muted`, targetGuestId);
      } else {
        await redisClient.sRem(`room:${roomId}:muted`, targetGuestId);
      }
      // Notify host/co-hosts only
      socket.emit("guest:mute_ack" as any, { targetGuestId, muted });
    });

    // ─── guest:report (any member) ───────────────────────────────────────────
    socket.on("guest:report" as any, async ({ roomId, targetGuestId, reason }: { roomId: string; targetGuestId: string; reason?: string }) => {
      const reporterId = socketGuestId;
      if (!reporterId) return;
      // Persist report for host review
      const report = { reporterId, targetGuestId, reason: reason ?? "", ts: Date.now() };
      await redisClient.lPush(`room:${roomId}:reports`, JSON.stringify(report));
      await redisClient.lTrim(`room:${roomId}:reports`, 0, 99); // keep last 100
      // Notify host sockets in the room
      socket.to(`host:${roomId}`).emit("guest:reported" as any, report);
    });

    // ─── deck:command (HOST only) ────────────────────────────────────────────
    socket.on("deck:command", async (payload: DeckCommand) => {
      if (!checkRate(socket, "deck:command")) return;
      const { allowed } = await requirePermission(payload.roomId, payload.guestId, "canPlay");
      if (!allowed) {
        socket.emit("error", { code: "UNAUTHORIZED", message: "Only the host can control decks" });
        return;
      }
      // Forward to mobile host client — deck commands are processed on the host device
      // (The host's Superpowered instance is the audio engine, not the server)
      socket.to(`host:${payload.roomId}`).emit("deck:state_updated", payload as any);
    });

    // ─── vibe:set (HOST/CO_HOST) ─────────────────────────────────────────────
    socket.on("vibe:set", async ({ roomId, preset }) => {
      const guestId = socketGuestId!;
      const { allowed } = await requirePermission(roomId, guestId, "canSetVibe");
      if (!allowed) return;
      await handleVibeCast(roomId, preset, io);
    });

    // ─── crowd_state:set (HOST/CO_HOST) ──────────────────────────────────────
    socket.on("crowd_state:set" as any, async ({ roomId, crowdState }: { roomId: string; crowdState: string }) => {
      const guestId = socketGuestId!;
      const { allowed } = await requirePermission(roomId, guestId, "canSetVibe");
      if (!allowed) return;
      await setCrowdState(roomId, crowdState as any, io);
    });

    // ─── bathroom:toggle (HOST only) ─────────────────────────────────────────
    socket.on("bathroom:toggle", async ({ roomId, active }) => {
      const guestId = socketGuestId!;
      const { allowed } = await requirePermission(roomId, guestId, "canAccessBathroomBreak");
      if (!allowed) return;

      const seq = await getNextSequenceId(roomId);
      const event = { sequenceId: seq, type: "bathroom_toggle", payload: { active }, timestamp: Date.now() };
      await storeEvent(roomId, event);
      io.to(roomId).emit("room:crowd_state_changed", { crowdState: active ? "RECOVERY" : "RISING", sequenceId: seq });
    });

    // ─── guest:promote (HOST only) ───────────────────────────────────────────
    socket.on("guest:promote", async ({ roomId, targetGuestId, newRole }) => {
      const guestId = socketGuestId!;
      const result = await promoteMember(roomId, guestId, targetGuestId, newRole);
      if (!result.success) {
        socket.emit("error", { code: "UNAUTHORIZED", message: result.error! });
      }
    });

    // ─── experience:switch (HOST only) ──────────────────────────────────
    // Host switches between DJ, Trivia, Poll, etc.
    // All connected guests auto-switch to the new experience's view.
    socket.on("experience:switch" as any, async ({ roomId, toExperience, options }: any) => {
      const guestId = socketGuestId!;
      const { allowed } = await requirePermission(roomId, guestId, "canSetVibe"); // HOST/CO_HOST
      if (!allowed) return;

      if (!isValidExperience(toExperience)) {
        socket.emit("error", { code: "ROOM_NOT_FOUND", message: `Unknown experience: ${toExperience}` });
        return;
      }

      // Deactivate current experience
      const currentRaw = await redisClient.get(`room:${roomId}:experience`);
      if (currentRaw && isValidExperience(currentRaw)) {
        await getExperience(currentRaw).onDeactivate(roomId);
      }

      // Activate new experience
      const newExperience = getExperience(toExperience);
      await newExperience.onActivate(roomId, guestId, options);
      await redisClient.set(`room:${roomId}:experience`, toExperience);

      const view = await newExperience.getGuestViewDescriptor(roomId);
      const seq = await getNextSequenceId(roomId);

      io.to(roomId).emit("experience:changed" as any, {
        experienceType: toExperience,
        view,
        sequenceId: seq,
      });
    });

    // ─── experience:action (any member) ─────────────────────────────────
    // Single event handles all actions for all experiences.
    // The experience module routes by action name.
    socket.on("experience:action" as any, async ({ roomId, guestId, action, payload }: any) => {
      if (!checkRate(socket, "experience:action")) return;

      const role = await getMemberRole(roomId, guestId ?? socketGuestId);
      if (!role) return;

      const experienceType = await redisClient.get(`room:${roomId}:experience`) ?? "dj";
      if (!isValidExperience(experienceType)) return;

      const experience = getExperience(experienceType);
      await experience.handleAction({ action, payload, roomId, guestId: guestId ?? socketGuestId!, role, io });
    });

    // ─── guest:kick (HOST only) ──────────────────────────────────────────────
    socket.on("guest:kick", async ({ roomId, targetGuestId }) => {
      const guestId = socketGuestId!;
      const result = await kickMember(roomId, guestId, targetGuestId);
      if (result.success) {
        // Force disconnect the kicked guest's socket
        const kickedSockets = await io.in(roomId).fetchSockets();
        for (const s of kickedSockets) {
          if (s.handshake.auth?.guestId === targetGuestId) {
            s.emit("error", { code: "UNAUTHORIZED", message: "You have been removed from this room" });
            s.disconnect();
          }
        }
      }
    });

    // ─── guest:set_anthem ────────────────────────────────────────────────────
    socket.on("guest:set_anthem" as any, async ({ roomId, isrc }: { roomId: string; isrc: string | null }) => {
      const guestId = socketGuestId;
      if (!guestId) return;
      const member = await getMember(roomId, guestId);
      if (!member) return;
      await setMember(roomId, { ...member, walkInAnthemIsrc: isrc ?? undefined });
    });

    // ─── room:setting ────────────────────────────────────────────────────────
    // HOST or CO_HOST can change room settings at runtime.
    // Settings are stored in Redis and broadcast to all room members.
    socket.on("room:setting" as any, async ({ roomId, key, value }: { roomId: string; key: string; value: unknown }) => {
      const guestId = socketGuestId;
      if (!guestId) return;
      const { allowed } = await requirePermission(roomId, guestId, "canSetVibe");
      if (!allowed) return;

      const ALLOWED_KEYS = new Set([
        "requestsLocked", "votingEnabled", "showQueueToGuests",
        "allowLateJoin", "maxGuests", "bpm_override",
      ]);
      if (!ALLOWED_KEYS.has(key)) return;

      // Persist setting in Redis
      await redisClient.hSet(`room:${roomId}:settings`, String(key), JSON.stringify(value));

      // Broadcast to all room members
      io.to(roomId).emit("room:setting_changed" as any, { key, value });
    });

    // ─── deck:track_played ───────────────────────────────────────────────────
    // Host emits when a track starts playing — records to session_tracks
    socket.on("deck:track_played" as any, async ({ roomId, isrc, title, artist, requestCount, voteCount }: {
      roomId: string; isrc: string; title: string; artist: string;
      requestCount?: number; voteCount?: number;
    }) => {
      const guestId = socketGuestId;
      if (!guestId) return;
      const { allowed } = await requirePermission(roomId, guestId, "canPlay");
      if (!allowed) return;
      // Fire-and-forget to API service to persist session track
      fetch(`${process.env.API_URL ?? "http://localhost:3001"}/sessions/${roomId}/tracks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isrc, title, artist, requestCount: requestCount ?? 0, voteCount: voteCount ?? 0 }),
      }).catch(() => {});

      // Log RLHF track_complete signal — track played = strong positive feedback
      const djRaw = await redisClient.get(`experience:dj:${roomId}`);
      const crowdState = djRaw ? JSON.parse(djRaw).crowdState : undefined;
      logTrackComplete(roomId, isrc, crowdState);
    });

    // ─── disconnect ──────────────────────────────────────────────────────────
    socket.on("disconnect", async () => {
      rateLimiter.clear(socket.id);
      const raw = await redisClient.get(`socket:${socket.id}`);
      if (raw) {
        const { roomId, guestId } = JSON.parse(raw);
        await redisClient.del(`socket:${socket.id}`);
        await handleDisconnect(socket, io, roomId, guestId);
      }
    });
  });

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function checkRate(socket: any, event: string): boolean {
    const limit = RATE_LIMITS[event];
    if (!limit) return true;
    const allowed = rateLimiter.check(socket.id, event, limit.max, limit.windowMs);
    if (!allowed) {
      socket.emit("error", { code: "RATE_LIMITED", message: `Too many ${event} events` });
    }
    return allowed;
  }

  async function handleDisconnect(socket: any, io: Server, roomId: string, guestId: string) {
    await socket.leave(roomId);
    const member = await getMember(roomId, guestId);
    if (member) {
      // Keep member record in Redis for reconnect — don't delete immediately
      // If they don't reconnect within 30s, clean up
      setTimeout(async () => {
        const stillConnected = await redisClient.exists(`socket:${socket.id}`);
        if (!stillConnected) {
          await removeMember(roomId, guestId);
          io.to(roomId).emit("room:member_left", { guestId, roomId });
        }
      }, 30_000);
    }
  }

  // ─── Health Endpoint ──────────────────────────────────────────────────────
  httpServer.on("request", (req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", timestamp: Date.now() }));
    }
  });

  httpServer.listen(PORT, () => {
    console.log(`[realtime] Socket.io server listening on :${PORT}`);
    console.log(`[realtime] Redis adapter connected — multi-server ready`);
  });

  // ─── Graceful shutdown — snapshot all rooms before exit ──────────────────
  async function shutdown(signal: string) {
    console.log(`[realtime] ${signal} received — snapshotting all rooms before exit`);
    stopPeriodicSnapshots();
    await snapshotAllActiveRooms();
    process.exit(0);
  }
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("[realtime] Fatal startup error", err);
  process.exit(1);
});
