import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";
import { shuffledIndices } from "../../lib/shuffle";

interface LyricsDropState {
  phase: "waiting" | "question" | "reveal" | "finished";
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
  currentLyric: { text: string; blank: string; answer: string; hint: string } | null;
  guesses: Record<string, string>;
  questionStartedAt: number;
  queue: number[];
}

const LYRICS = [
  { text: "Is this the real life? Is this just ___?", blank: "___", answer: "fantasy", hint: "Bohemian Rhapsody — Queen" },
  { text: "I kissed a girl and I liked ___, the taste of her cherry chapstick", blank: "___", answer: "it", hint: "I Kissed a Girl — Katy Perry" },
  { text: "Rolling in the ___, your sins and your lies were always on my mind", blank: "___", answer: "deep", hint: "Rolling in the Deep — Adele" },
  { text: "We will, we will ___ you", blank: "___", answer: "rock", hint: "We Will Rock You — Queen" },
  { text: "I got 99 problems but a ___ ain't one", blank: "___", answer: "bitch", hint: "99 Problems — Jay-Z" },
  { text: "Shake it ___, shake it off", blank: "___", answer: "off", hint: "Shake It Off — Taylor Swift" },
  { text: "I will always love ___", blank: "___", answer: "you", hint: "I Will Always Love You — Whitney Houston" },
  { text: "Don't stop ___, hold on to the feeling", blank: "___", answer: "believin'", hint: "Don't Stop Believin' — Journey" },
];

const KEY = (roomId: string) => `experience:lyrics_drop:${roomId}`;

export class LyricsDropExperience implements ExperienceModule {
  readonly type = "lyrics_drop" as const;

  async onActivate(roomId: string): Promise<void> {
    const state: LyricsDropState = {
      phase: "waiting", round: 0, totalRounds: LYRICS.length,
      scores: {}, currentLyric: null, guesses: {}, questionStartedAt: 0,
      queue: shuffledIndices(LYRICS.length),
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
    const state: LyricsDropState = JSON.parse(raw);

    switch (action) {
      case "start": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        state.round = 1;
        state.queue = shuffledIndices(LYRICS.length);
        state.currentLyric = LYRICS[state.queue[0]];
        state.guesses = {};
        state.phase = "question";
        state.questionStartedAt = Date.now();
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "lyrics_drop", state,
          view: { type: "lyrics_drop" as any, data: state }, sequenceId: seq,
        });
        break;
      }
      case "guess": {
        if (state.phase !== "question") return;
        const word = ((payload as any).word as string ?? "").trim().toLowerCase();
        state.guesses[guestId] = word;
        const correct = state.currentLyric?.answer.toLowerCase() ?? "";
        if (word === correct) {
          const elapsed = Date.now() - state.questionStartedAt;
          const timeBonus = Math.max(0, Math.round((15000 - elapsed) / 150));
          state.scores[guestId] = (state.scores[guestId] ?? 0) + 100 + timeBonus;
        }
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "lyrics_drop", state,
          view: { type: "lyrics_drop" as any, data: state }, sequenceId: seq,
        });
        break;
      }
      case "reveal": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        state.phase = "reveal";
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "lyrics_drop", state,
          view: { type: "lyrics_drop" as any, data: state }, sequenceId: seq,
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
            experienceType: "lyrics_drop", state,
            view: { type: "leaderboard", data: state.scores }, sequenceId: seq,
          });
        } else {
          state.currentLyric = LYRICS[state.queue[(state.round - 1) % state.queue.length]];
          state.guesses = {};
          state.phase = "question";
          state.questionStartedAt = Date.now();
          await redisClient.set(KEY(roomId), JSON.stringify(state));
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "lyrics_drop", state,
            view: { type: "lyrics_drop" as any, data: state }, sequenceId: seq,
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
    const state: LyricsDropState = JSON.parse(raw);
    if (state.phase === "finished") return { type: "leaderboard", data: state.scores };
    return { type: "lyrics_drop" as any, data: state };
  }
}
