#!/usr/bin/env node
// wyr-soak.mjs — Would You Rather end-to-end soak.
// Plays N games, asserts every prompt + every state transition.
//
// Run: node apps/box/test/wyr-soak.mjs --games 10 --port 8090

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
const QUESTIONS_PER_GAME = 15;

const failures = [];
function fail(g, q, msg, ctx) { failures.push({ g, q, msg, ctx }); console.log(`  ✗ G${g} Q${q}: ${msg}`); }
function nanoid(n = 10) {
  return Array.from({ length: n }, () =>
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]
  ).join("");
}

function assertPrompt(g, q, p, seenIds) {
  if (!p) return fail(g, q, "no prompt object");
  if (typeof p.id !== "number") fail(g, q, "prompt.id missing");
  if (seenIds.has(p.id)) fail(g, q, `duplicate prompt id ${p.id} within same game`);
  seenIds.add(p.id);
  if (typeof p.optionA !== "string" || p.optionA.trim().length === 0)
    fail(g, q, "optionA missing/empty", p);
  if (typeof p.optionB !== "string" || p.optionB.trim().length === 0)
    fail(g, q, "optionB missing/empty", p);
  if (p.optionA.trim().toLowerCase() === p.optionB.trim().toLowerCase())
    fail(g, q, "options identical", p);
  if (typeof p.category !== "string" || p.category.length === 0)
    fail(g, q, "category missing", p);
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
    let voted = false;
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
        displayName: `Soak${gameNum}`,
        mode: "phones_only",
        experience: "wyr",
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
          log(`phase ${lastPhase ?? "(start)"} → ${phase}` + (s.prompt ? ` (Q#${s.questionIndex + 1})` : ""));
          lastPhase = phase;
          resetStuck();
        }

        if (phase === "question" && s.prompt) {
          const newQ = s.questionIndex !== lastIndex;
          if (newQ) {
            qNum = s.questionIndex + 1;
            assertPrompt(gameNum, qNum, s.prompt, seenIds);
            lastIndex = s.questionIndex;
            voted = false;
          }
          if (!voted) {
            voted = true;
            const pick = Math.random() < 0.5 ? "a" : "b";
            setTimeout(() => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: "game:action", guestId, roomId,
                  action: "wyr:vote", payload: { vote: pick },
                }));
              }
            }, 150);
          }
        }

        if (phase === "reveal") {
          // Score should never decrease; should grow by 50 (safe), 150 (bold), or 75 (tie)
          const me = s.scores?.find(x => x.guestId === guestId);
          const myScore = me?.score ?? 0;
          if (myScore < lastScore) fail(gameNum, qNum, `score went DOWN: ${lastScore} → ${myScore}`);
          const delta = myScore - lastScore;
          if (delta !== 0 && delta !== 50 && delta !== 75 && delta !== 150)
            fail(gameNum, qNum, `unexpected score delta ${delta} (expected 50|75|150)`);
          lastScore = myScore;
          setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: "game:action", guestId, roomId,
                action: "wyr:next",
              }));
            }
          }, 800);
        }

        if (phase === "game_over") {
          clearStuck();
          if (seenIds.size !== QUESTIONS_PER_GAME)
            fail(gameNum, qNum, `expected ${QUESTIONS_PER_GAME} prompts, saw ${seenIds.size}`);
          log(`game_over (${seenIds.size} prompts seen, score ${lastScore})`);
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
  console.log(`\n=== WYR Soak — ${GAMES} games via ${URL} ===\n`);
  const t0 = Date.now();
  let total = 0;
  for (let i = 1; i <= GAMES; i++) {
    const r = await playOne(i);
    total += r.seen;
  }
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log("\n=== SUMMARY ===");
  console.log(`Games:    ${GAMES}`);
  console.log(`Prompts:  ${total}`);
  console.log(`Failures: ${failures.length}`);
  console.log(`Elapsed:  ${elapsed}s`);
  if (failures.length === 0) {
    console.log("\nVERDICT: ✓ Clean — WYR state machine + prompt bank passes\n");
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
