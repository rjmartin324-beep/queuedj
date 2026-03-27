import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";
import { shuffledIndices } from "../../lib/shuffle";

// ─────────────────────────────────────────────────────────────────────────────
// Who Knows Who Experience
//
// "Who in the group is most likely to..." — guests vote for a peer guestId.
// The majority answer wins; voters who matched majority earn points.
//
// Actions:
//   HOST:  start, reveal, next, end
//   GUEST: vote
// ─────────────────────────────────────────────────────────────────────────────

const KEY = (roomId: string) => `experience:who_knows_who:${roomId}`;

interface WhoKnowsWhoQuestion {
  text: string; // "Who is most likely to..."
}

interface WhoKnowsWhoState {
  phase: "waiting" | "question" | "reveal" | "finished";
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
  currentQ: { text: string; options: string[] } | null; // options = guestIds
  votes: Record<string, string>; // voter guestId -> target guestId
  correctAnswer: string | null;  // majority winner revealed after reveal
  tally: Record<string, number>; // guestId -> vote count (revealed on reveal)
  guestIds: string[];            // participant list
  queue: number[];
}

const QUESTIONS: WhoKnowsWhoQuestion[] = [
  { text: "Who is most likely to accidentally send a text to the wrong person?" },
  { text: "Who is most likely to survive a zombie apocalypse?" },
  { text: "Who is most likely to become famous one day?" },
  { text: "Who is most likely to eat the last slice of pizza without asking?" },
  { text: "Who is most likely to show up late to their own birthday party?" },
  { text: "Who is most likely to go on a spontaneous road trip?" },
  { text: "Who is most likely to win a dance-off?" },
  { text: "Who is most likely to forget where they parked their car?" },
  // ── Added questions to reach 50 total ──────────────────────────────────────
  { text: "Who is most likely to start a business and actually make it work?" },
  { text: "Who is most likely to cry at a movie and pretend they weren't?" },
  { text: "Who is most likely to cancel plans five minutes before they're supposed to leave?" },
  { text: "Who is most likely to accidentally start a viral rumour?" },
  { text: "Who is most likely to adopt ten animals?" },
  { text: "Who is most likely to spend their last $20 on takeout instead of groceries?" },
  { text: "Who is most likely to move to another country on a whim?" },
  { text: "Who is most likely to argue with a stranger on the internet?" },
  { text: "Who is most likely to binge-watch an entire series in one day?" },
  { text: "Who is most likely to get a tattoo they will regret?" },
  { text: "Who is most likely to be featured on a true crime podcast as the victim who survived?" },
  { text: "Who is most likely to accidentally text the wrong person something embarrassing?" },
  { text: "Who is most likely to show up to a party way too early?" },
  { text: "Who is most likely to still be awake at 4am for no good reason?" },
  { text: "Who is most likely to become a social media influencer?" },
  { text: "Who is most likely to eat something off the floor without hesitation?" },
  { text: "Who is most likely to get lost in a city they've lived in for years?" },
  { text: "Who is most likely to try every food trend?" },
  { text: "Who is most likely to end up on a reality TV show?" },
  { text: "Who is most likely to bring homemade food to a party that nobody asked for?" },
  { text: "Who is most likely to fall asleep during an important meeting?" },
  { text: "Who is most likely to win a trivia competition?" },
  { text: "Who is most likely to lose their keys, wallet, and phone in the same day?" },
  { text: "Who is most likely to be in a long-distance relationship?" },
  { text: "Who is most likely to give the best advice but never follow it themselves?" },
  { text: "Who is most likely to accidentally pocket-dial someone during an embarrassing moment?" },
  { text: "Who is most likely to strike up a conversation with a complete stranger and make a new best friend?" },
  { text: "Who is most likely to quit their job to travel the world?" },
  { text: "Who is most likely to show up to an event overdressed?" },
  { text: "Who is most likely to go viral for something ridiculous?" },
  { text: "Who is most likely to have a secret talent that nobody knows about?" },
  { text: "Who is most likely to organise a flash mob?" },
  { text: "Who is most likely to have the most chaotic energy in a crisis?" },
  { text: "Who is most likely to write a memoir someday?" },
  { text: "Who is most likely to still be using the same phone in 10 years?" },
  { text: "Who is most likely to turn a 5-minute errand into a 3-hour adventure?" },
  { text: "Who is most likely to make a dramatic life change out of nowhere?" },
  { text: "Who is most likely to have a hidden talent for a sport nobody expected?" },
  { text: "Who is most likely to accidentally ruin a surprise party?" },
  { text: "Who is most likely to leave the party and not say goodbye to anyone?" },
  { text: "Who is most likely to be the last one to leave the dance floor?" },
  { text: "Who is most likely to have a signature catchphrase that everyone knows?" },
  // ── added to reach 100 ───────────────────────────────────────────────────────
  { text: "Who is most likely to accidentally volunteer for something they deeply regret?" },
  { text: "Who is most likely to fall asleep on public transport and miss their stop?" },
  { text: "Who is most likely to have an opinion about everything at all times?" },
  { text: "Who is most likely to go full method actor for a Halloween costume?" },
  { text: "Who is most likely to be the one everyone calls at 2am in a crisis?" },
  { text: "Who is most likely to have the messiest handbag or backpack?" },
  { text: "Who is most likely to name their children after fictional characters?" },
  { text: "Who is most likely to start a band and actually follow through?" },
  { text: "Who is most likely to spend their entire paycheck in the first three days?" },
  { text: "Who is most likely to get into a heated debate about something nobody else cares about?" },
  { text: "Who is most likely to sneak their pet into a place pets are not allowed?" },
  { text: "Who is most likely to go to a music festival alone and love it?" },
  { text: "Who is most likely to cry at an advertisement?" },
  { text: "Who is most likely to start a podcast that somehow gets really popular?" },
  { text: "Who is most likely to have a plan for the zombie apocalypse already written down?" },
  { text: "Who is most likely to try to fix something themselves and make it significantly worse?" },
  { text: "Who is most likely to introduce everyone to a band nobody's heard of?" },
  { text: "Who is most likely to marry someone they met on an app?" },
  { text: "Who is most likely to be wearing the most comfortable shoes at a formal event?" },
  { text: "Who is most likely to ghost someone after three weeks of great conversation?" },
  { text: "Who is most likely to accidentally confess something huge in a group chat?" },
  { text: "Who is most likely to turn a one-hour errand into an all-day event and have stories?" },
  { text: "Who is most likely to go on a silent retreat and last twelve hours?" },
  { text: "Who is most likely to become obsessed with a very niche hobby for exactly six weeks?" },
  { text: "Who is most likely to start an argument about the correct way to load a dishwasher?" },
  { text: "Who is most likely to have seventeen unread emails and feel completely fine about it?" },
  { text: "Who is most likely to leave a five-star review for a place that was just average?" },
  { text: "Who is most likely to be filming themselves during an emergency?" },
  { text: "Who is most likely to have met a celebrity and not made a big deal of it?" },
  { text: "Who is most likely to be the last person to know about something the whole group already knows?" },
  { text: "Who is most likely to try a new diet every two weeks and tell everyone about it?" },
  { text: "Who is most likely to name their houseplants and check on them more than their friends?" },
  { text: "Who is most likely to get recognised in public one day?" },
  { text: "Who is most likely to immediately regret a haircut but pretend they love it for weeks?" },
  { text: "Who is most likely to accidentally become the main character of a situation?" },
  { text: "Who is most likely to be described as 'a lot' by someone who loves them?" },
  { text: "Who is most likely to have a drawer in their home that nobody is allowed to open?" },
  { text: "Who is most likely to get personally offended by a film they chose to watch?" },
  { text: "Who is most likely to bring homemade baked goods to every social event forever?" },
  { text: "Who is most likely to leave a house party having made three new best friends they'll never see again?" },
  { text: "Who is most likely to have a tattoo that is meaningful but also a little bit chaotic?" },
  { text: "Who is most likely to win a staring contest against anyone?" },
  { text: "Who is most likely to have a very specific and unusual morning ritual?" },
  { text: "Who is most likely to adopt a 'live laugh love' attitude completely unironically?" },
  { text: "Who is most likely to have genuinely excellent reasons for doing something ridiculous?" },
  { text: "Who is most likely to have seventeen tabs open and be stressed by all of them?" },
  { text: "Who is most likely to make a toast at a dinner they weren't asked to make a toast at?" },
];

