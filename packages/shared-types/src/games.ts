// ─────────────────────────────────────────────────────────────────────────────
// Game Types — all 4 new experiences
// Each game has: State, Actions (host + guest), and Phase enum
// ─────────────────────────────────────────────────────────────────────────────

// ─── 1. Unpopular Opinions ────────────────────────────────────────────────────
// Judge secretly rates a prompt 1–10. Everyone guesses. Bet to double points.

export type UnpopularOpinionsPhase =
  | "waiting"      // Between rounds
  | "judging"      // Judge is secretly rating
  | "guessing"     // Everyone else guesses + bets
  | "reveal"       // Show judge's score + who was closest
  | "scores"       // Leaderboard
  | "finished";

export interface UnpopularOpinionsState {
  phase: UnpopularOpinionsPhase;
  roundNumber: number;
  totalRounds: number;
  currentJudgeId: string | null;       // Rotates each round
  judgeOrder: string[];                // Pre-shuffled guest list
  currentPrompt: string | null;
  judgeScore: number | null;           // Hidden until reveal
  guesses: Record<string, number>;     // guestId → 1–10 (hidden until reveal)
  bets: Record<string, boolean>;       // guestId → doubled their points?
  scores: Record<string, number>;      // guestId → total score
  lastRoundResults?: UnpopularOpinionsRoundResult;
}

export interface UnpopularOpinionsRoundResult {
  prompt: string;
  judgeId: string;
  judgeScore: number;
  guesses: Record<string, number>;
  bets: Record<string, boolean>;
  pointsEarned: Record<string, number>;
}

// Distance scoring: exact = 100pts, off by 1 = 80pts, off by 2 = 60pts, etc.
export function scoreUnpopularOpinionsGuess(guess: number, judgeScore: number, betDoubled: boolean): number {
  const delta = Math.abs(guess - judgeScore);
  const base = Math.max(0, 100 - delta * 20);
  return betDoubled ? base * 2 : base;
}

export const UNPOPULAR_OPINIONS_PROMPTS = [
  "Ketchup on scrambled eggs",
  "Pineapple on pizza",
  "Cilantro on everything",
  "Crocs as fashion",
  "Peas in mac and cheese",
  "Candy corn",
  "Ranch on pizza",
  "Talking during movies",
  "Wearing socks with sandals",
  "Eating cereal dry",
  "Cold pizza for breakfast",
  "Putting milk in first",
  "Raisins in cookies",
  "Loud chewing",
  "Sleeping with socks on",
  "Skipping the gym on weekends",
  "Replying to texts days later",
  "Liking country music",
  "Energy drinks at midnight",
  "Ghosting someone after 3 dates",
  "Spoiling movies for friends",
  "Not tipping on takeout",
  "Listening to music on speaker in public",
  "Talking on the phone on public transport",
  "Using the word 'moist'",
  "Mayonnaise as a condiment",
  "Being a morning person",
  "Skipping dessert",
];

// ─── 2. Scrapbook Sabotage ────────────────────────────────────────────────────
// Round 1: Build a word bank from prompts. Round 2: Answer using ONLY those words.

export type ScrapbookSabotagePhase =
  | "waiting"
  | "word_bank_input"    // Everyone describes their "dream vacation" (word bank source)
  | "word_bank_reveal"   // Show the combined word bank
  | "writing"            // Write response to prompt using only word bank words
  | "voting"             // Vote on funniest response
  | "reveal"             // Show who wrote what + winner
  | "scores"
  | "finished";

export interface ScrapbookSabotageState {
  phase: ScrapbookSabotagePhase;
  roundNumber: number;
  wordBankPrompt: string;              // e.g. "Describe your dream vacation"
  writingPrompt: string;               // e.g. "Explain why you were late to the wedding"
  wordBankSubmissions: Record<string, string>;   // guestId → their description
  wordBank: string[];                  // All unique words extracted from submissions
  responses: Record<string, string>;   // guestId → their restricted response
  votes: Record<string, string>;       // guestId → voted for this guestId's response
  scores: Record<string, number>;
  roundResults?: ScrapbookRoundResult;
}

