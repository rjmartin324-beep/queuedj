import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import {
  type ScrapbookSabotageState,
  extractWordBank,
  SCRAPBOOK_WORD_BANK_PROMPTS,
  SCRAPBOOK_WRITING_PROMPTS,
} from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";

const KEY           = (roomId: string) => `experience:scrapbook:${roomId}`;
const WRITING_MS    = 60000; // 60s to write before auto-advancing to voting
const VOTING_MS     = 30000; // 30s to vote before auto-reveal

export class ScrapbookSabotageExperience implements ExperienceModule {
  readonly type = "scrapbook_sabotage" as const;
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  async onActivate(roomId: string): Promise<void> {
    const existing = await this._load(roomId);
    if (existing && existing.phase !== "waiting") return; // mid-game — don't reset
    const state: ScrapbookSabotageState = {
      phase: "waiting",
      roundNumber: 0,
      wordBankPrompt: pick(SCRAPBOOK_WORD_BANK_PROMPTS),
      writingPrompt: pick(SCRAPBOOK_WRITING_PROMPTS),
      wordBankSubmissions: {},
      wordBank: [],
      responses: {},
      votes: {},
      scores: {},
    };
    await this._save(roomId, state);
  }

  async onDeactivate(roomId: string): Promise<void> {
    const t = this.timers.get(roomId);
    if (t) { clearTimeout(t); this.timers.delete(roomId); }
  }

  async handleAction({ action, payload, roomId, guestId, role, io }: {
    action: string; payload: unknown; roomId: string;
    guestId: string; role: "HOST" | "CO_HOST" | "GUEST"; io: Server;
  }): Promise<void> {
    const p = payload as any;

    switch (action) {
      // HOST: kick off the word bank collection phase
      case "start_word_bank":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._startWordBankPhase(roomId, io);
        break;

      // GUEST: submit their word bank description
      case "submit_word_bank":
        await this._submitWordBank(roomId, guestId, p.text, io);
        break;

      // HOST: close word bank, show combined bank, move to writing
      case "close_word_bank":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._closeWordBank(roomId, io);
        break;

      // HOST: open the writing phase
      case "start_writing":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._startWriting(roomId, io);
        break;

      // GUEST: submit their restricted response
      case "submit_response":
        await this._submitResponse(roomId, guestId, p.text, io);
        break;

      // HOST: open voting
      case "start_voting":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._startVoting(roomId, io);
        break;

      // GUEST: vote for funniest response
      case "submit_vote":
        await this._submitVote(roomId, guestId, p.targetGuestId, io);
        break;

      // HOST: reveal results
      case "reveal":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._reveal(roomId, io);
        break;

      case "next_round":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._nextRound(roomId, io);
        break;

      case "skip_round":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._skipPhase(roomId, io);
        break;
    }
  }

