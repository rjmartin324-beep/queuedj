// ─────────────────────────────────────────────────────────────────────────────
// Experience System — Platform Layer
//
// The room/QR/realtime system is the PLATFORM.
// DJ, Trivia, Raffle, Karaoke are EXPERIENCES that plug into it.
//
// Every experience implements ExperienceModule.
// The host switches experiences. Guest UI auto-swaps.
// The same 3 socket events handle everything for every experience.
// ─────────────────────────────────────────────────────────────────────────────

import type { Server } from "socket.io";

export type ExperienceType =
  | "dj"                      // Phase 1 — music + queue + vibe
  | "trivia"                  // Phase 1 — Q&A with leaderboard
  | "unpopular_opinions"      // Phase 1 — judge rates, everyone guesses
  | "scrapbook_sabotage"      // Phase 1 — restricted writing with word bank
  | "the_glitch"              // Phase 1 — social deduction / imposter
  | "copyright_infringement"  // Phase 1 — draw famous logos from memory
  | "drawback"                // Phase 2 — finger drawing + crowd votes
  | "scavenger_snap"          // Phase 2 — camera challenge + crowd votes
  | "geo_guesser"             // Phase 2 — photo + world map pin drop
  | "artifact_hunt"           // Phase 2 — QR scavenger hunt
  | "night_shift"             // Phase 2 — social deduction murder mystery
  | "mind_mole"               // Phase 2 — find the mole with the different word
  | "guess_the_song"          // Phase 2 — music — type the track title first
  | "finish_the_lyric"        // Phase 2 — music — fill in the blank lyric
  | "name_that_genre"         // Phase 2 — music — multiple choice genre ID
  | "vibe_check"              // Phase 2 — music — rate the current track 1-10
  | "would_you_rather"        // Party game — two options, vote
  | "never_have_i_ever"       // Party game — confess or pass
  | "truth_or_dare"           // Party game — spin and act
  | "hot_takes"               // Party game — opinion slider
  | "two_truths_one_lie"      // Party game — spot the lie
  | "celebrity_head"          // Party game — guess who you are
  | "connections"             // Party game — group 16 words into 4
  | "draw_it"                 // Party game — draw and guess
  | "word_association"        // Party game — word chain
  | "chain_reaction"          // Party game — letter-chain words
  | "fake_news"               // Party game — real or fake headline
  | "emoji_story"             // Party game — decode emoji sequence
  | "rank_it"                 // Party game — rank the list
  | "speed_round"             // Party game — 30-second challenge
  | "thumb_war"               // Party game — rapid tap battle
  | "musical_chairs"          // Party game — digital musical chairs
  | "pop_culture_quiz"        // Party game — pop culture trivia
  | "story_time"              // Party game — one-word story
  | "who_knows_who"           // Party game — group voting
  | "bucket_list"             // Party game — guess who wrote it
  | "fight_or_flight"         // Party game — binary choice
  | "alibi"                   // Party game — who did the crime
  | "cropped_look"            // Party game — zoom-in guess
  | "mind_reading"            // Party game — number pattern
  | "improv_challenge"        // Party game — scene performance
  | "accent_challenge"        // Party game — read in accent
  | "hum_it"                  // Party game — hum the song
  | "mimic_me"                // Party game — copy the move
  | "lyrics_drop"             // Party game — fill the blank
  | "photo_bomb"              // Party game — odd one out
  | "speed_typing"            // Party game — typing race
  | "party_dice"              // Party game — roll for challenge
  | "poll"                    // Phase 3 — standalone poll session
  | "raffle"                  // Phase 5 — ticket draw
  | "countdown"               // Phase 5 — event timer
  | "karaoke";                // Phase 7 — lyrics + queue

// ─── Guest View Descriptor ───────────────────────────────────────────────────
// Server tells guest phones what UI to render.
// Guest app has a ViewRouter that maps type → React component.

