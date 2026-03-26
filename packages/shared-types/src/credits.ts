// ─────────────────────────────────────────────────────────────────────────────
// Vibe Credits — Shared Types
// ─────────────────────────────────────────────────────────────────────────────

export type CreditReason =
  | "vote_cast"
  | "track_request"
  | "game_win"
  | "full_session"
  | "wardrobe_unlock"
  | "emote_purchase"
  | "admin_grant"
  | "refund";

export interface CreditEntry {
  id:            string;
  guestFingerprint: string;
  delta:         number;
  balanceAfter:  number;
  reason:        CreditReason;
  itemId?:       string;
  itemType?:     string;
  sessionId?:    string;
  createdAt:     string;
}

export interface CreditBalanceResponse {
  balance: number;
}

export interface CreditHistoryResponse {
  history: CreditEntry[];
}

export interface CreditAwardResponse {
  balance: number;
  awarded: number;
}

export interface CreditSpendResponse {
  success:  boolean;
  balance:  number;
  spent:    number;
}

// ─── Leaderboard Types ────────────────────────────────────────────────────────

export interface SessionLeaderboardEntry {
  rank:        number;
  guestId:     string;
  displayName: string;
  votes:       number;
  requests:    number;
  game_wins:   number;
  score:       number;
}

export interface HostLeaderboardEntry {
  host_fingerprint: string;
  total_sessions:   number;
  total_guests:     number;
  total_tracks:     number;
  peak_guests:      number;
  last_session_at:  string;
  rank:             number;
}
