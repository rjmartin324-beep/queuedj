#!/usr/bin/env node
// whalabroad-soak.mjs — Whalabroad end-to-end smoke.
// Connects 1 host + 3 guest sockets, plays a full game from lobby
// commit through resolve_turn cycles, asserts phase transitions and
// score persistence at game_over.
//
// Run: node apps/box/test/whalabroad-soak.mjs --host localhost --port 8080

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

const failures = [];
function fail(msg, ctx) { failures.push({ msg, ctx }); console.log(`  ✗ ${msg}`); if (ctx) console.log("    ctx:", JSON.stringify(ctx).slice(0, 200)); }
function ok(msg) { console.log(`  ✓ ${msg}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function nanoid(n = 10) {
  return Array.from({ length: n }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
}

class Sock {
  constructor(label) { this.label = label; this.guestId = nanoid(); this.states = []; this.last = null; this.events = []; }
  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(URL);
      this.ws.on("open", () => resolve());
      this.ws.on("error", reject);
      this.ws.on("message", buf => {
        let m; try { m = JSON.parse(buf.toString()); } catch { return; }
        if (m.type === "game:state") { this.states.push(m.state); this.last = m.state; }
        else if (m.type === "room:created" || m.type === "room:joined") this.room = m.room;
        else if (m.type === "room:error") this.events.push(m);
        else this.events.push(m);
      });
    });
  }
  send(msg) { this.ws.send(JSON.stringify({ ...msg, guestId: this.guestId })); }
  async waitForState(predicate, timeoutMs = 5000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      if (this.last && predicate(this.last)) return this.last;
      await sleep(80);
    }
    return null;
  }
  close() { this.ws?.close(); }
}

async function run() {
  console.log(`Whalabroad soak — connecting to ${URL}`);

  const host  = new Sock("host");
  const g1 = new Sock("g1");
  const g2 = new Sock("g2");
  const g3 = new Sock("g3");
  const all = [host, g1, g2, g3];
  for (const s of all) await s.connect();
  ok("4 sockets connected");

  // Host creates Whalabroad room.
  host.send({
    type: "room:create",
    displayName: "Host",
    mode: "host_tablet",
    experience: "whalabroad",
  });
  await sleep(200);
  if (!host.room) { fail("host did not get room:created"); return summarize(); }
  const code = host.room.code;
  ok(`room created code=${code}`);

  // 3 guests join.
  for (const [i, g] of [g1, g2, g3].entries()) {
    g.send({ type: "room:join", code, displayName: `Guest${i + 1}` });
  }
  await sleep(300);
  for (const g of [g1, g2, g3]) {
    if (!g.room) { fail(`${g.label} did not join`, g.events); return summarize(); }
  }
  ok("3 guests joined");

  // Host starts the game.
  host.send({ type: "host:start", roomId: host.room.id });
  const lobbyState = await host.waitForState(s => s.phase === "lobby" && Array.isArray(s.scores) && s.scores.length === 4, 3000);
  if (!lobbyState) { fail("did not reach Whalabroad lobby phase"); return summarize(); }
  ok("lobby phase reached");

  // g1 volunteers as whale, then host commits.
  g1.send({ type: "game:action", roomId: host.room.id, action: "whalabroad:volunteer_whale", payload: {} });
  await sleep(150);
  host.send({ type: "game:action", roomId: host.room.id, action: "whalabroad:commit_lobby", payload: {} });

  const revealState = await host.waitForState(s => s.phase === "reveal", 2000);
  if (!revealState) { fail("did not transition to reveal phase"); return summarize(); }
  ok("reveal phase reached");
  if (!revealState.whale) { fail("no whale assigned in reveal state"); return summarize(); }
  if (revealState.whale.guestId !== g1.guestId) {
    // Whale picked from volunteers; if we volunteered g1 alone it must be g1.
    fail(`whale guestId mismatch — expected g1 (${g1.guestId}) got ${revealState.whale.guestId}`);
  } else ok("whale assigned to g1 (volunteer)");
  if (revealState.ships.length !== 3) fail(`expected 3 ships, got ${revealState.ships.length}`);
  else ok(`3 whaler ships spawned`);
  ok(`ringScale = ${revealState.ringScale}, whale HP = ${revealState.whale.hp}`);

  // Server auto-fires the end_reveal timer after 3s; we wait for moving phase.
  const movingState = await host.waitForState(s => s.phase === "moving", 6000);
  if (!movingState) { fail("did not auto-transition to moving phase (timer broken?)"); return summarize(); }
  ok(`auto-timer transitioned reveal → moving (turn ${movingState.turnIndex})`);

  // Submit a few action rounds. Whale tries to ram; ships try to harpoon-when-corpse-or-fire.
  let lastTurn = movingState.turnIndex;
  for (let round = 1; round <= 6; round++) {
    const cur = host.last;
    if (!cur) { fail(`round ${round}: no current state`); break; }
    if (cur.phase === "game_over") { ok(`game ended early at round ${round}`); break; }

    // Whale: submerge for the first 2 turns to satisfy rolling 5-turn min-surface
    // (we get 3 free submerged turns in the first 5), then breach + try to ram.
    const whale = cur.whale;
    if (whale && !whale.dead) {
      const kind = round <= 2 ? "deep_dive" : (round === 3 ? "bubble_move" : "breach");
      g1.send({ type: "game:action", roomId: host.room.id, action: "whalabroad:whale_action",
                payload: { kind, dx: 0, dy: 1, steps: 1 } });
    }
    // Ships: slow_crawl north (toward whale); occasionally fire if cur.whale.surfaced
    for (const g of [g2, g3]) {
      const ship = cur.ships.find(sh => sh.guestId === g.guestId);
      if (!ship || ship.sunk) continue;
      if (whale && whale.surfaced && cur.phase === "moving") {
        g.send({ type: "game:action", roomId: host.room.id, action: "whalabroad:ship_action",
                 payload: { kind: "fire_cannons", side: "starboard", targetX: whale.x, targetY: whale.y } });
      } else {
        g.send({ type: "game:action", roomId: host.room.id, action: "whalabroad:ship_action",
                 payload: { kind: "slow_crawl", dx: 0, dy: -1, steps: 1 } });
      }
    }

    await sleep(150);
    // Host triggers resolve (we don't want to wait for the 30s natural timer).
    host.send({ type: "game:action", roomId: host.room.id, action: "whalabroad:resolve_turn", payload: {} });
    const next = await host.waitForState(s => s.turnIndex > lastTurn || s.phase === "game_over", 3000);
    if (!next) { fail(`round ${round}: turn did not advance`); break; }
    if (next.phase === "game_over") { ok(`game ended at round ${round}`); break; }
    lastTurn = next.turnIndex;
    ok(`round ${round}: turn → ${next.turnIndex}, whale wounds ${next.whale?.wounds ?? "?"}, ships alive ${next.ships.filter(s => !s.sunk).length}`);
  }

  // Host force-ends (covers the persistence path even if natural game continues).
  host.send({ type: "host:force_end", roomId: host.room.id });
  const overState = await host.waitForState(s => s.phase === "game_over", 3000);
  if (!overState) fail("did not reach game_over after force_end");
  else {
    ok("game_over reached");
    if (!Array.isArray(overState.scores)) fail("scores missing on game_over");
    else {
      const nonzero = overState.scores.filter(s => s.score > 0).length;
      ok(`final scoreboard: ${overState.scores.length} entries, ${nonzero} non-zero`);
    }
  }

  for (const s of all) s.close();
  return summarize();
}

function summarize() {
  console.log("");
  console.log("┌──────────────────────────────────────────────────────────");
  if (failures.length === 0) console.log("│ Whalabroad soak: ✓ Clean");
  else {
    console.log(`│ Whalabroad soak: ✗ ${failures.length} failure(s)`);
    for (const f of failures) console.log(`│   - ${f.msg}`);
  }
  console.log("└──────────────────────────────────────────────────────────");
  process.exit(failures.length === 0 ? 0 : 1);
}

run().catch(e => { console.error("soak crashed:", e); process.exit(1); });