export type GuestViewType =
  | "dj_queue"          // Song queue + voting + now playing
  | "trivia_waiting"    // Waiting for next question
  | "trivia_question"   // Active question with answer buttons
  | "trivia_result"     // Answer reveal + score
  | "leaderboard"       // Full leaderboard
  | "poll_active"       // Vote on a poll option
  | "poll_result"       // Poll result display
  | "raffle_entry"              // Enter raffle
  | "raffle_draw"               // Watching the draw
  | "countdown"                 // Timer display
  | "opinions_judging"          // You are the Judge — secretly rate the prompt
  | "opinions_guessing"         // Guess the judge's score + optional bet
  | "opinions_reveal"           // Show the answer + scores
  | "scrapbook_word_input"      // Submit your description (word bank source)
  | "scrapbook_word_bank"       // See the combined word bank
  | "scrapbook_writing"         // Write your response using only word bank words
  | "scrapbook_voting"          // Vote on funniest response
  | "scrapbook_reveal"          // See who wrote what
  | "glitch_watching"           // View your prompt (5s timer)
  | "glitch_describing"         // Everyone types/speaks their description
  | "glitch_voting"             // Vote on who is The Glitch
  | "glitch_reveal"             // Reveal the Glitch + their different prompt
  | "copyright_viewing"         // See the famous logo (3s only)
  | "copyright_drawing"         // Draw it from memory (60s)
  | "copyright_gallery"         // See all drawings, vote
  | "copyright_results"         // Winner announced
  | "scrapbook_waiting"         // Waiting for other writers
  | "glitch_waiting"            // Waiting for next clip
  | "geo_guessing"              // Photo shown — tap map to place pin
  | "geo_region_guess"          // Tap the region on a map
  | "geo_reveal"                // Correct location revealed + everyone's pins
  | "geo_waiting"               // Waiting between rounds
  | "drawback_drawing"          // Drawing the prompt
  | "drawback_voting"           // Voting for best drawing
  | "drawback_reveal"           // See who drew what + scores
  | "drawback_waiting"          // Waiting between drawing rounds
  | "snap_challenge"            // Camera challenge — take/upload photo
  | "snap_gallery"              // See all submitted photos + vote
  | "snap_results"              // Winner revealed
  | "snap_waiting"              // Waiting between challenges
  | "artifact_hunt"             // QR scavenger hunt — all phases handled internally
  | "night_shift"               // Social deduction — all phases handled internally
  | "mind_mole"                 // Word mole — all phases handled internally
  | "guess_the_song"            // Type the title — all phases handled internally
  | "finish_the_lyric"          // Fill in blank — all phases handled internally
  | "name_that_genre"           // Genre multiple choice — all phases handled internally
  | "vibe_check"                // Rate 1-10 — all phases handled internally
  | "would_you_rather"          // all phases handled internally via data.phase
  | "never_have_i_ever"         // all phases handled internally via data.phase
  | "truth_or_dare"             // all phases handled internally via data.phase
  | "hot_takes"                 // all phases handled internally via data.phase
  | "two_truths_one_lie"        // all phases handled internally via data.phase
  | "celebrity_head"            // all phases handled internally via data.phase
  | "connections"               // all phases handled internally via data.phase
  | "draw_it"                   // all phases handled internally via data.phase
  | "word_association"          // all phases handled internally via data.phase
  | "chain_reaction"            // all phases handled internally via data.phase
  | "fake_news"                 // all phases handled internally via data.phase
  | "emoji_story"               // all phases handled internally via data.phase
  | "rank_it"                   // all phases handled internally via data.phase
  | "speed_round"               // all phases handled internally via data.phase
  | "thumb_war"                 // all phases handled internally via data.phase
  | "musical_chairs"            // all phases handled internally via data.phase
  | "pop_culture_quiz"          // all phases handled internally via data.phase
  | "story_time"                // all phases handled internally via data.phase
  | "who_knows_who"             // all phases handled internally via data.phase
  | "bucket_list"               // all phases handled internally via data.phase
  | "fight_or_flight"           // all phases handled internally via data.phase
  | "alibi"                     // all phases handled internally via data.phase
  | "cropped_look"              // all phases handled internally via data.phase
  | "mind_reading"              // all phases handled internally via data.phase
  | "improv_challenge"              // all phases handled internally via data.phase
  | "improv_challenge_performing"   // performer's scene
  | "improv_challenge_rating"       // audience rates
  | "improv_challenge_reveal"       // scores shown
  | "improv_challenge_finished"     // game over
  | "accent_challenge"              // all phases handled internally via data.phase
  | "accent_challenge_performing"   // performer reads phrase
  | "accent_challenge_rating"       // audience rates
  | "accent_challenge_finished"     // game over
  | "hum_it"                        // all phases handled internally via data.phase
  | "hum_it_humming"                // hummer's turn
  | "hum_it_guessing"               // others guess
  | "hum_it_reveal"                 // answer shown
  | "hum_it_finished"               // game over
  | "mimic_me"                  // all phases handled internally via data.phase
  | "lyrics_drop"               // all phases handled internally via data.phase
  | "photo_bomb"                // all phases handled internally via data.phase
  | "speed_typing"              // all phases handled internally via data.phase
  | "party_dice"                // all phases handled internally via data.phase
  | "intermission";             // Between experiences — host is setting up next

