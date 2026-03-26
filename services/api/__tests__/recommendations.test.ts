/**
 * Integration tests for GET /recommendations/:guestId
 *
 * Creates a real Fastify app, mocks the DB client, and makes HTTP requests
 * through the full route handler. Tests both response shape and ordering logic.
 */

import Fastify, { FastifyInstance } from "fastify";

// Mock db BEFORE importing the route (jest hoists jest.mock calls)
jest.mock("../src/db/client", () => ({
  db: { query: jest.fn() },
}));

import { db } from "../src/db/client";
import { recommendationRoutes } from "../src/routes/recommendations";

const mockQuery = db.query as jest.MockedFunction<typeof db.query>;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeTrack(overrides: Partial<{
  isrc: string; title: string; artist: string;
  bpm: number; energy: number; genre: string;
  camelot_key: number; camelot_type: string;
}> = {}) {
  return {
    isrc:         "USRC12345678",
    title:        "Test Track",
    artist:       "Test Artist",
    bpm:          128,
    energy:       0.85,
    genre:        "House",
    camelot_key:  5,
    camelot_type: "A",
    ...overrides,
  };
}

const FULL_PROFILE = {
  avg_bpm:        128,
  bpm_variance:   10,
  genre_weights:  { House: 0.9, Techno: 0.4 },
  preferred_keys: [{ key: 5, type: "A", weight: 0.8 }],
  energy_curve:   { peak: 0.85, mid: 0.7 },
  session_count:  5,
  updated_at:     new Date().toISOString(),
};

// ─── Setup ────────────────────────────────────────────────────────────────────

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });
  await app.register(recommendationRoutes);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  mockQuery.mockReset();
});

// ─── Response shape ───────────────────────────────────────────────────────────

describe("GET /recommendations/:guestId — response shape", () => {
  it("returns 200 with recommendations array and metadata", async () => {
    const tracks = Array.from({ length: 15 }, (_, i) =>
      makeTrack({ isrc: `TRACK${i}`, title: `Track ${i}` }),
    );

    mockQuery
      .mockResolvedValueOnce({ rows: [FULL_PROFILE] } as any)  // profile
      .mockResolvedValueOnce({ rows: [] } as any)               // rlhf (no history)
      .mockResolvedValueOnce({ rows: tracks } as any);          // candidates

    const res = await app.inject({ method: "GET", url: "/recommendations/guest-123?crowd_state=PEAK" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    expect(Array.isArray(body.recommendations)).toBe(true);
    expect(body.recommendations.length).toBeGreaterThan(0);
    expect(body.profile_updated_at).toBeTruthy();
    expect(body.source).toBe("personal");
  });

  it("each recommendation has the required fields", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [FULL_PROFILE] } as any)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [makeTrack()] } as any);

    const res = await app.inject({ method: "GET", url: "/recommendations/guest-123" });
    const { recommendations } = JSON.parse(res.body);

    expect(recommendations[0]).toMatchObject({
      isrc:   expect.any(String),
      title:  expect.any(String),
      artist: expect.any(String),
      score:  expect.any(Number),
    });
  });

  it("score is between 0 and 1 for every track", async () => {
    const tracks = Array.from({ length: 10 }, (_, i) =>
      makeTrack({ isrc: `T${i}`, bpm: 100 + i * 5, energy: 0.5 + i * 0.03 }),
    );
    mockQuery
      .mockResolvedValueOnce({ rows: [FULL_PROFILE] } as any)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: tracks } as any);

    const res = await app.inject({ method: "GET", url: "/recommendations/guest-123" });
    const { recommendations } = JSON.parse(res.body);

    for (const rec of recommendations) {
      expect(rec.score).toBeGreaterThanOrEqual(0);
      expect(rec.score).toBeLessThanOrEqual(1);
    }
  });

  it("results are sorted by score descending", async () => {
    const tracks = Array.from({ length: 5 }, (_, i) =>
      makeTrack({ isrc: `T${i}`, bpm: 128 + i * 10 }), // increasing BPM drift from 128 target
    );
    mockQuery
      .mockResolvedValueOnce({ rows: [FULL_PROFILE] } as any)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: tracks } as any);

    const res = await app.inject({ method: "GET", url: "/recommendations/guest-123?crowd_state=PEAK" });
    const { recommendations } = JSON.parse(res.body);

    for (let i = 1; i < recommendations.length; i++) {
      expect(recommendations[i - 1].score).toBeGreaterThanOrEqual(recommendations[i].score);
    }
  });
});

// ─── RLHF ordering ────────────────────────────────────────────────────────────

