import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";
import { shuffledIndices } from "../../lib/shuffle";

// ─────────────────────────────────────────────────────────────────────────────
// Would You Rather Experience
//
// Everyone votes A or B. Majority gets +200, minority gets +50 (for being bold).
// Host controls pacing. 8 dilemmas per game.
//
// Actions:
//   HOST:  start, reveal, next, end
//   GUEST: vote
// ─────────────────────────────────────────────────────────────────────────────

const DILEMMAS: { a: string; b: string }[] = [
  { a: "Never listen to music again", b: "Never watch TV or movies again" },
  { a: "Always speak in rhyme", b: "Always speak in song" },
  { a: "Have a party every weekend forever", b: "Have the best house party of your life, just once" },
  { a: "Know the lyrics to every song", b: "Be able to play every instrument perfectly" },
  { a: "Only eat food from one restaurant for a year", b: "Only wear one outfit for a year" },
  { a: "Sneeze every time you laugh", b: "Laugh every time you sneeze" },
  { a: "Have a rewind button for your life", b: "Have a pause button for your life" },
  { a: "Hiccup once every minute for the rest of your life", b: "Burp every time you shake someone's hand" },
];

interface WouldYouRatherState {
  phase: "waiting" | "question" | "reveal" | "finished";
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
  currentQ: { a: string; b: string } | null;
  votes: Record<string, "a" | "b">;
  aCount: number;
  bCount: number;
  queue: number[];
}

const KEY = (roomId: string) => `experience:would_you_rather:${roomId}`;

export class WouldYouRatherExperience implements ExperienceModule {
  readonly type = "would_you_rather" as const;

  async onActivate(roomId: string, _hostGuestId: string): Promise<void> {
    const state: WouldYouRatherState = {
      phase: "waiting",
      round: 0,
      totalRounds: DILEMMAS.length,
      scores: {},
      currentQ: null,
      votes: {},
      aCount: 0,
      bCount: 0,
      queue: shuffledIndices(DILEMMAS.length),
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
    const raw = await redisClient.get(KEY(roomId));
    if (!raw) return;
    const state: WouldYouRatherState = JSON.parse(raw);

    switch (action) {
      case "start": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        state.phase = "question";
        state.round = 1;
        state.queue = shuffledIndices(DILEMMAS.length);
        state.currentQ = DILEMMAS[state.queue[0]];
        state.votes = {};
        state.aCount = 0;
        state.bCount = 0;
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "would_you_rather",
          state,
          view: { type: "would_you_rather", data: state },
          sequenceId: seq,
        });
        break;
      }

      case "vote": {
        if (state.phase !== "question") return;
        const p = payload as { choice: "a" | "b" };
        if (!p?.choice || (p.choice !== "a" && p.choice !== "b")) return;
        // Allow re-voting — update previous vote counts
        const prev = state.votes[guestId];
        if (prev === "a") state.aCount = Math.max(0, state.aCount - 1);
        if (prev === "b") state.bCount = Math.max(0, state.bCount - 1);
        state.votes[guestId] = p.choice;
        if (p.choice === "a") state.aCount++;
        else state.bCount++;
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        // Broadcast updated vote counts (without revealing who voted what)
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "would_you_rather",
          state: { ...state, votes: {} }, // hide individual votes until reveal
          view: { type: "would_you_rather", data: { ...state, votes: {} } },
          sequenceId: seq,
        });
        break;
      }

      case "reveal": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        if (state.phase !== "question") return;
        // Tally: majority choice gets +200, minority gets +50
        const majority: "a" | "b" = state.aCount >= state.bCount ? "a" : "b";
        const minority: "a" | "b" = majority === "a" ? "b" : "a";
        for (const [voter, choice] of Object.entries(state.votes)) {
          const pts = choice === majority ? 200 : 50;
          state.scores[voter] = (state.scores[voter] ?? 0) + pts;
        }
        state.phase = "reveal";
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "would_you_rather",
          state,
          view: {
            type: "would_you_rather",
            data: { ...state, aCount: state.aCount, bCount: state.bCount, majority, minority },
          },
          sequenceId: seq,
        });
        break;
      }

      case "next": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        if (state.phase !== "reveal") return;
        state.round += 1;
        if (state.round > state.totalRounds) {
          state.phase = "finished";
          state.currentQ = null;
          await redisClient.set(KEY(roomId), JSON.stringify(state));
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "would_you_rather",
            state,
            view: { type: "leaderboard", data: state.scores },
            sequenceId: seq,
          });
        } else {
          state.phase = "question";
          state.currentQ = DILEMMAS[state.queue[(state.round - 1) % state.queue.length]];
          state.votes = {};
          state.aCount = 0;
          state.bCount = 0;
          await redisClient.set(KEY(roomId), JSON.stringify(state));
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "would_you_rather",
            state,
            view: { type: "would_you_rather", data: state },
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
    const state: WouldYouRatherState = JSON.parse(raw);
    if (state.phase === "finished") return { type: "leaderboard", data: state.scores };
    return { type: "would_you_rather" as any, data: state };
  }
}
