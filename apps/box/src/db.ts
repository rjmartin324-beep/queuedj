import { DatabaseSync } from "node:sqlite";
import path from "path";
import type { Room, Member, TriviaQuestion, TriviaCategory, TriviaDifficulty, TriviaAnswer, WYRPrompt } from "./types";

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "partyglue.db");

const db = new DatabaseSync(DB_PATH);

db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA synchronous = NORMAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    id          TEXT PRIMARY KEY,
    code        TEXT UNIQUE NOT NULL,
    host_guest_id TEXT NOT NULL,
    phase       TEXT NOT NULL DEFAULT 'lobby',
    mode        TEXT NOT NULL,
    experience  TEXT NOT NULL,
    created_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS members (
    guest_id    TEXT NOT NULL,
    room_id     TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'guest',
    joined_at   INTEGER NOT NULL,
    connected_at INTEGER NOT NULL,
    PRIMARY KEY (guest_id, room_id)
  );

  CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
  CREATE INDEX IF NOT EXISTS idx_members_room ON members(room_id);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS trivia_questions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    category    TEXT NOT NULL,
    question    TEXT NOT NULL,
    answer_a    TEXT NOT NULL,
    answer_b    TEXT NOT NULL,
    answer_c    TEXT NOT NULL,
    answer_d    TEXT NOT NULL,
    correct     TEXT NOT NULL CHECK(correct IN ('a','b','c','d')),
    difficulty  TEXT NOT NULL DEFAULT 'medium' CHECK(difficulty IN ('easy','medium','hard','extreme'))
  );

  CREATE TABLE IF NOT EXISTS game_sessions (
    id          TEXT PRIMARY KEY,
    room_id     TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    experience  TEXT NOT NULL,
    round       INTEGER NOT NULL DEFAULT 1,
    created_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS scores (
    guest_id      TEXT NOT NULL,
    session_id    TEXT NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    display_name  TEXT NOT NULL,
    score         INTEGER NOT NULL DEFAULT 0,
    correct       INTEGER NOT NULL DEFAULT 0,
    wrong         INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guest_id, session_id)
  );

  CREATE INDEX IF NOT EXISTS idx_trivia_category ON trivia_questions(category);
  CREATE INDEX IF NOT EXISTS idx_trivia_difficulty ON trivia_questions(difficulty);
  CREATE INDEX IF NOT EXISTS idx_sessions_room ON game_sessions(room_id);
  CREATE INDEX IF NOT EXISTS idx_scores_session ON scores(session_id);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS wyr_prompts (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    option_a  TEXT NOT NULL,
    option_b  TEXT NOT NULL,
    category  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_wyr_category ON wyr_prompts(category);
`);

// ─── Rooms ────────────────────────────────────────────────────────────────────

const insertRoom = db.prepare(
  "INSERT INTO rooms (id, code, host_guest_id, mode, experience, created_at) VALUES (?, ?, ?, ?, ?, ?)"
);

const getRoom = db.prepare("SELECT * FROM rooms WHERE id = ?");
const getRoomByCode = db.prepare("SELECT * FROM rooms WHERE code = ?");
const updateRoomPhase = db.prepare("UPDATE rooms SET phase = ? WHERE id = ?");
const updateRoomHostStmt = db.prepare("UPDATE rooms SET host_guest_id = ? WHERE id = ?");
const deleteRoom = db.prepare("DELETE FROM rooms WHERE id = ?");

// ─── Members ──────────────────────────────────────────────────────────────────

const upsertMember = db.prepare(`
  INSERT INTO members (guest_id, room_id, display_name, role, joined_at, connected_at)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT (guest_id, room_id) DO UPDATE SET
    display_name = excluded.display_name,
    connected_at = excluded.connected_at
`);

const removeMember = db.prepare("DELETE FROM members WHERE guest_id = ? AND room_id = ?");
const getRoomMembers = db.prepare("SELECT * FROM members WHERE room_id = ? ORDER BY joined_at ASC");
const getMember = db.prepare("SELECT * FROM members WHERE guest_id = ? AND room_id = ?");
const updateMemberRoleStmt = db.prepare("UPDATE members SET role = ? WHERE guest_id = ? AND room_id = ?");

// ─── Row mappers ──────────────────────────────────────────────────────────────

function rowToRoom(row: any): Room {
  return {
    id: row.id,
    code: row.code,
    hostGuestId: row.host_guest_id,
    phase: row.phase as Room["phase"],
    mode: row.mode as Room["mode"],
    experience: row.experience,
    createdAt: row.created_at,
  };
}

function rowToMember(row: any): Member {
  return {
    guestId: row.guest_id,
    displayName: row.display_name,
    role: row.role as Member["role"],
    joinedAt: row.joined_at,
    connectedAt: row.connected_at,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function createRoom(room: Room): void {
  insertRoom.run(room.id, room.code, room.hostGuestId, room.mode, room.experience, room.createdAt);
}

export function findRoom(id: string): Room | null {
  const row = getRoom.get(id) as any;
  return row ? rowToRoom(row) : null;
}

export function findRoomByCode(code: string): Room | null {
  const row = getRoomByCode.get(code) as any;
  return row ? rowToRoom(row) : null;
}

export function setRoomPhase(id: string, phase: Room["phase"]): void {
  updateRoomPhase.run(phase, id);
}

export function updateRoomHost(id: string, hostGuestId: string): void {
  updateRoomHostStmt.run(hostGuestId, id);
}

export function closeRoom(id: string): void {
  deleteRoom.run(id);
}

export function putMember(roomId: string, member: Member): void {
  upsertMember.run(member.guestId, roomId, member.displayName, member.role, member.joinedAt, member.connectedAt);
}

export function dropMember(roomId: string, guestId: string): void {
  removeMember.run(guestId, roomId);
}

export function listMembers(roomId: string): Member[] {
  return (getRoomMembers.all(roomId) as any[]).map(rowToMember);
}

export function findMember(roomId: string, guestId: string): Member | null {
  const row = getMember.get(guestId, roomId) as any;
  return row ? rowToMember(row) : null;
}

export function updateMemberRole(roomId: string, guestId: string, role: Member["role"]): void {
  updateMemberRoleStmt.run(role, guestId, roomId);
}

// ─── Trivia Questions ─────────────────────────────────────────────────────────

const insertQuestion = db.prepare(
  "INSERT INTO trivia_questions (category, question, answer_a, answer_b, answer_c, answer_d, correct, difficulty) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
);

const countQuestions = db.prepare("SELECT COUNT(*) as n FROM trivia_questions");

const getQuestionsByCategory = db.prepare(
  "SELECT * FROM trivia_questions WHERE category = ? AND difficulty != 'extreme' ORDER BY RANDOM() LIMIT ?"
);

const getRandomQuestions = db.prepare(
  "SELECT * FROM trivia_questions WHERE difficulty != 'extreme' ORDER BY RANDOM() LIMIT ?"
);

const getHardQuestions = db.prepare(
  "SELECT * FROM trivia_questions WHERE difficulty IN ('hard', 'extreme') ORDER BY RANDOM() LIMIT ?"
);

function rowToQuestion(row: any): TriviaQuestion {
  return {
    id: row.id,
    category: row.category as TriviaCategory,
    question: row.question,
    a: row.answer_a,
    b: row.answer_b,
    c: row.answer_c,
    d: row.answer_d,
    correct: row.correct as TriviaAnswer,
    difficulty: row.difficulty as TriviaDifficulty,
  };
}

export function seedQuestion(q: Omit<TriviaQuestion, "id">): void {
  insertQuestion.run(q.category, q.question, q.a, q.b, q.c, q.d, q.correct, q.difficulty);
}

export function triviaQuestionCount(): number {
  return (countQuestions.get() as any).n as number;
}

export function drawQuestions(count: number, category?: TriviaCategory, hardOnly?: boolean): TriviaQuestion[] {
  let rows: any[];
  if (hardOnly) {
    rows = getHardQuestions.all(count) as any[];
  } else if (category) {
    rows = getQuestionsByCategory.all(category, count) as any[];
    if (rows.length < count) {
      // Pad with random questions from any category when the specific one runs short
      const needed = count - rows.length;
      const ids = rows.map((r: any) => r.id as number);
      const placeholders = ids.length > 0 ? `AND id NOT IN (${ids.map(() => "?").join(",")})` : "";
      const padRows = db.prepare(
        `SELECT * FROM trivia_questions WHERE difficulty != 'extreme' ${placeholders} ORDER BY RANDOM() LIMIT ?`
      ).all(...ids, needed) as any[];
      rows = [...rows, ...padRows];
    }
  } else {
    rows = getRandomQuestions.all(count) as any[];
  }
  return rows.map(rowToQuestion);
}

// ─── Game Sessions ────────────────────────────────────────────────────────────

const insertSession = db.prepare(
  "INSERT INTO game_sessions (id, room_id, experience, round, created_at) VALUES (?, ?, ?, ?, ?)"
);

const upsertScore = db.prepare(`
  INSERT INTO scores (guest_id, session_id, display_name, score, correct, wrong)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT (guest_id, session_id) DO UPDATE SET
    display_name = excluded.display_name,
    score = excluded.score,
    correct = excluded.correct,
    wrong = excluded.wrong
`);

export function createSession(id: string, roomId: string, experience: string): void {
  insertSession.run(id, roomId, experience, 1, Date.now());
}

export function persistScores(sessionId: string, scores: Array<{ guestId: string; displayName: string; score: number; correct: number; wrong: number }>): void {
  for (const s of scores) {
    upsertScore.run(s.guestId, sessionId, s.displayName, s.score, s.correct, s.wrong);
  }
}

export function getLeaderboard(limit = 20): Array<{ guestId: string; displayName: string; totalScore: number; gamesPlayed: number; bestScore: number; totalCorrect: number }> {
  const rows = db.prepare(`
    SELECT
      guest_id,
      display_name,
      COUNT(*) AS games_played,
      SUM(score) AS total_score,
      MAX(score) AS best_score,
      SUM(correct) AS total_correct
    FROM scores
    GROUP BY guest_id
    ORDER BY total_score DESC
    LIMIT ?
  `).all(limit) as any[];
  return rows.map(r => ({
    guestId: r.guest_id,
    displayName: r.display_name,
    totalScore: r.total_score,
    gamesPlayed: r.games_played,
    bestScore: r.best_score,
    totalCorrect: r.total_correct,
  }));
}

// ─── WYR Prompts ─────────────────────────────────────────────────────────────

const insertWYRPrompt = db.prepare("INSERT INTO wyr_prompts (option_a, option_b, category) VALUES (?, ?, ?)");
const countWYRPrompts = db.prepare("SELECT COUNT(*) as n FROM wyr_prompts");

export function seedWYRPrompt(optionA: string, optionB: string, category: string): void {
  insertWYRPrompt.run(optionA, optionB, category);
}

export function wyrPromptCount(): number {
  return (countWYRPrompts.get() as any).n as number;
}

export function drawWYRPrompts(count: number): WYRPrompt[] {
  const rows = db.prepare("SELECT * FROM wyr_prompts ORDER BY RANDOM() LIMIT ?").all(count) as any[];
  return rows.map(r => ({ id: r.id, optionA: r.option_a, optionB: r.option_b, category: r.category }));
}

// ─── Custom Trivia Questions ──────────────────────────────────────────────────

export function addCustomQuestion(q: Omit<TriviaQuestion, "id">): void {
  insertQuestion.run(q.category, q.question, q.a, q.b, q.c, q.d, q.correct, q.difficulty);
}

export function triviaQuestionCountByCategory(): Record<string, number> {
  const rows = db.prepare("SELECT category, COUNT(*) as n FROM trivia_questions GROUP BY category").all() as any[];
  return Object.fromEntries(rows.map(r => [r.category, r.n]));
}
