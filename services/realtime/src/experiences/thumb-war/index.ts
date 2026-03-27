import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";
import { shuffledIndices } from "../../lib/shuffle";

const KEY = (roomId: string) => `experience:thumb_war:${roomId}`;

const CHALLENGES = [
  { prompt: "First to name 5 songs by the same artist", category: "Music" },
  { prompt: "First to spell 'supercalifragilisticexpialidocious' correctly", category: "Words" },
  { prompt: "First to count backwards from 20 to 0 without mistakes", category: "Numbers" },
  { prompt: "First to name 3 countries that start with the letter 'C'", category: "Geography" },
  { prompt: "First to recite the months of the year in reverse order", category: "General" },
  { prompt: "First to name 5 animals that live in the Arctic", category: "Animals" },
  { prompt: "First to name 4 Marvel superhero movies from Phase 1", category: "Movies" },
  { prompt: "First to name 3 things in your bag or pocket", category: "Quick" },
  { prompt: "First to name 4 songs with a colour in the title", category: "Music" },
  { prompt: "First to name 3 movies set in space", category: "Movies" },
  { prompt: "First to name 5 countries in Europe starting with a consonant", category: "Geography" },
  { prompt: "First to name 4 sports played on ice", category: "Sports" },
  { prompt: "First to name 3 animals that have stripes", category: "Animals" },
  { category: "Words", prompt: "First to say the alphabet backwards from Z to M without pausing" },
  { prompt: "First to name 4 superheroes who can fly without a suit or vehicle", category: "Movies" },
  { prompt: "First to name 3 US states that start with the letter 'M'", category: "Geography" },
  { prompt: "First to name 5 words that rhyme with 'time'", category: "Words" },
  { prompt: "First to name 4 artists who have had a number 1 hit in three different decades", category: "Music" },
  { prompt: "First to name 3 animals that are also verb phrases (e.g. crane, duck)", category: "Words" },
  { prompt: "First to name 4 currencies used in Asia", category: "Geography" },
  { prompt: "First to name 3 sports where the highest score LOSES", category: "Sports" },
  { prompt: "First to name 5 two-digit prime numbers", category: "Numbers" },
  { prompt: "First to name 4 Pixar movies that do NOT feature a human as the main character", category: "Movies" },
  { prompt: "First to name 3 musical instruments made of brass", category: "Music" },
  { prompt: "First to count from 1 to 20 using only even numbers", category: "Numbers" },
  { prompt: "First to name 4 animals native to Australia", category: "Animals" },
  { prompt: "First to name 3 capital cities that contain a double letter (e.g. Tallinn)", category: "Geography" },
  { prompt: "First to name 4 movies that have a sequel with a number in the title", category: "Movies" },
  { prompt: "First to name 4 things you find on a chessboard besides pawns", category: "General Knowledge" },
  { prompt: "First to name 5 words that are their own plural (e.g. sheep, deer)", category: "Words" },
  { prompt: "First to name 3 sports in which athletes compete barefoot", category: "Sports" },
  { prompt: "First to name 4 pop stars known by a single name only (like Madonna)", category: "Music" },
  { prompt: "First to name 3 famous paintings by Vincent van Gogh", category: "General Knowledge" },
  { prompt: "First to name the 5 largest planets in the solar system in order", category: "Numbers" },
  { prompt: "First to name 4 dances that have a specific country of origin", category: "General Knowledge" },
  { prompt: "First to name 3 TV shows that ran for more than 10 seasons", category: "Movies" },
  { prompt: "First to name 4 words that are spelled the same forwards and backwards (palindromes)", category: "Words" },
  { prompt: "First to name 3 animals that change colour", category: "Animals" },
  { prompt: "First to name 4 chemical elements that are also human names (e.g. Francium)", category: "General Knowledge" },
];

interface ThumbWarState {
  phase: "waiting" | "challenge" | "duel" | "finished";
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
  currentChallenge: { prompt: string; category: string } | null;
  playerA: string | null;
  playerB: string | null;
  ready: Record<string, boolean>;
  winner: string | null;
  guestQueue: string[];
  queue: number[];
}

