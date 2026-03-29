import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";

// ─────────────────────────────────────────────────────────────────────────────
// Hot Takes Experience
//
// Guests drag a slider (0-100) to rate a controversial statement.
// After reveal, the average is shown. Guests closest to the average earn
// the most points (up to 300). Being an outlier earns fewer points.
//
// Actions:
//   HOST:  start, reveal, next, end
//   GUEST: slide
// ─────────────────────────────────────────────────────────────────────────────

const STATEMENTS: string[] = [
  "Pineapple belongs on pizza",
  "A party without dancing is just a gathering",
  "Karaoke is only fun if you're bad at it",
  "The DJ makes or breaks the party",
  "Showing up on time to a party is embarrassing",
  "The best conversations happen after midnight",
  "It's okay to leave a party without saying goodbye",
  "The pre-game is better than the actual party",
  // ── Added statements to reach 60 total ─────────────────────────────────────
  "Cold brew is better than hot coffee",
  "Remote work is better for productivity than working in an office",
  "Texting is better than calling",
  "Cats are better pets than dogs",
  "Side characters are more interesting than main characters",
  "The movie is almost always worse than the book",
  "Breakfast food is acceptable at any time of day",
  "Buying experiences is a waste of money compared to buying things",
  "Tipping culture has gotten out of control",
  "Social media has done more harm than good to society",
  "Socks and sandals are actually a perfectly fine fashion choice",
  "Sequels are almost never as good as the original",
  "Open-plan offices are a terrible idea",
  "Introverts make better leaders than extroverts",
  "Most people don't actually need a university degree",
  "The middle seat on a plane should cost less than the aisle",
  "Ghosts in horror movies are scarier than monsters",
  "Spicy food is overrated",
  "Owning a car in a city is unnecessary",
  "Adults should have nap time in the workday",
  "Most people are terrible at giving gifts",
  "Sharing a hotel room with a friend can ruin the friendship",
  "Fast fashion should be illegal",
  "Streaming has killed the album listening experience",
  "Reality TV is more honest about human nature than scripted drama",
  "People who don't drink at parties have more fun than those who do",
  "Airports are secretly enjoyable",
  "The best part of any trip is coming home",
  "Going to the gym early in the morning ruins your whole day",
  "Cryptocurrency was a mistake",
  "Online dating has made people pickier in unhealthy ways",
  "Movie theaters are dying and that's okay",
  "Comfort rewatching shows is better than discovering new ones",
  "Leaving a party before midnight means you had the best night",
  "There is no such thing as a guilty pleasure — just a pleasure",
  "People judge restaurants by their bathrooms more than their menus",
  "Tattoos in visible places affect how seriously you're taken professionally",
  "Everyone should work in customer service for at least one year",
  "The 'situationship' era has made dating worse for everyone",
  "Lunch is the most important meal of the day",
  "Music was objectively better in the decade you grew up in",
  "Saying 'I'm not a morning person' is just an excuse",
  "The best albums are ones you have to listen to all the way through",
  "You can tell everything you need to know about a person from their shoes",
  "People who keep their phones face-down during dinner are performing",
  "Most influencer advice is actively harmful",
  "Being famous looks more exhausting than it looks fun",
  "Sending a voice note is inconsiderate",
  "People who say money can't buy happiness have never been broke",
  "Nostalgia is the most powerful force in entertainment",
  "Cooking at home is overrated when delivery exists",
  "The best music is made to be heard live",
];

interface HotTakesState {
  phase: "waiting" | "question" | "reveal" | "finished";
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
  currentStatement: string | null;
  sliderValues: Record<string, number>;
  average: number | null;
}

const KEY = (roomId: string) => `experience:hot_takes:${roomId}`;

export class HotTakesExperience implements ExperienceModule {
  readonly type = "hot_takes" as const;
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  async onActivate(roomId: string, _hostGuestId: string): Promise<void> {
    const state: HotTakesState = {
      phase: "waiting",
      round: 0,
      totalRounds: STATEMENTS.length,
      scores: {},
      currentStatement: null,
      sliderValues: {},
      average: null,
    };
    await redisClient.set(KEY(roomId), JSON.stringify(state));
  }

