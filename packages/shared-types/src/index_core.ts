// ─────────────────────────────────────────────────────────────────────────────
// QueueDJ — Core Shared Types
// Used by: mobile app, api service, realtime service, ml service
// ─────────────────────────────────────────────────────────────────────────────

// ─── Roles ────────────────────────────────────────────────────────────────────

export type RoomRole = "HOST" | "CO_HOST" | "GUEST";

export interface RolePermissions {
  canRequestTrack:       boolean;
  canVote:               boolean;
  canReorderQueue:       boolean;
  canRemoveFromQueue:    boolean;
  canPlay:               boolean; // deck control
  canSetVibe:            boolean;
  canAccessBathroomBreak: boolean;
  canPromoteGuest:       boolean;
  canKickGuest:          boolean;
  canSwitchExperience:   boolean;
}

export const ROLE_PERMISSIONS: Record<RoomRole, RolePermissions> = {
  HOST: {
    canRequestTrack:        true,
    canVote:                true,
    canReorderQueue:        true,
    canRemoveFromQueue:     true,
    canPlay:                true,
    canSetVibe:             true,
    canAccessBathroomBreak: true,
    canPromoteGuest:        true,
    canKickGuest:           true,
    canSwitchExperience:    true,
  },
  CO_HOST: {
    canRequestTrack:        true,
    canVote:                true,
    canReorderQueue:        true,
    canRemoveFromQueue:     true,
    canPlay:                false,
    canSetVibe:             true,
    canAccessBathroomBreak: true,
    canPromoteGuest:        false,
    canKickGuest:           false,
    canSwitchExperience:    true,
  },
  GUEST: {
    canRequestTrack:        true,
    canVote:                true,
    canReorderQueue:        false,
    canRemoveFromQueue:     false,
    canPlay:                false,
    canSetVibe:             false,
    canAccessBathroomBreak: false,
    canPromoteGuest:        false,
    canKickGuest:           false,
    canSwitchExperience:    false,
  },
};

// ─── Crowd / Vibe ─────────────────────────────────────────────────────────────

export type CrowdState =
  | "WARMUP"
  | "RISING"
  | "PEAK"
  | "FATIGUE"
  | "RECOVERY"
  | "COOLDOWN";

export type VibePreset = "open" | "classy" | "hype" | "chill" | "throwback" | "family";

export const DEFAULT_CROWD_STATE: CrowdState = "WARMUP";

export const CROWD_STATE_BPM_RANGES: Record<CrowdState, { min: number; max: number }> = {
  WARMUP:   { min: 90,  max: 115 },
  RISING:   { min: 110, max: 125 },
  PEAK:     { min: 122, max: 140 },
  FATIGUE:  { min: 100, max: 120 },
  RECOVERY: { min: 85,  max: 105 },
  COOLDOWN: { min: 70,  max: 95  },
};

export const COLD_START_ENERGY_TARGET = 0.5;

// ─── Track ────────────────────────────────────────────────────────────────────

export type SourcePlatform = "spotify" | "apple_music" | "local" | "youtube";

export interface Track {
  isrc:          string;
  title:         string;
  artist:        string;
  album?:        string;
  durationMs:    number;
  bpm?:          number;
  key?:          string;          // e.g. "C major"
  energy?:       number;          // 0–1
  camelotNumber?: number;         // 1–12
  camelotType?:  "A" | "B";       // A = minor, B = major
  sourcePlatform: SourcePlatform;
  artworkUrl?:   string;
  previewUrl?:   string;
  noDerivative?: boolean;         // licensing kill-switch
  phraseBoundariesMs?: number[];  // 4-bar phrase start timestamps (ms); populated by ML Librosa pass
}

// ─── Queue ────────────────────────────────────────────────────────────────────

export interface QueueItem {
  id:               string;
  roomId:           string;
  track:            Track;
  position:         number;
  requestedBy:      string;       // guestId
  requestedAt:      number;
  votes:            number;
  vibeDistanceScore?: number;     // 0–1, populated after ML analysis
}

export interface QueueRequestPayload {
  roomId:       string;
  guestId:      string;
  isrc:         string;
  title:        string;
  artist:       string;
  durationMs:   number;
  sourcePlatform: SourcePlatform;
  artworkUrl?:  string;
}

export interface VibeGuardrailResult {
  vibeDistanceScore:            number;   // 0 = perfect fit, 1 = completely off
  camelotCompatible:            boolean;
  bpmCompatible:                boolean;
  rejected:                     boolean;
  alternativePositionSuggestion?: string;
}

