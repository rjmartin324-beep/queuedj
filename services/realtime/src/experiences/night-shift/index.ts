import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";

// ─────────────────────────────────────────────────────────────────────────────
// NightShift Experience — Social Deduction Murder Mystery
//
// Secret roles: Killer, Detective, Oracle, Janitor, Spy, Witness
// Each round: host presents evidence → players use powers → accusations → verdict
// ─────────────────────────────────────────────────────────────────────────────

const KEY = (roomId: string) => `experience:night_shift:${roomId}`;

const ROLES = ["Killer", "Detective", "Oracle", "Janitor", "Spy", "Witness"] as const;
type NightShiftRole = typeof ROLES[number];

const ROLE_DESCRIPTIONS: Record<NightShiftRole, string> = {
  Killer:   "You committed the crime. Plant false evidence to avoid accusation.",
  Detective:"You get one free accusation reversal per game.",
  Oracle:   "Before accusations open, peek at one piece of evidence and see if it's genuine or planted.",
  Janitor:  "You can erase one piece of evidence per round — permanently.",
  Spy:      "You can plant one false clue each round.",
  Witness:  "You saw something. Your testimony carries extra weight in the verdict.",
};

const CASES = [
  {
    title: "The Missing Diamond at Hargrove Manor",
    scenario: "At 11:47pm the Hargrove Diamond vanished from the locked study. Six guests were on the premises. The butler discovered the empty case at midnight.",
    evidence: [
      { id: "e1", text: "A monogrammed handkerchief found near the safe — initials M.V.", realOrPlanted: "real" },
      { id: "e2", text: "Footprints in the garden leading away from the east wing.", realOrPlanted: "real" },
      { id: "e3", text: "A torn page from the guest ledger.", realOrPlanted: "real" },
      { id: "e4", text: "Witness claims they saw the housekeeper near the study at 11:30pm.", realOrPlanted: "planted" },
    ],
    suspects: [
      { id: "s1", name: "Marcus Vale",   role: "Guest", alibi: "I was in the drawing room all evening." },
      { id: "s2", name: "Elena Marsh",   role: "Housekeeper", alibi: "Someone is lying about where I was." },
      { id: "s3", name: "Dr. Ashworth",  role: "Physician", alibi: "I have three witnesses." },
      { id: "s4", name: "Lady Fontaine", role: "Host", alibi: "I retired at 11pm — check with my maid." },
    ],
    killer: "s1",
  },
  {
    title: "Poisoned at the Gala",
    scenario: "A renowned art dealer collapsed at the charity gala. Paramedics confirmed poison. Seven guests had access to his drink.",
    evidence: [
      { id: "e1", text: "An empty vial found behind the bar — no fingerprints.", realOrPlanted: "real" },
      { id: "e2", text: "Security footage shows someone near his drink at 9:12pm.", realOrPlanted: "real" },
      { id: "e3", text: "Anonymous tip naming a rival collector.", realOrPlanted: "planted" },
      { id: "e4", text: "The victim had written a new will earlier that day.", realOrPlanted: "real" },
    ],
    suspects: [
      { id: "s1", name: "Victor Crane",   role: "Rival Collector", alibi: "I was at the auction table the entire night." },
      { id: "s2", name: "Sophia Delacroix", role: "Niece", alibi: "I loved my uncle. This is absurd." },
      { id: "s3", name: "Roland Pierce",  role: "Bartender", alibi: "I served hundreds of guests." },
      { id: "s4", name: "Iris Vance",     role: "Gallery Owner", alibi: "We had a business dispute but nothing more." },
    ],
    killer: "s2",
  },
];

interface EvidenceItem { id: string; text: string; realOrPlanted: "real" | "planted"; erased?: boolean; }
interface Suspect { id: string; name: string; role: string; alibi: string; }

