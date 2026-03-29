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
import { awardCreditsAndNotify, incrementSessionStat } from "./lib/credits";
import { setCrowdState } from "./experiences/dj/vibe";
import { getExperience, isValidExperience } from "./experiences";
import { redisClient, redisSub, connectRedis } from "./redis";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers

/** Resolves to null instead of rejecting if the promise takes longer than `ms`. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

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

// ─── Per-guest request cooldown ───────────────────────────────────────────────
// Keyed by `roomId:guestId`. Survives reconnections (socket.id changes, guestId
// doesn't). Entries older than GUEST_REQUEST_COOLDOWN_MS are stale but harmless —
// they'll be overwritten on the next accepted request.
const GUEST_REQUEST_COOLDOWN_MS = 30_000; // 30 s between track requests per guest
const guestLastRequest: Map<string, number> = new Map();

/** Returns remaining cooldown ms (0 = allowed, >0 = blocked) */
function guestRequestCooldownMs(roomId: string, guestId: string): number {
  const key = `${roomId}:${guestId}`;
  const last = guestLastRequest.get(key);
  if (last === undefined) return 0;
  const elapsed = Date.now() - last;
  return elapsed < GUEST_REQUEST_COOLDOWN_MS ? GUEST_REQUEST_COOLDOWN_MS - elapsed : 0;
}

