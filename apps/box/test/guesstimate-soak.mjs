#!/usr/bin/env node
// guesstimate-soak.mjs — Guesstimate end-to-end soak.
// Plays N games, asserts question shape + score curve (1000 = exact, 0 = ≥100% off).
//
// Run: node apps/box/test/guesstimate-soak.mjs --games 10 --port 8090

import WebSocket from "ws";

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
const GAMES = parseInt(args.games ?? "10", 10);
const PORT = parseInt(args.port ?? "8090", 10);
const HOST = args.host ?? "localhost";
const URL = `ws://${HOST}:${PORT}`;
const QUESTIONS_PER_GAME = 10;

const failures = [];
function fail(g, q, msg, ctx) { failures.push({ g, q, msg, ctx }); console.log(`  ✗ G${g} Q${q}: ${msg}`); }
function nanoid(n = 10) {
  return Array.from({ length: n }, () =>
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]
  ).join("");
}

function assertQuestion(g, q, qq, seenIds) {
  if (!qq) return fail(g, q, "no question object");
  if (typeof qq.id !== "number") fail(g, q, "question.id missing");
  if (seenIds.has(qq.id)) fail(g, q, `duplicate question id ${qq.id} within same game`);
  seenIds.add(qq.id);
  if (typeof qq.question !== "string" || qq.question.length === 0)
    fail(g, q, "question text empty", qq);
  if (typeof qq.answer !== "number" || !Number.isFinite(qq.answer))
    fail(g, q, `answer not a finite number: ${qq.answer}`, qq);
  // Empty unit is intentional for year questions ("What year did X happen?" — answer IS a year).
  // Just enforce that the field exists and is a string.
  if (typeof qq.unit !== "string") fail(g, q, `unit not a string: ${typeof qq.unit}`, qq);
}

// Mirror of guesstimate.ts:scoreGuess for cross-check
function expectedScore(guess, answer) {
  if (answer === 0) return guess === 0 ? 1000 : 0;
  const pct = Math.abs(guess - answer) / Math.abs(answer);
  return Math.max(0, Math.round(1000 * (1 - Math.min(pct, 1))));
}

function playOne(gameNum) {
  return new Promise((resolve) => {
    const guestId = nanoid();
    const ws = new WebSocket(URL);
    const seenIds = new Set();
    let roomId = null;
    let qNum = 0;
    let lastPhase = null;
    let lastIndex = -1;
    let stuckTimer = null;
    let submitted = false;
    let revealed = false;
    let lastScore = 0;
    let myGuess = null;
    let knownAnswer = null;

    const log = (m) => console.log(`  [G${gameNum}] ${m}`);
    function clearStuck() { if (stuckTimer) clearTimeout(stuckTimer); }
    function resetStuck() {
      clearStuck();
      stuckTimer = setTimeout(() => {
        fail(gameNum, qNum, `phase '${lastPhase}' stalled > 30s`);
        ws.close();
      }, 30000);
    }

    ws.on("open", () => {
      ws.send(JSON.stringify({
        type: "room:create",
        guestId,
        displayName: `Guess${gameNum}`,
        mode: "phones_only",
        experience: "guesstimate",
        tournament: false,
      }));
    });

    ws.on("message", (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); }
      catch (e) { fail(gameNum, qNum, "non-JSON message"); return; }

      if (msg.type === "room:created") {
        roomId = msg.room.id;
        ws.send(JSON.stringify({ type: "host:start", guestId, roomId }));
        return;
      }
      if (msg.type === "room:error") {
        fail(gameNum, qNum, `room:error ${msg.code}: ${msg.message}`);
        ws.close();
        return;
      }

      if (msg.type === "game:state") {
        const s = msg.state;
        const phase = s.phase;
        if (phase !== lastPhase) {
          log(`phase ${lastPhase ?? "(start)"} → ${phase}` + (s.question ? ` (Q#${s.questionIndex + 1})` : ""));
          lastPhase = phase;
          resetStuck();
        }

        if (phase === "question" && s.question) {
          const newQ = s.questionIndex !== lastIndex;
          if (newQ) {
            qNum = s.questionIndex + 1;
            assertQuestion(gameNum, qNum, s.question, seenIds);
            lastIndex = s.questionIndex;
            // The server SHOULDN'T send the answer at question phase — but the current
            // code sends the full GQuestion (incl. answer). Capture it for cross-check.
            knownAnswer = s.question.answer;
            submitted = false;
            revealed = false;
          }
          if (!submitted) {
            submitted = true;
            // Half perfect, half random — exercises both ends of the score curve
            const usePerfect = Math.random() < 0.5;
            myGuess = usePerfect
              ? knownAnswer
              : Math.round(knownAnswer * (Math.random() * 4));   // up to 4x off (gets clamped to 0)
            setTimeout(() => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: "game:action", guestId, roomId,
                  action: "guess:submit", payload: { guess: myGuess },
                }));
              }
            }, 150);
          }
        }

        if (phase === "reveal" && !revealed) {
          revealed = true;
          const me = s.scores?.find(x => x.guestId === guestId);
          const myScore = me?.score ?? 0;
          if (myScore < lastScore) fail(gameNum, qNum, `score went DOWN: ${lastScore} → ${myScore}`);
          const delta = myScore - lastScore;
          const expected = expectedScore(myGuess, knownAnswer);
          if (delta !== expected)
            fail(gameNum, qNum, `score delta ${delta} !== expected ${expected} (guess=${myGuess}, answer=${knownAnswer})`);
          if (delta < 0 || delta > 1000)
            fail(gameNum, qNum, `delta ${delta} out of range 0..1000`);
          lastScore = myScore;
          setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "host:next_question", guestId, roomId }));
            }
          }, 600);
        }

        if (phase === "game_over") {
          clearStuck();
          if (seenIds.size !== QUESTIONS_PER_GAME)
            fail(gameNum, qNum, `expected ${QUESTIONS_PER_GAME} questions, saw ${seenIds.size}`);
          log(`game_over (${seenIds.size} questions, score ${lastScore})`);
          ws.close();
        }
      }
    });

    ws.on("close", () => { clearStuck(); resolve({ seen: seenIds.size }); });
    ws.on("error", (e) => {
      fail(gameNum, qNum, `WS error: ${e.message}`);
      clearStuck();
      resolve({ seen: seenIds.size });
    });
  });
}

async function main() {
  console.log(`\n=== Guesstimate Soak — ${GAMES} games via ${URL} ===\n`);
  const t0 = Date.now();
  let total = 0;
  for (let i = 1; i <= GAMES; i++) {
    const r = await playOne(i);
    total += r.seen;
  }
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log("\n=== SUMMARY ===");
  console.log(`Games:     ${GAMES}`);
  console.log(`Questions: ${total}`);
  console.log(`Failures:  ${failures.length}`);
  console.log(`Elapsed:   ${elapsed}s`);
  if (failures.length === 0) {
    console.log("\nVERDICT: ✓ Clean — Guesstimate state machine + question bank passes\n");
    process.exit(0);
  }
  console.log("\nVERDICT: ✗ Bugs found:\n");
  for (const f of failures) {
    console.log(`  G${f.g} Q${f.q}: ${f.msg}`);
    if (f.ctx) console.log(`    context: ${JSON.stringify(f.ctx).slice(0, 200)}`);
  }
  process.exit(1);
}
main().catch(e => { console.error(e); process.exit(2); });
