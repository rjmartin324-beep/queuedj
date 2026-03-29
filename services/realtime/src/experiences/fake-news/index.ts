import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";
import { shuffledIndices } from "../../lib/shuffle";

// ─────────────────────────────────────────────────────────────────────────────
// Fake News Experience
//
// A news headline is displayed. Players vote whether it is real or fake.
// Streaks multiply points. Host reveals answer and advances rounds.
//
// Actions:
//   HOST/CO_HOST: start, reveal, next, end_game, end
//   GUEST:        vote
// ─────────────────────────────────────────────────────────────────────────────

const KEY = (roomId: string) => `experience:fake_news:${roomId}`;

// ─── Content ─────────────────────────────────────────────────────────────────

interface Headline {
  text: string;
  isReal: boolean;
}

const HEADLINES: Headline[] = [
  { text: "Scientists discover a new species of deep-sea fish that glows in three colors.", isReal: true },
  { text: "A town in Norway experiences 69 days of continuous sunlight each summer.", isReal: true },
  { text: "The inventor of the frisbee was turned into a frisbee after he died.", isReal: true },
  { text: "A group of flamingos is called a flamboyance.", isReal: true },
  { text: "Oxford University is older than the Aztec Empire.", isReal: true },
  { text: "Scientists confirmed that lightning never strikes the same place twice.", isReal: false },
  { text: "A man in Japan was legally declared a bear after living in the woods for 11 years.", isReal: false },
  { text: "NASA accidentally deleted the original moon landing footage while recording a football game.", isReal: false },
  { text: "Scientists in Germany created a song so catchy it caused traffic accidents.", isReal: false },
  { text: "A California man successfully sued a casino after they used his lucky pen without permission.", isReal: false },
  // ── Real ──────────────────────────────────────────────────────────────────
  { text: "Cleopatra lived closer in time to the Moon landing than to the construction of the Great Pyramid.", isReal: true },
  { text: "A pilot was once fined for flying his plane too slowly.", isReal: true },
  { text: "Nintendo was founded in 1889 as a playing card company.", isReal: true },
  { text: "There is a species of jellyfish that is considered biologically immortal.", isReal: true },
  { text: "The shortest war in history lasted 38 minutes.", isReal: true },
  { text: "Honey found in Egyptian tombs over 3,000 years old was still edible.", isReal: true },
  { text: "A day on Venus is longer than a year on Venus.", isReal: true },
  { text: "The surface area of Russia is larger than that of Pluto.", isReal: true },
  { text: "Scotland's national animal is the unicorn.", isReal: true },
  { text: "Wombats produce cube-shaped droppings.", isReal: true },
  { text: "Bananas are technically berries, but strawberries are not.", isReal: true },
  { text: "A shrimp's heart is located in its head.", isReal: true },
  { text: "The Eiffel Tower can be 15 cm taller during summer due to thermal expansion.", isReal: true },
  { text: "Humans and giraffes have the same number of neck vertebrae.", isReal: true },
  { text: "An octopus has three hearts.", isReal: true },
  { text: "In Switzerland it is illegal to own just one guinea pig because they are social animals.", isReal: true },
  { text: "The inventor of the pringles can is buried inside one.", isReal: true },
  { text: "Sharks are older than trees.", isReal: true },
  { text: "Finland has more saunas than cars.", isReal: true },
  { text: "It is impossible to hum while holding your nose closed.", isReal: true },
  { text: "The original name for the search engine Google was 'Backrub'.", isReal: true },
  { text: "Coca-Cola was originally sold as a patent medicine.", isReal: true },
  { text: "A group of crows is called a murder.", isReal: true },
  { text: "Butterflies can taste with their feet.", isReal: true },
  { text: "A bolt of lightning is five times hotter than the surface of the sun.", isReal: true },
  { text: "Cats cannot taste sweetness.", isReal: true },
  { text: "The moon has moonquakes caused by Earth's gravity.", isReal: true },
  { text: "The unicorn is the national animal of Scotland.", isReal: true },
  { text: "Japan has more vending machines per capita than any other country.", isReal: true },
  { text: "Polar bears have black skin under their white fur.", isReal: true },
  { text: "The average cloud weighs about 500,000 kg.", isReal: true },
  { text: "In Alaska it is legal to shoot bears from a moving aircraft.", isReal: false },
  { text: "Humans have a weaker sense of smell than dogs.", isReal: true },
  { text: "The dot over a lowercase 'i' is called a tittle.", isReal: true },
  { text: "A group of cats is called a clowder.", isReal: true },
  { text: "The shortest complete sentence in English is 'I am'.", isReal: false },
  { text: "Armadillos can walk underwater along riverbed floors.", isReal: true },
  { text: "Dead stars can still be seen as light in the night sky.", isReal: true },
  // ── Fake ──────────────────────────────────────────────────────────────────
  { text: "A Dutch court ruled in 2019 that dogs have the same legal rights as children.", isReal: false },
  { text: "Scientists proved in 2021 that goldfish have a memory span of three seconds.", isReal: false },
  { text: "The Great Wall of China is visible from space with the naked eye.", isReal: false },
  { text: "Albert Einstein failed mathematics at school.", isReal: false },
  { text: "We only use 10% of our brains at any time.", isReal: false },
  { text: "Napoleon Bonaparte was unusually short for his time.", isReal: false },
  { text: "A Swedish man was granted a government disability allowance for being addicted to heavy metal music.", isReal: true },
  { text: "Toilet water spirals in different directions in the northern and southern hemispheres due to the Coriolis effect.", isReal: false },
  { text: "In 2014 a South Korean man legally changed his name to his Wi-Fi password so people would stop asking for it.", isReal: false },
  { text: "Bulls are attracted to the colour red.", isReal: false },
  { text: "Eating carrots improves your night vision.", isReal: false },
  { text: "A company in Japan once trained crows to collect rubbish in exchange for food.", isReal: true },
  { text: "You must wait 24 hours before filing a missing persons report in the UK.", isReal: false },
  { text: "A town in France banned clown costumes after a 2014 clown-attack panic.", isReal: true },
  { text: "Google once hired a camel to photograph the streets of a desert for Street View.", isReal: true },
  { text: "A man in Canada was fined for driving too slowly on a highway. The reason: he had set the cruise control and gone to the back seat to sleep.", isReal: false },
  { text: "An Italian man tried to claim tax deductions on his dog by registering it as a security guard.", isReal: true },
  { text: "A hotel in Sweden made entirely of ice melts and is rebuilt every year.", isReal: true },
  { text: "Researchers found that listening to Mozart temporarily raises IQ scores.", isReal: true },
  { text: "In 2018 a Portuguese court ruled that weather was legally a person's fault when they slipped on a wet floor.", isReal: false },
  { text: "In 2023 a New Zealand man won a legal dispute by submitting a deposition entirely in emoji.", isReal: false },
  { text: "Scientists at Harvard discovered that sleeping in a cold room burns more calories than exercise.", isReal: false },
  { text: "An airport in Amsterdam installed beehives on its roof to monitor air quality around the airfield.", isReal: true },
  { text: "A North Carolina county passed a local law forbidding aliens from parking their spaceships on public roads.", isReal: false },
  { text: "Australia's emu population once defeated the Australian military in a formal war.", isReal: true },
  { text: "A UK man legally changed his middle name to 'Danger' after losing a bet.", isReal: false },
  { text: "In 2012 a library in Belgium discovered it had been overdue a book since 1921 and sent the fine.", isReal: false },
  { text: "A theme park in Japan created a rollercoaster designed to make you cry.", isReal: true },
  { text: "Iceland has an official government registry for approved baby names.", isReal: true },
  { text: "A Michigan couple named their newborn twins 'Wifi' and 'Internet'.", isReal: false },
];

