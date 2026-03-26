import type { Server } from "socket.io";
import { redisClient } from "../redis";

// ─────────────────────────────────────────────────────────────────────────────
// Party Chat Handler
//
// Messages stored in Redis list (last 50 per room).
// Broadcast to all room members via chat:received.
// Rate limited at the socket level (5/min in index.ts).
// ─────────────────────────────────────────────────────────────────────────────

const CHAT_KEY    = (roomId: string) => `room:${roomId}:chat`;
const MAX_HISTORY = 50;

export interface ChatMessage {
  id:          string;
  roomId:      string;
  guestId:     string;
  displayName: string;
  text:        string;
  ts:          number;
}

export async function handleChatMessage(
  payload: { roomId: string; guestId: string; displayName: string; text: string },
  io: Server,
): Promise<void> {
  const { roomId, guestId, displayName, text } = payload;

  const msg: ChatMessage = {
    id:          `${guestId}:${Date.now()}`,
    roomId,
    guestId,
    displayName: displayName.slice(0, 24),
    text:        text.slice(0, 200),
    ts:          Date.now(),
  };

  // Persist to Redis — keep last MAX_HISTORY messages
  const key = CHAT_KEY(roomId);
  await redisClient.lPush(key, JSON.stringify(msg));
  await redisClient.lTrim(key, 0, MAX_HISTORY - 1);
  await redisClient.expire(key, 86_400); // 24hr TTL

  // Broadcast to everyone in the room including sender
  io.to(roomId).emit("chat:received" as any, msg);
}

export async function getChatHistory(roomId: string): Promise<ChatMessage[]> {
  try {
    const raw = await redisClient.lRange(CHAT_KEY(roomId), 0, MAX_HISTORY - 1);
    return raw.map(r => JSON.parse(r) as ChatMessage).reverse(); // oldest first
  } catch {
    return [];
  }
}