  async onDeactivate(roomId: string): Promise<void> {
    this.timers.forEach(t => clearTimeout(t));
    this.timers.clear();
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
    const raw = await redisClient.get(KEY(roomId));
    if (!raw) return;
    const state: HotTakesState = JSON.parse(raw);

    switch (action) {
      case "start": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        state.phase = "question";
        state.round = 1;
        state.currentStatement = STATEMENTS[0];
        state.sliderValues = {};
        state.average = null;
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "hot_takes",
          state: { ...state, sliderValues: {} },
          view: { type: "hot_takes", data: { ...state, sliderValues: {} } },
          sequenceId: seq,
        });
        break;
      }

      case "slide": {
        if (state.phase !== "question") return;
        const p = payload as { value: number };
        if (p?.value === undefined || p.value === null) return;
        const val = Math.max(0, Math.min(100, Number(p.value)));
        if (isNaN(val)) return;
        state.sliderValues[guestId] = val;
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        // Acknowledge submission without revealing values yet
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "hot_takes",
          // Send response count but not individual values
          state: { ...state, sliderValues: {}, respondedCount: Object.keys(state.sliderValues).length },
          view: {
            type: "hot_takes",
            data: { ...state, sliderValues: {}, respondedCount: Object.keys(state.sliderValues).length },
          },
          sequenceId: seq,
        });
        break;
      }

      case "reveal": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        if (state.phase !== "question") return;
        const values = Object.values(state.sliderValues);
        const avg = values.length > 0
          ? values.reduce((sum, v) => sum + v, 0) / values.length
          : 50;
        state.average = Math.round(avg * 10) / 10;
        // Score based on distance from average: max 300 pts, -3 pts per distance unit
        for (const [voter, val] of Object.entries(state.sliderValues)) {
          const distance = Math.abs(val - avg);
          const pts = Math.max(0, Math.round(300 - distance * 3));
          state.scores[voter] = (state.scores[voter] ?? 0) + pts;
        }
        state.phase = "reveal";
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "hot_takes",
          state,
          view: { type: "hot_takes", data: state },
          sequenceId: seq,
        });
        clearTimeout(this.timers.get(`${roomId}:advance`));
        this.timers.set(`${roomId}:advance`, setTimeout(() => this.handleAction({ action: "next", payload: {}, roomId, guestId: "", role: "HOST", io }).catch(() => {}), 5000));
        break;
      }

      case "next": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        if (state.phase !== "reveal") return;
        state.round += 1;
        if (state.round > state.totalRounds) {
          state.phase = "finished";
          state.currentStatement = null;
          await redisClient.set(KEY(roomId), JSON.stringify(state));
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "hot_takes",
            state,
            view: { type: "leaderboard", data: state.scores },
            sequenceId: seq,
          });
        } else {
          state.phase = "question";
          state.currentStatement = STATEMENTS[(state.round - 1) % STATEMENTS.length];
          state.sliderValues = {};
          state.average = null;
          await redisClient.set(KEY(roomId), JSON.stringify(state));
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "hot_takes",
            state: { ...state, sliderValues: {} },
            view: { type: "hot_takes", data: { ...state, sliderValues: {} } },
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
    const state: HotTakesState = JSON.parse(raw);
    if (state.phase === "finished") return { type: "leaderboard", data: state.scores };
    if (state.phase !== "reveal") {
      return { type: "hot_takes" as any, data: { ...state, sliderValues: {} } };
    }
    return { type: "hot_takes" as any, data: state };
  }

  async getBootstrapState(roomId: string): Promise<unknown> {
    const raw = await redisClient.get(KEY(roomId));
    if (!raw) return null;
    const state = JSON.parse(raw);
    if (state.phase !== "reveal") return { ...state, sliderValues: {} };
    return state;
  }
}