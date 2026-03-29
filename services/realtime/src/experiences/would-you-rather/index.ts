import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";
import { shuffledIndices } from "../../lib/shuffle";
import { awardGameWin } from "../../lib/credits";

// ─────────────────────────────────────────────────────────────────────────────
// Would You Rather Experience
//
// Everyone votes A or B. Majority gets +200, minority gets +50 (for being bold).
// Host controls pacing. 8 dilemmas per game.
//
// Actions:
//   HOST:  start, reveal, next, end
//   GUEST: vote
// ─────────────────────────────────────────────────────────────────────────────

const DILEMMAS: { a: string; b: string }[] = [
  { a: "Never listen to music again", b: "Never watch TV or movies again" },
  { a: "Always speak in rhyme", b: "Always speak in song" },
  { a: "Have a party every weekend forever", b: "Have the best house party of your life, just once" },
  { a: "Know the lyrics to every song", b: "Be able to play every instrument perfectly" },
  { a: "Only eat food from one restaurant for a year", b: "Only wear one outfit for a year" },
  { a: "Sneeze every time you laugh", b: "Laugh every time you sneeze" },
  { a: "Have a rewind button for your life", b: "Have a pause button for your life" },
  { a: "Hiccup once every minute for the rest of your life", b: "Burp every time you shake someone's hand" },
  // ── Funny & Social ─────────────────────────────────────────────────────────
  { a: "Always arrive 30 minutes early", b: "Always arrive 30 minutes late" },
  { a: "Never be able to use a phone again", b: "Never be able to use a computer again" },
  { a: "Only be able to whisper", b: "Only be able to shout" },
  { a: "Have a personal theme song that plays when you walk in a room", b: "Have a laugh track follow you everywhere" },
  { a: "Know when you're going to die", b: "Know how you're going to die" },
  { a: "Always have to tell the truth", b: "Never be able to tell the truth" },
  { a: "Be the funniest person in every room", b: "Be the smartest person in every room" },
  { a: "Never have to sleep but always feel tired", b: "Sleep 12 hours a day and always feel rested" },
  { a: "Live in a world without social media", b: "Live in a world without smartphones" },
  { a: "Be famous but hated", b: "Be unknown but universally loved by everyone who meets you" },
  { a: "Have the ability to fly but only at walking pace", b: "Have the ability to teleport but only 3 metres at a time" },
  { a: "Never feel cold again", b: "Never feel hot again" },
  { a: "Have unlimited money but no free time", b: "Have unlimited free time but no money" },
  { a: "Live one life to 200 years old", b: "Live ten different lives each 20 years long" },
  { a: "Read minds but only hear negative thoughts", b: "See the future but only bad things" },
  { a: "Win an argument with everyone but never feel satisfied", b: "Lose every argument but always feel calm" },
  { a: "Have a photographic memory of everything bad that's ever happened to you", b: "Forget something important from your life every year" },
  { a: "Be able to speak every language", b: "Be able to play every sport at a professional level" },
  { a: "Only be able to eat food that's cold", b: "Only be able to eat food that's room temperature" },
  { a: "Have fingers as long as your legs", b: "Legs as short as your fingers" },
  { a: "Be able to pause time but only for 10 seconds a day", b: "Rewind time by 10 seconds once per day" },
  // ── Party & Lifestyle ──────────────────────────────────────────────────────
  { a: "Go on holiday every month but always to the same place", b: "Go on one incredible holiday every five years to anywhere" },
  { a: "Only drink water for a year", b: "Only eat bread for a year" },
  { a: "Have everyone at the party know your deepest secret", b: "Have your most embarrassing moment posted online" },
  { a: "Be the DJ but only know one genre", b: "Be the host but run out of drinks at midnight" },
  { a: "Have a wardrobe full of designer clothes that don't fit", b: "Have perfectly fitting clothes from charity shops only" },
  { a: "Get a text from your ex every morning", b: "See your ex at every social event for the rest of your life" },
  { a: "Be 10 years older", b: "Be 10 years younger" },
  { a: "Never experience heartbreak again", b: "Never fall in love again" },
  { a: "Be able to eat anything and never gain weight", b: "Never have to exercise and always be fit" },
  { a: "Have a best friend who is brutally honest", b: "Have a best friend who always tells you what you want to hear" },
  { a: "Live in the city forever", b: "Live in the countryside forever" },
  { a: "Be terrified of heights in a world where everything is elevated", b: "Be terrified of deep water on a floating city" },
  { a: "Only be able to listen to music made before you were born", b: "Only be able to listen to music made after last year" },
  { a: "Have a free personal chef for life but they only cook one cuisine", b: "Cook everything yourself but be a natural genius at it" },
  { a: "Only be able to communicate via memes", b: "Only be able to communicate via formal written letters" },
  { a: "Lose your sense of smell forever", b: "Lose your sense of taste forever" },
  // ── Dark & Difficult ───────────────────────────────────────────────────────
  { a: "Know everyone is secretly judging you", b: "Know no one pays attention to you at all" },
  { a: "Have a superpower that only works when no one is watching", b: "Have a superpower that only works in public" },
  { a: "Be allergic to your favourite food", b: "Be allergic to your favourite season" },
  { a: "Be able to fix any relationship with one conversation", b: "Be able to exit any situation instantly with no consequences" },
  { a: "Have an enemy who always makes your life slightly inconvenient", b: "Have a friend who means well but always makes things worse" },
  { a: "Know the exact date your friendships will end", b: "Know why each friendship ended but only after" },
  { a: "Always feel slightly underdressed", b: "Always feel slightly overdressed" },
  { a: "Be permanently 5 minutes late to everything", b: "Arrive 2 hours early to everything with nothing to do" },
  { a: "Forget someone's name 30 seconds after they tell you", b: "Remember everyone's name but forget faces entirely" },
  { a: "Always have the perfect comeback — two days later", b: "Always have a comeback instantly but it's almost right" },
  { a: "Be able to stop time but age normally while it's paused", b: "Live in slow motion — everything is 4x harder but you have more time to react" },
  { a: "Never feel full after eating", b: "Never feel truly hungry" },
  { a: "Speak every language but have an accent in all of them", b: "Speak only your native language perfectly and no others" },
  { a: "Have a guardian angel who means well but always intervenes at the wrong time", b: "Have no guardian angel but perfect instincts" },
  // ── Relationships & Social ─────────────────────────────────────────────────
  { a: "Have 1,000 Instagram followers who genuinely love you", b: "Have 1 million followers who don't care about you" },
  { a: "Date someone who loves you more than you love them", b: "Date someone you love more than they love you" },
  { a: "Only be able to have one close friend at a time", b: "Have 100 acquaintances but no close friends" },
  { a: "Be able to see if someone likes you as soon as you meet them", b: "Never know if someone likes you until they say it out loud" },
  { a: "Fall in love every six months (and have it end each time)", b: "Fall in love once, deeply, and never again" },
  { a: "Know what your friends really think of your outfits", b: "Know what your friends really think of your life choices" },
  { a: "Have a relationship that's boring but peaceful", b: "Have a relationship that's exciting but unstable" },
  { a: "Send every message before proofreading", b: "Take 48 hours to reply to everything" },
  { a: "Always know when someone is lying to you", b: "Always know when someone has a crush on you" },
  { a: "Have to explain every joke you make", b: "Have to explain every opinion you have" },
  // ── Absurd ─────────────────────────────────────────────────────────────────
  { a: "Have a tail but it wags when you're happy with no way to stop it", b: "Have ears that go flat when you're embarrassed" },
  { a: "Sweat glitter", b: "Cry sparks" },
  { a: "Every time you're excited you honk like a goose", b: "Every time you're scared you bark once" },
  { a: "Have the power to turn any liquid into soup", b: "Turn any solid food into cereal" },
  { a: "Be able to communicate with furniture", b: "Be able to communicate with appliances" },
  { a: "Your sneezes produce confetti", b: "Your yawns produce a small gust of wind" },
  { a: "Age in reverse after 40", b: "Stop ageing at 40 forever" },
  { a: "Every photo ever taken of you is slightly blurry", b: "Every photo of you is perfect but you can never be in a photo with others" },
  { a: "Your shadow is always doing something more interesting than you", b: "Your reflection is always one second behind" },
  { a: "Be able to shrink to the size of a mouse on command", b: "Be able to grow to the size of a house on command" },
  { a: "Have a personal cloud that follows you and rains on you occasionally", b: "Always walk with a slight wind in your face" },
  { a: "Leave a glowing trail wherever you walk", b: "Make a soft ding sound with every step" },
  // ── Money & Career ─────────────────────────────────────────────────────────
  { a: "Have a job you love that pays terribly", b: "Have a job you hate that pays extremely well" },
  { a: "Own your dream home but in the wrong city", b: "Rent forever in the perfect city" },
  { a: "Win £1 million but have to spend it all in 24 hours", b: "Receive £5,000 a month for the rest of your life" },
  { a: "Work a 4-day week but never get a raise", b: "Work a 6-day week with massive yearly bonuses" },
  { a: "Be your own boss but earn less", b: "Work for someone else but earn double" },
  { a: "Have a career that changes every 5 years", b: "Have one career for life that you chose at age 18" },
  { a: "Be very rich but no one knows it", b: "Appear very rich but actually have very little" },
  { a: "Buy everything second-hand forever", b: "Never be able to keep anything for more than a year" },
  { a: "Have a 3-hour daily commute to the perfect job", b: "Work from home at a job you only sort of like" },
  { a: "Be broke for 5 years then wealthy forever", b: "Be comfortable your whole life but never wealthy" },
  // ── Food & Body ────────────────────────────────────────────────────────────
  { a: "Every meal is slightly too hot", b: "Every meal is slightly too cold" },
  { a: "Only eat sweet food for a year", b: "Only eat savoury food for a year" },
  { a: "Food always tastes slightly different to how you remember", b: "Food always tastes exactly the same no matter what you eat" },
  { a: "Be able to eat anything without consequences but never enjoy the taste", b: "Love every meal but your body reacts terribly to most foods" },
  { a: "Have the body of someone who exercises 3 hours a day without doing it", b: "Love exercising but your body never changes" },
  { a: "Always feel slightly bloated", b: "Always feel slightly hungry" },
  { a: "Only be allowed to order something you've never tried before at restaurants", b: "Only be allowed to order your top 3 dishes wherever you go" },
  { a: "Drink one smoothie a day for the rest of your life that contains something awful", b: "Give up dessert entirely forever" },
  // ── Tech & Modern Life ─────────────────────────────────────────────────────
  { a: "Have your search history made public once", b: "Have your texts made public once" },
  { a: "Live without the internet for a year and be paid £100k", b: "Keep the internet but give up £100k you have right now" },
  { a: "Get a notification every time someone googles your name", b: "Get a notification every time someone screenshots your profile" },
  { a: "Have autocorrect that's always slightly wrong", b: "Have no autocorrect at all" },
  { a: "Have battery anxiety permanently on 15%", b: "Have your phone charged but never have signal" },
  { a: "Only be able to call people — no texts, no apps", b: "Only be able to text — never call or video" },
  { a: "Be verified on every platform but post nothing", b: "Have no social media but be endlessly talked about online" },
  { a: "Have every album you love disappear from streaming the day you fall in love with it", b: "Never discover new music but always have your favourites" },
  // ── Deep Philosophical ────────────────────────────────────────────────────
  { a: "Know the meaning of life but be unable to share it with anyone", b: "Share the meaning of life with everyone but immediately forget it yourself" },
  { a: "Live in a simulation you know isn't real", b: "Live in reality that feels like a simulation" },
  { a: "Be remembered after death for one great thing", b: "Be forgotten but live an incredibly full and happy life" },
  { a: "Be able to go back and change one decision", b: "See clearly how your life would have been different if you had" },
  { a: "Meet your future self at 70 and talk for an hour", b: "Meet your past self at 15 and talk for an hour" },
  { a: "Know you made the right choice every time", b: "Never know if you made the right choice but be comfortable with uncertainty" },
  { a: "Have your greatest achievement be something no one cares about now", b: "Have something you consider minor become incredibly important to others" },
  { a: "Spend your life in total comfort with no growth", b: "Spend your life constantly challenged and growing with no guarantee of happiness" },
  { a: "Be profoundly content but slightly bored", b: "Be profoundly interested in everything but never at peace" },
  { a: "Know exactly who you are", b: "Keep discovering new things about yourself your whole life" },
  // ── Mixed bag ─────────────────────────────────────────────────────────────
  { a: "Always know the name of every person you've ever met", b: "Always remember every conversation you've ever had" },
  { a: "Have perfect teeth but terrible eyesight", b: "Perfect eyesight but terrible teeth" },
  { a: "Be able to talk to animals but they're all boring", b: "Be able to understand plants but they complain constantly" },
  { a: "Always have the newest version of everything but never know how to use it", b: "Use only technology from 10 years ago for the rest of your life" },
  { a: "Be immune to embarrassment but not to pain", b: "Be immune to pain but not to embarrassment" },
  { a: "Have everyone immediately trust you but you betray them once", b: "Have no one trust you initially but earn it fully over time" },
  { a: "Smell incredible at all times with no effort", b: "Look incredible at all times with no effort" },
  { a: "Never lose your keys or phone but forget everything else", b: "Forget nothing but always lose your keys and phone" },
  { a: "Have a front-row seat to history's greatest moments but can't interact", b: "Change one historical event but never know the outcome" },
  { a: "Be able to predict the weather with 90% accuracy", b: "Be able to predict traffic with 90% accuracy" },
  { a: "Never get a headache again", b: "Never get a cold again" },
  { a: "Have every meal you cook taste perfect but take 3 hours", b: "Cook any meal in under 10 minutes but it's always just okay" },
  { a: "Be endlessly patient but easily ignored", b: "Be magnetic but impatient" },
  { a: "Have a pet that lives as long as you", b: "Have 20 pets with normal lifespans" },
  { a: "Never be stuck in traffic again", b: "Never wait in a queue again" },
  { a: "Always have a table at a restaurant", b: "Always get seats at a sold-out gig" },
  { a: "Have every photo you take be slightly overexposed", b: "Have every photo you take be slightly out of focus" },
  { a: "Find £20 on the floor every week but always feel guilty about keeping it", b: "Never find money but feel zero guilt about anything" },
  { a: "Always feel mildly underprepared", b: "Always feel mildly overprepared" },
  { a: "Have perfect posture but be unable to sit comfortably on soft furniture", b: "Slouch forever but feel incredible on any sofa" },
  { a: "Always leave a social event wondering if you said something wrong", b: "Never worry about social events but never read the room either" },
  { a: "Be the first person in your friend group to do everything", b: "Let your friends go first and then follow when it's safe" },
  { a: "Have a standing ovation whenever you walk into a room", b: "Have a round of applause every time you finish eating" },
  { a: "Be able to mute anyone in real life for up to 30 seconds", b: "Be able to hit a skip button on any conversation topic once per day" },
  { a: "Have a tiny personal orchestra that scores your life", b: "Have a narrator who explains what you're feeling out loud in real time" },
];

