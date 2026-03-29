import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";

// ─────────────────────────────────────────────────────────────────────────────
// Two Truths One Lie Experience
//
// One guest submits 3 facts (2 true, 1 lie). Everyone else votes on which is
// the lie. Guests who got it wrong (were fooled) get +300 pts.
// Guests who guessed correctly get +100 pts.
// The submitter gets bonus points based on how many people they fooled.
//
// Actions:
//   HOST:         start, reveal_lie, next, end
//   SUBMITTER:    submit_facts
//   OTHER GUESTS: vote
// ─────────────────────────────────────────────────────────────────────────────

interface TwoTruthsOneLieState {
  phase: "waiting" | "submitting" | "voting" | "reveal" | "finished";
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
  currentSubmitter: string | null;
  facts: string[] | null;
  votes: Record<string, number>; // guestId → index they think is the lie
  usedGuests: string[];
  lieIndex: number | null; // only set after reveal_lie
}

const KEY = (roomId: string) => `experience:two_truths_one_lie:${roomId}`;

export class TwoTruthsOneLieExperience implements ExperienceModule {
  readonly type = "two_truths_one_lie" as const;
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  async onActivate(roomId: string, _hostGuestId: string): Promise<void> {
    const state: TwoTruthsOneLieState = {
      phase: "waiting",
      round: 0,
      totalRounds: 4,
      scores: {},
      currentSubmitter: null,
      facts: null,
      votes: {},
      usedGuests: [],
      lieIndex: null,
    };
    await redisClient.set(KEY(roomId), JSON.stringify(state));
  }