export class ThumbWarExperience implements ExperienceModule {
  readonly type = "thumb_war" as const;

  async onActivate(roomId: string): Promise<void> {
    const state: ThumbWarState = {
      phase: "waiting", round: 0, totalRounds: CHALLENGES.length,
      scores: {}, currentChallenge: null, playerA: null, playerB: null,
      ready: {}, winner: null, guestQueue: [], queue: shuffledIndices(CHALLENGES.length),
    };
    await redisClient.set(KEY(roomId), JSON.stringify(state));
  }

  async onDeactivate(roomId: string): Promise<void> {
    await redisClient.del(KEY(roomId));
  }

  async handleAction({ action, payload, roomId, guestId, role, io }: {
    action: string; payload: unknown; roomId: string; guestId: string;
    role: "HOST" | "CO_HOST" | "GUEST"; io: Server;
  }): Promise<void> {
    const raw = await redisClient.get(KEY(roomId));
    if (!raw) return;
    const state: ThumbWarState = JSON.parse(raw);

    switch (action) {
      case "start": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        const guestIds = (payload as any).guestIds as string[] ?? [];
        state.guestQueue = [...guestIds].sort(() => Math.random() - 0.5);
        state.round = 1;
        state.playerA = state.guestQueue[0] ?? null;
        state.playerB = state.guestQueue[1] ?? null;
        state.queue = shuffledIndices(CHALLENGES.length);
        state.currentChallenge = CHALLENGES[state.queue[0]];
        state.ready = {};
        state.winner = null;
        state.phase = "challenge";
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "thumb_war", state,
          view: { type: "thumb_war" as any, data: state }, sequenceId: seq,
        });
        break;
      }
      case "ready": {
        if (guestId !== state.playerA && guestId !== state.playerB && role !== "HOST" && role !== "CO_HOST") return;
        state.ready[guestId] = true;
        if (state.ready[state.playerA ?? ""] && state.ready[state.playerB ?? ""]) {
          state.phase = "duel";
        }
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "thumb_war", state,
          view: { type: "thumb_war" as any, data: state }, sequenceId: seq,
        });
        break;
      }
      case "winner": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        const winnerId: string = (payload as any).winnerId as string;
        state.winner = winnerId;
        state.scores[winnerId] = (state.scores[winnerId] ?? 0) + 300;
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "thumb_war", state,
          view: { type: "thumb_war" as any, data: state }, sequenceId: seq,
        });
        break;
      }
      case "next": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        state.round += 1;
        if (state.round > state.totalRounds) {
          state.phase = "finished";
          await redisClient.set(KEY(roomId), JSON.stringify(state));
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "thumb_war", state,
            view: { type: "leaderboard", data: state.scores }, sequenceId: seq,
          });
        } else {
          const idx = (state.round - 1) * 2;
          state.playerA = state.guestQueue[idx % state.guestQueue.length];
          state.playerB = state.guestQueue[(idx + 1) % state.guestQueue.length];
          state.currentChallenge = CHALLENGES[state.queue[(state.round - 1) % state.queue.length]];
          state.ready = {};
          state.winner = null;
          state.phase = "challenge";
          await redisClient.set(KEY(roomId), JSON.stringify(state));
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "thumb_war", state,
            view: { type: "thumb_war" as any, data: state }, sequenceId: seq,
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
          experienceType: "dj", view: { type: "dj_queue" }, sequenceId: seq,
        });
        break;
      }
    }
  }

  async getGuestViewDescriptor(roomId: string): Promise<GuestViewDescriptor> {
    const raw = await redisClient.get(KEY(roomId));
    if (!raw) return { type: "intermission" };
    const state: ThumbWarState = JSON.parse(raw);
    if (state.phase === "finished") return { type: "leaderboard", data: state.scores };
    return { type: "thumb_war" as any, data: state };
  }
}
