import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";
import { shuffledIndices } from "../../lib/shuffle";

// ─────────────────────────────────────────────────────────────────────────────
// Never Have I Ever Experience
//
// Each round reveals a prompt. Guests tap "I have" or "I never have".
// "Never" responses get +100 pts (staying pure). "Have" responses are
// shamefully displayed to the room.
//
// Actions:
//   HOST:  start, reveal, next, end
//   GUEST: respond
// ─────────────────────────────────────────────────────────────────────────────

const PROMPTS: string[] = [
  "Never have I ever fallen asleep at a party",
  "Never have I ever pretended to know a song and sang the wrong lyrics",
  "Never have I ever lied about my age",
  "Never have I ever stayed up until sunrise just to keep the party going",
  "Never have I ever called the wrong person by the wrong name on a date",
  "Never have I ever cheated at a board game",
  "Never have I ever eaten an entire pizza by myself",
  "Never have I ever sent a text to the wrong person",
  "Never have I ever danced on a table",
  "Never have I ever crashed a party I wasn't invited to",
  // ── Added prompts to reach 60 total ────────────────────────────────────────
  "Never have I ever ghosted someone and then ran into them in public",
  "Never have I ever drunk-texted my ex",
  "Never have I ever cried at a commercial",
  "Never have I ever faked being sick to skip work or school",
  "Never have I ever eaten food that fell on the floor and said nothing",
  "Never have I ever stalked someone's Instagram all the way back to 2012",
  "Never have I ever pretended not to see someone I know in public",
  "Never have I ever taken a selfie in a bathroom at a party",
  "Never have I ever lied about having seen a movie everyone was talking about",
  "Never have I ever used someone else's Netflix password",
  "Never have I ever ordered food and eaten it before getting home",
  "Never have I ever fallen asleep during a movie at the cinema",
  "Never have I ever re-gifted a present I received",
  "Never have I ever accidentally liked someone's old post while stalking their profile",
  "Never have I ever had a full conversation while sleepwalking",
  "Never have I ever spent more than $100 on a single meal",
  "Never have I ever lied on my resume or job application",
  "Never have I ever bought something expensive and hidden it from my partner",
  "Never have I ever sung in the shower and pretended I was performing at a concert",
  "Never have I ever binge-watched an entire season in one sitting",
  "Never have I ever argued with a stranger on the internet",
  "Never have I ever missed a flight",
  "Never have I ever cried on a plane",
  "Never have I ever been kicked out of a place",
  "Never have I ever tried to impress someone by pretending to like their favourite band",
  "Never have I ever cheated on a test",
  "Never have I ever driven through a red light on purpose",
  "Never have I ever pretended my phone was ringing to escape an awkward situation",
  "Never have I ever read someone else's diary or private messages",
  "Never have I ever worn the same outfit two days in a row and pretended I changed",
  "Never have I ever taken food from a coworker's lunch in the fridge",
  "Never have I ever cried in a public restroom",
  "Never have I ever set an alarm and turned it off in my sleep without waking up",
  "Never have I ever broken something in someone's house and not told them",
  "Never have I ever pretended to understand an accent and nodded along",
  "Never have I ever made a wish at 11:11",
  "Never have I ever gone on a trip solo",
  "Never have I ever deleted a social media post because it got no likes",
  "Never have I ever said 'I'll call you back' and never called back",
  "Never have I ever ordered something online and returned it after wearing it once",
  "Never have I ever walked into a glass door",
  "Never have I ever eavesdropped on a conversation at a restaurant",
  "Never have I ever bought something just because a celebrity endorsed it",
  "Never have I ever mispronounced a word in front of a crowd and played it off",
  "Never have I ever fallen asleep on public transportation and missed my stop",
  "Never have I ever pretended to be busy when someone texted me",
  "Never have I ever skipped a wedding or big event for a flimsy excuse",
  "Never have I ever laughed so hard I cried in an inappropriate situation",
  "Never have I ever asked Siri or Alexa something deeply personal",
  "Never have I ever panic-cleaned my home when guests said they were coming over",
  // ── Added to reach 200 ────────────────────────────────────────────────────
  "Never have I ever left a voicemail when I could have texted",
  "Never have I ever taken a photo of food before eating it",
  "Never have I ever lied about how long it took me to get somewhere",
  "Never have I ever screenshot a conversation to show someone else",
  "Never have I ever Googled myself",
  "Never have I ever faked a laugh for an entire conversation",
  "Never have I ever pretended to be on the phone to avoid someone",
  "Never have I ever left a restaurant without finishing my food and felt guilty",
  "Never have I ever muted a group chat and checked it three days later",
  "Never have I ever speed-read a book and pretended I read the whole thing",
  "Never have I ever shown up somewhere and immediately wanted to leave",
  "Never have I ever made a face at my own reflection and kept going",
  "Never have I ever told someone I was 'five minutes away' when I hadn't left",
  "Never have I ever deliberately left a conversation on read to think of a reply",
  "Never have I ever eaten cereal dry because I couldn't be bothered with milk",
  "Never have I ever waved back at someone who was waving at someone behind me",
  "Never have I ever responded 'you too' after a waiter said 'enjoy your meal'",
  "Never have I ever rehearsed a phone call before making it",
  "Never have I ever made a playlist for a specific person who never heard it",
  "Never have I ever looked up the ending of a film because I was too impatient",
  "Never have I ever pretended I'd seen a show everyone was discussing just to join the conversation",
  "Never have I ever cried in a car alone and felt completely fine afterwards",
  "Never have I ever been the last one awake at a sleepover and done something I won't admit",
  "Never have I ever lost a friendship over something incredibly trivial",
  "Never have I ever lied about my height on a dating profile",
  "Never have I ever looked through someone's phone when they left the room",
  "Never have I ever checked my own Instagram likes obsessively in the first hour",
  "Never have I ever had a full argument in my head and won it",
  "Never have I ever accidentally called a teacher 'mum' or 'dad'",
  "Never have I ever gone on a second date out of politeness",
  "Never have I ever done something embarrassing and blamed it on someone else",
  "Never have I ever shown up to something overdressed and played it off as intentional",
  "Never have I ever started a sentence with 'I'm not racist but...' and immediately regretted it",
  "Never have I ever pretended to be busy to cancel plans I had already agreed to",
  "Never have I ever been to a funeral and tried not to laugh at something",
  "Never have I ever felt judged for my music taste and changed the song",
  "Never have I ever written a strongly worded review and chickened out of posting it",
  "Never have I ever stared at my phone to avoid eye contact with a stranger",
  "Never have I ever bought a book to seem smart and never read it",
  "Never have I ever faked being asleep to avoid a conversation",
  "Never have I ever kept score in a friendship without telling them",
  "Never have I ever lied about not getting a notification",
  "Never have I ever used 'I was drunk' as an excuse for something I did completely sober",
  "Never have I ever skipped a song I said was my favourite because the mood was wrong",
  "Never have I ever taken a photo specifically to post then pretended it was candid",
  "Never have I ever stayed at a party out of guilt and had a great time anyway",
  "Never have I ever overcommitted to plans knowing I'd cancel",
  "Never have I ever deleted a message I sent immediately after sending it",
  "Never have I ever had a situationship I never fully explained to my friends",
  "Never have I ever pretended to be more confident than I was and actually become confident",
  "Never have I ever judged someone's music taste and immediately heard one of my guilty pleasures",
  "Never have I ever called in sick and spent the day doing something completely unrelated",
  "Never have I ever turned down a date because I had already planned to do nothing",
  "Never have I ever eaten food I didn't enjoy and said it was delicious",
  "Never have I ever Googled symptoms and convinced myself I was dying",
  "Never have I ever seen someone trip and checked if anyone else saw before reacting",
  "Never have I ever remembered a dream so vividly I tried to finish it after waking up",
  "Never have I ever overshared with a stranger and immediately regretted it",
  "Never have I ever texted someone 'I'm outside' when I was still getting ready",
  "Never have I ever stayed in an argument I knew I'd lost just to have the last word",
  "Never have I ever gone to the bathroom at a party just for a moment alone",
  "Never have I ever been to a concert and spent half of it on my phone",
  "Never have I ever unfollowed someone and then followed them again the same week",
  "Never have I ever been recognised somewhere and not remembered who the person was",
  "Never have I ever been in a meeting I could have been an email",
  "Never have I ever said 'I'm not a people person' while actively seeking attention",
  "Never have I ever ended a call and immediately talked about the person I just hung up with",
  "Never have I ever stress-eaten something and then stress-eaten more because I was annoyed about the first thing",
  "Never have I ever referred to a pet as my child in complete seriousness",
  "Never have I ever seen a couple argue in public and fully taken a side in my head",
  "Never have I ever rewatched a show I hated just to finish it out of obligation",
  "Never have I ever been too embarrassed to ask someone to repeat themselves a third time",
  "Never have I ever done a 'quick clean' by hiding things in a drawer",
  "Never have I ever been caught singing in my car at a red light",
  "Never have I ever panic-ordered something at a restaurant because I didn't look at the menu",
  "Never have I ever added something to my to-do list just so I could cross it off",
  "Never have I ever refused to be in a photo and then been annoyed I wasn't in the photo",
  "Never have I ever given someone directions I wasn't sure about",
  "Never have I ever ordered something at a restaurant specifically to impress a date",
  "Never have I ever pretended to understand a reference and Googled it in the bathroom",
  "Never have I ever apologised to an inanimate object for bumping into it",
  "Never have I ever lost an item and blamed someone else before checking my own bag",
  "Never have I ever told someone 'I'll be there in five' and genuinely believed it",
  "Never have I ever started a workout, done two minutes, and called it a warm-up",
  "Never have I ever cancelled a delivery and then immediately re-ordered the same thing",
  "Never have I ever cried watching a sports game",
  "Never have I ever been the last to find out about something everyone else knew",
  "Never have I ever had a friendship fall apart and not entirely know why",
  "Never have I ever pretended to be fine right after something happened when I was not",
  "Never have I ever bluffed through a conversation about a topic I knew nothing about",
  "Never have I ever eaten a full bag of something while telling myself I'd have just a bit",
  "Never have I ever paid for something I didn't want rather than ask for it to be fixed",
  "Never have I ever agreed to do something thinking it was weeks away and panicked when it was days away",
  "Never have I ever rehearsed breaking up with someone and not gone through with it",
  "Never have I ever taken a compliment so badly the other person felt worse",
  "Never have I ever forgotten a person's name seconds after being introduced",
  "Never have I ever bought something on sale that I would never have bought full price",
  "Never have I ever stayed awake to make a point",
  "Never have I ever committed to a hairstyle under pressure I immediately regretted",
  "Never have I ever avoided someone specifically to not have to make plans",
  "Never have I ever pretended I hadn't checked my phone when I very clearly had",
  "Never have I ever gone to a social event specifically to have something to talk about",
  "Never have I ever convinced myself I was going to change something and not changed it",
  "Never have I ever made a decision based entirely on what was more comfortable",
  "Never have I ever lied about my level of experience at something to get out of doing it",
  "Never have I ever sent a message and then immediately followed it with a second message saying 'ignore that'",
  "Never have I ever genuinely enjoyed something I was forced to try",
  "Never have I ever wished a friend's relationship would end so I could see them more",
  "Never have I ever told someone I was 'almost there' from a completely different location",
  "Never have I ever spent more time planning something than actually doing it",
  "Never have I ever rehearsed a story so many times it stopped sounding true",
  "Never have I ever been asked 'are you okay?' and actually answered honestly",
  "Never have I ever borrowed something and returned it worse than when I received it",
  "Never have I ever cried laughing and had absolutely no way to explain what was funny",
  "Never have I ever discovered a song years after everyone else and acted like I found it first",
  "Never have I ever gone to a restaurant recommended by a friend and pretended to love it",
  "Never have I ever skipped a queue by pretending to be joining a friend at the front",
  "Never have I ever been brutally honest and immediately wished I hadn't been",
  "Never have I ever spent more on delivery fees than on the food itself",
  "Never have I ever said yes to something just to avoid an awkward silence",
  "Never have I ever been in the same mood as everyone else but hidden it to seem fine",
  "Never have I ever used the weather as a valid excuse for cancelling",
  "Never have I ever got home, eaten, and gone straight to sleep without speaking to anyone",
  "Never have I ever deleted a contact and then saved them again when they texted",
  "Never have I ever changed my answer on a quiz after marking it because I was sure I was right",
  "Never have I ever ordered the second cheapest wine because it felt less embarrassing",
  "Never have I ever quietly judged someone's opinion and outwardly agreed",
  "Never have I ever made plans I didn't intend to keep just to end a conversation",
  "Never have I ever had a conversation go so well I replayed it on the way home",
];

