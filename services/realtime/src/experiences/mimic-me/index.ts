import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";

interface MimicMeState {
  phase: "waiting" | "studying" | "performing" | "rating" | "finished";
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
  currentPerformer: string | null;
  action: { emoji: string; instruction: string } | null;
  ratings: Record<string, number>;
  performerOrder: string[];
}

const ACTIONS = [
  { emoji: "🤸", instruction: "Do a jumping jack in slow motion" },
  { emoji: "🦁", instruction: "Roar like a lion for 3 seconds" },
  { emoji: "🤖", instruction: "Walk like a robot for 5 steps" },
  { emoji: "🧘", instruction: "Hold a yoga pose for 5 seconds" },
  { emoji: "🕺", instruction: "Do your best disco move" },
  { emoji: "🐧", instruction: "Waddle like a penguin in a circle" },
  { emoji: "🎤", instruction: "Mime singing into a microphone dramatically" },
  { emoji: "🥊", instruction: "Shadow box for 5 seconds" },
  { emoji: "🦋", instruction: "Flutter around like a butterfly" },
  { emoji: "🏄", instruction: "Surf an imaginary wave" },
];

const KEY = (roomId: string) => `experience:mimic_me:${roomId}`;

export class MimicMeExperience implements ExperienceModule {
  readonly type = "mimic_me" as const;

  async onActivate(roomId: string): Promise<void> {
    const state: MimicMeState = {
      phase: "waiting", round: 0, totalRounds: 6,
      scores: {}, currentPerformer: null, action: null, ratings: {}, performerOrder: [],
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
    const state: MimicMeState = JSON.parse(raw);

    switch (action) {
      case "start": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        const guestIds = (payload as any).guestIds as string[] ?? [];
        state.performerOrder = [...guestIds];
        state.round = 1;
        state.totalRounds = Math.min(guestIds.length * 2, 6);
        state.currentPerformer = guestIds[0] ?? null;
        state.action = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
        state.ratings = {};
        state.phase = "studying";
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "mimic_me", state,
          view: { type: "mimic_me" as any, data: state }, sequenceId: seq,
        });
        break;
      }
      case "start_perform": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        state.phase = "performing";
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "mimic_me", state,
          view: { type: "mimic_me" as any, data: state }, sequenceId: seq,
        });
        break;
      }
      case "rate": {
        if (state.phase !== "performing" && state.phase !== "rating") return;
        if (guestId === state.currentPerformer) return;
        state.ratings[guestId] = (payload as any).rating as number ?? 0;
        state.phase = "rating";
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "mimic_me", state,
          view: { type: "mimic_me" as any, data: state }, sequenceId: seq,
        });
        break;
      }
      case "next": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        const ratingVals = Object.values(state.ratings);
        const avg = ratingVals.length > 0
          ? ratingVals.reduce((a, b) => a + b, 0) / ratingVals.length : 0;
        if (state.currentPerformer) {
          state.scores[state.currentPerformer] = (state.scores[state.currentPerformer] ?? 0) + Math.round(avg);
        }
        state.round += 1;
        if (state.round > state.totalRounds) {
          state.phase = "finished";
          await redisClient.set(KEY(roomId), JSON.stringify(state));
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "mimic_me", state,
            view: { type: "leaderboard", data: state.scores }, sequenceId: seq,
          });
        } else {
          const nextIdx = (state.round - 1) % state.performerOrder.length;
          state.currentPerformer = state.performerOrder[nextIdx];
          state.action = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
          state.ratings = {};
          state.phase = "studying";
          await redisClient.set(KEY(roomId), JSON.stringify(state));
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "mimic_me", state,
            view: { type: "mimic_me" as any, data: state }, sequenceId: seq,
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
    const state: MimicMeState = JSON.parse(raw);
    if (state.phase === "finished") return { type: "leaderboard", data: state.scores };
    return { type: "mimic_me" as any, data: state };
  }
}
