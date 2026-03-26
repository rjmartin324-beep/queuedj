import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";

// ─────────────────────────────────────────────────────────────────────────────
// Pop Culture Quiz Experience
//
// Like trivia but focused on TV, Film, Music, and Social media categories.
// Host starts/reveals/advances. Guests answer within 12 seconds for speed bonus.
//
// Actions:
//   HOST:  start, reveal, next, end
//   GUEST: answer
// ─────────────────────────────────────────────────────────────────────────────

const KEY = (roomId: string) => `experience:pop_culture_quiz:${roomId}`;
const ANSWER_WINDOW_MS = 12_000; // 12s max for speed bonus

interface PopCultureQuestion {
  text: string;
  options: [string, string, string, string];
  correct: number; // 0-3
  category: "TV" | "Film" | "Music" | "Social";
}

interface PopCultureQuizState {
  phase: "waiting" | "question" | "reveal" | "finished";
  round: number;
  totalRounds: number;
  scores: Record<string, number>;
  currentQ: (PopCultureQuestion & { index: number }) | null;
  answers: Record<string, number>; // guestId -> option index (server only)
  questionStartedAt: number;
}

const QUESTIONS: PopCultureQuestion[] = [
  {
    text: "Which show features a chemistry teacher who becomes a drug lord?",
    options: ["Ozark", "Breaking Bad", "Dexter", "Narcos"],
    correct: 1,
    category: "TV",
  },
  {
    text: "What year did the first iPhone launch?",
    options: ["2005", "2006", "2007", "2008"],
    correct: 2,
    category: "Social",
  },
  {
    text: "Which artist released the album 'Renaissance' in 2022?",
    options: ["Rihanna", "Adele", "Beyoncé", "Taylor Swift"],
    correct: 2,
    category: "Music",
  },
  {
    text: "In which film does a boy see dead people?",
    options: ["Poltergeist", "The Others", "The Sixth Sense", "Hereditary"],
    correct: 2,
    category: "Film",
  },
  {
    text: "What platform is known for short-form vertical videos with a 'For You' page?",
    options: ["Instagram", "Snapchat", "TikTok", "YouTube Shorts"],
    correct: 2,
    category: "Social",
  },
  {
    text: "Which band performed 'Mr. Brightside'?",
    options: ["The Strokes", "The Killers", "Arctic Monkeys", "Interpol"],
    correct: 1,
    category: "Music",
  },
  {
    text: "In 'Game of Thrones', what is the name of Jon Snow's direwolf?",
    options: ["Nymeria", "Ghost", "Grey Wind", "Lady"],
    correct: 1,
    category: "TV",
  },
  {
    text: "Which movie features the line 'I am Groot'?",
    options: ["Thor: Ragnarok", "Avengers: Infinity War", "Guardians of the Galaxy", "Black Panther"],
    correct: 2,
    category: "Film",
  },
  {
    text: "Which social media platform uses the term 'tweet'?",
    options: ["Facebook", "Twitter / X", "LinkedIn", "Reddit"],
    correct: 1,
    category: "Social",
  },
  {
    text: "Which artist's tour was called 'The Eras Tour'?",
    options: ["Billie Eilish", "Olivia Rodrigo", "Taylor Swift", "Doja Cat"],
    correct: 2,
    category: "Music",
  },
  // ── Added questions to reach 60 total ──────────────────────────────────────
  {
    text: "Which Netflix show features a group of kids in Hawkins, Indiana fighting supernatural forces?",
    options: ["The OA", "Dark", "Stranger Things", "Manifest"],
    correct: 2,
    category: "TV",
  },
  {
    text: "What was the highest-grossing film of 2019 worldwide?",
    options: ["The Lion King", "Avengers: Endgame", "Frozen 2", "Spider-Man: Far From Home"],
    correct: 1,
    category: "Film",
  },
  {
    text: "Which rapper released the album 'Certified Lover Boy' in 2021?",
    options: ["Kanye West", "Travis Scott", "Drake", "J. Cole"],
    correct: 2,
    category: "Music",
  },
  {
    text: "The 'Ice Bucket Challenge' viral moment raised awareness for which disease?",
    options: ["Multiple Sclerosis", "Parkinson's Disease", "ALS", "Muscular Dystrophy"],
    correct: 2,
    category: "Social",
  },
  {
    text: "Which HBO show follows the Roy family and their battle for control of a media empire?",
    options: ["Billions", "Succession", "Yellowstone", "The Crown"],
    correct: 1,
    category: "TV",
  },
  {
    text: "Cardi B and Megan Thee Stallion's 2020 hit was called what?",
    options: ["Up", "WAP", "Bodak Yellow", "Savage"],
    correct: 1,
    category: "Music",
  },
  {
    text: "Which film won the Oscar for Best Picture at the 2020 Academy Awards?",
    options: ["1917", "Joker", "Once Upon a Time in Hollywood", "Parasite"],
    correct: 3,
    category: "Film",
  },
  {
    text: "Which app exploded in popularity as a video-calling platform during the 2020 pandemic?",
    options: ["Skype", "Zoom", "Google Meet", "FaceTime"],
    correct: 1,
    category: "Social",
  },
  {
    text: "In 'Euphoria', what actress plays the lead character Rue?",
    options: ["Milly Alcock", "Hunter Schafer", "Zendaya", "Sydney Sweeney"],
    correct: 2,
    category: "TV",
  },
  {
    text: "Which Billie Eilish song was the James Bond theme for 'No Time to Die'?",
    options: ["Ocean Eyes", "No Time to Die", "Happier Than Ever", "Bad Guy"],
    correct: 1,
    category: "Music",
  },
  {
    text: "The 'Distracted Boyfriend' meme format originated from a stock photo taken in which country?",
    options: ["Italy", "Spain", "Germany", "Portugal"],
    correct: 1,
    category: "Social",
  },
  {
    text: "Which Disney+ series follows the Mandalorian bounty hunter and 'Baby Yoda'?",
    options: ["Andor", "The Book of Boba Fett", "The Mandalorian", "Obi-Wan Kenobi"],
    correct: 2,
    category: "TV",
  },
  {
    text: "Olivia Rodrigo's debut single 'drivers license' was released in what year?",
    options: ["2019", "2020", "2021", "2022"],
    correct: 2,
    category: "Music",
  },
  {
    text: "Which film stars Joaquin Phoenix as the iconic DC villain?",
    options: ["Batman", "Joker", "Venom", "The Dark Knight"],
    correct: 1,
    category: "Film",
  },
  {
    text: "Who won the 2023 Super Bowl MVP award?",
    options: ["Jalen Hurts", "Patrick Mahomes", "Travis Kelce", "Brock Purdy"],
    correct: 1,
    category: "Social",
  },
  {
    text: "Which Netflix series became a global sensation featuring a childhood game with deadly stakes?",
    options: ["Alice in Borderland", "Sweet Home", "Squid Game", "All of Us Are Dead"],
    correct: 2,
    category: "TV",
  },
  {
    text: "Adele's album '30' was released in which year?",
    options: ["2019", "2020", "2021", "2022"],
    correct: 2,
    category: "Music",
  },
  {
    text: "Which Marvel film introduced the multiverse concept prominently to the MCU?",
    options: ["Doctor Strange", "Spider-Man: No Way Home", "Loki", "WandaVision"],
    correct: 1,
    category: "Film",
  },
  {
    text: "What viral 2020 TikTok trend involved people recreating professional scenes at home?",
    options: ["Renegade", "The Savage Challenge", "The Flip the Switch Challenge", "Cottagecore"],
    correct: 2,
    category: "Social",
  },
  {
    text: "In 'Ted Lasso', what sport does Ted coach?",
    options: ["Rugby", "Cricket", "Football (Soccer)", "American Football"],
    correct: 2,
    category: "TV",
  },
  {
    text: "Which artist released 'Bad Guy', a Grammy-winning single, in 2019?",
    options: ["Lizzo", "Lorde", "Billie Eilish", "Halsey"],
    correct: 2,
    category: "Music",
  },
  {
    text: "In 'Avengers: Infinity War', which character says 'I am inevitable'?",
    options: ["Loki", "Thanos", "Ultron", "Red Skull"],
    correct: 1,
    category: "Film",
  },
  {
    text: "Which social platform introduced 'Stories' before all the others copied it?",
    options: ["Facebook", "Instagram", "Snapchat", "Twitter"],
    correct: 2,
    category: "Social",
  },
  {
    text: "Harry Styles' 2022 album was titled what?",
    options: ["Fine Line", "Harry's House", "One Direction", "Watermelon Sugar"],
    correct: 1,
    category: "Music",
  },
  {
    text: "Which 2018 film starring Lady Gaga and Bradley Cooper won the Oscar for Best Original Song?",
    options: ["A Star Is Born", "Bohemian Rhapsody", "Rocketman", "The Greatest Showman"],
    correct: 0,
    category: "Film",
  },
  {
    text: "The 'OK Boomer' phrase went viral in approximately which year?",
    options: ["2017", "2018", "2019", "2020"],
    correct: 2,
    category: "Social",
  },
  {
    text: "In 'The Last of Us' HBO series, who plays Joel?",
    options: ["Aaron Paul", "Pedro Pascal", "Oscar Isaac", "Jon Bernthal"],
    correct: 1,
    category: "TV",
  },
  {
    text: "SZA's critically acclaimed 2022 album was titled what?",
    options: ["Ctr", "Lemonade", "SOS", "Good Days"],
    correct: 2,
    category: "Music",
  },
  {
    text: "Which film's ending featured the line 'I am Iron Man' before a snap?",
    options: ["Iron Man 3", "Captain America: Civil War", "Avengers: Age of Ultron", "Avengers: Endgame"],
    correct: 3,
    category: "Film",
  },
  {
    text: "The 'Bernie Sanders mittens' meme originated from which event?",
    options: ["The 2020 election night", "The 2021 inauguration", "The 2021 Super Bowl", "A 2021 Senate vote"],
    correct: 1,
    category: "Social",
  },
  {
    text: "Which show on HBO tells the story of a toxic relationship between a detective and a con artist?",
    options: ["Sharp Objects", "Big Little Lies", "Killing Eve", "The Undoing"],
    correct: 2,
    category: "TV",
  },
  {
    text: "Which artist performed the halftime show at the 2023 Super Bowl?",
    options: ["Beyoncé", "Rihanna", "Taylor Swift", "Shakira"],
    correct: 1,
    category: "Music",
  },
  {
    text: "The film 'Everything Everywhere All at Once' won how many Oscars at the 2023 ceremony?",
    options: ["4", "5", "6", "7"],
    correct: 3,
    category: "Film",
  },
  {
    text: "Which Twitter / X handle did Elon Musk famously buy for $44 billion?",
    options: ["@twitter", "@X", "@ElonMusk", "The whole platform"],
    correct: 3,
    category: "Social",
  },
  {
    text: "In 'White Lotus', Season 2 was set in which country?",
    options: ["Greece", "Thailand", "Italy", "Spain"],
    correct: 2,
    category: "TV",
  },
  {
    text: "Morgan Wallen's 2023 album 'One Thing at a Time' set the record for most weeks at number one on which chart?",
    options: ["Hot 100", "Country Albums", "Billboard 200", "Top Country Songs"],
    correct: 1,
    category: "Music",
  },
  {
    text: "Which animated Pixar film features a young girl who turns into a giant red panda?",
    options: ["Soul", "Luca", "Turning Red", "Elemental"],
    correct: 2,
    category: "Film",
  },
  {
    text: "The 'Sea Shanty' trend on TikTok in early 2021 was started by which sea shanty?",
    options: ["Drunken Sailor", "Wellerman", "Barrett's Privateers", "Leave Her, Johnny"],
    correct: 1,
    category: "Social",
  },
  {
    text: "Which streaming show features a group of friends playing Dungeons & Dragons, inspiring the title?",
    options: ["The Witcher", "Arcane", "Stranger Things", "Dungeons & Dragons: Honor Among Thieves"],
    correct: 2,
    category: "TV",
  },
  {
    text: "Kendrick Lamar's diss track targeting Drake in 2024 was called what?",
    options: ["Push Ups", "Euphoria", "Not Like Us", "Meet the Grahams"],
    correct: 2,
    category: "Music",
  },
  {
    text: "In the 2019 film 'Knives Out', who plays the detective Benoit Blanc?",
    options: ["Idris Elba", "Tom Hanks", "Daniel Craig", "Hugh Jackman"],
    correct: 2,
    category: "Film",
  },
  {
    text: "Which YouTuber sparked the 'Mr. Beast effect' with large-scale challenge and philanthropy videos?",
    options: ["PewDiePie", "MrBeast", "Logan Paul", "David Dobrik"],
    correct: 1,
    category: "Social",
  },
  {
    text: "Apple TV+'s 'Severance' is set primarily inside which type of workplace?",
    options: ["A tech startup", "A pharmaceutical company", "A data refinement company", "A government agency"],
    correct: 2,
    category: "TV",
  },
  {
    text: "Which pop star released the record-breaking album 'Midnights' in 2022?",
    options: ["Dua Lipa", "Ariana Grande", "Taylor Swift", "Lizzo"],
    correct: 2,
    category: "Music",
  },
  {
    text: "The 2022 film 'Top Gun: Maverick' is the sequel to the 1986 original. How many years apart are they?",
    options: ["30 years", "34 years", "36 years", "40 years"],
    correct: 2,
    category: "Film",
  },
  {
    text: "Which celebrity's Super Bowl ad became one of the most talked-about moments of 2023?",
    options: ["Kim Kardashian for Skims", "Travis Scott for McDonald's", "Serena Williams for Nike", "Kevin Hart for Fanduel"],
    correct: 3,
    category: "Social",
  },
  {
    text: "In 'Beef' on Netflix, who plays the two lead characters caught in road rage?",
    options: ["Ali Wong & Steven Yeun", "Sandra Oh & Randall Park", "Awkwafina & Simu Liu", "Lucy Liu & Ken Jeong"],
    correct: 0,
    category: "TV",
  },
  {
    text: "Doja Cat's hit 'Say So' got a boost from going viral on which platform?",
    options: ["Instagram Reels", "YouTube", "TikTok", "Spotify"],
    correct: 2,
    category: "Music",
  },
  {
    text: "Which 2023 blockbuster had the promotional campaign 'She's everything. He's just Ken.'?",
    options: ["Mean Girls", "Legally Blonde reboot", "Barbie", "Legally Blonde 3"],
    correct: 2,
    category: "Film",
  },
];

