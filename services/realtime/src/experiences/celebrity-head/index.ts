import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";

// ─────────────────────────────────────────────────────────────────────────────
// Celebrity Head Experience
//
// A celebrity is secretly assigned to a guest. Other guests and the host can
// see it — the target guest cannot. The target asks yes/no questions to
// figure out who they are. Getting it right earns +400 pts.
//
// Actions:
//   HOST:  start, answer_yes, answer_no, got_it (if host confirms), pass, end
//   GUEST: got_it (self guess), pass
// ─────────────────────────────────────────────────────────────────────────────

const CELEBRITIES: string[] = [
  // ── Global Megastars ──────────────────────────────────────────────────────
  "Taylor Swift",
  "Elon Musk",
  "Beyoncé",
  "LeBron James",
  "Rihanna",
  "Kanye West",
  "Oprah Winfrey",
  "Justin Bieber",
  "Adele",
  "Drake",
  "Kim Kardashian",
  "Cristiano Ronaldo",
  "Lady Gaga",
  "The Rock",
  "Billie Eilish",
  "Zendaya",
  "Bad Bunny",
  "Harry Styles",
  // ── Music ─────────────────────────────────────────────────────────────────
  "Ariana Grande",
  "Ed Sheeran",
  "Post Malone",
  "Lizzo",
  "Dua Lipa",
  "The Weeknd",
  "Olivia Rodrigo",
  "Kendrick Lamar",
  "Bruno Mars",
  "Nicki Minaj",
  "Cardi B",
  "Eminem",
  "Jay-Z",
  "Miley Cyrus",
  "Katy Perry",
  "Justin Timberlake",
  "Selena Gomez",
  "Lana Del Rey",
  "SZA",
  "Sabrina Carpenter",
  "Charli XCX",
  "Tyler the Creator",
  "Doja Cat",
  "Megan Thee Stallion",
  "Lil Nas X",
  "Coldplay",
  "Arctic Monkeys",
  "Sam Smith",
  "Elton John",
  "Madonna",
  "Britney Spears",
  "Mariah Carey",
  "Whitney Houston",
  "Michael Jackson",
  "Prince",
  "David Bowie",
  "Freddie Mercury",
  "Bob Dylan",
  "Paul McCartney",
  "Stevie Wonder",
  // ── Film & TV ─────────────────────────────────────────────────────────────
  "Tom Hanks",
  "Meryl Streep",
  "Leonardo DiCaprio",
  "Jennifer Lawrence",
  "Brad Pitt",
  "Angelina Jolie",
  "Will Smith",
  "Margot Robbie",
  "Ryan Reynolds",
  "Scarlett Johansson",
  "Chris Evans",
  "Robert Downey Jr.",
  "Cate Blanchett",
  "Timothée Chalamet",
  "Viola Davis",
  "Pedro Pascal",
  "Florence Pugh",
  "Denzel Washington",
  "Halle Berry",
  "Johnny Depp",
  "Hugh Jackman",
  "Chris Hemsworth",
  "Keanu Reeves",
  "Natalie Portman",
  "Anne Hathaway",
  "Emma Watson",
  "Daniel Radcliffe",
  "Rupert Grint",
  "Sandra Bullock",
  "Julia Roberts",
  "George Clooney",
  "Harrison Ford",
  "Tom Cruise",
  "Morgan Freeman",
  "Samuel L. Jackson",
  "Joaquin Phoenix",
  "Cillian Murphy",
  "Paul Mescal",
  "Andrew Garfield",
  "Jenna Ortega",
  "Sydney Sweeney",
  "Adam Driver",
  "Anya Taylor-Joy",
  "Jeremy Allen White",
  "Austin Butler",
  "Jacob Elordi",
  // ── Sport ─────────────────────────────────────────────────────────────────
  "Lionel Messi",
  "Serena Williams",
  "Usain Bolt",
  "Simone Biles",
  "Roger Federer",
  "Rafael Nadal",
  "Novak Djokovic",
  "Tiger Woods",
  "Michael Jordan",
  "Kobe Bryant",
  "Muhammad Ali",
  "Pelé",
  "Mike Tyson",
  "Lewis Hamilton",
  "Max Verstappen",
  "Naomi Osaka",
  "Steph Curry",
  "Kevin Durant",
  "Caitlin Clark",
  "Erling Haaland",
  "Jude Bellingham",
  "Marcus Rashford",
  "Raheem Sterling",
  "Mo Salah",
  "Virgil van Dijk",
  "Zlatan Ibrahimović",
  "Neymar",
  "Kylian Mbappé",
  // ── Politics & Business ───────────────────────────────────────────────────
  "Barack Obama",
  "Michelle Obama",
  "Donald Trump",
  "Joe Biden",
  "Jeff Bezos",
  "Mark Zuckerberg",
  "Bill Gates",
  "Steve Jobs",
  "Malala Yousafzai",
  "Greta Thunberg",
  "King Charles III",
  "Prince William",
  "Princess Kate",
  "Prince Harry",
  "Meghan Markle",
  // ── Comedy & TV Hosts ─────────────────────────────────────────────────────
  "Jimmy Fallon",
  "Jimmy Kimmel",
  "Stephen Colbert",
  "James Corden",
  "Graham Norton",
  "Conan O'Brien",
  "Ellen DeGeneres",
  "Kevin Hart",
  "Dave Chappelle",
  "Amy Schumer",
  "Tiffany Haddish",
  "John Mulaney",
  "Bo Burnham",
  "Hannah Gadsby",
  "Ricky Gervais",
  "John Oliver",
  "Trevor Noah",
  "Sacha Baron Cohen",
  // ── Influencers & Internet ────────────────────────────────────────────────
  "MrBeast",
  "PewDiePie",
  "Addison Rae",
  "Charli D'Amelio",
  "David Dobrik",
  "Emma Chamberlain",
  "Khaby Lame",
  "Alix Earle",
  "Logan Paul",
  "KSI",
  "Pokimane",
  // ── Harder / More Obscure ─────────────────────────────────────────────────
  "Björk",
  "Nick Cave",
  "Thom Yorke",
  "Frank Ocean",
  "Arca",
  "Joni Mitchell",
  "Kate Bush",
  "Phoebe Bridgers",
  "Mitski",
  "St. Vincent",
  "Chet Baker",
  "Elliott Smith",
  "Jeff Buckley",
  "Arthur Russell",
  "Sofia Coppola",
  "Werner Herzog",
  "Stanley Kubrick",
  "David Lynch",
  "Wes Anderson",
  "Guillermo del Toro",
  "Christopher Nolan",
  "Denis Villeneuve",
  "Hayao Miyazaki",
  "Akira Kurosawa",
  "Pedro Almodóvar",
  "Patti Smith",
  "Lou Reed",
  "Iggy Pop",
  "David Byrne",
  "Brian Eno",
  "Tom Waits",
  "Leonard Cohen",
  "Jacques Cousteau",
  "David Attenborough",
  "Carl Sagan",
  "Neil deGrasse Tyson",
  "Richard Feynman",
  "Noam Chomsky",
];

