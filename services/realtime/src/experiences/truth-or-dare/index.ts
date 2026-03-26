import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";

// ─────────────────────────────────────────────────────────────────────────────
// Truth or Dare Experience
//
// Host spins to randomly pick a guest, then randomly assigns a truth or dare.
// Guest can pass once per game. Completing earns +300 pts.
//
// Actions:
//   HOST:  start, spin, end
//   GUEST: complete, pass
// ─────────────────────────────────────────────────────────────────────────────

const TRUTHS: string[] = [
  "What is the most embarrassing thing that's ever happened to you at a party?",
  "What's the worst date you've ever been on?",
  "Have you ever lied to get out of a social event? What did you say?",
  "What's the most childish thing you still do?",
  "What's a secret you've never told anyone in this room?",
  "What's the most ridiculous thing you've ever done to impress someone?",
  "What's your most embarrassing drunk story?",
  "If you could switch lives with anyone in this room for a day, who and why?",
];

const DARES: string[] = [
  "Do your best impression of another person in this room",
  "Sing the chorus of any song chosen by the group",
  "Let the room post anything they want on your social media for 30 seconds",
  "Do 20 jumping jacks while reciting the alphabet",
  "Call a contact in your phone and sing Happy Birthday to them",
  "Speak in an accent chosen by the group for the next 3 rounds",
  "Show the most embarrassing photo on your phone",
  "Do your best catwalk across the room",
];

interface TruthOrDareState {
  phase: "waiting" | "spinning" | "playing" | "finished";
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
  currentPlayer: string | null;
  currentType: "truth" | "dare" | null;
  currentChallenge: string | null;
  passesUsed: Record<string, number>;
}

const KEY = (roomId: string) => `experience:truth_or_dare:${roomId}`;

export class TruthOrDareExperience implements ExperienceModule {
  readonly type = "truth_or_dare" as const;

  async onActivate(roomId: string, _hostGuestId: string): Promise<void> {
    const state: TruthOrDareState = {
      phase: "waiting",
      round: 0,
      totalRounds: 8,
      scores: {},
      currentPlayer: null,
      currentType: null,
      currentChallenge: null,
      passesUsed: {},
    };
    await redisClient.set(KEY(roomId), JSON.stringify(state));
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
    const raw = await redisClient.get(KEY(roomId));
    if (!raw) return;
    const state: TruthOrDareState = JSON.parse(raw);

    switch (action) {
      case "start": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        state.phase = "spinning";
        state.round = 1;
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "truth_or_dare",
          state,
          view: { type: "truth_or_dare", data: state },
          sequenceId: seq,
        });
        break;
      }

      case "spin": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        const p = payload as { guestIds: string[] };
        if (!p?.guestIds?.length) return;
        const picked = p.guestIds[Math.floor(Math.random() * p.guestIds.length)];
        const isTruth = Math.random() < 0.5;
        const pool = isTruth ? TRUTHS : DARES;
        const challenge = pool[Math.floor(Math.random() * pool.length)];
        state.phase = "playing";
        state.currentPlayer = picked;
        state.currentType = isTruth ? "truth" : "dare";
        state.currentChallenge = challenge;
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "truth_or_dare",
          state,
          view: { type: "truth_or_dare", data: state },
          sequenceId: seq,
        });
        break;
      }

      case "complete": {
        // Only the current player or host can mark complete
        if (guestId !== state.currentPlayer && role !== "HOST" && role !== "CO_HOST") return;
        if (state.phase !== "playing" || !state.currentPlayer) return;
        state.scores[state.currentPlayer] = (state.scores[state.currentPlayer] ?? 0) + 300;
        await this._advanceRound(state, roomId, io);
        break;
      }

      case "pass": {
        // Only the current player can pass, and only once per game
        if (guestId !== state.currentPlayer) return;
        if (state.phase !== "playing" || !state.currentPlayer) return;
        const used = state.passesUsed[guestId] ?? 0;
        if (used >= 1) return; // No pass remaining — ignore
        state.passesUsed[guestId] = used + 1;
        // Spin again with same guest list is handled by host sending another spin
        // Here we just revert to spinning phase so host can re-spin
        state.phase = "spinning";
        state.currentPlayer = null;
        state.currentType = null;
        state.currentChallenge = null;
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "truth_or_dare",
          state,
          view: { type: "truth_or_dare", data: state },
          sequenceId: seq,
        });
        break;
      }

      case "end": {
        if (role !== "HOST") return;
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

  private async _advanceRound(state: TruthOrDareState, roomId: string, io: Server): Promise<void> {
    state.currentPlayer = null;
    state.currentType = null;
    state.currentChallenge = null;

    if (state.round >= state.totalRounds) {
      state.phase = "finished";
      await redisClient.set(KEY(roomId), JSON.stringify(state));
      const seq = await getNextSequenceId(roomId);
      io.to(roomId).emit("experience:state" as any, {
        experienceType: "truth_or_dare",
        state,
        view: { type: "leaderboard", data: state.scores },
        sequenceId: seq,
      });
    } else {
      state.round += 1;
      state.phase = "spinning";
      await redisClient.set(KEY(roomId), JSON.stringify(state));
      const seq = await getNextSequenceId(roomId);
      io.to(roomId).emit("experience:state" as any, {
        experienceType: "truth_or_dare",
        state,
        view: { type: "truth_or_dare", data: state },
        sequenceId: seq,
      });
    }
  }

  async getGuestViewDescriptor(roomId: string): Promise<GuestViewDescriptor> {
    const raw = await redisClient.get(KEY(roomId));
    if (!raw) return { type: "intermission" };
    const state: TruthOrDareState = JSON.parse(raw);
    if (state.phase === "finished") return { type: "leaderboard", data: state.scores };
    return { type: "truth_or_dare" as any, data: state };
  }
}