export interface GuestViewDescriptor {
  type: GuestViewType;
  data?: unknown; // Experience-specific payload
}

/** Convenience: cast guestViewData to a loose record without full `any` */
export type GuestViewPayload = Record<string, unknown>;

// ─── Experience Module Interface ─────────────────────────────────────────────
// Every experience implements this. The platform calls these methods.
// Experiences never talk to each other — only through the platform.

export interface ExperienceModule {
  readonly type: ExperienceType;

  /** Called when host activates this experience */
  onActivate(roomId: string, hostGuestId: string, options?: unknown): Promise<void>;

  /** Called when host switches away. Clean up state. */
  onDeactivate(roomId: string): Promise<void>;

  /** Route an action from any member (host or guest) */
  handleAction(params: {
    action: string;
    payload: unknown;
    roomId: string;
    guestId: string;
    role: "HOST" | "CO_HOST" | "GUEST";
    io: Server;
  }): Promise<void>;

  /** What guest phones should currently show */
  getGuestViewDescriptor(roomId: string): Promise<GuestViewDescriptor>;
}

// ─── Socket Events (experience layer) ────────────────────────────────────────
// These 3 events handle ALL experiences. Typed payload varies per experience.

export interface ExperienceChangedEvent {
  experienceType: ExperienceType;
  view: GuestViewDescriptor;
  sequenceId: number;
}

export interface ExperienceActionPayload {
  roomId: string;
  guestId: string;
  action: string;
  payload: unknown;
}

export interface ExperienceStateEvent {
  experienceType: ExperienceType;
  state: unknown;       // Experience-specific state snapshot
  view: GuestViewDescriptor;
  sequenceId: number;
}

// ─── Trivia Types (Phase 3) ───────────────────────────────────────────────────

export interface TriviaQuestion {
  id: string;
  text: string;
  options: TriviaOption[];
  correctOptionId: string;
  timeLimitSeconds: number;
  category?: string;
  difficulty?: "easy" | "medium" | "hard";
}

export interface TriviaOption {
  id: string;
  text: string;
}

export interface TriviaRoundState {
  roundNumber: number;
  totalRounds: number;
  currentQuestion?: TriviaQuestion;
  questionStartedAt?: number;
  answers: Record<string, string>; // guestId → optionId (server only)
  scores: Record<string, number>;  // guestId → total score
  phase: "waiting" | "question" | "reveal" | "leaderboard" | "finished";
}

export interface TriviaAnswerAction {
  action: "submit_answer";
  payload: { optionId: string };
}

export interface TriviaHostAction {
  action: "start_round" | "next_question" | "show_leaderboard" | "end_trivia";
  payload?: unknown;
}

// ─── DJ Experience Types ──────────────────────────────────────────────────────

export interface DJExperienceState {
  nowPlaying: string | null;   // ISRC
  queueLength: number;
  crowdState: string;
  bpm: number | null;
  isBathroomBreak: boolean;
}
