import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";
import { shuffledIndices } from "../../lib/shuffle";

// ─────────────────────────────────────────────────────────────────────────────
// Speed Round Experience
//
// A timed challenge is shown to all guests. First to complete it wins the
// most points. There is a 30-second window; leftover time = bonus points.
// Guests can also skip to signal they've given up on the challenge.
//
// Actions:
//   HOST/CO_HOST: start, next, end_game, end
//   GUEST:        complete, skip
// ─────────────────────────────────────────────────────────────────────────────

const KEY = (roomId: string) => `experience:speed_round:${roomId}`;

const TIME_WINDOW_MS = 30_000; // 30 seconds per challenge

// ─── Content ─────────────────────────────────────────────────────────────────

interface SpeedChallenge {
  category: string;
  challenge: string;
}

const CHALLENGES: SpeedChallenge[] = [
  { category: "Music", challenge: "Name 5 songs that start with the letter 'S'" },
  { category: "Movies", challenge: "Name 3 movies featuring Tom Hanks" },
  { category: "Food", challenge: "Name 4 dishes from Italian cuisine" },
  { category: "Animals", challenge: "Name 5 animals that live in the ocean" },
  { category: "Sports", challenge: "Name 3 Olympic sports added after the year 2000" },
  { category: "Geography", challenge: "Name 4 countries in South America" },
  { category: "Pop Culture", challenge: "Name 3 TV shows that premiered in 2023" },
  { category: "Music", challenge: "Name 4 albums released by Beyoncé" },
  { category: "Movies", challenge: "Name 4 films that won the Best Picture Oscar after 2010" },
  { category: "Food", challenge: "Name 5 types of pasta" },
  { category: "Geography", challenge: "Name 3 countries in Southeast Asia" },
  { category: "Animals", challenge: "Name 4 animals that are nocturnal" },
  { category: "Sports", challenge: "Name 4 Grand Slam tennis tournaments" },
  { category: "Pop Culture", challenge: "Name 3 characters from The Simpsons" },
  { category: "Science", challenge: "Name 4 planets in our solar system besides Earth" },
  { category: "Music", challenge: "Name 3 songs by Taylor Swift from different albums" },
  { category: "Movies", challenge: "Name 4 actors who have played James Bond" },
  { category: "Food", challenge: "Name 4 cheeses that originate in France" },
  { category: "Geography", challenge: "Name 5 countries that border Russia" },
  { category: "Animals", challenge: "Name 3 animals that are marsupials" },
  { category: "Sports", challenge: "Name 4 events in a Track and Field decathlon" },
  { category: "Pop Culture", challenge: "Name 4 Marvel characters who have appeared in their own Disney+ show" },
  { category: "Science", challenge: "Name 3 bones in the human ear" },
  { category: "Music", challenge: "Name 5 instruments in a classical orchestra" },
  { category: "Movies", challenge: "Name 3 movies directed by Christopher Nolan" },
  { category: "Food", challenge: "Name 4 spices commonly used in Indian cooking" },
  { category: "Geography", challenge: "Name 4 capital cities in Africa" },
  { category: "Animals", challenge: "Name 4 types of big cats" },
  { category: "Sports", challenge: "Name 3 sports that use a net but no ball" },
  { category: "Pop Culture", challenge: "Name 4 video game franchises that have been around since the 1980s" },
  { category: "Science", challenge: "Name 4 elements on the periodic table that are gases at room temperature" },
  { category: "Music", challenge: "Name 4 bands that were part of the British Invasion" },
  { category: "Movies", challenge: "Name 3 animated movies from Studio Ghibli" },
  { category: "Food", challenge: "Name 4 dishes commonly served at Thanksgiving" },
  { category: "Geography", challenge: "Name 5 US states that border Mexico" },
  { category: "Animals", challenge: "Name 3 animals that can regrow lost body parts" },
  { category: "Sports", challenge: "Name 4 sports in which athletes compete in pairs or teams at the Winter Olympics" },
  { category: "Pop Culture", challenge: "Name 3 talk show hosts who have had a late-night show after 2015" },
  { category: "Science", challenge: "Name 4 things you would find in a cell nucleus" },
  // ── added to reach 100 ───────────────────────────────────────────────────────
  { category: "Music", challenge: "Name 3 songs with a number in the title" },
  { category: "Movies", challenge: "Name 4 actors who have hosted the Oscars" },
  { category: "Food", challenge: "Name 4 foods that are naturally orange" },
  { category: "Animals", challenge: "Name 3 animals that are venomous" },
  { category: "Geography", challenge: "Name 4 countries in the Middle East" },
  { category: "Pop Culture", challenge: "Name 3 social media platforms launched after 2010" },
  { category: "Science", challenge: "Name 3 types of clouds" },
  { category: "Music", challenge: "Name 4 one-word-titled albums by any artist" },
  { category: "Movies", challenge: "Name 3 films set on Mars" },
  { category: "Food", challenge: "Name 4 cocktails that contain citrus juice" },
  { category: "Animals", challenge: "Name 4 animals found only in Australia" },
  { category: "Geography", challenge: "Name 4 landlocked countries in Europe" },
  { category: "Pop Culture", challenge: "Name 3 famous duos in TV history" },
  { category: "Science", challenge: "Name 3 types of rock (geological)" },
  { category: "Music", challenge: "Name 3 songs by Rihanna" },
  { category: "Movies", challenge: "Name 4 Pixar films with a single-word title" },
  { category: "Food", challenge: "Name 4 countries famous for their wine" },
  { category: "Animals", challenge: "Name 3 types of sharks" },
  { category: "Geography", challenge: "Name 4 capital cities in Asia" },
  { category: "Pop Culture", challenge: "Name 3 famous Saturday Night Live cast members" },
  { category: "Science", challenge: "Name 4 units of measurement used in science" },
  { category: "Music", challenge: "Name 5 songs by Drake" },
  { category: "Movies", challenge: "Name 4 films that won more than 5 Oscars" },
  { category: "Food", challenge: "Name 4 ingredients in a classic Margherita pizza" },
  { category: "Animals", challenge: "Name 4 animals that hibernate" },
  { category: "Geography", challenge: "Name 5 countries with red in their flag" },
  { category: "Pop Culture", challenge: "Name 3 TikTok trends from 2020 or 2021" },
  { category: "Science", challenge: "Name 4 planets with known moons" },
  { category: "Music", challenge: "Name 3 songs with 'love' in the title" },
  { category: "Movies", challenge: "Name 4 superhero movies from DC" },
  { category: "Food", challenge: "Name 4 things you'd find in a full English breakfast" },
  { category: "Animals", challenge: "Name 3 animals that use camouflage" },
  { category: "Geography", challenge: "Name 3 island nations" },
  { category: "Pop Culture", challenge: "Name 4 celebrities who have launched their own food or drink brand" },
  { category: "Science", challenge: "Name 4 inventions from the 20th century" },
  { category: "Music", challenge: "Name 3 artists who have collaborated with Kendrick Lamar" },
  { category: "Movies", challenge: "Name 4 films based on true stories released since 2015" },
  { category: "Food", challenge: "Name 3 spices used in a classic curry" },
  { category: "Animals", challenge: "Name 3 animals with unusual collective nouns (e.g. a murder of crows)" },
  { category: "Geography", challenge: "Name 4 US states that start with the letter 'N'" },
  { category: "Pop Culture", challenge: "Name 3 brands that sponsor major sports teams" },
  { category: "Science", challenge: "Name 3 things that can conduct electricity" },
  { category: "Music", challenge: "Name 4 songs from the 1980s" },
  { category: "Movies", challenge: "Name 4 actors who have played a US president on screen" },
  { category: "Food", challenge: "Name 4 types of noodle dishes from different countries" },
  { category: "Animals", challenge: "Name 4 types of primates besides humans" },
  { category: "Geography", challenge: "Name 3 rivers that flow through multiple countries" },
  { category: "Pop Culture", challenge: "Name 4 award shows that air annually on TV" },
  { category: "Science", challenge: "Name 3 gases found in Earth's atmosphere" },
  { category: "Music", challenge: "Name 3 famous music producers" },
  { category: "Movies", challenge: "Name 4 animated films from the 1990s" },
  { category: "Food", challenge: "Name 4 dishes traditionally eaten cold" },
  { category: "Animals", challenge: "Name 4 insects that sting or bite" },
  { category: "Geography", challenge: "Name 4 countries that border France" },
  { category: "Pop Culture", challenge: "Name 3 reality TV shows about dating" },
  { category: "Science", challenge: "Name 3 parts of the human digestive system" },
  { category: "Music", challenge: "Name 4 music genres that originated in the USA" },
  { category: "Movies", challenge: "Name 3 directors who have won the Oscar for Best Director more than once" },
  { category: "Food", challenge: "Name 4 street foods from around the world" },
  { category: "Animals", challenge: "Name 3 ocean animals that are not fish" },
  { category: "Geography", challenge: "Name 4 capitals of former USSR countries" },
];

