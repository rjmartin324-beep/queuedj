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
  // ── Easy & Recognisable ───────────────────────────────────────────────────
  { title: "Twinkle Twinkle Little Star", artist: "Traditional" },
  { title: "Jingle Bells",               artist: "Traditional" },
  { title: "Seven Nation Army",          artist: "The White Stripes" },
  { title: "Another One Bites the Dust", artist: "Queen" },
  { title: "Sweet Child O' Mine",        artist: "Guns N' Roses" },
  { title: "Beat It",                    artist: "Michael Jackson" },
  { title: "Jump",                       artist: "Van Halen" },
  { title: "Under Pressure",             artist: "Queen & David Bowie" },
  { title: "Smells Like Teen Spirit",    artist: "Nirvana" },
  { title: "Come As You Are",            artist: "Nirvana" },
  { title: "Africa",                     artist: "Toto" },
  { title: "Take On Me",                 artist: "A-ha" },
  { title: "Girls Just Want to Have Fun",artist: "Cyndi Lauper" },
  { title: "Wake Me Up Before You Go-Go",artist: "Wham!" },
  { title: "Livin' on a Prayer",         artist: "Bon Jovi" },
  { title: "Don't You (Forget About Me)",artist: "Simple Minds" },
  { title: "99 Luftballons",             artist: "Nena" },
  { title: "Total Eclipse of the Heart", artist: "Bonnie Tyler" },
  { title: "Every Breath You Take",      artist: "The Police" },
  { title: "Dancing Queen",              artist: "ABBA" },
  { title: "Waterloo",                   artist: "ABBA" },
  { title: "Fernando",                   artist: "ABBA" },
  { title: "Mamma Mia",                  artist: "ABBA" },
  { title: "Hotel California",           artist: "Eagles" },
  { title: "Stairway to Heaven",         artist: "Led Zeppelin" },
  { title: "Smoke on the Water",         artist: "Deep Purple" },
  { title: "Welcome to the Jungle",      artist: "Guns N' Roses" },
  { title: "Pour Some Sugar on Me",      artist: "Def Leppard" },
  { title: "Living on a Prayer",         artist: "Bon Jovi" },
  // ── Modern Pop ────────────────────────────────────────────────────────────
  { title: "Uptown Funk",               artist: "Bruno Mars ft. Mark Ronson" },
  { title: "Happy",                     artist: "Pharrell Williams" },
  { title: "Blinding Lights",           artist: "The Weeknd" },
  { title: "Stay With Me",              artist: "Sam Smith" },
  { title: "Rolling in the Deep",       artist: "Adele" },
  { title: "Someone Like You",          artist: "Adele" },
  { title: "Hello",                     artist: "Adele" },
  { title: "Shake It Off",              artist: "Taylor Swift" },
  { title: "Love Story",                artist: "Taylor Swift" },
  { title: "Bad Blood",                 artist: "Taylor Swift" },
  { title: "Dynamite",                  artist: "BTS" },
  { title: "Butter",                    artist: "BTS" },
  { title: "Levitating",               artist: "Dua Lipa" },
  { title: "Don't Start Now",           artist: "Dua Lipa" },
  { title: "As It Was",                 artist: "Harry Styles" },
  { title: "Watermelon Sugar",          artist: "Harry Styles" },
  { title: "drivers license",           artist: "Olivia Rodrigo" },
  { title: "good 4 u",                  artist: "Olivia Rodrigo" },
  { title: "Flowers",                   artist: "Miley Cyrus" },
  { title: "Anti-Hero",                 artist: "Taylor Swift" },
  { title: "Die With A Smile",          artist: "Lady Gaga & Bruno Mars" },
  { title: "Espresso",                  artist: "Sabrina Carpenter" },
  { title: "Please Please Please",      artist: "Sabrina Carpenter" },
  { title: "360",                       artist: "Charli XCX" },
  // ── Game & TV Themes ──────────────────────────────────────────────────────
  { title: "Super Mario Bros Theme",    artist: "Koji Kondo" },
  { title: "The Legend of Zelda Theme", artist: "Koji Kondo" },
  { title: "Tetris Theme",              artist: "Traditional" },
  { title: "Game of Thrones Theme",     artist: "Ramin Djawadi" },
  { title: "Friends Theme",             artist: "The Rembrandts" },
  { title: "Seinfeld Theme",            artist: "Jonathan Wolff" },
  { title: "The Office Theme",          artist: "Jay Ferguson" },
  { title: "SpongeBob Theme",           artist: "Mark Harrison" },
  { title: "Pokemon Theme",             artist: "Jason Paige" },
  { title: "Mission Impossible Theme",  artist: "Lalo Schifrin" },
  { title: "James Bond Theme",          artist: "Monty Norman" },
  { title: "Jurassic Park Theme",       artist: "John Williams" },
  { title: "Star Wars Main Theme",      artist: "John Williams" },
  { title: "Harry Potter Theme",        artist: "John Williams" },
  { title: "Indiana Jones Theme",       artist: "John Williams" },
  { title: "Schindler's List Theme",    artist: "John Williams" },
  { title: "Jaws Theme",                artist: "John Williams" },
  // ── Harder ────────────────────────────────────────────────────────────────
  { title: "Running Up That Hill",      artist: "Kate Bush" },
  { title: "This Woman's Work",         artist: "Kate Bush" },
  { title: "Wuthering Heights",         artist: "Kate Bush" },
  { title: "Blue (Da Ba Dee)",          artist: "Eiffel 65" },
  { title: "Barbie Girl",               artist: "Aqua" },
  { title: "Sandstorm",                 artist: "Darude" },
  { title: "Kernkraft 400",             artist: "Zombie Nation" },
  { title: "Blue Monday",               artist: "New Order" },
  { title: "Gold",                      artist: "Spandau Ballet" },
  { title: "Don't You Want Me",         artist: "Human League" },
  { title: "Tainted Love",              artist: "Soft Cell" },
  { title: "Bizarre Love Triangle",     artist: "New Order" },
  { title: "Common People",             artist: "Pulp" },
  { title: "Parklife",                  artist: "Blur" },
  { title: "Wonderwall",                artist: "Oasis" },
  { title: "Champagne Supernova",       artist: "Oasis" },
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
    setTimeout(async () => {
      try {
        const raw2 = await redisClient.get(KEY(roomId));
        const st: HumItState | null = raw2 ? JSON.parse(raw2) : null;
        if (st?.phase === "reveal") {
          const seqLb = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "hum_it",
            state: st,
            view: { type: "leaderboard", data: st.scores },
            sequenceId: seqLb,
          });
        }
      } catch {}
      setTimeout(() => this._next(roomId, io).catch(() => {}), 3000);
    }, 5000);
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
