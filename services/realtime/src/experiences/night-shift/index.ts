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
  // ── Office Settings ────────────────────────────────────────────────────────
  {
    title: "The Deleted Files Incident",
    scenario: "On Monday morning the Mercer Group discovered three years of client data had been wiped from the server at 11:59pm Friday. The IT logs show only internal access. Five employees had after-hours badges.",
    evidence: [
      { id: "e1", text: "Badge swipe records show one employee entered the server room at 11:41pm.", realOrPlanted: "real" },
      { id: "e2", text: "A resignation letter dated the same Friday, never submitted.", realOrPlanted: "real" },
      { id: "e3", text: "CCTV of the corridor is missing — hard drive 'malfunctioned'.", realOrPlanted: "real" },
      { id: "e4", text: "Anonymous email accusing the new hire of selling data to a competitor.", realOrPlanted: "planted" },
    ],
    suspects: [
      { id: "s1", name: "Priya Nair",      role: "Systems Admin", alibi: "I was remote all weekend — check my VPN logs." },
      { id: "s2", name: "Tom Caldwell",    role: "Account Manager", alibi: "I came in to finish a deck, nothing else." },
      { id: "s3", name: "Dana Westfield",  role: "New Hire", alibi: "I don't even have server access yet." },
      { id: "s4", name: "Greg Farrell",    role: "Director of Ops", alibi: "I was at my daughter's recital — I have photos." },
    ],
    killer: "s2",
  },
  {
    title: "The Missing Bonus",
    scenario: "The quarterly bonus payroll ran — but one employee's payment of £18,000 was redirected to an unknown account at 6:04am. The transfer was authorised internally.",
    evidence: [
      { id: "e1", text: "Login to the payroll system from an unfamiliar IP address.", realOrPlanted: "real" },
      { id: "e2", text: "A sticky note with partial account numbers found on the victim's desk.", realOrPlanted: "real" },
      { id: "e3", text: "HR record shows a workplace grievance filed two weeks prior.", realOrPlanted: "real" },
      { id: "e4", text: "Rumour that the CFO has gambling debts — source unverified.", realOrPlanted: "planted" },
    ],
    suspects: [
      { id: "s1", name: "Claire Monroe",   role: "Payroll Administrator", alibi: "I processed everything correctly — someone changed it after." },
      { id: "s2", name: "James Okonkwo",   role: "CFO", alibi: "I was in Tokyo at 6am London time." },
      { id: "s3", name: "Sophie Reeves",   role: "Disgruntled Employee", alibi: "Yes I filed a grievance. That doesn't make me a thief." },
      { id: "s4", name: "Nick Halstead",   role: "IT Contractor", alibi: "My contract ended last Thursday." },
    ],
    killer: "s3",
  },
  {
    title: "The Conference Room Leak",
    scenario: "A confidential pitch deck appeared on a competitor's website the day before the board presentation. Someone in the pre-meeting briefing of five people leaked it.",
    evidence: [
      { id: "e1", text: "The deck was accessed from a personal Dropbox account, not the company drive.", realOrPlanted: "real" },
      { id: "e2", text: "One attendee had a competing interview scheduled for the following week.", realOrPlanted: "real" },
      { id: "e3", text: "Print logs show someone printed the deck after-hours the previous night.", realOrPlanted: "real" },
      { id: "e4", text: "An intern overheard a phone call — but admits they misheard some of it.", realOrPlanted: "planted" },
    ],
    suspects: [
      { id: "s1", name: "Aaron Park",      role: "Strategist", alibi: "I use Dropbox for everything — it's habit, not malice." },
      { id: "s2", name: "Kezia Martin",    role: "Brand Lead", alibi: "I had a personal project in that folder, not the deck." },
      { id: "s3", name: "Rob Tennant",     role: "Sales Director", alibi: "I'm the one who built the deck — why would I leak it?" },
      { id: "s4", name: "Yasmin Cole",     role: "Analyst", alibi: "I printed it to annotate it before the meeting. That's it." },
    ],
    killer: "s4",
  },
  // ── Cruise Ship Settings ───────────────────────────────────────────────────
  {
    title: "Man Overboard on the Aurora Princess",
    scenario: "At 2:17am on night three of the seven-night cruise, passenger Bernard Lowe was reported missing. A witness on Deck 9 heard a splash. His cabin was found unlocked.",
    evidence: [
      { id: "e1", text: "Bernard's keycard was used to access the stern observation deck at 2:09am.", realOrPlanted: "real" },
      { id: "e2", text: "A torn cufflink found on the railing matches the style worn by another passenger.", realOrPlanted: "real" },
      { id: "e3", text: "CCTV footage of Deck 9 was corrupted — crew says it happens in salt air.", realOrPlanted: "real" },
      { id: "e4", text: "A printed note in Bernard's cabin reads 'I know what you did in Naples'.", realOrPlanted: "planted" },
    ],
    suspects: [
      { id: "s1", name: "Harriet Lowe",    role: "Wife", alibi: "I was in bed with the door chained. Ask the steward." },
      { id: "s2", name: "Declan Foley",    role: "Business Partner", alibi: "We argued at dinner but I went to the casino after." },
      { id: "s3", name: "Margaux Serre",   role: "Fellow Passenger", alibi: "I've only spoken to him once the whole voyage." },
      { id: "s4", name: "Captain's Aide",  role: "Crew", alibi: "I was doing rounds — signed log will confirm." },
    ],
    killer: "s1",
  },
  {
    title: "The Stolen Jewel Box",
    scenario: "On the final morning of the Adriatic cruise, Lady Pemberton's emerald collection vanished from the ship's safe. Only five people knew the combination.",
    evidence: [
      { id: "e1", text: "Safe access logs show it was opened at 4:22am — an hour before sunrise.", realOrPlanted: "real" },
      { id: "e2", text: "A ship steward found a false bottom in a passenger's luggage during routine checks.", realOrPlanted: "real" },
      { id: "e3", text: "Lady Pemberton mentioned the collection at the Captain's Table dinner — four guests heard.", realOrPlanted: "real" },
      { id: "e4", text: "Passenger rumoured to have previous insurance fraud conviction — source unverified.", realOrPlanted: "planted" },
    ],
    suspects: [
      { id: "s1", name: "Felix Strand",    role: "Retired Banker", alibi: "I don't even know where the ship's safe is." },
      { id: "s2", name: "Anya Petrova",    role: "Jewellery Appraiser", alibi: "I appraised the collection — that's not a motive." },
      { id: "s3", name: "Cruise Director", role: "Crew", alibi: "I had the combination for legitimate access only." },
      { id: "s4", name: "Oliver Nash",     role: "Art Dealer", alibi: "I was seasick all night. The ship doctor saw me." },
    ],
    killer: "s2",
  },
  {
    title: "Death at the Masquerade Dinner",
    scenario: "The masked gala on Deck 7 ended when a passenger was found unconscious — later confirmed poisoned — behind the dessert table. Masks made identification during the event nearly impossible.",
    evidence: [
      { id: "e1", text: "A cocktail glass with an unusual residue found at the victim's table.", realOrPlanted: "real" },
      { id: "e2", text: "One guest changed their outfit mid-event — cabin steward confirmed.", realOrPlanted: "real" },
      { id: "e3", text: "The victim received an anonymous envelope earlier that day with a single question mark inside.", realOrPlanted: "real" },
      { id: "e4", text: "Bartender claims they saw two guests arguing near the bar but can't be sure due to masks.", realOrPlanted: "planted" },
    ],
    suspects: [
      { id: "s1", name: "Camille DuBois",  role: "Former Colleague", alibi: "I barely knew them — we worked together years ago." },
      { id: "s2", name: "Henrik Voss",     role: "Pharmaceutical Rep", alibi: "I don't carry medication that could cause this." },
      { id: "s3", name: "Tara Fontaine",   role: "Event Planner", alibi: "I organised the evening — I was everywhere at once." },
      { id: "s4", name: "Ravi Chopra",     role: "Ship's Doctor", alibi: "I was the one who raised the alarm." },
    ],
    killer: "s2",
  },
  // ── House Party Settings ───────────────────────────────────────────────────
  {
    title: "The Missing Watch",
    scenario: "Sometime during Marcus's house party, his grandfather's vintage Rolex disappeared from the bedroom nightstand. Eight guests had access to the upstairs floor during the evening.",
    evidence: [
      { id: "e1", text: "A guest was seen heading upstairs twice within an hour.", realOrPlanted: "real" },
      { id: "e2", text: "A pawn shop receipt for a similar watch was found in a jacket pocket.", realOrPlanted: "real" },
      { id: "e3", text: "The bedroom window was left open — could someone have slipped in from outside?", realOrPlanted: "real" },
      { id: "e4", text: "One guest claims they heard someone say 'keep it quiet' in the corridor.", realOrPlanted: "planted" },
    ],
    suspects: [
      { id: "s1", name: "Jamie Cross",     role: "Uni Friend", alibi: "I went upstairs to use the bathroom — that's it." },
      { id: "s2", name: "Lexi Rhodes",     role: "Work Colleague", alibi: "I didn't even know there was a watch up there." },
      { id: "s3", name: "Dan Morrow",      role: "Flatmate's Friend", alibi: "I've got a receipt but it's for my own watch — check the date." },
      { id: "s4", name: "Chloe Park",      role: "Ex-girlfriend", alibi: "I wasn't going anywhere near that bedroom." },
    ],
    killer: "s3",
  },
  {
    title: "The Screenshot That Wasn't Meant to Be Seen",
    scenario: "A private group chat screenshot containing embarrassing messages about the host surfaced during the party — screenshotted and sent to everyone in the room. Someone with access leaked it live.",
    evidence: [
      { id: "e1", text: "The screenshot was sent from a number not saved in most contacts.", realOrPlanted: "real" },
      { id: "e2", text: "Only four people were in the original group chat.", realOrPlanted: "real" },
      { id: "e3", text: "One guest was visibly checking their phone moments before the message arrived.", realOrPlanted: "real" },
      { id: "e4", text: "Someone claims they saw a guest forwarding messages in the kitchen.", realOrPlanted: "planted" },
    ],
    suspects: [
      { id: "s1", name: "Jade Osei",       role: "Best Friend", alibi: "Why would I do this — she's my best mate." },
      { id: "s2", name: "Ryan Fletcher",   role: "Mutual Friend", alibi: "I'm not even in that chat." },
      { id: "s3", name: "Emma Slade",      role: "Work Friend", alibi: "I only forwarded a meme earlier — nothing like this." },
      { id: "s4", name: "Patrick Burns",   role: "New Boyfriend", alibi: "I don't even know half the people in that group." },
    ],
    killer: "s1",
  },
  {
    title: "The Vanishing Birthday Fund",
    scenario: "A group of friends collected £240 in cash to cover a joint birthday tab. By the end of the night the envelope was empty. Nobody saw it go.",
    evidence: [
      { id: "e1", text: "The envelope was last seen in the kitchen at 10:30pm.", realOrPlanted: "real" },
      { id: "e2", text: "One guest paid their Uber home in cash despite claiming to be broke.", realOrPlanted: "real" },
      { id: "e3", text: "Text message found: 'sort me out and I won't say anything'.", realOrPlanted: "real" },
      { id: "e4", text: "Bartender at the next venue remembers someone with an unusually thick wallet.", realOrPlanted: "planted" },
    ],
    suspects: [
      { id: "s1", name: "Theo King",       role: "Organiser's Flatmate", alibi: "I collected the money, yes, but I put it in the envelope." },
      { id: "s2", name: "Sienna Walsh",    role: "Work Colleague", alibi: "I literally Venmo'd my share — I never touched cash." },
      { id: "s3", name: "Lewis Adebayo",   role: "Uni Friend", alibi: "I went home early — long before it went missing." },
      { id: "s4", name: "Mia Torres",      role: "Plus-one",  alibi: "I don't even know these people that well." },
    ],
    killer: "s1",
  },
  {
    title: "The Leaked Address",
    scenario: "The house party was meant to be 20 people max. By midnight there were 80. Someone gave out the address publicly. The host's neighbours have called the police twice.",
    evidence: [
      { id: "e1", text: "A public Instagram story tagged the street name at 9:14pm.", realOrPlanted: "real" },
      { id: "e2", text: "The invite was only shared in a group chat of six people.", realOrPlanted: "real" },
      { id: "e3", text: "One guest is known for over-inviting at previous events.", realOrPlanted: "real" },
      { id: "e4", text: "A gatecrash group on Facebook had the full address posted anonymously two hours before.", realOrPlanted: "planted" },
    ],
    suspects: [
      { id: "s1", name: "Dani Ford",       role: "Social Butterfly", alibi: "I only told three people — and they're all here." },
      { id: "s2", name: "Connor Blaine",   role: "Flatmate", alibi: "Why would I ruin my own flatmate's party?" },
      { id: "s3", name: "Priya Sethi",     role: "University Friend", alibi: "I don't even have Instagram." },
      { id: "s4", name: "Josh Whitmore",   role: "Boyfriend's Friend", alibi: "I just came along — I didn't even know where I was going." },
    ],
    killer: "s1",
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

  async getBootstrapState(roomId: string): Promise<unknown> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
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

    // Send private role to each player (guests join `guest:<guestId>` room)
    for (const pid of playerIds) {
      const playerRole = state.playerRoles[pid];
      io.to(`guest:${pid}`).emit("night_shift:your_role", {
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