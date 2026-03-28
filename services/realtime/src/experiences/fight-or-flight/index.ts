import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";

// ─────────────────────────────────────────────────────────────────────────────
// Fight or Flight Experience
//
// Absurd binary choice scenarios. Everyone picks A or B.
// Majority voters earn +200, minority voters earn a consolation +50.
//
// Actions:
//   HOST:  start, reveal, next, end
//   GUEST: choose
// ─────────────────────────────────────────────────────────────────────────────

const KEY = (roomId: string) => `experience:fight_or_flight:${roomId}`;

interface Scenario {
  text: string;
  a: string;
  b: string;
}

interface FightOrFlightState {
  phase: "waiting" | "question" | "reveal" | "finished";
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
  currentScenario: Scenario | null;
  choices: Record<string, "a" | "b">; // guestId -> choice
}

const SCENARIOS: Scenario[] = [
  {
    text: "You wake up and discover you can only communicate in one of these two ways forever:",
    a: "Only speak in questions",
    b: "Only speak in rhymes",
  },
  {
    text: "You must choose one of these to be true about you for the rest of your life:",
    a: "Every time you sit down, a loud fart noise plays",
    b: "Every time you laugh, you bark like a dog",
  },
  {
    text: "You're stranded on a desert island. You can only bring one:",
    a: "An infinite supply of IKEA furniture but no instructions",
    b: "A library of 10,000 books but they're all cookbooks",
  },
  {
    text: "For the next year, you must wear one of these at all times:",
    a: "A top hat and monocle",
    b: "Full scuba gear",
  },
  {
    text: "You gain a superpower but it only activates when:",
    a: "You're eating cereal",
    b: "You're doing jazz hands",
  },
  {
    text: "You have to fight one of these in a public place:",
    a: "100 duck-sized horses",
    b: "One horse-sized duck",
  },
  {
    text: "For the rest of your life every door you open reveals:",
    a: "A mildly disappointing buffet",
    b: "A surprise birthday party for someone you don't know",
  },
  {
    text: "You must swap one of these with a random stranger for 24 hours:",
    a: "Your phone",
    b: "Your shoes",
  },
  // ── Added scenarios to reach 50 total ──────────────────────────────────────
  {
    text: "You have to pick one of these as your permanent ringtone, on full volume, forever:",
    a: "Your own voice saying 'PHONE CALL' very seriously",
    b: "A 10-second tuba solo",
  },
  {
    text: "For the rest of your life you can only travel by:",
    a: "Segway",
    b: "Tandem bicycle with a stranger",
  },
  {
    text: "Every time you enter a room you must announce yourself with:",
    a: "A foghorn blast",
    b: "A confetti cannon",
  },
  {
    text: "You can only eat one of these for the rest of your life:",
    a: "Everything tastes like chicken but the texture is always wrong",
    b: "Perfect food but every meal includes at least one raisin",
  },
  {
    text: "You have to choose your forever haircut:",
    a: "A bowl cut",
    b: "A mullet with frosted tips",
  },
  {
    text: "For one full year, every time you sneeze:",
    a: "You hiccup for 30 seconds",
    b: "You briefly speak in a random accent",
  },
  {
    text: "You must pick one to appear above your head at all times:",
    a: "Your current mood as an emoji visible to everyone",
    b: "Your current bank balance",
  },
  {
    text: "You can only have one of these in your life:",
    a: "The ability to pause time but only while nobody is watching",
    b: "The ability to rewind the last 60 seconds once per day",
  },
  {
    text: "You wake up and discover you have swapped bodies with:",
    a: "Your best friend",
    b: "Your boss",
  },
  {
    text: "You must live the rest of your life with one of these:",
    a: "A crow that follows you everywhere and judges your decisions out loud",
    b: "A goat that knows all your embarrassing secrets and tells them at random",
  },
  {
    text: "Every photo ever taken of you from now on makes you look:",
    a: "Like you're intensely smelling something suspicious",
    b: "Like you're about to say something very important but forgot what",
  },
  {
    text: "For one month you can only buy food from:",
    a: "A vending machine",
    b: "A school cafeteria",
  },
  {
    text: "You have to attend every meeting and social event wearing:",
    a: "A cape",
    b: "A hard hat",
  },
  {
    text: "Your sleep schedule is permanently:",
    a: "9pm bedtime, 4am wake-up",
    b: "3am bedtime, 11am wake-up",
  },
  {
    text: "Every time you lie, one of these things happens:",
    a: "Your nose grows one centimetre",
    b: "A rooster crows loudly from somewhere nearby",
  },
  {
    text: "You can only listen to music through one of these:",
    a: "Tiny earbuds from 2007 with one side broken",
    b: "Massive over-ear headphones that have no volume control and are always at maximum",
  },
  {
    text: "You can only send messages in one of these formats:",
    a: "Everything as a formal letter beginning 'Dear Recipient'",
    b: "Everything as a text message with no vowels",
  },
  {
    text: "For the next year you have to greet everyone with:",
    a: "A firm handshake and intense eye contact for exactly 5 seconds",
    b: "A bow and the phrase 'It is an honour'",
  },
  {
    text: "You can only exercise using one method for the rest of your life:",
    a: "Competitive speed-walking",
    b: "Competitive table tennis",
  },
  {
    text: "You must wear one of these to every formal event for the rest of your life:",
    a: "Light-up shoes",
    b: "A fanny pack",
  },
  {
    text: "You get a personal assistant but they:",
    a: "Narrate everything you do in real-time in a dramatic voice",
    b: "Randomly gaslight you about minor details of your day",
  },
  {
    text: "Your car's GPS is replaced permanently with:",
    a: "A person reading directions from a printed map who is never quite sure",
    b: "A GPS that gives directions only in haikus",
  },
  {
    text: "You have to solve every minor disagreement through:",
    a: "Rock Paper Scissors — best of five",
    b: "A formal debate with opening statements and rebuttal time",
  },
  {
    text: "Every time you're nervous, your body betrays you by:",
    a: "Spontaneously humming the SpongeBob theme tune",
    b: "Narrating your own thoughts out loud at a whisper",
  },
  {
    text: "You have to pick an unexpected person to write your biography:",
    a: "Your most judgmental relative",
    b: "A stranger who followed you on social media for two years",
  },
  {
    text: "You must pick the theme song that plays every time you walk into a room:",
    a: "The Jaws theme",
    b: "The circus entrance music",
  },
  {
    text: "You have to give a 30-second speech every time you:",
    a: "Enter a restaurant",
    b: "Exit a restroom",
  },
  {
    text: "You can only eat soup or:",
    a: "Everything else but only with chopsticks, always",
    b: "Soup forever but you must slurp loudly every time",
  },
  {
    text: "For the rest of your life your laugh is replaced with:",
    a: "A squeaky toy sound",
    b: "A slow-motion replay of itself",
  },
  {
    text: "Your professional email signature must permanently include one of these:",
    a: "A motivational quote chosen at random every time",
    b: "A fun fact about yourself that gets more embarrassing over time",
  },
  {
    text: "You gain the ability to talk to one group of animals but they:",
    a: "Only want to discuss your personal failures",
    b: "Give excellent advice but in extremely vague riddles",
  },
  {
    text: "Every online review you leave must be:",
    a: "Written entirely in song lyrics",
    b: "A minimum of 1,000 words",
  },
  {
    text: "You have to narrate your life as either:",
    a: "A nature documentary",
    b: "A cooking show",
  },
  {
    text: "You must live in one of these places permanently:",
    a: "A houseboat that is always slightly rocking",
    b: "A studio apartment where the bed folds out of the wall and always falls down at 3am",
  },
  {
    text: "Your autocorrect is permanently set to replace your name with:",
    a: "Supreme Overlord",
    b: "Little Champ",
  },
  {
    text: "Every alarm you set from now on plays:",
    a: "A stadium crowd cheering at full volume",
    b: "A calm voice saying 'are you sure about this life choice?' on repeat",
  },
  {
    text: "You must choose one thing to be permanently true:",
    a: "Every sandwich you make falls apart immediately",
    b: "Every umbrella you own turns inside-out immediately upon opening",
  },
  {
    text: "For one year, all your passwords must be:",
    a: "Haiku-formatted phrases",
    b: "Full sentences explaining your deepest insecurity",
  },
  {
    text: "You wake up tomorrow able to speak a new language fluently but it's:",
    a: "Klingon",
    b: "Pig Latin",
  },
  {
    text: "Your future pets must all be named after:",
    a: "Minor historical figures nobody has heard of",
    b: "Random IKEA product names",
  },
  {
    text: "You have to choose your funeral song right now, and it will play at every birthday party you attend until then:",
    a: "My Heart Will Go On — full 4-minute version",
    b: "Happy Birthday but remixed as a death metal track",
  },
  {
    text: "You must pick one life rule to live by forever:",
    a: "You can never sit on a chair again — only the floor or standing",
    b: "You can never use a door again — only windows and other openings",
  },
];

