import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";
import { shuffledIndices } from "../../lib/shuffle";

// ─────────────────────────────────────────────────────────────────────────────
// Emoji Story Experience
//
// A sequence of emojis represents a famous movie, song, or phrase.
// First guest to guess correctly earns 200 pts. Using a hint costs 100 pts.
//
// Actions:
//   HOST/CO_HOST: start, next, end_game, end
//   GUEST:        guess, use_hint
// ─────────────────────────────────────────────────────────────────────────────

const KEY = (roomId: string) => `experience:emoji_story:${roomId}`;

// ─── Content ─────────────────────────────────────────────────────────────────

interface EmojiPuzzle {
  emojis: string;
  answer: string;
  hint: string;
}

const PUZZLES: EmojiPuzzle[] = [
  { emojis: "🦁👑", answer: "The Lion King", hint: "Animated Disney classic" },
  { emojis: "🕷️🕸️👨", answer: "Spider-Man", hint: "Marvel superhero" },
  { emojis: "🧊❄️👸", answer: "Frozen", hint: "Disney movie with Let It Go" },
  { emojis: "🔫🌊🕵️", answer: "James Bond", hint: "British secret agent" },
  { emojis: "🍕🐢🥷", answer: "Teenage Mutant Ninja Turtles", hint: "Pizza-loving heroes in a half shell" },
  { emojis: "🧙‍♂️💍🗻", answer: "Lord of the Rings", hint: "J.R.R. Tolkien epic" },
  { emojis: "🚂⏰🔙", answer: "Back to the Future", hint: "Great Scott!" },
  { emojis: "🦈🎵😱", answer: "Jaws", hint: "Steven Spielberg thriller" },
  // ── Movies ────────────────────────────────────────────────────────────────
  { emojis: "🚢🧊💔🌊", answer: "Titanic", hint: "Jack and Rose" },
  { emojis: "🐠🔍🌊", answer: "Finding Nemo", hint: "Pixar underwater adventure" },
  { emojis: "👾🎮👾", answer: "Space Invaders", hint: "Classic arcade game" },
  { emojis: "🤖❤️🌿", answer: "Wall-E", hint: "Pixar robot romance" },
  { emojis: "👻🍬🏠", answer: "Halloween", hint: "Horror classic" },
  { emojis: "🦖🌿😱", answer: "Jurassic Park", hint: "Dinosaurs escape" },
  { emojis: "🌀💊🔴🔵", answer: "The Matrix", hint: "Red pill or blue pill" },
  { emojis: "🧸❤️🚀", answer: "Toy Story", hint: "To infinity and beyond" },
  { emojis: "🐉🧒🚁", answer: "How to Train Your Dragon", hint: "Viking and his dragon" },
  { emojis: "👩‍🎤🎸🔊", answer: "Coco", hint: "Day of the Dead music movie" },
  { emojis: "🐀👨‍🍳🍽️", answer: "Ratatouille", hint: "Rat who loves cooking" },
  { emojis: "🌏🌍🌎🍃", answer: "Avatar", hint: "Blue aliens on Pandora" },
  { emojis: "🃏😈😂", answer: "Joker", hint: "DC Comics villain origin" },
  { emojis: "🕰️🌀👴", answer: "Interstellar", hint: "Space and time travel" },
  { emojis: "🧟‍♂️🌍💀", answer: "28 Days Later", hint: "UK zombie apocalypse" },
  { emojis: "🌹🕰️👹", answer: "Beauty and the Beast", hint: "Be our guest" },
  { emojis: "🧂🍿🌽🎬", answer: "Parasite", hint: "Korean Oscar winner" },
  { emojis: "🌊🏄‍♂️👮", answer: "Point Break", hint: "FBI agent goes surfing" },
  { emojis: "💃🌹🎭", answer: "Moulin Rouge", hint: "Bohemian Paris love story" },
  { emojis: "🪂💼🔫", answer: "Mission Impossible", hint: "Your mission, should you choose to accept it" },
  { emojis: "🦅🇺🇸💥", answer: "Top Gun", hint: "I feel the need for speed" },
  { emojis: "🌪️🏠👠", answer: "The Wizard of Oz", hint: "There's no place like home" },
  { emojis: "🐘🎪🎠", answer: "Dumbo", hint: "Flying elephant" },
  { emojis: "🎪🤡😱", answer: "IT", hint: "Stephen King clown horror" },
  { emojis: "🧠💊👴", answer: "Limitless", hint: "100% brain capacity pill" },
  // ── TV Shows ──────────────────────────────────────────────────────────────
  { emojis: "👔💰🧪", answer: "Breaking Bad", hint: "Chemistry teacher turned drug lord" },
  { emojis: "🐉❄️⚔️🏰", answer: "Game of Thrones", hint: "HBO fantasy epic" },
  { emojis: "🏝️✈️💥", answer: "Lost", hint: "Survivors on a mysterious island" },
  { emojis: "🌮🎤😂", answer: "Brooklyn Nine-Nine", hint: "NYPD comedy" },
  { emojis: "🧪👩‍🔬💥", answer: "The Big Bang Theory", hint: "Nerdy physicists and their neighbours" },
  { emojis: "💍👰💔", answer: "Love Island", hint: "UK reality dating show" },
  { emojis: "🏥🩺❤️", answer: "Grey's Anatomy", hint: "Medical drama in Seattle" },
  { emojis: "🕵️🔍🧠", answer: "Sherlock", hint: "BBC detective drama" },
  { emojis: "🌲🏕️☕", answer: "Twin Peaks", hint: "Who killed Laura Palmer?" },
  { emojis: "🦷💊😬", answer: "The Bear", hint: "Stressful kitchen drama" },
  { emojis: "💻🖥️🏢", answer: "Severance", hint: "Work and life are separated" },
  { emojis: "🎻🎶💔", answer: "The Crown", hint: "British royal family drama" },
  { emojis: "🕰️👩‍🍳🇫🇷", answer: "Emily in Paris", hint: "American in Paris" },
  { emojis: "👨‍👩‍👧‍👦🏘️😅", answer: "Modern Family", hint: "Three family types, one show" },
  { emojis: "🏫🧑‍🎓📚😅", answer: "Skins", hint: "UK teen drama" },
  { emojis: "🎭🎪🌪️", answer: "Black Mirror", hint: "Tech dystopia anthology" },
  // ── Songs ─────────────────────────────────────────────────────────────────
  { emojis: "☀️🕶️😎", answer: "Here Comes the Sun", hint: "The Beatles" },
  { emojis: "👧💃🎶🌙", answer: "Girls Just Want to Have Fun", hint: "Cyndi Lauper" },
  { emojis: "🎵🔥👋", answer: "Hotline Bling", hint: "Drake" },
  { emojis: "🌊🏄🎸", answer: "Surfin' USA", hint: "The Beach Boys" },
  { emojis: "💎💎💎", answer: "Diamonds", hint: "Rihanna" },
  { emojis: "🚀🌠🌙", answer: "Rocket Man", hint: "Elton John" },
  { emojis: "💜🌧️🎸", answer: "Purple Rain", hint: "Prince" },
  { emojis: "🌈🎵😊", answer: "Happy", hint: "Pharrell Williams" },
  { emojis: "🎂🎵🎉", answer: "Birthday", hint: "Katy Perry" },
  { emojis: "🕶️😎🚶‍♂️", answer: "Cool", hint: "Dua Lipa" },
  // ── Phrases & Idioms ─────────────────────────────────────────────────────
  { emojis: "🌧️🌈", answer: "Every cloud has a silver lining", hint: "Optimism phrase" },
  { emojis: "🐄💤🐄", answer: "Don't have a cow", hint: "Don't overreact" },
  { emojis: "🐘🏠", answer: "Elephant in the room", hint: "Obvious unaddressed issue" },
  { emojis: "🦊💤🐓", answer: "Don't let the fox guard the henhouse", hint: "Dangerous responsibility" },
  { emojis: "🎯🏹", answer: "Hit the bullseye", hint: "Exactly right" },
  { emojis: "🍰🎂🎉", answer: "Piece of cake", hint: "Very easy" },
  { emojis: "💡🧠", answer: "Bright idea", hint: "Good thinking" },
  { emojis: "🌑🌕🌑", answer: "Once in a blue moon", hint: "Very rarely" },
  { emojis: "🐦⏰", answer: "Early bird", hint: "Gets the worm" },
  { emojis: "🔥🍳", answer: "Too many cooks spoil the broth", hint: "Too many people involved" },
  { emojis: "🧗‍♂️⛰️", answer: "Mountain out of a molehill", hint: "Overreacting to something small" },
  { emojis: "🌊🏊‍♂️🦈", answer: "Swim with the sharks", hint: "Operate in a dangerous environment" },
  { emojis: "😴💤🐻", answer: "Let sleeping dogs lie", hint: "Don't stir up old problems" },
  { emojis: "🐛🦋", answer: "Butterflies in your stomach", hint: "Nervousness" },
  { emojis: "💨🌬️🌹", answer: "Gone with the wind", hint: "Famous film title" },
];

