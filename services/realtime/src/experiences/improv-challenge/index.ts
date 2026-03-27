import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";

// ─────────────────────────────────────────────────────────────────────────────
// Improv Challenge Experience
//
// Host assigns a random scenario (WHO + WHERE + WHAT).
// The current performer acts it out while others watch.
// After the scene, guests rate the performer (0 / 150 / 300).
// Points are the average rating. Rotates through all performers.
// ─────────────────────────────────────────────────────────────────────────────

const KEY = (roomId: string) => `experience:improv_challenge:${roomId}`;

const WHO = [
  "A melodramatic opera singer",
  "A retired superhero on their first day at a desk job",
  "A time-traveller who landed in the wrong century",
  "An overconfident toddler running for president",
  "A robot experiencing emotions for the first time",
  "A self-proclaimed life coach with no life experience",
  "A Victorian aristocrat attending their first rave",
  "An overly competitive grandparent at game night",
  "A method actor who forgot they were acting",
  "A conspiracy theorist at a very normal family dinner",
  "A corporate motivational speaker losing their mind",
  "A pirate who got very lost on the way to the ocean",
  "A wellness influencer having a complete breakdown",
  "A mediæval knight at a modern IKEA",
  "A detective who has solved the wrong crime",
  "A surgeon who moonlights as a stand-up comedian",
  "A ghost who is terrible at haunting",
  "A fitness instructor who hates exercise",
  "An alien trying to blend in at a house party",
  "A judge presiding over the world's pettiest dispute",
];

const WHERE = [
  "at a fancy five-star restaurant",
  "aboard a spaceship with a faulty oxygen supply",
  "during a surprise birthday party for the wrong person",
  "in the middle of a championship chess tournament",
  "at a zoo after all the animals have escaped",
  "inside a escape room that nobody can escape",
  "at a wedding where the couple clearly hate each other",
  "on live television during a breaking news segment",
  "at an AA meeting they wandered into by mistake",
  "during a very tense job interview via video call",
  "at a children's birthday party that has gone wrong",
  "in the world's smallest elevator with strangers",
  "at the final round of a cooking competition",
  "at a high-school reunion where everyone is lying",
  "during a first date that is going terribly",
  "inside a Costco at 3am",
  "at an open-plan office where everyone is watching",
  "on a plane with a broken PA system",
  "at a silent retreat where someone keeps talking",
  "in a hospital waiting room with no signal",
];

const WHAT = [
  "trying to return a broken item without a receipt",
  "auditioning for the lead role in a musical",
  "delivering terrible news as cheerfully as possible",
  "teaching a masterclass in something they know nothing about",
  "negotiating a peace treaty between two rival cats",
  "convincing everyone they did not eat the last slice of pizza",
  "explaining why they are three hours late to their own party",
  "attempting to quit something they clearly cannot quit",
  "giving an Oscar acceptance speech for a role they did not get",
  "trying to make a reservation under a fake name",
  "confessing something they swore they would never admit",
  "proposing a business idea that makes absolutely no sense",
  "asking for a refund on an experience they consumed entirely",
  "presenting a PowerPoint about why they should get a dog",
  "confronting someone who has been stealing their lunch",
  "defending a decision that everyone in the room knows was wrong",
  "trying to explain the internet to someone who has never seen it",
  "announcing a breakup via a formal press release",
  "running for local office on a platform of one very niche issue",
  "staging a dramatic intervention for someone who does not need one",
];

interface ImprovScenario {
  who: string;
  where: string;
  what: string;
}

interface ImprovChallengeState {
  phase: "waiting" | "performing" | "rating" | "reveal" | "finished";
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
  currentPerformer: string | null;
  scenario: ImprovScenario | null;
  ratings: Record<string, number>;   // guestId → 0 | 150 | 300
  timerStart: number;
  performerQueue: string[];          // remaining performers this game
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildScenario(): ImprovScenario {
  return { who: pickRandom(WHO), where: pickRandom(WHERE), what: pickRandom(WHAT) };
}

export class ImprovChallengeExperience implements ExperienceModule {
  readonly type = "improv_challenge" as const;

