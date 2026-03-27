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
  // ── added to reach 80 total ──────────────────────────────────────────────────
  "Putting sugar in pasta water",
  "Dipping fries in ice cream",
  "Liking airplane food",
  "Eating tuna at your desk",
  "Warm soda is fine",
  "Skipping breakfast entirely",
  "Butter on pancakes is overrated",
  "Hot dogs are a sandwich",
  "Cereal is a soup",
  "Putting ketchup on a hot dog",
  "Watching TV with subtitles on",
  "Replying 'K' to long messages",
  "Leaving voice memos instead of texts",
  "Following people back on Instagram out of guilt",
  "Unfollowing friends on social media",
  "Posting gym selfies every day",
  "Sharing a streaming password is theft",
  "Skipping intros on TV shows",
  "Not finishing a book you hate",
  "Reading the last page of a book first",
  "Binge-watching a whole series in one day",
  "Watching a movie with your phone out",
  "Bringing your own snacks to the cinema",
  "Falling asleep during action movies",
  "Rewatching the same show for the 5th time",
  "Laughing at your own jokes before the punchline",
  "Showing up exactly on time (not early)",
  "Leaving a party without saying goodbye",
  "Cancelling plans by text the day of",
  "Giving unsolicited life advice",
  "Asking someone their salary on a first date",
  "Taking calls on speaker in restaurants",
  "Charging your friends gas money",
  "Splitting a bill down to the cent",
  "Tipping 10% or less",
  "Going barefoot in an airport",
  "Reclining your seat on a short flight",
  "Bringing smelly food on a plane",
  "Not making your bed every day",
  "Owning more than 3 houseplants",
  "Walking slowly in a shopping mall",
  "Using 'reply all' in a group email",
  "Having a ringtone instead of vibrate",
  "Not answering unknown numbers",
  "Keeping read receipts on",
  "Sliding into someone's DMs",
  "Using dark mode on everything",
  "Charging people to attend your birthday dinner",
  "Going to a restaurant and ordering off-menu",
  "Skipping the gym on a Monday",
  "Judging people by their coffee order",
  "Putting ice in red wine",
  // ── added to reach 200 ───────────────────────────────────────────────────────
  "Dipping chips in hummus instead of salsa",
  "Eating pizza with a knife and fork",
  "Adding cheese to seafood dishes",
  "Putting avocado on everything",
  "Ordering well-done steak",
  "Eating the end pieces of bread",
  "Drinking decaf coffee",
  "Adding ice to whisky",
  "Eating breakfast for dinner",
  "Putting ketchup on eggs",
  "Eating hot food with a cold drink",
  "Choosing a window seat on a plane",
  "Sleeping in on weekdays",
  "Working out at 5am",
  "Using a 'no phone after 9pm' rule",
  "Going to bed before 10pm on a Friday",
  "Spending Friday night alone watching TV",
  "Not going to someone's birthday party because you're tired",
  "Texting your ex on their birthday",
  "Keeping an ex's hoodie",
  "Following your ex on social media",
  "Posting a breakup on social media",
  "Crying at a wedding",
  "Having a friends-with-benefits arrangement",
  "Going on a date to IKEA",
  "Ghosting someone after one date",
  "Matching with someone you know in real life on a dating app",
  "Checking your partner's location constantly",
  "Having a joint bank account before marriage",
  "Not wanting children",
  "Staying friends with your ex",
  "Talking to strangers on public transport",
  "Making small talk with cashiers",
  "Complaining to a manager",
  "Leaving reviews for everything online",
  "Returning something after using it once",
  "Wearing the same outfit twice in a week",
  "Not showering every day",
  "Wearing perfume on a plane",
  "Wearing headphones at a party",
  "Taking your shoes off at other people's houses uninvited",
  "Asking guests to remove their shoes in your home",
  "Crying at a sad song in public",
  "Recording live concerts on your phone",
  "Posting every meal you eat online",
  "Not having social media at all",
  "Going on a digital detox holiday",
  "Not owning a TV",
  "Reading physical books instead of ebooks",
  "Preferring vinyl records over digital",
  "Going to the cinema alone",
  "Going to a restaurant alone and enjoying it",
  "Taking a solo holiday",
  "Talking to yourself out loud",
  "Having a favourite mug you get protective about",
  "Refusing to share your food",
  "Naming your car",
  "Talking to your pets like they understand everything",
  "Putting your pet in Halloween costumes",
  "Letting your pet sleep in your bed",
  "Spending more on your pet than on yourself",
  "Not liking dogs",
  "Preferring cats to dogs",
  "Getting a tattoo of something silly",
  "Dyeing your hair an unusual colour",
  "Wearing sunglasses indoors",
  "Not wearing sunscreen at the beach",
  "Spending hours choosing what to watch and then watching nothing",
  "Skipping to the end of a show to check the ending before watching",
  "Having a guilty pleasure playlist you'd be embarrassed by",
  "Listening to Christmas music before December",
  "Replaying a song on loop for hours",
  "Crying to sad music when you're already sad",
  "Singing loudly in the car",
  "Dancing alone in your kitchen when no one is watching",
  "Wearing pyjamas all day on weekends",
  "Having a 'clean enough' standard for your home",
  "Owning more books than you've read",
  "Buying plants and then forgetting to water them",
  "Using your phone in the bathroom",
  "Eating directly from the fridge at midnight",
  "Ordering a starter as your main course",
  "Sharing a main course at a restaurant",
  "Getting a doggy bag at a fancy restaurant",
  "Splitting Uber costs to the nearest penny",
  "Eating the free bread basket before the meal arrives",
  "Putting mustard on chips",
  "Mixing sweet and savoury in one bite",
  "Eating dessert before finishing your main",
  "Having dessert even when full",
  "Eating leftovers cold the next morning",
  "Taking the last biscuit without offering it around",
  "Being on your phone during dinner",
  "Waking someone up to tell them something that could wait",
  "Turning up at someone's house unannounced",
  "Borrowing something and not returning it for 6 months",
  "Going dutch on a first date",
  "Ordering the most expensive thing when someone else is paying",
  "Not bringing anything to a party you were invited to",
  "Arriving exactly on time (not 10 minutes early)",
  "Leaving a party without saying goodbye to the host",
  "Sending good morning texts to friends daily",
  "Taking 3 days to reply to a message",
  "Sending 15 separate messages instead of one long one",
  "Leaving voice memos instead of typing",
  "Having read receipts on",
  "Posting your gym session every single day",
  "Overexplaining an opinion nobody asked for",
  "Jumping queues if you think you can get away with it",
  "Requesting a song the DJ already just played",
  "Saving a seat at a concert when you arrived late",
  "Using a speakerphone in a public place",
  "Asking for separate bills at a big group dinner",
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
  // ── added to reach 30 total ──────────────────────────────────────────────────
  "Describe the best meal you've ever eaten",
  "Describe your ideal house",
  "What does your dream car look like?",
  "Describe your perfect date night",
  "Describe the best concert you've ever been to",
  "What would you do on a free day with no responsibilities?",
  "Describe your most embarrassing childhood memory",
  "Describe the strangest dream you've ever had",
  "What does your spirit animal look like?",
  "Describe the weirdest food combination you secretly love",
  "Describe your hometown to an alien who has never been to Earth",
  "What would the inside of your dream wardrobe look like?",
  "Describe your ideal superpower and how you'd use it",
  "Describe the worst haircut you've ever had",
  "Describe the perfect lazy Sunday breakfast",
  "What would your autobiography cover look like?",
  "Describe the most awkward family dinner you can imagine",
  "Describe what your pet is thinking right now",
  "What would you name your own island?",
  "Describe the wildest party you'd ever throw",
  "Describe your perfect morning routine",
  "What would you put on a billboard for everyone to see?",
  "Describe the funniest person you know",
  "Describe the most chaotic day at school or work you can imagine",
  "What would the menu at your dream restaurant look like?",
  // ── added to reach 50 ────────────────────────────────────────────────────────
  "Describe your worst-ever holiday",
  "What would your dream house look like?",
  "Describe the most embarrassing thing that has ever happened to you",
  "Describe the greatest meal you've ever eaten",
  "What would life be like if you were a famous musician?",
  "Describe your ideal Friday night",
  "What does your morning look like when it goes perfectly?",
  "Describe the best gift you've ever received",
  "What's the most adventurous thing you've ever done?",
  "Describe the weirdest person you've ever met",
  "What would you do on your last day if you knew it was coming?",
  "Describe your dream road trip across any country",
  "What would your perfect day off look like?",
  "Describe the funniest thing you've seen happen to a stranger",
  "What kind of job would you have in a fantasy world?",
  "Describe what heaven would look like according to you",
  "What would you do if money was no object for one week?",
  "Describe the perfect party from start to finish",
  "What would you change about the world if you had one superpower?",
];

