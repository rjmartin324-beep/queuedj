#!/usr/bin/env node
// whalabroad-bots-soak.mjs — 1 host + N bots, plays a Whalabroad game to its
// natural conclusion entirely on bot AI. Verifies:
//   - addBot WS handler works
//   - commitLobby succeeds with bots in passOrder
//   - resolveTurn auto-fills bot actions
//   - game terminates (whale_win, whaler_win, or stalemate) without
//     infinite-looping
//   - score persistence at game_over
//
// Run: node apps/box/test/whalabroad-bots-soak.mjs --host localhost --port 8080

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
const NUM_BOTS = parseInt(args.bots ?? "3", 10);
const MAX_TURNS = parseInt(args.maxTurns ?? "40", 10);

const fails = [];
function fail(msg, ctx) { fails.push(msg); console.log(`  ✗ ${msg}`); if (ctx) console.log("    ctx:", JSON.stringify(ctx).slice(0, 200)); }
function ok(msg) { console.log(`  ✓ ${msg}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function nanoid(n = 10) { return Array.from({ length: n }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join(""); }

class Sock {
  constructor(label) { this.label = label; this.guestId = nanoid(); this.last = null; }
  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(URL);
      this.ws.on("open", resolve);
      this.ws.on("error", reject);
      this.ws.on("message", buf => {
        let m; try { m = JSON.parse(buf.toString()); } catch { return; }
        if (m.type === "game:state") this.last = m.state;
        else if (m.type === "room:created" || m.type === "room:joined") this.room = m.room;
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
  console.log(`Whalabroad bots soak — ${URL}, ${NUM_BOTS} bots`);
  const host = new Sock("host");
  await host.connect();
  ok("host connected");

  host.send({ type: "room:create", displayName: "Solo Host", mode: "host_tablet", experience: "whalabroad" });
  await sleep(200);
  if (!host.room) { fail("room not created"); return summarize(); }
  ok(`room ${host.room.code}`);

  host.send({ type: "host:start", roomId: host.room.id });
  const lobby = await host.waitForState(s => s.phase === "lobby" && Array.isArray(s.scores), 3000);
  if (!lobby) { fail("did not reach lobby"); return summarize(); }
  ok("lobby reached (1 human player)");

  // Add bots.
  for (let i = 0; i < NUM_BOTS; i++) {
    host.send({ type: "game:action", roomId: host.room.id, action: "whalabroad:add_bot", payload: {} });
    await sleep(120);
  }
  const lobbyWithBots = await host.waitForState(s => (s.bots?.length ?? 0) === NUM_BOTS, 2000);
  if (!lobbyWithBots) { fail("bots not added", host.last); return summarize(); }
  ok(`${NUM_BOTS} bots added (total scores=${lobbyWithBots.scores.length})`);

  host.send({ type: "game:action", roomId: host.room.id, action: "whalabroad:commit_lobby", payload: {} });
  const reveal = await host.waitForState(s => s.phase === "reveal", 2000);
  if (!reveal) { fail("did not reach reveal"); return summarize(); }
  ok("reveal phase reached");
  if (!reveal.whale) { fail("no whale assigned"); return summarize(); }

  const moving = await host.waitForState(s => s.phase === "moving", 6000);
  if (!moving) { fail("auto-timer didn't fire reveal→moving"); return summarize(); }
  ok(`moving phase, turn ${moving.turnIndex}`);

  // Resolve turns until game_over OR max-turns.
  let lastTurn = moving.turnIndex;
  let turn = 0;
  while (turn < MAX_TURNS) {
    turn++;
    // If host is the whale (random assignment), submit a pass action so
    // resolveTurn doesn't get blocked. If host is a whaler, same.
    const cur = host.last;
    if (cur?.phase === "game_over") break;
    const isHostWhale = cur?.whale?.guestId === host.guestId;
    if (isHostWhale) {
      host.send({ type: "game:action", roomId: host.room.id, action: "whalabroad:whale_action", payload: { kind: "pass" } });
    } else {
      host.send({ type: "game:action", roomId: host.room.id, action: "whalabroad:ship_action", payload: { kind: "pass" } });
    }
    await sleep(80);

    host.send({ type: "game:action", roomId: host.room.id, action: "whalabroad:resolve_turn", payload: {} });
    const next = await host.waitForState(s => s.turnIndex > lastTurn || s.phase === "game_over", 4000);
    if (!next) { fail(`turn ${turn}: did not advance`); break; }
    if (next.phase === "game_over") {
      ok(`game ended at host-turn ${turn} (server turn ${next.turnIndex})`);
      break;
    }
    lastTurn = next.turnIndex;
    const wHP = next.whale ? `${next.whale.wounds}/${next.whale.hp}` : "?";
    const alive = (next.ships ?? []).filter(s => !s.sunk).length;
    if (turn % 5 === 0) ok(`turn ${turn} → server turn ${next.turnIndex}, whale ${wHP}, ships alive ${alive}`);
  }

  if (turn >= MAX_TURNS && host.last?.phase !== "game_over") {
    fail(`hit MAX_TURNS=${MAX_TURNS} without game_over — possible bot stall`);
  }

  // Force-end if still in progress to verify cleanup path.
  if (host.last?.phase !== "game_over") {
    host.send({ type: "host:force_end", roomId: host.room.id });
    const over = await host.waitForState(s => s.phase === "game_over", 2000);
    if (!over) fail("force_end didn't reach game_over");
    else ok("force_end reached game_over");
  }

  const final = host.last;
  if (final?.scores) {
    const winners = final.scores.filter(s => s.outcome === "win").length;
    ok(`final: ${final.scores.length} entries, ${winners} winners, victor=${winners > 0 ? final.scores.find(s => s.outcome === "win").displayName : "draw"}`);
  }

  host.close();
  return summarize();
}

function summarize() {
  console.log("");
  console.log("┌──────────────────────────────────────────────────────────");
  if (fails.length === 0) console.log("│ Whalabroad bots soak: ✓ Clean");
  else { console.log(`│ Whalabroad bots soak: ✗ ${fails.length} failure(s)`); for (const f of fails) console.log(`│   - ${f}`); }
  console.log("└──────────────────────────────────────────────────────────");
  process.exit(fails.length === 0 ? 0 : 1);
}

run().catch(e => { console.error("crashed:", e); process.exit(1); });