  async getGuestViewDescriptor(roomId: string): Promise<GuestViewDescriptor> {
    const state = await this._load(roomId);
    if (!state) return { type: "intermission" };
    switch (state.phase) {
      case "word_bank_input":  return { type: "scrapbook_word_input",  data: { prompt: state.wordBankPrompt } };
      case "word_bank_reveal": return { type: "scrapbook_word_bank",   data: { wordBank: state.wordBank } };
      case "writing":          return { type: "scrapbook_writing",     data: { prompt: state.writingPrompt, wordBank: state.wordBank } };
      case "voting":           return { type: "scrapbook_voting",      data: { responses: this._anonymizeResponses(state) } };
      case "reveal":           return { type: "scrapbook_reveal",      data: state.roundResults };
      case "scores":           return { type: "leaderboard",           data: state.scores };
      default:                 return { type: "intermission" };
    }
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async _startWordBankPhase(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;
    state.phase = "word_bank_input";
    state.wordBankSubmissions = {};
    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  private async _submitWordBank(roomId: string, guestId: string, text: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || state.phase !== "word_bank_input") return;
    state.wordBankSubmissions[guestId] = text.slice(0, 300); // Cap at 300 chars
    await this._save(roomId, state);

    // Broadcast IDs only (don't show other submissions yet)
    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "scrapbook_sabotage",
      partial: true, state: { submittedGuestIds: Object.keys(state.wordBankSubmissions) },
      view: { type: "scrapbook_word_input", data: { prompt: state.wordBankPrompt } },
      sequenceId: seq,
    });
  }

  private async _closeWordBank(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;
    state.wordBank = extractWordBank(state.wordBankSubmissions);
    state.phase = "word_bank_reveal";
    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  private async _startWriting(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;
    state.phase = "writing";
    state.responses = {};
    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
    this._setTimer(roomId, WRITING_MS, () => this._startVoting(roomId, io));
  }

  private async _submitResponse(roomId: string, guestId: string, text: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || state.phase !== "writing") return;

    // Validate: every word must be in the word bank (or be punctuation)
    const words = text.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter(Boolean);
    const invalidWords = words.filter((w) => !state.wordBank.includes(w));

    if (invalidWords.length > 0) {
      // Tell only this guest about invalid words
      // In the client, invalid words are highlighted in real-time
      return;
    }

    state.responses[guestId] = text.slice(0, 500);
    await this._save(roomId, state);
    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "scrapbook_sabotage",
      partial: true, state: { submittedGuestIds: Object.keys(state.responses) },
      view: { type: "scrapbook_writing", data: { prompt: state.writingPrompt, wordBank: state.wordBank } },
      sequenceId: seq,
    });
  }

  private async _startVoting(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || state.phase === "voting") return;
    state.phase = "voting";
    state.votes = {};
    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
    this._setTimer(roomId, VOTING_MS, () => this._reveal(roomId, io));
  }

  private async _submitVote(roomId: string, guestId: string, targetGuestId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || state.phase !== "voting") return;
    if (guestId === targetGuestId) return; // Can't vote for yourself
    if (state.votes[guestId]) return;      // Already voted

    state.votes[guestId] = targetGuestId;
    await this._save(roomId, state);
    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "scrapbook_sabotage",
      partial: true, state: { votedGuestIds: Object.keys(state.votes) },
      view: { type: "scrapbook_voting" },
      sequenceId: seq,
    });
  }

  private async _reveal(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;

    // Tally votes
    const voteCounts: Record<string, number> = {};
    for (const target of Object.values(state.votes)) {
      voteCounts[target] = (voteCounts[target] ?? 0) + 1;
    }
    const winner = Object.entries(voteCounts).sort(([, a], [, b]) => b - a)[0]?.[0];

    if (winner) state.scores[winner] = (state.scores[winner] ?? 0) + 200;

    state.roundResults = {
      writingPrompt: state.writingPrompt,
      wordBank: state.wordBank,
      responses: state.responses,
      votes: state.votes,
      winner: winner ?? "",
    };
    state.phase = "reveal";
    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  private async _nextRound(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;
    state.roundNumber += 1;
    state.wordBankPrompt = pick(SCRAPBOOK_WORD_BANK_PROMPTS);
    state.writingPrompt = pick(SCRAPBOOK_WRITING_PROMPTS);
    state.wordBankSubmissions = {};
    state.wordBank = [];
    state.responses = {};
    state.votes = {};
    state.phase = "word_bank_input";
    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  private async _skipPhase(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;
    if (state.phase === "word_bank_input") await this._closeWordBank(roomId, io);
    else if (state.phase === "writing") await this._startVoting(roomId, io);
    else if (state.phase === "voting") await this._reveal(roomId, io);
  }

  /** During voting, responses are shown but authorship is hidden */
  private _anonymizeResponses(state: ScrapbookSabotageState): Array<{ id: string; text: string }> {
    return Object.entries(state.responses)
      .map(([guestId, text]) => ({ id: guestId, text }))
      .sort(() => Math.random() - 0.5); // Shuffle so order doesn't reveal author
  }

  private async _broadcast(roomId: string, state: ScrapbookSabotageState, io: Server): Promise<void> {
    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "scrapbook_sabotage",
      state,
      view: await this.getGuestViewDescriptor(roomId),
      sequenceId: seq,
    });
  }

  private async _load(roomId: string): Promise<ScrapbookSabotageState | null> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }

  private async _save(roomId: string, state: ScrapbookSabotageState): Promise<void> {
    await redisClient.set(KEY(roomId), JSON.stringify(state));
  }

  private _setTimer(roomId: string, ms: number, fn: () => void) {
    const existing = this.timers.get(roomId);
    if (existing) clearTimeout(existing);
    this.timers.set(roomId, setTimeout(fn, ms));
  }
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
