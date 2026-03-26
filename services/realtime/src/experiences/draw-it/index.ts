import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";

const KEY = (roomId: string) => `experience:draw_it:${roomId}`;

const PROMPTS = [
  "pizza", "spaceship", "dinosaur", "rainbow", "castle",
  "mermaid", "volcano", "robot", "sunflower", "tornado",
  "penguin", "submarine", "cactus", "lighthouse", "dragon",
  // ── Added words to reach 100 total ─────────────────────────────────────────
  // Easy
  "banana", "house", "car", "tree", "cat", "dog", "fish", "bird", "hat", "chair",
  "apple", "moon", "star", "sun", "rain", "cloud", "book", "cup", "shoe", "door",
  "phone", "key", "ball", "heart", "fire", "ice", "boat", "train", "plane", "bus",
  "snake", "horse", "frog", "bear", "fox",
  // Medium
  "escalator", "telescope", "hammock", "accordion", "compass", "parachute",
  "microscope", "typewriter", "umbrella", "windmill", "aquarium", "binoculars",
  "chandelier", "trampoline", "fireworks", "glacier", "periscope", "igloo",
  "jellyfish", "kangaroo", "labyrinth", "magnet", "narwhal", "origami", "pinball",
  "quicksand", "radiator", "stalactite", "toaster", "unicycle",
  // Hard
  "democracy", "nostalgia", "WiFi", "procrastination", "infinity", "gravity",
  "jealousy", "freedom", "ambition", "silence", "destiny", "chaos", "logic",
  "sarcasm", "paradox", "momentum", "epidemic", "revolution", "bandwidth", "irony",
];

interface DrawItState {
  phase: "waiting" | "drawing" | "reveal" | "finished";
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
  currentDrawer: string | null;
  currentPrompt: string | null;
  guesses: Record<string, string>;
  correctGuessers: string[];
  drawerQueue: string[];
  usedPrompts: string[];
}

export class DrawItExperience implements ExperienceModule {
  readonly type = "draw_it" as const;

  async onActivate(roomId: string): Promise<void> {
    const state: DrawItState = {
      phase: "waiting", round: 0, totalRounds: 5,
      scores: {}, currentDrawer: null, currentPrompt: null,
      guesses: {}, correctGuessers: [], drawerQueue: [], usedPrompts: [],
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
    const state: DrawItState = JSON.parse(raw);

    switch (action) {
      case "start": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        const guestIds = (payload as any).guestIds as string[] ?? [];
        state.drawerQueue = [...guestIds].sort(() => Math.random() - 0.5);
        state.round = 1;
        state.totalRounds = Math.min(state.drawerQueue.length, 5);
        state.currentDrawer = state.drawerQueue[0] ?? null;
        const promptIdx = Math.floor(Math.random() * PROMPTS.length);
        state.currentPrompt = PROMPTS[promptIdx];
        state.usedPrompts = [state.currentPrompt];
        state.guesses = {};
        state.correctGuessers = [];
        state.phase = "drawing";
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        // Send state without the prompt to non-drawers (handled client-side based on guestId)
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "draw_it", state,
          view: { type: "draw_it" as any, data: state }, sequenceId: seq,
        });
        break;
      }
      case "guess": {
        if (state.phase !== "drawing") return;
        if (guestId === state.currentDrawer) return;
        if (state.correctGuessers.includes(guestId)) return;
        const guess: string = ((payload as any).text as string ?? "").toLowerCase().trim();
        state.guesses[guestId] = guess;
        const correct = guess === (state.currentPrompt ?? "").toLowerCase();
        if (correct) {
          state.correctGuessers.push(guestId);
          const pts = Math.max(50, 300 - state.correctGuessers.length * 50);
          state.scores[guestId] = (state.scores[guestId] ?? 0) + pts;
        }
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "draw_it", state,
          view: { type: "draw_it" as any, data: state }, sequenceId: seq,
        });
        break;
      }
      case "reveal": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        if (state.currentDrawer && state.correctGuessers.length > 0) {
          state.scores[state.currentDrawer] = (state.scores[state.currentDrawer] ?? 0) + 200;
        }
        state.phase = "reveal";
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "draw_it", state,
          view: { type: "draw_it" as any, data: state }, sequenceId: seq,
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
            experienceType: "draw_it", state,
            view: { type: "leaderboard", data: state.scores }, sequenceId: seq,
          });
        } else {
          state.currentDrawer = state.drawerQueue[(state.round - 1) % state.drawerQueue.length];
          const available = PROMPTS.filter(p => !state.usedPrompts.includes(p));
          const pool = available.length > 0 ? available : PROMPTS;
          const p = pool[Math.floor(Math.random() * pool.length)];
          state.currentPrompt = p;
          state.usedPrompts.push(p);
          state.guesses = {};
          state.correctGuessers = [];
          state.phase = "drawing";
          await redisClient.set(KEY(roomId), JSON.stringify(state));
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "draw_it", state,
            view: { type: "draw_it" as any, data: state }, sequenceId: seq,
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
    const state: DrawItState = JSON.parse(raw);
    if (state.phase === "finished") return { type: "leaderboard", data: state.scores };
    return { type: "draw_it" as any, data: state };
  }
}
