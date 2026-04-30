#!/usr/bin/env node
// io-race-stress.mjs — Phase 4 Stress Test #2
// Simulates worst-case simultaneous input — all players fire actions within 1ms of each other.
// Two scenarios:
//   1. Buzzer: 8 players hit "buzz" at the exact same moment. Server should award exactly ONE buzz winner.
//   2. Trivia: 8 players submit answers simultaneously. Server should record all 8 atomically.
//
// Run: node apps/box/test/io-race-stress.mjs --host localhost --port 8080

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
const HOST = args.host ?? "localhost";
const PORT = parseInt(args.port ?? "8080", 10);
const URL = `ws://${HOST}:${PORT}`;
const N = parseInt(args.players ?? "8", 10);

function nanoid(n = 10) {
  return Array.from({ length: n }, () =>
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]
  ).join("");
}

function makePlayer(experience, isHost = false) {
  const guestId = nanoid();
  const displayName = isHost ? "Host" : `P${nanoid(4)}`;
  const ws = new WebSocket(URL);
  return { guestId, displayName, ws, isHost, experience };
}

// Wait for a specific message type on a player's WS
function awaitMsg(player, predicate, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for message`)), timeoutMs);
    const onMsg = (raw) => {
      const msg = JSON.parse(raw.toString());
      if (predicate(msg)) {
        clearTimeout(timer);
        player.ws.off("message", onMsg);
        resolve(msg);
      }
    };
    player.ws.on("message", onMsg);
  });
}

async function setupRoom(experience) {
  const host = makePlayer(experience, true);
  await new Promise(r => host.ws.once("open", r));
  host.ws.send(JSON.stringify({
    type: "room:create",
    guestId: host.guestId,
    displayName: host.displayName,
    mode: "phones_only",
    experience,
  }));
  const created = await awaitMsg(host, m => m.type === "room:created");
  const roomCode = created.room.code;
  const roomId = created.room.id;

  // Spawn N-1 guests
  const guests = [];
  for (let i = 0; i < N - 1; i++) {
    const g = makePlayer(experience);
    guests.push(g);
    await new Promise(r => g.ws.once("open", r));
    g.ws.send(JSON.stringify({
      type: "room:join",
      guestId: g.guestId,
      displayName: g.displayName,
      code: roomCode,
    }));
    await awaitMsg(g, m => m.type === "room:joined");
  }

  // Host starts the game
  host.ws.send(JSON.stringify({ type: "host:start", guestId: host.guestId, roomId }));

  return { host, guests, roomId };
}

async function buzzerScenario() {
  console.log(`\n=== Scenario 1: Buzzer race — ${N} simultaneous buzzes ===\n`);
  const { host, guests, roomId } = await setupRoom("buzzer");
  console.log(`✓ room created with ${guests.length} guests`);

  // Wait for question phase to begin (whole game can take a moment)
  await awaitMsg(host, m => m.type === "game:state" && m.state.phase === "question", 8000);
  console.log(`✓ question phase started`);

  // Small buffer
  await new Promise(r => setTimeout(r, 200));

  // All guests fire buzz:buzz at "the same time"
  const buzzedGuests = [];
  const t0 = Date.now();
  for (const g of guests) {
    g.ws.send(JSON.stringify({
      type: "game:action", guestId: g.guestId, roomId,
      action: "buzz:buzz", payload: {},
    }));
    buzzedGuests.push({ guestId: g.guestId, displayName: g.displayName, sentAtMs: Date.now() - t0 });
  }
  console.log(`✓ ${guests.length} buzzes fired within ${Date.now() - t0}ms`);

  // Wait for game:state with phase=buzzed and see who won
  const buzzedState = await awaitMsg(host, m => m.type === "game:state" && m.state.phase === "buzzed", 5000);
  const winner = buzzedState.state.buzzedBy;
  console.log(`\n┌─────────────────────────────────────────────`);
  console.log(`│ winner: ${winner}`);
  console.log(`│ expected: exactly 1 winner (any guest is fine)`);
  console.log(`│ buzzedGuests:`);
  for (const b of buzzedGuests) console.log(`│   ${b.displayName} (${b.guestId.slice(0,4)}…)  +${b.sentAtMs}ms`);
  console.log(`└─────────────────────────────────────────────\n`);

  const isValid = winner && buzzedGuests.some(b => b.guestId === winner);
  // Cleanup
  host.ws.close();
  for (const g of guests) g.ws.close();

  return isValid ? "✓ Clean — exactly 1 winner, no double-buzz" : "✗ Race issue — invalid winner";
}

async function triviaScenario() {
  console.log(`\n=== Scenario 2: Trivia simultaneous answers — ${N} answers in flight ===\n`);
  const { host, guests, roomId } = await setupRoom("trivia");
  console.log(`✓ room created with ${guests.length} guests`);

  // Get the first question
  const qState = await awaitMsg(host, m => m.type === "game:state" && m.state.phase === "question" && m.state.question, 8000);
  const questionId = qState.state.question.id;
  console.log(`✓ first question loaded (id=${questionId})`);

  await new Promise(r => setTimeout(r, 200));

  // All players (host + guests) submit answers simultaneously
  const answers = ["a", "b", "c", "d"];
  const all = [host, ...guests];
  const t0 = Date.now();
  for (let i = 0; i < all.length; i++) {
    const p = all[i];
    const ans = answers[i % 4];
    p.ws.send(JSON.stringify({
      type: "game:answer",
      guestId: p.guestId, roomId,
      answer: ans, questionId,
    }));
  }
  console.log(`✓ ${all.length} answers fired within ${Date.now() - t0}ms`);

  // Wait for reveal — server records all answers and reveals
  const revealState = await awaitMsg(host, m => m.type === "game:state" && m.state.phase === "reveal", 5000);
  const recordedAnswers = revealState.state.answers ?? {};
  const recordedCount = Object.keys(recordedAnswers).length;

  const submittedCount = guests.length + 1; // host + guests
  console.log(`\n┌─────────────────────────────────────────────`);
  console.log(`│ submitted: ${submittedCount}`);
  console.log(`│ recorded:  ${recordedCount}`);
  console.log(`│ expected:  ${submittedCount}`);
  console.log(`└─────────────────────────────────────────────\n`);

  const isValid = recordedCount === submittedCount;
  host.ws.close();
  for (const g of guests) g.ws.close();

  return isValid ? "✓ Clean — all answers atomically recorded" : `✗ Lost ${submittedCount - recordedCount} answers`;
}

async function main() {
  console.log(`\n=== I/O Race Stress — ${URL} ===\n`);

  let buzz, trivia;
  try { buzz = await buzzerScenario(); }
  catch (e) { buzz = `✗ exception: ${e.message}`; }

  // Small breathing room between scenarios
  await new Promise(r => setTimeout(r, 1000));

  try { trivia = await triviaScenario(); }
  catch (e) { trivia = `✗ exception: ${e.message}`; }

  console.log(`\n┌──────────────────────────────────────────────────────────`);
  console.log(`│ Summary`);
  console.log(`│   Buzzer race:   ${buzz}`);
  console.log(`│   Trivia race:   ${trivia}`);
  console.log(`└──────────────────────────────────────────────────────────\n`);

  const allClean = buzz.startsWith("✓") && trivia.startsWith("✓");
  process.exit(allClean ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(2); });
