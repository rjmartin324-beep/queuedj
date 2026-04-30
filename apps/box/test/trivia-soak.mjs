#!/usr/bin/env node
// trivia-soak.mjs — End-to-end Trivia game simulator.
// Plays N back-to-back games, asserts every state transition, reports bugs.
//
// Run: node apps/box/test/trivia-soak.mjs --games 10 --port 8090

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

const failures = [];
const VALID_CATEGORIES = new Set([
  "General Knowledge", "Science & Nature", "History", "Pop Culture",
  "Sports", "Geography", "Movies & TV", "Custom",
]);
const VALID_DIFFICULTIES = new Set(["easy", "medium", "hard", "extreme"]);

function fail(gameNum, qNum, msg, ctx) {
  failures.push({ gameNum, qNum, msg, ctx });
  console.log(`  ✗ G${gameNum} Q${qNum}: ${msg}`);
}

function nanoid(n = 10) {
  return Array.from({ length: n }, () =>
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)],
  ).join("");
}

function assertQuestion(gameNum, qNum, q, seenIds) {
  if (!q) return fail(gameNum, qNum, "no question object");
  if (typeof q.id !== "number") fail(gameNum, qNum, "question.id missing");
  if (seenIds.has(q.id)) fail(gameNum, qNum, `duplicate question id ${q.id} within same game`);
  seenIds.add(q.id);

  if (typeof q.question !== "string" || q.question.length === 0)
    fail(gameNum, qNum, "question text missing/empty", q);

  for (const k of ["a", "b", "c", "d"]) {
    if (typeof q[k] !== "string" || q[k].trim().length === 0)
      fail(gameNum, qNum, `option ${k} missing/empty`, q);
  }

  // No duplicate options within a question (case-insensitive)
  const opts = [q.a, q.b, q.c, q.d].map(s => String(s).toLowerCase().trim());
  if (new Set(opts).size < 4)
    fail(gameNum, qNum, `duplicate options: ${opts.join(" | ")}`, q);

  if (!["a", "b", "c", "d"].includes(q.correct))
    fail(gameNum, qNum, `correct must be a|b|c|d, got ${JSON.stringify(q.correct)}`, q);

  if (!VALID_DIFFICULTIES.has(q.difficulty))
    fail(gameNum, qNum, `invalid difficulty ${q.difficulty}`, q);

  if (!VALID_CATEGORIES.has(q.category))
    fail(gameNum, qNum, `invalid category ${q.category}`, q);
}

function playOneGame(gameNum) {
  return new Promise((resolve) => {
    const guestId = nanoid();
    const ws = new WebSocket(URL);
    const seenQuestionIds = new Set();
    let roomId = null;
    let qNum = 0;
    let lastPhase = null;
    let phaseStuckTimer = null;
    let lastQuestionIndex = -1;       // round-trip dedup
    let lastRound = -1;
    let lastQuestion = null;

    const log = (m) => console.log(`  [G${gameNum}] ${m}`);

    function clearStuck() { if (phaseStuckTimer) clearTimeout(phaseStuckTimer); }
    function resetStuck() {
      clearStuck();
      phaseStuckTimer = setTimeout(() => {
        fail(gameNum, qNum, `phase '${lastPhase}' stalled > 30s`);
        ws.close();
      }, 30000);
    }

    ws.on("open", () => {
      ws.send(JSON.stringify({
        type: "room:create",
        guestId,
        displayName: `Soak${gameNum}`,
        mode: "phones_only",
        experience: "trivia",
        tournament: false,
      }));
    });

    ws.on("message", (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); }
      catch (e) { fail(gameNum, qNum, "non-JSON message", raw.toString().slice(0, 100)); return; }

      if (msg.type === "room:created") {
        roomId = msg.room.id;
        ws.send(JSON.stringify({ type: "host:start", guestId, roomId, tournament: false }));
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
          log(`phase ${lastPhase ?? "(start)"} → ${phase}` + (s.question ? ` (Q#${s.questionIndex + 1}: ${String(s.question.question ?? "").slice(0, 60)})` : ""));
          lastPhase = phase;
          resetStuck();
        }

        if (phase === "question" && s.question) {
          const isNewQuestion = s.questionIndex !== lastQuestionIndex || s.round !== lastRound;
          if (isNewQuestion) {
            qNum = s.questionIndex + 1;
            assertQuestion(gameNum, qNum, s.question, seenQuestionIds);
            lastQuestionIndex = s.questionIndex;
            lastRound = s.round;
            lastQuestion = s.question;
            // Submit a random answer
            const pick = ["a", "b", "c", "d"][Math.floor(Math.random() * 4)];
            setTimeout(() => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "game:answer", guestId, roomId, answer: pick }));
              }
            }, 200);
          }
        }

        if (phase === "reveal") {
          // After 1.2s, advance
          setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "host:next_question", guestId, roomId }));
            }
          }, 1200);
        }

        if (phase === "round_end") {
          setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "host:next_question", guestId, roomId }));
            }
          }, 800);
        }

        if (phase === "game_over") {
          clearStuck();
          log(`game_over (${seenQuestionIds.size} questions seen)`);
          ws.close();
        }
      }
    });

    ws.on("close", () => {
      clearStuck();
      resolve({ questionsSeen: seenQuestionIds.size });
    });

    ws.on("error", (e) => {
      fail(gameNum, qNum, `WS error: ${e.message}`);
      clearStuck();
      resolve({ questionsSeen: seenQuestionIds.size });
    });
  });
}

async function main() {
  console.log(`\n=== Trivia Soak — ${GAMES} games via ${URL} ===\n`);
  const startedAt = Date.now();
  let totalQuestions = 0;

  for (let i = 1; i <= GAMES; i++) {
    const r = await playOneGame(i);
    totalQuestions += r.questionsSeen;
  }

  const elapsedMs = Date.now() - startedAt;
  console.log("\n=== SUMMARY ===");
  console.log(`Games:       ${GAMES}`);
  console.log(`Questions:   ${totalQuestions}`);
  console.log(`Failures:    ${failures.length}`);
  console.log(`Elapsed:     ${(elapsedMs / 1000).toFixed(1)}s`);

  if (failures.length === 0) {
    console.log("\nVERDICT: ✓ Clean — Trivia state machine + question bank passes assertion suite\n");
    process.exit(0);
  } else {
    console.log("\nVERDICT: ✗ Bugs found:\n");
    for (const f of failures) {
      console.log(`  G${f.gameNum} Q${f.qNum}: ${f.msg}`);
      if (f.ctx) console.log(`    context: ${JSON.stringify(f.ctx).slice(0, 200)}`);
    }
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(2); });