interface NeverHaveIEverState {
  phase: "waiting" | "question" | "reveal" | "finished";
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
  currentPrompt: string | null;
  responses: Record<string, "have" | "never">;
  haveCount: number;
  neverCount: number;
  queue: number[];
}

const KEY = (roomId: string) => `experience:never_have_i_ever:${roomId}`;

export class NeverHaveIEverExperience implements ExperienceModule {
  readonly type = "never_have_i_ever" as const;

  async onActivate(roomId: string, _hostGuestId: string): Promise<void> {
    const state: NeverHaveIEverState = {
      phase: "waiting",
      round: 0,
      totalRounds: PROMPTS.length,
      scores: {},
      currentPrompt: null,
      responses: {},
      haveCount: 0,
      neverCount: 0,
      queue: shuffledIndices(PROMPTS.length),
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
    const raw = await redisClient.get(KEY(roomId));
    if (!raw) return;
    const state: NeverHaveIEverState = JSON.parse(raw);

    switch (action) {
      case "start": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        state.phase = "question";
        state.round = 1;
        state.queue = shuffledIndices(PROMPTS.length);
        state.currentPrompt = PROMPTS[state.queue[0]];
        state.responses = {};
        state.haveCount = 0;
        state.neverCount = 0;
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "never_have_i_ever",
          state: { ...state, responses: {} },
          view: { type: "never_have_i_ever", data: { ...state, responses: {} } },
          sequenceId: seq,
        });
        break;
      }

