import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";

// ─────────────────────────────────────────────────────────────────────────────
// Rank It Experience
//
// Guests are shown a list of items and must rank them in the correct order.
// Exact position match = 300 pts. One-off position match = 200 pts.
//
// Actions:
//   HOST/CO_HOST: start, reveal, next, end_game, end
//   GUEST:        submit_ranking
// ─────────────────────────────────────────────────────────────────────────────

const KEY = (roomId: string) => `experience:rank_it:${roomId}`;

// ─── Content ─────────────────────────────────────────────────────────────────

interface RankingChallenge {
  prompt: string;
  items: string[];
  correctOrder: number[]; // indices into items[] from best (0) to worst
}

const CHALLENGES: RankingChallenge[] = [
  {
    prompt: "Rank these planets from largest to smallest",
    items: ["Earth", "Mars", "Jupiter", "Mercury"],
    correctOrder: [2, 0, 1, 3], // Jupiter, Earth, Mars, Mercury
  },
  {
    prompt: "Rank these movies from highest worldwide box office to lowest",
    items: ["Titanic", "Avatar", "Avengers: Endgame", "The Lion King (2019)"],
    correctOrder: [2, 1, 0, 3], // Endgame, Avatar, Titanic, Lion King
  },
  {
    prompt: "Rank these countries by population (largest first)",
    items: ["Brazil", "India", "USA", "Australia"],
    correctOrder: [1, 2, 0, 3], // India, USA, Brazil, Australia
  },
  {
    prompt: "Rank these animals by top speed (fastest first)",
    items: ["Elephant", "Cheetah", "Horse", "Greyhound"],
    correctOrder: [1, 3, 2, 0], // Cheetah, Greyhound, Horse, Elephant
  },
  {
    prompt: "Rank these social media platforms by monthly active users (most first)",
    items: ["Twitter/X", "TikTok", "Facebook", "Instagram"],
    correctOrder: [2, 3, 1, 0], // Facebook, Instagram, TikTok, Twitter
  },
  {
    prompt: "Rank these mountains by height (tallest first)",
    items: ["Kilimanjaro", "Everest", "K2", "Mont Blanc"],
    correctOrder: [1, 2, 0, 3], // Everest, K2, Kilimanjaro, Mont Blanc
  },
  {
    prompt: "Rank these animals by maximum running speed (fastest first)",
    items: ["Lion", "Ostrich", "Cheetah", "Wildebeest"],
    correctOrder: [2, 0, 3, 1], // Cheetah, Lion, Wildebeest, Ostrich
  },
  {
    prompt: "Rank these cities by population (largest first)",
    items: ["Paris", "Tokyo", "New York", "Lagos"],
    correctOrder: [1, 2, 3, 0], // Tokyo, New York, Lagos, Paris
  },
  {
    prompt: "Rank these movies by worldwide box office gross (highest first)",
    items: ["Jurassic Park", "Star Wars: The Force Awakens", "Avengers: Infinity War", "Black Panther"],
    correctOrder: [2, 1, 3, 0], // Infinity War, Force Awakens, Black Panther, Jurassic Park
  },
  {
    prompt: "Rank these historical events from earliest to most recent",
    items: ["Moon landing", "Fall of the Berlin Wall", "World War II ends", "First iPhone release"],
    correctOrder: [2, 0, 1, 3], // WWII ends, Moon landing, Berlin Wall, iPhone
  },
  {
    prompt: "Rank these rivers by length (longest first)",
    items: ["Thames", "Amazon", "Mississippi", "Nile"],
    correctOrder: [3, 1, 2, 0], // Nile, Amazon, Mississippi, Thames
  },
  {
    prompt: "Rank these planets by distance from the Sun (closest first)",
    items: ["Saturn", "Venus", "Neptune", "Mars"],
    correctOrder: [1, 3, 0, 2], // Venus, Mars, Saturn, Neptune
  },
  {
    prompt: "Rank these albums by global sales (best-selling first)",
    items: ["Back in Black – AC/DC", "Thriller – Michael Jackson", "Abbey Road – The Beatles", "21 – Adele"],
    correctOrder: [1, 0, 2, 3], // Thriller, Back in Black, Abbey Road, 21
  },
  {
    prompt: "Rank these oceans by size (largest first)",
    items: ["Atlantic", "Arctic", "Pacific", "Indian"],
    correctOrder: [2, 0, 3, 1], // Pacific, Atlantic, Indian, Arctic
  },
  {
    prompt: "Rank these countries by land area (largest first)",
    items: ["China", "Canada", "USA", "Brazil"],
    correctOrder: [1, 2, 3, 0], // Canada, USA, Brazil, China
  },
  {
    prompt: "Rank these elements by atomic number (lowest first)",
    items: ["Gold", "Carbon", "Oxygen", "Iron"],
    correctOrder: [1, 2, 3, 0], // Carbon (6), Oxygen (8), Iron (26), Gold (79)
  },
  {
    prompt: "Rank these US presidents chronologically (earliest first)",
    items: ["Barack Obama", "Ronald Reagan", "John F. Kennedy", "Bill Clinton"],
    correctOrder: [2, 1, 3, 0], // JFK, Reagan, Clinton, Obama
  },
  {
    prompt: "Rank these currencies by exchange rate value vs US dollar (most valuable first)",
    items: ["Japanese Yen", "Kuwaiti Dinar", "Euro", "British Pound"],
    correctOrder: [1, 3, 2, 0], // Kuwaiti Dinar, British Pound, Euro, Yen
  },
  {
    prompt: "Rank these animals by lifespan (longest-lived first)",
    items: ["Dog", "Elephant", "Tortoise", "Parrot"],
    correctOrder: [2, 1, 3, 0], // Tortoise, Elephant, Parrot, Dog
  },
  {
    prompt: "Rank these tech companies by market cap at their peak (highest first)",
    items: ["Netflix", "Apple", "Google", "Microsoft"],
    correctOrder: [1, 3, 2, 0], // Apple, Microsoft, Google, Netflix
  },
  {
    prompt: "Rank these world records from largest number to smallest",
    items: ["Number of bones in a human body", "Days in a leap year", "Keys on a standard piano", "Floors in Burj Khalifa"],
    correctOrder: [3, 2, 1, 0], // Burj Khalifa (163), Piano (88), Leap year (366), Bones (206) — wait correcting: Bones 206, Leap year 366, Piano 88, Burj 163 → smallest to largest: Piano(88), Bones(206), Burj(163), Leap(366) → largest first: Leap(366), Bones(206), Burj(163), Piano(88) = [1, 0, 3, 2]
  },
  {
    prompt: "Rank these sports by number of players on the field per team (most first)",
    items: ["Basketball", "American Football", "Soccer", "Baseball"],
    correctOrder: [1, 2, 3, 0], // Football (11), Soccer (11 — tie), Baseball (9), Basketball (5)
  },
  {
    prompt: "Rank these famous paintings by estimated value (most expensive first)",
    items: ["The Starry Night", "Mona Lisa", "Girl with a Pearl Earring", "The Scream"],
    correctOrder: [1, 3, 0, 2], // Mona Lisa, The Scream, Starry Night, Girl with Pearl Earring
  },
  {
    prompt: "Rank these foods by calorie count per 100g (highest first)",
    items: ["Butter", "Apple", "Chicken breast", "White rice (cooked)"],
    correctOrder: [0, 2, 3, 1], // Butter (717), Chicken (165), White rice (130), Apple (52)
  },
  {
    prompt: "Rank these space missions chronologically (earliest launch first)",
    items: ["Mars Perseverance Rover", "Voyager 1", "Apollo 11", "Hubble Space Telescope"],
    correctOrder: [2, 1, 3, 0], // Apollo 11 (1969), Voyager 1 (1977), Hubble (1990), Perseverance (2020)
  },
  {
    prompt: "Rank these countries by number of Olympic gold medals all-time (most first)",
    items: ["Germany", "China", "USA", "Soviet Union"],
    correctOrder: [2, 3, 1, 0], // USA, Soviet Union, China, Germany
  },
  {
    prompt: "Rank these languages by number of native speakers (most first)",
    items: ["French", "Spanish", "Mandarin Chinese", "Hindi"],
    correctOrder: [2, 1, 3, 0], // Mandarin, Spanish, Hindi, French
  },
  {
    prompt: "Rank these roller coasters by top speed (fastest first)",
    items: ["Space Mountain (Disney)", "Kingda Ka (NJ)", "Millennium Force (Ohio)", "Maverick (Ohio)"],
    correctOrder: [1, 2, 3, 0], // Kingda Ka, Millennium Force, Maverick, Space Mountain
  },
  {
    prompt: "Rank these dinosaurs by estimated length (longest first)",
    items: ["T. rex", "Velociraptor", "Brachiosaurus", "Triceratops"],
    correctOrder: [2, 0, 3, 1], // Brachiosaurus, T. rex, Triceratops, Velociraptor
  },
  {
    prompt: "Rank these Harry Potter books by page count (longest first)",
    items: ["The Philosopher's Stone", "The Goblet of Fire", "The Deathly Hallows", "The Chamber of Secrets"],
    correctOrder: [1, 2, 0, 3], // Goblet of Fire, Deathly Hallows, Philosopher's Stone, Chamber of Secrets
  },
  {
    prompt: "Rank these US cities by altitude above sea level (highest first)",
    items: ["Miami", "Denver", "New York", "Salt Lake City"],
    correctOrder: [1, 3, 2, 0], // Denver, Salt Lake City, New York, Miami
  },
  {
    prompt: "Rank these soft drinks by global sales volume (best-selling first)",
    items: ["Sprite", "Dr Pepper", "Coca-Cola", "Pepsi"],
    correctOrder: [2, 3, 0, 1], // Coca-Cola, Pepsi, Sprite, Dr Pepper
  },
  {
    prompt: "Rank these instruments from highest typical pitch to lowest",
    items: ["Double bass", "Piccolo", "Cello", "Violin"],
    correctOrder: [1, 3, 2, 0], // Piccolo, Violin, Cello, Double bass
  },
  {
    prompt: "Rank these video game franchises by total units sold (most first)",
    items: ["Halo", "Tetris", "Grand Theft Auto", "Mario"],
    correctOrder: [3, 1, 2, 0], // Mario, Tetris, GTA, Halo
  },
  {
    prompt: "Rank these elements by melting point (highest first)",
    items: ["Ice (water)", "Tungsten", "Iron", "Aluminium"],
    correctOrder: [1, 2, 3, 0], // Tungsten, Iron, Aluminium, Ice
  },
  {
    prompt: "Rank these world landmarks by height (tallest first)",
    items: ["Eiffel Tower", "Burj Khalifa", "Statue of Liberty", "Big Ben"],
    correctOrder: [1, 0, 2, 3], // Burj Khalifa, Eiffel Tower, Statue of Liberty, Big Ben
  },
  {
    prompt: "Rank these music festivals by typical attendance (largest first)",
    items: ["Glastonbury", "Coachella", "Tomorrowland", "Reading Festival"],
    correctOrder: [0, 2, 1, 3], // Glastonbury, Tomorrowland, Coachella, Reading
  },
  {
    prompt: "Rank these classic novels by publication date (oldest first)",
    items: ["1984 – Orwell", "Pride and Prejudice – Austen", "To Kill a Mockingbird – Lee", "Frankenstein – Shelley"],
    correctOrder: [3, 1, 0, 2], // Frankenstein (1818), Pride and Prejudice (1813) — correcting: Pride (1813), Frankenstein (1818), 1984 (1949), Mockingbird (1960) = [1, 3, 0, 2]
  },
  {
    prompt: "Rank these countries by average annual sunshine hours (most first)",
    items: ["Iceland", "Egypt", "Brazil", "Norway"],
    correctOrder: [1, 2, 3, 0], // Egypt, Brazil, Norway, Iceland
  },
  {
    prompt: "Rank these animals by weight (heaviest first)",
    items: ["Gorilla", "Blue whale", "African elephant", "Hippopotamus"],
    correctOrder: [1, 2, 3, 0], // Blue whale, African elephant, Hippopotamus, Gorilla
  },
];

