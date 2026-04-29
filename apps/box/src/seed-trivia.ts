// Run with: npm run seed  (uses tsx — do NOT run with compiled node, __dirname won't resolve)
import { readFileSync } from "fs";
import path from "path";
import * as db from "./db";

const existing = db.triviaQuestionCount();
if (existing > 0) {
  console.log(`[seed] Already have ${existing} questions — skipping. Delete partyglue.db to re-seed.`);
  process.exit(0);
}

type RawQ = [string, string, string, string, string, string, string];
const fullPath = path.join(__dirname, "seed", "questions-full.json");
const data: Array<{ category: string; questions: RawQ[] }> = JSON.parse(readFileSync(fullPath, "utf8"));

let total = 0;
for (const { category, questions } of data) {
  for (const [question, a, b, c, d, correct, difficulty] of questions) {
    db.seedQuestion({ category: category as any, question, a, b, c, d, correct: correct as any, difficulty: difficulty as any });
    total++;
  }
  console.log(`[seed] ${category}: ${questions.length} questions`);
}

console.log(`[seed] Done — ${total} questions across ${data.length} categories`);
