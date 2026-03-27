import type { Server } from "socket.io";
import type { ExperienceModule, GuestViewDescriptor } from "@queuedj/shared-types";
import { redisClient } from "../../redis";
import { getNextSequenceId } from "../../rooms/stateReconciliation";

// ─────────────────────────────────────────────────────────────────────────────
// Connections Experience
//
// Guests group 16 words into 4 categories. Each correct group submission
// earns +200 pts. 2 puzzles total.
//
// Actions:
//   HOST:  start, end_puzzle, end
//   GUEST: submit_group
// ─────────────────────────────────────────────────────────────────────────────

interface ConnectionGroup {
  label: string;
  items: string[];
  color: "yellow" | "green" | "blue" | "purple";
}

interface ConnectionPuzzle {
  groups: ConnectionGroup[];
}

const PUZZLES: ConnectionPuzzle[] = [
  {
    groups: [
      {
        label: "Things at a house party",
        color: "yellow",
        items: ["Solo cups", "Playlist", "Snacks", "Fairy lights"],
      },
      {
        label: "DJ equipment",
        color: "green",
        items: ["Turntable", "Mixer", "Crossfader", "Beatpad"],
      },
      {
        label: "___ drop",
        color: "blue",
        items: ["Bass", "Name", "Tear", "Rain"],
      },
      {
        label: "Party game brands",
        color: "purple",
        items: ["Jenga", "Twister", "Pictionary", "Taboo"],
      },
    ],
  },
  {
    groups: [
      {
        label: "Music festival essentials",
        color: "yellow",
        items: ["Wristband", "Tent", "Poncho", "Earplugs"],
      },
      {
        label: "Types of music beat",
        color: "green",
        items: ["Four-on-the-floor", "Breakbeat", "Boom bap", "Trap"],
      },
      {
        label: "___ crowd",
        color: "blue",
        items: ["Flash", "Home", "Wild", "Tough"],
      },
      {
        label: "Sounds a crowd makes",
        color: "purple",
        items: ["Cheer", "Clap", "Chant", "Roar"],
      },
    ],
  },
  {
    groups: [
      {
        label: "Things you do when drunk",
        color: "yellow",
        items: ["Overshare", "Text an ex", "Lose a shoe", "Declare love"],
      },
      {
        label: "Cocktail ingredients",
        color: "green",
        items: ["Grenadine", "Triple sec", "Bitters", "Simple syrup"],
      },
      {
        label: "Sober ___ (sober alternatives)",
        color: "blue",
        items: ["Curious", "Living", "October", "Rave"],
      },
      {
        label: "Famous Bartenders (fictional)",
        color: "purple",
        items: ["Moe Szyslak", "Brian Griffin", "Sam Malone", "Lloyd"],
      },
    ],
  },
  {
    groups: [
      {
        label: "Things you queue for",
        color: "yellow",
        items: ["Brunch", "Nightclub", "iPhone", "Concert tickets"],
      },
      {
        label: "Queue-related words",
        color: "green",
        items: ["Wait", "Line", "Hold", "Buffer"],
      },
      {
        label: "Sounds like a queue but isn't",
        color: "blue",
        items: ["Cue", "Que", "Q", "Kew"],
      },
      {
        label: "Things with a 'skip' feature",
        color: "purple",
        items: ["Spotify", "Netflix intro", "Ad", "YouTube"],
      },
    ],
  },
  {
    groups: [
      {
        label: "Ways to leave a party",
        color: "yellow",
        items: ["Irish exit", "Cab home", "Walk of shame", "Crash on the sofa"],
      },
      {
        label: "___ ghost",
        color: "green",
        items: ["Holy", "Boo", "Dating", "Bed and"],
      },
      {
        label: "Things that end abruptly",
        color: "blue",
        items: ["Voicemail", "Conversation", "Relationship", "Movie"],
      },
      {
        label: "Disappearing acts",
        color: "purple",
        items: ["Houdini", "Ghost", "Bail", "Vanish"],
      },
    ],
  },
  {
    groups: [
      {
        label: "Karaoke song categories",
        color: "yellow",
        items: ["Power ballad", "Guilty pleasure", "Crowd-pleaser", "Deep cut"],
      },
      {
        label: "___ mic",
        color: "green",
        items: ["Drop the", "Boom", "Open", "Hot"],
      },
      {
        label: "Karaoke crimes",
        color: "blue",
        items: ["Off-key", "Too long", "Hogging", "No emotion"],
      },
      {
        label: "Stage fright symptoms",
        color: "purple",
        items: ["Sweating", "Shaking", "Forgetting lyrics", "Dry mouth"],
      },
    ],
  },
  {
    groups: [
      {
        label: "Words on a bottle of wine",
        color: "yellow",
        items: ["Reserve", "Vintage", "Dry", "Estate"],
      },
      {
        label: "Wine snob phrases",
        color: "green",
        items: ["Oaky", "Nose", "Finish", "Terroir"],
      },
      {
        label: "Not wine but sounds like it could be",
        color: "blue",
        items: ["Brine", "Shrine", "Vine", "Fine"],
      },
      {
        label: "Things that pair with wine",
        color: "purple",
        items: ["Cheese", "Crackers", "Gossip", "A long story"],
      },
    ],
  },
  {
    groups: [
      {
        label: "Types of group chat",
        color: "yellow",
        items: ["Family", "Work", "Girls", "The real one"],
      },
      {
        label: "Group chat behaviours",
        color: "green",
        items: ["Left on read", "Muted", "Spamming", "Ghosted"],
      },
      {
        label: "Things said in a group chat",
        color: "blue",
        items: ["Lol", "Who's coming?", "Seen", "K"],
      },
      {
        label: "___ group",
        color: "purple",
        items: ["Support", "Blood", "Age", "Peer"],
      },
    ],
  },
  {
    groups: [
      {
        label: "Reasons the night ended early",
        color: "yellow",
        items: ["Last train", "Work tomorrow", "Drama", "Too many shots"],
      },
      {
        label: "Train related things",
        color: "green",
        items: ["Platform", "Carriage", "Signal failure", "Delay"],
      },
      {
        label: "___ station",
        color: "blue",
        items: ["Police", "Radio", "Space", "Tube"],
      },
      {
        label: "Things that run on a schedule",
        color: "purple",
        items: ["Bus", "Train", "Reality TV", "Office printer"],
      },
    ],
  },
  {
    groups: [
      {
        label: "Hangover cures (real or imagined)",
        color: "yellow",
        items: ["Greasy food", "Lucozade", "More alcohol", "Sleep"],
      },
      {
        label: "Hangover feelings",
        color: "green",
        items: ["Regret", "Dry mouth", "Headache", "Existential dread"],
      },
      {
        label: "Famous morning-after moments (films)",
        color: "blue",
        items: ["The Hangover", "Bridesmaids", "Very Bad Things", "Project X"],
      },
      {
        label: "Breakfast items that cure nothing",
        color: "purple",
        items: ["Acai bowl", "Smoothie", "Granola", "Oat milk latte"],
      },
    ],
  },
  {
    groups: [
      {
        label: "Ways to say someone is boring",
        color: "yellow",
        items: ["Dry", "Beige", "Vanilla", "Mid"],
      },
      {
        label: "Actually flavours",
        color: "green",
        items: ["Vanilla", "Caramel", "Mint", "Strawberry"],
      },
      {
        label: "Colours used as personality descriptors",
        color: "blue",
        items: ["Beige", "Grey", "Colourful", "Dark"],
      },
      {
        label: "Gen Z slang for average",
        color: "purple",
        items: ["Mid", "Basic", "Meh", "Whatever"],
      },
    ],
  },
  {
    groups: [
      {
        label: "Things you lie about on a first date",
        color: "yellow",
        items: ["Job title", "Age", "Height", "How often you gym"],
      },
      {
        label: "Red flags",
        color: "green",
        items: ["Still texting the ex", "Bad tipper", "Rude to waiters", "Talks only about themselves"],
      },
      {
        label: "Terrible conversation starters",
        color: "blue",
        items: ["What's your sign?", "Do you believe in fate?", "I'm not like other people", "My last relationship was toxic"],
      },
      {
        label: "___ match",
        color: "purple",
        items: ["Perfect", "Tinder", "Chess", "Fire"],
      },
    ],
  },
  {
    groups: [
      {
        label: "Things at a sleepover",
        color: "yellow",
        items: ["Sleeping bag", "Face mask", "Midnight snacks", "Truth or dare"],
      },
      {
        label: "90s sleepover movies",
        color: "green",
        items: ["Clueless", "10 Things I Hate About You", "She's All That", "Bring It On"],
      },
      {
        label: "Sleepover staples (food)",
        color: "blue",
        items: ["Pizza", "Popcorn", "Ben & Jerry's", "Haribo"],
      },
      {
        label: "Things people confess at sleepovers",
        color: "purple",
        items: ["Crushes", "Secrets", "Fears", "Embarrassing moments"],
      },
    ],
  },
  {
    groups: [
      {
        label: "Song titles with a number in them",
        color: "yellow",
        items: ["99 Problems", "1 Thing", "7 Rings", "3AM"],
      },
      {
        label: "Things that come in fours",
        color: "green",
        items: ["Seasons", "Suits in a deck", "Beatles", "Horsemen"],
      },
      {
        label: "___ five",
        color: "blue",
        items: ["High", "Slaughterhouse", "Ocean's", "Jackson"],
      },
      {
        label: "Countdowns",
        color: "purple",
        items: ["3, 2, 1", "10 seconds", "New Year's", "Rocket launch"],
      },
    ],
  },
  {
    groups: [
      {
        label: "Famous DJs",
        color: "yellow",
        items: ["Calvin Harris", "Tiësto", "Skrillex", "Disclosure"],
      },
      {
        label: "DJ ___ (not DJs)",
        color: "green",
        items: ["Jazzy Jeff", "Khaled", "Shadow", "Premier"],
      },
      {
        label: "Things a DJ does",
        color: "blue",
        items: ["Drop", "Blend", "Sample", "Remix"],
      },
      {
        label: "Booth items",
        color: "purple",
        items: ["Headphones", "USB stick", "Laptop", "Water bottle"],
      },
    ],
  },
  {
    groups: [
      {
        label: "Party fouls",
        color: "yellow",
        items: ["Spilling drinks", "Passing out early", "Starting beef", "Eating all the snacks"],
      },
      {
        label: "Party ___ (phrases)",
        color: "green",
        items: ["Animal", "Pooper", "Trick", "Foul"],
      },
      {
        label: "Things that ruin a party instantly",
        color: "blue",
        items: ["Fire alarm", "Police", "Vomit", "Exes arriving together"],
      },
      {
        label: "Things you say at 4am when the party ends",
        color: "purple",
        items: ["This was iconic", "Never again", "Who has a charger?", "I love you guys"],
      },
    ],
  },
  {
    groups: [
      {
        label: "Playlist vibes",
        color: "yellow",
        items: ["Chill", "Hype", "Sad girl", "Pre-drinks"],
      },
      {
        label: "Music apps",
        color: "green",
        items: ["Spotify", "Apple Music", "SoundCloud", "Tidal"],
      },
      {
        label: "___ list",
        color: "blue",
        items: ["Black", "Guest", "Bucket", "Wish"],
      },
      {
        label: "Playlist crimes",
        color: "purple",
        items: ["Aux cord thief", "Same song twice", "Skipping mid-song", "Playing your own music"],
      },
    ],
  },
  {
    groups: [
      {
        label: "Things that go viral",
        color: "yellow",
        items: ["Dance challenge", "Cringe video", "Hot take", "Meme"],
      },
      {
        label: "___ challenge",
        color: "green",
        items: ["Ice bucket", "Cinnamon", "Mannequin", "Skull"],
      },
      {
        label: "Internet rabbit holes",
        color: "blue",
        items: ["Reddit thread", "Wikipedia spiral", "TikTok FYP", "True crime podcast"],
      },
      {
        label: "Things that trend for one day",
        color: "purple",
        items: ["Hashtag", "Outrage", "Celeb news", "Side effect warning"],
      },
    ],
  },
  {
    groups: [
      {
        label: "Excuses to leave",
        color: "yellow",
        items: ["Early start", "Babysitter", "Dog needs walking", "Headache"],
      },
      {
        label: "Things you fake",
        color: "green",
        items: ["Phone call", "Emergency", "Laugh", "Interest"],
      },
      {
        label: "___ out",
        color: "blue",
        items: ["Dip", "Fade", "Tap", "Ghost"],
      },
      {
        label: "Socially acceptable reasons to bail",
        color: "purple",
        items: ["Illness", "Family emergency", "Flight to catch", "Work crisis"],
      },
    ],
  },
  {
    groups: [
      {
        label: "Song openers everyone recognises in one note",
        color: "yellow",
        items: ["Mr. Brightside", "Don't Stop Believin'", "Africa", "Bohemian Rhapsody"],
      },
      {
        label: "Songs everyone claims to hate but dances to",
        color: "green",
        items: ["Crazy in Love", "Uptown Funk", "Can't Stop the Feeling", "Happy"],
      },
      {
        label: "Songs that end a night out",
        color: "blue",
        items: ["Angels", "Don't Look Back in Anger", "Living on a Prayer", "Hey Jude"],
      },
      {
        label: "Songs that start a fight on the dance floor",
        color: "purple",
        items: ["Jump Around", "Sabotage", "Killing in the Name", "Gold Digger"],
      },
    ],
  },
];