export interface ScrapbookRoundResult {
  writingPrompt: string;
  wordBank: string[];
  responses: Record<string, string>;
  votes: Record<string, string>;
  winner: string;                      // guestId
}

export function extractWordBank(submissions: Record<string, string>): string[] {
  const allText = Object.values(submissions).join(" ");
  const words = allText
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2);     // Filter out "a", "is", "the" etc. < 3 chars
  return [...new Set(words)].sort();  // Unique, alphabetical
}

export const SCRAPBOOK_WORD_BANK_PROMPTS = [
  "Describe your dream vacation",
  "Describe your perfect Sunday",
  "What would you do with a million dollars?",
  "Describe your celebrity crush",
  "Describe the worst job you can imagine",
];

export const SCRAPBOOK_WRITING_PROMPTS = [
  "Explain why you were late to the wedding",
  "Write a resignation letter from your job",
  "Explain to your mom why you missed Christmas",
  "Write a Tinder bio",
  "Explain why the dog ate your homework",
  "Write an apology to your landlord",
  "Explain why you're running for president",
];

// ─── 3. The Glitch ────────────────────────────────────────────────────────────
// Everyone gets an image prompt to "react" to. One person (The Glitch) gets a
// different image. Players describe what they saw. Vote on who's lying.
// Phase A: uses image prompts. Phase 3: upgrade to video clips.

export type TheGlitchPhase =
  | "waiting"
  | "watching"      // Everyone "watches" their prompt (shown for 5s then hidden)
  | "describing"    // Round of descriptions — each player speaks/types
  | "voting"        // Vote on who is The Glitch
  | "reveal"        // Show who the Glitch was + their different prompt
  | "scores"
  | "finished";

export interface TheGlitchState {
  phase: TheGlitchPhase;
  roundNumber: number;
  glitchGuestId: string | null;           // Hidden from guests until reveal
  realPromptId: string | null;            // What everyone else saw
  glitchPromptId: string | null;          // What the Glitch saw (different)
  promptRevealedAt: number | null;        // Timestamp — hide after 5s
  descriptions: Record<string, string>;   // guestId → their description
  votes: Record<string, string>;          // guestId → accused guestId
  scores: Record<string, number>;
  glitchWon?: boolean;                    // Did the glitch fool everyone?
}

export interface GlitchPrompt {
  id: string;
  category: string;
  realDescription: string;   // What the majority sees
  glitchDescription: string; // What the Glitch sees — similar but wrong detail
  // Phase 3+: imageUrl and glitchImageUrl
}

export const GLITCH_PROMPTS: GlitchPrompt[] = [
  {
    id: "g1",
    category: "Animals",
    realDescription: "A golden retriever catching a frisbee at the beach",
    glitchDescription: "A golden retriever chasing a seagull at the beach",
  },
  {
    id: "g2",
    category: "Food",
    realDescription: "A massive burger with THREE patties and bacon",
    glitchDescription: "A massive burger with TWO patties and no bacon",
  },
  {
    id: "g3",
    category: "Sports",
    realDescription: "A basketball player dunking from the free throw line",
    glitchDescription: "A basketball player dunking from the three-point line",
  },
  {
    id: "g4",
    category: "Nature",
    realDescription: "A lightning strike hitting a tree in a forest",
    glitchDescription: "A lightning strike hitting a lake in a forest",
  },
  {
    id: "g5",
    category: "Weird",
    realDescription: "A man riding a horse through a McDonald's drive-through",
    glitchDescription: "A man riding a bicycle through a McDonald's drive-through",
  },
  {
    id: "g6",
    category: "Crowd",
    realDescription: "A crowd of people all wearing the same red hat",
    glitchDescription: "A crowd of people all wearing the same blue hat",
  },
];