export class PopCultureQuizExperience implements ExperienceModule {
  readonly type = "pop_culture_quiz" as const;

  async onActivate(roomId: string, _hostGuestId: string): Promise<void> {
    const state: PopCultureQuizState = {
      phase: "waiting",
      round: 0,
      totalRounds: 10,
      scores: {},
      currentQ: null,
      answers: {},
      questionStartedAt: 0,
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

      case "answer":
        await this._answer(roomId, guestId, p.index, io);
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
    return { type: "pop_culture_quiz" as any, data: this._safeState(state) };
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private async _start(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;
    state.round = 1;
    state.answers = {};
    state.questionStartedAt = Date.now();
    state.currentQ = { ...QUESTIONS[0], index: 0 };
    state.phase = "question";
    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  private async _answer(roomId: string, guestId: string, index: number, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || state.phase !== "question") return;
    if (state.answers[guestId] !== undefined) return; // already answered
    if (typeof index !== "number" || index < 0 || index > 3) return;
    state.answers[guestId] = index;
    await this._save(roomId, state);
    // No broadcast — client shows local selection
  }

  private async _reveal(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state || !state.currentQ || state.phase !== "question") return;

    const correct = state.currentQ.correct;
    const now = Date.now();

    for (const [gId, chosen] of Object.entries(state.answers)) {
      if (chosen === correct) {
        const elapsed = Math.max(0, now - state.questionStartedAt);
        const speedBonus = Math.round(Math.max(0, (ANSWER_WINDOW_MS - elapsed) / ANSWER_WINDOW_MS) * 100);
        state.scores[gId] = (state.scores[gId] ?? 0) + 100 + speedBonus;
      }
    }

    state.phase = "reveal";
    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  private async _next(roomId: string, io: Server): Promise<void> {
    const state = await this._load(roomId);
    if (!state) return;

    const nextRound = state.round + 1;
    if (nextRound > state.totalRounds) {
      state.phase = "finished";
      state.currentQ = null;
      await this._save(roomId, state);
      await this._broadcast(roomId, state, io);
      return;
    }

    const nextIndex = (state.currentQ?.index ?? 0) + 1;
    const qIndex = nextIndex % QUESTIONS.length;
    state.round = nextRound;
    state.answers = {};
    state.questionStartedAt = Date.now();
    state.currentQ = { ...QUESTIONS[qIndex], index: nextIndex };
    state.phase = "question";
    await this._save(roomId, state);
    await this._broadcast(roomId, state, io);
  }

  private async _broadcast(roomId: string, state: PopCultureQuizState, io: Server): Promise<void> {
    const seq = await getNextSequenceId(roomId);
    io.to(roomId).emit("experience:state" as any, {
      experienceType: "pop_culture_quiz",
      state: this._safeState(state),
      view: { type: "pop_culture_quiz" as any, data: this._safeState(state) },
      sequenceId: seq,
    });
  }

  /** Strip answers before broadcasting so guests can't cheat */
  private _safeState(state: PopCultureQuizState): Omit<PopCultureQuizState, "answers"> {
    const { answers, ...safe } = state;
    // During question phase, also hide the correct answer
    if (state.phase === "question" && safe.currentQ) {
      const { correct, ...safeQ } = safe.currentQ;
      return { ...safe, currentQ: safeQ as any };
    }
    return safe;
  }

  private async _load(roomId: string): Promise<PopCultureQuizState | null> {
    const raw = await redisClient.get(KEY(roomId));
    return raw ? JSON.parse(raw) : null;
  }

  private async _save(roomId: string, state: PopCultureQuizState): Promise<void> {
    await redisClient.set(KEY(roomId), JSON.stringify(state));
  }
}
