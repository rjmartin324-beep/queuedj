#!/usr/bin/env node
// geoguesser-soak.mjs — GeoGuesser end-to-end soak.
// Plays N games, asserts photo metadata + pin + km-distance scoring.
//
// Run: node apps/box/test/geoguesser-soak.mjs --games 10 --port 8090

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
const VALID_DIFF = new Set(["easy", "medium", "hard"]);

const failures = [];
function fail(g, q, msg, ctx) { failures.push({ g, q, msg, ctx }); console.log(`  ✗ G${g} Q${q}: ${msg}`); }
function nanoid(n = 10) {
  return Array.from({ length: n }, () =>
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]
  ).join("");
}

function assertQuestionShape(g, q, qq, seenIds) {
  if (!qq) return fail(g, q, "no question object");
  if (typeof qq.id !== "number") fail(g, q, "question.id missing");
  if (seenIds.has(qq.id)) fail(g, q, `duplicate question id ${qq.id} within same game`);
  seenIds.add(qq.id);
  if (typeof qq.photoUrl !== "string" || !qq.photoUrl.startsWith("/geo-photos/"))
    fail(g, q, `bad photoUrl '${qq.photoUrl}'`, qq);
  if (!VALID_DIFF.has(qq.difficulty)) fail(g, q, `invalid difficulty '${qq.difficulty}'`, qq);
  if (typeof qq.region !== "string" || qq.region.length === 0) fail(g, q, "region missing", qq);
}

function assertReveal(g, q, qq) {
  if (typeof qq.lat !== "number" || qq.lat < -90 || qq.lat > 90)
    fail(g, q, `reveal lat out of range: ${qq.lat}`, qq);
  if (typeof qq.lng !== "number" || qq.lng < -180 || qq.lng > 180)
    fail(g, q, `reveal lng out of range: ${qq.lng}`, qq);
  // Some islands really do have coords very near 0,0 — but not exactly. The masked
  // question is (0,0); the reveal swaps in the real coords from the bank.
  if (qq.lat === 0 && qq.lng === 0) fail(g, q, "reveal coords still masked at (0,0)", qq);
  if (typeof qq.location !== "string" || qq.location.length === 0)
    fail(g, q, "reveal location missing", qq);
  if (typeof qq.country !== "string" || qq.country.length === 0)
    fail(g, q, "reveal country missing", qq);
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
    let pinned = false;
    let revealedThisRound = false;
    let lastScore = 0;
    let totalDist = 0;

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
        displayName: `Geo${gameNum}`,
        mode: "phones_only",
        experience: "geoguesser",
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
            assertQuestionShape(gameNum, qNum, s.question, seenIds);
            lastIndex = s.questionIndex;
            pinned = false;
            revealedThisRound = false;
          }
          if (!pinned) {
            pinned = true;
            // Random pin somewhere on Earth (asserts haversine handles full range)
            const lat = Math.random() * 180 - 90;
            const lng = Math.random() * 360 - 180;
            setTimeout(() => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: "game:action", guestId, roomId,
                  action: "geo:pin", payload: { lat, lng },
                }));
              }
            }, 150);
          }
        }

        if (phase === "reveal" && !revealedThisRound) {
          revealedThisRound = true;
          if (s.question) assertReveal(gameNum, qNum, s.question);
          const dist = s.distances?.[guestId];
          if (typeof dist !== "number" || dist < 0 || dist > 21000)
            fail(gameNum, qNum, `bad distance ${dist} (expect 0..~20015km)`);
          const me = s.scores?.find(x => x.guestId === guestId);
          const myScore = me?.score ?? 0;
          if (myScore < lastScore) fail(gameNum, qNum, `score went DOWN: ${lastScore} → ${myScore}`);
          const roundPts = myScore - lastScore;
          if (roundPts < 0 || roundPts > 5000)
            fail(gameNum, qNum, `round points out of range: ${roundPts} (0..5000)`);
          // totalDistanceKm should accumulate
          if (typeof me?.totalDistanceKm !== "number" || me.totalDistanceKm < totalDist)
            fail(gameNum, qNum, `totalDistanceKm regression: ${totalDist} → ${me?.totalDistanceKm}`);
          totalDist = me?.totalDistanceKm ?? totalDist;
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
            fail(gameNum, qNum, `expected ${QUESTIONS_PER_GAME} photos, saw ${seenIds.size}`);
          log(`game_over (${seenIds.size} photos, score ${lastScore}, total ${totalDist.toFixed(0)}km)`);
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
  console.log(`\n=== GeoGuesser Soak — ${GAMES} games via ${URL} ===\n`);
  const t0 = Date.now();
  let total = 0;
  for (let i = 1; i <= GAMES; i++) {
    const r = await playOne(i);
    total += r.seen;
  }
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log("\n=== SUMMARY ===");
  console.log(`Games:    ${GAMES}`);
  console.log(`Photos:   ${total}`);
  console.log(`Failures: ${failures.length}`);
  console.log(`Elapsed:  ${elapsed}s`);
  if (failures.length === 0) {
    console.log("\nVERDICT: ✓ Clean — GeoGuesser state machine + photo bank passes\n");
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
