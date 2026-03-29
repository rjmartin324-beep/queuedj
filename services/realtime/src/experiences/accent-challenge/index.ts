import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";

// ─────────────────────────────────────────────────────────────────────────────
// Accent Challenge Experience
//
// Each round a performer gets a random accent + phrase to read aloud.
// Guests rate the performance (0 / 100 / 200 / 350 pts).
// Average rating is awarded to the performer. Rotates performers.
// ─────────────────────────────────────────────────────────────────────────────

const KEY = (roomId: string) => `experience:accent_challenge:${roomId}`;

const ACCENTS = [
  "Southern American",
  "British Cockney",
  "Australian",
  "Pirate",
  "Italian-American",
  "Scottish",
  // ── added ────────────────────────────────────────────────────────────────────
  "French",
  "German",
  "Indian",
  "Mexican",
  "Russian",
  "Southern Irish",
  "New York City",
  "Jamaican",
  "South African",
  "Welsh",
  "Texan",
  "Scandinavian",
  "Japanese",
  "Valley Girl",
];

const PHRASES = [
  "I can't believe you forgot to feed the cat again!",
  "The treasure is buried beneath the old oak tree.",
  "Would you like fries with that, my dear?",
  "We're going to need a bigger boat.",
  "Please hold all your questions until the end of the presentation.",
  "That's not how any of this works.",
  "I've been training for this moment my entire life.",
  "The forecast calls for scattered cheese with a chance of bread.",
  "Excuse me, is this seat taken by a time traveller?",
  "I demand to speak to your manager's manager's manager.",
  // ── added to reach 50 ────────────────────────────────────────────────────────
  "My cat has been staring at the wall for three hours and I'm starting to worry.",
  "Attention passengers, the pilot has requested that everyone stop breathing so loudly.",
  "I told you the left turn was the right turn, and the right turn was the wrong turn.",
  "Could you repeat that? I was distracted by how correctly you were pronouncing things.",
  "Welcome to the party. We ran out of food at 7pm. It is now 7:02pm.",
  "I have climbed the tallest mountain, swum the deepest sea, and forgotten my phone charger.",
  "The WiFi password is forty-seven lowercase letters — would you like me to spell it?",
  "Technically speaking, what you're describing is not a problem. It is a challenge opportunity.",
  "I didn't choose the party life. The party life chose me, then immediately uninvited me.",
  "You look exactly like someone who has never assembled IKEA furniture alone at midnight.",
  "There is absolutely no reason to panic. This is a completely controlled situation. Everyone run.",
  "My grandmother makes better decisions at 4am than this entire room is making right now.",
  "I have been in this queue for forty-five minutes and I have forgotten what I was queuing for.",
  "Excuse me, could you lower your voice? Some of us are trying to overhear other conversations.",
  "I am perfectly calm. I have never been calmer in my life. Please do not look at my hands.",
  "According to my calculations, we should arrive approximately three hours after we needed to be there.",
  "The doctor said I need more rest, more vegetables, and significantly better life choices.",
  "I ordered one small coffee and somehow left the café having spent forty-three dollars.",
  "This is my opinion and I stand by it firmly, unless you disagree, in which case I never said it.",
  "I just want to say, for the record, that this was not my idea and I voted against it.",
  "Someone has eaten my clearly labelled lunch from the fridge again and I am done being civil.",
  "The GPS told me to turn left and I did, and now I am in the ocean.",
  "I packed for a weekend and brought enough clothes for a small theatrical production.",
  "My flight was delayed six hours and the lounge ran out of free croissants — this is a disaster.",
  "Hello yes I am calling to complain about a product I purchased several years ago with great confidence.",
  "I fully understand the rules. I simply choose to interpret them differently.",
  "The meeting that could have been an email has now become a three-day retreat.",
  "I have never been more relaxed in my life. These are relaxed eyes. This is my relaxed voice.",
  "Technically I was on time — I was just in a different building.",
  "Please lower your expectations before I continue, as what follows may disappoint you.",
  "I ordered a table for two and brought eleven people. Surely this is solvable.",
  "That is a very good question and I plan to answer it at some point before the end of the meeting.",
  "I am not lost. I am exploring a route that has not been officially recognised by any GPS system.",
  "My bag contains everything I need for any situation, including fourteen situations that will never occur.",
  "Thank you for your feedback. I have read it carefully and chosen to continue exactly as before.",
  "I don't have a problem waking up early. I simply refuse to do it for any reason.",
  "The plan was perfect. The execution was also perfect. The outcome was not part of the plan.",
  "I speak three languages fluently: sarcasm, silence, and a third one I haven't started yet.",
  "This restaurant has a wait time of forty minutes. I have already eaten my entire bread basket.",
  "I am an adult who makes adult decisions, and today's decision is to have dessert before dinner.",
];

