#!/usr/bin/env node
// buzzer-soak.mjs — Buzzer Round end-to-end soak.
// Plays N games, asserts buzz + answer + reveal flow.
//
// Run: node apps/box/test/buzzer-soak.mjs --games 10 --port 8090

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
const URL = `ws://localhost:${PORT}`;
const QUESTIONS_PER_GAME = 10;
const VALID_ANSWERS = new Set(["a", "b", "c", "d"]);

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
    fail(g, q, "question text missing/empty", qq);
  for (const k of ["a", "b", "c", "d"]) {
    if (typeof qq[k] !== "string" || qq[k].trim().length === 0)
      fail(g, q, `option ${k} missing/empty`, qq);
  }
  const opts = ["a", "b", "c", "d"].map(k => String(qq[k]).toLowerCase().trim());
  if (new Set(opts).size < 4) fail(g, q, `duplicate options: ${opts.join(" | ")}`, qq);
  if (!VALID_ANSWERS.has(qq.correct)) fail(g, q, `correct must be a|b|c|d, got ${JSON.stringify(qq.correct)}`, qq);
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
    let buzzed = false;
    let answered = false;
    let revealed = false;
    let lastScore = 0;

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
        displayName: `Buzz${gameNum}`,
        mode: "phones_only",
        experience: "buzzer",
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
            buzzed = false;
            answered = false;
            revealed = false;
          }
          // Buzz once per question; defensive guard so a relock-broadcast doesn't double-fire
          const lockedOut = Array.isArray(s.lockedOut) ? s.lockedOut : [];
          if (!buzzed && !lockedOut.includes(guestId)) {
            buzzed = true;
            setTimeout(() => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: "game:action", guestId, roomId, action: "buzz:buzz",
                }));
              }
            }, 150);
          }
        }

        if (phase === "buzzed" && s.buzzedBy === guestId && !answered) {
          answered = true;
          const pick = ["a", "b", "c", "d"][Math.floor(Math.random() * 4)];
          setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: "game:action", guestId, roomId,
                action: "buzz:answer", payload: { answer: pick },
              }));
            }
          }, 150);
        }

        if (phase === "reveal" && !revealed) {
          revealed = true;
          if (!VALID_ANSWERS.has(s.correctAnswer))
            fail(gameNum, qNum, `reveal correctAnswer invalid '${s.correctAnswer}'`);
          const me = s.scores?.find(x => x.guestId === guestId);
          const myScore = me?.score ?? 0;
          // Buzzer never goes below 0 (Math.max(0, score - 200) per buzzer.ts)
          if (myScore < 0) fail(gameNum, qNum, `score below zero: ${myScore}`);
          const delta = myScore - lastScore;
          // Possible deltas: +1000 (correct), 0 (wrong, was already 0), -200 to 0 (wrong but clamped)
          if (delta !== 1000 && delta !== 0 && (delta < -200 || delta > 0))
            fail(gameNum, qNum, `unexpected score delta ${delta} (expected +1000 or 0..-200)`);
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
          log(`game_over (${seenIds.size} questions seen, score ${lastScore})`);
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
  console.log(`\n=== Buzzer Soak — ${GAMES} games via ${URL} ===\n`);
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
    console.log("\nVERDICT: ✓ Clean — Buzzer state machine + question bank passes\n");
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
