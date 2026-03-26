import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";

// ─────────────────────────────────────────────────────────────────────────────
// Hum It Experience
//
// The current hummer gets a song and hums it. Other guests tap "Got it" or
// "Missed it". After reveal: if majority got it → hummer +300 pts, each
// correct guesser +100 pts. Rotates through humers.
// ─────────────────────────────────────────────────────────────────────────────

const KEY = (roomId: string) => `experience:hum_it:${roomId}`;

const SONGS: Array<{ title: string; artist: string }> = [
  { title: "Happy Birthday",              artist: "Traditional" },
  { title: "Bohemian Rhapsody",           artist: "Queen" },
  { title: "Sweet Home Alabama",          artist: "Lynyrd Skynyrd" },
  { title: "Eye of the Tiger",            artist: "Survivor" },
  { title: "Don't Stop Believin'",        artist: "Journey" },
  { title: "We Will Rock You",            artist: "Queen" },
  { title: "Billie Jean",                 artist: "Michael Jackson" },
  { title: "Let It Go",                   artist: "Idina Menzel" },
  { title: "Old Town Road",               artist: "Lil Nas X" },
  { title: "Shape of You",                artist: "Ed Sheeran" },
];

interface HumItState {
  phase: "waiting" | "humming" | "guessing" | "reveal" | "finished";
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
  currentHummer: string | null;
  song: { title: string; artist: string } | null;
  guesses: Record<string, "got_it" | "missed">;  // guestId → guess
  hummerQueue: string[];
  usedSongIndices: number[];
}

export class HumItExperience implements ExperienceModule {
  readonly type = "hum_it" as const;

  async onActivate(roomId: string): Promise<void> {
    const state: HumItState = {
      phase: "waiting",
      round: 0,
      totalRounds: 6,
      scores: {},
      currentHummer: null,
      song: null,
      guesses: {},
      hummerQueue: [],
      usedSongIndices: [],
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
      // HOST: start the game
      case "start":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._start(roomId, p.guestIds as string[], io);
        break;

      // Current hummer: signal they are done humming
      case "done_humming":
        await this._doneHumming(roomId, guestId, io);
        break;

      // GUEST (non-hummer): submit a guess
      case "guess":
        await this._guess(roomId, guestId, p.result as "got_it" | "missed", io);
        break;

      // HOST: reveal results and award points
      case "reveal":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._reveal(roomId, io);
        break;

      // HOST: advance to next hummer
      case "next":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._next(roomId, io);
        break;

      // HOST: end early and return to DJ
      case "end":
        if (role !== "HOST") return;
        await this._end(roomId, io);
        break;
    }
  }

