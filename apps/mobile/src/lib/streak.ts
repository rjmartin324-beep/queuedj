import { storage } from "./storage";

// ─────────────────────────────────────────────────────────────────────────────
// Streak System
//
// Tracks consecutive days the user has been active (hosted or joined a room).
// Call  recordActivity()  once per session — it's idempotent within the same day.
// ─────────────────────────────────────────────────────────────────────────────

const STREAK_KEY    = "partyglue_streak";
const STAT_STREAK   = "stat_dj_streak";

export interface StreakData {
  currentStreak:  number;
  longestStreak:  number;
  lastActiveDate: string | null;  // "YYYY-MM-DD"
  totalActiveDays: number;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function getStreak(): Promise<StreakData> {
  try {
    const raw = storage.getString(STREAK_KEY);
    if (!raw) return { currentStreak: 0, longestStreak: 0, lastActiveDate: null, totalActiveDays: 0 };
    return JSON.parse(raw) as StreakData;
  } catch {
    return { currentStreak: 0, longestStreak: 0, lastActiveDate: null, totalActiveDays: 0 };
  }
}

/** Call once per session (hosting or joining a room). Idempotent on same day. */
export async function recordActivity(): Promise<StreakData> {
  const data = await getStreak();
  const t = today();

  // Already recorded today — no change
  if (data.lastActiveDate === t) return data;

  let newStreak: number;
  if (data.lastActiveDate === yesterday()) {
    // Consecutive day — extend streak
    newStreak = data.currentStreak + 1;
  } else {
    // Gap — reset streak
    newStreak = 1;
  }

  const updated: StreakData = {
    currentStreak:   newStreak,
    longestStreak:   Math.max(newStreak, data.longestStreak),
    lastActiveDate:  t,
    totalActiveDays: data.totalActiveDays + 1,
  };

  storage.set(STREAK_KEY, JSON.stringify(updated));

  // Update the stat key used by achievements
  storage.set(STAT_STREAK, String(updated.currentStreak));

  return updated;
}

/** Returns true if the streak is still alive (active today or yesterday). */
export function isStreakAlive(data: StreakData): boolean {
  if (!data.lastActiveDate) return false;
  return data.lastActiveDate === today() || data.lastActiveDate === yesterday();
}