interface ConnectionsState {
  phase: "waiting" | "playing" | "finished";
  scores: Record<string, number>;
  puzzleIndex: number;
  puzzleOrder: number[]; // shuffled indices into PUZZLES
  solved: string[][]; // arrays of solved group items
  mistakes: Record<string, number>; // guestId → mistake count
  solvedGroups: ConnectionGroup[]; // full solved group objects
}

const KEY = (roomId: string) => `experience:connections:${roomId}`;

/** Normalise for comparison — trim + lowercase */
function normalise(s: string): string {
  return s.trim().toLowerCase();
}

/** Check if two string arrays contain the same values (order independent) */
function setsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a.map(normalise));
  for (const item of b) {
    if (!setA.has(normalise(item))) return false;
  }
  return true;
}

export class ConnectionsExperience implements ExperienceModule {
  readonly type = "connections" as const;

  async onActivate(roomId: string, _hostGuestId: string): Promise<void> {
    const state: ConnectionsState = {
      phase: "waiting",
      scores: {},
      puzzleIndex: 0,
      puzzleOrder: [],
      solved: [],
      mistakes: {},
      solvedGroups: [],
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
    const state: ConnectionsState = JSON.parse(raw);

    switch (action) {
      case "start": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        state.phase = "playing";
        state.puzzleIndex = 0;
        state.puzzleOrder = [...Array(PUZZLES.length).keys()].sort(() => Math.random() - 0.5);
        state.solved = [];
        state.solvedGroups = [];
        state.mistakes = {};
        await redisClient.set(KEY(roomId), JSON.stringify(state));
        const puzzle = PUZZLES[state.puzzleOrder[0]];
        const seq = await getNextSequenceId(roomId);
        io.to(roomId).emit("experience:state" as any, {
          experienceType: "connections",
          state,
          view: { type: "connections", data: { ...state, puzzle } },
          sequenceId: seq,
        });
        break;
      }

      case "submit_group": {
        if (state.phase !== "playing") return;
        const p = payload as { items: string[] };
        if (!Array.isArray(p?.items) || p.items.length !== 4) return;
        const puzzle = PUZZLES[state.puzzleOrder?.[state.puzzleIndex] ?? state.puzzleIndex];
        if (!puzzle) return;

        // Check if already solved
        const alreadySolved = state.solved.some(g => setsEqual(g, p.items));
        if (alreadySolved) return;

        // Check if it's a valid group
        const matchedGroup = puzzle.groups.find(g => setsEqual(g.items, p.items));
        if (matchedGroup) {
          // Correct!
          state.solved.push([...matchedGroup.items]);
          state.solvedGroups.push(matchedGroup);
          state.scores[guestId] = (state.scores[guestId] ?? 0) + 200;
          await redisClient.set(KEY(roomId), JSON.stringify(state));
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "connections",
            state,
            view: { type: "connections", data: { ...state, puzzle, lastResult: { correct: true, guestId, group: matchedGroup } } },
            sequenceId: seq,
          });
        } else {
          // Wrong
          state.mistakes[guestId] = (state.mistakes[guestId] ?? 0) + 1;
          await redisClient.set(KEY(roomId), JSON.stringify(state));
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "connections",
            state,
            view: { type: "connections", data: { ...state, puzzle, lastResult: { correct: false, guestId } } },
            sequenceId: seq,
          });
        }
        break;
      }

      case "end_puzzle": {
        if (role !== "HOST" && role !== "CO_HOST") return;
        if (state.phase !== "playing") return;
        const nextIndex = state.puzzleIndex + 1;
        if (nextIndex >= PUZZLES.length) {
          // All puzzles done
          state.phase = "finished";
          await redisClient.set(KEY(roomId), JSON.stringify(state));
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "connections",
            state,
            view: { type: "leaderboard", data: state.scores },
            sequenceId: seq,
          });
        } else {
          state.puzzleIndex = nextIndex;
          state.solved = [];
          state.solvedGroups = [];
          await redisClient.set(KEY(roomId), JSON.stringify(state));
          const puzzle = PUZZLES[state.puzzleOrder?.[nextIndex] ?? nextIndex];
          const seq = await getNextSequenceId(roomId);
          io.to(roomId).emit("experience:state" as any, {
            experienceType: "connections",
            state,
            view: { type: "connections", data: { ...state, puzzle } },
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
    const state: ConnectionsState = JSON.parse(raw);
    if (state.phase === "finished") return { type: "leaderboard", data: state.scores };
    const puzzle = PUZZLES[state.puzzleOrder?.[state.puzzleIndex] ?? state.puzzleIndex] ?? null;
    return { type: "connections" as any, data: { ...state, puzzle } };
  }
}