export class FightOrFlightExperience implements ExperienceModule {
  readonly type = "fight_or_flight" as const;

  async onActivate(roomId: string, _hostGuestId: string): Promise<void> {
    const state: FightOrFlightState = {
      phase: "waiting",
      round: 0,
      totalRounds: 8,
      scores: {},
      currentScenario: null,
      choices: {},
    };
    await redisClient.set(KEY(roomId), JSON.stringify(state));
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
      case "start":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._start(roomId, io);
        break;

      case "choose":
        await this._choose(roomId, guestId, p.choice, io);
        break;

      case "reveal":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._reveal(roomId, io);
        break;

      case "next":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._next(roomId, io);
        break;

      case "end":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this.onDeactivate(roomId);
        await redisClient.set(`room:${roomId}:experience`, "dj");
        io.to(roomId).emit("experience:changed" as any, {
          experienceType: "dj",
          view: { type: "dj_queue" },
          sequenceId: await getNextSequenceId(roomId),
        });
        break;
    }
  }

  async getGuestViewDescriptor(roomId: string): Promise<GuestViewDescriptor> {
    const state = await this._load(roomId);
    if (!state) return { type: "intermission" };
    return { type: "fight_or_flight" as any, data: this._safeState(state) };
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private async _start(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;

    state.round = 1;
    state.choices = {};
    state.currentScenario = SCENARIOS[0];
    state.phase = "question";

    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  private async _choose(roomId: string, guestId: string, choice: "a" | "b", io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || state.phase !== "question") return;
    if (state.choices[guestId] !== undefined) return; // Already chose
    if (choice !== "a" && choice !== "b") return;

    state.choices[guestId] = choice;
    await this._save(roomId, state);
    // No broadcast — choices hidden until reveal
  }

  private async _reveal(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || state.phase !== "question") return;

    // Tally choices
    let aCount = 0;
    let bCount = 0;
    for (const c of Object.values(state.choices)) {
      if (c === "a") aCount++;
      else bCount++;
    }

    const majorityChoice: "a" | "b" | null = aCount > bCount ? "a" : bCount > aCount ? "b" : null;

    for (const [gId, choice] of Object.entries(state.choices)) {
      if (majorityChoice === null) {
        // Tie — everyone gets the consolation prize
        state.scores[gId] = (state.scores[gId] ?? 0) + 50;
      } else if (choice === majorityChoice) {
        state.scores[gId] = (state.scores[gId] ?? 0) + 200;
      } else {
        state.scores[gId] = (state.scores[gId] ?? 0) + 50;
      }
    }

    state.phase = "reveal";
    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
    setTimeout(() => this._next(roomId, io).catch(() => {}), 4000);
  }

  private async _next(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;

    const nextRound = state.round + 1;
    if (nextRound > state.totalRounds || nextRound > SCENARIOS.length) {
      state.phase = "finished";
      state.currentScenario = null;
      await this._save(roomId, state);
      await this._broadcast(roomId, state, io);
      return;
    }

    state.round = nextRound;
    state.choices = {};
    state.currentScenario = SCENARIOS[nextRound - 1];
    state.phase = "question";

    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  /** Hide individual choices during question phase */
  private _safeState(state: FightOrFlightState): unknown {
    if (state.phase === "question") {
      const { choices, ...rest } = state;
      return { ...rest, choiceCount: Object.keys(choices).length };
    }
    return state;
  }

  private async _broadcast(roomId: string, state: FightOrFlightState, io: Server): Promise<void> {
    const seq = await getNextSequenceId(roomId);
    const safe = this._safeState(state);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "fight_or_flight",
      state: safe,
      view: { type: "fight_or_flight" as any, data: safe },
      sequenceId: seq,
    });
  }

  private async _load(roomId: string): Promise<FightOrFlightState | null> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }

  private async _save(roomId: string, state: FightOrFlightState): Promise<void> {
    await redisClient.set(KEY(roomId), JSON.stringify(state));
  }
}