// ─── State ────────────────────────────────────────────────────────────────────

interface FakeNewsState {
  phase: "waiting" | "question" | "reveal" | "finished";
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
  currentHeadline: Headline | null;
  votes: Record<string, "real" | "fake">;
  streaks: Record<string, number>;
  queue: number[];
}

export class FakeNewsExperience implements ExperienceModule {
  readonly type = "fake_news" as const;
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  async onActivate(roomId: string): Promise<void> {
    const state: FakeNewsState = {
      phase: "waiting",
      round: 0,
      totalRounds: 10,
      scores: {},
      currentHeadline: null,
      votes: {},
      streaks: {},
      queue: shuffledIndices(HEADLINES.length),
    };
    await this._save(roomId, state);
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
    switch (action) {

      // ─── HOST: Start the game ──────────────────────────────────────────
      case "start": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        const state = await this._load(roomId);
        if (!state) return;

        state.phase = "question";
        state.round = 1;
        state.queue = shuffledIndices(HEADLINES.length);
        state.currentHeadline = HEADLINES[state.queue[0]];
        state.votes = {};
        state.streaks = {};
        state.scores = {};

        await this._save(roomId, state);
        await this._broadcastSafe(roomId, state, io);
        break;
      }

      // ─── GUEST: Vote real or fake ──────────────────────────────────────
      case "vote": {
        const state = await this._load(roomId);
        if (!state || state.phase !== "question") return;

        const p = payload as any;
        const choice: "real" | "fake" = p.choice === "real" ? "real" : "fake";
        state.votes[guestId] = choice;

        await this._save(roomId, state);

        // Acknowledge only to the voter — no full broadcast to avoid spoiling order
        const seq = await getNextSequenceId(roomId);
        io.to(guestId).emit("experience:state" as any, {
          experienceType: "fake_news",
          state: this._safeState(state),
          view: { type: "fake_news" as any, data: this._safeState(state) },
          sequenceId: seq,
        });
        break;
      }

      // ─── HOST: Reveal answers and score ───────────────────────────────
      case "reveal": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        const state = await this._load(roomId);
        if (!state || !state.currentHeadline) return;

        const correctChoice: "real" | "fake" = state.currentHeadline.isReal ? "real" : "fake";

        for (const [vid, vote] of Object.entries(state.votes)) {
          if (vote === correctChoice) {
            const streak = (state.streaks[vid] ?? 0) + 1;
            state.streaks[vid] = streak;
            state.scores[vid] = (state.scores[vid] ?? 0) + 100 * streak;
          } else {
            state.streaks[vid] = 0;
          }
        }

        state.phase = "reveal";
        await this._save(roomId, state);
        await this._broadcast(roomId, state, io);
        clearTimeout(this.timers.get(`${roomId}:reveal`));
        this.timers.set(`${roomId}:reveal`, setTimeout(async () => {
          try {
            const st = await this._load(roomId);
            if (st?.phase === "reveal") {
              const seqLb = await getNextSequenceId(roomId);
              io.to(roomId).emit("experience:state" as any, {
                experienceType: "fake_news",
                state: this._safeState(st),
                view: { type: "leaderboard", data: st.scores },
                sequenceId: seqLb,
              });
            }
          } catch {}
          this.timers.set(`${roomId}:advance`, setTimeout(() => this.handleAction({ action: "next", payload: {}, roomId, guestId: "", role: "HOST", io }).catch(() => {}), 3000));
        }, 4000));
        break;
      }

