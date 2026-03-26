import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";

// ─────────────────────────────────────────────────────────────────────────────
// Story Time Experience
//
// Players take turns adding one word to a collaborative story.
// The story starts with "Once" and grows to 20 words.
// Points for contributing. Timeout moves the turn.
//
// Actions:
//   HOST:  start, timeout, end
//   GUEST: add_word
// ─────────────────────────────────────────────────────────────────────────────

const KEY = (roomId: string) => `experience:story_time:${roomId}`;

/** Allowed characters in a story word — letters, apostrophes, hyphens */
const WORD_PATTERN = /^[a-zA-Z'-]{1,30}$/;

interface StoryTimeState {
  phase: "waiting" | "playing" | "finished";
  round: number;      // current word index (= wordCount)
  totalRounds: number;
  scores: Record<string, number>;
  story: string[];
  currentTurn: string | null; // guestId whose turn it is
  wordCount: number;
  turnOrder: string[]; // rotating list of guestIds
}

export class StoryTimeExperience implements ExperienceModule {
  readonly type = "story_time" as const;

  async onActivate(roomId: string, _hostGuestId: string): Promise<void> {
    const membersRaw = await redisClient.sMembers(`room:${roomId}:members`);
    const turnOrder = membersRaw.sort(() => Math.random() - 0.5);

    const state: StoryTimeState = {
      phase: "waiting",
      round: 0,
      totalRounds: 20,
      scores: {},
      story: [],
      currentTurn: null,
      wordCount: 0,
      turnOrder,
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
    const p = payload as any;

    switch (action) {
      case "start":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._start(roomId, io);
        break;

      case "add_word":
        await this._addWord(roomId, guestId, p.word, io);
        break;

      case "timeout":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._timeout(roomId, io);
        break;

      case "end":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this.onDeactivate(roomId);
        await redisClient.set(`room:${roomId}:experience`, "dj");
        io.to(roomId).emit("experience:changed" as any, {
          experienceType: "dj",
          view: { type: "dj_queue" },
          sequenceId: await getNextSequenceId(roomId),
        });
        break;
    }
  }

  async getGuestViewDescriptor(roomId: string): Promise<GuestViewDescriptor> {
    const state = await this._load(roomId);
    if (!state) return { type: "intermission" };
    return { type: "story_time" as any, data: state };
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private async _start(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;

    // Re-fetch live members in case someone joined after activate
    const membersRaw = await redisClient.sMembers(`room:${roomId}:members`);
    state.turnOrder = membersRaw.sort(() => Math.random() - 0.5);

    state.story = ["Once"];
    state.wordCount = 1;
    state.round = 1;
    state.currentTurn = state.turnOrder[0] ?? null;
    state.phase = "playing";

    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  private async _addWord(roomId: string, guestId: string, word: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || state.phase !== "playing") return;
    if (state.currentTurn !== guestId) return; // Not your turn
    if (!word || typeof word !== "string") return;

    const sanitized = word.trim();
    if (!WORD_PATTERN.test(sanitized)) return; // Block invalid input

    state.story.push(sanitized);
    state.wordCount += 1;
    state.round = state.wordCount;
    state.scores[guestId] = (state.scores[guestId] ?? 0) + 50;

    if (state.wordCount >= state.totalRounds) {
      state.phase = "finished";
      state.currentTurn = null;
    } else {
      state.currentTurn = this._nextTurn(state);
    }

    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  private async _timeout(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || state.phase !== "playing" || !state.currentTurn) return;

    // Current player gets 0 for this turn — just advance
    state.currentTurn = this._nextTurn(state);

    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  /** Pick the next player in round-robin order */
  private _nextTurn(state: StoryTimeState): string | null {
    if (state.turnOrder.length === 0) return null;
    const currentIdx = state.turnOrder.indexOf(state.currentTurn ?? "");
    const nextIdx = (currentIdx + 1) % state.turnOrder.length;
    return state.turnOrder[nextIdx];
  }

  private async _broadcast(roomId: string, state: StoryTimeState, io: Server): Promise<void> {
    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "story_time",
      state,
      view: { type: "story_time" as any, data: state },
      sequenceId: seq,
    });
  }

  private async _load(roomId: string): Promise<StoryTimeState | null> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }

  private async _save(roomId: string, state: StoryTimeState): Promise<void> {
    await redisClient.set(KEY(roomId), JSON.stringify(state));
  }
}
