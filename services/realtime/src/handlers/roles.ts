import type { RoomRole, RolePermissions } from "@queuedj/shared-types";
import { ROLE_PERMISSIONS } from "@queuedj/shared-types";
import { redisClient } from "../redis";

// ─────────────────────────────────────────────────────────────────────────────
// Role Permission System
//
// Roles: HOST > CO_HOST > GUEST
// No JWT required. Roles are stored in Redis per room+guest.
// HOST is assigned at room creation. CO_HOST is promoted by HOST only.
//
// Every Socket.io handler that mutates state calls requirePermission()
// before processing. Failure emits an error event to the caller only.
// ─────────────────────────────────────────────────────────────────────────────

const MEMBER_KEY = (roomId: string, guestId: string) => `room:${roomId}:member:${guestId}`;
const MEMBERS_KEY = (roomId: string) => `room:${roomId}:members`;

export interface MemberRecord {
  guestId: string;
  role: RoomRole;
  displayName?: string;
  joinedAt: number;
  pushToken?: string;
  walkInAnthemIsrc?: string;
  isWorkerNode: boolean;
}

// ─── Member Storage ───────────────────────────────────────────────────────────

export async function setMember(roomId: string, member: MemberRecord): Promise<void> {
  await Promise.all([
    redisClient.set(MEMBER_KEY(roomId, member.guestId), JSON.stringify(member)),
    redisClient.sAdd(MEMBERS_KEY(roomId), member.guestId),
  ]);
}

export async function getMember(roomId: string, guestId: string): Promise<MemberRecord | null> {
  const raw = await redisClient.get(MEMBER_KEY(roomId, guestId));
  if (!raw) return null;
  return JSON.parse(raw) as MemberRecord;
}

export async function removeMember(roomId: string, guestId: string): Promise<void> {
  await Promise.all([
    redisClient.del(MEMBER_KEY(roomId, guestId)),
    redisClient.sRem(MEMBERS_KEY(roomId), guestId),
  ]);
}

export async function getAllMembers(roomId: string): Promise<MemberRecord[]> {
  const guestIds = await redisClient.sMembers(MEMBERS_KEY(roomId));
  const members = await Promise.all(
    guestIds.map((id) => getMember(roomId, id))
  );
  return members.filter(Boolean) as MemberRecord[];
}

export async function getMemberRole(roomId: string, guestId: string): Promise<RoomRole | null> {
  const member = await getMember(roomId, guestId);
  return member?.role ?? null;
}

// ─── Permission Check ─────────────────────────────────────────────────────────

export async function requirePermission(
  roomId: string,
  guestId: string,
  permission: keyof RolePermissions,
): Promise<{ allowed: boolean; role: RoomRole | null }> {
  const role = await getMemberRole(roomId, guestId);
  if (!role) return { allowed: false, role: null };

  const permissions = ROLE_PERMISSIONS[role];
  return { allowed: permissions[permission], role };
}

// Synchronous version for when role is already known (avoids extra Redis call)
export function checkPermission(role: RoomRole, permission: keyof RolePermissions): boolean {
  return ROLE_PERMISSIONS[role][permission];
}

// ─── Promotion ────────────────────────────────────────────────────────────────

export async function promoteMember(
  roomId: string,
  requestingGuestId: string,  // Must be HOST
  targetGuestId: string,
  newRole: "CO_HOST" | "GUEST",
): Promise<{ success: boolean; error?: string }> {
  const { allowed, role: requesterRole } = await requirePermission(roomId, requestingGuestId, "canPromoteGuest");

  if (!allowed) {
    return { success: false, error: "Only the host can promote members" };
  }

  // Can't promote/demote the host themselves
  if (targetGuestId === requestingGuestId) {
    return { success: false, error: "Cannot change your own role" };
  }

  const target = await getMember(roomId, targetGuestId);
  if (!target) {
    return { success: false, error: "Member not found" };
  }

  // Can't demote another HOST (there's always exactly one HOST)
  if (target.role === "HOST") {
    return { success: false, error: "Cannot change the host's role" };
  }

  await setMember(roomId, { ...target, role: newRole });
  return { success: true };
}

// ─── Kick ─────────────────────────────────────────────────────────────────────

export async function kickMember(
  roomId: string,
  requestingGuestId: string,  // Must be HOST
  targetGuestId: string,
): Promise<{ success: boolean; error?: string }> {
  const { allowed } = await requirePermission(roomId, requestingGuestId, "canKickGuest");

  if (!allowed) {
    return { success: false, error: "Only the host can kick members" };
  }

  const target = await getMember(roomId, targetGuestId);
  if (!target) {
    return { success: false, error: "Member not found" };
  }

  if (target.role === "HOST") {
    return { success: false, error: "Cannot kick the host" };
  }

  await removeMember(roomId, targetGuestId);
  return { success: true };
}

// ─── Count ────────────────────────────────────────────────────────────────────

export async function getMemberCount(roomId: string): Promise<number> {
  return await redisClient.sCard(MEMBERS_KEY(roomId));
}
