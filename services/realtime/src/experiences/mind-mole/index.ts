import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";

// ─────────────────────────────────────────────────────────────────────────────
// MindMole Experience
//
// Everyone gets a secret word. One player (the Mole) gets a slightly different
// word and must blend in. Players give one-word clues each round.
// After 3 rounds, everyone votes on who the Mole is.
// Crew wins by identifying the Mole. Mole wins if not caught.
// ─────────────────────────────────────────────────────────────────────────────

const KEY = (roomId: string) => `experience:mind_mole:${roomId}`;
const CLUE_TIMEOUT_MS = 30_000;

const WORD_PAIRS = [
  { crew: "PALACE", mole: "CASTLE" },
  { crew: "OCEAN", mole: "SEA" },
  { crew: "MOUNTAIN", mole: "HILL" },
  { crew: "DIAMOND", mole: "CRYSTAL" },
  { crew: "JUNGLE", mole: "FOREST" },
  { crew: "STADIUM", mole: "ARENA" },
  { crew: "SURGEON", mole: "DOCTOR" },
  { crew: "HURRICANE", mole: "TORNADO" },
  { crew: "WHISPER", mole: "MURMUR" },
  { crew: "FEAST", mole: "BANQUET" },
  { crew: "GALAXY", mole: "UNIVERSE" },
  { crew: "GUITAR", mole: "VIOLIN" },
  // ── added to reach 50 ────────────────────────────────────────────────────────
  { crew: "AUTOMOBILE", mole: "CAR" },
  { crew: "SOFA", mole: "COUCH" },
  { crew: "EVENING", mole: "DUSK" },
  { crew: "CABIN", mole: "COTTAGE" },
  { crew: "LIBERTY", mole: "FREEDOM" },
  { crew: "SHORE", mole: "BEACH" },
  { crew: "INFANT", mole: "BABY" },
  { crew: "FRIGHTENED", mole: "SCARED" },
  { crew: "CHEERFUL", mole: "HAPPY" },
  { crew: "INTELLIGENT", mole: "SMART" },
  { crew: "BEAUTIFUL", mole: "PRETTY" },
  { crew: "WEALTHY", mole: "RICH" },
  { crew: "JOURNEY", mole: "TRIP" },
  { crew: "PHOTOGRAPH", mole: "PICTURE" },
  { crew: "GIGGLE", mole: "CHUCKLE" },
  { crew: "FURIOUS", mole: "ANGRY" },
  { crew: "ENORMOUS", mole: "HUGE" },
  { crew: "ANCIENT", mole: "OLD" },
  { crew: "RAPID", mole: "FAST" },
  { crew: "SILENT", mole: "QUIET" },
  { crew: "GAZE", mole: "STARE" },
  { crew: "WEEP", mole: "CRY" },
  { crew: "STROLL", mole: "WALK" },
  { crew: "PURCHASE", mole: "BUY" },
  { crew: "CONSTRUCT", mole: "BUILD" },
  { crew: "ASSIST", mole: "HELP" },
  { crew: "FLAME", mole: "FIRE" },
  { crew: "DAGGER", mole: "KNIFE" },
  { crew: "VESSEL", mole: "SHIP" },
  { crew: "CELEBRITY", mole: "STAR" },
  { crew: "CEMETERY", mole: "GRAVEYARD" },
  { crew: "ATTORNEY", mole: "LAWYER" },
  { crew: "SPECTACLES", mole: "GLASSES" },
  { crew: "GARBAGE", mole: "RUBBISH" },
  { crew: "TROUSERS", mole: "PANTS" },
];

interface MindMoleState {
  phase: "waiting" | "cluing" | "voting" | "revealed";
  roundNumber: number;
  totalRounds: number;
  moleId: string | null;
  crewWord: string | null;
  moleWord: string | null;
  clues: Record<string, string[]>;    // guestId → clues per round
  clueNames: Record<string, string>;  // guestId → display name
  votes: Record<string, string>;      // guestId → voted guestId
  scores: Record<string, number>;
  cluePhaseStart: number | null;
}

export class MindMoleExperience implements ExperienceModule {
  readonly type = "mind_mole" as const;
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  async onActivate(roomId: string): Promise<void> {
    const state: MindMoleState = {
      phase: "waiting",
      roundNumber: 0,
      totalRounds: 3,
      moleId: null,
      crewWord: null,
      moleWord: null,
      clues: {},
      clueNames: {},
      votes: {},
      scores: {},
      cluePhaseStart: null,
    };
    await this._save(roomId, state);
  }

  async onDeactivate(roomId: string): Promise<void> {
    const timer = this.timers.get(roomId);
    if (timer) { clearTimeout(timer); this.timers.delete(roomId); }
    await redisClient.del(KEY(roomId));
  }

  async handleAction({ action, payload, roomId, guestId, role, io }: {
    action: string; payload: unknown; roomId: string;
    guestId: string; role: "HOST" | "CO_HOST" | "GUEST"; io: Server;
  }): Promise<void> {
    const p = payload as any;

    switch (action) {
      case "start_game":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._startGame(roomId, p.playerIds, p.playerNames, io);
        break;

      case "start_clue_round":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._startClueRound(roomId, io);
        break;

      case "submit_clue":
        await this._submitClue(roomId, guestId, p.clue, p.name ?? "Guest", io);
        break;

      case "open_voting":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._openVoting(roomId, io);
        break;

      case "submit_vote":
        await this._submitVote(roomId, guestId, p.targetGuestId, io);
        break;

      case "reveal":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._reveal(roomId, io);
        break;
    }
  }

