import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";

// ─────────────────────────────────────────────────────────────────────────────
// Truth or Dare Experience
//
// Host spins to randomly pick a guest, then randomly assigns a truth or dare.
// Guest can pass once per game. Completing earns +300 pts.
//
// Actions:
//   HOST:  start, spin, end
//   GUEST: complete, pass
// ─────────────────────────────────────────────────────────────────────────────

const TRUTHS: string[] = [
  "What is the most embarrassing thing that's ever happened to you at a party?",
  "What's the worst date you've ever been on?",
  "Have you ever lied to get out of a social event? What did you say?",
  "What's the most childish thing you still do?",
  "What's a secret you've never told anyone in this room?",
  "What's the most ridiculous thing you've ever done to impress someone?",
  "What's your most embarrassing drunk story?",
  "If you could switch lives with anyone in this room for a day, who and why?",
  // ── Embarrassing & Funny ──────────────────────────────────────────────────
  "What is the most embarrassing song on your most-played list?",
  "Have you ever been caught snooping through someone's phone? What were you looking for?",
  "What's the biggest lie you've told to avoid going out?",
  "What is the pettiest thing you have ever done to someone who upset you?",
  "What app would you be most embarrassed if people could see your screen time on?",
  "Have you ever sent a message to the wrong person? What did it say?",
  "What's your go-to fake excuse and how many times have you used it this year?",
  "What's a habit you have that you'd be mortified if anyone found out about?",
  "What's the most embarrassing thing you've googled in the last month?",
  "Have you ever pretended not to see someone in public to avoid talking to them?",
  "What's the worst thing you've said about someone who is in this room?",
  "Have you ever accidentally liked something embarrassingly old on someone's social media?",
  "What is something you've done while drunk that you told no one about?",
  "What's the most desperate thing you've ever done to get someone's attention?",
  "What's a secret talent or hobby you're embarrassed to admit to?",
  "Have you ever stolen something small and never confessed? What was it?",
  "What's the most immature thing you still find funny?",
  "What's the most embarrassing thing that happened to you at school?",
  "Have you ever cheated at a game and let someone else take the blame?",
  "What's the most dramatic thing you've ever done after a breakup?",
  "What was the last thing you cried at that you'd be embarrassed to admit?",
  // ── Relationships ─────────────────────────────────────────────────────────
  "What's a dealbreaker you have that most people would find surprising?",
  "Have you ever ghosted someone you genuinely liked? Why?",
  "What's the most embarrassing thing you've done on a first date?",
  "Have you ever kept talking to an ex longer than you should have? How long?",
  "What's the biggest red flag you ignored in a relationship?",
  "Have you ever faked being happy in a relationship?",
  "What's the most embarrassing text you've sent to a crush?",
  "Have you ever dated someone to make someone else jealous?",
  "What is a small, petty thing that ended a friendship?",
  "What's the most embarrassing thing you've done when drunk around a love interest?",
  "What's the worst reason you've ended a relationship?",
  "Have you ever read through someone's messages without them knowing?",
  "What's a quality you look for in a partner that you'd never admit publicly?",
  "Have you ever said 'I love you' just because someone said it first?",
  "What's the most immature thing you've done in a relationship argument?",
  // ── Deep / Confessional ───────────────────────────────────────────────────
  "What's something you're genuinely insecure about?",
  "What's a belief you hold that most of your friends would disagree with?",
  "What's the worst decision you've ever made that turned out fine?",
  "What's something you've never forgiven yourself for?",
  "What's a fear you've never told anyone about?",
  "What's the biggest mistake you've made that you've never fully admitted to?",
  "What's something you pretend to be fine about but aren't?",
  "What's a time you were wrong about someone and it took you too long to admit it?",
  "What's the harshest thing you've ever said to someone you cared about?",
  "What's something you've done that you've justified but deep down know was wrong?",
  "What's something you've always wanted to do but been too scared to admit?",
  "What's something about yourself you haven't accepted yet?",
  "What's the most selfish thing you've ever done?",
  "What's a compliment someone gave you that you didn't believe?",
  "What's something you've lied about to make yourself seem better?",
  // ── Fun & Light ───────────────────────────────────────────────────────────
  "What is your most unpopular food opinion?",
  "What's a film or show you pretend to have seen that you haven't?",
  "What's the most ridiculous thing you've argued about with someone?",
  "What's your worst karaoke song and why do you still choose it?",
  "What's a phrase or word you say too much without realising?",
  "What's the most embarrassing playlist name you have?",
  "What's a celebrity you'd be embarrassed to admit you fancy?",
  "What's the worst gift you've ever given and what did you say about it?",
  "What's the most passive-aggressive thing you've ever done?",
  "What's a fad or trend you embarrassingly followed?",
  "What's the worst thing you've cooked and served to someone without warning?",
  "What's a genre of music you secretly love but won't publicly admit?",
  "What's a TV show you've rewatched more than three times and won't discuss?",
  "What's the most awkward compliment you've ever given?",
  "What's the lamest excuse you've ever used for not exercising?",
  // ── Social & Party ────────────────────────────────────────────────────────
  "What's the worst night out you've ever had?",
  "Have you ever pretended to be drunker than you were? What happened?",
  "What's the most embarrassing thing that's happened to you on public transport?",
  "Have you ever dramatically overreacted to something small? What was it?",
  "What's a social situation you completely misread?",
  "What's something you've said at a party that you immediately regretted?",
  "What's the most outrageous excuse you've given to leave early from something?",
  "Have you ever turned up to the wrong event or address?",
  "What's the most embarrassing thing you've done to try to fit in?",
  "What's a compliment you gave that came out completely wrong?",
  // ── Hard / Brave ──────────────────────────────────────────────────────────
  "What's something you've done that would disappoint the people who know you best?",
  "What's a time you were unkind to someone who didn't deserve it?",
  "What's something you've said about someone in this room that you wouldn't say to their face?",
  "What's the biggest thing you've kept secret from your family?",
  "What's something you've never apologised for but should have?",
  "What's the most cowardly thing you've ever done?",
  "What's a time you failed someone who needed you?",
  "What's the most hypocritical thing you've done?",
  "Have you ever taken credit for something someone else did?",
  "What's a time you knew you were wrong in an argument but kept going anyway?",
  "What's the meanest thought you've had about someone you love?",
  "What's something you've bought and hidden from someone you live with?",
  "What's the most embarrassing thing a parent has caught you doing?",
  "What is the biggest white lie you tell regularly?",
  "What's a boundary you've crossed that you've never admitted?",
  // ── Bonus Wildcard ────────────────────────────────────────────────────────
  "What's something you do when you're completely alone that no one knows about?",
  "What's the most ridiculous hill you're willing to die on?",
  "What's a purchase you deeply regret and why did you make it?",
  "What's an opinion about this room you'd never say sober?",
  "What's a version of yourself from 5 years ago you're relieved no one else saw?",
  "What's the most expensive mistake you've ever made?",
  "What's a phrase you've used to describe yourself that was a complete lie?",
  "What's the most embarrassing voicemail you've ever left?",
  "What's something you'd do if there were zero consequences and you'd never tell anyone?",
  "What's the worst advice you've given someone that they actually followed?",
  "Have you ever completely faked understanding something to avoid looking stupid?",
  "What's a personality trait you've pretended to have?",
  "What's a time you've been spectacularly wrong about something?",
  "What's the most embarrassing thing that's ended up on your camera roll?",
  "What's a 'healthy habit' you tell people you have that you actually don't?",
];

