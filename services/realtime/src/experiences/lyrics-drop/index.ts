import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";
import { shuffledIndices } from "../../lib/shuffle";

interface LyricsDropState {
  phase: "waiting" | "question" | "reveal" | "finished";
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
  currentLyric: { text: string; blank: string; answer: string; hint: string } | null;
  guesses: Record<string, string>;
  questionStartedAt: number;
  queue: number[];
}

const LYRICS = [
  { text: "Is this the real life? Is this just ___?", blank: "___", answer: "fantasy", hint: "Bohemian Rhapsody — Queen" },
  { text: "I kissed a girl and I liked ___, the taste of her cherry chapstick", blank: "___", answer: "it", hint: "I Kissed a Girl — Katy Perry" },
  { text: "Rolling in the ___, your sins and your lies were always on my mind", blank: "___", answer: "deep", hint: "Rolling in the Deep — Adele" },
  { text: "We will, we will ___ you", blank: "___", answer: "rock", hint: "We Will Rock You — Queen" },
  { text: "I got 99 problems but a ___ ain't one", blank: "___", answer: "bitch", hint: "99 Problems — Jay-Z" },
  { text: "Shake it ___, shake it off", blank: "___", answer: "off", hint: "Shake It Off — Taylor Swift" },
  { text: "I will always love ___", blank: "___", answer: "you", hint: "I Will Always Love You — Whitney Houston" },
  { text: "Don't stop ___, hold on to the feeling", blank: "___", answer: "believin'", hint: "Don't Stop Believin' — Journey" },
  // ── Classic Rock & Pop ────────────────────────────────────────────────────
  { text: "Sweet child o' ___, sweet child of mine", blank: "___", answer: "mine", hint: "Sweet Child O' Mine — Guns N' Roses" },
  { text: "I can't get no ___", blank: "___", answer: "satisfaction", hint: "Satisfaction — The Rolling Stones" },
  { text: "Like a ___ touched for the very first time", blank: "___", answer: "virgin", hint: "Like a Virgin — Madonna" },
  { text: "Every ___ you take, every move you make, I'll be watching you", blank: "___", answer: "breath", hint: "Every Breath You Take — The Police" },
  { text: "Hit me baby one more ___", blank: "___", answer: "time", hint: "...Baby One More Time — Britney Spears" },
  { text: "It's gonna be ___, 'cause I trust in you", blank: "___", answer: "me", hint: "It's Gonna Be Me — *NSYNC" },
  { text: "She's got a ___ in her heart and she knows how to use it", blank: "___", answer: "ticket", hint: "She's Got a Ticket to Ride — The Beatles" },
  { text: "Living on a ___, woah, we're halfway there", blank: "___", answer: "prayer", hint: "Livin' on a Prayer — Bon Jovi" },
  { text: "I want to break ___", blank: "___", answer: "free", hint: "I Want to Break Free — Queen" },
  { text: "With or without ___, I can't live with or without you", blank: "___", answer: "you", hint: "With or Without You — U2" },
  { text: "She's just a girl and she's on ___", blank: "___", answer: "fire", hint: "Girl on Fire — Alicia Keys" },
  { text: "I'm ___ and I know it", blank: "___", answer: "sexy", hint: "Sexy and I Know It — LMFAO" },
  { text: "You're so vain, you probably think this ___ is about you", blank: "___", answer: "song", hint: "You're So Vain — Carly Simon" },
  { text: "Call me maybe", blank: "", answer: "call me maybe", hint: "Call Me Maybe — Carly Rae Jepsen (full title)" },
  { text: "I'm never gonna give you up, never gonna let you ___", blank: "___", answer: "down", hint: "Never Gonna Give You Up — Rick Astley" },
  { text: "You shook me all night ___", blank: "___", answer: "long", hint: "You Shook Me All Night Long — AC/DC" },
  { text: "Another one ___ the dust", blank: "___", answer: "bites", hint: "Another One Bites the Dust — Queen" },
  { text: "Every little thing she does is ___", blank: "___", answer: "magic", hint: "Every Little Thing She Does Is Magic — The Police" },
  { text: "Come on Eileen, too-ra-loo-ra too-ra-loo-___", blank: "___", answer: "rye-ay", hint: "Come On Eileen — Dexys Midnight Runners" },
  { text: "Just a small town ___, livin' in a lonely world", blank: "___", answer: "girl", hint: "Don't Stop Believin' — Journey" },
  // ── 2000s & 2010s ─────────────────────────────────────────────────────────
  { text: "I'm bringing ___ back, them other boys don't know how to act", blank: "___", answer: "sexy", hint: "SexyBack — Justin Timberlake" },
  { text: "We found love in a ___ place", blank: "___", answer: "hopeless", hint: "We Found Love — Rihanna ft. Calvin Harris" },
  { text: "I knew you were ___ when you walked in", blank: "___", answer: "trouble", hint: "I Knew You Were Trouble — Taylor Swift" },
  { text: "Somebody that I used to ___", blank: "___", answer: "know", hint: "Somebody That I Used to Know — Gotye" },
  { text: "All the ___ ladies, now put your hands up", blank: "___", answer: "single", hint: "Single Ladies — Beyoncé" },
  { text: "Baby I'm not afraid of the dark, shine the light on me, I'm ___ of you", blank: "___", answer: "not afraid", hint: "Halo — Beyoncé" },
  { text: "Under your ___-ella-ella-eh", blank: "___", answer: "umbr", hint: "Umbrella — Rihanna" },
  { text: "I threw a wish in the well, don't ask me I'll never ___", blank: "___", answer: "tell", hint: "Call Me Maybe — Carly Rae Jepsen" },
  { text: "I'm walking on ___", blank: "___", answer: "sunshine", hint: "Walking on Sunshine — Katrina and the Waves" },
  { text: "Uptown ___, she's been living in her uptown world", blank: "___", answer: "girl", hint: "Uptown Girl — Billy Joel" },
  { text: "Take on ___, I'll be gone in a day or two", blank: "___", answer: "me", hint: "Take On Me — A-ha" },
  { text: "Wake me up before you ___, don't leave me hanging on like a yo-yo", blank: "___", answer: "go-go", hint: "Wake Me Up Before You Go-Go — Wham!" },
  { text: "I'm just a poor ___, nobody loves me", blank: "___", answer: "boy", hint: "Bohemian Rhapsody — Queen" },
  { text: "Livin' la vida ___", blank: "___", answer: "loca", hint: "Livin' La Vida Loca — Ricky Martin" },
  { text: "I like big ___ and I cannot lie", blank: "___", answer: "butts", hint: "Baby Got Back — Sir Mix-a-Lot" },
  // ── Modern Hits ───────────────────────────────────────────────────────────
  { text: "I'm in my ___-girl era", blank: "___", answer: "best", hint: "Best Part — Daniel Caesar... or general phrase" },
  { text: "As it ___", blank: "___", answer: "was", hint: "As It Was — Harry Styles" },
  { text: "Anti-___ loneliness", blank: "___", answer: "hero", hint: "Anti-Hero — Taylor Swift" },
  { text: "Flowers, I can buy myself ___", blank: "___", answer: "flowers", hint: "Flowers — Miley Cyrus" },
  { text: "Escapism, that's all I ___", blank: "___", answer: "need", hint: "Escapism — RAYE ft. 070 Shake" },
  { text: "I'm a ___, baby so why don't you kill me", blank: "___", answer: "creep", hint: "Creep — Radiohead" },
  { text: "Bad guy — ___, duh", blank: "___", answer: "I'm the", hint: "Bad Guy — Billie Eilish" },
  { text: "Dance ___, let's dance the night away", blank: "___", answer: "the night", hint: "Dance the Night — Dua Lipa" },
  { text: "Running up that hill, make a deal with ___", blank: "___", answer: "God", hint: "Running Up That Hill — Kate Bush" },
  { text: "Levitating, I got you ___ under my skin", blank: "___", answer: "moonlight", hint: "Levitating — Dua Lipa" },
  { text: "Good 4 ___, I wish you all the best", blank: "___", answer: "u", hint: "Good 4 U — Olivia Rodrigo" },
  { text: "Driver's ___, I got a long drive", blank: "___", answer: "license", hint: "drivers license — Olivia Rodrigo" },
  // ── Deep Cuts & Harder ────────────────────────────────────────────────────
  { text: "I was running through the creak in the ___", blank: "___", answer: "6 with my woes", hint: "Know Yourself — Drake" },
  { text: "I'm in the corner watching you ___ me over", blank: "___", answer: "kiss", hint: "Kiss Me — Six Pence None the Richer" },
  { text: "And I don't want the world to see me, cos I don't think that they'd ___", blank: "___", answer: "understand", hint: "Iris — Goo Goo Dolls" },
  { text: "Mr. ___, seemed so cool in every way", blank: "___", answer: "Brightside", hint: "Mr. Brightside — The Killers" },
  { text: "I've been reading books of old, the ___ and the bold", blank: "___", answer: "legends", hint: "Viva la Vida — Coldplay" },
  { text: "Yellow ___, yellow brick road", blank: "___", answer: "brick", hint: "Goodbye Yellow Brick Road — Elton John" },
  { text: "Ground control to Major ___", blank: "___", answer: "Tom", hint: "Space Oddity — David Bowie" },
  { text: "You're a ___ girl living in a material world", blank: "___", answer: "material", hint: "Material Girl — Madonna" },
  { text: "Never gonna make you cry, never gonna say ___", blank: "___", answer: "goodbye", hint: "Never Gonna Give You Up — Rick Astley" },
  { text: "Clocks, the city ___", blank: "___", answer: "sleeps", hint: "The Scientist — Coldplay" },
  { text: "Somewhere only we ___", blank: "___", answer: "know", hint: "Somewhere Only We Know — Keane" },
  { text: "There's a ___ in the sky with diamonds", blank: "___", answer: "lady", hint: "Lucy in the Sky with Diamonds — The Beatles" },
  { text: "Hey, I just met you and this is ___", blank: "___", answer: "crazy", hint: "Call Me Maybe — Carly Rae Jepsen" },
  { text: "Cause I gotta have ___, just like that old-time rock and roll", blank: "___", answer: "faith", hint: "Old Time Rock and Roll — Bob Seger" },
  { text: "She told me to walk this way, talk this ___", blank: "___", answer: "way", hint: "Walk This Way — Aerosmith / Run DMC" },
  { text: "I'm a ___ on the highway of love", blank: "___", answer: "train", hint: "Take the Long Way Home — Supertramp" },
  { text: "Roxanne, you don't have to put on the ___", blank: "___", answer: "red light", hint: "Roxanne — The Police" },
  { text: "Africa, I stopped an old man along the way, hoping to find some long forgotten ___", blank: "___", answer: "words or ancient melodies", hint: "Africa — Toto" },
  { text: "Mama, life had just begun, but now I've gone and thrown it all ___", blank: "___", answer: "away", hint: "Bohemian Rhapsody — Queen" },
  { text: "I would do anything for love, but I won't do ___", blank: "___", answer: "that", hint: "I'd Do Anything for Love — Meat Loaf" },
];

