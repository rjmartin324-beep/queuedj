import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";

// ─────────────────────────────────────────────────────────────────────────────
// Finish The Lyric Experience
//
// Host presents a lyric with the last word(s) blanked out.
// Guests type what comes next. Host picks the winner or it auto-scores
// by exact match. Points for correct + speed bonus.
// ─────────────────────────────────────────────────────────────────────────────

const KEY = (roomId: string) => `experience:finish_lyric:${roomId}`;
const ROUND_DURATION_MS = 25_000;

interface FinishLyricState {
  phase: "waiting" | "answering" | "voting" | "revealed";
  roundNumber: number;
  totalRounds: number;
  lyricPrompt: string | null;      // "Don't stop me now, 'cause I'm having a good ___"
  lyricAnswer: string | null;      // "time"
  trackTitle: string | null;
  trackArtist: string | null;
  submissions: Record<string, string>;  // guestId → answer
  submissionNames: Record<string, string>;
  scores: Record<string, number>;
  roundStartedAt: number | null;
}

// Built-in lyric bank for when no track metadata is available
const LYRIC_BANK = [
  { prompt: "Don't stop me now, 'cause I'm having a good ___", answer: "time", title: "Don't Stop Me Now", artist: "Queen" },
  { prompt: "Is this the real life? Is this just ___", answer: "fantasy", title: "Bohemian Rhapsody", artist: "Queen" },
  { prompt: "I will survive, oh as long as I know how to ___, I know I'll stay ___", answer: "love / alive", title: "I Will Survive", artist: "Gloria Gaynor" },
  { prompt: "We will, we will ___ you", answer: "rock", title: "We Will Rock You", artist: "Queen" },
  { prompt: "Sweet dreams are made of ___, who am I to ___", answer: "this / disagree", title: "Sweet Dreams", artist: "Eurythmics" },
  { prompt: "Hit me baby one more ___", answer: "time", title: "...Baby One More Time", artist: "Britney Spears" },
  { prompt: "Shake it off, shake it ___", answer: "off", title: "Shake It Off", artist: "Taylor Swift" },
  { prompt: "I've got the eye of the tiger, a fighter, dancing through the ___, 'cause I am a ___", answer: "fire / champion", title: "Roar", artist: "Katy Perry" },
  { prompt: "Somebody that I used to ___", answer: "know", title: "Somebody That I Used To Know", artist: "Gotye" },
  { prompt: "Rolling in the ___, we could've had it ___", answer: "deep / all", title: "Rolling in the Deep", artist: "Adele" },
];

export class FinishLyricExperience implements ExperienceModule {
  readonly type = "finish_lyric" as const;
  private usedIndices: Set<number> = new Set();

  async onActivate(roomId: string): Promise<void> {
    const state: FinishLyricState = {
      phase: "waiting",
      roundNumber: 0,
      totalRounds: 5,
      lyricPrompt: null,
      lyricAnswer: null,
      trackTitle: null,
      trackArtist: null,
      submissions: {},
      submissionNames: {},
      scores: {},
      roundStartedAt: null,
    };
    await this._save(roomId, state);
  }

  async onDeactivate(roomId: string): Promise<void> {}

  async handleAction({ action, payload, roomId, guestId, role, io }: {
    action: string; payload: unknown; roomId: string;
    guestId: string; role: "HOST" | "CO_HOST" | "GUEST"; io: Server;
  }): Promise<void> {
    const p = payload as any;

    switch (action) {
      case "start_round":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._startRound(roomId, p.prompt, p.answer, p.title, p.artist, io);
        break;

      case "start_round_random":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._startRoundRandom(roomId, io);
        break;

      case "submit_answer":
        await this._submitAnswer(roomId, guestId, p.answer, p.guestName ?? "Guest", io);
        break;

      case "reveal":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._reveal(roomId, io);
        break;

      case "award_bonus":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._awardBonus(roomId, p.guestId, io);
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
      view: state.phase === "revealed" ? "finish_lyric_reveal" : "finish_lyric_answering",
      data: {
        phase: state.phase,
        roundNumber: state.roundNumber,
        totalRounds: state.totalRounds,
        lyricPrompt: state.lyricPrompt,
        submissionCount: Object.keys(state.submissions).length,
        roundStartedAt: state.roundStartedAt,
        roundDurationMs: ROUND_DURATION_MS,
        revealedAnswer: state.phase === "revealed" ? state.lyricAnswer : null,
        revealedTitle: state.phase === "revealed" ? state.trackTitle : null,
        revealedArtist: state.phase === "revealed" ? state.trackArtist : null,
        scores: state.phase === "revealed" ? state.scores : {},
      },
    };
  }