interface WouldYouRatherState {
  phase: "waiting" | "question" | "reveal" | "finished";
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
  currentQ: { a: string; b: string } | null;
  votes: Record<string, "a" | "b">;
  aCount: number;
  bCount: number;
  queue: number[];
}

const KEY = (roomId: string) => `experience:would_you_rather:${roomId}`;

const VOTE_TIMEOUT_MS  = 30_000; // 30s voting window
const REVEAL_TIMEOUT_MS = 5_000; // 5s on reveal before auto-next

export class WouldYouRatherExperience implements ExperienceModule {
  readonly type = "would_you_rather" as const;
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  async onActivate(roomId: string, _hostGuestId: string): Promise<void> {
    const existing = await redisClient.get(KEY(roomId));
    if (existing) {
      const s: WouldYouRatherState = JSON.parse(existing);
      if (s.phase !== "waiting" && s.phase !== "finished") return;
    }
    const state: WouldYouRatherState = {
      phase: "waiting",
      round: 0,
      totalRounds: DILEMMAS.length,
      scores: {},
      currentQ: null,
      votes: {},
      aCount: 0,
      bCount: 0,
      queue: shuffledIndices(DILEMMAS.length),
    };
    await redisClient.set(KEY(roomId), JSON.stringify(state));
  }