  async onDeactivate(roomId: string): Promise<void> {
    this.timers.forEach(t => clearTimeout(t));
    this.timers.clear();
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
    const state: TwoTruthsOneLieState = JSON.parse(raw);

    switch (action) {
      case "start": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        const p = payload as { guestIds: string[] };
        if (!p?.guestIds?.length) return;
        const firstSubmitter = p.guestIds[0];
        state.phase = "submitting";
        state.round = 1;
        state.currentSubmitter = firstSubmitter;
        state.facts = null;
        state.votes = {};
        state.usedGuests = [firstSubmitter];
        state.lieIndex = null;
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "two_truths_one_lie",
          state,
          view: { type: "two_truths_one_lie", data: state },
          sequenceId: seq,
        });
        break;
      }

      case "submit_facts": {
        if (state.phase !== "submitting") return;
        if (guestId !== state.currentSubmitter) return;
        const p = payload as { facts: string[] };
        if (!Array.isArray(p?.facts) || p.facts.length !== 3) return;
        state.facts = p.facts.map(f => String(f).trim()).slice(0, 3);
        state.votes = {};
        state.phase = "voting";
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        // Send facts to all — guests will see shuffled list and vote
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "two_truths_one_lie",
          state,
          view: { type: "two_truths_one_lie", data: state },
          sequenceId: seq,
        });
        break;
      }

      case "vote": {
        if (state.phase !== "voting") return;
        // Submitter cannot vote on their own facts
        if (guestId === state.currentSubmitter) return;
        const p = payload as { index: number };
        if (p?.index === undefined || p.index === null) return;
        const idx = Number(p.index);
        if (idx < 0 || idx > 2 || !Number.isInteger(idx)) return;
        state.votes[guestId] = idx;
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        // Broadcast vote count only (not who voted what)
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "two_truths_one_lie",
          state: { ...state, votes: {} },
          view: {
            type: "two_truths_one_lie",
            data: { ...state, votes: {}, voteCount: Object.keys(state.votes).length },
          },
          sequenceId: seq,
        });
        break;
      }

      case "reveal_lie": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        if (state.phase !== "voting") return;
        const p = payload as { lieIndex: number };
        if (p?.lieIndex === undefined || p.lieIndex === null) return;
        const lieIdx = Number(p.lieIndex);
        if (lieIdx < 0 || lieIdx > 2 || !Number.isInteger(lieIdx)) return;
        state.lieIndex = lieIdx;
        // Score voters: correct guess +100, incorrect (fooled) +300
        let fooledCount = 0;
        for (const [voter, guessIdx] of Object.entries(state.votes)) {
          if (guessIdx === lieIdx) {
            // Correctly identified the lie
            state.scores[voter] = (state.scores[voter] ?? 0) + 100;
          } else {
            // Fooled!
            state.scores[voter] = (state.scores[voter] ?? 0) + 300;
            fooledCount++;
          }
        }
        // Submitter bonus: +100 per person fooled
        if (state.currentSubmitter) {
          state.scores[state.currentSubmitter] =
            (state.scores[state.currentSubmitter] ?? 0) + fooledCount * 100;
        }
        state.phase = "reveal";
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "two_truths_one_lie",
          state,
          view: { type: "two_truths_one_lie", data: state },
          sequenceId: seq,
        });
        clearTimeout(this.timers.get(`${roomId}:reveal`));
        this.timers.set(`${roomId}:reveal`, setTimeout(async () => {
          try {
            const raw2 = await redisClient.get(KEY(roomId));
            const st: TwoTruthsOneLieState | null = raw2 ? JSON.parse(raw2) : null;
            if (st?.phase === "reveal") {
              const seqLb = await getNextSequenceId(roomId);
              io.to(roomId).emit("experience:state" as any, {
                experienceType: "two_truths_one_lie",
                state: st,
                view: { type: "leaderboard", data: st.scores },
                sequenceId: seqLb,
              });
            }
          } catch {}
          this.timers.set(`${roomId}:advance`, setTimeout(() => this.handleAction({ action: "next", payload: {}, roomId, guestId: "", role: "HOST", io }).catch(() => {}), 3000));
        }, 5000));
        break;
      }

      case "next": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        if (state.phase !== "reveal") return;
        state.round += 1;
        if (state.round > state.totalRounds) {
          state.phase = "finished";
          state.currentSubmitter = null;
          await redisClient.set(KEY(roomId), JSON.stringify(state));
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "two_truths_one_lie",
            state,
            view: { type: "leaderboard", data: state.scores },
            sequenceId: seq,
          });
        } else {
          const p = payload as { guestIds?: string[] };
          // Pick next unused submitter if guestIds provided; otherwise cycle
          let nextSubmitter: string | null = null;
          if (p?.guestIds?.length) {
            const unused = p.guestIds.filter(id => !state.usedGuests.includes(id));
            nextSubmitter = unused.length > 0
              ? unused[0]
              : p.guestIds[state.round % p.guestIds.length];
          }
          state.phase = "submitting";
          state.currentSubmitter = nextSubmitter;
          state.facts = null;
          state.votes = {};
          state.lieIndex = null;
          if (nextSubmitter) state.usedGuests.push(nextSubmitter);
          await redisClient.set(KEY(roomId), JSON.stringify(state));
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "two_truths_one_lie",
            state,
            view: { type: "two_truths_one_lie", data: state },
            sequenceId: seq,
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
          experienceType: "dj",
          view: { type: "dj_queue" },
          sequenceId: seq,
        });
        break;
      }
    }
  }

  async getGuestViewDescriptor(roomId: string): Promise<GuestViewDescriptor> {
    const raw = await redisClient.get(KEY(roomId));
    if (!raw) return { type: "intermission" };
    const state: TwoTruthsOneLieState = JSON.parse(raw);
    if (state.phase === "finished") return { type: "leaderboard", data: state.scores };
    // Hide individual votes until reveal
    if (state.phase === "voting") {
      return {
        type: "two_truths_one_lie" as any,
        data: { ...state, votes: {}, voteCount: Object.keys(state.votes).length },
      };
    }
    return { type: "two_truths_one_lie" as any, data: state };
  }

  async getBootstrapState(roomId: string): Promise<unknown> {
    const raw = await redisClient.get(KEY(roomId));
    if (!raw) return null;
    const state = JSON.parse(raw);
    if (state.phase === "voting") {
      return { ...state, votes: {}, voteCount: Object.keys(state.votes).length };
    }
    return state;
  }
}