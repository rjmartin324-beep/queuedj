#!/usr/bin/env node
// rankit-soak.mjs — Rank It end-to-end soak.
// Plays N games, asserts challenge shape + ranking submit + 250-pt-per-correct-position scoring.
//
// Run: node apps/box/test/rankit-soak.mjs --games 10 --port 8090

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
const QUESTIONS_PER_GAME = 8;

const failures = [];
function fail(g, q, msg, ctx) { failures.push({ g, q, msg, ctx }); console.log(`  ✗ G${g} Q${q}: ${msg}`); }
function nanoid(n = 10) {
  return Array.from({ length: n }, () =>
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]
  ).join("");
}

function assertChallenge(g, q, c, seenIds) {
  if (!c) return fail(g, q, "no challenge object");
  if (typeof c.id !== "number") fail(g, q, "challenge.id missing");
  if (seenIds.has(c.id)) fail(g, q, `duplicate challenge id ${c.id} within same game`);
  seenIds.add(c.id);
  if (typeof c.question !== "string" || c.question.length === 0) fail(g, q, "question text empty", c);
  if (!Array.isArray(c.items) || c.items.length < 3)
    fail(g, q, `expected ≥3 items, got ${c.items?.length}`, c);
  if (new Set(c.items).size !== c.items.length)
    fail(g, q, "duplicate items in shuffle", c);
  if (!Array.isArray(c.correct) || c.correct.length !== c.items.length)
    fail(g, q, `correct length ${c.correct?.length} !== items length ${c.items?.length}`, c);
  // Every correct entry must be in items
  for (const k of c.correct ?? []) {
    if (!c.items.includes(k)) fail(g, q, `correct '${k}' not in items`, c);
  }
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
    let lastChallenge = null;

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
        displayName: `Rank${gameNum}`,
        mode: "phones_only",
        experience: "rankit",
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
          log(`phase ${lastPhase ?? "(start)"} → ${phase}` + (s.challenge ? ` (Q#${s.questionIndex + 1})` : ""));
          lastPhase = phase;
          resetStuck();
        }

        if (phase === "question" && s.challenge) {
          const newQ = s.questionIndex !== lastIndex;
          if (newQ) {
            qNum = s.questionIndex + 1;
            assertChallenge(gameNum, qNum, s.challenge, seenIds);
            lastIndex = s.questionIndex;
            lastChallenge = s.challenge;
            submitted = false;
            revealed = false;
          }
          if (!submitted) {
            submitted = true;
            // Submit a random ordering — hits all assertion paths regardless of correctness
            const order = [...s.challenge.items].sort(() => Math.random() - 0.5);
            setTimeout(() => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: "game:action", guestId, roomId,
                  action: "rank:submit", payload: { order },
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
          // Each correct position = 250 pts, items.length positions max
          const maxPossible = (lastChallenge?.items?.length ?? 0) * 250;
          if (delta < 0 || delta > maxPossible)
            fail(gameNum, qNum, `delta ${delta} out of range (0..${maxPossible})`);
          if (delta % 250 !== 0)
            fail(gameNum, qNum, `delta ${delta} not a multiple of 250`);
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
            fail(gameNum, qNum, `expected ${QUESTIONS_PER_GAME} challenges, saw ${seenIds.size}`);
          log(`game_over (${seenIds.size} challenges, score ${lastScore})`);
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
  console.log(`\n=== Rank It Soak — ${GAMES} games via ${URL} ===\n`);
  const t0 = Date.now();
  let total = 0;
  for (let i = 1; i <= GAMES; i++) {
    const r = await playOne(i);
    total += r.seen;
  }
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log("\n=== SUMMARY ===");
  console.log(`Games:      ${GAMES}`);
  console.log(`Challenges: ${total}`);
  console.log(`Failures:   ${failures.length}`);
  console.log(`Elapsed:    ${elapsed}s`);
  if (failures.length === 0) {
    console.log("\nVERDICT: ✓ Clean — Rank It state machine + challenge bank passes\n");
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