interface CelebrityHeadState {
  phase: "waiting" | "playing" | "reveal" | "finished";
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
  currentGuestId: string | null;
  celebrity: string | null;
  questionsAsked: number;
  gotIt: boolean;
  usedCelebrities: string[];
}

const KEY = (roomId: string) => `experience:celebrity_head:${roomId}`;

export class CelebrityHeadExperience implements ExperienceModule {
  readonly type = "celebrity_head" as const;
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  async onActivate(roomId: string, _hostGuestId: string): Promise<void> {
    const state: CelebrityHeadState = {
      phase: "waiting",
      round: 0,
      totalRounds: 5,
      scores: {},
      currentGuestId: null,
      celebrity: null,
      questionsAsked: 0,
      gotIt: false,
      usedCelebrities: [],
    };
    await redisClient.set(KEY(roomId), JSON.stringify(state));
  }

  async onDeactivate(roomId: string): Promise<void> {
    this.timers.forEach(t => clearTimeout(t));
    this.timers.clear();
    await redisClient.del(KEY(roomId));
  }

  private _pickCelebrity(used: string[]): string {
    const remaining = CELEBRITIES.filter(c => !used.includes(c));
    const pool = remaining.length > 0 ? remaining : CELEBRITIES;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  async handleAction({ action, payload, roomId, guestId, role, io }: {
    action: string;
    payload: unknown;
    roomId: string;
    guestId: string;
    role: "HOST" | "CO_HOST" | "GUEST";
    io: Server;
  }): Promise<void> {
    const raw = await redisClient.get(KEY(roomId));
    if (!raw) return;
    const state: CelebrityHeadState = JSON.parse(raw);

    switch (action) {
      case "start": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        const p = payload as { guestIds: string[] };
        if (!p?.guestIds?.length) return;
        const firstGuest = p.guestIds[0];
        const celeb = this._pickCelebrity(state.usedCelebrities);
        state.phase = "playing";
        state.round = 1;
        state.currentGuestId = firstGuest;
        state.celebrity = celeb;
        state.questionsAsked = 0;
        state.gotIt = false;
        state.usedCelebrities = [...state.usedCelebrities, celeb];
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        // Send full state to all — the UI is responsible for hiding the
        // celebrity from the current player using currentGuestId
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "celebrity_head",
          state,
          view: { type: "celebrity_head", data: state },
          sequenceId: seq,
        });
        break;
      }

