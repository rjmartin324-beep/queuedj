import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";
import { shuffledIndices } from "../../lib/shuffle";

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
  // ── added to reach 30 ────────────────────────────────────────────────────────
  { q: "Which band sang 'Don't Stop Believin''?", a: "Journey" },
  { q: "What year did Michael Jackson release 'Thriller'?", a: "1982" },
  { q: "Name the lead singer of Coldplay", a: "Chris Martin" },
  { q: "Which singer is known as the Queen of Pop?", a: "Madonna" },
  { q: "What nationality is the band ABBA?", a: "Swedish" },
  { q: "How many members are in BTS?", a: "7" },
  { q: "Which Dua Lipa album features 'Levitating'?", a: "Future Nostalgia" },
  { q: "Name the song that starts with 'Is this the real life, is this just fantasy?'", a: "Bohemian Rhapsody" },
  { q: "Which rapper's real name is Aubrey Graham?", a: "Drake" },
  { q: "What decade did hip-hop originate?", a: "1970s" },
  { q: "Name a song from Adele's album '21'", a: "Any valid answer" },
  { q: "What country did reggae music originate in?", a: "Jamaica" },
  { q: "Which award is the highest honour in the music industry?", a: "Grammy" },
  { q: "Which pop star is known as 'Mother Monster'?", a: "Lady Gaga" },
  { q: "Name the band behind 'Yellow' and 'The Scientist'", a: "Coldplay" },
  { q: "Which instrument did Jimi Hendrix play?", a: "Guitar" },
  { q: "Which city is known as the birthplace of jazz?", a: "New Orleans" },
  { q: "What does EDM stand for?", a: "Electronic Dance Music" },
  { q: "Who sang 'Shape of You'?", a: "Ed Sheeran" },
  { q: "Which rapper features on most Eminem albums?", a: "Any valid answer" },
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
  queue: number[];
}

export class MusicalChairsExperience implements ExperienceModule {
  readonly type = "musical_chairs" as const;

  async onActivate(roomId: string): Promise<void> {
    const state: MusicalChairsState = {
      phase: "waiting", round: 0, totalRounds: 0,
      scores: {}, activePlayers: [], eliminatedPlayers: [],
      currentQ: null, answers: {}, loser: null, queue: shuffledIndices(TRIVIA_QS.length),
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
        state.queue = shuffledIndices(TRIVIA_QS.length);
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
        const qIdx = state.queue[(state.round - 1) % state.queue.length];
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

  async getBootstrapState(roomId: string): Promise<unknown> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }
}