// ─── State ────────────────────────────────────────────────────────────────────

interface EmojiStoryState {
  phase: "waiting" | "question" | "reveal" | "finished";
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
  currentPuzzle: { emojis: string; answer: string; hint?: string } | null;
  guesses: Record<string, string>;        // guestId → their guess text
  hintUsed: Record<string, boolean>;      // guestId → whether they bought the hint
  winner: string | null;                  // guestId of first correct guesser
  queue: number[];
}

export class EmojiStoryExperience implements ExperienceModule {
  readonly type = "emoji_story" as const;

  async onActivate(roomId: string): Promise<void> {
    const state: EmojiStoryState = {
      phase: "waiting",
      round: 0,
      totalRounds: 8,
      scores: {},
      currentPuzzle: null,
      guesses: {},
      hintUsed: {},
      winner: null,
      queue: shuffledIndices(PUZZLES.length),
    };
    await this._save(roomId, state);
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

      // ─── HOST: Start the game ──────────────────────────────────────────
      case "start": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        const state = await this._load(roomId);
        if (!state) return;

        state.queue = shuffledIndices(PUZZLES.length);
        const puzzle = PUZZLES[state.queue[0]];
        state.phase = "question";
        state.round = 1;
        state.scores = {};
        state.currentPuzzle = { emojis: puzzle.emojis, answer: puzzle.answer, hint: puzzle.hint };
        state.guesses = {};
        state.hintUsed = {};
        state.winner = null;

        await this._save(roomId, state);
        await this._broadcastSafe(roomId, state, io);
        break;
      }

