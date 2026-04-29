#!/usr/bin/env node
// thedraft-soak.mjs — The Draft end-to-end soak.
// Plays N games, asserts scenario shape + snake-pick order + final score = sum of pick values.
//
// Run: node apps/box/test/thedraft-soak.mjs --games 10 --port 8090

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
const PICKS_EACH = 2;

const failures = [];
function fail(g, msg, ctx) { failures.push({ g, msg, ctx }); console.log(`  ✗ G${g}: ${msg}`); }
function nanoid(n = 10) {
  return Array.from({ length: n }, () =>
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]
  ).join("");
}

function assertScenario(g, sc) {
  if (!sc) return fail(g, "no scenario");
  if (typeof sc.id !== "number") fail(g, "scenario.id missing");
  if (typeof sc.title !== "string" || sc.title.length === 0) fail(g, "scenario.title empty", sc);
  if (typeof sc.subtitle !== "string") fail(g, "scenario.subtitle missing");
  if (!Array.isArray(sc.items) || sc.items.length < PICKS_EACH * 2)
    fail(g, `expected ≥${PICKS_EACH * 2} items, got ${sc.items?.length}`, sc);
  const ids = new Set();
  for (const it of sc.items ?? []) {
    if (typeof it.id !== "string" || it.id.length === 0) fail(g, "item.id missing", it);
    if (ids.has(it.id)) fail(g, `duplicate item id '${it.id}'`);
    ids.add(it.id);
    if (typeof it.name !== "string" || it.name.length === 0) fail(g, "item.name empty", it);
    if (typeof it.value !== "number") fail(g, `item.value not a number: ${it.value}`, it);
    if (it.value < 0 || it.value > 100) fail(g, `item.value ${it.value} out of 0..100`, it);
  }
}

function playOne(gameNum) {
  return new Promise((resolve) => {
    const guestId = nanoid();
    const ws = new WebSocket(URL);
    let roomId = null;
    let lastPhase = null;
    let stuckTimer = null;
    let scenarioAsserted = false;
    let pickCount = 0;
    let myPicks = [];
    let myExpectedScore = 0;
    let revealed = false;
    let scenarioId = null;
    let finalScore = 0;

    const log = (m) => console.log(`  [G${gameNum}] ${m}`);
    function clearStuck() { if (stuckTimer) clearTimeout(stuckTimer); }
    function resetStuck() {
      clearStuck();
      stuckTimer = setTimeout(() => {
        fail(gameNum, `phase '${lastPhase}' stalled > 30s`);
        ws.close();
      }, 30000);
    }

    ws.on("open", () => {
      ws.send(JSON.stringify({
        type: "room:create",
        guestId,
        displayName: `Draft${gameNum}`,
        mode: "phones_only",
        experience: "thedraft",
        tournament: false,
      }));
    });

    ws.on("message", (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); }
      catch (e) { fail(gameNum, "non-JSON message"); return; }

      if (msg.type === "room:created") {
        roomId = msg.room.id;
        ws.send(JSON.stringify({ type: "host:start", guestId, roomId }));
        return;
      }
      if (msg.type === "room:error") {
        fail(gameNum, `room:error ${msg.code}: ${msg.message}`);
        ws.close();
        return;
      }

      if (msg.type === "game:state") {
        const s = msg.state;
        const phase = s.phase;
        if (phase !== lastPhase) {
          log(`phase ${lastPhase ?? "(start)"} → ${phase}`);
          lastPhase = phase;
          resetStuck();
        }

        if (phase === "drafting" && s.scenario) {
          if (!scenarioAsserted) {
            scenarioAsserted = true;
            scenarioId = s.scenario.id;
            assertScenario(gameNum, s.scenario);
            // Snake-order assertion with 1 player: [P1, P1] for 2 picks
            if (!Array.isArray(s.draftOrder) || s.draftOrder.length !== PICKS_EACH)
              fail(gameNum, `draftOrder length ${s.draftOrder?.length} !== ${PICKS_EACH}`);
            for (const id of s.draftOrder ?? []) {
              if (id !== guestId) fail(gameNum, `draftOrder includes non-self id '${id}'`);
            }
            if (s.totalPicks !== PICKS_EACH) fail(gameNum, `totalPicks ${s.totalPicks} !== ${PICKS_EACH}`);
          }

          // It's our pick if currentPick is in range and points at us
          if (s.currentPick < s.totalPicks && s.draftOrder[s.currentPick] === guestId
              && s.availableItems?.length > 0
              && pickCount === s.currentPick) {
            // Pick highest-value available — exercises score arithmetic
            const sorted = [...s.availableItems].sort((a, b) => b.value - a.value);
            const pickItem = sorted[0];
            myPicks.push(pickItem);
            myExpectedScore += pickItem.value;
            pickCount++;
            setTimeout(() => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: "game:action", guestId, roomId,
                  action: "draft:pick", payload: { itemId: pickItem.id },
                }));
              }
            }, 150);
          }
        }

        if (phase === "reveal" && !revealed) {
          revealed = true;
          const me = s.scores?.find(x => x.guestId === guestId);
          finalScore = me?.score ?? 0;
          if (finalScore !== myExpectedScore)
            fail(gameNum, `score ${finalScore} !== sum of picks ${myExpectedScore}`, { picks: myPicks });
          if (!Array.isArray(me?.picks) || me.picks.length !== PICKS_EACH)
            fail(gameNum, `picks count ${me?.picks?.length} !== ${PICKS_EACH}`);
          // host:next_question advances to game_over
          setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "host:next_question", guestId, roomId }));
            }
          }, 500);
        }

        if (phase === "game_over") {
          clearStuck();
          log(`game_over (scenario ${scenarioId}, score ${finalScore})`);
          ws.close();
        }
      }
    });

    ws.on("close", () => { clearStuck(); resolve({ scenarioId, score: finalScore }); });
    ws.on("error", (e) => {
      fail(gameNum, `WS error: ${e.message}`);
      clearStuck();
      resolve({ scenarioId, score: finalScore });
    });
  });
}

async function main() {
  console.log(`\n=== The Draft Soak — ${GAMES} games via ${URL} ===\n`);
  const t0 = Date.now();
  const seen = new Set();
  for (let i = 1; i <= GAMES; i++) {
    const r = await playOne(i);
    if (r.scenarioId) seen.add(r.scenarioId);
  }
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log("\n=== SUMMARY ===");
  console.log(`Games:             ${GAMES}`);
  console.log(`Unique scenarios:  ${seen.size}`);
  console.log(`Failures:          ${failures.length}`);
  console.log(`Elapsed:           ${elapsed}s`);
  if (failures.length === 0) {
    console.log("\nVERDICT: ✓ Clean — The Draft state machine + scenario bank passes\n");
    process.exit(0);
  }
  console.log("\nVERDICT: ✗ Bugs found:\n");
  for (const f of failures) {
    console.log(`  G${f.g}: ${f.msg}`);
    if (f.ctx) console.log(`    context: ${JSON.stringify(f.ctx).slice(0, 200)}`);
  }
  process.exit(1);
}
main().catch(e => { console.error(e); process.exit(2); });