const DARES: string[] = [
  "Do your best impression of another person in this room",
  "Sing the chorus of any song chosen by the group",
  "Let the room post anything they want on your social media for 30 seconds",
  "Do 20 jumping jacks while reciting the alphabet",
  "Call a contact in your phone and sing Happy Birthday to them",
  "Speak in an accent chosen by the group for the next 3 rounds",
  "Show the most embarrassing photo on your phone",
  "Do your best catwalk across the room",
  // ── Perform & Entertain ───────────────────────────────────────────────────
  "Act out the last argument you had using only sound effects",
  "Give a dramatic one-minute TED Talk on a topic chosen by the group",
  "Narrate everything you're doing for the next 2 minutes in the third person",
  "Do your best impression of a movie trailer for this group's night out",
  "Pretend you're being interviewed on a chat show and answer one question from each person in the room",
  "Without saying any words, act out a scene from the last film you watched",
  "Do the worst possible version of your favourite dance move",
  "Perform a live cooking show explaining how to make a sandwich — with dramatic commentary",
  "Give a wedding speech for two people in this room chosen by the group",
  "Pretend you're a news anchor reporting live on what's happening in this room right now",
  "Act out a job interview for the most ridiculous job the group can think of",
  "Do an impression of a TV show host hosting this exact game",
  "Mime the lyrics to a song the group chooses without making any sound",
  "Accept a fictional award speech-style for something embarrassing you've done",
  "Recreate a runway walk like you're modelling something the group describes",
  "Do a dramatic reading of the last text you received",
  // ── Social Media & Phone ──────────────────────────────────────────────────
  "Send the last meme in your camera roll to a family member with no explanation",
  "Allow the group to look through your camera roll for 30 seconds",
  "Let someone in the group send one message from your phone — to anyone they choose",
  "Post a story to your Instagram that the group writes",
  "Show the group your most recent search history — just the top 5",
  "Let the group read your last 5 voice notes out loud (in accents)",
  "Send a voice note to a contact saying 'I've been thinking about you' without explaining",
  "Let the group change your phone lockscreen to a photo they take right now",
  "Post something on your story that the group writes — it must be up for at least 30 seconds",
  "Show the last thing you bought online",
  // ── Physical Challenges ───────────────────────────────────────────────────
  "Do a plank for 45 seconds while someone in the group does a dramatic sports commentary",
  "Eat something spicy and keep a straight face while the group asks you questions",
  "Do your best robot dance for 30 seconds straight",
  "Put an ice cube in your hand and hold it until it melts or someone else finishes their dare",
  "Attempt to lick your elbow — document the attempt",
  "Do 10 push-ups while shouting motivational quotes chosen by the group",
  "Spin around 10 times then walk in a straight line while being judged by everyone",
  "Do a handstand or attempt one against the wall — hold for 5 seconds",
  "Walk across the room while balancing something on your head chosen by the group",
  "Talk in an accent chosen by the group for the next 3 rounds — any slip means starting over",
  "Move only in slow motion for the next 2 minutes",
  "Do a somersault or an attempt at one — it will be rated out of 10",
  // ── Social Dares ──────────────────────────────────────────────────────────
  "Compliment every person in the room in 60 seconds — genuinely",
  "Let two people in the group redecorate your hair using what's available in the room",
  "Let the group style your outfit using 3 items from the room — wear it for the next round",
  "Stand up and tell the group something you've never told them before",
  "Let the group ask you 5 personal questions you have to answer honestly in under 20 seconds each",
  "Allow the group to vote on your next hairstyle (within reason) and commit to it for 30 minutes",
  "Describe your favourite person in the room using only negative words",
  "Rank everyone in the room by how likely they are to be a secret millionaire — explain each rank",
  "For the next 3 turns, begin every sentence with 'Legally speaking...'",
  "Assign everyone in the room a job that perfectly matches their personality — explain your reasoning",
  "Go around the room and give each person a nickname they have to use for the rest of the game",
  // ── Embarrassing ─────────────────────────────────────────────────────────
  "Dramatically re-enact your most embarrassing moment to the best of your ability",
  "Let the group write a bio for your dating profile and read it aloud",
  "Tell the group your honest opinion of each person's fashion sense",
  "Read your most embarrassing text conversation aloud (without names)",
  "Show the least flattering photo on your phone",
  "Describe your most awkward romantic moment as if it's a chapter of a novel",
  "Let the group google you and see what comes up in the first page of results",
  "Share the most cringe thing you've ever posted on social media — or describe it if it's been deleted",
  "Attempt to freestyle rap about your day for 30 seconds",
  "Confess the worst lie you've told someone in the last year without saying who",
  // ── Creative & Weird ──────────────────────────────────────────────────────
  "Invent a new dance move, demonstrate it, and give it a name",
  "Design and pitch a business idea to the room in 2 minutes",
  "Write a haiku about the person to your left and perform it dramatically",
  "Describe the last film you watched as if it's the greatest film ever made",
  "Make a commercial for an imaginary product chosen by the group",
  "Explain quantum physics using only examples from this room",
  "Write a two-line slogan for each person in the room — perform them all",
  "Invent an Olympic sport using only objects currently in this room and demonstrate it",
  "Pitch the group as characters in a reality TV show — describe each person's role",
  "Design a new cocktail using only things in the room and describe it as a mixologist would",
  // ── Wildcard & Chaos ──────────────────────────────────────────────────────
  "Swap shoes with someone in the room for the next 3 rounds",
  "Do everything anyone says for the next 60 seconds — within reason",
  "Speak only in questions for the next 3 rounds",
  "Narrate the thoughts of an inanimate object in this room for 1 minute",
  "Become a strict food critic and review the last meal you had in extreme detail",
  "Address everyone in the room only by a nickname you make up on the spot for the rest of the game",
  "Speak as if this is an interview for a documentary about your life — for the next 2 rounds",
  "Attempt to explain why something very ordinary (a chair, a cup) is actually deeply suspicious",
  "Take a selfie with every person in the room using only the most unflattering angle",
  "Do an Irish exit from the room and re-enter dramatically as a completely different character",
  "Start every sentence for the next 2 rounds with 'My therapist says...'",
  "Convince the group of something completely untrue about yourself in under a minute",
  "Give a TED Talk on the importance of something nobody cares about",
  "Describe what each person in this room smells like — politely",
  "Confess one thing to the room that you've been meaning to say for a while",
];