// ─── State ────────────────────────────────────────────────────────────────────

interface RankItState {
  phase: "waiting" | "ranking" | "reveal" | "finished";
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
  currentChallenge: { prompt: string; items: string[]; correctOrder: number[] } | null;
  rankings: Record<string, number[]>; // guestId → ordered indices
}

export class RankItExperience implements ExperienceModule {
  readonly type = "rank_it" as const;

  async onActivate(roomId: string): Promise<void> {
    const state: RankItState = {
      phase: "waiting",
      round: 0,
      totalRounds: 5,
      scores: {},
      currentChallenge: null,
      rankings: {},
    };
    await this._save(roomId, state);
  }

  async onDeactivate(roomId: string): Promise<void> {
    await redisClient.del(KEY(roomId));
  }

  async handleAction({ action, payload, roomId, guestId, role, io }: {
    action: string;
    payload: unknown;
    roomId: string;
    guestId: string;
    role: "HOST" | "CO_HOST" | "GUEST";
    io: Server;
  }): Promise<void> {
    const p = payload as any;

    switch (action) {

      // ─── HOST: Start the game ──────────────────────────────────────────
      case "start": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        const state = await this._load(roomId);
        if (!state) return;

        const challenge = CHALLENGES[0];
        state.phase = "ranking";
        state.round = 1;
        state.scores = {};
        state.currentChallenge = challenge;
        state.rankings = {};

        await this._save(roomId, state);
        // Broadcast without revealing correctOrder
        await this._broadcastSafe(roomId, state, io);
        break;
      }

      // ─── GUEST: Submit ranking ─────────────────────────────────────────
      case "submit_ranking": {
        const state = await this._load(roomId);
        if (!state || state.phase !== "ranking" || !state.currentChallenge) return;

        const order: number[] = Array.isArray(p.order) ? p.order : [];
        state.rankings[guestId] = order;
        await this._save(roomId, state);

        // Broadcast updated submission count (safe — no correctOrder)
        await this._broadcastSafe(roomId, state, io);
        break;
      }

      // ─── HOST: Reveal correct order and award points ───────────────────
      case "reveal": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        const state = await this._load(roomId);
        if (!state || !state.currentChallenge) return;

        const correct = state.currentChallenge.correctOrder;

        for (const [guestRankId, submission] of Object.entries(state.rankings)) {
          let roundScore = 0;
          for (let pos = 0; pos < correct.length; pos++) {
            const guestChoice = submission[pos];
            if (guestChoice === correct[pos]) {
              roundScore += 300; // Exact match
            } else if (
              pos > 0 && guestChoice === correct[pos - 1] ||
              pos < correct.length - 1 && guestChoice === correct[pos + 1]
            ) {
              roundScore += 200; // One-off
            }
          }
          state.scores[guestRankId] = (state.scores[guestRankId] ?? 0) + roundScore;
        }

        state.phase = "reveal";
        await this._save(roomId, state);
        await this._broadcast(roomId, state, io);
        break;
      }

