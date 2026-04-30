#!/usr/bin/env node
// draw-soak.mjs — Draw It end-to-end soak.
// 2-client harness: host + guesser. Host sees the word when drawer; otherwise guesser sees it.
// Whichever side sees the word triggers the OTHER to submit it as a guess.
//
// Run: node apps/box/test/draw-soak.mjs --games 10 --port 8090

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
const PLAYERS_PER_GAME = 2;  // → 2 rounds (each draws once)

const failures = [];
function fail(g, r, msg, ctx) { failures.push({ g, r, msg, ctx }); console.log(`  ✗ G${g} R${r}: ${msg}`); }
function nanoid(n = 10) {
  return Array.from({ length: n }, () =>
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]
  ).join("");
}

function playOne(gameNum) {
  return new Promise((resolve) => {
    const hostId = nanoid();
    const guesserId = nanoid();
    const host = new WebSocket(URL);
    const guesser = new WebSocket(URL);

    let roomId = null;
    let roomCode = null;
    let lastPhase = null;
    let stuckTimer = null;
    let lastRound = -1;
    let roundsPlayed = 0;
    let guessSent = false;
    let revealHandled = false;
    let scoreBaseline = { host: 0, guesser: 0 };  // before-round totals
    let seenWords = new Set();

    const log = (m) => console.log(`  [G${gameNum}] ${m}`);
    function clearStuck() { if (stuckTimer) clearTimeout(stuckTimer); }
    function resetStuck() {
      clearStuck();
      stuckTimer = setTimeout(() => {
        fail(gameNum, roundsPlayed + 1, `phase '${lastPhase}' stalled > 30s`);
        bothClose();
      }, 30000);
    }
    function send(ws, m) { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m)); }
    function bothClose() {
      try { host.close(); } catch {}
      try { guesser.close(); } catch {}
    }

    // When ANY side sees a non-null word for the current round, the OTHER side guesses it.
    // Triggered from each side's message handler.
    function triggerGuess(word, drawerId, roundIdx) {
      if (guessSent) return;
      guessSent = true;
      if (seenWords.has(word))
        fail(gameNum, roundIdx + 1, `duplicate word across rounds: '${word}'`);
      seenWords.add(word);
      // The non-drawer guesses
      const guesserSide = drawerId === hostId ? guesser : host;
      const submitterId = drawerId === hostId ? guesserId : hostId;
      setTimeout(() => send(guesserSide, {
        type: "game:action", guestId: submitterId, roomId,
        action: "draw:guess", payload: { guess: word },
      }), 200);
    }

    host.on("open", () => {
      send(host, {
        type: "room:create", guestId: hostId,
        displayName: `Draw${gameNum}H`,
        mode: "phones_only", experience: "draw", tournament: false,
      });
    });

    host.on("message", (raw) => {
      let msg; try { msg = JSON.parse(raw.toString()); } catch { return; }

      if (msg.type === "room:created") {
        roomId = msg.room.id;
        roomCode = msg.room.code;
        // Have guesser join (it's already open by now or about to be)
        const tryJoin = () => {
          if (guesser.readyState === WebSocket.OPEN) {
            send(guesser, {
              type: "room:join", guestId: guesserId,
              displayName: `Draw${gameNum}G`,
              code: roomCode,
            });
          } else setTimeout(tryJoin, 50);
        };
        tryJoin();
        return;
      }
      if (msg.type === "room:error") {
        fail(gameNum, roundsPlayed + 1, `host room:error ${msg.code}: ${msg.message}`);
        bothClose();
        return;
      }

      if (msg.type === "game:state") {
        const s = msg.state;
        if (s.phase !== lastPhase) {
          log(`phase ${lastPhase ?? "(start)"} → ${s.phase} (round ${(s.roundIndex ?? 0) + 1}, drawer ${s.drawerId === hostId ? "host" : "guesser"})`);
          lastPhase = s.phase;
          resetStuck();
        }

        if (s.phase === "drawing") {
          // Round transition reset
          if (s.roundIndex !== lastRound) {
            lastRound = s.roundIndex;
            guessSent = false;
            revealHandled = false;
            // Capture baseline scores BEFORE any points awarded this round
            scoreBaseline.host = s.scores.find(x => x.guestId === hostId)?.score ?? 0;
            scoreBaseline.guesser = s.scores.find(x => x.guestId === guesserId)?.score ?? 0;
          }

          const hostIsDrawer = s.drawerId === hostId;
          if (hostIsDrawer) {
            // Word should be present
            if (typeof s.word !== "string" || s.word.length === 0) {
              fail(gameNum, s.roundIndex + 1, "drawer (host) state has no word", s);
            } else {
              triggerGuess(s.word, hostId, s.roundIndex);
            }
          } else {
            // Host is non-drawer this round — server MUST mask word to null
            if (s.word !== null) {
              fail(gameNum, s.roundIndex + 1, `WORD LEAKED to non-drawer host: '${s.word}'`);
            }
          }
        }

        if (s.phase === "reveal" && !revealHandled) {
          revealHandled = true;
          const hostScore = s.scores.find(x => x.guestId === hostId)?.score ?? 0;
          const guesserScore = s.scores.find(x => x.guestId === guesserId)?.score ?? 0;
          const hostDelta = hostScore - scoreBaseline.host;
          const guesserDelta = guesserScore - scoreBaseline.guesser;

          const drawerOrder = s.drawerOrder ?? [];
          const drawerThisRound = drawerOrder[s.roundIndex];
          // drawer +100, sole guesser +400 (max(100, 500 - 1*100) = 400)
          if (drawerThisRound === hostId) {
            if (hostDelta !== 100) fail(gameNum, s.roundIndex + 1, `host (drawer) delta ${hostDelta} != 100`);
            if (guesserDelta !== 400) fail(gameNum, s.roundIndex + 1, `guesser delta ${guesserDelta} != 400`);
          } else {
            if (guesserDelta !== 100) fail(gameNum, s.roundIndex + 1, `guesser (drawer) delta ${guesserDelta} != 100`);
            if (hostDelta !== 400) fail(gameNum, s.roundIndex + 1, `host delta ${hostDelta} != 400`);
          }
          roundsPlayed++;
          setTimeout(() => send(host, { type: "host:next_question", guestId: hostId, roomId }), 400);
        }

        if (s.phase === "game_over") {
          clearStuck();
          if (roundsPlayed !== PLAYERS_PER_GAME)
            fail(gameNum, roundsPlayed, `expected ${PLAYERS_PER_GAME} rounds, played ${roundsPlayed}`);
          log(`game_over (${roundsPlayed} rounds, words: ${[...seenWords].join(", ")})`);
          bothClose();
        }
      }
    });

    guesser.on("message", (raw) => {
      let msg; try { msg = JSON.parse(raw.toString()); } catch { return; }

      if (msg.type === "room:joined") {
        // Both clients now in room — kick off the game
        setTimeout(() => send(host, { type: "host:start", guestId: hostId, roomId }), 200);
        return;
      }
      if (msg.type === "room:error") {
        fail(gameNum, roundsPlayed + 1, `guesser room:error ${msg.code}: ${msg.message}`);
        bothClose();
        return;
      }

      if (msg.type === "game:state") {
        const s = msg.state;
        if (s.phase === "drawing") {
          const guesserIsDrawer = s.drawerId === guesserId;
          if (guesserIsDrawer) {
            if (typeof s.word !== "string" || s.word.length === 0) {
              fail(gameNum, s.roundIndex + 1, "drawer (guesser) state has no word", s);
            } else {
              triggerGuess(s.word, guesserId, s.roundIndex);
            }
          } else {
            // Guesser is non-drawer — must NOT see word
            if (s.word !== null) {
              fail(gameNum, s.roundIndex + 1, `WORD LEAKED to non-drawer guesser: '${s.word}'`);
            }
          }
        }
      }
    });

    host.on("error", (e) => { fail(gameNum, roundsPlayed + 1, `host WS error: ${e.message}`); bothClose(); });
    guesser.on("error", (e) => { fail(gameNum, roundsPlayed + 1, `guesser WS error: ${e.message}`); bothClose(); });
    host.on("close", () => { clearStuck(); resolve({ rounds: roundsPlayed }); });
  });
}

async function main() {
  console.log(`\n=== Draw It Soak — ${GAMES} games via ${URL} ===\n`);
  const t0 = Date.now();
  let totalRounds = 0;
  for (let i = 1; i <= GAMES; i++) {
    const r = await playOne(i);
    totalRounds += r.rounds;
  }
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log("\n=== SUMMARY ===");
  console.log(`Games:    ${GAMES}`);
  console.log(`Rounds:   ${totalRounds}`);
  console.log(`Failures: ${failures.length}`);
  console.log(`Elapsed:  ${elapsed}s`);
  if (failures.length === 0) {
    console.log("\nVERDICT: ✓ Clean — Draw It state machine + word bank passes\n");
    process.exit(0);
  }
  console.log("\nVERDICT: ✗ Bugs found:\n");
  for (const f of failures) {
    console.log(`  G${f.g} R${f.r}: ${f.msg}`);
    if (f.ctx) console.log(`    context: ${JSON.stringify(f.ctx).slice(0, 200)}`);
  }
  process.exit(1);
}
main().catch(e => { console.error(e); process.exit(2); });
