#!/usr/bin/env node
// run-all.mjs — Soak harness orchestrator.
// Runs all 9 game-soak scripts back to back for N rounds, against a target server.
// Exits non-zero if any round fails its assertion suite.
//
// Run: node apps/box/test/run-all.mjs --rounds 3 --host 192.168.1.8 --port 8080
//      node apps/box/test/run-all.mjs --rounds 12 --host 192.168.1.8 --port 8080  (~2 hr)
//      node apps/box/test/run-all.mjs --rounds 1 --port 8090  (local dev fast smoke)

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

const ROUNDS = parseInt(args.rounds ?? "3", 10);
const HOST = args.host ?? "localhost";
const PORT = parseInt(args.port ?? "8090", 10);
const GAMES_PER_ROUND = parseInt(args["games-per-round"] ?? "1", 10);
const ABORT_ON_FAIL = args["continue"] !== true;

// Order: cheapest first so a regression aborts fast.
// Trivia tests the question bank + watchdog; the rest exercise unique state machines.
const SCRIPTS = [
  "trivia-soak.mjs",
  "wyr-soak.mjs",
  "guesstimate-soak.mjs",
  "rankit-soak.mjs",
  "buzzer-soak.mjs",
  "connections-soak.mjs",
  "geoguesser-soak.mjs",
  "thedraft-soak.mjs",
  "draw-soak.mjs",
];

function runScript(scriptName, roundNum) {
  return new Promise((resolve) => {
    const scriptPath = join(__dirname, scriptName);
    // Use process.execPath (absolute Node binary path) instead of bare "node".
    // Fixes "spawn EPERM" on some Windows hosts where bare "node" can't be
    // resolved from PATH or AntiVirus blocks the lookup. windowsHide: true
    // suppresses the brief console flash on Windows.
    const child = spawn(process.execPath, [
      scriptPath,
      "--games", String(GAMES_PER_ROUND),
      "--host", HOST,
      "--port", String(PORT),
    ], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });

    let out = "";
    let err = "";
    let spawnError = null;
    child.on("error", (e) => { spawnError = e; });
    child.stdout.on("data", (b) => { out += b.toString(); });
    child.stderr.on("data", (b) => { err += b.toString(); });
    child.on("close", (code) => {
      // Extract last "VERDICT" line for terse summary
      const verdictMatch = out.match(/VERDICT: ([^\n]+)/);
      const verdict = spawnError
        ? `(spawn error: ${spawnError.code ?? spawnError.message})`
        : (verdictMatch ? verdictMatch[1] : (code === 0 ? "(no verdict — exit 0)" : `(no verdict — exit ${code})`));
      resolve({ scriptName, code, out, err, verdict });
    });
  });
}

function fmtElapsed(ms) {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}m${s % 60}s`;
}

async function main() {
  const startedAt = Date.now();
  console.log(`\n┌─────────────────────────────────────────────────────────────────`);
  console.log(`│ Soak orchestrator`);
  console.log(`│  target:        ws://${HOST}:${PORT}`);
  console.log(`│  rounds:        ${ROUNDS}`);
  console.log(`│  games/round:   ${GAMES_PER_ROUND}`);
  console.log(`│  scripts:       ${SCRIPTS.length} (${ROUNDS * SCRIPTS.length * GAMES_PER_ROUND} total game cycles)`);
  console.log(`│  abort on fail: ${ABORT_ON_FAIL}`);
  console.log(`└─────────────────────────────────────────────────────────────────\n`);

  const results = [];
  let aborted = false;

  for (let round = 1; round <= ROUNDS && !aborted; round++) {
    console.log(`\n━━━ Round ${round}/${ROUNDS} ━━━`);
    for (const script of SCRIPTS) {
      const t0 = Date.now();
      const r = await runScript(script, round);
      const elapsed = Date.now() - t0;
      const tag = r.code === 0 ? "✓" : "✗";
      console.log(`  ${tag} R${round} ${script.padEnd(22)} ${fmtElapsed(elapsed).padStart(8)}  ${r.verdict}`);
      results.push({ round, script, code: r.code, elapsedMs: elapsed, verdict: r.verdict });

      if (r.code !== 0) {
        // Print the failed run's tail so the failure is immediately visible
        const tail = r.out.split("\n").slice(-30).join("\n");
        console.log(`    --- last 30 lines of ${script} round ${round} ---`);
        console.log(tail.split("\n").map(l => "    " + l).join("\n"));
        if (r.err) console.log(`    --- stderr ---\n${r.err.split("\n").map(l => "    " + l).join("\n")}`);
        if (ABORT_ON_FAIL) {
          console.log(`\n⚠ Aborting on first failure (pass --continue to override).`);
          aborted = true;
          break;
        }
      }
    }
  }

  const totalElapsed = Date.now() - startedAt;
  const failed = results.filter(r => r.code !== 0);
  console.log(`\n┌─────────────────────────────────────────────────────────────────`);
  console.log(`│ Summary`);
  console.log(`│  ran:      ${results.length} game scripts`);
  console.log(`│  passed:   ${results.length - failed.length}`);
  console.log(`│  failed:   ${failed.length}`);
  console.log(`│  elapsed:  ${fmtElapsed(totalElapsed)}`);
  if (aborted) console.log(`│  aborted:  yes (early exit on failure)`);
  console.log(`└─────────────────────────────────────────────────────────────────`);

  if (failed.length > 0) {
    console.log(`\nFailed runs:`);
    for (const f of failed) {
      console.log(`  ✗ R${f.round} ${f.script}  ${f.verdict}`);
    }
    process.exit(1);
  }
  console.log(`\nVERDICT: ✓ Clean — ${results.length} game cycles passed.\n`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(2); });
