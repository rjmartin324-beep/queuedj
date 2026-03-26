/**
 * Rule-Based Transition Classifier
 *
 * TypeScript port of services/ml/workers/transition_analysis.py
 * Runs in Node.js with zero external dependencies — no Python, no ML service.
 *
 * Used as the primary fallback when:
 *   - The ML service is unavailable / times out
 *   - Track data exists in our DB but ML hasn't processed it yet
 *
 * Scoring weights (match Python reference):
 *   BPM compatibility    35%
 *   Camelot compatibility 30%
 *   Energy compatibility  20%
 *   Crowd state fit       15%
 */

export type TransitionType = "harmonic_blend" | "crossfade" | "echo_out" | "bridge";
export type CrowdState = "WARMUP" | "RISING" | "PEAK" | "FATIGUE" | "RECOVERY" | "COOLDOWN";

export interface TrackAudioFeatures {
  bpm: number;
  camelotKey: number;      // 1–12
  camelotType: "A" | "B"; // A = minor, B = major
  energy: number;          // 0.0–1.0
  danceability?: number;   // 0.0–1.0 (from ReccoBeats)
}

export interface TransitionResult {
  score: number;
  bpmDelta: number;
  camelotCompatibility: number;
  energyDelta: number;
  recommendedTransition: TransitionType;
  vibeDistanceScore: number;
}

// ─── Camelot Wheel ────────────────────────────────────────────────────────────

export function camelotScore(
  keyA: number,
  typeA: "A" | "B",
  keyB: number,
  typeB: "A" | "B",
): number {
  if (keyA === keyB && typeA === typeB) return 1.0; // Perfect match

  if (typeA === typeB) {
    // Same mode — check adjacency on the wheel (wraps at 12)
    const diff = Math.min(Math.abs(keyA - keyB), 12 - Math.abs(keyA - keyB));
    if (diff === 1) return 0.8; // Adjacent — clean mix
    if (diff === 2) return 0.4;
    return 0.1;
  } else {
    // Different mode (major ↔ minor)
    if (keyA === keyB) return 0.7; // Relative major/minor (e.g. 8A ↔ 8B)
    return 0.1;                    // Cross-mode clash
  }
}

// ─── BPM Compatibility ────────────────────────────────────────────────────────
// Handles double-time / half-time: 128 BPM ↔ 64 BPM is the same groove

export function normalizeBpm(bpm: number): number {
  // Collapse to 60–120 range (canonical tempo)
  let b = bpm;
  while (b > 120) b /= 2;
  while (b < 60)  b *= 2;
  return b;
}

export function bpmScore(bpmA: number, bpmB: number): number {
  // Try direct delta first, then halftime/doubletime normalized delta — take best
  const directDelta     = Math.abs(bpmA - bpmB);
  const normalizedDelta = Math.abs(normalizeBpm(bpmA) - normalizeBpm(bpmB));
  const delta = Math.min(directDelta, normalizedDelta);

  if (delta <= 2)  return 1.0;
  if (delta <= 8)  return 0.85;
  if (delta <= 15) return 0.6;
  if (delta <= 25) return 0.35;
  if (delta <= 40) return 0.15; // Hard but survivable with time-stretch
  return 0.0;                   // Too far — hard reject
}

// ─── Energy Compatibility ─────────────────────────────────────────────────────

export function energyScore(energyA: number, energyB: number): number {
  const delta = Math.abs(energyA - energyB);
  if (delta <= 0.10) return 1.0;
  if (delta <= 0.20) return 0.8;
  if (delta <= 0.35) return 0.5;
  if (delta <= 0.50) return 0.3;
  return 0.1;
}

// ─── Crowd State Fit ──────────────────────────────────────────────────────────

const CROWD_STATE_ENERGY_TARGETS: Record<CrowdState, number> = {
  WARMUP:   0.30,
  RISING:   0.55,
  PEAK:     0.85,
  FATIGUE:  0.40,
  RECOVERY: 0.35,
  COOLDOWN: 0.20,
};

export function crowdStatePenalty(nextEnergy: number, crowdState: CrowdState | string): number {
  const target = CROWD_STATE_ENERGY_TARGETS[crowdState as CrowdState] ?? 0.5;
  const delta = Math.abs(nextEnergy - target);
  return Math.max(0.0, 1.0 - delta * 2); // 0.5 delta → 0 score
}

// ─── Transition Type Recommendation ──────────────────────────────────────────

export function recommendTransition(
  bpmDelta: number,
  camelotCompat: number,
  energyDelta: number,
): TransitionType {
  if (bpmDelta <= 2  && camelotCompat >= 0.8) return "harmonic_blend";
  if (bpmDelta <= 10 && camelotCompat >= 0.7) return "crossfade";
  if (energyDelta > 0.4)                       return "echo_out";   // Soften energy spike/drop
  if (bpmDelta > 20)                           return "bridge";     // Too far — need a bridge
  return "crossfade";
}

// ─── Neutral Result ───────────────────────────────────────────────────────────
// Returned when track data is missing — "we don't know, let it through with a warning"

export function neutralResult(): TransitionResult {
  return {
    score: 0.5,
    bpmDelta: 0,
    camelotCompatibility: 0.5,
    energyDelta: 0,
    recommendedTransition: "crossfade",
    vibeDistanceScore: 0.5,
  };
}

// ─── Main Classifier ──────────────────────────────────────────────────────────

export function classifyTransition(
  trackA: TrackAudioFeatures,
  trackB: TrackAudioFeatures,
  crowdState: CrowdState | string = "PEAK",
): TransitionResult {
  const bpmDelta    = Math.abs(trackA.bpm - trackB.bpm);
  const energyDelta = Math.abs(trackA.energy - trackB.energy);

  const bpmCompat    = bpmScore(trackA.bpm, trackB.bpm);
  const camelotCompat = camelotScore(trackA.camelotKey, trackA.camelotType, trackB.camelotKey, trackB.camelotType);
  const energyCompat = energyScore(trackA.energy, trackB.energy);
  const crowdCompat  = crowdStatePenalty(trackB.energy, crowdState);

  // Danceability bonus (from ReccoBeats) — keeps dance floor engaged
  let danceBonus = 0;
  if (trackA.danceability != null && trackB.danceability != null) {
    const dDelta = Math.abs(trackA.danceability - trackB.danceability);
    danceBonus = Math.max(0, 0.08 * (1 - dDelta * 2));
  }

  // Weighted composite — BPM + Camelot most critical for perceived mix quality
  const composite = Math.min(1.0,
    bpmCompat    * 0.35 +
    camelotCompat * 0.30 +
    energyCompat * 0.20 +
    crowdCompat  * 0.15 +
    danceBonus,
  );

  const score          = Math.round(composite * 1000) / 1000;
  const vibeDistanceScore = Math.round((1.0 - composite) * 1000) / 1000;

  return {
    score,
    bpmDelta:             Math.round(bpmDelta * 100) / 100,
    camelotCompatibility: Math.round(camelotCompat * 1000) / 1000,
    energyDelta:          Math.round(energyDelta * 1000) / 1000,
    recommendedTransition: recommendTransition(bpmDelta, camelotCompat, energyDelta),
    vibeDistanceScore,
  };
}