// ─── State ────────────────────────────────────────────────────────────────────

interface SpeedRoundState {
  phase: "waiting" | "playing" | "scoring" | "finished";
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
  currentChallenge: SpeedChallenge | null;
  completions: Record<string, boolean>; // guestId → true=complete, false=skip
  startedAt: number;
  queue: number[];
}

export class SpeedRoundExperience implements ExperienceModule {
  readonly type = "speed_round" as const;

  async onActivate(roomId: string): Promise<void> {
    const state: SpeedRoundState = {
      phase: "waiting",
      round: 0,
      totalRounds: 7,
      scores: {},
      currentChallenge: null,
      completions: {},
      startedAt: 0,
      queue: shuffledIndices(CHALLENGES.length),
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
    switch (action) {

      // ─── HOST: Start the game ──────────────────────────────────────────
      case "start": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        const state = await this._load(roomId);
        if (!state) return;

        state.phase = "playing";
        state.round = 1;
        state.scores = {};
        state.queue = shuffledIndices(CHALLENGES.length);
        state.currentChallenge = CHALLENGES[state.queue[0]];
        state.completions = {};
        state.startedAt = Date.now();

        await this._save(roomId, state);
        await this._broadcast(roomId, state, io);
        break;
      }

      // ─── GUEST: Mark challenge as complete ────────────────────────────
      case "complete": {
        const state = await this._load(roomId);
        if (!state || state.phase !== "playing") return;
        if (state.completions[guestId] !== undefined) return; // Already acted

        const elapsed = Date.now() - state.startedAt;
        const remaining = Math.max(0, TIME_WINDOW_MS - elapsed);
        // Time bonus: up to +100 pts for instant completion, scales to 0 at 30s
        const timeBonus = Math.round(100 * (remaining / TIME_WINDOW_MS));

        state.completions[guestId] = true;
        state.scores[guestId] = (state.scores[guestId] ?? 0) + 100 + timeBonus;

        await this._save(roomId, state);
        await this._broadcast(roomId, state, io);
        break;
      }

      // ─── GUEST: Skip this challenge ────────────────────────────────────
      case "skip": {
        const state = await this._load(roomId);
        if (!state || state.phase !== "playing") return;
        if (state.completions[guestId] !== undefined) return;

        state.completions[guestId] = false; // Skipped, no pts
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
          const challengeIdx = state.queue[(state.round - 1) % state.queue.length];
          state.phase = "playing";
          state.currentChallenge = CHALLENGES[challengeIdx];
          state.completions = {}; // Reset for new round
          state.startedAt = Date.now();
        }

        await this._save(roomId, state);
        await this._broadcast(roomId, state, io);
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
    return { type: "speed_round" as any, data: state };
  }

  async getBootstrapState(roomId: string): Promise<unknown> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async _broadcast(roomId: string, state: SpeedRoundState, io: Server): Promise<void> {
    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "speed_round",
      state,
      view: { type: "speed_round" as any, data: state },
      sequenceId: seq,
    });
  }

  private async _load(roomId: string): Promise<SpeedRoundState | null> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }

  private async _save(roomId: string, state: SpeedRoundState): Promise<void> {
    await redisClient.set(KEY(roomId), JSON.stringify(state), { EX: 14400 });
  }
}