interface NightShiftState {
  phase: "waiting" | "role_reveal" | "scene" | "accuse" | "verdict";
  caseIndex: number;
  playerRoles: Record<string, NightShiftRole>;  // guestId → role
  playerNames: Record<string, string>;
  evidence: EvidenceItem[];
  suspectList: Suspect[];
  killerSuspectId: string;
  accusations: Record<string, string>;   // guestId → suspectId
  oracleReveals: Record<string, string>; // guestId → evidenceId they peeked
  erasedEvidence: string[];              // evidenceIds erased by Janitor
  plantedEvidence: string[];             // evidenceIds planted by Spy
  scores: Record<string, number>;
  verdictSuspectId: string | null;
  round: number;
}

export class NightShiftExperience implements ExperienceModule {
  readonly type = "night_shift" as const;

  async onActivate(roomId: string): Promise<void> {
    const state: NightShiftState = {
      phase: "waiting",
      caseIndex: Math.floor(Math.random() * CASES.length),
      playerRoles: {},
      playerNames: {},
      evidence: [],
      suspectList: [],
      killerSuspectId: "",
      accusations: {},
      oracleReveals: {},
      erasedEvidence: [],
      plantedEvidence: [],
      scores: {},
      verdictSuspectId: null,
      round: 0,
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
      case "assign_roles":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._assignRoles(roomId, p.playerIds, p.playerNames, io);
        break;

      case "open_scene":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._openScene(roomId, io);
        break;

      case "oracle_peek":
        await this._oraclePeek(roomId, guestId, p.evidenceId, io);
        break;

      case "janitor_erase":
        await this._janitorErase(roomId, guestId, p.evidenceId, io);
        break;

      case "spy_plant":
        await this._spyPlant(roomId, guestId, p.evidenceText, io);
        break;

      case "open_accusations":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._openAccusations(roomId, io);
        break;

      case "accuse":
        await this._accuse(roomId, guestId, p.suspectId, io);
        break;

      case "reveal_verdict":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._revealVerdict(roomId, io);
        break;
    }
  }

  async getGuestViewDescriptor(roomId: string): Promise<GuestViewDescriptor> {
    const state = await this._load(roomId);
    return {
      view: `night_shift_${state.phase}`,
      data: {
        phase: state.phase,
        evidence: state.evidence.filter(e => !state.erasedEvidence.includes(e.id)).map(e => ({
          id: e.id,
          text: e.text,
          tag: state.plantedEvidence.includes(e.id) ? "unverified" : "unverified", // truth hidden from guests
          erased: state.erasedEvidence.includes(e.id),
        })),
        suspectList: state.suspectList,
        accusations: Object.keys(state.accusations).length,
        verdictSuspectId: state.verdictSuspectId,
      },
    };
  }

  private async _assignRoles(roomId: string, playerIds: string[], playerNames: Record<string, string>, io: Server): Promise<void> {
    const state = await this._load(roomId);
    const cas = CASES[state.caseIndex];
    state.evidence = cas.evidence.map(e => ({ ...e }));
    state.suspectList = cas.suspects;
    state.killerSuspectId = cas.killer;
    state.playerNames = playerNames;
    state.phase = "role_reveal";

    // Shuffle roles
    const shuffledRoles = [...ROLES].sort(() => Math.random() - 0.5);
    playerIds.forEach((pid, i) => {
      state.playerRoles[pid] = shuffledRoles[i % shuffledRoles.length];
    });

    await this._save(roomId, state);

    // Send private role to each player
    for (const pid of playerIds) {
      const playerRole = state.playerRoles[pid];
      io.to(pid).emit("night_shift:your_role", {
        role: playerRole,
        description: ROLE_DESCRIPTIONS[playerRole],
        isKiller: playerRole === "Killer",
        killerSuspectId: playerRole === "Killer" ? state.killerSuspectId : null,
      });
    }

    io.to(roomId).emit("experience:state_updated", { phase: "role_reveal", playerCount: playerIds.length });
  }

  private async _openScene(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    const cas = CASES[state.caseIndex];
    state.phase = "scene";
    await this._save(roomId, state);
    io.to(roomId).emit("experience:state_updated", {
      phase: "scene",
      caseTitle: cas.title,
      scenario: cas.scenario,
      evidence: state.evidence.filter(e => !state.erasedEvidence.includes(e.id)).map(e => ({
        id: e.id, text: e.text, tag: "unverified",
      })),
      suspectList: state.suspectList,
    });
  }