function consumeGuestRequestCooldown(roomId: string, guestId: string): void {
  guestLastRequest.set(`${roomId}:${guestId}`, Date.now());
}

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
      origin: process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(",")
        : (_origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => cb(null, true),
      methods: ["GET", "POST"],
      credentials: true,
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
        unregisterActiveRoom(roomId).catch(() => {});
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
          // Reconnecting member — keep their role, refresh joinedAt so the
          // disconnect cleanup timer can detect the reconnect via timestamp comparison.
          role = existing.role;
          await setMember(roomId, { ...existing, joinedAt: Date.now() });
        } else {
          // New member — check if room exists (3s timeout guards against Redis hangs)
          const snapshot = await withTimeout(getRoomSnapshot(roomId), 3000);
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
        // Host joins a host-specific room so deck:state_updated, walk_in_anthem,
        // and guest:reported events (targeted at host:${roomId}) are received
        if (role === "HOST") {
          await socket.join(`host:${roomId}`);
        }
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

        // ── Fetch bootstrap data BEFORE ack so it arrives in-band ────────────
        // All of this is available from Redis — no PostgreSQL required.
        // Bundling it into the ack eliminates the join-time race condition where
        // room:state_snapshot and experience:state arrive before React commits.
        let bootstrapMembers = await getAllMembers(roomId).catch(() => [] as any[]);

        // Seed the host into the realtime members set if they haven't joined via
        // socket yet (e.g. the API created the room but the host's socket is still
        // connecting). Without this, guests see memberCount = 0 on first join.
        if (bootstrapMembers.length === 0 || !bootstrapMembers.find((m: any) => m.role === "HOST")) {
          const roomMeta = await redisClient.get(`room:${roomId}:meta`);
          if (roomMeta) {
            try {
              const roomObj = JSON.parse(roomMeta);
              if (roomObj.hostGuestId && !bootstrapMembers.find((m: any) => m.guestId === roomObj.hostGuestId)) {
                const hostSeed = { guestId: roomObj.hostGuestId, role: "HOST" as const, joinedAt: roomObj.createdAt ?? Date.now(), isWorkerNode: false };
                await setMember(roomId, hostSeed);
                bootstrapMembers = await getAllMembers(roomId).catch(() => bootstrapMembers);
              }
            } catch { /* non-critical */ }
          }
        }
        let bootstrapExpType = "dj";
        let bootstrapView: any = null;
        let bootstrapAwaitingReady = false;
        let bootstrapReadyCount = 0;
        let bootstrapReadyTotalCount = 0;
        let bootstrapState: unknown = null;
        try {
          const activeExp = await redisClient.get(`room:${roomId}:experience`);
          bootstrapExpType = (activeExp && isValidExperience(activeExp)) ? activeExp : "dj";
          const bootstrapExp = getExperience(bootstrapExpType);
          bootstrapView = await bootstrapExp.getGuestViewDescriptor(roomId);
          // Get bootstrap state first so we can check if the game is actively running.
          // ready_set is deleted when the game starts, so sCard returns 0 for running games —
          // without this check every reconnecting guest would see awaitingReady=true mid-game.
          bootstrapState = bootstrapExp.getBootstrapState
            ? await bootstrapExp.getBootstrapState(roomId)
            : null;
          if (bootstrapExpType !== "dj") {
            const bs = bootstrapState as any;
            const gameIsRunning = bs?.phase && bs.phase !== "waiting";
            if (!gameIsRunning) {
              bootstrapReadyTotalCount = bootstrapMembers.filter((m: any) => m.role === "GUEST").length;
              bootstrapReadyCount = await redisClient.sCard(`room:${roomId}:ready_set`);
              bootstrapAwaitingReady = bootstrapReadyTotalCount > 0 && bootstrapReadyCount < bootstrapReadyTotalCount;
            }
          }
        } catch { /* non-critical */ }

        const joinAck = buildJoinAck({
          success: true,
          role,
          guestId: resolvedGuestId,
          currentSequenceId,
          guestLastSequenceId: lastSequenceId,
          members: bootstrapMembers.map(({ pushToken: _pt, ...m }: any) => m),
          experienceType: bootstrapExpType,
          guestView: bootstrapView?.type ?? "dj_queue",
          awaitingReady: bootstrapAwaitingReady,
          readyCount: bootstrapReadyCount,
          readyTotalCount: bootstrapReadyTotalCount,
        });

        console.log(`[room:join] ack for ${resolvedGuestId}: members=${bootstrapMembers.length} exp=${bootstrapExpType} awaitingReady=${bootstrapAwaitingReady}`);
        ack(joinAck);

        // Send sync data after ack (still sent as belt-and-suspenders for reconnects)
        if (strategy === "full_snapshot" && snapshot) {
          socket.emit("room:state_snapshot", snapshot);
        } else if (strategy === "event_replay" && events) {
          socket.emit("room:event_replay", events);
        }
        // strategy === "already_current": no sync needed

        // Still emit experience:state so reconnecting guests get the full view + state
        try {
          socket.emit("experience:state" as any, {
            experienceType: bootstrapExpType,
            state: bootstrapState,
            view: bootstrapView,
            awaitingReady: bootstrapAwaitingReady,
            readyCount: bootstrapReadyCount,
            readyTotalCount: bootstrapReadyTotalCount,
          });

          // Auto-resume timer-based games if the server restarted mid-round.
          // Only the host triggers this to avoid multiple timers from multiple reconnects.
          if (role === "HOST") {
            const experience = getExperience(bootstrapExpType);
            if (experience.handleAction) {
              const bs = bootstrapState as any;
              if (bs?.phase === "question" || bs?.phase === "reveal" || bs?.phase === "drawing") {
                experience.handleAction({
                  action: "resume",
                  payload: {},
                  roomId,
                  guestId: resolvedGuestId,
                  role: "HOST",
                  io,
                }).catch(() => {});
              }
            }
          }
        } catch { /* non-critical */ }

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
        ack(buildJoinAck({
          success: false,
          role: "GUEST",
          guestId: socketGuestId ?? guestId ?? "unknown",
          currentSequenceId: 0,
          guestLastSequenceId: lastSequenceId,
          error: "SERVER_ERROR",
        }));
      }
    });

    // ─── room:request_sync ───────────────────────────────────────────────────
    // Client emits this after React has committed and handlers are registered,
    // guaranteeing the snapshot and experience state are received.
    socket.on("room:request_sync" as any, async ({ roomId }: { roomId: string }) => {
      // Step 1: members — fetch from Redis directly (never null, no PostgreSQL dependency)
      try {
        const allMembers = await getAllMembers(roomId);
        socket.emit("room:members_sync" as any, { members: allMembers });
      } catch (err) {
        console.warn("[room:request_sync] members error", err);
      }
      // Step 2: experience state — separate try so members always arrive even if this fails
      try {
        const allMembers = await getAllMembers(roomId);
        const activeExp = await redisClient.get(`room:${roomId}:experience`);
        const expType = (activeExp && isValidExperience(activeExp)) ? activeExp : "dj";
        const expModule = getExperience(expType);
        const view = await expModule.getGuestViewDescriptor(roomId);
        const isGame = expType !== "dj";
        let awaitingReady = false, readyCount = 0, readyTotalCount = 0;
        const syncState = expModule.getBootstrapState ? await expModule.getBootstrapState(roomId) : null;
        if (isGame) {
          const phase = (syncState as any)?.phase;
          const gameIsRunning = phase && phase !== "waiting";
          if (!gameIsRunning) {
            readyTotalCount = allMembers.filter(m => m.role === "GUEST").length;
            readyCount = await redisClient.sCard(`room:${roomId}:ready_set`);
            awaitingReady = readyTotalCount > 0 && readyCount < readyTotalCount;
          }
        }
        socket.emit("experience:state" as any, { experienceType: expType, state: syncState, view, awaitingReady, readyCount, readyTotalCount });
      } catch (err) {
        console.warn("[room:request_sync] experience error", err);
      }
    });

    // ─── room:leave ──────────────────────────────────────────────────────────
    socket.on("room:leave", async ({ roomId, guestId }) => {
      await handleDisconnect(socket, io, roomId, guestId);
    });

    // ─── queue:request ───────────────────────────────────────────────────────
    socket.on("queue:request", async (payload: QueueRequestPayload, ack) => {
      if (!checkRate(socket, "queue:request")) return ack({ accepted: false, error: "RATE_LIMITED" });

      const remainingMs = guestRequestCooldownMs(payload.roomId, payload.guestId);
      if (remainingMs > 0) {
        return ack({ accepted: false, error: `COOLDOWN:${Math.ceil(remainingMs / 1000)}` });
      }

      const { allowed } = await requirePermission(payload.roomId, payload.guestId, "canRequestTrack");
      if (!allowed) return ack({ accepted: false, error: "UNAUTHORIZED" });

      const result = await handleQueueRequest(payload, io);
      ack(result);
      if (result.accepted) {
        consumeGuestRequestCooldown(payload.roomId, payload.guestId);
        awardCreditsAndNotify(io, payload.guestId, "track_request", payload.roomId).catch(() => {});
        incrementSessionStat(payload.roomId, payload.guestId, "requests").catch(() => {});
      }
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
      awardCreditsAndNotify(io, payload.guestId, "vote_cast", payload.roomId).catch(() => {});
      incrementSessionStat(payload.roomId, payload.guestId, "votes").catch(() => {});
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
      // Route through the current experience so it can update its own state
      // (e.g. isBathroomBreak in DJ state) and emit experience:state in one place.
      const expType = (await redisClient.get(`room:${roomId}:experience`)) ?? "dj";
      if (isValidExperience(expType)) {
        await getExperience(expType).handleAction({ action: "bathroom:toggle", payload: { active }, roomId, guestId, role: "HOST", io });
      }
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

      // Activate new experience — clear any pending play-again votes from the previous game
      await redisClient.del(`vote_play_again:${roomId}`);
      const newExperience = getExperience(toExperience);
      await newExperience.onActivate(roomId, guestId, options);
      await redisClient.set(`room:${roomId}:experience`, toExperience);

      // Reset ready-up state whenever experience changes
      await redisClient.del(`room:${roomId}:ready_set`);
      const isGame = toExperience !== "dj";
      const allMembersForReady = isGame ? await getAllMembers(roomId) : [];
      const readyTotalCount = allMembersForReady.filter(m => m.role === "GUEST").length;

      const view = await newExperience.getGuestViewDescriptor(roomId);
      const seq = await getNextSequenceId(roomId);

      io.to(roomId).emit("experience:changed" as any, {
        experienceType: toExperience,
        view,
        sequenceId: seq,
        awaitingReady: isGame,
        readyCount: 0,
        readyTotalCount,
      });
    });

    // ─── room:ready_up (GUEST only) ──────────────────────────────────────────
    socket.on("room:ready_up" as any, async ({ roomId }: { roomId: string }) => {
      try {
      const guestId = socketGuestId;
      if (!guestId) { console.warn("[ready_up] no guestId on socket"); return; }

      const role = await getMemberRole(roomId, guestId);
      if (!role || role === "HOST" || role === "CO_HOST") {
        console.warn("[ready_up] blocked: role =", role, "guestId =", guestId, "roomId =", roomId);
        return;
      }

      const experienceType = await redisClient.get(`room:${roomId}:experience`) ?? "dj";
      if (experienceType === "dj" || !isValidExperience(experienceType)) return;

      const READY_KEY = `room:${roomId}:ready_set`;
      await redisClient.sAdd(READY_KEY, guestId);
      await redisClient.expire(READY_KEY, 3600);

      const allMembers = await getAllMembers(roomId);
      const guestMembers = allMembers.filter(m => m.role === "GUEST");
      const readyCount = await redisClient.sCard(READY_KEY);
      const totalCount = guestMembers.length;

      io.to(roomId).emit("room:ready_update" as any, { readyCount, totalCount });

      // Auto-start when all guests are ready
      if (readyCount >= totalCount && totalCount > 0) {
        await redisClient.del(READY_KEY);
        io.to(roomId).emit("room:all_ready" as any, {});

        const experience = getExperience(experienceType);
        let action = "start";
        let payload: Record<string, unknown> = {};
        const allGuestIds = guestMembers.map(m => m.guestId);

        if (experienceType === "trivia") {
          action = "start_round";
        } else if (experienceType === "draw_it" || experienceType === "mimic_me" ||
                   experienceType === "would_you_rather" || experienceType === "never_have_i_ever") {
          payload = { guestIds: allGuestIds };
        } else if (experienceType === "mind_mole") {
          action = "start_game";
          payload = {
            playerIds: allGuestIds,
            playerNames: Object.fromEntries(
              guestMembers.map(m => [m.guestId, m.displayName ?? m.guestId.slice(0, 8)])
            ),
          };
        }

        const hostMember = allMembers.find(m => m.role === "HOST");
        const hostGuestId = hostMember?.guestId ?? guestId;
        // Ensure experience state exists — may be missing after server restart
        if (experience.onActivate) {
          await experience.onActivate(roomId, hostGuestId);
        }
        console.log("[ready_up] auto-starting", experienceType, action, "for room", roomId);
        await experience.handleAction({ action, payload, roomId, guestId: hostGuestId, role: "HOST", io });
      }
      } catch (err) { console.error("[ready_up] error", err); }
    });

    // ─── room:force_start (HOST only) ────────────────────────────────────
    // Host skips the ready-up wait and starts the experience immediately.
    socket.on("room:force_start" as any, async ({ roomId }: { roomId: string }) => {
      try {
        const role = await getMemberRole(roomId, socketGuestId ?? "");
        if (!role || (role !== "HOST" && role !== "CO_HOST")) return;

        const experienceType = await redisClient.get(`room:${roomId}:experience`) ?? "dj";
        if (experienceType === "dj" || !isValidExperience(experienceType)) return;

        await redisClient.del(`room:${roomId}:ready_set`);
        io.to(roomId).emit("room:all_ready" as any, {});

        const allMembers = await getAllMembers(roomId);
        const guestMembers = allMembers.filter(m => m.role === "GUEST");
        const experience = getExperience(experienceType);
        let action = "start";
        let payload: Record<string, unknown> = {};

        if (experienceType === "trivia") {
          action = "start_round";
        } else if (experienceType === "draw_it" || experienceType === "mimic_me" ||
                   experienceType === "would_you_rather" || experienceType === "never_have_i_ever") {
          payload = { guestIds: guestMembers.map(m => m.guestId) };
        } else if (experienceType === "mind_mole") {
          action = "start_game";
          payload = {
            playerIds: guestMembers.map(m => m.guestId),
            playerNames: Object.fromEntries(
              guestMembers.map(m => [m.guestId, m.displayName ?? m.guestId.slice(0, 8)])
            ),
          };
        }

        // Ensure experience state exists before starting — onActivate is normally called
        // on experience switch, but if the server restarted or state was cleaned up it
        // may be missing. onActivate is idempotent and won't reset a running game.
        if (experience.onActivate) {
          await experience.onActivate(roomId, socketGuestId ?? "");
        }
        console.log("[force_start]", experienceType, action, "for room", roomId);
        await experience.handleAction({ action, payload, roomId, guestId: socketGuestId ?? "", role: "HOST", io });
      } catch (err) { console.error("[force_start] error", err); }
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
      // ACK the submitting guest so they know the action was received
      socket.emit("experience:action_ack" as any, { action, ok: true });
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
      // If they don't reconnect within 30s, clean up.
      // Use disconnectedAt timestamp: if joinedAt is newer they reconnected.
      const wasHost = member.role === "HOST";
      const disconnectedAt = Date.now();
      setTimeout(async () => {
        const current = await getMember(roomId, guestId);
        if (current && current.joinedAt > disconnectedAt) return; // reconnected
        await removeMember(roomId, guestId);
        io.to(roomId).emit("room:member_left", { guestId, roomId });

        // Host left — auto-close room after 5-minute grace period if no one took over
        if (wasHost) {
          setTimeout(async () => {
            const remaining = await getAllMembers(roomId);
            const hasHost = remaining.some(m => m.role === "HOST" || m.role === "CO_HOST");
            if (!hasHost) {
              // Remove from public discovery feed and notify any remaining guests
              await redisClient.zRem("public_rooms", roomId).catch(() => {});
              // Mark isLive false so room:join is rejected
              const metaRaw = await redisClient.get(`room:${roomId}:meta`).catch(() => null);
              if (metaRaw) {
                const meta = JSON.parse(metaRaw);
                meta.isLive = false;
                await redisClient.set(`room:${roomId}:meta`, JSON.stringify(meta), { KEEPTTL: true }).catch(() => {});
              }
              io.to(roomId).emit("room:closed" as any, { roomId });
              await unregisterActiveRoom(roomId).catch(() => {});
              console.log(`[realtime] Auto-closed room ${roomId} — host disconnected and did not return`);
            }
          }, 5 * 60 * 1000); // 5 minutes
        }
      }, 30_000);
    }
  }

  // ─── Health Endpoint ──────────────────────────────────────────────────────
  httpServer.on("request", (req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", timestamp: Date.now(), version: "v3-ready-member-fix" }));
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