const KEY = (roomId: string) => `experience:lyrics_drop:${roomId}`;

export class LyricsDropExperience implements ExperienceModule {
  readonly type = "lyrics_drop" as const;

  async onActivate(roomId: string): Promise<void> {
    const state: LyricsDropState = {
      phase: "waiting", round: 0, totalRounds: LYRICS.length,
      scores: {}, currentLyric: null, guesses: {}, questionStartedAt: 0,
      queue: shuffledIndices(LYRICS.length),
    };
    await redisClient.set(KEY(roomId), JSON.stringify(state));
  }

  async onDeactivate(roomId: string): Promise<void> {
    await redisClient.del(KEY(roomId));
  }

  async handleAction({ action, payload, roomId, guestId, role, io }: {
    action: string; payload: unknown; roomId: string; guestId: string;
    role: "HOST" | "CO_HOST" | "GUEST"; io: Server;
  }): Promise<void> {
    const raw = await redisClient.get(KEY(roomId));
    if (!raw) return;
    const state: LyricsDropState = JSON.parse(raw);

    switch (action) {
      case "start": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        state.round = 1;
        state.queue = shuffledIndices(LYRICS.length);
        state.currentLyric = LYRICS[state.queue[0]];
        state.guesses = {};
        state.phase = "question";
        state.questionStartedAt = Date.now();
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "lyrics_drop", state,
          view: { type: "lyrics_drop" as any, data: state }, sequenceId: seq,
        });
        break;
      }
      case "guess": {
        if (state.phase !== "question") return;
        const word = ((payload as any).word as string ?? "").trim().toLowerCase();
        state.guesses[guestId] = word;
        const correct = state.currentLyric?.answer.toLowerCase() ?? "";
        if (word === correct) {
          const elapsed = Date.now() - state.questionStartedAt;
          const timeBonus = Math.max(0, Math.round((15000 - elapsed) / 150));
          state.scores[guestId] = (state.scores[guestId] ?? 0) + 100 + timeBonus;
        }
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "lyrics_drop", state,
          view: { type: "lyrics_drop" as any, data: state }, sequenceId: seq,
        });
        break;
      }
      case "reveal": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        state.phase = "reveal";
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "lyrics_drop", state,
          view: { type: "lyrics_drop" as any, data: state }, sequenceId: seq,
        });
        setTimeout(async () => {
          try {
            const raw2 = await redisClient.get(KEY(roomId));
            const st: LyricsDropState | null = raw2 ? JSON.parse(raw2) : null;
            if (st?.phase === "reveal") {
              const seqLb = await getNextSequenceId(roomId);
              io.to(roomId).emit("experience:state" as any, {
                experienceType: "lyrics_drop",
                state: st,
                view: { type: "leaderboard", data: st.scores },
                sequenceId: seqLb,
              });
            }
          } catch {}
          setTimeout(() => this.handleAction({ action: "next", payload: {}, roomId, guestId: "", role: "HOST", io }).catch(() => {}), 3000);
        }, 4000);
        break;
      }
      case "next": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        if (state.phase !== "reveal") return;
        state.round += 1;
        if (state.round > state.totalRounds) {
          state.phase = "finished";
          await redisClient.set(KEY(roomId), JSON.stringify(state));
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "lyrics_drop", state,
            view: { type: "leaderboard", data: state.scores }, sequenceId: seq,
          });
        } else {
          state.currentLyric = LYRICS[state.queue[(state.round - 1) % state.queue.length]];
          state.guesses = {};
          state.phase = "question";
          state.questionStartedAt = Date.now();
          await redisClient.set(KEY(roomId), JSON.stringify(state));
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "lyrics_drop", state,
            view: { type: "lyrics_drop" as any, data: state }, sequenceId: seq,
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
          experienceType: "dj", view: { type: "dj_queue" }, sequenceId: seq,
        });
        break;
      }
    }
  }

  async getGuestViewDescriptor(roomId: string): Promise<GuestViewDescriptor> {
    const raw = await redisClient.get(KEY(roomId));
    if (!raw) return { type: "intermission" };
    const state: LyricsDropState = JSON.parse(raw);
    if (state.phase === "finished") return { type: "leaderboard", data: state.scores };
    return { type: "lyrics_drop" as any, data: state };
  }
}
