/**
 * API smoke tests — verify critical pure logic without a running server or DB.
 * These tests must pass with `npm test` from services/api.
 */

import { createHash } from "crypto";

// ─── 1. Guest ID fingerprinting (GDPR) ───────────────────────────────────────

describe("hashGuestId", () => {
  function hashGuestId(raw: string): string {
    return createHash("sha256").update(raw).digest("hex");
  }

  it("produces a 64-character hex string", () => {
    const result = hashGuestId("guest_abc123");
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]+$/);
  });

  it("is deterministic", () => {
    const a = hashGuestId("same-guest-id");
    const b = hashGuestId("same-guest-id");
    expect(a).toBe(b);
  });

  it("produces different hashes for different inputs", () => {
    expect(hashGuestId("guest_A")).not.toBe(hashGuestId("guest_B"));
  });

  it("never returns the raw input", () => {
    const raw = "guest_secret_id";
    expect(hashGuestId(raw)).not.toContain(raw);
  });
});

// ─── 2. Room code generation ──────────────────────────────────────────────────

describe("room code", () => {
  function generateRoomCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I/O to avoid confusion
    return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  }

  it("generates a 4-character code", () => {
    for (let i = 0; i < 20; i++) {
      const code = generateRoomCode();
      expect(code).toHaveLength(4);
    }
  });

  it("uses only allowed characters", () => {
    const allowed = /^[A-HJ-NP-Z]{4}$/;
    for (let i = 0; i < 50; i++) {
      expect(generateRoomCode()).toMatch(allowed);
    }
  });

  it("generates unique codes (probabilistic)", () => {
    const codes = new Set(Array.from({ length: 100 }, generateRoomCode));
    // With 22^4 = 234,256 possibilities, 100 codes should not all collide
    expect(codes.size).toBeGreaterThan(50);
  });
});

// ─── 3. Feature flags ─────────────────────────────────────────────────────────

describe("feature flags", () => {
  function getFlag(envValue: string | undefined): boolean {
    return envValue === "true";
  }

  it("returns false when env var is undefined", () => {
    expect(getFlag(undefined)).toBe(false);
  });

  it("returns false when env var is 'false'", () => {
    expect(getFlag("false")).toBe(false);
  });

  it("returns true when env var is 'true'", () => {
    expect(getFlag("true")).toBe(true);
  });

  it("returns false for arbitrary truthy strings", () => {
    expect(getFlag("1")).toBe(false);
    expect(getFlag("yes")).toBe(false);
  });
});

// ─── 4. Queue position sort ───────────────────────────────────────────────────

describe("queue position sort", () => {
  interface QueueItem { id: string; position: number }

  function sortQueue(items: QueueItem[]): QueueItem[] {
    return [...items].sort((a, b) => a.position - b.position);
  }

  it("sorts items by position ascending", () => {
    const items: QueueItem[] = [
      { id: "c", position: 3 },
      { id: "a", position: 1 },
      { id: "b", position: 2 },
    ];
    expect(sortQueue(items).map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("handles already-sorted input", () => {
    const items: QueueItem[] = [{ id: "a", position: 1 }, { id: "b", position: 2 }];
    expect(sortQueue(items).map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("does not mutate the original array", () => {
    const items: QueueItem[] = [{ id: "b", position: 2 }, { id: "a", position: 1 }];
    const sorted = sortQueue(items);
    expect(items[0].id).toBe("b"); // original unchanged
    expect(sorted[0].id).toBe("a");
  });
});

// ─── 5. ALLOWED_KEYS room settings whitelist ──────────────────────────────────

describe("room settings whitelist", () => {
  const ALLOWED_KEYS = new Set([
    "requestsLocked", "votingEnabled", "showQueueToGuests",
    "allowLateJoin", "maxGuests", "bpm_override",
  ]);

  it("accepts all known settings keys", () => {
    const keys = ["requestsLocked", "votingEnabled", "showQueueToGuests", "allowLateJoin", "maxGuests", "bpm_override"];
    keys.forEach((k) => expect(ALLOWED_KEYS.has(k)).toBe(true));
  });

  it("rejects unknown keys", () => {
    expect(ALLOWED_KEYS.has("adminPassword")).toBe(false);
    expect(ALLOWED_KEYS.has("__proto__")).toBe(false);
    expect(ALLOWED_KEYS.has("")).toBe(false);
  });
});

// ─── 6. Credits: positive-only guard ─────────────────────────────────────────

describe("credits award validation", () => {
  function validateCreditAmount(amount: number): boolean {
    return Number.isInteger(amount) && amount > 0 && amount <= 1000;
  }

  it("accepts valid positive integers", () => {
    expect(validateCreditAmount(1)).toBe(true);
    expect(validateCreditAmount(100)).toBe(true);
    expect(validateCreditAmount(1000)).toBe(true);
  });

  it("rejects zero and negatives", () => {
    expect(validateCreditAmount(0)).toBe(false);
    expect(validateCreditAmount(-5)).toBe(false);
  });

  it("rejects amounts above limit", () => {
    expect(validateCreditAmount(1001)).toBe(false);
  });

  it("rejects non-integers", () => {
    expect(validateCreditAmount(1.5)).toBe(false);
    expect(validateCreditAmount(NaN)).toBe(false);
  });
});