export interface QueueRequestAck {
  accepted:        boolean;
  queuePosition?:  number;
  guardrailResult?: VibeGuardrailResult;
  error?:          string;
}

export const VIBE_GUARDRAIL_THRESHOLDS = {
  hardReject:  0.85,   // Always reject
  softWarn:    0.60,   // Warn guest but allow
  bpmMaxDelta: 20,     // BPM difference before vibe penalty
  energyMax:   0.40,   // Energy swing before vibe penalty
} as const;

// ─── Room ─────────────────────────────────────────────────────────────────────

export interface Room {
  id:                   string;
  code:                 string;   // 4-char display code e.g. "TRAP"
  hostGuestId:          string;
  name:                 string;
  vibePreset:           VibePreset;
  crowdState:           CrowdState;
  isLive:               boolean;
  isBathroomBreakActive: boolean;
  createdAt:            number;
  memberCount:          number;
  sequenceId:           number;
}

export interface RoomMember {
  guestId:            string;
  roomId:             string;
  role:               RoomRole;
  displayName?:       string;
  joinedAt:           number;
  pushToken?:         string;
  walkInAnthemIsrc?:  string;
  isWorkerNode:       boolean;
}

// ─── Deck / Playback ──────────────────────────────────────────────────────────

export type DeckId = "A" | "B";

export interface DeckState {
  deckId:       DeckId;
  isrc:         string | null;
  isPlaying:    boolean;
  positionMs:   number;
  bpm:          number | null;
  key:          string | null;
  volume:       number;           // 0–1
  crossfader:   number;           // 0 = full A, 1 = full B
  eq:           { low: number; mid: number; high: number };
}

export interface DeckCommand {
  roomId:   string;
  guestId:  string;
  deck:     DeckId;
  command:  "play" | "pause" | "cue" | "sync" | "set_crossfader" | "set_eq" | "set_volume";
  value?:   number | { low?: number; mid?: number; high?: number };
}

export interface TransitionPlan {
  fromIsrc:           string;
  toIsrc:             string;
  recommendedType:    "crossfade" | "harmonic_blend" | "echo_out" | "bridge";
  crossfadeMs:        number;
  pitchShiftSemitones: number;
  compatibilityScore: number;     // 0–1
}

// ─── Polls ────────────────────────────────────────────────────────────────────

export interface PollOption {
  id:    string;
  text:  string;
}

export interface Poll {
  id:        string;
  roomId:    string;
  question:  string;
  options:   PollOption[];
  results:   Record<string, number>;  // optionId → vote count
  createdAt: number;
  expiresAt?: number;
}

// ─── State Sync ───────────────────────────────────────────────────────────────

export interface RoomStateSnapshot {
  room:             Room;
  queue:            QueueItem[];
  members:          Omit<RoomMember, "pushToken">[];
  sequenceId:       number;
  serverTimestamp:  number;
}

export interface RoomEvent {
  sequenceId: number;
  type:       string;
  payload:    unknown;
  timestamp:  number;
}

export interface RoomJoinAck {
  success:            boolean;
  role:               RoomRole;
  guestId:            string;
  needsFullSync:      boolean;
  currentSequenceId:  number;
  error?:             string;
  // Bootstrap data — eliminates race between ack and follow-up socket events
  members?:           Omit<RoomMember, "pushToken">[];
  experienceType?:    string;
  guestView?:         string;
  awaitingReady?:     boolean;
  readyCount?:        number;
  readyTotalCount?:   number;
}

export const MAX_EVENT_REPLAY_COUNT = 100;

// ─── Offline Mode ─────────────────────────────────────────────────────────────

export interface OfflineModeState {
  isOffline:            boolean;
  pendingRequests:      QueueRequestPayload[];
  lastKnownSequenceId:  number;
  offlineSince?:        number;
}

// ─── Socket.io Event Maps ─────────────────────────────────────────────────────

