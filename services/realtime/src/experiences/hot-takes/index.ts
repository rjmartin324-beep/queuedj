import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";
import { awardGameWin } from "../../lib/credits";

// ─────────────────────────────────────────────────────────────────────────────
// Hot Takes Experience
//
// Host picks a topic. Everyone submits a hot take on that topic.
// Then everyone votes on each take: agree | disagree | spicy | boring.
// After all votes cast, reveals automatically.
//
// Scoring:
//   Most "agree" votes  → +300
//   Most "spicy" votes  → +200
//
// Phases: waiting → topic → submitting → voting → reveal → finished
//
// HOST actions: start(topic), next_round, end
// GUEST actions: submit_take(text), vote(takeId, category)
// ─────────────────────────────────────────────────────────────────────────────

export type VoteCategory = "agree" | "disagree" | "spicy" | "boring";

interface Take {
  id: string;
  guestId: string;
  text: string;
  votes: Record<VoteCategory, number>;
}

interface HotTakesState {
  phase: "waiting" | "topic" | "submitting" | "voting" | "reveal" | "finished";
  round: number;
  currentTopic: string | null;
  takes: Take[];
  /** guestId → takeId they voted on in this round */
  voterMap: Record<string, string[]>; // guestId → takeIds voted
  scores: Record<string, number>;
  /** guest ids who have submitted takes this round */
  submittedIds: string[];
}

const KEY = (roomId: string) => `experience:hot_takes:${roomId}`;

let _takeCounter = 0;
function newTakeId(): string {
  return `t${Date.now()}_${++_takeCounter}`;
}

export class HotTakesExperience implements ExperienceModule {
  readonly type = "hot_takes" as const;
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  async onActivate(roomId: string, _hostGuestId: string): Promise<void> {
    const existing = await redisClient.get(KEY(roomId));
    if (existing) {
      const s: HotTakesState = JSON.parse(existing);
      if (s.phase !== "waiting" && s.phase !== "finished") return;
    }
    const state: HotTakesState = {
      phase: "waiting",
      round: 0,
      currentTopic: null,
      takes: [],
      voterMap: {},
      scores: {},
      submittedIds: [],
    };
    await redisClient.set(KEY(roomId), JSON.stringify(state));
  }

