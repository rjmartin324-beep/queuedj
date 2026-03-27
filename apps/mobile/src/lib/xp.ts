// ─────────────────────────────────────────────────────────────────────────────
// XP / Level system
//
// Credits earned in-game are the XP source.
// Each level requires progressively more XP:
//   Level 1: 0–99     (100 to level up)
//   Level 2: 100–249  (150 to level up)
//   Level 3: 250–449  (200 to level up)
//   Level 4: 450–699  (250 to level up)
//   ...each level costs 50 more than the last, starting at 100.
// ─────────────────────────────────────────────────────────────────────────────

export const RANK_NAMES = [
  "DJ Rookie",        // 1
  "Party Starter",    // 2
  "Crowd Pleaser",    // 3
  "Hype Machine",     // 4
  "Vibe Curator",     // 5
  "Stage Commander",  // 6
  "Festival Legend",  // 7
  "God of the Aux",   // 8
];

/** Total XP needed to *reach* level N (1-indexed). Level 1 starts at 0. */
function xpToReachLevel(level: number): number {
  if (level <= 1) return 0;
  // Sum of first (level-1) thresholds: 100, 150, 200, ... = 100*(n-1) + 50*(n-1)*(n-2)/2
  const n = level - 1;
  return 100 * n + 50 * ((n * (n - 1)) / 2);
}

export interface XPInfo {
  level: number;
  rank: string;
  currentXP: number;   // XP within this level
  levelXP: number;     // XP needed to complete this level
  totalXP: number;     // raw credits / total XP
  progress: number;    // 0.0 – 1.0
}

export function computeXP(totalCredits: number): XPInfo {
  let level = 1;
  // Find current level
  while (true) {
    const nextThreshold = xpToReachLevel(level + 1);
    if (totalCredits < nextThreshold) break;
    level++;
    if (level >= RANK_NAMES.length) {
      level = RANK_NAMES.length;
      break;
    }
  }

  const levelStart = xpToReachLevel(level);
  const levelEnd   = level >= RANK_NAMES.length
    ? levelStart + 500   // max level — show progress toward arbitrary cap
    : xpToReachLevel(level + 1);

  const currentXP = totalCredits - levelStart;
  const levelXP   = levelEnd - levelStart;

  return {
    level,
    rank:      RANK_NAMES[level - 1] ?? RANK_NAMES[RANK_NAMES.length - 1],
    currentXP,
    levelXP,
    totalXP:   totalCredits,
    progress:  Math.min(1, currentXP / levelXP),
  };
}