interface TruthOrDareState {
  phase: "waiting" | "spinning" | "playing" | "finished";
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
  currentPlayer: string | null;
  currentType: "truth" | "dare" | null;
  currentChallenge: string | null;
  passesUsed: Record<string, number>;
}

const KEY = (roomId: string) => `experience:truth_or_dare:${roomId}`;

export class TruthOrDareExperience implements ExperienceModule {
  readonly type = "truth_or_dare" as const;

  async onActivate(roomId: string, _hostGuestId: string): Promise<void> {
    const state: TruthOrDareState = {
      phase: "waiting",
      round: 0,
      totalRounds: 8,
      scores: {},
      currentPlayer: null,
      currentType: null,
      currentChallenge: null,
      passesUsed: {},
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
    const state: TruthOrDareState = JSON.parse(raw);

    switch (action) {
      case "start": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        state.phase = "spinning";
        state.round = 1;
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "truth_or_dare",
          state,
          view: { type: "truth_or_dare", data: state },
          sequenceId: seq,
        });
        break;
      }

      case "spin": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        const p = payload as { guestIds: string[] };
        if (!p?.guestIds?.length) return;
        const picked = p.guestIds[Math.floor(Math.random() * p.guestIds.length)];
        const isTruth = Math.random() < 0.5;
        const pool = isTruth ? TRUTHS : DARES;
        const challenge = pool[Math.floor(Math.random() * pool.length)];
        state.phase = "playing";
        state.currentPlayer = picked;
        state.currentType = isTruth ? "truth" : "dare";
        state.currentChallenge = challenge;
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "truth_or_dare",
          state,
          view: { type: "truth_or_dare", data: state },
          sequenceId: seq,
        });
        break;
      }

      case "complete": {
        // Only the current player or host can mark complete
        if (guestId !== state.currentPlayer && role !== "HOST" && role !== "CO_HOST") return;
        if (state.phase !== "playing" || !state.currentPlayer) return;
        state.scores[state.currentPlayer] = (state.scores[state.currentPlayer] ?? 0) + 300;
        await this._advanceRound(state, roomId, io);
        break;
      }

      case "pass": {
        // Only the current player can pass, and only once per game
        if (guestId !== state.currentPlayer) return;
        if (state.phase !== "playing" || !state.currentPlayer) return;
        const used = state.passesUsed[guestId] ?? 0;
        if (used >= 1) return; // No pass remaining — ignore
        state.passesUsed[guestId] = used + 1;
        // Spin again with same guest list is handled by host sending another spin
        // Here we just revert to spinning phase so host can re-spin
        state.phase = "spinning";
        state.currentPlayer = null;
        state.currentType = null;
        state.currentChallenge = null;
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "truth_or_dare",
          state,
          view: { type: "truth_or_dare", data: state },
          sequenceId: seq,
        });
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

  private async _advanceRound(state: TruthOrDareState, roomId: string, io: Server): Promise<void> {
    state.currentPlayer = null;
    state.currentType = null;
    state.currentChallenge = null;

    if (state.round >= state.totalRounds) {
      state.phase = "finished";
      await redisClient.set(KEY(roomId), JSON.stringify(state));
      const seq = await getNextSequenceId(roomId);
      io.to(roomId).emit("experience:state" as any, {
        experienceType: "truth_or_dare",
        state,
        view: { type: "leaderboard", data: state.scores },
        sequenceId: seq,
      });
    } else {
      state.round += 1;
      state.phase = "spinning";
      await redisClient.set(KEY(roomId), JSON.stringify(state));
      const seq = await getNextSequenceId(roomId);
      io.to(roomId).emit("experience:state" as any, {
        experienceType: "truth_or_dare",
        state,
        view: { type: "truth_or_dare", data: state },
        sequenceId: seq,
      });
    }
  }

  async getGuestViewDescriptor(roomId: string): Promise<GuestViewDescriptor> {
    const raw = await redisClient.get(KEY(roomId));
    if (!raw) return { type: "intermission" };
    const state: TruthOrDareState = JSON.parse(raw);
    if (state.phase === "finished") return { type: "leaderboard", data: state.scores };
    return { type: "truth_or_dare" as any, data: state };
  }

  async getBootstrapState(roomId: string): Promise<unknown> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }
}