describe("GET /recommendations/:guestId — RLHF affects ordering", () => {
  it("positively-rewarded track ranks above negatively-rewarded identical track", async () => {
    // Both tracks identical except ISRC — only RLHF signal differentiates them
    const likedTrack   = makeTrack({ isrc: "TRACK_LIKED",   title: "Liked" });
    const skippedTrack = makeTrack({ isrc: "TRACK_SKIPPED", title: "Skipped" });

    mockQuery
      .mockResolvedValueOnce({ rows: [FULL_PROFILE] } as any)
      .mockResolvedValueOnce({
        rows: [
          { isrc: "TRACK_LIKED",   weighted_reward:  0.8 },
          { isrc: "TRACK_SKIPPED", weighted_reward: -0.8 },
        ],
      } as any)
      .mockResolvedValueOnce({ rows: [likedTrack, skippedTrack] } as any);

    const res = await app.inject({ method: "GET", url: "/recommendations/guest-123?crowd_state=PEAK" });
    const { recommendations } = JSON.parse(res.body);

    const likedIdx   = recommendations.findIndex((r: any) => r.isrc === "TRACK_LIKED");
    const skippedIdx = recommendations.findIndex((r: any) => r.isrc === "TRACK_SKIPPED");

    expect(likedIdx).toBeGreaterThanOrEqual(0);
    expect(skippedIdx).toBeGreaterThanOrEqual(0);
    expect(likedIdx).toBeLessThan(skippedIdx);
  });

  it("track with maximum positive RLHF (0.8) scores higher than same track with no RLHF history", async () => {
    const rlhfTrack  = makeTrack({ isrc: "WITH_RLHF",    title: "With history" });
    const coldTrack  = makeTrack({ isrc: "WITHOUT_RLHF", title: "No history" });

    mockQuery
      .mockResolvedValueOnce({ rows: [FULL_PROFILE] } as any)
      .mockResolvedValueOnce({
        rows: [{ isrc: "WITH_RLHF", weighted_reward: 0.8 }],
        // WITHOUT_RLHF gets default neutral 0.5 score
      } as any)
      .mockResolvedValueOnce({ rows: [rlhfTrack, coldTrack] } as any);

    const res = await app.inject({ method: "GET", url: "/recommendations/guest-123" });
    const { recommendations } = JSON.parse(res.body);

    const withIdx    = recommendations.findIndex((r: any) => r.isrc === "WITH_RLHF");
    const withoutIdx = recommendations.findIndex((r: any) => r.isrc === "WITHOUT_RLHF");
    expect(withIdx).toBeLessThan(withoutIdx);
  });
});

// ─── Fallback behaviour ───────────────────────────────────────────────────────

describe("GET /recommendations/:guestId — fallback", () => {
  it("uses trending fallback and returns source=trending when no profile exists", async () => {
    const trending = [makeTrack({ isrc: "TREND1", title: "Trending" })];

    mockQuery
      .mockResolvedValueOnce({ rows: [] } as any)         // no profile
      .mockResolvedValueOnce({ rows: [] } as any)         // no rlhf
      .mockResolvedValueOnce({ rows: [] } as any)         // no candidates
      .mockResolvedValueOnce({ rows: trending } as any);  // trending fallback

    const res = await app.inject({ method: "GET", url: "/recommendations/new-guest" });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.source).toBe("trending");
    expect(body.profile_updated_at).toBeNull();
  });

  it("triggers trending fallback when fewer than 5 BPM-matched candidates exist", async () => {
    const sparse  = [makeTrack({ isrc: "SPARSE1" }), makeTrack({ isrc: "SPARSE2" })];
    const popular = [makeTrack({ isrc: "TREND1" })];

    mockQuery
      .mockResolvedValueOnce({ rows: [FULL_PROFILE] } as any)  // profile (has history)
      .mockResolvedValueOnce({ rows: [] } as any)              // no rlhf
      .mockResolvedValueOnce({ rows: sparse } as any)          // only 2 candidates
      .mockResolvedValueOnce({ rows: popular } as any);        // trending fills the gap

    const res = await app.inject({ method: "GET", url: "/recommendations/guest-123" });
    const { recommendations } = JSON.parse(res.body);

    expect(recommendations.some((r: any) => r.isrc === "TREND1")).toBe(true);
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe("GET /recommendations/:guestId — error handling", () => {
  it("returns 500 when the DB throws", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB connection lost"));

    const res = await app.inject({ method: "GET", url: "/recommendations/guest-123" });

    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body);
    expect(body.error).toBeDefined();
  });
});