      case "respond": {
        if (state.phase !== "question") return;
        const p = payload as { choice: "have" | "never" };
        if (!p?.choice || (p.choice !== "have" && p.choice !== "never")) return;
        const prev = state.responses[guestId];
        if (prev === "have") state.haveCount = Math.max(0, state.haveCount - 1);
        if (prev === "never") state.neverCount = Math.max(0, state.neverCount - 1);
        state.responses[guestId] = p.choice;
        if (p.choice === "have") state.haveCount++;
        else state.neverCount++;
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        // Broadcast counts only — hide who responded what until reveal
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "never_have_i_ever",
          state: { ...state, responses: {} },
          view: { type: "never_have_i_ever", data: { ...state, responses: {} } },
          sequenceId: seq,
        });
        break;
      }

      case "reveal": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        if (state.phase !== "question") return;
        // Award +100 to guests who answered "never" (stayed pure)
        for (const [voter, choice] of Object.entries(state.responses)) {
          if (choice === "never") {
            state.scores[voter] = (state.scores[voter] ?? 0) + 100;
          }
        }
        state.phase = "reveal";
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "never_have_i_ever",
          state,
          view: { type: "never_have_i_ever", data: state },
          sequenceId: seq,
        });
        break;
      }

      case "next": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        if (state.phase !== "reveal") return;
        state.round += 1;
        if (state.round > state.totalRounds) {
          state.phase = "finished";
          state.currentPrompt = null;
          await redisClient.set(KEY(roomId), JSON.stringify(state));
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "never_have_i_ever",
            state,
            view: { type: "leaderboard", data: state.scores },
            sequenceId: seq,
          });
        } else {
          state.phase = "question";
          state.currentPrompt = PROMPTS[state.queue[(state.round - 1) % state.queue.length]];
          state.responses = {};
          state.haveCount = 0;
          state.neverCount = 0;
          await redisClient.set(KEY(roomId), JSON.stringify(state));
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "never_have_i_ever",
            state: { ...state, responses: {} },
            view: { type: "never_have_i_ever", data: { ...state, responses: {} } },
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
    const state: NeverHaveIEverState = JSON.parse(raw);
    if (state.phase === "finished") return { type: "leaderboard", data: state.scores };
    // Never expose individual responses to guests outside of reveal phase
    if (state.phase !== "reveal") {
      return { type: "never_have_i_ever" as any, data: { ...state, responses: {} } };
    }
    return { type: "never_have_i_ever" as any, data: state };
  }
}
