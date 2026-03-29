import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { awardCredits, fingerprintGuest, incrementSessionStat } from "../../lib/credits";

// ─────────────────────────────────────────────────────────────────────────────
// Guess The Song Experience
//
// Host activates this mode. The currently playing track is hidden.
// Guests type the song title — first correct answer wins the round.
// Points awarded by speed: 1st = 500, 2nd = 300, 3rd = 150
// ─────────────────────────────────────────────────────────────────────────────

const KEY = (roomId: string) => `experience:guess_song:${roomId}`;
const ROUND_DURATION_MS = 30_000;

interface GuessSongState {
  phase: "waiting" | "guessing" | "revealed";
  roundNumber: number;
  totalRounds: number;
  hiddenIsrc: string | null;
  hiddenTitle: string | null;
  hiddenArtist: string | null;
  winners: string[];       // guestIds in order of correct answer
  winnerNames: string[];
  guesses: Record<string, string>;  // guestId → guess text
  scores: Record<string, number>;
  roundStartedAt: number | null;
}

export class GuessSongExperience implements ExperienceModule {
  readonly type = "guess_the_song" as const;
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  async onActivate(roomId: string): Promise<void> {
    const state: GuessSongState = {
      phase: "waiting",
      roundNumber: 0,
      totalRounds: 5,
      hiddenIsrc: null,
      hiddenTitle: null,
      hiddenArtist: null,
      winners: [],
      winnerNames: [],
      guesses: {},
      scores: {},
      roundStartedAt: null,
    };
    await this._save(roomId, state);
  }

  async onDeactivate(_roomId: string): Promise<void> {
    this.timers.forEach(t => clearTimeout(t));
    this.timers.clear();
  }

  async handleAction({ action, payload, roomId, guestId, role, io }: {
    action: string; payload: unknown; roomId: string;
    guestId: string; role: "HOST" | "CO_HOST" | "GUEST"; io: Server;
  }): Promise<void> {
    const p = payload as any;

    switch (action) {
      case "start_round":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._startRound(roomId, p.isrc, p.title, p.artist, io);
        break;

      case "submit_guess":
        await this._submitGuess(roomId, guestId, p.guess, p.guestName ?? "Guest", io);
        break;

      case "reveal":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._reveal(roomId, io);
        break;

      case "next_round":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._nextRound(roomId, io);
        break;
    }
  }

  async getGuestViewDescriptor(roomId: string): Promise<GuestViewDescriptor> {
    const state = await this._load(roomId);
    return {
      type: "guess_the_song" as const,
      data: {
        phase: state.phase,
        roundNumber: state.roundNumber,
        totalRounds: state.totalRounds,
        winners: state.winnerNames,
        myScore: 0, // overridden per guest in broadcast
        guessCount: Object.keys(state.guesses).length,
        revealedTitle: state.phase === "revealed" ? state.hiddenTitle : null,
        revealedArtist: state.phase === "revealed" ? state.hiddenArtist : null,
        roundStartedAt: state.roundStartedAt,
        roundDurationMs: ROUND_DURATION_MS,
      },
    };
  }

  async getBootstrapState(roomId: string): Promise<unknown> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }

  private async _startRound(
    roomId: string, isrc: string, title: string, artist: string, io: Server
  ): Promise<void> {
    const state = await this._load(roomId);
    state.phase = "guessing";
    state.roundNumber += 1;
    state.hiddenIsrc = isrc;
    state.hiddenTitle = title;
    state.hiddenArtist = artist;
    state.winners = [];
    state.winnerNames = [];
    state.guesses = {};
    state.roundStartedAt = Date.now();
    await this._save(roomId, state);
    io.to(roomId).emit("experience:state_updated", { phase: "guessing", roundNumber: state.roundNumber, totalRounds: state.totalRounds, roundStartedAt: state.roundStartedAt, roundDurationMs: ROUND_DURATION_MS });

    // Auto-reveal after timeout
    clearTimeout(this.timers.get(`${roomId}:reveal`));
    this.timers.set(`${roomId}:reveal`, setTimeout(() => this._reveal(roomId, io), ROUND_DURATION_MS));
  }

  private async _submitGuess(
    roomId: string, guestId: string, guess: string, guestName: string, io: Server
  ): Promise<void> {
    const state = await this._load(roomId);
    if (state.phase !== "guessing") return;
    if (state.guesses[guestId]) return; // Already guessed

    state.guesses[guestId] = guess;

    const correct = guess.trim().toLowerCase() === state.hiddenTitle?.trim().toLowerCase();
    if (correct && !state.winners.includes(guestId)) {
      state.winners.push(guestId);
      state.winnerNames.push(guestName);
      const pts = [500, 300, 150][state.winners.length - 1] ?? 50;
      state.scores[guestId] = (state.scores[guestId] ?? 0) + pts;
      io.to(roomId).emit("guess_song:correct", { guestId, guestName, position: state.winners.length, pts });
      // Award game win credits and track session stat for first correct guesser
      if (state.winners.length === 1) {
        awardCredits(fingerprintGuest(guestId), "game_win");
        incrementSessionStat(roomId, guestId, "game_wins", guestName);
      }
    }

    await this._save(roomId, state);
    io.to(roomId).emit("guess_song:guess_count", { count: Object.keys(state.guesses).length });
  }

  private async _reveal(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (state.phase === "revealed") return;
    state.phase = "revealed";
    await this._save(roomId, state);
    io.to(roomId).emit("experience:state_updated", {
      phase: "revealed",
      title: state.hiddenTitle,
      artist: state.hiddenArtist,
      winners: state.winnerNames,
      scores: state.scores,
    });
  }

  private async _nextRound(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (state.roundNumber >= state.totalRounds) {
      io.to(roomId).emit("experience:state_updated", { phase: "game_over", scores: state.scores });
      return;
    }
    state.phase = "waiting";
    await this._save(roomId, state);
    io.to(roomId).emit("experience:state_updated", { phase: "waiting" });
  }

  private async _load(roomId: string): Promise<GuessSongState> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : { phase: "waiting", roundNumber: 0, totalRounds: 5, hiddenIsrc: null, hiddenTitle: null, hiddenArtist: null, winners: [], winnerNames: [], guesses: {}, scores: {}, roundStartedAt: null };
  }

  private async _save(roomId: string, state: GuessSongState): Promise<void> {
    await redisClient.set(KEY(roomId), JSON.stringify(state), { EX: 14400 });
  }
}