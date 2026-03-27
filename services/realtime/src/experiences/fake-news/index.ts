import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";
import { shuffledIndices } from "../../lib/shuffle";

// ─────────────────────────────────────────────────────────────────────────────
// Fake News Experience
//
// A news headline is displayed. Players vote whether it is real or fake.
// Streaks multiply points. Host reveals answer and advances rounds.
//
// Actions:
//   HOST/CO_HOST: start, reveal, next, end_game, end
//   GUEST:        vote
// ─────────────────────────────────────────────────────────────────────────────

const KEY = (roomId: string) => `experience:fake_news:${roomId}`;

// ─── Content ─────────────────────────────────────────────────────────────────

interface Headline {
  text: string;
  isReal: boolean;
}

const HEADLINES: Headline[] = [
  { text: "Scientists discover a new species of deep-sea fish that glows in three colors.", isReal: true },
  { text: "A town in Norway experiences 69 days of continuous sunlight each summer.", isReal: true },
  { text: "The inventor of the frisbee was turned into a frisbee after he died.", isReal: true },
  { text: "A group of flamingos is called a flamboyance.", isReal: true },
  { text: "Oxford University is older than the Aztec Empire.", isReal: true },
  { text: "Scientists confirmed that lightning never strikes the same place twice.", isReal: false },
  { text: "A man in Japan was legally declared a bear after living in the woods for 11 years.", isReal: false },
  { text: "NASA accidentally deleted the original moon landing footage while recording a football game.", isReal: false },
  { text: "Scientists in Germany created a song so catchy it caused traffic accidents.", isReal: false },
  { text: "A California man successfully sued a casino after they used his lucky pen without permission.", isReal: false },
];

// ─── State ────────────────────────────────────────────────────────────────────

interface FakeNewsState {
  phase: "waiting" | "question" | "reveal" | "finished";
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
  currentHeadline: Headline | null;
  votes: Record<string, "real" | "fake">;
  streaks: Record<string, number>;
  queue: number[];
}

export class FakeNewsExperience implements ExperienceModule {
  readonly type = "fake_news" as const;

  async onActivate(roomId: string): Promise<void> {
    const state: FakeNewsState = {
      phase: "waiting",
      round: 0,
      totalRounds: 10,
      scores: {},
      currentHeadline: null,
      votes: {},
      streaks: {},
      queue: shuffledIndices(HEADLINES.length),
    };
    await this._save(roomId, state);
  }

  async onDeactivate(roomId: string): Promise<void> {
    await redisClient.del(KEY(roomId));
  }

  async handleAction({ action, payload, roomId, guestId, role, io }: {
    action: string;
    payload: unknown;
    roomId: string;
    guestId: string;
    role: "HOST" | "CO_HOST" | "GUEST";
    io: Server;
  }): Promise<void> {
    switch (action) {

      // ─── HOST: Start the game ──────────────────────────────────────────
      case "start": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        const state = await this._load(roomId);
        if (!state) return;

        state.phase = "question";
        state.round = 1;
        state.queue = shuffledIndices(HEADLINES.length);
        state.currentHeadline = HEADLINES[state.queue[0]];
        state.votes = {};
        state.streaks = {};
        state.scores = {};

        await this._save(roomId, state);
        await this._broadcastSafe(roomId, state, io);
        break;
      }

      // ─── GUEST: Vote real or fake ──────────────────────────────────────
      case "vote": {
        const state = await this._load(roomId);
        if (!state || state.phase !== "question") return;

        const p = payload as any;
        const choice: "real" | "fake" = p.choice === "real" ? "real" : "fake";
        state.votes[guestId] = choice;

        await this._save(roomId, state);

        // Acknowledge only to the voter — no full broadcast to avoid spoiling order
        const seq = await getNextSequenceId(roomId);
        io.to(guestId).emit("experience:state" as any, {
          experienceType: "fake_news",
          state: this._safeState(state),
          view: { type: "fake_news" as any, data: this._safeState(state) },
          sequenceId: seq,
        });
        break;
      }

      // ─── HOST: Reveal answers and score ───────────────────────────────
      case "reveal": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        const state = await this._load(roomId);
        if (!state || !state.currentHeadline) return;

        const correctChoice: "real" | "fake" = state.currentHeadline.isReal ? "real" : "fake";

        for (const [vid, vote] of Object.entries(state.votes)) {
          if (vote === correctChoice) {
            const streak = (state.streaks[vid] ?? 0) + 1;
            state.streaks[vid] = streak;
            state.scores[vid] = (state.scores[vid] ?? 0) + 100 * streak;
          } else {
            state.streaks[vid] = 0;
          }
        }

        state.phase = "reveal";
        await this._save(roomId, state);
        await this._broadcast(roomId, state, io);
        break;
      }

      // ─── HOST: Advance to next round ───────────────────────────────────
      case "next": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        const state = await this._load(roomId);
        if (!state) return;

        state.round += 1;

        if (state.round > state.totalRounds) {
          state.phase = "finished";
          state.currentHeadline = null;
        } else {
          const headlineIdx = state.queue[(state.round - 1) % state.queue.length];
          state.phase = "question";
          state.currentHeadline = HEADLINES[headlineIdx];
          state.votes = {};
        }

        await this._save(roomId, state);
        await this._broadcastSafe(roomId, state, io);
        break;
      }

      // ─── HOST: End game ────────────────────────────────────────────────
      case "end_game": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        const state = await this._load(roomId);
        if (!state) return;

        state.phase = "finished";
        state.currentHeadline = null;
        await this._save(roomId, state);
        await this._broadcast(roomId, state, io);
        break;
      }

      // ─── HOST: Return to DJ experience ────────────────────────────────
      case "end": {
        if (role !== "HOST" && role !== "CO_HOST") return;
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
    const state = await this._load(roomId);
    if (!state) return { type: "intermission" };
    return { type: "fake_news" as any, data: this._safeState(state) };
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  /** Strip isReal from currentHeadline so guests can't cheat */
  private _safeState(state: FakeNewsState): Omit<FakeNewsState, "currentHeadline"> & { currentHeadline: { text: string } | null } {
    const { currentHeadline, ...rest } = state;
    return {
      ...rest,
      currentHeadline: currentHeadline ? { text: currentHeadline.text } : null,
    };
  }

  /** Broadcast without revealing isReal (for question phase) */
  private async _broadcastSafe(roomId: string, state: FakeNewsState, io: Server): Promise<void> {
    const seq = await getNextSequenceId(roomId);
    const safe = this._safeState(state);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "fake_news",
      state: safe,
      view: { type: "fake_news" as any, data: safe },
      sequenceId: seq,
    });
  }

  /** Broadcast full state including isReal (for reveal phase) */
  private async _broadcast(roomId: string, state: FakeNewsState, io: Server): Promise<void> {
    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "fake_news",
      state,
      view: { type: "fake_news" as any, data: state },
      sequenceId: seq,
    });
  }

  private async _load(roomId: string): Promise<FakeNewsState | null> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }

  private async _save(roomId: string, state: FakeNewsState): Promise<void> {
    await redisClient.set(KEY(roomId), JSON.stringify(state), { EX: 14400 });
  }
}