  async getGuestViewDescriptor(roomId: string): Promise<GuestViewDescriptor> {
    const state = await this._load(roomId);
    return {
      type: "mind_mole",
      data: {
        phase: state.phase,
        roundNumber: state.roundNumber,
        totalRounds: state.totalRounds,
        clues: state.clues,
        clueNames: state.clueNames,
        cluePhaseStart: state.cluePhaseStart,
        clueDurationMs: CLUE_TIMEOUT_MS,
      },
    };
  }

  // Roles are assigned per-guest via socket join — host distributes words
  getWordForGuest(guestId: string, state: MindMoleState): string {
    return guestId === state.moleId ? (state.moleWord ?? "") : (state.crewWord ?? "");
  }

  private async _startGame(roomId: string, playerIds: string[], playerNames: Record<string, string>, io: Server): Promise<void> {
    const state = await this._load(roomId);
    const pair = WORD_PAIRS[Math.floor(Math.random() * WORD_PAIRS.length)];
    const moleIdx = Math.floor(Math.random() * playerIds.length);
    state.moleId = playerIds[moleIdx];
    state.crewWord = pair.crew;
    state.moleWord = pair.mole;
    state.clues = {};
    state.clueNames = playerNames;
    state.votes = {};
    state.roundNumber = 0;
    state.phase = "waiting";

    // Send each player their word privately
    for (const pid of playerIds) {
      const word = pid === state.moleId ? pair.mole : pair.crew;
      io.to(pid).emit("mind_mole:your_word", {
        word,
        isMole: pid === state.moleId,
        moleHint: pid === state.moleId ? `Everyone else has: ${pair.crew}` : null,
      });
    }

    await this._save(roomId, state);
    io.to(roomId).emit("experience:state_updated", { phase: "waiting", playerCount: playerIds.length });
  }

  private async _startClueRound(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    state.phase = "cluing";
    state.roundNumber += 1;
    state.cluePhaseStart = Date.now();
    await this._save(roomId, state);
    io.to(roomId).emit("experience:state_updated", {
      phase: "cluing",
      roundNumber: state.roundNumber,
      totalRounds: state.totalRounds,
      cluePhaseStart: state.cluePhaseStart,
      clueDurationMs: CLUE_TIMEOUT_MS,
      clues: state.clues,
    });
    const existing = this.timers.get(roomId);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => this._openVoting(roomId, io), CLUE_TIMEOUT_MS + 5000);
    this.timers.set(roomId, t);
  }

  private async _submitClue(roomId: string, guestId: string, clue: string, name: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (state.phase !== "cluing") return;
    if (!state.clues[guestId]) state.clues[guestId] = [];
    if (state.clues[guestId].length >= state.totalRounds) return;
    state.clues[guestId].push(clue.trim().toUpperCase().slice(0, 20));
    state.clueNames[guestId] = name;
    await this._save(roomId, state);
    io.to(roomId).emit("mind_mole:clue_added", { guestId, name, clues: state.clues[guestId] });
  }

  private async _openVoting(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (state.phase === "voting" || state.phase === "revealed") return;
    state.phase = "voting";
    await this._save(roomId, state);
    io.to(roomId).emit("experience:state_updated", {
      phase: "voting",
      clues: state.clues,
      clueNames: state.clueNames,
    });
  }

  private async _submitVote(roomId: string, guestId: string, targetGuestId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (state.phase !== "voting") return;
    state.votes[guestId] = targetGuestId;
    await this._save(roomId, state);
    io.to(roomId).emit("mind_mole:vote_count", { count: Object.keys(state.votes).length });
  }

  private async _reveal(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    // Tally votes
    const tally: Record<string, number> = {};
    for (const v of Object.values(state.votes)) tally[v] = (tally[v] ?? 0) + 1;
    const accused = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0];
    const caught = accused === state.moleId;

    // Score
    if (caught) {
      for (const [voter, target] of Object.entries(state.votes)) {
        if (target === state.moleId) {
          state.scores[voter] = (state.scores[voter] ?? 0) + 300;
        }
      }
    } else {
      // Mole wins bonus
      if (state.moleId) state.scores[state.moleId] = (state.scores[state.moleId] ?? 0) + 500;
    }

    state.phase = "revealed";
    await this._save(roomId, state);
    io.to(roomId).emit("experience:state_updated", {
      phase: "revealed",
      moleId: state.moleId,
      moleName: state.clueNames[state.moleId ?? ""] ?? "The Mole",
      caught,
      crewWord: state.crewWord,
      moleWord: state.moleWord,
      scores: state.scores,
      votes: tally,
    });
  }

  private async _load(roomId: string): Promise<MindMoleState> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : { phase: "waiting", roundNumber: 0, totalRounds: 3, moleId: null, crewWord: null, moleWord: null, clues: {}, clueNames: {}, votes: {}, scores: {}, cluePhaseStart: null };
  }

  private async _save(roomId: string, state: MindMoleState): Promise<void> {
    await redisClient.set(KEY(roomId), JSON.stringify(state), { EX: 14400 });
  }
}