  async onDeactivate(roomId: string): Promise<void> {
    const t = this.timers.get(roomId);
    if (t) { clearTimeout(t); this.timers.delete(roomId); }
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
    const state: HotTakesState = JSON.parse(raw);

    switch (action) {
      // ── HOST: start(topic) ──────────────────────────────────────────────────
      case "start": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        const p = payload as { topic?: string };
        const topic = (p?.topic ?? "").trim();
        if (!topic) return;
        state.phase = "submitting";
        state.round = (state.round ?? 0) + 1;
        state.currentTopic = topic;
        state.takes = [];
        state.voterMap = {};
        state.submittedIds = [];
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "hot_takes",
          state: this._sanitise(state),
          view: { type: "hot_takes", data: this._sanitise(state) },
          sequenceId: seq,
        });
        break;
      }

      // ── GUEST: submit_take(text) ─────────────────────────────────────────────
      case "submit_take": {
        if (state.phase !== "submitting") return;
        if (state.submittedIds.includes(guestId)) return; // one take per guest
        const p = payload as { text?: string };
        const text = (p?.text ?? "").trim();
        if (!text || text.length > 200) return;
        const take: Take = {
          id: newTakeId(),
          guestId,
          text,
          votes: { agree: 0, disagree: 0, spicy: 0, boring: 0 },
        };
        state.takes.push(take);
        state.submittedIds.push(guestId);
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "hot_takes",
          state: this._sanitise(state),
          view: { type: "hot_takes", data: this._sanitise(state) },
          sequenceId: seq,
        });
        break;
      }

      // ── HOST: open_voting — move from submitting → voting ───────────────────
      case "open_voting": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        if (state.phase !== "submitting") return;
        if (state.takes.length === 0) return;
        state.phase = "voting";
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "hot_takes",
          state: this._sanitise(state),
          view: { type: "hot_takes", data: this._sanitise(state) },
          sequenceId: seq,
        });
        break;
      }

      // ── GUEST: vote(takeId, category) ───────────────────────────────────────
      case "vote": {
        if (state.phase !== "voting") return;
        const p = payload as { takeId?: string; category?: VoteCategory };
        const { takeId, category } = p ?? {};
        if (!takeId || !category) return;
        const validCategories: VoteCategory[] = ["agree", "disagree", "spicy", "boring"];
        if (!validCategories.includes(category)) return;
        const take = state.takes.find(t => t.id === takeId);
        if (!take) return;
        // Can't vote on your own take
        if (take.guestId === guestId) return;
        // One vote per take per voter
        const alreadyVoted = (state.voterMap[guestId] ?? []).includes(takeId);
        if (alreadyVoted) return;

        take.votes[category]++;
        if (!state.voterMap[guestId]) state.voterMap[guestId] = [];
        state.voterMap[guestId].push(takeId);

        await redisClient.set(KEY(roomId), JSON.stringify(state));

        // Check if all eligible votes are cast — each guest votes on all takes except their own
        const allVoted = this._allVotesCast(state);
        if (allVoted) {
          // Auto-advance to reveal
          await this._doReveal(roomId, state, io);
        } else {
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "hot_takes",
            state: this._sanitise(state),
            view: { type: "hot_takes", data: this._sanitise(state) },
            sequenceId: seq,
          });
        }
        break;
      }

      // ── HOST: next_round ────────────────────────────────────────────────────
      case "next_round": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        if (state.phase !== "reveal") return;
        const t = this.timers.get(roomId);
        if (t) { clearTimeout(t); this.timers.delete(roomId); }
        // Reset for next round — stay in "topic" phase so host can set a topic
        state.phase = "topic";
        state.currentTopic = null;
        state.takes = [];
        state.voterMap = {};
        state.submittedIds = [];
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "hot_takes",
          state,
          view: { type: "hot_takes", data: state },
          sequenceId: seq,
        });
        break;
      }

      // ── HOST: end ───────────────────────────────────────────────────────────
      case "end": {
        if (role !== "HOST") return;
        const t = this.timers.get(roomId);
        if (t) { clearTimeout(t); this.timers.delete(roomId); }
        state.phase = "finished";
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "hot_takes",
          state,
          view: { type: "leaderboard", data: state.scores },
          sequenceId: seq,
        });
        await awardGameWin(io, state.scores, roomId).catch(() => {});
        break;
      }
    }
  }

  async getGuestViewDescriptor(roomId: string): Promise<GuestViewDescriptor> {
    const raw = await redisClient.get(KEY(roomId));
    if (!raw) return { type: "intermission" };
    const state: HotTakesState = JSON.parse(raw);
    if (state.phase === "finished") return { type: "leaderboard", data: state.scores };
    return { type: "hot_takes" as any, data: this._sanitise(state) };
  }

  async getBootstrapState(roomId: string): Promise<unknown> {
    const raw = await redisClient.get(KEY(roomId));
    if (!raw) return null;
    const state: HotTakesState = JSON.parse(raw);
    return this._sanitise(state);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Remove internal bookkeeping from broadcast state — guests don't need voterMap internals */
  private _sanitise(state: HotTakesState): Omit<HotTakesState, "voterMap"> & { voterMap: undefined } {
    const { voterMap: _voterMap, ...rest } = state;
    return { ...rest, voterMap: undefined as any };
  }

  /** All guests who submitted takes have also voted on every take that isn't their own */
  private _allVotesCast(state: HotTakesState): boolean {
    if (state.takes.length === 0) return false;
    const voters = state.submittedIds; // everyone who submitted
    for (const voter of voters) {
      const takeIdsToVoteOn = state.takes
        .filter(t => t.guestId !== voter)
        .map(t => t.id);
      const voted = state.voterMap[voter] ?? [];
      if (!takeIdsToVoteOn.every(id => voted.includes(id))) return false;
    }
    return true;
  }

  private async _doReveal(roomId: string, state: HotTakesState, io: Server): Promise<void> {
    state.phase = "reveal";

    // Score: most "agree" votes → +300, most "spicy" votes → +200
    if (state.takes.length > 0) {
      const maxAgree = Math.max(...state.takes.map(t => t.votes.agree));
      const maxSpicy = Math.max(...state.takes.map(t => t.votes.spicy));

      for (const take of state.takes) {
        if (maxAgree > 0 && take.votes.agree === maxAgree) {
          state.scores[take.guestId] = (state.scores[take.guestId] ?? 0) + 300;
        }
        if (maxSpicy > 0 && take.votes.spicy === maxSpicy) {
          state.scores[take.guestId] = (state.scores[take.guestId] ?? 0) + 200;
        }
      }
    }

    await redisClient.set(KEY(roomId), JSON.stringify(state));
    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "hot_takes",
      state,
      view: { type: "hot_takes", data: state },
      sequenceId: seq,
    });
  }
}
