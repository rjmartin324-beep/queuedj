import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";

// ─────────────────────────────────────────────────────────────────────────────
// Celebrity Head Experience
//
// A celebrity is secretly assigned to a guest. Other guests and the host can
// see it — the target guest cannot. The target asks yes/no questions to
// figure out who they are. Getting it right earns +400 pts.
//
// Actions:
//   HOST:  start, answer_yes, answer_no, got_it (if host confirms), pass, end
//   GUEST: got_it (self guess), pass
// ─────────────────────────────────────────────────────────────────────────────

const CELEBRITIES: string[] = [
  "Taylor Swift",
  "Elon Musk",
  "Beyoncé",
  "LeBron James",
  "Rihanna",
  "Kanye West",
  "Oprah Winfrey",
  "Justin Bieber",
  "Adele",
  "Drake",
  "Kim Kardashian",
  "Cristiano Ronaldo",
  "Lady Gaga",
  "The Rock",
  "Billie Eilish",
  "Zendaya",
  "Bad Bunny",
  "Harry Styles",
];

interface CelebrityHeadState {
  phase: "waiting" | "playing" | "reveal" | "finished";
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
  currentGuestId: string | null;
  celebrity: string | null;
  questionsAsked: number;
  gotIt: boolean;
  usedCelebrities: string[];
}

const KEY = (roomId: string) => `experience:celebrity_head:${roomId}`;

export class CelebrityHeadExperience implements ExperienceModule {
  readonly type = "celebrity_head" as const;

  async onActivate(roomId: string, _hostGuestId: string): Promise<void> {
    const state: CelebrityHeadState = {
      phase: "waiting",
      round: 0,
      totalRounds: 5,
      scores: {},
      currentGuestId: null,
      celebrity: null,
      questionsAsked: 0,
      gotIt: false,
      usedCelebrities: [],
    };
    await redisClient.set(KEY(roomId), JSON.stringify(state));
  }

  async onDeactivate(roomId: string): Promise<void> {
    await redisClient.del(KEY(roomId));
  }

  private _pickCelebrity(used: string[]): string {
    const remaining = CELEBRITIES.filter(c => !used.includes(c));
    const pool = remaining.length > 0 ? remaining : CELEBRITIES;
    return pool[Math.floor(Math.random() * pool.length)];
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
    const state: CelebrityHeadState = JSON.parse(raw);

    switch (action) {
      case "start": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        const p = payload as { guestIds: string[] };
        if (!p?.guestIds?.length) return;
        const firstGuest = p.guestIds[0];
        const celeb = this._pickCelebrity(state.usedCelebrities);
        state.phase = "playing";
        state.round = 1;
        state.currentGuestId = firstGuest;
        state.celebrity = celeb;
        state.questionsAsked = 0;
        state.gotIt = false;
        state.usedCelebrities = [...state.usedCelebrities, celeb];
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        // Send full state to all — the UI is responsible for hiding the
        // celebrity from the current player using currentGuestId
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "celebrity_head",
          state,
          view: { type: "celebrity_head", data: state },
          sequenceId: seq,
        });
        break;
      }

      case "answer_yes": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        if (state.phase !== "playing") return;
        state.questionsAsked += 1;
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "celebrity_head",
          state,
          view: { type: "celebrity_head", data: { ...state, lastAnswer: "yes" } },
          sequenceId: seq,
        });
        break;
      }

      case "answer_no": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        if (state.phase !== "playing") return;
        state.questionsAsked += 1;
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "celebrity_head",
          state,
          view: { type: "celebrity_head", data: { ...state, lastAnswer: "no" } },
          sequenceId: seq,
        });
        break;
      }

      case "got_it": {
        // Either the current guest self-declares, or host confirms
        const isCurrentGuest = guestId === state.currentGuestId;
        const isAuthority = role === "HOST" || role === "CO_HOST";
        if (!isCurrentGuest && !isAuthority) return;
        if (state.phase !== "playing" || !state.currentGuestId) return;
        state.scores[state.currentGuestId] =
          (state.scores[state.currentGuestId] ?? 0) + 400;
        state.gotIt = true;
        state.phase = "reveal";
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "celebrity_head",
          state,
          view: { type: "celebrity_head", data: state },
          sequenceId: seq,
        });
        break;
      }

      case "pass": {
        if (state.phase !== "playing") return;
        // No pts awarded — just advance round
        state.phase = "reveal";
        state.gotIt = false;
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "celebrity_head",
          state,
          view: { type: "celebrity_head", data: state },
          sequenceId: seq,
        });
        break;
      }

      case "next": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        if (state.phase !== "reveal") return;
        const p = payload as { guestIds?: string[] };
        state.round += 1;
        if (state.round > state.totalRounds) {
          state.phase = "finished";
          state.celebrity = null;
          state.currentGuestId = null;
          await redisClient.set(KEY(roomId), JSON.stringify(state));
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "celebrity_head",
            state,
            view: { type: "leaderboard", data: state.scores },
            sequenceId: seq,
          });
        } else {
          const celeb = this._pickCelebrity(state.usedCelebrities);
          let nextGuest = state.currentGuestId;
          if (p?.guestIds?.length) {
            const idx = p.guestIds.indexOf(state.currentGuestId ?? "");
            nextGuest = p.guestIds[(idx + 1) % p.guestIds.length];
          }
          state.phase = "playing";
          state.celebrity = celeb;
          state.currentGuestId = nextGuest;
          state.questionsAsked = 0;
          state.gotIt = false;
          state.usedCelebrities = [...state.usedCelebrities, celeb];
          await redisClient.set(KEY(roomId), JSON.stringify(state));
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "celebrity_head",
            state,
            view: { type: "celebrity_head", data: state },
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
    const state: CelebrityHeadState = JSON.parse(raw);
    if (state.phase === "finished") return { type: "leaderboard", data: state.scores };
    return { type: "celebrity_head" as any, data: state };
  }
}