  async onDeactivate(roomId: string): Promise<void> {
    const timer = this.timers.get(roomId);
    if (timer) { clearTimeout(timer); this.timers.delete(roomId); }
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
    const state: WouldYouRatherState = JSON.parse(raw);

    switch (action) {
      case "start": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        state.phase = "question";
        state.round = 1;
        state.queue = shuffledIndices(DILEMMAS.length);
        state.currentQ = DILEMMAS[state.queue[0]];
        state.votes = {};
        state.aCount = 0;
        state.bCount = 0;
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "would_you_rather",
          state,
          view: { type: "would_you_rather", data: state },
          sequenceId: seq,
        });
        this._armVoteTimer(roomId, io);
        break;
      }

      case "vote": {
        if (state.phase !== "question") return;
        const p = payload as { choice: "a" | "b" };
        if (!p?.choice || (p.choice !== "a" && p.choice !== "b")) return;
        // Allow re-voting — update previous vote counts
        const prev = state.votes[guestId];
        if (prev === "a") state.aCount = Math.max(0, state.aCount - 1);
        if (prev === "b") state.bCount = Math.max(0, state.bCount - 1);
        state.votes[guestId] = p.choice;
        if (p.choice === "a") state.aCount++;
        else state.bCount++;
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        // Broadcast updated vote counts (without revealing who voted what)
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "would_you_rather",
          state: { ...state, votes: {} }, // hide individual votes until reveal
          view: { type: "would_you_rather", data: { ...state, votes: {} } },
          sequenceId: seq,
        });
        break;
      }

      case "reveal": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        if (state.phase !== "question") return;
        const revTimer = this.timers.get(roomId);
        if (revTimer) { clearTimeout(revTimer); this.timers.delete(roomId); }
        // Tally: majority choice gets +200, minority gets +50
        const majority: "a" | "b" = state.aCount >= state.bCount ? "a" : "b";
        const minority: "a" | "b" = majority === "a" ? "b" : "a";
        for (const [voter, choice] of Object.entries(state.votes)) {
          const pts = choice === majority ? 200 : 50;
          state.scores[voter] = (state.scores[voter] ?? 0) + pts;
        }
        state.phase = "reveal";
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "would_you_rather",
          state,
          view: {
            type: "would_you_rather",
            data: { ...state, aCount: state.aCount, bCount: state.bCount, majority, minority },
          },
          sequenceId: seq,
        });
        this._armRevealTimer(roomId, io);
        break;
      }

      case "next": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        if (state.phase !== "reveal") return;
        const nextTimer = this.timers.get(roomId);
        if (nextTimer) { clearTimeout(nextTimer); this.timers.delete(roomId); }
        state.round += 1;
        if (state.round > state.totalRounds) {
          state.phase = "finished";
          state.currentQ = null;
          await redisClient.set(KEY(roomId), JSON.stringify(state));
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "would_you_rather",
            state,
            view: { type: "leaderboard", data: state.scores },
            sequenceId: seq,
          });
          await awardGameWin(io, state.scores, roomId).catch(() => {});
        } else {
          state.phase = "question";
          state.currentQ = DILEMMAS[state.queue[(state.round - 1) % state.queue.length]];
          state.votes = {};
          state.aCount = 0;
          state.bCount = 0;
          await redisClient.set(KEY(roomId), JSON.stringify(state));
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "would_you_rather",
            state,
            view: { type: "would_you_rather", data: state },
            sequenceId: seq,
          });
          this._armVoteTimer(roomId, io);
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
    const state: WouldYouRatherState = JSON.parse(raw);
    if (state.phase === "finished") return { type: "leaderboard", data: state.scores };
    return { type: "would_you_rather" as any, data: state };
  }

  async getBootstrapState(roomId: string): Promise<unknown> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }

  private _armVoteTimer(roomId: string, io: Server): void {
    const existing = this.timers.get(roomId);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      this.timers.delete(roomId);
      redisClient.get(KEY(roomId)).then(async (raw) => {
        if (!raw) return;
        const st: WouldYouRatherState = JSON.parse(raw);
        if (st.phase !== "question") return;
        // Auto-reveal: tally scores
        const majority: "a" | "b" = st.aCount >= st.bCount ? "a" : "b";
        const minority: "a" | "b" = majority === "a" ? "b" : "a";
        for (const [voter, choice] of Object.entries(st.votes)) {
          const pts = choice === majority ? 200 : 50;
          st.scores[voter] = (st.scores[voter] ?? 0) + pts;
        }
        st.phase = "reveal";
        await redisClient.set(KEY(roomId), JSON.stringify(st));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "would_you_rather",
          state: st,
          view: { type: "would_you_rather", data: { ...st, majority, minority } },
          sequenceId: seq,
        });
        this._armRevealTimer(roomId, io);
      }).catch(() => {});
    }, VOTE_TIMEOUT_MS);
    this.timers.set(roomId, t);
  }

  private _armRevealTimer(roomId: string, io: Server): void {
    const existing = this.timers.get(roomId);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      this.timers.delete(roomId);
      redisClient.get(KEY(roomId)).then(async (raw) => {
        if (!raw) return;
        const st: WouldYouRatherState = JSON.parse(raw);
        if (st.phase !== "reveal") return;
        st.round += 1;
        if (st.round > st.totalRounds) {
          st.phase = "finished";
          st.currentQ = null;
          await redisClient.set(KEY(roomId), JSON.stringify(st));
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "would_you_rather",
            state: st,
            view: { type: "leaderboard", data: st.scores },
            sequenceId: seq,
          });
          await awardGameWin(io, st.scores, roomId).catch(() => {});
        } else {
          st.phase = "question";
          st.currentQ = DILEMMAS[st.queue[(st.round - 1) % st.queue.length]];
          st.votes = {};
          st.aCount = 0;
          st.bCount = 0;
          await redisClient.set(KEY(roomId), JSON.stringify(st));
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "would_you_rather",
            state: st,
            view: { type: "would_you_rather", data: st },
            sequenceId: seq,
          });
          this._armVoteTimer(roomId, io);
        }
      }).catch(() => {});
    }, REVEAL_TIMEOUT_MS);
    this.timers.set(roomId, t);
  }
}
