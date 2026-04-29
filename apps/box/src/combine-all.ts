/**
 * Combines all 7 category question JSON files into a single seeder-ready JSON.
 * Run: npx tsx src/combine-all.ts
 * Output: src/seed/questions-full.json
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";

type RawQ = [string, string, string, string, string, string, string];

const SEED_DIR = path.join(__dirname, "seed");
const ROOT_DIR = path.join(__dirname, "..");

function readJson(filePath: string): RawQ[] {
  if (!existsSync(filePath)) {
    console.error(`  MISSING: ${filePath}`);
    return [];
  }
  const raw = JSON.parse(readFileSync(filePath, "utf8")) as RawQ[];
  return raw;
}

const categories: Array<{ category: string; file: string }> = [
  { category: "General Knowledge", file: path.join(SEED_DIR, "general-knowledge-425.json") },
  { category: "Science & Nature",  file: path.join(ROOT_DIR, "science_nature_trivia.json") },
  { category: "History",           file: path.join(SEED_DIR, "history-425.json") },
  { category: "Pop Culture",       file: path.join(SEED_DIR, "pop-culture-425.json") },
  { category: "Sports",            file: path.join(SEED_DIR, "sports-425.json") },
  { category: "Geography",         file: path.join(SEED_DIR, "geography-questions.json") },
  { category: "Movies & TV",       file: path.join(ROOT_DIR, "movies_tv_trivia.json") },
];

let totalQuestions = 0;
const combined: Array<{ category: string; questions: RawQ[] }> = [];

for (const { category, file } of categories) {
  const questions = readJson(file);
  const easy    = questions.filter(q => q[6] === "easy").length;
  const medium  = questions.filter(q => q[6] === "medium").length;
  const hard    = questions.filter(q => q[6] === "hard").length;
  const extreme = questions.filter(q => q[6] === "extreme").length;
  console.log(`  ${category}: ${questions.length} total (${easy}E / ${medium}M / ${hard}H / ${extreme}X)`);
  totalQuestions += questions.length;
  combined.push({ category, questions });
}

const outputPath = path.join(SEED_DIR, "questions-full.json");
writeFileSync(outputPath, JSON.stringify(combined, null, 2));
console.log(`\nCombined: ${totalQuestions} questions across ${combined.length} categories`);
console.log(`Written to: ${outputPath}`);