  async getGuestViewDescriptor(roomId: string): Promise<GuestViewDescriptor> {
    const state = await this._load(roomId);
    return {
      type: `hum_it_${state.phase}` as any,
      data: {
        phase: state.phase,
        round: state.round,
        totalRounds: state.totalRounds,
        currentHummer: state.currentHummer,
        // Only reveal song title in reveal phase; hide it while guessing
        song: state.phase === "reveal" || state.phase === "finished" ? state.song : null,
        guessCount: Object.keys(state.guesses).length,
        scores: state.scores,
      },
    };
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private _pickSong(state: HumItState): { title: string; artist: string } {
    const available = SONGS.map((_, i) => i).filter(i => !state.usedSongIndices.includes(i));
    const pool = available.length > 0 ? available : SONGS.map((_, i) => i);
    const idx = pool[Math.floor(Math.random() * pool.length)];
    state.usedSongIndices.push(idx);
    return SONGS[idx];
  }

  private async _start(roomId: string, guestIds: string[], io: Server): Promise<void> {
    const state = await this._load(roomId);
    const queue = [...guestIds].sort(() => Math.random() - 0.5);
    state.hummerQueue = queue.slice(1);
    state.currentHummer = queue[0] ?? null;
    state.song = this._pickSong(state);
    state.phase = "humming";
    state.round = 1;
    state.guesses = {};
    await this._save(roomId, state);

    // Send song title ONLY to the hummer via private socket
    if (state.currentHummer) {
      io.to(state.currentHummer).emit("hum_it:your_song", {
        title: state.song.title,
        artist: state.song.artist,
      });
    }

    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "hum_it",
      state: { ...state, song: null }, // keep song hidden from the room
      view: { type: "hum_it_humming" as any, data: { ...state, song: null } },
      sequenceId: seq,
    });
  }

  private async _doneHumming(roomId: string, guestId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (state.phase !== "humming" || state.currentHummer !== guestId) return;
    state.phase = "guessing";
    state.guesses = {};
    await this._save(roomId, state);

    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "hum_it",
      state: { ...state, song: null }, // still hidden
      view: { type: "hum_it_guessing" as any, data: { ...state, song: null } },
      sequenceId: seq,
    });
  }

  private async _guess(roomId: string, guestId: string, result: "got_it" | "missed", io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (state.phase !== "guessing") return;
    if (guestId === state.currentHummer) return; // hummer can't vote
    if (state.guesses[guestId] !== undefined) return;
    state.guesses[guestId] = result;
    await this._save(roomId, state);
    io.to(roomId).emit("hum_it:guess_count", { count: Object.keys(state.guesses).length });
  }

  private async _reveal(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (state.phase !== "guessing") return;

    const guessValues = Object.values(state.guesses);
    const gotItCount = guessValues.filter(g => g === "got_it").length;
    const majority = guessValues.length > 0 && gotItCount > guessValues.length / 2;

    if (majority && state.currentHummer) {
      state.scores[state.currentHummer] = (state.scores[state.currentHummer] ?? 0) + 300;
    }
    for (const [gid, result] of Object.entries(state.guesses)) {
      if (result === "got_it") {
        state.scores[gid] = (state.scores[gid] ?? 0) + 100;
      }
    }

    state.phase = "reveal";
    await this._save(roomId, state);

    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "hum_it",
      state, // full state with song revealed
      view: { type: "hum_it_reveal" as any, data: state },
      sequenceId: seq,
    });
  }

  private async _next(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (state.phase !== "reveal") return;

    if (state.round >= state.totalRounds || state.hummerQueue.length === 0) {
      state.phase = "finished";
      state.currentHummer = null;
      await this._save(roomId, state);
      const seq = await getNextSequenceId(roomId);
      io.to(roomId).emit("experience:state" as any, {
        experienceType: "hum_it",
        state,
        view: { type: "hum_it_finished" as any, data: state },
        sequenceId: seq,
      });
      return;
    }

    state.currentHummer = state.hummerQueue.shift() ?? null;
    state.song = this._pickSong(state);
    state.phase = "humming";
    state.round += 1;
    state.guesses = {};
    await this._save(roomId, state);

    if (state.currentHummer) {
      io.to(state.currentHummer).emit("hum_it:your_song", {
        title: state.song.title,
        artist: state.song.artist,
      });
    }

    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "hum_it",
      state: { ...state, song: null },
      view: { type: "hum_it_humming" as any, data: { ...state, song: null } },
      sequenceId: seq,
    });
  }

  private async _end(roomId: string, io: Server): Promise<void> {
    await redisClient.del(KEY(roomId));
    await redisClient.set(`room:${roomId}:experience`, "dj");
    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:changed" as any, {
      experienceType: "dj",
      view: { type: "dj_queue" },
      sequenceId: seq,
    });
  }

  private async _load(roomId: string): Promise<HumItState> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : {
      phase: "waiting", round: 0, totalRounds: 6, scores: {},
      currentHummer: null, song: null, guesses: {}, hummerQueue: [], usedSongIndices: [],
    };
  }

  private async _save(roomId: string, state: HumItState): Promise<void> {
    await redisClient.set(KEY(roomId), JSON.stringify(state), { EX: 14400 });
  }
}
