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
  | "geo_guessing"              // Photo shown — tap map to place pin
  | "geo_reveal"               // Correct location revealed + everyone's pins
  | "drawback_drawing"          // Drawing the prompt
  | "drawback_voting"           // Voting for best drawing
  | "drawback_reveal"           // See who drew what + scores
  | "snap_challenge"            // Camera challenge — take/upload photo
  | "snap_gallery"              // See all submitted photos + vote
  | "snap_results"              // Winner revealed
  | "intermission";             // Between experiences — host is setting up next

export interface GuestViewDescriptor {
  type: GuestViewType;
  data?: unknown; // Experience-specific payload
}

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
