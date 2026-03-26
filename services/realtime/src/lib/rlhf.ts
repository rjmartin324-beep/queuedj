import { db } from "../db"

// ─────────────────────────────────────────────────────────────────────────────
// RLHF Signal Logger
//
// Logs implicit feedback signals to the rlhf_signals table.
// Gated by FEATURE_RLHF_LOGGING env flag.
// GDPR: guestId is NOT stored — only anonymous room-level signals.
//
// Signal types:
//   track_request  — guest requested a track
//   vote_up        — guest upvoted a queue item
//   vote_down      — guest downvoted a queue item
//   track_skip     — host skipped a track (negative signal)
//   track_complete — track played to completion (positive signal)
//   crowd_drop     — crowd state dropped (negative signal for current track)
// ─────────────────────────────────────────────────────────────────────────────

const ENABLED = process.env.FEATURE_RLHF_LOGGING === "true"

export type RLHFSignalType =
  | "track_request"
  | "vote_up"
  | "vote_down"
  | "track_skip"
  | "track_complete"
  | "crowd_drop"

export interface RLHFSignal {
  roomId:      string
  isrc:        string
  signalType:  RLHFSignalType
  crowdState?: string
  bpm?:        number
  energy?:     number
  metadata?:   Record<string, unknown>
}

// Map our signal types to the schema's CHECK constraint values
const SIGNAL_TYPE_MAP: Record<RLHFSignalType, string> = {
  track_request:  "vote_up",        // closest proxy — treated as positive interest
  vote_up:        "vote_up",
  vote_down:      "vote_down",
  track_skip:     "skip",
  track_complete: "play_extended",
  crowd_drop:     "crowd_energy_down",
}

// Reward values per signal type (-1.0 to +1.0)
const REWARD_MAP: Record<RLHFSignalType, number> = {
  track_request:  0.3,
  vote_up:        0.5,
  vote_down:      -0.3,
  track_skip:     -0.8,
  track_complete: 1.0,
  crowd_drop:     -0.5,
}

export async function logRLHFSignal(signal: RLHFSignal): Promise<void> {
  if (!ENABLED) return

  try {
    // Look up the active session for this room (matched by room code stored in Redis key)
    const sessionRes = await db.query<{ id: string }>(
      `SELECT id FROM sessions WHERE room_code = $1 AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1`,
      [signal.roomId],
    )
    const sessionId = sessionRes.rows[0]?.id
    if (!sessionId) return  // No session yet — skip logging

    await db.query(
      `INSERT INTO rlhf_signals
         (session_id, signal_type, reward, isrc, crowd_state, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        sessionId,
        SIGNAL_TYPE_MAP[signal.signalType],
        REWARD_MAP[signal.signalType],
        signal.isrc,
        signal.crowdState ?? null,
      ],
    )
  } catch (err) {
    // Non-critical — never let logging break the main flow
    console.warn("[rlhf] Failed to log signal:", err)
  }
}

// ─── Convenience wrappers ─────────────────────────────────────────────────────

export function logTrackRequest(roomId: string, isrc: string, crowdState?: string) {
  return logRLHFSignal({ roomId, isrc, signalType: "track_request", crowdState })
}

export function logVote(roomId: string, isrc: string, direction: "up" | "down", crowdState?: string) {
  return logRLHFSignal({
    roomId, isrc,
    signalType: direction === "up" ? "vote_up" : "vote_down",
    crowdState,
  })
}

export function logTrackSkip(roomId: string, isrc: string, crowdState?: string, bpm?: number) {
  return logRLHFSignal({ roomId, isrc, signalType: "track_skip", crowdState, bpm })
}

export function logTrackComplete(roomId: string, isrc: string, crowdState?: string, bpm?: number) {
  return logRLHFSignal({ roomId, isrc, signalType: "track_complete", crowdState, bpm })
}

export function logCrowdDrop(roomId: string, isrc: string, fromState: string, toState: string) {
  return logRLHFSignal({
    roomId, isrc,
    signalType: "crowd_drop",
    crowdState: toState,
    metadata:   { fromState, toState },
  })
}
