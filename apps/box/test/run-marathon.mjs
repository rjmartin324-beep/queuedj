#!/usr/bin/env node
// run-marathon.mjs — multi-hour soak across all 10 game soaks + the 2 stress
// scripts. Loops the suite N rounds (or until elapsedMs > durationMs), records
// pass/fail per script per round, samples server memory between rounds, and
// writes a final report.
//
// Usage:
//   node apps/box/test/run-marathon.mjs --host localhost --port 8080 --duration 7200000
//
// duration is in ms (default 7,200,000 = 2 hours). Set --rounds N to cap
// rounds instead of duration.

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith("--")) {
      const key = cur.slice(2);
      const next = arr[i + 1];
      acc.push([key, next && !next.startsWith("--") ? next : true]);
    }
    return acc;
  }, []),
);
const HOST = args.host ?? "localhost";
const PORT = parseInt(args.port ?? "8080", 10);
const DURATION_MS = parseInt(args.duration ?? "7200000", 10);
const MAX_ROUNDS = args.rounds ? parseInt(args.rounds, 10) : Infinity;
const REPORT = args.report ?? "tmp-soak/marathon-report.md";

const TEST_DIR = path.dirname(new URL(import.meta.url).pathname.replace(/^\//, ""));
const SCRIPTS = [
  // Stress scripts — quick 1-shot.
  { name: "qr-race-stress",     args: [] },
  { name: "io-race-stress",     args: [] },
  // Soaks — short configurations to keep each round under ~2 min.
  { name: "trivia-soak",        args: ["--games", "1"] },
  { name: "wyr-soak",           args: ["--games", "1"] },
  { name: "guesstimate-soak",   args: ["--games", "1"] },
  { name: "buzzer-soak",        args: ["--games", "1"] },
  { name: "rankit-soak",        args: ["--games", "1"] },
  { name: "connections-soak",   args: ["--games", "1"] },
  { name: "geoguesser-soak",    args: ["--games", "1"] },
  { name: "thedraft-soak",      args: ["--games", "1"] },
  { name: "draw-soak",          args: ["--games", "1"] },
  { name: "whalabroad-soak",    args: [] },
];

function runOnce(name, extraArgs) {
  return new Promise(resolve => {
    const scriptPath = path.join(TEST_DIR, `${name}.mjs`);
    const t0 = Date.now();
    const child = spawn("node", [scriptPath, "--host", HOST, "--port", String(PORT), ...extraArgs], { stdio: "pipe" });
    let stdout = "", stderr = "";
    child.stdout.on("data", d => stdout += d.toString());
    child.stderr.on("data", d => stderr += d.toString());
    child.on("close", code => {
      const ms = Date.now() - t0;
      resolve({ name, code, ms, stdout: stdout.slice(-400), stderr: stderr.slice(-200) });
    });
  });
}

async function fetchHealth() {
  try {
    const r = await fetch(`http://${HOST}:${PORT}/health`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return { ok: false, status: r.status };
    return await r.json();
  } catch (e) {
    return { ok: false, error: String(e.message ?? e) };
  }
}

const startedAt = Date.now();
const rounds = [];
let roundIdx = 0;
let totalFailures = 0;

console.log(`Marathon soak — host=${HOST}:${PORT}, duration=${(DURATION_MS / 60000).toFixed(0)}min, max rounds=${MAX_ROUNDS}`);
console.log(`Scripts in rotation: ${SCRIPTS.length}`);

while (Date.now() - startedAt < DURATION_MS && roundIdx < MAX_ROUNDS) {
  roundIdx++;
  const roundT0 = Date.now();
  console.log(`\n┌─ Round ${roundIdx} ────────────────────────────────`);

  const health0 = await fetchHealth();
  if (!health0.ok) {
    console.log(`│ /health failed: ${JSON.stringify(health0)} — abort round`);
    rounds.push({ roundIdx, abort: true, reason: "health-down", health0 });
    totalFailures++;
    if (totalFailures >= 5) { console.log("│ 5+ failures, bailing"); break; }
    await new Promise(r => setTimeout(r, 30_000));
    continue;
  }

  const results = [];
  for (const s of SCRIPTS) {
    const res = await runOnce(s.name, s.args);
    const status = res.code === 0 ? "✓" : "✗";
    console.log(`│ ${status} ${s.name.padEnd(22)} (${(res.ms / 1000).toFixed(1)}s, exit=${res.code})`);
    if (res.code !== 0) {
      totalFailures++;
      console.log(`│     stdout-tail: ${res.stdout.replace(/\n/g, " | ")}`);
    }
    results.push({ name: s.name, ok: res.code === 0, ms: res.ms, code: res.code });
  }

  const health1 = await fetchHealth();
  rounds.push({
    roundIdx,
    elapsedMs: Date.now() - roundT0,
    results,
    healthOk: health1.ok,
    failures: results.filter(r => !r.ok).length,
  });
  console.log(`└─ Round ${roundIdx} done (${(rounds.at(-1).elapsedMs / 1000).toFixed(1)}s, ${rounds.at(-1).failures} failures)`);
}

// Final report
const totalElapsed = Date.now() - startedAt;
const totalRuns = rounds.reduce((acc, r) => acc + (r.results?.length ?? 0), 0);
const totalOk = rounds.reduce((acc, r) => acc + (r.results?.filter(x => x.ok).length ?? 0), 0);

const reportLines = [
  `# Marathon soak report`,
  `Started: ${new Date(startedAt).toISOString()}`,
  `Ended:   ${new Date().toISOString()}`,
  `Duration: ${(totalElapsed / 60000).toFixed(1)} min`,
  `Rounds:   ${rounds.length}`,
  `Total runs: ${totalRuns}    Pass: ${totalOk}    Fail: ${totalRuns - totalOk}`,
  ``,
  `## Per-round summary`,
  `| Round | Elapsed | Failures | Health |`,
  `|---:|---:|---:|---|`,
  ...rounds.map(r => `| ${r.roundIdx} | ${(r.elapsedMs/1000).toFixed(0)}s | ${r.failures ?? "?"} | ${r.healthOk ? "ok" : "DOWN"} |`),
  ``,
  `## Failure tail`,
  ...rounds.flatMap(r => (r.results ?? []).filter(x => !x.ok).map(x => `- Round ${r.roundIdx} ${x.name} exit=${x.code}`)),
];

fs.mkdirSync(path.dirname(REPORT), { recursive: true });
fs.writeFileSync(REPORT, reportLines.join("\n") + "\n");

console.log(``);
console.log(`┌──────────────────────────────────────────────`);
console.log(`│ Marathon done`);
console.log(`│ Rounds: ${rounds.length}`);
console.log(`│ Total runs: ${totalRuns}, pass ${totalOk}, fail ${totalRuns - totalOk}`);
console.log(`│ Report: ${REPORT}`);
console.log(`└──────────────────────────────────────────────`);
process.exit(totalOk === totalRuns ? 0 : 1);
