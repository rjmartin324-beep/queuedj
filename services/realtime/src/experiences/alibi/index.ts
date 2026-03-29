import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";
import { shuffledIndices } from "../../lib/shuffle";

// ─────────────────────────────────────────────────────────────────────────────
// Alibi Experience
//
// Guests read a silly crime case with multiple suspects and their alibis.
// Everyone votes on who they think is guilty. Host reveals the answer.
// Correct guessers earn +400 points.
//
// Actions:
//   HOST:  start, ready_to_vote, reveal, next, end
//   GUEST: vote
// ─────────────────────────────────────────────────────────────────────────────

const KEY = (roomId: string) => `experience:alibi:${roomId}`;

interface Suspect {
  name: string;
  alibi: string;
}

interface CrimeCase {
  crime: string;
  suspects: Suspect[];
  guiltyIndex: number; // index into suspects[]
}

interface AlibiState {
  phase: "waiting" | "reading" | "voting" | "reveal" | "finished";
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
  currentCase: Omit<CrimeCase, "guiltyIndex"> | null; // guiltyIndex hidden during play
  votes: Record<string, number>; // guestId -> suspected index
  queue: number[];
}

const CASES: CrimeCase[] = [
  {
    crime: "Someone ate Gary's clearly-labelled office lunch from the communal fridge. The crime scene: one empty Tupperware container smelling of lasagne.",
    suspects: [
      {
        name: "Brenda from Accounts",
        alibi: "I was in a three-hour budget meeting. I have seventeen witnesses and a PowerPoint to prove it.",
      },
      {
        name: "Todd the Intern",
        alibi: "I don't even like lasagne. I'm more of a sad desk salad person.",
      },
      {
        name: "Deborah, Head of HR",
        alibi: "I was attending a workplace sensitivity training — ironically about stealing.",
      },
    ],
    guiltyIndex: 2,
  },
  {
    crime: "The office plant, Gerald, was found wilting dramatically next to the break room sink. He had been watered with what lab tests confirmed was cold brew coffee.",
    suspects: [
      {
        name: "Marcus, the Remote Worker",
        alibi: "I've been working from home for six months. I haven't been near Gerald since March.",
      },
      {
        name: "Stacey from Sales",
        alibi: "I love plants. I have forty-seven at home. Why would I hurt one?",
      },
      {
        name: "Kevin, IT Support",
        alibi: "I thought plants needed caffeine. They look tired. Was that wrong?",
      },
    ],
    guiltyIndex: 2,
  },
  {
    crime: "Someone changed the office Wi-Fi password to 'IHateMondays99' and did not tell anyone. The building was without internet for two hours.",
    suspects: [
      {
        name: "Linda the Office Manager",
        alibi: "I was giving a tour to new starters all morning. Ask any of the six confused graduates.",
      },
      {
        name: "Phil from Operations",
        alibi: "I only know one password and it's my dog's name. I can't be trusted with tech.",
      },
      {
        name: "Anya, Junior Developer",
        alibi: "I was trying to fix a memory leak. I needed peace and quiet.",
      },
    ],
    guiltyIndex: 2,
  },
  // ── added cases ──────────────────────────────────────────────────────────────
  {
    crime: "Someone released forty-seven balloons inside the office lift, rendering it unusable for the entire morning. HR received twelve complaints and one excited email.",
    suspects: [
      { name: "Priya from Events", alibi: "I was setting up the birthday decorations in Meeting Room B. I had a receipt for sixty-three balloons, none of which were near the lift." },
      { name: "Jake, the Facilities Manager", alibi: "I was on a call with the lift maintenance company. Ironically, about a different issue." },
      { name: "Chloe, Graphic Design", alibi: "I may have been slightly responsible but I want to point out that it was meant to be a surprise for someone on the ninth floor." },
    ],
    guiltyIndex: 2,
  },
  {
    crime: "Someone swapped all the decaf coffee in the break room with full-strength espresso. By 10am, eleven people were vibrating and two had filed incident reports.",
    suspects: [
      { name: "Ray from IT", alibi: "I don't even drink coffee. I survive on sparkling water and passive aggression." },
      { name: "Sandra, Head of Operations", alibi: "I was in back-to-back calls from 8am. The only thing I had time to do was suffer." },
      { name: "Tim, the Intern", alibi: "I thought it was the same thing. Is it not? They both come out of the machine." },
    ],
    guiltyIndex: 2,
  },
  {
    crime: "Someone moved every desk in the open plan office three inches to the left overnight. Nobody noticed for two hours, but then everyone noticed at once.",
    suspects: [
      { name: "Dave from Facilities", alibi: "I was on annual leave. I have seventeen photos of me at a beach. Would you like to see them?" },
      { name: "Natasha, Office Manager", alibi: "I have been trying to get approval for an office redesign for eight months. If I was going to do it, I'd do it properly." },
      { name: "Hamish, Night Security", alibi: "I noticed the cleaners seemed very energetic last night. I did not ask questions as that is not in my job description." },
    ],
    guiltyIndex: 2,
  },
  {
    crime: "Someone printed 400 copies of a photo of the CEO's face and placed one inside every single drawer in the building. IT has requested a mental health check for the printer.",
    suspects: [
      { name: "Yuki from Marketing", alibi: "I was preparing a campaign deck. I printed a lot of things, yes, but they were all slides." },
      { name: "Gordon, CEO's Personal Assistant", alibi: "I would never. I see that face enough during working hours." },
      { name: "The person who runs the Slack #random channel", alibi: "It was meant to be motivational. I regret nothing. I also regret everything." },
    ],
    guiltyIndex: 2,
  },
  {
    crime: "Someone signed the entire team up for a motivational 5am run without asking anyone. Twenty-three confirmation emails were sent. Twenty-three people were furious.",
    suspects: [
      { name: "Cheryl, Wellness Coordinator", alibi: "I support the idea in principle. However, I did not action it. I also did not attend." },
      { name: "Marcus, the New Manager", alibi: "I may have mentioned it as a concept in a team meeting and said 'wouldn't it be fun'. I did not expect anyone to do it." },
      { name: "Femi, Team Lead", alibi: "I signed everyone up. I stand by this. Mornings are wasted on sleeping." },
    ],
    guiltyIndex: 2,
  },
  {
    crime: "Someone changed the presentation slide template to Comic Sans across the entire company. An important pitch to investors went ahead before anyone noticed.",
    suspects: [
      { name: "Bart from Design", alibi: "I would rather quit. Comic Sans is a crime against humanity and I am being framed." },
      { name: "Linda, the IT Admin", alibi: "I was updating the software licences. The font files were untouched. I checked." },
      { name: "Steve from Sales", alibi: "I asked someone to 'make it pop' and I may have sent a screenshot of what I meant as a reference." },
    ],
    guiltyIndex: 2,
  },
  {
    crime: "Someone ordered a life-size cardboard cutout of the regional manager and placed it in the car park. Three people reversed into it. One person apologised to it.",
    suspects: [
      { name: "The Leaving Do Committee", alibi: "Our budget was used entirely on the cake. It was a very large cake." },
      { name: "Pete, who organised last year's Christmas party", alibi: "This is exactly the kind of thing I would do, so I understand the accusation. However, not this time." },
      { name: "Michelle from Brand", alibi: "I ordered it. It was meant to be inside. The delivery driver made a decision I did not authorise." },
    ],
    guiltyIndex: 2,
  },
  {
    crime: "Someone set the office smart speaker to play sea shanties at full volume every day at precisely 3pm. This has been happening for three weeks. Nobody stopped it.",
    suspects: [
      { name: "Callum from Tech", alibi: "I linked it to a playlist as a joke in January and genuinely forgot. I will fix it today." },
      { name: "Rosie, the Team Coordinator", alibi: "I enjoy the sea shanties. I was not going to stop it. I am sorry." },
      { name: "Both of the above", alibi: "They have agreed to split the blame and provide biscuits as restitution." },
    ],
    guiltyIndex: 0,
  },
  {
    crime: "Someone ate twelve of the fifteen birthday cupcakes before the birthday person arrived. The three remaining cupcakes were all lemon flavour, which the birthday person hates.",
    suspects: [
      { name: "Derek, who claims he was just 'testing for freshness'", alibi: "Quality control is important. I regret the scale of my involvement." },
      { name: "The 11am stand-up meeting attendees", alibi: "They were unattended. They were in a communal space. We drew our own conclusions." },
      { name: "None of us saw anything", alibi: "We are united in knowing nothing and we have agreed on this together." },
    ],
    guiltyIndex: 1,
  },
  {
    crime: "Someone booked the main meeting room for a recurring 'Strategy Session' every Monday to Friday, 9am–5pm. The room has been empty every day for six weeks.",
    suspects: [
      { name: "Ben from Product", alibi: "I booked it defensively so no one could use it for all-hands meetings. I may have overcommitted." },
      { name: "The automated calendar system", alibi: "The calendar system cannot speak. However, someone used it to do this." },
      { name: "Whoever named the recurring invite 'DO NOT DELETE'", alibi: "That person has not come forward and may never come forward." },
    ],
    guiltyIndex: 0,
  },
  {
    crime: "At the holiday party, someone switched the name tags so that nobody spoke to the right person for forty-five minutes. The CEO had a very good chat with himself, apparently.",
    suspects: [
      { name: "The events company hired to organise it", alibi: "We printed the tags. We did not rearrange them. We were carrying canapés." },
      { name: "Jamie, who is 'just here for the free food'", alibi: "I reorganised the tags alphabetically by first name. I thought I was being helpful." },
      { name: "The person in charge of the seating plan", alibi: "I panicked. There were forty people and a spreadsheet. I made a call and I stand by it." },
    ],
    guiltyIndex: 1,
  },
  {
    crime: "The house party's one bathroom was locked from the inside for ninety minutes. When it was finally opened, there was a fully assembled jigsaw puzzle on the floor.",
    suspects: [
      { name: "Greg, who brought 'a few bits' to the party", alibi: "The jigsaw was a party favour. I did not anticipate the logistics issue." },
      { name: "Whoever needed 'some quiet time'", alibi: "I am not naming myself but I would like the jigsaw back please." },
      { name: "The group who wanted to start an escape room business", alibi: "We were testing a concept. The bathroom seemed ideal at the time." },
    ],
    guiltyIndex: 1,
  },
  {
    crime: "Someone convinced thirty people at the house party to move all the furniture to the garage so there was 'more room to dance'. The host did not know. The host still does not know.",
    suspects: [
      { name: "DJ whoever plugged in the speaker", alibi: "I needed space for the subwoofer. One thing led to another." },
      { name: "The person who kept saying 'trust me'", alibi: "I had a vision. The couch was blocking the vision." },
      { name: "Everyone collectively", alibi: "It was a unanimous decision made quickly under peer pressure." },
    ],
    guiltyIndex: 2,
  },
  {
    crime: "Someone put a sign on the cruise ship captain's cabin door reading 'Karaoke Finals Tonight — All Welcome'. Three hundred passengers arrived. The captain was asleep.",
    suspects: [
      { name: "The entertainment coordinator", alibi: "I organised the karaoke but it was in the Lido Bar on Deck 9. Someone moved the sign." },
      { name: "Passenger in Cabin 14B", alibi: "I thought it was a real event. I have been practising 'My Way' for two days." },
      { name: "Whoever borrowed the sign-making kit from Guest Services", alibi: "I signed it out under a fake name. The name was 'Captain Fun.'" },
    ],
    guiltyIndex: 2,
  },
  {
    crime: "Someone on the cruise redirected the buffet cart to a crew-only area, and the midnight cheese selection was unavailable for the entire passenger floor.",
    suspects: [
      { name: "The night shift buffet attendant", alibi: "I was told to take it to that area by someone in a uniform. I did not confirm if the uniform was official." },
      { name: "Passenger who claimed to be 'with management'", alibi: "I wanted the brie to myself. I am not proud of this but I am not ashamed either." },
      { name: "The cheese itself", alibi: "Inanimate. Not capable of self-direction. Ruled out." },
    ],
    guiltyIndex: 1,
  },
  {
    crime: "Someone reset the thermostat on the cruise ship's pool deck to 14°C. Forty guests entered the water before anyone noticed. The hot tub remained unaffected and was very popular.",
    suspects: [
      { name: "A guest who 'prefers a brisk swim'", alibi: "I find cold water invigorating. I set it for myself and did not consider the group dynamic." },
      { name: "The junior maintenance technician", alibi: "I was told to 'turn it down a bit'. I interpreted that in good faith." },
      { name: "Whoever left the note saying 'COLD POOL DAY — HEALTH BENEFITS'", alibi: "I am a wellness enthusiast. The research supports cold immersion. I stand by this." },
    ],
    guiltyIndex: 0,
  },
  {
    crime: "Someone hid the TV remote in the flat so well that the group watched six hours of a property renovation show in a language none of them spoke.",
    suspects: [
      { name: "The person who 'just put it down somewhere'", alibi: "I put it down somewhere. I accept this. I cannot be more specific." },
      { name: "Whoever reorganised the cushions", alibi: "I fluffed every cushion. The remote may have been inside one. This was not intentional." },
      { name: "The dog", alibi: "The dog has previous. The dog is not available for comment." },
    ],
    guiltyIndex: 2,
  },
  {
    crime: "Someone organised a surprise birthday party for a person who hates surprises and had explicitly said so seven times. The birthday person arrived, said 'I knew it', and left.",
    suspects: [
      { name: "The best friend who 'knows them better than they know themselves'", alibi: "I truly believed this time would be different. I was wrong. This is noted." },
      { name: "The group chat that was definitely not subtle", alibi: "We used code names. The code name was 'The Birthday Surprise'. We tried." },
      { name: "Whoever sent a calendar invite titled 'DO NOT TELL [NAME]'", alibi: "I panicked when setting up the invite. I see how this was a mistake." },
    ],
    guiltyIndex: 0,
  },
  {
    crime: "Someone told the pizza delivery driver the wrong flat number, leading to seven floors of confused strangers opening their doors to find a very lost person holding six pizzas.",
    suspects: [
      { name: "Whoever ordered the pizza", alibi: "I entered the number correctly. The app auto-corrected it. I believe apps should be tried for crimes." },
      { name: "The person who 'double-checked the address'", alibi: "I read it back wrong. The numbers were in the wrong order in my head." },
      { name: "The flat number itself", alibi: "Floor 4, Flat 7 and Floor 7, Flat 4 are genuinely confusing. This is a building design failure." },
    ],
    guiltyIndex: 1,
  },
  {
    crime: "Someone at the barbecue marked all the veggie burgers with a toothpick to tell them apart, then used the toothpicks for the regular burgers too. Nobody is sure what they ate.",
    suspects: [
      { name: "The self-appointed grill master", alibi: "I ran out of toothpicks halfway through. I improvised. I regret the system I chose." },
      { name: "Whoever bought identical-looking patties", alibi: "They were clearly labelled in the packet. Once on the grill, all bets were off." },
      { name: "The guest who 'didn't think it mattered'", alibi: "I thought they were all the same product from different brands. I was mistaken and I now understand this was important." },
    ],
    guiltyIndex: 0,
  },
  {
    crime: "The group holiday house had a kitty jar for shared expenses. By day three, the jar was empty. Nobody bought anything on day three. Nobody bought anything on day two either.",
    suspects: [
      { name: "The person who 'made change' on day one", alibi: "I put in a twenty and took out what I needed. Several times. For convenience." },
      { name: "Whoever counted the original total wrong", alibi: "Maths is hard when you are on holiday. I accept partial responsibility." },
      { name: "The concept of a kitty jar in general", alibi: "The kitty jar has a zero percent success rate across recorded history. We should have used Splitwise." },
    ],
    guiltyIndex: 0,
  },
  {
    crime: "Someone brought their acoustic guitar on the camping trip and played it from 11pm until 2am. Three tents complained formally. One tent gave a tip.",
    suspects: [
      { name: "The person who brought the guitar", alibi: "I was asked to play by several people. One person. I was asked by one person. Who was me." },
      { name: "The person who said 'yeah go on then' when asked", alibi: "I was being polite. I did not expect three hours of original compositions." },
      { name: "The tent that gave the tip", alibi: "We stand by our enjoyment of the performance and refuse to apologise." },
    ],
    guiltyIndex: 0,
  },
  {
    crime: "Someone RSVP'd 'yes' to a friend's housewarming on behalf of four people without asking those four people. All four had other plans. One was abroad.",
    suspects: [
      { name: "The self-appointed organiser of the group's social calendar", alibi: "I always RSVP for the group. Historically they come. This time was different." },
      { name: "Whoever said 'put us down' in a voice message two weeks ago", alibi: "I said it conversationally. It was not a formal delegation of RSVP authority." },
      { name: "The person who was abroad", alibi: "I was in Portugal. I was not consulted. I remain in Portugal spiritually." },
    ],
    guiltyIndex: 0,
  },
  {
    crime: "Someone sent a complaint email about noise from the flat above to the entire building's mailing list instead of just the landlord. The flat above has read it. The flat above has replied.",
    suspects: [
      { name: "The resident of Flat 6", alibi: "I selected 'All Residents' from the dropdown. I was not wearing my glasses and the options were very similar." },
      { name: "Whoever designed the mailing list with that layout", alibi: "Inanimate and not a legal entity, but this does feel like a shared failure." },
      { name: "The flat above, who replies to every email regardless", alibi: "I saw my name mentioned and felt it was appropriate to respond in full." },
    ],
    guiltyIndex: 0,
  },
];

