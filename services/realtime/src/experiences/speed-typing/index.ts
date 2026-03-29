import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";

interface SpeedTypingState {
  phase: "waiting" | "typing" | "round_end" | "finished";
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
  currentPhrase: string | null;
  finishes: Record<string, { time: number; accuracy: number }>;
  startedAt: number;
}

const PHRASES = [
  "The quick brown fox jumps over the lazy dog",
  "Pack my box with five dozen liquor jugs",
  "How vexingly quick daft zebras jump! The five boxing wizards jump quickly.",
];

const KEY = (roomId: string) => `experience:speed_typing:${roomId}`;

export class SpeedTypingExperience implements ExperienceModule {
  readonly type = "speed_typing" as const;

  async onActivate(roomId: string): Promise<void> {
    const state: SpeedTypingState = {
      phase: "waiting", round: 0, totalRounds: PHRASES.length,
      scores: {}, currentPhrase: null, finishes: {}, startedAt: 0,
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
    const state: SpeedTypingState = JSON.parse(raw);

    switch (action) {
      case "start": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        state.round = 1;
        state.currentPhrase = PHRASES[0];
        state.finishes = {};
        state.phase = "typing";
        state.startedAt = Date.now();
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "speed_typing", state,
          view: { type: "speed_typing" as any, data: state }, sequenceId: seq,
        });
        break;
      }
      case "finish": {
        if (state.phase !== "typing" || state.finishes[guestId]) return;
        const accuracy = Math.max(0, Math.min(100, (payload as any).accuracy as number ?? 0));
        const elapsed = Date.now() - state.startedAt;
        state.finishes[guestId] = { time: elapsed, accuracy };
        const wpm = Math.round(((state.currentPhrase?.split(" ").length ?? 5) / (elapsed / 60000)));
        const pts = Math.round(wpm * (accuracy / 100) * 10);
        state.scores[guestId] = (state.scores[guestId] ?? 0) + pts;
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "speed_typing", state,
          view: { type: "speed_typing" as any, data: state }, sequenceId: seq,
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
            experienceType: "speed_typing", state,
            view: { type: "leaderboard", data: state.scores }, sequenceId: seq,
          });
        } else {
          state.currentPhrase = PHRASES[(state.round - 1) % PHRASES.length];
          state.finishes = {};
          state.phase = "typing";
          state.startedAt = Date.now();
          await redisClient.set(KEY(roomId), JSON.stringify(state));
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "speed_typing", state,
            view: { type: "speed_typing" as any, data: state }, sequenceId: seq,
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
    const state: SpeedTypingState = JSON.parse(raw);
    if (state.phase === "finished") return { type: "leaderboard", data: state.scores };
    return { type: "speed_typing" as any, data: state };
  }

  async getBootstrapState(roomId: string): Promise<unknown> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }
}