  private async _oraclePeek(roomId: string, guestId: string, evidenceId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (state.playerRoles[guestId] !== "Oracle") return;
    if (state.oracleReveals[guestId]) return; // already used
    const ev = state.evidence.find(e => e.id === evidenceId);
    if (!ev) return;
    state.oracleReveals[guestId] = evidenceId;
    await this._save(roomId, state);
    // Private reveal to oracle only
    io.to(guestId).emit("night_shift:oracle_reveal", {
      evidenceId,
      evidenceText: ev.text,
      isPlanted: ev.realOrPlanted === "planted",
    });
  }

  private async _janitorErase(roomId: string, guestId: string, evidenceId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (state.playerRoles[guestId] !== "Janitor") return;
    if (state.erasedEvidence.length >= state.round + 1) return;
    state.erasedEvidence.push(evidenceId);
    await this._save(roomId, state);
    io.to(roomId).emit("night_shift:evidence_erased", { evidenceId });
  }

  private async _spyPlant(roomId: string, guestId: string, evidenceText: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (state.playerRoles[guestId] !== "Spy") return;
    const newId = `planted_${Date.now()}`;
    state.evidence.push({ id: newId, text: evidenceText, realOrPlanted: "planted" });
    state.plantedEvidence.push(newId);
    await this._save(roomId, state);
    io.to(roomId).emit("night_shift:evidence_added", { id: newId, text: evidenceText, tag: "unverified" });
  }

  private async _openAccusations(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    state.phase = "accuse";
    await this._save(roomId, state);
    io.to(roomId).emit("experience:state_updated", { phase: "accuse", suspectList: state.suspectList });
  }

  private async _accuse(roomId: string, guestId: string, suspectId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (state.phase !== "accuse") return;
    state.accusations[guestId] = suspectId;
    await this._save(roomId, state);
    io.to(roomId).emit("night_shift:accusation_count", { count: Object.keys(state.accusations).length });
  }

  private async _revealVerdict(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    // Tally accusations
    const tally: Record<string, number> = {};
    for (const sid of Object.values(state.accusations)) tally[sid] = (tally[sid] ?? 0) + 1;
    const verdict = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const correct = verdict === state.killerSuspectId;

    // Score
    for (const [gid, sid] of Object.entries(state.accusations)) {
      if (sid === state.killerSuspectId) {
        const pts = state.playerRoles[gid] === "Oracle" ? 450 : state.playerRoles[gid] === "Detective" ? 300 : 200;
        state.scores[gid] = (state.scores[gid] ?? 0) + pts;
      }
    }
    // Killer survives → bonus
    if (!correct) {
      for (const [gid, r] of Object.entries(state.playerRoles)) {
        if (r === "Killer") state.scores[gid] = (state.scores[gid] ?? 0) + 500;
      }
    }

    state.verdictSuspectId = verdict;
    state.phase = "verdict";
    await this._save(roomId, state);

    const killerSuspect = state.suspectList.find(s => s.id === state.killerSuspectId);
    io.to(roomId).emit("experience:state_updated", {
      phase: "verdict",
      verdictSuspectId: verdict,
      killerSuspectId: state.killerSuspectId,
      killerName: killerSuspect?.name ?? "Unknown",
      correct,
      scores: state.scores,
      playerRoles: state.playerRoles,
      playerNames: state.playerNames,
      evidence: state.evidence.map(e => ({ ...e, tag: e.realOrPlanted === "planted" ? "planted" : "real" })),
    });
  }

  private async _load(roomId: string): Promise<NightShiftState> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : { phase: "waiting", caseIndex: 0, playerRoles: {}, playerNames: {}, evidence: [], suspectList: [], killerSuspectId: "", accusations: {}, oracleReveals: {}, erasedEvidence: [], plantedEvidence: [], scores: {}, verdictSuspectId: null, round: 0 };
  }

  private async _save(roomId: string, state: NightShiftState): Promise<void> {
    await redisClient.set(KEY(roomId), JSON.stringify(state), { EX: 14400 });
  }
}