      // ─── GUEST: Submit a guess ─────────────────────────────────────────
      case "guess": {
        const state = await this._load(roomId);
        if (!state || state.phase !== "question" || !state.currentPuzzle) return;

        const guess: string = (p.guess ?? "").trim();
        state.guesses[guestId] = guess;

        const isCorrect = guess.toLowerCase().includes(state.currentPuzzle.answer.toLowerCase())
          || state.currentPuzzle.answer.toLowerCase().includes(guess.toLowerCase());

        if (isCorrect && !state.winner) {
          state.winner = guestId;
          state.scores[guestId] = (state.scores[guestId] ?? 0) + 200;
        }

        await this._save(roomId, state);

        // Broadcast the full state (without answer) so everyone can see guess count
        await this._broadcastSafe(roomId, state, io);
        break;
      }

      // ─── GUEST: Use a hint (costs 100 pts) ────────────────────────────
      case "use_hint": {
        const state = await this._load(roomId);
        if (!state || state.phase !== "question") return;
        if (state.hintUsed[guestId]) return; // Already used hint this round

        state.hintUsed[guestId] = true;
        state.scores[guestId] = (state.scores[guestId] ?? 0) - 100;
        await this._save(roomId, state);

        // Send hint only to the requesting guest
        const seq = await getNextSequenceId(roomId);
        io.to(guestId).emit("experience:state" as any, {
          experienceType: "emoji_story",
          state: { ...this._safeState(state), hint: state.currentPuzzle?.hint ?? "" },
          view: { type: "emoji_story" as any, data: state },
          sequenceId: seq,
        });
        break;
      }

      // ─── HOST: Advance to next round ───────────────────────────────────
      case "next": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        const state = await this._load(roomId);
        if (!state) return;

        state.round += 1;

        if (state.round > state.totalRounds) {
          state.phase = "finished";
          state.currentPuzzle = null;
        } else {
          const puzzleIdx = state.queue[(state.round - 1) % state.queue.length];
          const puzzle = PUZZLES[puzzleIdx];
          state.phase = "question";
          state.currentPuzzle = { emojis: puzzle.emojis, answer: puzzle.answer, hint: puzzle.hint };
          state.guesses = {};
          state.hintUsed = {};
          state.winner = null;
        }

        await this._save(roomId, state);
        await this._broadcastSafe(roomId, state, io);
        break;
      }

      // ─── HOST: End game ────────────────────────────────────────────────
      case "end_game": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        const state = await this._load(roomId);
        if (!state) return;

        state.phase = "finished";
        state.currentPuzzle = null;
        await this._save(roomId, state);
        await this._broadcast(roomId, state, io);
        break;
      }

      // ─── HOST: Return to DJ experience ────────────────────────────────
      case "end": {
        if (role !== "HOST" && role !== "CO_HOST") return;
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
    const state = await this._load(roomId);
    if (!state) return { type: "intermission" };
    return { type: "emoji_story" as any, data: this._safeState(state) };
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  /** Strip the answer from currentPuzzle so guests cannot cheat */
  private _safeState(state: EmojiStoryState): Omit<EmojiStoryState, "currentPuzzle"> & {
    currentPuzzle: { emojis: string } | null;
  } {
    const { currentPuzzle, ...rest } = state;
    return {
      ...rest,
      currentPuzzle: currentPuzzle ? { emojis: currentPuzzle.emojis } : null,
    };
  }

  /** Broadcast without answer */
  private async _broadcastSafe(roomId: string, state: EmojiStoryState, io: Server): Promise<void> {
    const seq = await getNextSequenceId(roomId);
    const safe = this._safeState(state);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "emoji_story",
      state: safe,
      view: { type: "emoji_story" as any, data: safe },
      sequenceId: seq,
    });
  }

  /** Broadcast full state (reveal phase, host) */
  private async _broadcast(roomId: string, state: EmojiStoryState, io: Server): Promise<void> {
    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "emoji_story",
      state,
      view: { type: "emoji_story" as any, data: state },
      sequenceId: seq,
    });
  }

  private async _load(roomId: string): Promise<EmojiStoryState | null> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }

  private async _save(roomId: string, state: EmojiStoryState): Promise<void> {
    await redisClient.set(KEY(roomId), JSON.stringify(state), { EX: 14400 });
  }
}
