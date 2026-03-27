import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";
import { GEO_LOCATIONS, type GeoLocation } from "./locations";
import { shuffle } from "../../lib/shuffle";

// ─────────────────────────────────────────────────────────────────────────────
// GeoGuesser Experience
//
// Flow: waiting → guessing (45s) → reveal → [next round or finished]
// Photo shown top half. Players drop pin on world map.
// Score = 1000 → 0 based on distance from correct location (km).
// ─────────────────────────────────────────────────────────────────────────────

const STATE_KEY  = (roomId: string) => `experience:geo:${roomId}`;
const GUESS_SECS = 45;

interface Guess { lat: number; lng: number }

interface GeoState {
  phase: "waiting" | "guessing" | "reveal" | "finished";
  location: GeoLocation | null;
  guesses: Record<string, Guess>;   // guestId → pin
  scores:  Record<string, number>;
  roundScores: Record<string, number>; // just this round
  roundNumber: number;
  totalRounds: number;
  usedIds: string[];
  locationQueue: string[];
}

export class GeoGuesserExperience implements ExperienceModule {
  readonly type = "geo_guesser" as const;
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  async onActivate(roomId: string): Promise<void> {
    const state: GeoState = {
      phase: "waiting",
      location: null,
      guesses: {},
      scores: {},
      roundScores: {},
      roundNumber: 0,
      totalRounds: 5,
      usedIds: [],
      locationQueue: shuffle(GEO_LOCATIONS.map(l => l.id)),
    };
    await redisClient.set(STATE_KEY(roomId), JSON.stringify(state));
  }

  async onDeactivate(roomId: string): Promise<void> {
    const t = this.timers.get(roomId);
    if (t) { clearTimeout(t); this.timers.delete(roomId); }
  }

  async handleAction({ action, payload, roomId, guestId, role, io }: {
    action: string; payload: unknown; roomId: string;
    guestId: string; role: "HOST" | "CO_HOST" | "GUEST"; io: Server;
  }): Promise<void> {
    switch (action) {
      case "start_round":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._startRound(roomId, io);
        break;

      case "submit_guess":
        await this._submitGuess(roomId, guestId, payload as Guess, io);
        break;

      case "next_round":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._startRound(roomId, io);
        break;

      case "end_game":
        if (role !== "HOST") return;
        await this.onDeactivate(roomId);
        await redisClient.set(`room:${roomId}:experience`, "dj");
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:changed" as any, {
          experienceType: "dj",
          view: { type: "dj_queue" },
          sequenceId: seq,
        });
        break;
    }
  }

  async getGuestViewDescriptor(roomId: string): Promise<GuestViewDescriptor> {
    const s = await this._getState(roomId);
    if (!s) return { type: "intermission" };
    switch (s.phase) {
      case "guessing": return {
        type: "geo_guessing",
        data: { imageUrl: s.location?.imageUrl, hint: s.location?.hint, timeLimit: GUESS_SECS, roundNumber: s.roundNumber, totalRounds: s.totalRounds },
      };
      case "reveal":
      case "finished": return { type: "geo_reveal", data: s };
      default: return { type: "intermission" };
    }
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private async _startRound(roomId: string, io: Server): Promise<void> {
    const s = await this._getState(roomId);
    if (!s) return;

    // Work through pre-shuffled queue; fall back to re-shuffle if exhausted
    let queue = s.locationQueue?.length ? s.locationQueue : shuffle(GEO_LOCATIONS.map(l => l.id));
    const nextId = queue[0];
    s.locationQueue = queue.slice(1);
    const location = GEO_LOCATIONS.find(l => l.id === nextId) ?? GEO_LOCATIONS[0];

    s.phase = "guessing";
    s.location = location;
    s.guesses = {};
    s.roundScores = {};
    s.roundNumber += 1;
    s.usedIds = [...s.usedIds, location.id];
    await this._saveState(roomId, s);

    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "geo_guesser",
      state: { ...s, location: { imageUrl: location.imageUrl, hint: location.hint } }, // hide name during guessing
      view: {
        type: "geo_guessing",
        data: { imageUrl: location.imageUrl, hint: location.hint, timeLimit: GUESS_SECS, roundNumber: s.roundNumber, totalRounds: s.totalRounds },
      },
      sequenceId: seq,
    });

    this._setTimer(roomId, GUESS_SECS * 1000, () => this._reveal(roomId, io));
  }

  private async _submitGuess(roomId: string, guestId: string, guess: Guess, io: Server): Promise<void> {
    const s = await this._getState(roomId);
    if (!s || s.phase !== "guessing") return;
    s.guesses[guestId] = guess;
    await this._saveState(roomId, s);
  }

  private async _reveal(roomId: string, io: Server): Promise<void> {
    const s = await this._getState(roomId);
    if (!s || s.phase !== "guessing" || !s.location) return;

    // Score each guess
    for (const [guestId, guess] of Object.entries(s.guesses)) {
      const dist = haversineKm(s.location.lat, s.location.lng, guess.lat, guess.lng);
      const pts  = distanceScore(dist);
      s.scores[guestId]      = (s.scores[guestId] ?? 0) + pts;
      s.roundScores[guestId] = pts;
    }

    s.phase = s.roundNumber >= s.totalRounds ? "finished" : "reveal";
    await this._saveState(roomId, s);

    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "geo_guesser",
      state: s,                        // full state including location name
      view: { type: "geo_reveal", data: s },
      sequenceId: seq,
    });
  }

  private _setTimer(roomId: string, ms: number, fn: () => void) {
    const existing = this.timers.get(roomId);
    if (existing) clearTimeout(existing);
    const t = setTimeout(fn, ms);
    this.timers.set(roomId, t);
  }

  private async _getState(roomId: string): Promise<GeoState | null> {
    const raw = await redisClient.get(STATE_KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }

  private async _saveState(roomId: string, s: GeoState): Promise<void> {
    await redisClient.set(STATE_KEY(roomId), JSON.stringify(s));
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distanceScore(km: number): number {
  if (km <   50) return 1000;
  if (km <  250) return  800;
  if (km <  750) return  600;
  if (km < 2000) return  400;
  if (km < 4000) return  200;
  if (km < 7000) return   50;
  return 0;
}
