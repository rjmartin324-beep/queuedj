#!/usr/bin/env node
// connections-soak.mjs — Connections end-to-end soak.
// Plays N puzzles, asserts 16 tiles / 4 groups of 4 / strike system / tier scoring.
//
// Run: node apps/box/test/connections-soak.mjs --games 10 --port 8090

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
const VALID_COLORS = ["yellow", "green", "blue", "purple"];
const COLOR_POINTS = { yellow: 100, green: 200, blue: 300, purple: 400 };
const PERFECT_SCORE = 1000;

const failures = [];
function fail(g, p, msg, ctx) { failures.push({ g, p, msg, ctx }); console.log(`  ✗ G${g} P${p}: ${msg}`); }
function nanoid(n = 10) {
  return Array.from({ length: n }, () =>
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]
  ).join("");
}

function assertPuzzle(g, puzzle) {
  if (!puzzle) return fail(g, 1, "no puzzle object");
  if (typeof puzzle.id !== "number") fail(g, 1, "puzzle.id missing");
  if (!Array.isArray(puzzle.groups) || puzzle.groups.length !== 4)
    fail(g, 1, `puzzle should have 4 groups, got ${puzzle.groups?.length}`, puzzle);

  const colorsSeen = new Set();
  const allItems = new Set();
  for (const grp of puzzle.groups ?? []) {
    if (!VALID_COLORS.includes(grp.color)) fail(g, 1, `invalid group color '${grp.color}'`, grp);
    if (colorsSeen.has(grp.color)) fail(g, 1, `duplicate group color '${grp.color}'`);
    colorsSeen.add(grp.color);
    if (typeof grp.category !== "string" || grp.category.length === 0)
      fail(g, 1, "group category missing", grp);
    if (!Array.isArray(grp.items) || grp.items.length !== 4)
      fail(g, 1, `group should have 4 items, got ${grp.items?.length}`, grp);
    for (const it of grp.items ?? []) {
      if (typeof it !== "string" || it.length === 0) fail(g, 1, "item empty", grp);
      if (allItems.has(it)) fail(g, 1, `item '${it}' appears in multiple groups`);
      allItems.add(it);
    }
  }
  if (allItems.size !== 16) fail(g, 1, `expected 16 unique items, got ${allItems.size}`);
}

function assertTiles(g, tiles, puzzle) {
  if (!Array.isArray(tiles) || tiles.length !== 16)
    fail(g, 1, `expected 16 tiles, got ${tiles?.length}`);
  const tileSet = new Set(tiles);
  if (tileSet.size !== 16) fail(g, 1, `duplicate tiles in shuffle`);
  const expected = new Set((puzzle?.groups ?? []).flatMap(grp => grp.items));
  for (const t of tileSet) if (!expected.has(t)) fail(g, 1, `tile '${t}' not in puzzle items`);
}

