import { nanoid } from "nanoid";
import type { Room, Member, PlayMode } from "./types";
import * as db from "./db";

// ─── Room Code ────────────────────────────────────────────────────────────────

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 — easy to read aloud

function generateCode(): string {
  let code: string;
  do {
    code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
  } while (db.findRoomByCode(code) !== null);
  return code;
}

// ─── Create / Join / Leave ────────────────────────────────────────────────────

export function createRoom(hostGuestId: string, displayName: string, mode: PlayMode, experience: string): { room: Room; host: Member } {
  const roomId = nanoid(12);
  const code = generateCode();
  const now = Date.now();

  const room: Room = {
    id: roomId,
    code,
    hostGuestId,
    phase: "lobby",
    mode,
    experience,
    createdAt: now,
  };

  const host: Member = {
    guestId: hostGuestId,
    displayName,
    role: "host",
    joinedAt: now,
    connectedAt: now,
  };

  db.createRoom(room);
  db.putMember(roomId, host);

  return { room, host };
}

export function joinRoom(code: string, guestId: string, displayName: string): { room: Room; member: Member } | { error: string } {
  const room = db.findRoomByCode(code.toUpperCase());
  if (!room) return { error: "ROOM_NOT_FOUND" };
  if (room.phase === "closed") return { error: "ROOM_CLOSED" };

  const now = Date.now();

  // Returning guest — update connectedAt but preserve joinedAt and role
  const existing = db.findMember(room.id, guestId);
  const member: Member = existing
    ? { ...existing, connectedAt: now }
    : {
        guestId,
        displayName,
        role: "guest",
        joinedAt: now,
        connectedAt: now,
      };

  db.putMember(room.id, member);
  return { room, member };
}

export function leaveRoom(roomId: string, guestId: string): void {
  db.dropMember(roomId, guestId);
}

export function getMembers(roomId: string): Member[] {
  return db.listMembers(roomId);
}

export function startRoom(roomId: string): void {
  db.setRoomPhase(roomId, "playing");
}

export function endRound(roomId: string): void {
  db.setRoomPhase(roomId, "results");
}

export function closeRoom(roomId: string): void {
  db.setRoomPhase(roomId, "closed");
  db.closeRoom(roomId);
}

export function resetRoom(roomId: string): void {
  db.setRoomPhase(roomId, "lobby");
}

export function kickGuest(roomId: string, targetGuestId: string): void {
  db.dropMember(roomId, targetGuestId);
}

export function findRoom(roomId: string): Room | null {
  return db.findRoom(roomId);
}

export function findRoomByCode(code: string): Room | null {
  return db.findRoomByCode(code.toUpperCase());
}