      case "answer_yes": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        if (state.phase !== "playing") return;
        state.questionsAsked += 1;
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "celebrity_head",
          state,
          view: { type: "celebrity_head", data: { ...state, lastAnswer: "yes" } },
          sequenceId: seq,
        });
        break;
      }

      case "answer_no": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        if (state.phase !== "playing") return;
        state.questionsAsked += 1;
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "celebrity_head",
          state,
          view: { type: "celebrity_head", data: { ...state, lastAnswer: "no" } },
          sequenceId: seq,
        });
        break;
      }

      case "got_it": {
        // Either the current guest self-declares, or host confirms
        const isCurrentGuest = guestId === state.currentGuestId;
        const isAuthority = role === "HOST" || role === "CO_HOST";
        if (!isCurrentGuest && !isAuthority) return;
        if (state.phase !== "playing" || !state.currentGuestId) return;
        state.scores[state.currentGuestId] =
          (state.scores[state.currentGuestId] ?? 0) + 400;
        state.gotIt = true;
        state.phase = "reveal";
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "celebrity_head",
          state,
          view: { type: "celebrity_head", data: state },
          sequenceId: seq,
        });
        clearTimeout(this.timers.get(`${roomId}:reveal`));
        this.timers.set(`${roomId}:reveal`, setTimeout(async () => {
          try {
            const raw2 = await redisClient.get(KEY(roomId));
            const st: CelebrityHeadState | null = raw2 ? JSON.parse(raw2) : null;
            if (st?.phase === "reveal") {
              const seqLb = await getNextSequenceId(roomId);
              io.to(roomId).emit("experience:state" as any, {
                experienceType: "celebrity_head",
                state: st,
                view: { type: "leaderboard", data: st.scores },
                sequenceId: seqLb,
              });
            }
          } catch {}
          this.timers.set(`${roomId}:advance`, setTimeout(() => this.handleAction({ action: "next", payload: {}, roomId, guestId: "", role: "HOST", io }).catch(() => {}), 3000));
        }, 4000));
        break;
      }

      case "pass": {
        if (state.phase !== "playing") return;
        // No pts awarded — just advance round
        state.phase = "reveal";
        state.gotIt = false;
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq2 = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "celebrity_head",
          state,
          view: { type: "celebrity_head", data: state },
          sequenceId: seq2,
        });
        clearTimeout(this.timers.get(`${roomId}:reveal`));
        this.timers.set(`${roomId}:reveal`, setTimeout(async () => {
          try {
            const raw2 = await redisClient.get(KEY(roomId));
            const st: CelebrityHeadState | null = raw2 ? JSON.parse(raw2) : null;
            if (st?.phase === "reveal") {
              const seqLb = await getNextSequenceId(roomId);
              io.to(roomId).emit("experience:state" as any, {
                experienceType: "celebrity_head",
                state: st,
                view: { type: "leaderboard", data: st.scores },
                sequenceId: seqLb,
              });
            }
          } catch {}
          this.timers.set(`${roomId}:advance`, setTimeout(() => this.handleAction({ action: "next", payload: {}, roomId, guestId: "", role: "HOST", io }).catch(() => {}), 3000));
        }, 4000));
        break;
      }

      case "next": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        if (state.phase !== "reveal") return;
        const p = payload as { guestIds?: string[] };
        state.round += 1;
        if (state.round > state.totalRounds) {
          state.phase = "finished";
          state.celebrity = null;
          state.currentGuestId = null;
          await redisClient.set(KEY(roomId), JSON.stringify(state));
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "celebrity_head",
            state,
            view: { type: "leaderboard", data: state.scores },
            sequenceId: seq,
          });
        } else {
          const celeb = this._pickCelebrity(state.usedCelebrities);
          let nextGuest = state.currentGuestId;
          if (p?.guestIds?.length) {
            const idx = p.guestIds.indexOf(state.currentGuestId ?? "");
            nextGuest = p.guestIds[(idx + 1) % p.guestIds.length];
          }
          state.phase = "playing";
          state.celebrity = celeb;
          state.currentGuestId = nextGuest;
          state.questionsAsked = 0;
          state.gotIt = false;
          state.usedCelebrities = [...state.usedCelebrities, celeb];
          await redisClient.set(KEY(roomId), JSON.stringify(state));
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "celebrity_head",
            state,
            view: { type: "celebrity_head", data: state },
            sequenceId: seq,
          });
        }
        break;
      }

      case "end": {
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
  }

  async getGuestViewDescriptor(roomId: string): Promise<GuestViewDescriptor> {
    const raw = await redisClient.get(KEY(roomId));
    if (!raw) return { type: "intermission" };
    const state: CelebrityHeadState = JSON.parse(raw);
    if (state.phase === "finished") return { type: "leaderboard", data: state.scores };
    return { type: "celebrity_head" as any, data: state };
  }

  async getBootstrapState(roomId: string): Promise<unknown> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }
}