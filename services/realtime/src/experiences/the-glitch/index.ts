import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import {
  type TheGlitchState,
  GLITCH_PROMPTS,
  scoreTheGlitch,
} from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";

const KEY        = (roomId: string) => `experience:glitch:${roomId}`;
const VIEWING_MS = 5000;  // Prompt shown for 5 seconds

export class TheGlitchExperience implements ExperienceModule {
  readonly type = "the_glitch" as const;

  async onActivate(roomId: string): Promise<void> {
    const state: TheGlitchState = {
      phase: "waiting",
      roundNumber: 0,
      glitchGuestId: null,
      realPromptId: null,
      glitchPromptId: null,
      promptRevealedAt: null,
      descriptions: {},
      votes: {},
      scores: {},
    };
    await this._save(roomId, state);
  }

  async onDeactivate(roomId: string): Promise<void> {}

  async handleAction({ action, payload, roomId, guestId, role, io }: {
    action: string; payload: unknown; roomId: string;
    guestId: string; role: "HOST" | "CO_HOST" | "GUEST"; io: Server;
  }): Promise<void> {
    const p = payload as any;

    switch (action) {
      case "start_round":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._startRound(roomId, io);
        break;

      case "submit_description":
        await this._submitDescription(roomId, guestId, p.text, io);
        break;

      case "start_voting":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._startVoting(roomId, io);
        break;

      case "submit_vote":
        await this._submitVote(roomId, guestId, p.accusedGuestId, io);
        break;

      case "reveal":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._reveal(roomId, io);
        break;

      case "next_round":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._startRound(roomId, io);
        break;
    }
  }

  async getGuestViewDescriptor(roomId: string): Promise<GuestViewDescriptor> {
    const state = await this._load(roomId);
    if (!state) return { type: "intermission" };
    switch (state.phase) {
      case "watching":    return { type: "glitch_watching",    data: { revealedAt: state.promptRevealedAt, viewingMs: VIEWING_MS } };
      case "describing":  return { type: "glitch_describing",  data: { descriptions: state.descriptions } };
      case "voting":      return { type: "glitch_voting",      data: { descriptions: state.descriptions } };
      case "reveal":      return { type: "glitch_reveal",      data: state };
      case "scores":      return { type: "leaderboard",        data: state.scores };
      default:            return { type: "intermission" };
    }
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async _startRound(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;

    // Pick two different prompts (real + glitch)
    const shuffled = [...GLITCH_PROMPTS].sort(() => Math.random() - 0.5);
    const realPrompt  = shuffled[0];
    const glitchPrompt = shuffled[1];

    // Pick a random Glitch from the member list
    const members = await redisClient.sMembers(`room:${roomId}:members`);
    const glitchGuestId = members[Math.floor(Math.random() * members.length)];

    state.roundNumber += 1;
    state.glitchGuestId = glitchGuestId;
    state.realPromptId  = realPrompt.id;
    state.glitchPromptId = glitchPrompt.id;
    state.promptRevealedAt = Date.now();
    state.descriptions = {};
    state.votes = {};
    state.phase = "watching";

    await this._save(roomId, state);

    // Send DIFFERENT prompts to different guests
    const allSockets = await io.in(roomId).fetchSockets();
    for (const s of allSockets) {
      const socketGuestId = s.handshake.auth?.guestId;
      const isGlitch = socketGuestId === glitchGuestId;
      const prompt = isGlitch ? glitchPrompt : realPrompt;

      s.emit("experience:state" as any, {
        experienceType: "the_glitch",
        state: {
          ...state,
          glitchGuestId: null, // NEVER reveal who the Glitch is during play
          myPrompt: {
            description: isGlitch ? prompt.glitchDescription : prompt.realDescription,
            category: prompt.category,
          },
        },
        view: { type: "glitch_watching", data: { revealedAt: state.promptRevealedAt, viewingMs: VIEWING_MS } },
      });
    }

    // Auto-move to describing phase after viewing window
    setTimeout(() => this._startDescribing(roomId, io), VIEWING_MS + 500);
  }

  private async _startDescribing(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || state.phase !== "watching") return;
    state.phase = "describing";
    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  private async _submitDescription(roomId: string, guestId: string, text: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || state.phase !== "describing") return;
    state.descriptions[guestId] = text.slice(0, 200);
    await this._save(roomId, state);
    // No broadcast — descriptions are revealed all at once during voting
  }

  private async _startVoting(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;
    state.phase = "voting";
    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  private async _submitVote(roomId: string, guestId: string, accusedGuestId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || state.phase !== "voting") return;
    if (guestId === accusedGuestId) return;  // Can't accuse yourself
    if (state.votes[guestId]) return;         // Already voted

    state.votes[guestId] = accusedGuestId;
    await this._save(roomId, state);
  }

  private async _reveal(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || !state.glitchGuestId) return;

    const members = await redisClient.sMembers(`room:${roomId}:members`);
    const roundScores = scoreTheGlitch(state.votes, state.glitchGuestId, members);

    for (const [gId, pts] of Object.entries(roundScores)) {
      state.scores[gId] = (state.scores[gId] ?? 0) + pts;
    }

    const correctVoters = Object.values(state.votes).filter((v) => v === state.glitchGuestId);
    state.glitchWon = correctVoters.length === 0;
    state.phase = "reveal";

    // Now we reveal glitchGuestId + both prompts
    const realPrompt   = GLITCH_PROMPTS.find((p) => p.id === state.realPromptId);
    const glitchPrompt = GLITCH_PROMPTS.find((p) => p.id === state.glitchPromptId);

    await this._save(roomId, state);

    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "the_glitch",
      state: {
        ...state,
        realPrompt,
        glitchPrompt,
        roundScores,
      },
      view: { type: "glitch_reveal", data: { state, realPrompt, glitchPrompt } },
      sequenceId: seq,
    });
  }

  private async _broadcast(roomId: string, state: TheGlitchState, io: Server): Promise<void> {
    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "the_glitch",
      state: { ...state, glitchGuestId: null }, // Never leak glitchGuestId during play
      view: await this.getGuestViewDescriptor(roomId),
      sequenceId: seq,
    });
  }

  private async _load(roomId: string): Promise<TheGlitchState | null> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }

  private async _save(roomId: string, state: TheGlitchState): Promise<void> {
    await redisClient.set(KEY(roomId), JSON.stringify(state));
  }
}