// Scoring: correct vote on Glitch = 100pts. Glitch fools everyone = 150pts to Glitch.
export function scoreTheGlitch(
  votes: Record<string, string>,
  glitchGuestId: string,
  allGuestIds: string[],
): Record<string, number> {
  const scores: Record<string, number> = {};
  const correctVoters = Object.entries(votes).filter(([, accused]) => accused === glitchGuestId);
  const glitchWon = correctVoters.length === 0;

  for (const guestId of allGuestIds) {
    if (guestId === glitchGuestId) {
      scores[guestId] = glitchWon ? 150 : 0;
    } else if (votes[guestId] === glitchGuestId) {
      scores[guestId] = 100;
    } else {
      scores[guestId] = 0;
    }
  }
  return scores;
}

// ─── 4. Copyright Infringement ────────────────────────────────────────────────
// Famous logo/character shown for 3 seconds. Draw it from memory.
// Vote on most likely to get sued OR who nailed it.

export type CopyrightPhase =
  | "waiting"
  | "viewing"      // Show the prompt for 3 seconds
  | "drawing"      // 60 seconds to draw from memory
  | "gallery"      // All drawings revealed, voting
  | "results"      // Winner announced
  | "scores"
  | "finished";

export interface CopyrightState {
  phase: CopyrightPhase;
  roundNumber: number;
  totalRounds: number;
  currentPrompt: CopyrightPrompt | null;
  promptRevealedAt: number | null;      // For 3s countdown
  drawings: Record<string, DrawingData>; // guestId → their drawing paths
  votes: Record<string, string>;         // guestId → voted for this guestId
  voteCategory: "most_sued" | "nailed_it"; // Alternates each round
  scores: Record<string, number>;
}

export interface CopyrightPrompt {
  id: string;
  name: string;           // e.g. "The Starbucks Mermaid"
  category: string;       // logos / characters / album_art
  difficulty: "easy" | "medium" | "hard";
  hint?: string;          // e.g. "Green circular logo with a two-tailed mermaid"
}

export interface DrawingData {
  paths: DrawingPath[];   // SVG-style paths
  width: number;
  height: number;
}

export interface DrawingPath {
  points: Array<{ x: number; y: number }>;
  color: string;
  strokeWidth: number;
}

export const COPYRIGHT_PROMPTS: CopyrightPrompt[] = [
  { id: "c1", name: "The Starbucks Mermaid", category: "logos", difficulty: "medium", hint: "Green circular coffee logo" },
  { id: "c2", name: "Super Mario", category: "characters", difficulty: "easy", hint: "Nintendo's iconic plumber" },
  { id: "c3", name: "The Twitter Bird", category: "logos", difficulty: "easy", hint: "Now called X but you know the bird" },
  { id: "c4", name: "The Netflix N", category: "logos", difficulty: "easy", hint: "Red streaming giant logo" },
  { id: "c5", name: "Pikachu", category: "characters", difficulty: "medium", hint: "The most famous Pokémon" },
  { id: "c6", name: "The Apple Logo", category: "logos", difficulty: "easy", hint: "Bitten apple, tech company" },
  { id: "c7", name: "Mickey Mouse Ears", category: "characters", difficulty: "easy", hint: "Three circles" },
  { id: "c8", name: "The McDonald's Arches", category: "logos", difficulty: "easy", hint: "Golden M" },
  { id: "c9", name: "Darth Vader's Helmet", category: "characters", difficulty: "hard", hint: "Star Wars villain" },
  { id: "c10", name: "The Spotify Logo", category: "logos", difficulty: "medium", hint: "Green circle with sound waves" },
  { id: "c11", name: "SpongeBob SquarePants", category: "characters", difficulty: "hard", hint: "Square sponge" },
  { id: "c12", name: "The Nike Swoosh", category: "logos", difficulty: "easy", hint: "Just do it" },
];
