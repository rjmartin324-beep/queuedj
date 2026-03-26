import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";

const KEY = (roomId: string) => `experience:musical_chairs:${roomId}`;

const TRIVIA_QS = [
  { q: "Which artist released 'Anti Hero'?", a: "Taylor Swift" },
  { q: "What does BPM stand for in music?", a: "Beats Per Minute" },
  { q: "Which band performed 'Bohemian Rhapsody'?", a: "Queen" },
  { q: "What instrument has 88 keys?", a: "Piano" },
  { q: "Which DJ popularized the 'drop'?", a: "Deadmau5" },
  { q: "Name a song by Kendrick Lamar", a: "Any valid answer" },
  { q: "What music app has a Discover Weekly playlist?", a: "Spotify" },
  { q: "How many strings does a standard guitar have?", a: "6" },
];

interface MusicalChairsState {
  phase: "waiting" | "music" | "freeze" | "elimination" | "finished";
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
  activePlayers: string[];
  eliminatedPlayers: string[];
  currentQ: { q: string; a: string } | null;
  answers: Record<string, string>;
  loser: string | null;
}

export class MusicalChairsExperience implements ExperienceModule {
  readonly type = "musical_chairs" as const;

  async onActivate(roomId: string): Promise<void> {
    const state: MusicalChairsState = {
      phase: "waiting", round: 0, totalRounds: 0,
      scores: {}, activePlayers: [], eliminatedPlayers: [],
      currentQ: null, answers: {}, loser: null,
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
    const state: MusicalChairsState = JSON.parse(raw);

    switch (action) {
      case "start": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        const guestIds = (payload as any).guestIds as string[] ?? [];
        state.activePlayers = [...guestIds];
        state.totalRounds = Math.max(1, guestIds.length - 1);
        state.round = 1;
        state.phase = "music";
        state.answers = {};
        state.loser = null;
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "musical_chairs", state,
          view: { type: "musical_chairs" as any, data: state }, sequenceId: seq,
        });
        break;
      }
      case "freeze": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        const qIdx = (state.round - 1) % TRIVIA_QS.length;
        state.currentQ = TRIVIA_QS[qIdx];
        state.answers = {};
        state.loser = null;
        state.phase = "freeze";
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "musical_chairs", state,
          view: { type: "musical_chairs" as any, data: state }, sequenceId: seq,
        });
        break;
      }
      case "answer": {
        if (state.phase !== "freeze") return;
        if (!state.activePlayers.includes(guestId)) return;
        if (state.answers[guestId]) return;
        state.answers[guestId] = (payload as any).text as string ?? "";
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "musical_chairs", state,
          view: { type: "musical_chairs" as any, data: state }, sequenceId: seq,
        });
        break;
      }
      case "eliminate": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        const loserId: string = (payload as any).loserId as string;
        state.loser = loserId;
        state.activePlayers = state.activePlayers.filter(p => p !== loserId);
        state.eliminatedPlayers.push(loserId);
        state.phase = "elimination";
        // Award points to all remaining active players
        state.activePlayers.forEach(p => {
          state.scores[p] = (state.scores[p] ?? 0) + 100;
        });
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "musical_chairs", state,
          view: { type: "musical_chairs" as any, data: state }, sequenceId: seq,
        });
        break;
      }
      case "next": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        state.round += 1;
        if (state.activePlayers.length <= 1 || state.round > state.totalRounds) {
          state.phase = "finished";
          if (state.activePlayers[0]) {
            state.scores[state.activePlayers[0]] = (state.scores[state.activePlayers[0]] ?? 0) + 500;
          }
          await redisClient.set(KEY(roomId), JSON.stringify(state));
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "musical_chairs", state,
            view: { type: "leaderboard", data: state.scores }, sequenceId: seq,
          });
        } else {
          state.phase = "music";
          state.answers = {};
          state.loser = null;
          state.currentQ = null;
          await redisClient.set(KEY(roomId), JSON.stringify(state));
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "musical_chairs", state,
            view: { type: "musical_chairs" as any, data: state }, sequenceId: seq,
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
    const state: MusicalChairsState = JSON.parse(raw);
    if (state.phase === "finished") return { type: "leaderboard", data: state.scores };
    return { type: "musical_chairs" as any, data: state };
  }
}