  private async _startRound(roomId: string, prompt: string, answer: string, title: string, artist: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    state.phase = "answering";
    state.roundNumber += 1;
    state.lyricPrompt = prompt;
    state.lyricAnswer = answer;
    state.trackTitle = title;
    state.trackArtist = artist;
    state.submissions = {};
    state.submissionNames = {};
    state.roundStartedAt = Date.now();
    await this._save(roomId, state);
    io.to(roomId).emit("experience:state_updated", { phase: "answering", roundNumber: state.roundNumber, totalRounds: state.totalRounds, lyricPrompt: prompt, roundStartedAt: state.roundStartedAt, roundDurationMs: ROUND_DURATION_MS });
    setTimeout(() => this._reveal(roomId, io), ROUND_DURATION_MS);
  }

  private async _startRoundRandom(roomId: string, io: Server): Promise<void> {
    const available = LYRIC_BANK.filter((_, i) => !this.usedIndices.has(i));
    if (available.length === 0) this.usedIndices.clear();
    const pool = LYRIC_BANK.filter((_, i) => !this.usedIndices.has(i));
    const idx = Math.floor(Math.random() * pool.length);
    const lyric = pool[idx];
    this.usedIndices.add(LYRIC_BANK.indexOf(lyric));
    await this._startRound(roomId, lyric.prompt, lyric.answer, lyric.title, lyric.artist, io);
  }

  private async _submitAnswer(roomId: string, guestId: string, answer: string, guestName: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (state.phase !== "answering" || state.submissions[guestId]) return;
    state.submissions[guestId] = answer;
    state.submissionNames[guestId] = guestName;

    // Auto-score exact match
    const correct = answer.trim().toLowerCase() === state.lyricAnswer?.trim().toLowerCase();
    if (correct) {
      const pts = 300;
      state.scores[guestId] = (state.scores[guestId] ?? 0) + pts;
    }

    await this._save(roomId, state);
    io.to(roomId).emit("finish_lyric:submission_count", { count: Object.keys(state.submissions).length });
  }

  private async _reveal(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (state.phase === "revealed") return;
    state.phase = "revealed";
    await this._save(roomId, state);
    io.to(roomId).emit("experience:state_updated", {
      phase: "revealed",
      lyricAnswer: state.lyricAnswer,
      trackTitle: state.trackTitle,
      trackArtist: state.trackArtist,
      submissions: state.submissionNames,
      scores: state.scores,
    });
  }

  private async _awardBonus(roomId: string, targetGuestId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    state.scores[targetGuestId] = (state.scores[targetGuestId] ?? 0) + 200;
    await this._save(roomId, state);
    io.to(roomId).emit("finish_lyric:bonus_awarded", { guestId: targetGuestId, pts: 200 });
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

  private async _load(roomId: string): Promise<FinishLyricState> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : { phase: "waiting", roundNumber: 0, totalRounds: 5, lyricPrompt: null, lyricAnswer: null, trackTitle: null, trackArtist: null, submissions: {}, submissionNames: {}, scores: {}, roundStartedAt: null };
  }

  private async _save(roomId: string, state: FinishLyricState): Promise<void> {
    await redisClient.set(KEY(roomId), JSON.stringify(state), { EX: 14400 });
  }
}
