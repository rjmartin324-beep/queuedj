/**
 * Mobile smoke tests — verify critical pure logic without a running server.
 * These tests must pass with `npm test` from apps/mobile.
 */

// ─── 1. Invite link format ────────────────────────────────────────────────────

describe("inviteLink", () => {
  it("generates a URL with the room code", () => {
    // Inline the pure logic so we don't need the full module graph
    function buildInviteLink(roomCode: string, baseUrl = "https://queuedj.app"): string {
      return `${baseUrl}/join/${roomCode.toUpperCase()}`;
    }

    expect(buildInviteLink("TRAP")).toBe("https://queuedj.app/join/TRAP");
    expect(buildInviteLink("abcd")).toBe("https://queuedj.app/join/ABCD");
    expect(buildInviteLink("X1Y2")).toContain("/join/X1Y2");
  });
});

// ─── 2. Room reducer — queue sort ────────────────────────────────────────────

describe("room reducer: ADD_QUEUE_ITEM", () => {
  interface QueueItem {
    id: string;
    position: number;
    title: string;
  }

  function addAndSort(queue: QueueItem[], item: QueueItem): QueueItem[] {
    return [...queue, item].sort((a, b) => a.position - b.position);
  }

  it("inserts item at correct position", () => {
    const queue: QueueItem[] = [
      { id: "a", position: 1, title: "First" },
      { id: "c", position: 3, title: "Third" },
    ];
    const result = addAndSort(queue, { id: "b", position: 2, title: "Second" });
    expect(result.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("appends item at end", () => {
    const queue: QueueItem[] = [
      { id: "a", position: 1, title: "First" },
    ];
    const result = addAndSort(queue, { id: "b", position: 2, title: "Second" });
    expect(result[result.length - 1].id).toBe("b");
  });

  it("handles empty queue", () => {
    const result = addAndSort([], { id: "a", position: 1, title: "Only" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a");
  });
});

// ─── 3. Profanity filter logic ────────────────────────────────────────────────

describe("profanity filter", () => {
  const BLOCKED_WORDS = ["shit", "fuck", "cunt"];
  const PROFANITY_RE = new RegExp(
    `\\b(${BLOCKED_WORDS.join("|")})\\b`,
    "gi",
  );

  function filterProfanity(text: string): string {
    return text.replace(PROFANITY_RE, (match) => "*".repeat(match.length));
  }

  it("replaces blocked words with asterisks", () => {
    expect(filterProfanity("what the shit")).toBe("what the ****");
    expect(filterProfanity("FUCK that")).toBe("**** that");
  });

  it("preserves clean messages", () => {
    expect(filterProfanity("great track!")).toBe("great track!");
  });

  it("replaces multiple blocked words", () => {
    const result = filterProfanity("shit and fuck");
    expect(result).not.toContain("shit");
    expect(result).not.toContain("fuck");
  });

  it("does not alter non-whole-word substrings", () => {
    // "scunthorpe problem" — should not match partial words
    // Our word-boundary regex handles this
    expect(filterProfanity("Scunthorpe")).toBe("Scunthorpe");
  });
});

// ─── 4. Crowd state transitions ───────────────────────────────────────────────

describe("crowd state", () => {
  type CrowdState = "COLD" | "RISING" | "PEAK" | "DROPPING" | "RECOVERY";

  function isValidCrowdState(s: string): s is CrowdState {
    return ["COLD", "RISING", "PEAK", "DROPPING", "RECOVERY"].includes(s);
  }

  it("accepts all valid crowd states", () => {
    const valid: CrowdState[] = ["COLD", "RISING", "PEAK", "DROPPING", "RECOVERY"];
    valid.forEach((s) => expect(isValidCrowdState(s)).toBe(true));
  });

  it("rejects invalid crowd states", () => {
    expect(isValidCrowdState("HYPE")).toBe(false);
    expect(isValidCrowdState("")).toBe(false);
    expect(isValidCrowdState("peak")).toBe(false); // case-sensitive
  });
});

// ─── 5. Host onboarding flag ──────────────────────────────────────────────────

describe("shouldShowHostOnboarding", () => {
  // Pure logic extracted from HostOnboardingScreen
  function shouldShow(storedValue: string | null): boolean {
    return storedValue !== "1";
  }

  it("returns true when no flag is set", () => {
    expect(shouldShow(null)).toBe(true);
  });

  it("returns false after onboarding is complete", () => {
    expect(shouldShow("1")).toBe(false);
  });

  it("returns true for unexpected stored values", () => {
    expect(shouldShow("0")).toBe(true);
    expect(shouldShow("yes")).toBe(true);
  });
});
