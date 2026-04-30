#!/usr/bin/env node
// One-shot patch script for Buzz audit 2026-04-30 trivia corrections.
// Reads src/seed/questions-full.json, applies fixes by [category, index],
// writes back. Idempotent: re-running reapplies the same set.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(__dirname, "..", "src", "seed", "questions-full.json");

const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
const cat = (name) => data.find((c) => c.category === name);

// Each fix replaces the full row at [category][index] with a new tuple:
// [question, A, B, C, D, correct, difficulty]
const fixes = [
  // ── General Knowledge ─────────────────────────────────────────────────
  { c: "General Knowledge", i: 42, row: [
    "Which European explorer reached the Caribbean in 1492?",
    "Ferdinand Magellan", "Amerigo Vespucci", "Christopher Columbus", "John Cabot",
    "c", "easy",
  ]},
  { c: "General Knowledge", i: 154, row: [
    "Which dynasty built most of the surviving Great Wall of China?",
    "Tang", "Ming", "Han", "Qin",
    "b", "medium",
  ]},
  { c: "General Knowledge", i: 168, row: [
    "Which region did the Vikings originate from?",
    "Scandinavia", "The Baltics", "Central Europe", "The British Isles",
    "a", "medium",
  ]},
  { c: "General Knowledge", i: 196, row: [
    "In which country was basketball invented?",
    "USA", "UK", "Canada", "Australia",
    "a", "medium",
  ]},
  { c: "General Knowledge", i: 294, row: [
    "In which region did the Black Death originate?",
    "India", "Egypt", "Central Asia", "Italy",
    "c", "hard",
  ]},

  // ── Science & Nature ──────────────────────────────────────────────────
  { c: "Science & Nature", i: 24, row: [
    "Which planet is famous for its prominent ring system?",
    "Jupiter", "Mars", "Saturn", "Neptune",
    "c", "easy",
  ]},
  { c: "Science & Nature", i: 36, row: [
    "In a galvanic (battery) cell, which electrode is the positive terminal?",
    "Cathode", "Anode", "Ion", "Electrode",
    "a", "easy",
  ]},
  { c: "Science & Nature", i: 60, row: [
    "Which planet comes closest to Earth at its nearest approach?",
    "Mars", "Jupiter", "Venus", "Mercury",
    "c", "easy",
  ]},

  // ── History ───────────────────────────────────────────────────────────
  { c: "History", i: 3, row: [
    "Which European explorer reached the Caribbean in 1492?",
    "Ferdinand Magellan", "Amerigo Vespucci", "Christopher Columbus", "John Cabot",
    "c", "easy",
  ]},
  { c: "History", i: 27, row: [
    "What was a stated goal of the First Crusade?",
    "Trade disputes", "Recapture of the Holy Land", "Spread of Islam", "Ottoman expansion",
    "b", "easy",
  ]},
  { c: "History", i: 63, row: [
    "Which country abolished its slave trade in 1807?",
    "USA", "France", "Britain", "Spain",
    "c", "easy",
  ]},
  { c: "History", i: 96, row: [
    "Who launched the German Reformation with the Ninety-five Theses?",
    "Thomas Cromwell", "John Calvin", "Martin Luther", "Henry VIII",
    "c", "easy",
  ]},
  { c: "History", i: 123, row: [
    "Which African country largely retained independence during the Scramble for Africa?",
    "Kenya", "Ghana", "Ethiopia", "Nigeria",
    "c", "medium",
  ]},
  { c: "History", i: 150, row: [
    "Who became independent India's first prime minister?",
    "Mahatma Gandhi", "Jawaharlal Nehru", "Sardar Patel", "Subhas Chandra Bose",
    "b", "medium",
  ]},
  { c: "History", i: 168, row: [
    "Which two empires dominated the Americas before European contact?",
    "Maya", "Aztec and Inca", "Olmec", "Toltec",
    "b", "medium",
  ]},
  { c: "History", i: 186, row: [
    "Who is credited with the first recorded European landing in Australia (1606)?",
    "James Cook", "Abel Tasman", "William Dampier", "Willem Janszoon",
    "d", "medium",
  ]},
  { c: "History", i: 234, row: [
    "Which fighters did the USA support against the Soviet-backed government in Afghanistan in the 1980s?",
    "Pakistan Army", "Mujahideen fighters", "Iranian Republican Guard", "Saudi National Guard",
    "b", "medium",
  ]},

  // ── Geography ─────────────────────────────────────────────────────────
  { c: "Geography", i: 30, row: [
    "Which city does Israel designate as its capital?",
    "Tel Aviv", "Haifa", "Jerusalem", "Eilat",
    "c", "easy",
  ]},
  { c: "Geography", i: 111, row: [
    "What is the driest non-polar desert in the world?",
    "Gobi", "Arabian", "Atacama", "Sahara",
    "c", "medium",
  ]},
  { c: "Geography", i: 117, row: [
    "Which two countries are tied for the most land borders with other countries?",
    "Brazil and Argentina", "Russia and China", "China and India", "Germany and France",
    "b", "medium",
  ]},
  { c: "Geography", i: 171, row: [
    "Which is the largest city proper in Africa by population?",
    "Kinshasa", "Johannesburg", "Cairo", "Lagos",
    "d", "medium",
  ]},
  { c: "Geography", i: 186, row: [
    "Which region spans multiple Sub-Saharan African countries between the Sahara and the savanna?",
    "Maghreb", "Horn of Africa", "Great Rift Valley", "Sahel",
    "d", "medium",
  ]},
  { c: "Geography", i: 258, row: [
    "Which countries does the Kavango (Okavango) River basin span?",
    "Only Angola and Namibia", "Only Botswana and Zambia", "Only Namibia and Zimbabwe", "Angola, Namibia, Botswana, Zimbabwe, and Zambia",
    "d", "hard",
  ]},
  { c: "Geography", i: 288, row: [
    "Which two countries share Tierra del Fuego?",
    "Argentina and Brazil", "Chile and Peru", "Argentina and Chile", "Argentina, Chile, and Bolivia",
    "c", "hard",
  ]},
  { c: "Geography", i: 294, row: [
    "Which two rivers meet at Khartoum, Sudan?",
    "Blue Nile and White Nile", "Niger and Benue", "Congo and Ubangi", "Atbara and Sobat",
    "a", "hard",
  ]},
  { c: "Geography", i: 336, row: [
    "From which country does the White Nile flow out of Lake Victoria?",
    "Ethiopia", "Tanzania", "Uganda", "Rwanda",
    "c", "hard",
  ]},
];

let applied = 0;
for (const f of fixes) {
  const c = cat(f.c);
  if (!c) { console.error(`category not found: ${f.c}`); continue; }
  if (!c.questions[f.i]) { console.error(`index missing: ${f.c}#${f.i}`); continue; }
  c.questions[f.i] = f.row;
  applied++;
}

fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n");
console.log(`patched ${applied}/${fixes.length} trivia rows`);
