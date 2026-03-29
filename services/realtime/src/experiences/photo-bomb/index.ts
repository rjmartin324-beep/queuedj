import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";

interface PhotoBombState {
  phase: "waiting" | "question" | "finished";
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
  currentPuzzle: { emojis: string[]; oddIndex: number } | null;
  answers: Record<string, number>;
  questionStartedAt: number;
}

function makePuzzle(base: string, odd: string): { emojis: string[]; oddIndex: number } {
  const oddIndex = Math.floor(Math.random() * 12);
  const emojis = Array(12).fill(base);
  emojis[oddIndex] = odd;
  return { emojis, oddIndex };
}

const PUZZLES = [
  makePuzzle("🍎", "🍊"), makePuzzle("🐶", "🐱"), makePuzzle("⚽", "🏀"),
  makePuzzle("🌟", "⭐"), makePuzzle("🎵", "🎶"), makePuzzle("🔴", "🟠"),
  makePuzzle("🌍", "🌎"), makePuzzle("🎭", "🎪"),
];

const KEY = (roomId: string) => `experience:photo_bomb:${roomId}`;

export class PhotoBombExperience implements ExperienceModule {
  readonly type = "photo_bomb" as const;

  async onActivate(roomId: string): Promise<void> {
    const state: PhotoBombState = {
      phase: "waiting", round: 0, totalRounds: PUZZLES.length,
      scores: {}, currentPuzzle: null, answers: {}, questionStartedAt: 0,
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
    const state: PhotoBombState = JSON.parse(raw);

    switch (action) {
      case "start": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        state.round = 1;
        state.currentPuzzle = PUZZLES[0];
        state.answers = {};
        state.phase = "question";
        state.questionStartedAt = Date.now();
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "photo_bomb", state,
          view: { type: "photo_bomb" as any, data: state }, sequenceId: seq,
        });
        break;
      }
      case "tap": {
        if (state.phase !== "question" || state.answers[guestId] !== undefined) return;
        const idx = (payload as any).index as number;
        state.answers[guestId] = idx;
        const correct = idx === state.currentPuzzle?.oddIndex;
        if (correct) {
          const elapsed = Date.now() - state.questionStartedAt;
          const timeBonus = Math.max(0, Math.round((10000 - elapsed) / 100));
          state.scores[guestId] = (state.scores[guestId] ?? 0) + 100 + timeBonus;
        }
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "photo_bomb", state,
          view: { type: "photo_bomb" as any, data: state }, sequenceId: seq,
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
            experienceType: "photo_bomb", state,
            view: { type: "leaderboard", data: state.scores }, sequenceId: seq,
          });
        } else {
          state.currentPuzzle = PUZZLES[(state.round - 1) % PUZZLES.length];
          state.answers = {};
          state.phase = "question";
          state.questionStartedAt = Date.now();
          await redisClient.set(KEY(roomId), JSON.stringify(state));
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "photo_bomb", state,
            view: { type: "photo_bomb" as any, data: state }, sequenceId: seq,
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
    const state: PhotoBombState = JSON.parse(raw);
    if (state.phase === "finished") return { type: "leaderboard", data: state.scores };
    return { type: "photo_bomb" as any, data: state };
  }

  async getBootstrapState(roomId: string): Promise<unknown> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }
}