      // ─── HOST: Advance to next round ───────────────────────────────────
      case "next": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        const state = await this._load(roomId);
        if (!state) return;

        state.round += 1;

        if (state.round > state.totalRounds) {
          state.phase = "finished";
          state.currentChallenge = null;
        } else {
          const challengeIdx = (state.round - 1) % CHALLENGES.length;
          state.phase = "ranking";
          state.currentChallenge = CHALLENGES[challengeIdx];
          state.rankings = {};
        }

        await this._save(roomId, state);
        await this._broadcastSafe(roomId, state, io);
        break;
      }

      // ─── HOST: End game ────────────────────────────────────────────────
      case "end_game": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        const state = await this._load(roomId);
        if (!state) return;

        state.phase = "finished";
        state.currentChallenge = null;
        await this._save(roomId, state);
        await this._broadcast(roomId, state, io);
        break;
      }

      // ─── HOST: Return to DJ experience ────────────────────────────────
      case "end": {
        if (role !== "HOST" && role !== "CO_HOST") return;
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
    const state = await this._load(roomId);
    if (!state) return { type: "intermission" };
    return { type: "rank_it" as any, data: this._safeState(state) };
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  /** Strip correctOrder from currentChallenge so guests cannot cheat */
  private _safeState(state: RankItState): Omit<RankItState, "currentChallenge"> & {
    currentChallenge: { prompt: string; items: string[] } | null;
  } {
    const { currentChallenge, ...rest } = state;
    return {
      ...rest,
      currentChallenge: currentChallenge
        ? { prompt: currentChallenge.prompt, items: currentChallenge.items }
        : null,
    };
  }

  /** Broadcast without correctOrder */
  private async _broadcastSafe(roomId: string, state: RankItState, io: Server): Promise<void> {
    const seq = await getNextSequenceId(roomId);
    const safe = this._safeState(state);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "rank_it",
      state: safe,
      view: { type: "rank_it" as any, data: safe },
      sequenceId: seq,
    });
  }

  /** Broadcast full state including correctOrder (reveal phase) */
  private async _broadcast(roomId: string, state: RankItState, io: Server): Promise<void> {
    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "rank_it",
      state,
      view: { type: "rank_it" as any, data: state },
      sequenceId: seq,
    });
  }

  private async _load(roomId: string): Promise<RankItState | null> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }

  private async _save(roomId: string, state: RankItState): Promise<void> {
    await redisClient.set(KEY(roomId), JSON.stringify(state), { EX: 14400 });
  }
}