function playOne(gameNum) {
  return new Promise((resolve) => {
    const guestId = nanoid();
    const ws = new WebSocket(URL);
    let roomId = null;
    let lastPhase = null;
    let stuckTimer = null;
    let started = false;
    let finalScore = 0;
    let puzzleId = null;
    let resultEvents = []; // accumulated conn:result events
    let revealHandled = false;

    const log = (m) => console.log(`  [G${gameNum}] ${m}`);
    function clearStuck() { if (stuckTimer) clearTimeout(stuckTimer); }
    function resetStuck() {
      clearStuck();
      stuckTimer = setTimeout(() => {
        fail(gameNum, 1, `phase '${lastPhase}' stalled > 30s`);
        ws.close();
      }, 30000);
    }

    ws.on("open", () => {
      ws.send(JSON.stringify({
        type: "room:create",
        guestId,
        displayName: `Conn${gameNum}`,
        mode: "phones_only",
        experience: "connections",
        tournament: false,
      }));
    });

    ws.on("message", (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); }
      catch (e) { fail(gameNum, 1, "non-JSON message"); return; }

      if (msg.type === "room:created") {
        roomId = msg.room.id;
        ws.send(JSON.stringify({ type: "host:start", guestId, roomId }));
        return;
      }
      if (msg.type === "room:error") {
        fail(gameNum, 1, `room:error ${msg.code}: ${msg.message}`);
        ws.close();
        return;
      }

      // Per-submit result events back to the submitter
      if (msg.type === "game:event" && msg.event === "conn:result") {
        const { correct, color } = msg.payload ?? {};
        resultEvents.push({ correct: !!correct, color });
        if (correct && (!color || !VALID_COLORS.includes(color)))
          fail(gameNum, 1, `correct result with bad color '${color}'`);
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

        if (phase === "question" && !started && s.puzzle && s.tiles) {
          started = true;
          puzzleId = s.puzzle.id;
          assertPuzzle(gameNum, s.puzzle);
          assertTiles(gameNum, s.tiles, s.puzzle);

          // Step 1: deliberate strike — pick one tile from each group (guaranteed wrong)
          const wrongMix = s.puzzle.groups.map(grp => grp.items[0]);
          setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: "game:action", guestId, roomId,
                action: "conn:submit", payload: { tiles: wrongMix },
              }));
            }
          }, 200);

          // Steps 2–5: submit each correct group, staggered
          for (let i = 0; i < 4; i++) {
            const grp = s.puzzle.groups[i];
            setTimeout(() => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: "game:action", guestId, roomId,
                  action: "conn:submit", payload: { tiles: grp.items },
                }));
              }
            }, 400 + i * 200);
          }
        }

        if (phase === "reveal" && !revealHandled) {
          revealHandled = true;
          const me = s.players?.[guestId];
          if (!me) fail(gameNum, 1, "no player state at reveal");
          else {
            if (me.attempts !== 1)
              fail(gameNum, 1, `expected exactly 1 strike, got ${me.attempts}`, me);
            if (!Array.isArray(me.found) || me.found.length !== 4)
              fail(gameNum, 1, `expected 4 groups found, got ${me.found?.length}`, me);
            if (!me.done) fail(gameNum, 1, "expected player.done=true at reveal", me);
            const foundColors = new Set(me.found ?? []);
            for (const c of VALID_COLORS) {
              if (!foundColors.has(c)) fail(gameNum, 1, `missing found color '${c}'`, me);
            }
          }
          const myScore = s.scores?.find(x => x.guestId === guestId)?.score ?? 0;
          finalScore = myScore;
          if (myScore !== PERFECT_SCORE)
            fail(gameNum, 1, `expected score ${PERFECT_SCORE} (100+200+300+400), got ${myScore}`);

          // Cross-check result events
          const correctEvents = resultEvents.filter(e => e.correct);
          const wrongEvents = resultEvents.filter(e => !e.correct);
          if (correctEvents.length !== 4)
            fail(gameNum, 1, `expected 4 correct events, got ${correctEvents.length}`);
          if (wrongEvents.length !== 1)
            fail(gameNum, 1, `expected 1 wrong event, got ${wrongEvents.length}`);

          setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "host:next_question", guestId, roomId }));
            }
          }, 500);
        }

        if (phase === "game_over") {
          clearStuck();
          log(`game_over (puzzle ${puzzleId}, score ${finalScore})`);
          ws.close();
        }
      }
    });

    ws.on("close", () => { clearStuck(); resolve({ score: finalScore, puzzleId }); });
    ws.on("error", (e) => {
      fail(gameNum, 1, `WS error: ${e.message}`);
      clearStuck();
      resolve({ score: finalScore, puzzleId });
    });
  });
}

async function main() {
  console.log(`\n=== Connections Soak — ${GAMES} games via ${URL} ===\n`);
  const t0 = Date.now();
  const seenPuzzles = new Set();
  for (let i = 1; i <= GAMES; i++) {
    const r = await playOne(i);
    if (r.puzzleId) seenPuzzles.add(r.puzzleId);
  }
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log("\n=== SUMMARY ===");
  console.log(`Games:           ${GAMES}`);
  console.log(`Unique puzzles:  ${seenPuzzles.size}`);
  console.log(`Failures:        ${failures.length}`);
  console.log(`Elapsed:         ${elapsed}s`);
  if (failures.length === 0) {
    console.log("\nVERDICT: ✓ Clean — Connections state machine + puzzle bank passes\n");
    process.exit(0);
  }
  console.log("\nVERDICT: ✗ Bugs found:\n");
  for (const f of failures) {
    console.log(`  G${f.g} P${f.p}: ${f.msg}`);
    if (f.ctx) console.log(`    context: ${JSON.stringify(f.ctx).slice(0, 200)}`);
  }
  process.exit(1);
}
main().catch(e => { console.error(e); process.exit(2); });