export const SCRAPBOOK_WRITING_PROMPTS = [
  "Explain why you were late to the wedding",
  "Write a resignation letter from your job",
  "Explain to your mom why you missed Christmas",
  "Write a Tinder bio",
  "Explain why the dog ate your homework",
  "Write an apology to your landlord",
  "Explain why you're running for president",
  // ── added to reach 40 total ──────────────────────────────────────────────────
  "Pitch your startup idea to investors in one sentence",
  "Write a one-star Yelp review for a restaurant you love",
  "Explain why you were fired from your last job",
  "Write a birthday speech for someone you barely know",
  "Explain why you owe your best friend twenty dollars",
  "Write the worst possible horoscope for Scorpios this week",
  "Explain to your dentist why you haven't brushed in three days",
  "Write an out-of-office email that overshares completely",
  "Explain why you missed your own surprise party",
  "Write a Wikipedia article about the most boring thing imaginable",
  "Explain to airport security why you have 12 cheese wheels in your bag",
  "Write a Craigslist ad selling your ex's stuff",
  "Explain why your dog is more qualified than you for your job",
  "Write a thank-you note for a gift you absolutely hated",
  "Explain why you ate your roommate's leftovers",
  "Write the world's least convincing excuse note for school",
  "Pitch a reality TV show that should definitely not exist",
  "Explain why you need a second hamster",
  "Write your own obituary in a suspiciously upbeat tone",
  "Explain why being a professional napper is a valid career",
  "Write a yelp review for the waiting room at your dentist",
  "Explain to your bank why you need to upgrade your overdraft again",
  "Write a letter to your 8-year-old self, badly",
  "Explain why you deserve a discount at this restaurant",
  "Write a text to cancel plans in the most unconvincing way possible",
  "Explain why your houseplant died to a grief counsellor",
  "Write a speech accepting an award you definitely don't deserve",
  "Explain why you need three weeks off for a very mild cold",
  "Write the terms and conditions for being your friend",
  "Explain to a judge why you technically weren't speeding",
  "Write a product description for an item that doesn't exist yet",
  "Explain why your CV has a two-year gap labelled 'finding myself'",
  "Write a strongly worded letter about a slightly reclining airplane seat",
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
  {
    id: "g7",
    category: "Animals",
    realDescription: "A penguin sliding on its belly across the ice",
    glitchDescription: "A penguin waddling upright across the ice",
  },
  {
    id: "g8",
    category: "Food",
    realDescription: "A chef tossing pizza dough high into the air",
    glitchDescription: "A chef spinning pasta on a fork high into the air",
  },
  {
    id: "g9",
    category: "Sports",
    realDescription: "A gymnast doing a backflip on the balance beam",
    glitchDescription: "A gymnast doing a cartwheel on the balance beam",
  },
  {
    id: "g10",
    category: "City",
    realDescription: "A yellow taxi cab stuck in heavy traffic in New York",
    glitchDescription: "A yellow taxi cab parked on an empty street in New York",
  },
  {
    id: "g11",
    category: "Nature",
    realDescription: "A waterfall crashing into a turquoise pool",
    glitchDescription: "A waterfall crashing into a dark rocky canyon",
  },
  {
    id: "g12",
    category: "Space",
    realDescription: "An astronaut floating outside the space station with Earth below",
    glitchDescription: "An astronaut floating outside the space station with the Moon below",
  },
  {
    id: "g13",
    category: "People",
    realDescription: "A street performer juggling three flaming torches",
    glitchDescription: "A street performer juggling three glowing batons",
  },
  {
    id: "g14",
    category: "Animals",
    realDescription: "A bear fishing for salmon in a rushing river",
    glitchDescription: "A bear drinking from a rushing river",
  },
  {
    id: "g15",
    category: "Food",
    realDescription: "A towering six-layer birthday cake with rainbow frosting",
    glitchDescription: "A towering six-layer birthday cake with white frosting",
  },
  {
    id: "g16",
    category: "Sports",
    realDescription: "A soccer player scoring a bicycle kick into the top corner",
    glitchDescription: "A soccer player scoring a header into the top corner",
  },
  {
    id: "g17",
    category: "City",
    realDescription: "A double-decker bus crossing Tower Bridge in London",
    glitchDescription: "A double-decker bus crossing London Bridge in London",
  },
  {
    id: "g18",
    category: "Nature",
    realDescription: "A flock of flamingos standing in a shallow pink lake",
    glitchDescription: "A flock of flamingos flying over a shallow pink lake",
  },
  {
    id: "g19",
    category: "Space",
    realDescription: "A rocket launching with a massive plume of orange fire",
    glitchDescription: "A rocket launching with a massive plume of white smoke",
  },
  {
    id: "g20",
    category: "People",
    realDescription: "A toddler blowing out candles on a birthday cake and laughing",
    glitchDescription: "A toddler blowing out candles on a birthday cake and crying",
  },
  {
    id: "g21",
    category: "Animals",
    realDescription: "A parrot sitting on a pirate's left shoulder",
    glitchDescription: "A parrot sitting on a pirate's right shoulder",
  },
  {
    id: "g22",
    category: "Food",
    realDescription: "A sushi chef slicing a large tuna roll with a long knife",
    glitchDescription: "A sushi chef rolling a large tuna roll with a bamboo mat",
  },
  {
    id: "g23",
    category: "Sports",
    realDescription: "A surfer riding a massive wave with both arms stretched out",
    glitchDescription: "A surfer riding a massive wave with both arms held low",
  },
  {
    id: "g24",
    category: "City",
    realDescription: "Times Square at night with dozens of neon signs",
    glitchDescription: "Times Square at dusk with a few lit billboards",
  },
  {
    id: "g25",
    category: "Nature",
    realDescription: "A volcano erupting with bright lava flowing down its side",
    glitchDescription: "A volcano smoking heavily with no visible lava",
  },
  {
    id: "g26",
    category: "Space",
    realDescription: "The full moon rising behind a silhouette of pine trees",
    glitchDescription: "A crescent moon rising behind a silhouette of pine trees",
  },
  {
    id: "g27",
    category: "People",
    realDescription: "A bride and groom cutting a white three-tier wedding cake",
    glitchDescription: "A bride and groom cutting a white two-tier wedding cake",
  },
  {
    id: "g28",
    category: "Animals",
    realDescription: "A whale breaching completely out of the ocean at sunset",
    glitchDescription: "A whale breaching halfway out of the ocean at sunset",
  },
  {
    id: "g29",
    category: "Food",
    realDescription: "A hot dog cart vendor handing a customer a hot dog with mustard",
    glitchDescription: "A hot dog cart vendor handing a customer a hot dog with ketchup",
  },
  {
    id: "g30",
    category: "Sports",
    realDescription: "A baseball batter hitting a home run as confetti falls",
    glitchDescription: "A baseball pitcher throwing a perfect strike as confetti falls",
  },
  {
    id: "g31",
    category: "City",
    realDescription: "A night market with red paper lanterns strung between stalls",
    glitchDescription: "A night market with yellow paper lanterns strung between stalls",
  },
  {
    id: "g32",
    category: "Nature",
    realDescription: "A field of sunflowers all facing east at sunrise",
    glitchDescription: "A field of sunflowers all facing west at sunset",
  },
  {
    id: "g33",
    category: "Space",
    realDescription: "A meteor shower over a dark desert with no clouds",
    glitchDescription: "A meteor shower over a dark ocean with no clouds",
  },
  {
    id: "g34",
    category: "People",
    realDescription: "A skateboarder grinding a metal rail at a skate park",
    glitchDescription: "A skateboarder jumping a metal rail at a skate park",
  },
  {
    id: "g35",
    category: "Animals",
    realDescription: "A lioness carrying a cub gently in her mouth",
    glitchDescription: "A lion nudging a cub gently with his nose",
  },
  {
    id: "g36",
    category: "Food",
    realDescription: "A waffle iron producing a perfectly square golden waffle",
    glitchDescription: "A waffle iron producing a perfectly round golden waffle",
  },
  {
    id: "g37",
    category: "Sports",
    realDescription: "A swimmer touching the wall to finish a race and pumping her fist",
    glitchDescription: "A swimmer touching the wall to finish a race and raising both arms",
  },
  {
    id: "g38",
    category: "City",
    realDescription: "A subway train packed with rush-hour commuters reading newspapers",
    glitchDescription: "A subway train packed with rush-hour commuters looking at phones",
  },
  {
    id: "g39",
    category: "Nature",
    realDescription: "A cherry blossom tree in full bloom with pink petals falling",
    glitchDescription: "A cherry blossom tree in full bloom with white petals falling",
  },
  {
    id: "g40",
    category: "People",
    realDescription: "A street artist painting a large mural on a brick wall",
    glitchDescription: "A street artist photographing a large mural on a brick wall",
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
  imageUrl?: string;      // Reference image shown after round reveal
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
  { id: "c1",  name: "The Starbucks Mermaid",    category: "logos",      difficulty: "medium", hint: "Green circular coffee logo" },
  { id: "c2",  name: "Super Mario",              category: "characters", difficulty: "easy",   hint: "Nintendo's iconic plumber" },
  { id: "c3",  name: "The Twitter Bird",         category: "logos",      difficulty: "easy",   hint: "Now called X but you know the bird" },
  { id: "c4",  name: "The Netflix N",            category: "logos",      difficulty: "easy",   hint: "Red streaming giant logo" },
  { id: "c5",  name: "Pikachu",                  category: "characters", difficulty: "medium", hint: "The most famous Pokémon" },
  { id: "c6",  name: "The Apple Logo",           category: "logos",      difficulty: "easy",   hint: "Bitten apple, tech company" },
  { id: "c7",  name: "Mickey Mouse Ears",        category: "characters", difficulty: "easy",   hint: "Three circles" },
  { id: "c8",  name: "The McDonald's Arches",    category: "logos",      difficulty: "easy",   hint: "Golden M" },
  { id: "c9",  name: "Darth Vader's Helmet",     category: "characters", difficulty: "hard",   hint: "Star Wars villain" },
  { id: "c10", name: "The Spotify Logo",         category: "logos",      difficulty: "medium", hint: "Green circle with sound waves" },
  { id: "c11", name: "SpongeBob SquarePants",    category: "characters", difficulty: "hard",   hint: "Square sponge" },
  { id: "c12", name: "The Nike Swoosh",          category: "logos",      difficulty: "easy",   hint: "Just do it" },
  // ── added batch — c13 through c40 ──────────────────────────────────────────
  {
    id: "c13", name: "Batman Symbol", category: "logos", difficulty: "medium",
    hint: "Black bat silhouette in a yellow oval",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Batman_dc_logo.png/320px-Batman_dc_logo.png",
  },
  {
    id: "c14", name: "Adidas Three Stripes", category: "logos", difficulty: "easy",
    hint: "Three parallel diagonal stripes",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/Adidas_Logo.svg/320px-Adidas_Logo.svg.png",
  },
  {
    id: "c15", name: "Instagram Logo", category: "logos", difficulty: "easy",
    hint: "Rounded square with a camera lens and gradient background",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Instagram_icon.png/240px-Instagram_icon.png",
  },
  {
    id: "c16", name: "YouTube Play Button", category: "logos", difficulty: "easy",
    hint: "Red rectangle with a white triangle inside",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/YouTube_full-color_icon_%282017%29.svg/320px-YouTube_full-color_icon_%282017%29.svg.png",
  },
  {
    id: "c17", name: "Pepsi Logo", category: "logos", difficulty: "medium",
    hint: "Blue, red and white circle split by a wavy line",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/Pepsi_logo_2014.svg/240px-Pepsi_logo_2014.svg.png",
  },
  {
    id: "c18", name: "The Mona Lisa", category: "album_art", difficulty: "hard",
    hint: "Renaissance woman with no eyebrows, mysterious smile",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg/240px-Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg",
  },
  {
    id: "c19", name: "Homer Simpson", category: "characters", difficulty: "medium",
    hint: "Bald, round-headed cartoon dad with stubble",
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/0/02/Homer_Simpson_2006.png/220px-Homer_Simpson_2006.png",
  },
  {
    id: "c20", name: "Among Us Crewmate", category: "characters", difficulty: "easy",
    hint: "Bean-shaped spacesuit figure with a visor",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Among_Us_cover_art.jpg/240px-Among_Us_cover_art.jpg",
  },
  {
    id: "c21", name: "Minecraft Creeper Face", category: "characters", difficulty: "easy",
    hint: "Blocky green face with four dark squares",
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/5/57/Minecraft_creeper.svg/240px-Minecraft_creeper.svg.png",
  },
  {
    id: "c22", name: "Pac-Man", category: "characters", difficulty: "easy",
    hint: "Yellow circle with a wedge mouth open",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Pacman.svg/240px-Pacman.svg.png",
  },
  {
    id: "c23", name: "Space Invader", category: "characters", difficulty: "medium",
    hint: "Pixelated alien with two small antennae",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Space_Invaders_Color_small.png/240px-Space_Invaders_Color_small.png",
  },
  {
    id: "c24", name: "WhatsApp Logo", category: "logos", difficulty: "easy",
    hint: "Green circle with a white phone handset speech bubble",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/240px-WhatsApp.svg.png",
  },
  {
    id: "c25", name: "Snapchat Ghost", category: "logos", difficulty: "easy",
    hint: "White cartoon ghost on a yellow background",
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/a/ad/Snapchat_logo.svg/240px-Snapchat_logo.svg.png",
  },
  {
    id: "c26", name: "Discord Logo", category: "logos", difficulty: "medium",
    hint: "Blue blurple controller-shaped head with two eyes and no mouth",
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/9/98/Discord_logo.svg",
  },
  {
    id: "c27", name: "Reddit Alien (Snoo)", category: "logos", difficulty: "medium",
    hint: "White alien with orange antenna sitting on an orange circle",
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/8/82/Reddit_logo_and_wordmark.svg/320px-Reddit_logo_and_wordmark.svg.png",
  },
  {
    id: "c28", name: "The Flash Logo", category: "logos", difficulty: "easy",
    hint: "Yellow lightning bolt in a white circle on red",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/The_Flash_%28TV_Series%29_Logo.png/320px-The_Flash_%28TV_Series%29_Logo.png",
  },
  {
    id: "c29", name: "Superman S", category: "logos", difficulty: "easy",
    hint: "Diamond shield with a red S and yellow background",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Superman_shield.svg/240px-Superman_shield.svg.png",
  },
  {
    id: "c30", name: "Bart Simpson", category: "characters", difficulty: "medium",
    hint: "Spiky-haired yellow boy with a red shirt",
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/a/aa/Bart_Simpson_200px.png/220px-Bart_Simpson_200px.png",
  },
  {
    id: "c31", name: "Hello Kitty", category: "characters", difficulty: "medium",
    hint: "White cat face with no mouth, a bow, and dot eyes",
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/0/05/Hello_kitty_character_portrait.png/240px-Hello_kitty_character_portrait.png",
  },
  {
    id: "c32", name: "Pokéball", category: "characters", difficulty: "easy",
    hint: "Red and white sphere split by a black equator with a button",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Pok%C3%A9_Ball_icon.svg/240px-Pok%C3%A9_Ball_icon.svg.png",
  },
  {
    id: "c33", name: "Sonic the Hedgehog", category: "characters", difficulty: "medium",
    hint: "Blue hedgehog with red shoes and quills swept back",
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/6/6a/Sonic_the_Hedgehog_artwork.png/220px-Sonic_the_Hedgehog_artwork.png",
  },
  {
    id: "c34", name: "Luigi", category: "characters", difficulty: "easy",
    hint: "Taller plumber brother in green with a big moustache",
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/f/f1/LuigiNSMBW.png/220px-LuigiNSMBW.png",
  },
  {
    id: "c35", name: "Yoda", category: "characters", difficulty: "medium",
    hint: "Small green alien with huge pointy ears and a walking stick",
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/9/9b/Yoda_Empire_Strikes_Back.png/220px-Yoda_Empire_Strikes_Back.png",
  },
  {
    id: "c36", name: "Captain America Shield", category: "logos", difficulty: "medium",
    hint: "Circular red, white and blue shield with a star in the centre",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Captain_America%27s_shield.svg/240px-Captain_America%27s_shield.svg.png",
  },
  {
    id: "c37", name: "Iron Man Helmet", category: "characters", difficulty: "hard",
    hint: "Red and gold armoured face with narrow glowing eyes",
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/6/6f/Iron_Man_-_Extremis_Armor.jpg/220px-Iron_Man_-_Extremis_Armor.jpg",
  },
  {
    id: "c38", name: "Wonder Woman Logo", category: "logos", difficulty: "medium",
    hint: "Stylised golden double-W eagle emblem",
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Wonder_Woman_emblem.svg/240px-Wonder_Woman_emblem.svg.png",
  },
  {
    id: "c39", name: "Shrek", category: "characters", difficulty: "medium",
    hint: "Large green ogre with two stubby horns on his head",
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/1/14/Shrek_Shrek.png/220px-Shrek_Shrek.png",
  },
  {
    id: "c40", name: "The Mandalorian Helmet", category: "characters", difficulty: "hard",
    hint: "Smooth silver T-visor helmet from a galaxy far, far away",
    imageUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/8/80/The_Mandalorian_TV_series_logo.png/320px-The_Mandalorian_TV_series_logo.png",
  },
];
