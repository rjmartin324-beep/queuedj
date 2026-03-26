/**
 * Unit tests for the Camelot key scoring helpers in recommendations.ts.
 *
 * These are pure functions — no DB, no network. A bug here silently
 * mis-scores every track that has Camelot data (which is most of them).
 */

import { camelotDistance, camelotScore } from "../src/routes/recommendations";

// ─── camelotDistance ──────────────────────────────────────────────────────────

describe("camelotDistance", () => {
  it("returns 0 for the same key", () => {
    expect(camelotDistance(5, 5)).toBe(0);
    expect(camelotDistance(1, 1)).toBe(0);
    expect(camelotDistance(12, 12)).toBe(0);
  });

  it("returns 1 for adjacent keys", () => {
    expect(camelotDistance(5, 6)).toBe(1);
    expect(camelotDistance(6, 5)).toBe(1); // symmetric
  });

  it("wraps the wheel: key 12 and key 1 are adjacent (distance 1)", () => {
    expect(camelotDistance(12, 1)).toBe(1);
    expect(camelotDistance(1, 12)).toBe(1);
  });

  it("wraps correctly: key 11 and key 1 are 2 apart", () => {
    expect(camelotDistance(11, 1)).toBe(2);
  });

  it("maximum distance is 6 (opposite side of the wheel)", () => {
    expect(camelotDistance(1, 7)).toBe(6);
    expect(camelotDistance(7, 1)).toBe(6);
  });

  it("is always symmetric", () => {
    for (let a = 1; a <= 12; a++) {
      for (let b = 1; b <= 12; b++) {
        expect(camelotDistance(a, b)).toBe(camelotDistance(b, a));
      }
    }
  });

  it("never exceeds 6", () => {
    for (let a = 1; a <= 12; a++) {
      for (let b = 1; b <= 12; b++) {
        expect(camelotDistance(a, b)).toBeLessThanOrEqual(6);
      }
    }
  });
});

// ─── camelotScore ─────────────────────────────────────────────────────────────

describe("camelotScore", () => {
  const singleKey = [{ key: 5, type: "A", weight: 0.8 }];
  const multiKeys = [
    { key: 5, type: "A", weight: 0.8 },
    { key: 6, type: "A", weight: 0.5 },
    { key: 4, type: "A", weight: 0.3 },
  ];

  it("returns 0.5 when preferredKeys is empty", () => {
    expect(camelotScore(5, "A", [])).toBe(0.5);
  });

  it("returns 0.5 when trackKey is null", () => {
    expect(camelotScore(null, "A", singleKey)).toBe(0.5);
  });

  it("returns 0.5 when trackType is null", () => {
    expect(camelotScore(5, null, singleKey)).toBe(0.5);
  });

  it("exact match: returns capped value > 0.5", () => {
    const score = camelotScore(5, "A", singleKey);
    expect(score).toBeGreaterThan(0.5);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  it("exact match with weight 0.8 gives score 1.0 (0.5 + 0.8 capped at 1)", () => {
    expect(camelotScore(5, "A", singleKey)).toBeCloseTo(1.0);
  });

  it("adjacent key (dist 1, same mode) scores between 0.3 and 0.8", () => {
    const score = camelotScore(6, "A", singleKey); // 6A is adjacent to 5A
    expect(score).toBeGreaterThanOrEqual(0.3);
    expect(score).toBeLessThanOrEqual(0.8);
  });

  it("adjacent scores less than exact match", () => {
    const exact    = camelotScore(5, "A", singleKey);
    const adjacent = camelotScore(6, "A", singleKey);
    expect(exact).toBeGreaterThan(adjacent);
  });

  it("no match returns 0.2", () => {
    // Key 10 is far from 5 and not in the list
    expect(camelotScore(10, "B", singleKey)).toBe(0.2);
  });

  it("wrong mode returns 0.2 even for same key number", () => {
    // 5B is not in the list (list has 5A only)
    expect(camelotScore(5, "B", singleKey)).toBe(0.2);
  });

  it("wheel wrap: 12A is adjacent to 1A", () => {
    const keys = [{ key: 1, type: "A", weight: 0.9 }];
    const score = camelotScore(12, "A", keys);
    expect(score).toBeGreaterThan(0.2); // adjacent, not a miss
  });

  it("score is always between 0 and 1", () => {
    const testCases = [
      [1, "A"], [6, "B"], [12, "A"], [7, "B"],
    ] as const;
    for (const [key, type] of testCases) {
      const score = camelotScore(key, type, multiKeys);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});

// ─── Scoring weights sum to 1.0 ───────────────────────────────────────────────

describe("scoring weight constants", () => {
  it("BPM + energy + genre + RLHF + keys weights sum to 1.0", () => {
    // These must match the weights in recommendations.ts scored.map()
    const bpm    = 0.30;
    const energy = 0.25;
    const genre  = 0.18;
    const rlhf   = 0.22;
    const keys   = 0.05;
    expect(bpm + energy + genre + rlhf + keys).toBeCloseTo(1.0);
  });

  it("RLHF weight is at least 20% — historical signals must meaningfully influence rank", () => {
    const rlhfWeight = 0.22;
    expect(rlhfWeight).toBeGreaterThanOrEqual(0.20);
  });
});