export class WhoKnowsWhoExperience implements ExperienceModule {
  readonly type = "who_knows_who" as const;

  async onActivate(roomId: string, _hostGuestId: string): Promise<void> {
    const membersRaw = await redisClient.sMembers(`room:${roomId}:members`);
    const state: WhoKnowsWhoState = {
      phase: "waiting",
      round: 0,
      totalRounds: 8,
      scores: {},
      currentQ: null,
      votes: {},
      correctAnswer: null,
      tally: {},
      guestIds: membersRaw,
      queue: shuffledIndices(QUESTIONS.length),
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
        await this._start(roomId, p.guestIds ?? [], io);
        break;

      case "vote":
        await this._vote(roomId, guestId, p.targetGuestId, io);
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
    return { type: "who_knows_who" as any, data: this._safeState(state) };
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private async _start(roomId: string, providedGuestIds: string[], io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;

    // Use provided list or fall back to stored membership
    if (providedGuestIds.length > 0) {
      state.guestIds = providedGuestIds;
    } else if (state.guestIds.length === 0) {
      state.guestIds = await redisClient.sMembers(`room:${roomId}:members`);
    }

    state.round = 1;
    state.votes = {};
    state.correctAnswer = null;
    state.tally = {};
    state.queue = shuffledIndices(QUESTIONS.length);
    state.currentQ = { text: QUESTIONS[state.queue[0]].text, options: state.guestIds };
    state.phase = "question";

    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  private async _vote(roomId: string, guestId: string, targetGuestId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || state.phase !== "question") return;
    if (state.votes[guestId] !== undefined) return; // Already voted
    if (!state.guestIds.includes(targetGuestId)) return; // Invalid target

    state.votes[guestId] = targetGuestId;
    await this._save(roomId, state);
    // No broadcast — count revealed at reveal phase
  }

  private async _reveal(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || state.phase !== "question") return;

    // Tally votes to find majority
    const tally: Record<string, number> = {};
    for (const targetId of Object.values(state.votes)) {
      tally[targetId] = (tally[targetId] ?? 0) + 1;
    }

    let majorityId: string | null = null;
    let highestCount = 0;
    for (const [id, count] of Object.entries(tally)) {
      if (count > highestCount) {
        highestCount = count;
        majorityId = id;
      }
    }

    state.correctAnswer = majorityId;
    state.tally = tally;

    // Award +250 to guests who voted for the majority
    if (majorityId) {
      for (const [voterId, targetId] of Object.entries(state.votes)) {
        if (targetId === majorityId) {
          state.scores[voterId] = (state.scores[voterId] ?? 0) + 250;
        }
      }
    }

    state.phase = "reveal";
    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  private async _next(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;

    const nextRound = state.round + 1;
    if (nextRound > state.totalRounds || nextRound > QUESTIONS.length) {
      state.phase = "finished";
      state.currentQ = null;
      await this._save(roomId, state);
      await this._broadcast(roomId, state, io);
      return;
    }

    state.round = nextRound;
    state.votes = {};
    state.correctAnswer = null;
    state.tally = {};
    state.currentQ = { text: QUESTIONS[state.queue[(nextRound - 1) % state.queue.length]].text, options: state.guestIds };
    state.phase = "question";

    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  /** Hide raw votes during question phase; expose tally only on reveal */
  private _safeState(state: WhoKnowsWhoState): Omit<WhoKnowsWhoState, "votes"> & { voteCount: number } {
    const { votes, ...safe } = state;
    if (state.phase !== "reveal" && state.phase !== "finished") {
      // During question phase, hide tally too
      return { ...safe, tally: {}, voteCount: Object.keys(votes).length };
    }
    return { ...safe, voteCount: Object.keys(votes).length };
  }

  private async _broadcast(roomId: string, state: WhoKnowsWhoState, io: Server): Promise<void> {
    const seq = await getNextSequenceId(roomId);
    const safeState = this._safeState(state);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "who_knows_who",
      state: safeState,
      view: { type: "who_knows_who" as any, data: safeState },
      sequenceId: seq,
    });
  }

  private async _load(roomId: string): Promise<WhoKnowsWhoState | null> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }

  private async _save(roomId: string, state: WhoKnowsWhoState): Promise<void> {
    await redisClient.set(KEY(roomId), JSON.stringify(state));
  }
}
