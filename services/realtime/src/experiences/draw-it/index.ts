import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";
import { awardGameWin } from "../../lib/credits";

const KEY = (roomId: string) => `experience:draw_it:${roomId}`;

const PROMPTS = [
  "pizza", "spaceship", "dinosaur", "rainbow", "castle",
  "mermaid", "volcano", "robot", "sunflower", "tornado",
  "penguin", "submarine", "cactus", "lighthouse", "dragon",
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

const DRAWING_TIME_MS = 60_000; // 60s per round

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
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  async onActivate(roomId: string): Promise<void> {
    const existing = await redisClient.get(KEY(roomId));
    if (existing) {
      const s: DrawItState = JSON.parse(existing);
      if (s.phase !== "waiting" && s.phase !== "finished") return;
    }
    const state: DrawItState = {
      phase: "waiting", round: 0, totalRounds: 5,
      scores: {}, currentDrawer: null, currentPrompt: null,
      guesses: {}, correctGuessers: [], drawerQueue: [], usedPrompts: [],
    };
    await redisClient.set(KEY(roomId), JSON.stringify(state));
  }

  async onDeactivate(roomId: string): Promise<void> {
    const timer = this.timers.get(roomId);
    if (timer) { clearTimeout(timer); this.timers.delete(roomId); }
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
        state.scores = {};
        state.phase = "drawing";
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "draw_it", state,
          view: { type: "draw_it" as any, data: state }, sequenceId: seq,
        });
        // Auto-reveal after drawing time
        this._armDrawingTimer(roomId, io);
        break;
      }

      case "resume": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._resumeIfStuck(roomId, io);
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
        await this._reveal(roomId, io, state);
        break;
      }

      case "next": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._next(roomId, io);
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

  private _armDrawingTimer(roomId: string, io: Server): void {
    const existing = this.timers.get(roomId);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      this.timers.delete(roomId);
      redisClient.get(KEY(roomId)).then((raw) => {
        if (!raw) return;
        const st: DrawItState = JSON.parse(raw);
        if (st.phase === "drawing") {
          this._reveal(roomId, io, st).catch(() => {});
        }
      }).catch(() => {});
    }, DRAWING_TIME_MS);
    this.timers.set(roomId, t);
  }

  private async _reveal(roomId: string, io: Server, state: DrawItState): Promise<void> {
    const existing = this.timers.get(roomId);
    if (existing) { clearTimeout(existing); this.timers.delete(roomId); }

    if (state.phase !== "drawing") return;
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

    // Show leaderboard after 5s, then auto-next after 3s more
    const t = setTimeout(async () => {
      try {
        const raw2 = await redisClient.get(KEY(roomId));
        const st: DrawItState | null = raw2 ? JSON.parse(raw2) : null;
        if (st?.phase === "reveal") {
          const seqLb = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "draw_it",
            state: st,
            view: { type: "leaderboard", data: st.scores },
            sequenceId: seqLb,
          });
        }
      } catch {}
      const t2 = setTimeout(() => {
        this.timers.delete(roomId);
        this._next(roomId, io).catch(() => {});
      }, 3000);
      this.timers.set(roomId, t2);
    }, 5000);
    this.timers.set(roomId, t);
  }

  private async _next(roomId: string, io: Server): Promise<void> {
    const raw = await redisClient.get(KEY(roomId));
    if (!raw) return;
    const state: DrawItState = JSON.parse(raw);
    if (state.phase !== "reveal") return;

    state.round += 1;
    if (state.round > state.totalRounds) {
      state.phase = "finished";
      await redisClient.set(KEY(roomId), JSON.stringify(state));
      const seq = await getNextSequenceId(roomId);
      io.to(roomId).emit("experience:state" as any, {
        experienceType: "draw_it", state,
        view: { type: "leaderboard", data: state.scores }, sequenceId: seq,
      });
      await awardGameWin(io, state.scores, roomId).catch(() => {});
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
      this._armDrawingTimer(roomId, io);
    }
  }

  private async _resumeIfStuck(roomId: string, io: Server): Promise<void> {
    const raw = await redisClient.get(KEY(roomId));
    if (!raw) return;
    const state: DrawItState = JSON.parse(raw);
    if (this.timers.has(roomId)) return;

    if (state.phase === "drawing") {
      // Re-arm with a 20s grace window
      const t = setTimeout(() => {
        this.timers.delete(roomId);
        redisClient.get(KEY(roomId)).then((r) => {
          if (!r) return;
          const st: DrawItState = JSON.parse(r);
          if (st.phase === "drawing") this._reveal(roomId, io, st).catch(() => {});
        }).catch(() => {});
      }, 20_000);
      this.timers.set(roomId, t);
      // Re-broadcast current state
      const seq = await getNextSequenceId(roomId);
      io.to(roomId).emit("experience:state" as any, {
        experienceType: "draw_it", state,
        view: { type: "draw_it" as any, data: state }, sequenceId: seq,
      });
    } else if (state.phase === "reveal") {
      console.log("[draw_it] resuming from reveal phase for", roomId);
      // Re-arm auto-next with a 3s grace
      const t = setTimeout(() => {
        this.timers.delete(roomId);
        this._next(roomId, io).catch(() => {});
      }, 3_000);
      this.timers.set(roomId, t);
    }
  }

  async getGuestViewDescriptor(roomId: string): Promise<GuestViewDescriptor> {
    const raw = await redisClient.get(KEY(roomId));
    if (!raw) return { type: "intermission" };
    const state: DrawItState = JSON.parse(raw);
    if (state.phase === "finished") return { type: "leaderboard", data: state.scores };
    return { type: "draw_it" as any, data: state };
  }

  async getBootstrapState(roomId: string): Promise<unknown> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }
}