export interface ClientToServerEvents {
  "room:join":       (payload: { roomId: string; guestId: string; lastSequenceId: number }, ack: (r: RoomJoinAck) => void) => void;
  "room:leave":      (payload: { roomId: string; guestId: string }) => void;
  "queue:request":   (payload: QueueRequestPayload, ack: (r: QueueRequestAck) => void) => void;
  "queue:reorder":   (payload: { roomId: string; itemId: string; newPosition: number }) => void;
  "queue:remove":    (payload: { roomId: string; itemId: string }) => void;
  "vote:cast":       (payload: { roomId: string; guestId: string; targetItemId: string; vote: "up" | "down" }) => void;
  "poll:respond":    (payload: { roomId: string; guestId: string; pollId: string; optionId: string }) => void;
  "tap:beat":        (payload: { roomId: string; guestId: string; timestamp: number }) => void;
  "shoutout:send":   (payload: { roomId: string; guestId: string; message: string }) => void;
  "deck:command":    (payload: DeckCommand) => void;
  "vibe:set":          (payload: { roomId: string; preset: VibePreset }) => void;
  "crowd_state:set":   (payload: { roomId: string; crowdState: CrowdState }) => void;
  "bathroom:toggle":   (payload: { roomId: string; active: boolean }) => void;
  "guest:promote":   (payload: { roomId: string; targetGuestId: string; newRole: "CO_HOST" | "GUEST" }) => void;
  "guest:kick":      (payload: { roomId: string; targetGuestId: string }) => void;
  "role:promote":    (payload: { roomId: string; targetGuestId: string; newRole: "CO_HOST" }) => void;
  "role:demote":     (payload: { roomId: string; targetGuestId: string }) => void;
  "room:setting":    (payload: { roomId: string; key: string; value: unknown }) => void;
  "guest:set_anthem":   (payload: { roomId: string; isrc: string | null }) => void;
  "room:request_sync":  (payload: { roomId: string }) => void;
}

export interface ServerToClientEvents {
  "room:state_snapshot":    (snapshot: RoomStateSnapshot) => void;
  "room:event_replay":      (events: RoomEvent[]) => void;
  "room:member_joined":     (member: Omit<RoomMember, "pushToken"> & { roomId: string }) => void;
  "room:member_left":       (payload: { guestId: string; roomId: string }) => void;
  "room:crowd_state_changed": (payload: { crowdState: CrowdState; sequenceId: number }) => void;
  "queue:updated":          (queue: QueueItem[], sequenceId: number) => void;
  "queue:item_added":       (item: QueueItem) => void;
  "shoutout:received":      (payload: { message: string }) => void;
  "deck:state_updated":     (state: Partial<DeckState>) => void;
  "poll:started":           (poll: Poll) => void;
  "poll:result":            (result: { pollId: string; results: Record<string, number> }) => void;
  "error":                  (payload: { code: ErrorCode; message: string }) => void;
  // Role change events (sent to the affected guest)
  "role:promoted":          (payload: { newRole: "CO_HOST" | "HOST" }) => void;
  "role:demoted":           (payload: { previousRole: "CO_HOST" | "HOST" }) => void;
  // Walk-in anthem (sent to host only)
  "room:walk_in_anthem":    (payload: { guestId: string; displayName: string; isrc: string }) => void;
  // Room settings change (sent to all members)
  "room:setting_changed":   (payload: { key: string; value: unknown }) => void;
}

// ─── Error Codes ──────────────────────────────────────────────────────────────

export type ErrorCode =
  | "ROOM_NOT_FOUND"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "VIBE_REJECTED"
  | "QUEUE_FULL"
  | "INVALID_TRACK"
  | "INTERNAL_ERROR";

// ─── BullMQ Job Payloads ──────────────────────────────────────────────────────

export interface AudioAnalysisJobPayload {
  isrc:        string;
  fileUrl?:    string;
  sourcePlatform: SourcePlatform;
}

export interface ISRCLookupJobPayload {
  title:    string;
  artist:   string;
  duration: number;
}

export interface TransitionAnalysisJobPayload {
  fromIsrc:   string;
  toIsrc:     string;
  crowdState: CrowdState;
}

export interface RLHFSignalJobPayload {
  signal:     "skip" | "extended_play" | "crowd_energy_up" | "crowd_energy_down";
  roomId:     string;
  // No guestId — GDPR compliant
  timestamp:  number;
}

// ─── Camelot Wheel ────────────────────────────────────────────────────────────

/**
 * Returns compatibility score between two Camelot positions.
 * 1.0 = perfect match, 0.0 = incompatible
 */
export function camelotCompatibilityScore(
  fromNumber: number, fromType: "A" | "B",
  toNumber:   number, toType:   "A" | "B",
): number {
  if (fromNumber === toNumber && fromType === toType) return 1.0;   // Same key
  if (fromNumber === toNumber && fromType !== toType) return 0.8;   // Relative major/minor

  const diff = Math.abs(fromNumber - toNumber);
  const wrapDiff = Math.min(diff, 12 - diff);

  if (wrapDiff === 1 && fromType === toType) return 0.9;  // Adjacent — perfect mix
  if (wrapDiff === 1)                         return 0.6;  // Adjacent, mode change
  if (wrapDiff === 2 && fromType === toType) return 0.5;
  return 0.0;
}
