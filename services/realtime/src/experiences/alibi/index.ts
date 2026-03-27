import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";
import { shuffledIndices } from "../../lib/shuffle";

// ─────────────────────────────────────────────────────────────────────────────
// Alibi Experience
//
// Guests read a silly crime case with multiple suspects and their alibis.
// Everyone votes on who they think is guilty. Host reveals the answer.
// Correct guessers earn +400 points.
//
// Actions:
//   HOST:  start, ready_to_vote, reveal, next, end
//   GUEST: vote
// ─────────────────────────────────────────────────────────────────────────────

const KEY = (roomId: string) => `experience:alibi:${roomId}`;

interface Suspect {
  name: string;
  alibi: string;
}

interface CrimeCase {
  crime: string;
  suspects: Suspect[];
  guiltyIndex: number; // index into suspects[]
}

interface AlibiState {
  phase: "waiting" | "reading" | "voting" | "reveal" | "finished";
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
  currentCase: Omit<CrimeCase, "guiltyIndex"> | null; // guiltyIndex hidden during play
  votes: Record<string, number>; // guestId -> suspected index
  queue: number[];
}

const CASES: CrimeCase[] = [
  {
    crime: "Someone ate Gary's clearly-labelled office lunch from the communal fridge. The crime scene: one empty Tupperware container smelling of lasagne.",
    suspects: [
      {
        name: "Brenda from Accounts",
        alibi: "I was in a three-hour budget meeting. I have seventeen witnesses and a PowerPoint to prove it.",
      },
      {
        name: "Todd the Intern",
        alibi: "I don't even like lasagne. I'm more of a sad desk salad person.",
      },
      {
        name: "Deborah, Head of HR",
        alibi: "I was attending a workplace sensitivity training — ironically about stealing.",
      },
    ],
    guiltyIndex: 2,
  },
  {
    crime: "The office plant, Gerald, was found wilting dramatically next to the break room sink. He had been watered with what lab tests confirmed was cold brew coffee.",
    suspects: [
      {
        name: "Marcus, the Remote Worker",
        alibi: "I've been working from home for six months. I haven't been near Gerald since March.",
      },
      {
        name: "Stacey from Sales",
        alibi: "I love plants. I have forty-seven at home. Why would I hurt one?",
      },
      {
        name: "Kevin, IT Support",
        alibi: "I thought plants needed caffeine. They look tired. Was that wrong?",
      },
    ],
    guiltyIndex: 2,
  },
  {
    crime: "Someone changed the office Wi-Fi password to 'IHateMondays99' and did not tell anyone. The building was without internet for two hours.",
    suspects: [
      {
        name: "Linda the Office Manager",
        alibi: "I was giving a tour to new starters all morning. Ask any of the six confused graduates.",
      },
      {
        name: "Phil from Operations",
        alibi: "I only know one password and it's my dog's name. I can't be trusted with tech.",
      },
      {
        name: "Anya, Junior Developer",
        alibi: "I was trying to fix a memory leak. I needed peace and quiet.",
      },
    ],
    guiltyIndex: 2,
  },
];

export class AlibiExperience implements ExperienceModule {
  readonly type = "alibi" as const;

  async onActivate(roomId: string, _hostGuestId: string): Promise<void> {
    const state: AlibiState = {
      phase: "waiting",
      round: 0,
      totalRounds: 3,
      scores: {},
      currentCase: null,
      votes: {},
      queue: shuffledIndices(CASES.length),
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

      case "ready_to_vote":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._readyToVote(roomId, io);
        break;

      case "vote":
        await this._vote(roomId, guestId, p.suspectIndex, io);
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
    return { type: "alibi" as any, data: this._safeState(state) };
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private async _start(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;

    state.queue = shuffledIndices(CASES.length);
    const caseData = CASES[state.queue[0]];
    state.round = 1;
    state.votes = {};
    state.currentCase = { crime: caseData.crime, suspects: caseData.suspects };
    state.phase = "reading";

    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  private async _readyToVote(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || state.phase !== "reading") return;

    state.votes = {};
    state.phase = "voting";

    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  private async _vote(roomId: string, guestId: string, suspectIndex: number, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || state.phase !== "voting") return;
    if (state.votes[guestId] !== undefined) return; // Already voted
    if (!state.currentCase) return;
    if (typeof suspectIndex !== "number" || suspectIndex < 0 || suspectIndex >= state.currentCase.suspects.length) return;

    state.votes[guestId] = suspectIndex;
    await this._save(roomId, state);
    // No broadcast — revealed at reveal phase
  }

  private async _reveal(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || state.phase !== "voting") return;

    const caseIndex = state.queue[(state.round - 1) % state.queue.length];
    const guiltyIndex = CASES[caseIndex]?.guiltyIndex ?? 0;

    for (const [gId, votedIndex] of Object.entries(state.votes)) {
      if (votedIndex === guiltyIndex) {
        state.scores[gId] = (state.scores[gId] ?? 0) + 400;
      }
    }

    state.phase = "reveal";
    await this._save(roomId, state);

    // Broadcast with guilty index revealed
    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "alibi",
      state: { ...state, guiltyIndex },
      view: { type: "alibi" as any, data: { ...state, guiltyIndex } },
      sequenceId: seq,
    });
  }

  private async _next(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;

    const nextRound = state.round + 1;
    if (nextRound > state.totalRounds || nextRound > CASES.length) {
      state.phase = "finished";
      state.currentCase = null;
      await this._save(roomId, state);
      await this._broadcast(roomId, state, io);
      return;
    }

    const caseData = CASES[state.queue[(nextRound - 1) % state.queue.length]];
    state.round = nextRound;
    state.votes = {};
    state.currentCase = { crime: caseData.crime, suspects: caseData.suspects };
    state.phase = "reading";

    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  /** Hide votes during non-reveal phases */
  private _safeState(state: AlibiState): unknown {
    if (state.phase === "voting") {
      const { votes, ...rest } = state;
      return { ...rest, voteCount: Object.keys(votes).length };
    }
    return state;
  }

  private async _broadcast(roomId: string, state: AlibiState, io: Server): Promise<void> {
    const seq = await getNextSequenceId(roomId);
    const safe = this._safeState(state);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "alibi",
      state: safe,
      view: { type: "alibi" as any, data: safe },
      sequenceId: seq,
    });
  }

  private async _load(roomId: string): Promise<AlibiState | null> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }

  private async _save(roomId: string, state: AlibiState): Promise<void> {
    await redisClient.set(KEY(roomId), JSON.stringify(state));
  }
}