      // ─── HOST: Advance to next round ───────────────────────────────────
      case "next": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        const state = await this._load(roomId);
        if (!state || state.phase !== "reveal") return;

        state.round += 1;

        if (state.round > state.totalRounds) {
          state.phase = "finished";
          state.currentHeadline = null;
        } else {
          const headlineIdx = state.queue[(state.round - 1) % state.queue.length];
          state.phase = "question";
          state.currentHeadline = HEADLINES[headlineIdx];
          state.votes = {};
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
        state.currentHeadline = null;
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
    return { type: "fake_news" as any, data: this._safeState(state) };
  }

  async getBootstrapState(roomId: string): Promise<unknown> {
    const raw = await redisClient.get(KEY(roomId));
    if (!raw) return null;
    return this._safeState(JSON.parse(raw));
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  /** Strip isReal from currentHeadline so guests can't cheat */
  private _safeState(state: FakeNewsState): Omit<FakeNewsState, "currentHeadline"> & { currentHeadline: { text: string } | null } {
    const { currentHeadline, ...rest } = state;
    return {
      ...rest,
      currentHeadline: currentHeadline ? { text: currentHeadline.text } : null,
    };
  }

  /** Broadcast without revealing isReal (for question phase) */
  private async _broadcastSafe(roomId: string, state: FakeNewsState, io: Server): Promise<void> {
    const seq = await getNextSequenceId(roomId);
    const safe = this._safeState(state);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "fake_news",
      state: safe,
      view: { type: "fake_news" as any, data: safe },
      sequenceId: seq,
    });
  }

  /** Broadcast full state including isReal (for reveal phase) */
  private async _broadcast(roomId: string, state: FakeNewsState, io: Server): Promise<void> {
    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "fake_news",
      state,
      view: { type: "fake_news" as any, data: state },
      sequenceId: seq,
    });
  }

  private async _load(roomId: string): Promise<FakeNewsState | null> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }

  private async _save(roomId: string, state: FakeNewsState): Promise<void> {
    await redisClient.set(KEY(roomId), JSON.stringify(state), { EX: 14400 });
  }
}