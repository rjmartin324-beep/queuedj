import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";

// ─────────────────────────────────────────────────────────────────────────────
// Name That Genre — Music Game
//
// Host plays a track. Guests pick the genre from 4 options.
// Points for correct answer + speed bonus.
// Optionally: host can set track manually or it auto-pulls from Now Playing.
// ─────────────────────────────────────────────────────────────────────────────

const KEY = (roomId: string) => `experience:name_genre:${roomId}`;
const ROUND_MS = 20_000;

const GENRES = [
  "Hip-Hop", "Pop", "R&B", "Rock", "Electronic", "Jazz", "Country",
  "Reggae", "Metal", "Classical", "Latin", "Soul", "Punk", "Folk",
  "Funk", "Disco", "Blues", "Indie", "Dance", "Trap", "Afrobeats", "K-Pop",
];

interface GenreRoundState {
  phase: "waiting" | "guessing" | "revealed";
  roundNumber: number;
  totalRounds: number;
  correctGenre: string | null;
  options: string[];          // 4 genre options
  trackTitle: string | null;
  trackArtist: string | null;
  isrc: string | null;
  answers: Record<string, string>;   // guestId → genre chosen
  scores: Record<string, number>;
  roundStartedAt: number | null;
}

function buildOptions(correct: string): string[] {
  const pool = GENRES.filter(g => g !== correct).sort(() => Math.random() - 0.5).slice(0, 3);
  const opts = [...pool, correct].sort(() => Math.random() - 0.5);
  return opts;
}

export class NameGenreExperience implements ExperienceModule {
  readonly type = "name_that_genre" as const;
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  async onActivate(roomId: string): Promise<void> {
    const state: GenreRoundState = {
      phase: "waiting",
      roundNumber: 0,
      totalRounds: 5,
      correctGenre: null,
      options: [],
      trackTitle: null,
      trackArtist: null,
      isrc: null,
      answers: {},
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
        await this._startRound(roomId, p.genre, p.title, p.artist, p.isrc, io);
        break;

      case "submit_answer":
        await this._submitAnswer(roomId, guestId, p.genre, io);
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
      type: "name_that_genre" as const,
      data: {
        phase: state.phase,
        roundNumber: state.roundNumber,
        totalRounds: state.totalRounds,
        options: state.options,
        trackTitle: state.phase === "revealed" ? state.trackTitle : "???",
        trackArtist: state.phase === "revealed" ? state.trackArtist : "???",
        answerCount: Object.keys(state.answers).length,
        correctGenre: state.phase === "revealed" ? state.correctGenre : null,
        scores: state.phase === "revealed" ? state.scores : {},
        roundStartedAt: state.roundStartedAt,
        roundDurationMs: ROUND_MS,
      },
    };
  }

  async getBootstrapState(roomId: string): Promise<unknown> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }

  private async _startRound(roomId: string, genre: string, title: string, artist: string, isrc: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    state.phase = "guessing";
    state.roundNumber += 1;
    state.correctGenre = genre;
    state.options = buildOptions(genre);
    state.trackTitle = title;
    state.trackArtist = artist;
    state.isrc = isrc;
    state.answers = {};
    state.roundStartedAt = Date.now();
    await this._save(roomId, state);
    io.to(roomId).emit("experience:state_updated", {
      phase: "guessing",
      roundNumber: state.roundNumber,
      totalRounds: state.totalRounds,
      options: state.options,
      trackTitle: "???",
      trackArtist: "???",
      roundStartedAt: state.roundStartedAt,
      roundDurationMs: ROUND_MS,
    });
    clearTimeout(this.timers.get(`${roomId}:reveal`));
    this.timers.set(`${roomId}:reveal`, setTimeout(() => this._reveal(roomId, io), ROUND_MS));
  }

  private async _submitAnswer(roomId: string, guestId: string, genre: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (state.phase !== "guessing" || state.answers[guestId]) return;
    state.answers[guestId] = genre;

    if (genre === state.correctGenre) {
      const elapsed = Date.now() - (state.roundStartedAt ?? Date.now());
      const speedBonus = Math.max(0, Math.floor((ROUND_MS - elapsed) / 1000) * 10);
      const pts = 200 + speedBonus;
      state.scores[guestId] = (state.scores[guestId] ?? 0) + pts;
    }

    await this._save(roomId, state);
    io.to(roomId).emit("name_genre:answer_count", { count: Object.keys(state.answers).length });
  }

  private async _reveal(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (state.phase === "revealed") return;
    state.phase = "revealed";
    await this._save(roomId, state);
    io.to(roomId).emit("experience:state_updated", {
      phase: "revealed",
      correctGenre: state.correctGenre,
      trackTitle: state.trackTitle,
      trackArtist: state.trackArtist,
      answers: state.answers,
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

  private async _load(roomId: string): Promise<GenreRoundState> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : { phase: "waiting", roundNumber: 0, totalRounds: 5, correctGenre: null, options: [], trackTitle: null, trackArtist: null, isrc: null, answers: {}, scores: {}, roundStartedAt: null };
  }

  private async _save(roomId: string, state: GenreRoundState): Promise<void> {
    await redisClient.set(KEY(roomId), JSON.stringify(state), { EX: 14400 });
  }
}