  async onActivate(roomId: string): Promise<void> {
    const state: ImprovChallengeState = {
      phase: "waiting",
      round: 0,
      totalRounds: 5,
      scores: {},
      currentPerformer: null,
      scenario: null,
      ratings: {},
      timerStart: 0,
      performerQueue: [],
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
      // HOST: kick off the game
      case "start":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._start(roomId, p.guestIds as string[], io);
        break;

      // HOST: performer is done — open ratings
      case "scene_over":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._sceneOver(roomId, io);
        break;

      // GUEST: submit a rating for the current performer
      case "rate":
        await this._rate(roomId, guestId, p.rating as 0 | 150 | 300, io);
        break;

      // HOST: tally ratings, award points, advance
      case "next":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._next(roomId, io);
        break;

      // HOST: end the experience early and return to DJ
      case "end":
        if (role !== "HOST") return;
        await this._end(roomId, io);
        break;
    }
  }

  async getGuestViewDescriptor(roomId: string): Promise<GuestViewDescriptor> {
    const state = await this._load(roomId);
    return {
      type: `improv_challenge_${state.phase}` as any,
      data: {
        phase: state.phase,
        round: state.round,
        totalRounds: state.totalRounds,
        currentPerformer: state.currentPerformer,
        scenario: state.phase === "performing" || state.phase === "rating" || state.phase === "reveal"
          ? state.scenario
          : null,
        ratingCount: Object.keys(state.ratings).length,
        scores: state.scores,
        timerStart: state.timerStart,
      },
    };
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async _start(roomId: string, guestIds: string[], io: Server): Promise<void> {
    const state = await this._load(roomId);
    const queue = [...guestIds].sort(() => Math.random() - 0.5);
    state.performerQueue = queue.slice(1);
    state.currentPerformer = queue[0] ?? null;
    state.scenario = buildScenario();
    state.phase = "performing";
    state.round = 1;
    state.ratings = {};
    state.timerStart = Date.now();
    await this._save(roomId, state);

    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "improv_challenge",
      state,
      view: { type: "improv_challenge_performing" as any, data: state },
      sequenceId: seq,
    });
  }

  private async _sceneOver(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (state.phase !== "performing") return;
    state.phase = "rating";
    state.ratings = {};
    await this._save(roomId, state);

    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "improv_challenge",
      state,
      view: { type: "improv_challenge_rating" as any, data: state },
      sequenceId: seq,
    });
  }

  private async _rate(roomId: string, guestId: string, rating: 0 | 150 | 300, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (state.phase !== "rating") return;
    if (state.ratings[guestId] !== undefined) return; // already rated
    const clamped = ([0, 150, 300] as number[]).includes(rating) ? rating : 0;
    state.ratings[guestId] = clamped;
    await this._save(roomId, state);
    io.to(roomId).emit("improv_challenge:rating_count", { count: Object.keys(state.ratings).length });
  }

  private async _next(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (state.phase !== "rating") return;

    // Tally average and award to current performer
    const ratingValues = Object.values(state.ratings);
    if (ratingValues.length > 0 && state.currentPerformer) {
      const avg = Math.round(ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length);
      state.scores[state.currentPerformer] = (state.scores[state.currentPerformer] ?? 0) + avg;
    }

    // Show reveal briefly
    state.phase = "reveal";
    await this._save(roomId, state);
    const revealSeq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "improv_challenge",
      state,
      view: { type: "improv_challenge_reveal" as any, data: state },
      sequenceId: revealSeq,
    });

    // Advance to next performer or finish
    if (state.round >= state.totalRounds || state.performerQueue.length === 0) {
      state.phase = "finished";
      state.currentPerformer = null;
      await this._save(roomId, state);
      const seq = await getNextSequenceId(roomId);
      io.to(roomId).emit("experience:state" as any, {
        experienceType: "improv_challenge",
        state,
        view: { type: "improv_challenge_finished" as any, data: state },
        sequenceId: seq,
      });
      return;
    }

    state.currentPerformer = state.performerQueue.shift() ?? null;
    state.scenario = buildScenario();
    state.phase = "performing";
    state.round += 1;
    state.ratings = {};
    state.timerStart = Date.now();
    await this._save(roomId, state);

    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "improv_challenge",
      state,
      view: { type: "improv_challenge_performing" as any, data: state },
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

  private async _load(roomId: string): Promise<ImprovChallengeState> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : {
      phase: "waiting", round: 0, totalRounds: 5, scores: {},
      currentPerformer: null, scenario: null, ratings: {}, timerStart: 0, performerQueue: [],
    };
  }

  private async _save(roomId: string, state: ImprovChallengeState): Promise<void> {
    await redisClient.set(KEY(roomId), JSON.stringify(state), { EX: 14400 });
  }
}
