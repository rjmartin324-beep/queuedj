// Mirror of apps/box/src/types.ts — keep in sync.
// TODO: extract to packages/shared-types in Phase 2.

export type PlayMode = "pass_tablet" | "phones_only" | "host_tablet";
export type RoomPhase = "lobby" | "playing" | "results" | "closed";
export type MemberRole = "host" | "guest";
export type TriviaAnswer = "a" | "b" | "c" | "d";
export type TriviaDifficulty = "easy" | "medium" | "hard" | "extreme";

export interface Room {
  id: string;
  code: string;
  hostGuestId: string;
  phase: RoomPhase;
  mode: PlayMode;
  experience: string;
  createdAt: number;
}

export interface Member {
  guestId: string;
  displayName: string;
  role: MemberRole;
  joinedAt: number;
  connectedAt: number;
}

export type ClientMessage =
  | { type: "room:create"; guestId: string; displayName: string; mode: PlayMode; experience: string }
  | { type: "room:join";   guestId: string; displayName: string; code: string }
  | { type: "room:leave";  guestId: string; roomId: string }
  | { type: "host:start";  guestId: string; roomId: string; tournament?: boolean }
  | { type: "host:kick";   guestId: string; roomId: string; targetGuestId: string }
  | { type: "host:end_round"; guestId: string; roomId: string }
  | { type: "host:play_again"; guestId: string; roomId: string }
  | { type: "game:action"; guestId: string; roomId: string; action: string; payload: unknown }
  | { type: "host:next_question"; guestId: string; roomId: string }
  | { type: "host:pick_category"; guestId: string; roomId: string; category: string }
  | { type: "host:claim_transfer"; guestId: string; roomId: string; token: string }
  | { type: "game:answer"; guestId: string; roomId: string; answer: TriviaAnswer }
  | { type: "ping" };

export type ServerMessage =
  | { type: "room:created";  room: Room; you: Member; members: Member[]; transferToken?: string }
  | { type: "room:joined";   room: Room; you: Member; members: Member[] }
  | { type: "room:error";    code: string; message: string }
  | { type: "room:member_joined"; member: Member }
  | { type: "room:member_left";   guestId: string }
  | { type: "room:members";       members: Member[] }
  | { type: "room:phase_changed"; phase: RoomPhase }
  | { type: "room:closed" }
  | { type: "room:kicked" }
  | { type: "host:transferred"; room: Room; members: Member[]; oldHostGuestId: string; newHostGuestId: string }
  | { type: "game:state";    state: unknown }
  | { type: "game:event";    event: string; payload: unknown }
  | { type: "pong" };
