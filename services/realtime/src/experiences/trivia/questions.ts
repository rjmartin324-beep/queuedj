import type { TriviaQuestion } from "@queuedj/shared-types";
import { db } from "../../db";

// ─────────────────────────────────────────────────────────────────────────────
// Question bank — loaded from PostgreSQL (trivia_questions table).
//
// Seed with:
//   cd services/realtime
//   DATABASE_URL=<url> npx tsx src/scripts/seedGameContent.ts
// ─────────────────────────────────────────────────────────────────────────────

interface DBRow {
  id:                 string;
  text:               string;
  options:            { id: string; text: string }[];
  correct_option_id:  string;
  time_limit_seconds: number;
  category:           string | null;
  difficulty:         string | null;
}

let _cache: TriviaQuestion[] | null = null;

export async function getQuestions(): Promise<TriviaQuestion[]> {
  if (_cache) return _cache;

  try {
    const result = await db.query<DBRow>(
      `SELECT id, text, options, correct_option_id, time_limit_seconds, category, difficulty
       FROM trivia_questions
       ORDER BY id`,
    );

    if (result.rows.length === 0) {
      console.warn("[trivia] trivia_questions table is empty — run seedGameContent.ts");
      return [];
    }

    _cache = result.rows.map((r) => ({
      id:               r.id,
      text:             r.text,
      options:          r.options,
      correctOptionId:  r.correct_option_id,
      timeLimitSeconds: r.time_limit_seconds,
      category:         r.category ?? undefined,
      difficulty:       (r.difficulty as TriviaQuestion["difficulty"]) ?? undefined,
    }));

    console.log(`[trivia] loaded ${_cache.length} questions from DB`);
    return _cache;
  } catch (err: any) {
    console.error("[trivia] failed to load questions from DB:", err.message);
    return [];
  }
}
