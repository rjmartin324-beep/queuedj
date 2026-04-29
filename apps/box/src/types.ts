// ─── Trivia ───────────────────────────────────────────────────────────────────

export type TriviaCategory =
  | "General Knowledge"
  | "Science & Nature"
  | "History"
  | "Pop Culture"
  | "Sports"
  | "Geography"
  | "Movies & TV"
  | "Custom";

export type TriviaDifficulty = "easy" | "medium" | "hard" | "extreme";
export type TriviaAnswer = "a" | "b" | "c" | "d";

export interface TriviaQuestion {
  id: number;
  category: TriviaCategory;
  question: string;
  a: string;
  b: string;
  c: string;
  d: string;
  correct: TriviaAnswer;
  difficulty: TriviaDifficulty;
}

export interface TriviaScore {
  guestId: string;
  displayName: string;
  score: number;
  correct: number;
  wrong: number;
  streak: number;
  eliminated: boolean;  // Sudden Death
}

export type TriviaPhase =
  | "countdown"   // 3-2-1 before question appears
  | "question"    // question live, answers open
  | "reveal"      // correct answer shown, score delta displayed
  | "round_end"   // round standings
  | "game_over";  // final podium

export type TournamentRound =
  | "Sweep"        // mixed, 20s
  | "Draft Pick"   // host picks category, 15s
  | "Big Board"    // double points, 20s
  | "Hard Mode"    // hard only, 15s
  | "Sudden Death"; // elimination, 10s

export interface TriviaGameState {
  sessionId: string;
  round: number;          // 1-5 in tournament, always 1 in standard
  roundName: TournamentRound | "Standard";
  questionIndex: number;  // 0-based within current round
  totalInRound: number;
  phase: TriviaPhase;
  question: TriviaQuestion | null;
  timeLimit: number;      // seconds
  deadline: number | null;
  answers: Record<string, TriviaAnswer>;   // guestId → answer (hidden until reveal)
  answeredAt: Record<string, number>;      // guestId → timestamp (for speed bonus)
  scores: TriviaScore[];
  mode: PlayMode;
  tournament: boolean;
  passOrder: string[];    // pass_tablet only: guestIds in turn order
  passIndex: number;      // whose turn it is
  draftCategory: TriviaCategory | null;   // Draft Pick round
  pointMultiplier: number;
  askedQuestionIds: number[];   // questions already drawn this session, excluded from future round draws
}

// ─── Play Modes ───────────────────────────────────────────────────────────────

export type PlayMode =
  | "pass_tablet"   // one device, no phones
  | "phones_only"   // simultaneous, camera, private answers
  | "host_tablet";  // shared board on tablet + phone controllers

// ─── Room ─────────────────────────────────────────────────────────────────────

export type RoomPhase = "lobby" | "playing" | "results" | "closed";

export interface Room {
  id: string;
  code: string;         // 4-char uppercase code guests type
  hostGuestId: string;
  phase: RoomPhase;
  mode: PlayMode;
  experience: string;   // "trivia" | "would_you_rather" | etc.
  createdAt: number;
}

// ─── Members ──────────────────────────────────────────────────────────────────

export type MemberRole = "host" | "guest";

export interface Member {
  guestId: string;
  displayName: string;
  role: MemberRole;
  joinedAt: number;
  connectedAt: number;  // last socket connect time
}

// ─── WouldYouRather ───────────────────────────────────────────────────────────

export type WYRVote = "a" | "b";
export type WYRPhase = "countdown" | "question" | "reveal" | "game_over";

export interface WYRPrompt {
  id: number;
  optionA: string;
  optionB: string;
  category: string;
}

export interface WYRScore {
  guestId: string;
  displayName: string;
  score: number;
  bold: number;   // times voted with minority
  safe: number;   // times voted with majority
}

export interface WYRGameState {
  sessionId: string;
  questionIndex: number;
  totalQuestions: number;
  phase: WYRPhase;
  prompt: WYRPrompt | null;
  votes: Record<string, WYRVote>;
  scores: WYRScore[];
  mode: PlayMode;
  passOrder: string[];
  passIndex: number;
}

// ─── WebSocket Messages — Client → Server ─────────────────────────────────────

export type ClientMessage =
  | { type: "room:create"; guestId: string; displayName: string; mode: PlayMode; experience: string; tournament?: boolean }
  | { type: "room:join";   guestId: string; displayName: string; code: string }
  | { type: "room:leave";  guestId: string; roomId: string }
  | { type: "host:start";  guestId: string; roomId: string; tournament?: boolean }
  | { type: "host:kick";   guestId: string; roomId: string; targetGuestId: string }
  | { type: "host:end_round"; guestId: string; roomId: string }
  | { type: "host:next_question"; guestId: string; roomId: string }
  | { type: "host:play_again"; guestId: string; roomId: string }
  | { type: "host:force_end"; guestId: string; roomId: string }
  | { type: "host:pick_category"; guestId: string; roomId: string; category: TriviaCategory }
  | { type: "game:answer"; guestId: string; roomId: string; answer: TriviaAnswer }
  | { type: "game:action"; guestId: string; roomId: string; action: string; payload: unknown }
  | { type: "ping" };

// ─── WebSocket Messages — Server → Client ─────────────────────────────────────

export type ServerMessage =
  | { type: "room:created";  room: Room; you: Member; members: Member[] }
  | { type: "room:joined";   room: Room; you: Member; members: Member[] }
  | { type: "room:error";    code: string; message: string }
  | { type: "room:member_joined"; member: Member }
  | { type: "room:member_left";   guestId: string }
  | { type: "room:members";       members: Member[] }
  | { type: "room:phase_changed"; phase: RoomPhase }
  | { type: "room:closed" }
  | { type: "room:kicked" }
  | { type: "game:state";    state: unknown }
  | { type: "game:event";    event: string; payload: unknown }
  | { type: "pong" };