interface AccentChallengeState {
  phase: "waiting" | "performing" | "rating" | "finished";
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
  currentPerformer: string | null;
  accent: string | null;
  phrase: string | null;
  ratings: Record<string, number>;  // guestId → 0 | 100 | 200 | 350
  performerQueue: string[];
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export class AccentChallengeExperience implements ExperienceModule {
  readonly type = "accent_challenge" as const;

  async onActivate(roomId: string): Promise<void> {
    const state: AccentChallengeState = {
      phase: "waiting",
      round: 0,
      totalRounds: 6,
      scores: {},
      currentPerformer: null,
      accent: null,
      phrase: null,
      ratings: {},
      performerQueue: [],
    };
    await this._save(roomId, state);
  }

  async onDeactivate(roomId: string): Promise<void> {
    await redisClient.del(KEY(roomId));
  }

  async handleAction({ action, payload, roomId, guestId, role, io }: {
    action: string; payload: unknown; roomId: string;
    guestId: string; role: "HOST" | "CO_HOST" | "GUEST"; io: Server;
  }): Promise<void> {
    const p = payload as any;

    switch (action) {
      // HOST: begin the game
      case "start":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._start(roomId, p.guestIds as string[], io);
        break;

      // GUEST: submit rating for current performer
      case "rate":
        await this._rate(roomId, guestId, p.rating as 0 | 100 | 200 | 350, io);
        break;

      // HOST: tally, award, advance to next performer
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
      type: "accent_challenge" as any,
      data: {
        phase: state.phase,
        round: state.round,
        totalRounds: state.totalRounds,
        currentPerformer: state.currentPerformer,
        accent: state.phase !== "waiting" ? state.accent : null,
        phrase: state.phase !== "waiting" ? state.phrase : null,
        ratingCount: Object.keys(state.ratings).length,
        scores: state.scores,
      },
    };
  }

  async getBootstrapState(roomId: string): Promise<unknown> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async _start(roomId: string, guestIds: string[], io: Server): Promise<void> {
    const state = await this._load(roomId);
    const queue = [...guestIds].sort(() => Math.random() - 0.5);
    state.performerQueue = queue.slice(1);
    state.currentPerformer = queue[0] ?? null;
    state.accent = pickRandom(ACCENTS);
    state.phrase = pickRandom(PHRASES);
    state.phase = "performing";
    state.round = 1;
    state.ratings = {};
    await this._save(roomId, state);

    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "accent_challenge",
      state,
      view: { type: "accent_challenge_performing" as any, data: state },
      sequenceId: seq,
    });
  }

  private async _rate(roomId: string, guestId: string, rating: 0 | 100 | 200 | 350, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (state.phase !== "performing") return;
    if (state.ratings[guestId] !== undefined) return;
    const valid = ([0, 100, 200, 350] as number[]).includes(rating) ? rating : 0;
    state.ratings[guestId] = valid;
    await this._save(roomId, state);
    io.to(roomId).emit("accent_challenge:rating_count", { count: Object.keys(state.ratings).length });
  }

  private async _next(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (state.phase !== "performing") return;

    // Award average rating to current performer
    const ratingValues = Object.values(state.ratings);
    if (ratingValues.length > 0 && state.currentPerformer) {
      const avg = Math.round(ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length);
      state.scores[state.currentPerformer] = (state.scores[state.currentPerformer] ?? 0) + avg;
    }

    // End game when rounds exhausted or no more performers
    if (state.round >= state.totalRounds || state.performerQueue.length === 0) {
      state.phase = "finished";
      state.currentPerformer = null;
      await this._save(roomId, state);
      const seq = await getNextSequenceId(roomId);
      io.to(roomId).emit("experience:state" as any, {
        experienceType: "accent_challenge",
        state,
        view: { type: "accent_challenge_finished" as any, data: state },
        sequenceId: seq,
      });
      return;
    }

    // Rotate to next performer with a new accent + phrase
    state.currentPerformer = state.performerQueue.shift() ?? null;
    state.accent = pickRandom(ACCENTS);
    state.phrase = pickRandom(PHRASES);
    state.round += 1;
    state.ratings = {};
    state.phase = "performing";
    await this._save(roomId, state);

    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "accent_challenge",
      state,
      view: { type: "accent_challenge_performing" as any, data: state },
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

  private async _load(roomId: string): Promise<AccentChallengeState> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : {
      phase: "waiting", round: 0, totalRounds: 6, scores: {},
      currentPerformer: null, accent: null, phrase: null, ratings: {}, performerQueue: [],
    };
  }

  private async _save(roomId: string, state: AccentChallengeState): Promise<void> {
    await redisClient.set(KEY(roomId), JSON.stringify(state), { EX: 14400 });
  }
}