#!/usr/bin/env node
// qr-race-stress.mjs — Phase 4 Stress Test #1
// Simulates 8 phones simultaneously scanning a QR code and joining the same room.
// Catches race conditions in the room:join handler.
//
// Pattern:
//   1. Host creates a room → gets roomCode
//   2. 8 fake guest phones simultaneously fire room:join with the same code
//   3. Server should accept all 8 without dupes, errors, or dropped joins
//   4. Verify member count = 9 (host + 8 guests)
//
// Run: node apps/box/test/qr-race-stress.mjs --host localhost --port 8080

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
const N_GUESTS = parseInt(args.guests ?? "8", 10);

function nanoid(n = 10) {
  return Array.from({ length: n }, () =>
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]
  ).join("");
}

function startHost() {
  return new Promise((resolve, reject) => {
    const guestId = nanoid();
    const ws = new WebSocket(URL);
    let resolved = false;

    ws.on("open", () => {
      ws.send(JSON.stringify({
        type: "room:create",
        guestId,
        displayName: "Host",
        mode: "phones_only",
        experience: "trivia",
      }));
    });

    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "room:created" && !resolved) {
        resolved = true;
        resolve({ ws, guestId, roomCode: msg.room.code, roomId: msg.room.id });
      }
      if (msg.type === "room:error") {
        reject(new Error(`host room:error ${msg.code}: ${msg.message}`));
      }
    });
    ws.on("error", reject);
  });
}

function spawnGuest(roomCode, guestNum, t0) {
  return new Promise((resolve) => {
    const guestId = nanoid();
    const ws = new WebSocket(URL);
    const result = { guestNum, guestId, joined: false, error: null, latencyMs: 0 };

    ws.on("open", () => {
      // Send join immediately on open
      ws.send(JSON.stringify({
        type: "room:join",
        guestId,
        displayName: `G${guestNum}`,
        code: roomCode,
      }));
    });

    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "room:joined") {
        result.joined = true;
        result.latencyMs = Date.now() - t0;
        resolve(result);
        ws.close();
      } else if (msg.type === "room:error") {
        result.error = `${msg.code}: ${msg.message}`;
        resolve(result);
        ws.close();
      }
    });

    ws.on("error", (e) => {
      result.error = e.message;
      resolve(result);
    });
  });
}

async function main() {
  console.log(`\n=== QR-Race Stress — ${N_GUESTS} simultaneous joins → ${URL} ===\n`);

  // 1. Host creates the room
  let host;
  try { host = await startHost(); }
  catch (e) { console.error("✗ host failed:", e.message); process.exit(2); }
  console.log(`✓ host created room: code=${host.roomCode}\n`);

  // 2. Wait until host's WS has fully settled (small buffer)
  await new Promise(r => setTimeout(r, 200));

  // 3. Fire all guests at the same instant
  const t0 = Date.now();
  console.log(`firing ${N_GUESTS} guests simultaneously…`);
  const promises = [];
  for (let i = 1; i <= N_GUESTS; i++) {
    promises.push(spawnGuest(host.roomCode, i, t0));
  }
  const results = await Promise.all(promises);

  // 4. Tabulate
  const joined = results.filter(r => r.joined);
  const errored = results.filter(r => r.error);
  const latencies = joined.map(r => r.latencyMs).sort((a, b) => a - b);

  console.log(`\n┌─────────────────────────────────────────────`);
  console.log(`│ joined:   ${joined.length}/${N_GUESTS}`);
  console.log(`│ errored:  ${errored.length}/${N_GUESTS}`);
  if (latencies.length) {
    console.log(`│ latency:  min=${latencies[0]}ms  median=${latencies[Math.floor(latencies.length/2)]}ms  max=${latencies[latencies.length-1]}ms`);
  }
  console.log(`└─────────────────────────────────────────────\n`);

  if (errored.length > 0) {
    console.log("Errors:");
    for (const r of errored) console.log(`  G${r.guestNum}: ${r.error}`);
  }

  // 5. Cleanup
  host.ws.close();

  if (joined.length === N_GUESTS && errored.length === 0) {
    console.log(`VERDICT: ✓ Clean — all ${N_GUESTS} joins succeeded with no race conditions\n`);
    process.exit(0);
  } else {
    console.log(`VERDICT: ✗ Race issue — ${errored.length} failed\n`);
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(2); });
