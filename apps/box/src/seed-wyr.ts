// Run with: npm run seed:wyr  (uses tsx — do NOT run with compiled node, __dirname won't resolve)
import { readFileSync } from "fs";
import path from "path";
import * as db from "./db";

const existing = db.wyrPromptCount();
if (existing > 0) {
  console.log(`[seed-wyr] Already have ${existing} prompts — skipping. Delete partyglue.db to re-seed.`);
  process.exit(0);
}

const fullPath = path.join(__dirname, "seed", "wyr-prompts.json");
const { prompts }: { prompts: [string, string, string][] } = JSON.parse(readFileSync(fullPath, "utf8"));

const byCategory: Record<string, number> = {};
for (const [optionA, optionB, category] of prompts) {
  db.seedWYRPrompt(optionA, optionB, category);
  byCategory[category] = (byCategory[category] ?? 0) + 1;
}

for (const [cat, n] of Object.entries(byCategory)) {
  console.log(`[seed-wyr] ${cat}: ${n} prompts`);
}
console.log(`[seed-wyr] Done — ${prompts.length} prompts total`);