export class AlibiExperience implements ExperienceModule {
  readonly type = "alibi" as const;

  async onActivate(roomId: string, _hostGuestId: string): Promise<void> {
    const state: AlibiState = {
      phase: "waiting",
      round: 0,
      totalRounds: 3,
      scores: {},
      currentCase: null,
      votes: {},
      queue: shuffledIndices(CASES.length),
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

      case "ready_to_vote":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._readyToVote(roomId, io);
        break;

      case "vote":
        await this._vote(roomId, guestId, p.suspectIndex, io);
        break;

      case "reveal":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._reveal(roomId, io);
        break;

      case "next":
        if (role !== "HOST" && role !== "CO_HOST") return;
        await this._next(roomId, io);
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
    return { type: "alibi" as any, data: this._safeState(state) };
  }

  async getBootstrapState(roomId: string): Promise<unknown> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private async _start(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;

    state.queue = shuffledIndices(CASES.length);
    const caseData = CASES[state.queue[0]];
    state.round = 1;
    state.votes = {};
    state.currentCase = { crime: caseData.crime, suspects: caseData.suspects };
    state.phase = "reading";

    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  private async _readyToVote(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || state.phase !== "reading") return;

    state.votes = {};
    state.phase = "voting";

    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  private async _vote(roomId: string, guestId: string, suspectIndex: number, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || state.phase !== "voting") return;
    if (state.votes[guestId] !== undefined) return; // Already voted
    if (!state.currentCase) return;
    if (typeof suspectIndex !== "number" || suspectIndex < 0 || suspectIndex >= state.currentCase.suspects.length) return;

    state.votes[guestId] = suspectIndex;
    await this._save(roomId, state);
    // No broadcast — revealed at reveal phase
  }

  private async _reveal(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || state.phase !== "voting") return;

    const caseIndex = state.queue[(state.round - 1) % state.queue.length];
    const guiltyIndex = CASES[caseIndex]?.guiltyIndex ?? 0;

    for (const [gId, votedIndex] of Object.entries(state.votes)) {
      if (votedIndex === guiltyIndex) {
        state.scores[gId] = (state.scores[gId] ?? 0) + 400;
      }
    }

    state.phase = "reveal";
    await this._save(roomId, state);

    // Broadcast with guilty index revealed
    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "alibi",
      state: { ...state, guiltyIndex },
      view: { type: "alibi" as any, data: { ...state, guiltyIndex } },
      sequenceId: seq,
    });
  }

  private async _next(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;

    const nextRound = state.round + 1;
    if (nextRound > state.totalRounds || nextRound > CASES.length) {
      state.phase = "finished";
      state.currentCase = null;
      await this._save(roomId, state);
      await this._broadcast(roomId, state, io);
      return;
    }

    const caseData = CASES[state.queue[(nextRound - 1) % state.queue.length]];
    state.round = nextRound;
    state.votes = {};
    state.currentCase = { crime: caseData.crime, suspects: caseData.suspects };
    state.phase = "reading";

    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  /** Hide votes during non-reveal phases */
  private _safeState(state: AlibiState): unknown {
    if (state.phase === "voting") {
      const { votes, ...rest } = state;
      return { ...rest, voteCount: Object.keys(votes).length };
    }
    return state;
  }

  private async _broadcast(roomId: string, state: AlibiState, io: Server): Promise<void> {
    const seq = await getNextSequenceId(roomId);
    const safe = this._safeState(state);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "alibi",
      state: safe,
      view: { type: "alibi" as any, data: safe },
      sequenceId: seq,
    });
  }

  private async _load(roomId: string): Promise<AlibiState | null> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }

  private async _save(roomId: string, state: AlibiState): Promise<void> {
    await redisClient.set(KEY(roomId), JSON.stringify(state));
  }
}