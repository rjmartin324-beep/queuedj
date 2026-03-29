import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";

// ─────────────────────────────────────────────────────────────────────────────
// Bucket List Experience
//
// Everyone submits a bucket list item anonymously. Then one by one, all items
// are displayed and guests guess who wrote it. Correct guesses earn points.
//
// Actions:
//   HOST:  start, reveal, next_item, end
//   GUEST: submit_item, guess
// ─────────────────────────────────────────────────────────────────────────────

const KEY = (roomId: string) => `experience:bucket_list:${roomId}`;

interface BucketListState {
  phase: "waiting" | "submitting" | "guessing" | "reveal" | "finished";
  round: number;
  totalRounds: number; // set dynamically from player count
  scores: Record<string, number>;
  submissions: Record<string, string>; // guestId -> bucket list item
  currentItem: { text: string; authorId: string } | null;
  guesses: Record<string, string>; // guestId -> guessed authorId
  displayIndex: number;            // which submission we're currently on
  submissionOrder: string[];       // ordered list of authorIds for iteration
}

export class BucketListExperience implements ExperienceModule {
  readonly type = "bucket_list" as const;

  async onActivate(roomId: string, _hostGuestId: string): Promise<void> {
    const membersRaw = await redisClient.sMembers(`room:${roomId}:members`);
    const totalRounds = Math.max(3, membersRaw.length);

    const state: BucketListState = {
      phase: "waiting",
      round: 0,
      totalRounds,
      scores: {},
      submissions: {},
      currentItem: null,
      guesses: {},
      displayIndex: 0,
      submissionOrder: [],
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

      case "submit_item":
        await this._submitItem(roomId, guestId, p.item, io);
        break;

      case "guess":
        await this._guess(roomId, guestId, p.authorGuestId, io);
        break;

      case "reveal":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._reveal(roomId, io);
        break;

      case "next_item":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._nextItem(roomId, io);
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
    return { type: "bucket_list" as any, data: this._safeState(state) };
  }

  async getBootstrapState(roomId: string): Promise<unknown> {
    const raw = await redisClient.get(KEY(roomId));
    if (!raw) return null;
    return this._safeState(JSON.parse(raw));
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private async _start(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;

    // Re-read live members
    const membersRaw = await redisClient.sMembers(`room:${roomId}:members`);
    state.totalRounds = Math.max(3, membersRaw.length);
    state.submissions = {};
    state.displayIndex = 0;
    state.submissionOrder = [];
    state.currentItem = null;
    state.guesses = {};
    state.round = 0;
    state.phase = "submitting";

    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  private async _submitItem(roomId: string, guestId: string, item: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || state.phase !== "submitting") return;
    if (!item || typeof item !== "string") return;
    if (state.submissions[guestId] !== undefined) return; // Already submitted

    const sanitized = item.trim().slice(0, 200);
    if (sanitized.length === 0) return;

    state.submissions[guestId] = sanitized;
    await this._save(roomId, state);

    // Check if everyone has submitted — transition to guessing phase
    const memberCount = await redisClient.sCard(`room:${roomId}:members`);
    if (Object.keys(state.submissions).length >= memberCount) {
      await this._beginGuessing(roomId, io);
    } else {
      // Broadcast updated submission count (not the items)
      await this._broadcast(roomId, state, io);
    }
  }

  private async _beginGuessing(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;

    const authorIds = Object.keys(state.submissions);
    // Shuffle so display order is random
    state.submissionOrder = authorIds.sort(() => Math.random() - 0.5);
    state.displayIndex = 0;
    state.totalRounds = state.submissionOrder.length;
    state.round = 1;
    state.guesses = {};

    const firstAuthorId = state.submissionOrder[0];
    state.currentItem = { text: state.submissions[firstAuthorId], authorId: firstAuthorId };
    state.phase = "guessing";

    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  private async _guess(roomId: string, guestId: string, authorGuestId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || state.phase !== "guessing") return;
    if (state.guesses[guestId] !== undefined) return; // Already guessed
    if (!state.currentItem) return;
    // Guests shouldn't guess their own item
    if (state.currentItem.authorId === guestId) return;

    state.guesses[guestId] = authorGuestId;
    await this._save(roomId, state);
    // No broadcast — answers revealed at reveal phase
  }

  private async _reveal(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || !state.currentItem || state.phase !== "guessing") return;

    const correctAuthorId = state.currentItem.authorId;

    for (const [guesserId, guessedAuthorId] of Object.entries(state.guesses)) {
      if (guessedAuthorId === correctAuthorId) {
        state.scores[guesserId] = (state.scores[guesserId] ?? 0) + 300;
      }
    }

    state.phase = "reveal";
    await this._save(roomId, state);

    // Broadcast with authorId revealed
    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "bucket_list",
      state,
      view: { type: "bucket_list" as any, data: state },
      sequenceId: seq,
    });
  }

  private async _nextItem(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;

    const nextIndex = state.displayIndex + 1;

    if (nextIndex >= state.submissionOrder.length) {
      state.phase = "finished";
      state.currentItem = null;
      await this._save(roomId, state);
      await this._broadcast(roomId, state, io);
      return;
    }

    state.displayIndex = nextIndex;
    state.round = nextIndex + 1;
    state.guesses = {};

    const nextAuthorId = state.submissionOrder[nextIndex];
    state.currentItem = { text: state.submissions[nextAuthorId], authorId: nextAuthorId };
    state.phase = "guessing";

    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  /**
   * During guessing phase hide the authorId so guests can't see who wrote it,
   * and hide all individual submissions.
   */
  private _safeState(state: BucketListState): unknown {
    const { submissions, guesses, ...rest } = state;
    const safeItem = state.currentItem && state.phase === "guessing"
      ? { text: state.currentItem.text } // hide authorId
      : state.currentItem;

    return {
      ...rest,
      submissionCount: Object.keys(submissions).length,
      guessCount: Object.keys(guesses).length,
      currentItem: safeItem,
    };
  }

  private async _broadcast(roomId: string, state: BucketListState, io: Server): Promise<void> {
    const seq = await getNextSequenceId(roomId);
    const safe = this._safeState(state);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "bucket_list",
      state: safe,
      view: { type: "bucket_list" as any, data: safe },
      sequenceId: seq,
    });
  }

  private async _load(roomId: string): Promise<BucketListState | null> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }

  private async _save(roomId: string, state: BucketListState): Promise<void> {
    await redisClient.set(KEY(roomId), JSON.stringify(state));
  }
}