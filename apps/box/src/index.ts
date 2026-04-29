import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { readFileSync, existsSync, appendFileSync } from "fs";
import path from "path";
import type { ClientMessage, ServerMessage } from "./types";
import * as rooms from "./rooms";
import * as trivia from "./games/trivia";
import * as wyr from "./games/wyr";
import * as guesstimate from "./games/guesstimate";
import * as buzzer from "./games/buzzer";
import * as rankit from "./games/rankit";
import * as connections from "./games/connections";
import * as geoguesser from "./games/geoguesser";
import * as thedraft from "./games/thedraft";
import * as draw from "./games/draw";
import * as db from "./db";

const PORT = parseInt(process.env.PORT ?? "8080", 10);
const CLIENT_DIST = process.env.CLIENT_DIST ?? path.join(__dirname, "../../box-client/dist");
const ERROR_LOG = process.env.ERROR_LOG ?? "/sdcard/errors.log";
const MAX_LOG_LINES_RETURN = 500;

// ─── Crash + Error Logging ────────────────────────────────────────────────────

function logEvent(level: "ERROR" | "WARN" | "INFO" | "CLIENT", source: string, msg: string, stack?: string): void {
  const ts = new Date().toISOString();
  const line = stack
    ? `[${ts}] ${level} ${source} :: ${msg}\n${stack}\n`
    : `[${ts}] ${level} ${source} :: ${msg}\n`;
  try { appendFileSync(ERROR_LOG, line); } catch { /* sdcard may not exist in dev */ }
  // Also stream to console so it shows in server.log
  if (level === "ERROR") console.error(line.trim());
  else if (level === "WARN") console.warn(line.trim());
  else console.log(line.trim());
}

process.on("uncaughtException", (err) => {
  logEvent("ERROR", "uncaughtException", err.message, err.stack);
});
process.on("unhandledRejection", (reason: any) => {
  const msg = reason?.message ?? String(reason);
  const stack = reason?.stack;
  logEvent("ERROR", "unhandledRejection", msg, stack);
});

const VALID_ANSWERS = new Set(["a", "b", "c", "d"]);
const VALID_DIFFICULTIES = new Set(["easy", "medium", "hard", "extreme"]);
const BODY_SIZE_LIMIT = 65_536; // 64 KB

// ─── Socket registry — guestId → WebSocket ───────────────────────────────────
const sockets = new Map<string, WebSocket>();

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcast(roomId: string, msg: ServerMessage, excludeGuestId?: string): void {
  const members = rooms.getMembers(roomId);
  for (const m of members) {
    if (m.guestId === excludeGuestId) continue;
    const ws = sockets.get(m.guestId);
    if (ws) send(ws, msg);
  }
}

// Show next trivia question and schedule server-side watchdog to auto-reveal
function showAndBroadcastQuestion(roomId: string): void {
  const q = trivia.showQuestion(roomId);
  if (!q) return;
  broadcast(roomId, { type: "game:state", state: q });
  if (q.deadline) {
    const delay = q.deadline - Date.now() + 1500;
    setTimeout(() => {
      const state = trivia.getState(roomId);
      if (state?.phase === "question") {
        const revealed = trivia.revealAnswers(roomId);
        if (revealed) broadcast(roomId, { type: "game:state", state: revealed });
      }
    }, Math.max(delay, 500));
  }
}

// Draw: send each player their personalized state (drawer sees word, guessers don't)
function broadcastDrawState(roomId: string): void {
  const members = rooms.getMembers(roomId);
  for (const m of members) {
    const ws = sockets.get(m.guestId);
    if (!ws) continue;
    const state = draw.getStateForPlayer(roomId, m.guestId);
    if (state) send(ws, { type: "game:state", state });
  }
}

// Show next WYR prompt and schedule 30s watchdog
function showAndBroadcastPrompt(roomId: string): void {
  const state = wyr.showPrompt(roomId);
  if (!state) return;
  broadcast(roomId, { type: "game:state", state });
  setTimeout(() => {
    const current = wyr.getState(roomId);
    if (current?.phase === "question") {
      const revealed = wyr.revealVotes(roomId);
      if (revealed) broadcast(roomId, { type: "game:state", state: revealed });
    }
  }, 30_000);
}

// ─── HTTP Server ──────────────────────────────────────────────────────────────

const httpServer = createServer((req, res) => {
  // Parse URL once — fixes query-string path mangling and path traversal
  const parsed = new URL(req.url ?? "/", "http://localhost");
  const pathname = parsed.pathname;

  if (pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, ts: Date.now() }));
    return;
  }

  if (pathname === "/api/wyr-prompts" && req.method === "POST") {
    let body = ""; let bytes = 0;
    req.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > BODY_SIZE_LIMIT) { req.destroy(); return; }
      body += chunk;
    });
    req.on("end", () => {
      if (res.headersSent) return;
      try {
        const raw = JSON.parse(body);
        const optionA = (raw.optionA ?? "").toString().trim().slice(0, 200);
        const optionB = (raw.optionB ?? "").toString().trim().slice(0, 200);
        const category = (raw.category ?? "Custom").toString().trim().slice(0, 40) || "Custom";
        if (!optionA || !optionB) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "optionA and optionB required" }));
          return;
        }
        db.seedWYRPrompt(optionA, optionB, category);
        logEvent("INFO", "wyr.custom", `Added custom WYR prompt in [${category}]: ${optionA} / ${optionB}`);
        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
      }
    });
    return;
  }

  if (pathname === "/api/draft-content" && req.method === "POST") {
    let body = ""; let bytes = 0;
    req.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > BODY_SIZE_LIMIT) { req.destroy(); return; }
      body += chunk;
    });
    req.on("end", () => {
      if (res.headersSent) return;
      try {
        const raw = JSON.parse(body);
        const gameType = (raw.gameType ?? "").toString().trim().slice(0, 40);
        const payload = raw.payload ?? null;
        if (!gameType || !payload) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "gameType and payload required" }));
          return;
        }
        // Drafts are captured to /sdcard/errors.log via logEvent so they
        // can be batch-promoted to seed JSON later.
        logEvent("INFO", `draft.${gameType}`, `Custom ${gameType}: ${JSON.stringify(payload).slice(0, 1500)}`);
        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
      }
    });
    return;
  }

  if (pathname === "/api/log" && req.method === "POST") {
    let body = "";
    let bytes = 0;
    req.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > BODY_SIZE_LIMIT) { req.destroy(); return; }
      body += chunk;
    });
    req.on("end", () => {
      if (res.headersSent) return;
      try {
        const e = JSON.parse(body);
        const level = (e.level === "ERROR" || e.level === "WARN") ? e.level : "CLIENT";
        const where = (e.where ?? "client").toString().slice(0, 60);
        const message = (e.message ?? "").toString().slice(0, 1000);
        const stack = e.stack ? e.stack.toString().slice(0, 4000) : undefined;
        const ua = (e.ua ?? "").toString().slice(0, 200);
        logEvent(level as any, `client/${where}`, `${message} | UA=${ua}`, stack);
        res.writeHead(204); res.end();
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
      }
    });
    return;
  }

  if (pathname === "/api/logs") {
    try {
      const data = readFileSync(ERROR_LOG, "utf8");
      const lines = data.split("\n").slice(-MAX_LOG_LINES_RETURN).join("\n");
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(lines || "(empty)");
    } catch {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("(no log file yet)");
    }
    return;
  }

  if (pathname === "/admin/logs") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PartyGlue Box — Logs</title>
<style>
  body{margin:0;background:#0f0f1a;color:#e8e8f0;font:14px/1.5 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;padding:14px}
  h1{font-size:18px;margin:0 0 12px;color:#f6c842;letter-spacing:.05em}
  .bar{display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap}
  button{background:#1f1f33;color:#e8e8f0;border:1px solid #333;border-radius:8px;padding:8px 14px;cursor:pointer;font-size:13px}
  button.primary{background:#f6c842;color:#1a1a2e;border-color:#f6c842;font-weight:700}
  pre{background:#0a0a14;border:1px solid #222;border-radius:8px;padding:12px;overflow:auto;white-space:pre-wrap;word-break:break-word;font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;max-height:80vh}
  .err{color:#ff8585}.warn{color:#f6c842}.info{color:#9ad}
</style></head><body>
<h1>PartyGlue Box — Errors &amp; Events</h1>
<div class="bar">
  <button class="primary" onclick="load()">Refresh</button>
  <label><input type="checkbox" id="auto" checked> auto every 5s</label>
  <span id="status" style="color:#888"></span>
</div>
<pre id="log">loading…</pre>
<script>
const el=document.getElementById('log'),st=document.getElementById('status');
function colorize(t){return t
  .replace(/(\\bERROR\\b)/g,'<span class="err">$1</span>')
  .replace(/(\\bWARN\\b)/g,'<span class="warn">$1</span>')
  .replace(/(\\bINFO\\b|\\bCLIENT\\b)/g,'<span class="info">$1</span>');}
async function load(){
  try{ const r=await fetch('/api/logs'); const t=await r.text(); el.innerHTML=colorize(t); st.textContent='updated '+new Date().toLocaleTimeString(); window.scrollTo(0,document.body.scrollHeight);}
  catch(e){ st.textContent='fetch failed: '+e; }
}
load();
setInterval(()=>{ if(document.getElementById('auto').checked) load(); },5000);
</script></body></html>`);
    return;
  }

  if (pathname === "/api/scores") {
    const scores = db.getLeaderboard(20);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ scores }));
    return;
  }

  if (pathname === "/api/questions/counts") {
    const counts = db.triviaQuestionCountByCategory();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ counts }));
    return;
  }

  if (pathname === "/api/questions" && req.method === "POST") {
    let body = "";
    let bytes = 0;
    req.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > BODY_SIZE_LIMIT) {
        req.destroy();
        if (!res.headersSent) {
          res.writeHead(413, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Request too large" }));
        }
        return;
      }
      body += chunk;
    });
    req.on("end", () => {
      if (res.headersSent) return;
      try {
        const raw = JSON.parse(body);
        const question = (raw.question ?? "").toString().trim().slice(0, 300);
        const a = (raw.a ?? "").toString().trim().slice(0, 150);
        const b = (raw.b ?? "").toString().trim().slice(0, 150);
        const c = (raw.c ?? "").toString().trim().slice(0, 150);
        const d = (raw.d ?? "").toString().trim().slice(0, 150);
        const correct = (raw.correct ?? "").toString().toLowerCase();
        const difficulty = (raw.difficulty ?? "medium").toString().toLowerCase();

        if (!question || !a || !b || !c || !d) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "All fields required" }));
          return;
        }
        if (!VALID_ANSWERS.has(correct)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "correct must be a, b, c, or d" }));
          return;
        }
        if (!VALID_DIFFICULTIES.has(difficulty)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "difficulty must be easy, medium, hard, or extreme" }));
          return;
        }
        db.addCustomQuestion({ category: "Custom", question, a, b, c, d, correct: correct as any, difficulty: difficulty as any });
        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
      }
    });
    return;
  }

  const clientBuilt = existsSync(CLIENT_DIST);
  if (!clientBuilt) {
    res.writeHead(503, { "Content-Type": "text/plain" });
    res.end("box-client not built yet — run: npm run build --workspace=apps/box-client");
    return;
  }

  let filePath = path.join(CLIENT_DIST, pathname === "/" ? "index.html" : pathname);
  if (!existsSync(filePath)) filePath = path.join(CLIENT_DIST, "index.html");

  // Path traversal guard — resolved path must stay inside CLIENT_DIST
  const distResolved = path.resolve(CLIENT_DIST);
  const fileResolved = path.resolve(filePath);
  if (!fileResolved.startsWith(distResolved + path.sep) && fileResolved !== path.join(distResolved, "index.html")) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  const ext = path.extname(filePath);
  const mimeTypes: Record<string, string> = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
  };
  const mime = mimeTypes[ext] ?? "application/octet-stream";

  try {
    const data = readFileSync(filePath);
    res.writeHead(200, {
      "Content-Type": mime,
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});

// ─── WebSocket Server ─────────────────────────────────────────────────────────

const wss = new WebSocketServer({ server: httpServer, perMessageDeflate: false });

wss.on("connection", (ws, req) => {
  const remote = req.socket.remoteAddress ?? "?";
  console.log(`[ws] connection from ${remote}`);
  let connectedGuestId: string | null = null;
  let connectedRoomId: string | null = null;

  ws.on("error", (err) => {
    logEvent("WARN", "ws.socket", err.message, err.stack);
  });

  ws.on("message", (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString()) as ClientMessage;
    } catch {
      return;
    }
    try {

    if (msg.type === "ping") {
      send(ws, { type: "pong" });
      return;
    }

    // Identity binding — first message that carries a guestId wins this socket.
    // Any later message MUST match. Rejecting mismatches blocks host-impersonation
    // attacks where a peer guesses another player's guestId.
    if ("guestId" in msg && msg.guestId) {
      if (connectedGuestId === null) {
        const prev = sockets.get(msg.guestId);
        if (prev && prev !== ws) prev.close(1001, "superseded");
        sockets.set(msg.guestId, ws);
        connectedGuestId = msg.guestId;
      } else if (msg.guestId !== connectedGuestId) {
        send(ws, { type: "room:error", code: "IDENTITY_MISMATCH", message: "guestId on this socket can't change" });
        return;
      }
    }

    switch (msg.type) {
      case "room:create": {
        const result = rooms.createRoom(msg.guestId, msg.displayName, msg.mode, msg.experience);
        connectedRoomId = result.room.id;
        // Mode 3 (Phone Host): mint a one-time host-transfer token so the tablet can show a "take
        // control on your phone" QR. Token is consumed when the phone calls host:claim_transfer.
        const transferToken = msg.mode === "phones_only"
          ? rooms.generateTransferToken(result.room.id) ?? undefined
          : undefined;
        console.log(`[ws] room:create code=${result.room.code} host=${msg.guestId} exp=${msg.experience} mode=${msg.mode}${transferToken ? " transferToken=issued" : ""}`);
        send(ws, {
          type: "room:created",
          room: result.room,
          you: result.host,
          members: rooms.getMembers(result.room.id),
          transferToken,
        });
        break;
      }

      case "room:join": {
        const result = rooms.joinRoom(msg.code, msg.guestId, msg.displayName);
        if ("error" in result) console.log(`[ws] room:join FAILED code=${msg.code} guest=${msg.guestId} err=${result.error}`);
        else console.log(`[ws] room:join OK code=${msg.code} guest=${msg.guestId} name=${msg.displayName}`);
        if ("error" in result) {
          send(ws, { type: "room:error", code: result.error, message: friendlyError(result.error) });
          return;
        }
        connectedRoomId = result.room.id;
        send(ws, { type: "room:joined", room: result.room, you: result.member, members: rooms.getMembers(result.room.id) });
        broadcast(result.room.id, { type: "room:member_joined", member: result.member }, msg.guestId);

        const exp = result.room.experience;
        const gameState =
          trivia.getState(result.room.id) ??
          wyr.getState(result.room.id) ??
          guesstimate.getState(result.room.id) ??
          buzzer.getState(result.room.id) ??
          rankit.getState(result.room.id) ??
          connections.getState(result.room.id) ??
          geoguesser.getState(result.room.id) ??
          thedraft.getState(result.room.id);
        if (gameState) { send(ws, { type: "game:state", state: gameState }); break; }
        if (exp === "draw") {
          const ds = draw.getStateForPlayer(result.room.id, msg.guestId);
          if (ds) send(ws, { type: "game:state", state: ds });
        }
        break;
      }

      case "room:leave": {
        const leavingRoom = rooms.findRoom(msg.roomId);
        rooms.leaveRoom(msg.roomId, msg.guestId);
        connectedRoomId = null;
        if (leavingRoom && leavingRoom.hostGuestId === msg.guestId) {
          broadcast(msg.roomId, { type: "room:closed" });
          rooms.closeRoom(msg.roomId);
          trivia.cleanup(msg.roomId); wyr.cleanup(msg.roomId);
          guesstimate.cleanup(msg.roomId); buzzer.cleanup(msg.roomId);
          rankit.cleanup(msg.roomId); connections.cleanup(msg.roomId);
          geoguesser.cleanup(msg.roomId); thedraft.cleanup(msg.roomId);
          draw.cleanup(msg.roomId);
        } else {
          broadcast(msg.roomId, { type: "room:member_left", guestId: msg.guestId });
        }
        break;
      }

      case "host:start": {
        const room = rooms.findRoom(msg.roomId);
        if (!room || room.hostGuestId !== msg.guestId) {
          send(ws, { type: "room:error", code: "UNAUTHORIZED", message: "Only the host can start" });
          return;
        }
        rooms.startRoom(msg.roomId);

        if (room.experience === "trivia") {
          // Guard: refuse start if question bank is empty
          if (db.triviaQuestionCount() === 0) {
            send(ws, { type: "room:error", code: "NO_QUESTIONS", message: "Question bank is empty — run: npm run seed" });
            return;
          }
          const members = rooms.getMembers(msg.roomId);
          const state = trivia.startGame(msg.roomId, room.mode, msg.tournament === true, members);
          broadcast(msg.roomId, { type: "room:phase_changed", phase: "playing" });
          broadcast(msg.roomId, { type: "game:state", state });
          setTimeout(() => showAndBroadcastQuestion(msg.roomId), 1000);

        } else if (room.experience === "wyr") {
          // Guard: refuse start if WYR prompts are empty
          if (db.wyrPromptCount() === 0) {
            send(ws, { type: "room:error", code: "NO_PROMPTS", message: "WYR prompts are empty — run: npm run seed:wyr" });
            return;
          }
          const members = rooms.getMembers(msg.roomId);
          const state = wyr.startGame(msg.roomId, room.mode, members);
          broadcast(msg.roomId, { type: "room:phase_changed", phase: "playing" });
          broadcast(msg.roomId, { type: "game:state", state });
          setTimeout(() => showAndBroadcastPrompt(msg.roomId), 1000);

        } else if (room.experience === "guesstimate") {
          const members = rooms.getMembers(msg.roomId);
          const state = guesstimate.startGame(msg.roomId, room.mode, members);
          broadcast(msg.roomId, { type: "room:phase_changed", phase: "playing" });
          broadcast(msg.roomId, { type: "game:state", state });
          setTimeout(() => { const s = guesstimate.showQuestion(msg.roomId); if (s) broadcast(msg.roomId, { type: "game:state", state: s }); }, 1000);

        } else if (room.experience === "buzzer") {
          if (db.triviaQuestionCount() === 0) { send(ws, { type: "room:error", code: "NO_QUESTIONS", message: "Question bank empty — run: npm run seed" }); return; }
          const members = rooms.getMembers(msg.roomId);
          const state = buzzer.startGame(msg.roomId, room.mode, members);
          broadcast(msg.roomId, { type: "room:phase_changed", phase: "playing" });
          broadcast(msg.roomId, { type: "game:state", state });
          setTimeout(() => { const s = buzzer.showQuestion(msg.roomId); if (s) broadcast(msg.roomId, { type: "game:state", state: s }); }, 1000);

        } else if (room.experience === "rankit") {
          const members = rooms.getMembers(msg.roomId);
          const state = rankit.startGame(msg.roomId, room.mode, members);
          broadcast(msg.roomId, { type: "room:phase_changed", phase: "playing" });
          broadcast(msg.roomId, { type: "game:state", state });
          setTimeout(() => { const s = rankit.showChallenge(msg.roomId); if (s) broadcast(msg.roomId, { type: "game:state", state: s }); }, 1000);

        } else if (room.experience === "connections") {
          const members = rooms.getMembers(msg.roomId);
          const state = connections.startGame(msg.roomId, room.mode, members);
          broadcast(msg.roomId, { type: "room:phase_changed", phase: "playing" });
          broadcast(msg.roomId, { type: "game:state", state });

        } else if (room.experience === "geoguesser") {
          const members = rooms.getMembers(msg.roomId);
          const state = geoguesser.startGame(msg.roomId, room.mode, members);
          broadcast(msg.roomId, { type: "room:phase_changed", phase: "playing" });
          broadcast(msg.roomId, { type: "game:state", state });
          setTimeout(() => { const s = geoguesser.showQuestion(msg.roomId); if (s) broadcast(msg.roomId, { type: "game:state", state: s }); }, 1000);

        } else if (room.experience === "thedraft") {
          const members = rooms.getMembers(msg.roomId);
          const state = thedraft.startGame(msg.roomId, room.mode, members);
          broadcast(msg.roomId, { type: "room:phase_changed", phase: "playing" });
          broadcast(msg.roomId, { type: "game:state", state });

        } else if (room.experience === "draw") {
          const members = rooms.getMembers(msg.roomId);
          const state = draw.startGame(msg.roomId, room.mode, members);
          broadcast(msg.roomId, { type: "room:phase_changed", phase: "playing" });
          broadcastDrawState(msg.roomId);

        } else {
          broadcast(msg.roomId, { type: "room:phase_changed", phase: rooms.findRoom(msg.roomId)!.phase });
        }
        break;
      }

      case "host:next_question": {
        const room = rooms.findRoom(msg.roomId);
        if (!room || room.hostGuestId !== msg.guestId) {
          send(ws, { type: "room:error", code: "UNAUTHORIZED", message: "Only the host can advance" });
          return;
        }
        if (room.experience === "trivia") {
          const currentState = trivia.getState(msg.roomId);
          if (currentState?.phase === "round_end") {
            currentState.phase = "countdown";
            broadcast(msg.roomId, { type: "game:state", state: currentState });
            setTimeout(() => showAndBroadcastQuestion(msg.roomId), 1000);
            break;
          }
          const result = trivia.advance(msg.roomId);
          if (!result) break;
          broadcast(msg.roomId, { type: "game:state", state: result.state });
          if (!result.done && !result.roundOver) setTimeout(() => showAndBroadcastQuestion(msg.roomId), 1000);
          if (result.done) rooms.endRound(msg.roomId);
        } else if (room.experience === "guesstimate") {
          const result = guesstimate.advance(msg.roomId);
          if (!result) break;
          broadcast(msg.roomId, { type: "game:state", state: result.state });
          if (!result.done) setTimeout(() => { const s = guesstimate.showQuestion(msg.roomId); if (s) broadcast(msg.roomId, { type: "game:state", state: s }); }, 1000);
          else rooms.endRound(msg.roomId);
        } else if (room.experience === "buzzer") {
          const result = buzzer.advance(msg.roomId);
          if (!result) break;
          broadcast(msg.roomId, { type: "game:state", state: result.state });
          if (!result.done) setTimeout(() => { const s = buzzer.showQuestion(msg.roomId); if (s) broadcast(msg.roomId, { type: "game:state", state: s }); }, 1000);
          else rooms.endRound(msg.roomId);
        } else if (room.experience === "rankit") {
          const result = rankit.advance(msg.roomId);
          if (!result) break;
          broadcast(msg.roomId, { type: "game:state", state: result.state });
          if (!result.done) setTimeout(() => { const s = rankit.showChallenge(msg.roomId); if (s) broadcast(msg.roomId, { type: "game:state", state: s }); }, 1000);
          else rooms.endRound(msg.roomId);
        } else if (room.experience === "connections") {
          const s = connections.endGame(msg.roomId);
          if (s) { broadcast(msg.roomId, { type: "game:state", state: s }); rooms.endRound(msg.roomId); }
        } else if (room.experience === "geoguesser") {
          const result = geoguesser.advance(msg.roomId);
          if (!result) break;
          broadcast(msg.roomId, { type: "game:state", state: result.state });
          if (!result.done) setTimeout(() => { const s = geoguesser.showQuestion(msg.roomId); if (s) broadcast(msg.roomId, { type: "game:state", state: s }); }, 1000);
          else rooms.endRound(msg.roomId);
        } else if (room.experience === "thedraft") {
          const s = thedraft.endGame(msg.roomId);
          if (s) { broadcast(msg.roomId, { type: "game:state", state: s }); rooms.endRound(msg.roomId); }
        } else if (room.experience === "draw") {
          const result = draw.advance(msg.roomId);
          if (!result) break;
          if (result.done) { rooms.endRound(msg.roomId); broadcast(msg.roomId, { type: "game:state", state: result.state }); }
          else broadcastDrawState(msg.roomId);
        }
        break;
      }

      case "host:pick_category": {
        const room = rooms.findRoom(msg.roomId);
        if (!room || room.hostGuestId !== msg.guestId) {
          send(ws, { type: "room:error", code: "UNAUTHORIZED", message: "Only the host can pick" });
          return;
        }
        if (room.experience === "trivia") {
          const state = trivia.pickCategory(msg.roomId, msg.category);
          if (state) broadcast(msg.roomId, { type: "game:state", state });
        }
        break;
      }

      case "host:claim_transfer": {
        const room = rooms.findRoom(msg.roomId);
        if (!room) {
          send(ws, { type: "room:error", code: "ROOM_NOT_FOUND", message: "Room is gone" });
          return;
        }
        if (room.phase !== "lobby") {
          send(ws, { type: "room:error", code: "TRANSFER_TOO_LATE", message: "Game already started" });
          return;
        }
        if (!rooms.consumeTransferToken(msg.roomId, msg.token)) {
          send(ws, { type: "room:error", code: "INVALID_TOKEN", message: "Bad or expired transfer token" });
          return;
        }
        const oldHostGuestId = room.hostGuestId;
        const result = rooms.transferHost(msg.roomId, msg.guestId, oldHostGuestId);
        if (!result) {
          send(ws, { type: "room:error", code: "TRANSFER_FAILED", message: "Host transfer failed" });
          return;
        }
        console.log(`[ws] host:transferred ${oldHostGuestId} → ${msg.guestId} room=${msg.roomId}`);
        broadcast(msg.roomId, {
          type: "host:transferred",
          room: result.room,
          members: result.members,
          oldHostGuestId,
          newHostGuestId: msg.guestId,
        });
        break;
      }

      case "game:answer": {
        const room = rooms.findRoom(msg.roomId);
        if (!room) break;
        if (room.experience === "trivia") {
          const result = trivia.submitAnswer(msg.roomId, msg.guestId, msg.answer);
          if (!result) break;
          const state = result.state;

          // Use CURRENT room members (not state.scores, which can include departed players)
          // intersected with non-eliminated. If a member left mid-question, allAnswered fires
          // as soon as the remaining present non-eliminated players have all submitted.
          const memberIds = rooms.getMembers(msg.roomId).map(m => m.guestId);
          const eliminated = new Set(state.scores.filter(s => s.eliminated).map(s => s.guestId));
          const activeRequired = memberIds.filter(id => !eliminated.has(id));
          const allAnswered = activeRequired.length > 0 && activeRequired.every(id => state.answers[id]);

          if (state.mode === "pass_tablet") {
            const memberSet = new Set(memberIds);
            const activePlayers = state.passOrder.filter(id =>
              !eliminated.has(id) && memberSet.has(id)
            );
            const allPassDone = activePlayers.every(id => state.answers[id]);
            if (!allPassDone) {
              trivia.nextPassTurn(msg.roomId);
              broadcast(msg.roomId, { type: "game:state", state: trivia.getState(msg.roomId)! });
            } else {
              const revealed = trivia.revealAnswers(msg.roomId);
              if (revealed) broadcast(msg.roomId, { type: "game:state", state: revealed });
            }
          } else {
            const sanitized = { ...state, answers: Object.fromEntries(Object.keys(state.answers).map(k => [k, "answered"])) };
            broadcast(msg.roomId, { type: "game:state", state: sanitized });
            if (allAnswered) {
              const revealed = trivia.revealAnswers(msg.roomId);
              if (revealed) broadcast(msg.roomId, { type: "game:state", state: revealed });
            }
          }
        }
        break;
      }

      case "game:action": {
        const room = rooms.findRoom(msg.roomId);
        if (!room) break;

        if (room.experience === "wyr") {
          const action = msg.action;
          const payload = msg.payload as any;

          if (action === "wyr:vote") {
            const vote = payload?.vote;
            if (vote !== "a" && vote !== "b") break;
            const result = wyr.submitVote(msg.roomId, msg.guestId, vote);
            if (!result) break;

            // Use current room members, not stale scores list
            const activeIds = rooms.getMembers(msg.roomId).map(m => m.guestId);
            const allVoted = activeIds.length > 0 && activeIds.every(id => result.state.votes[id]);

            if (result.state.mode === "pass_tablet") {
              if (!allVoted) {
                wyr.nextPassTurn(msg.roomId);
                broadcast(msg.roomId, { type: "game:state", state: wyr.getState(msg.roomId)! });
              } else {
                const revealed = wyr.revealVotes(msg.roomId);
                if (revealed) broadcast(msg.roomId, { type: "game:state", state: revealed });
              }
            } else {
              const maskedState = { ...result.state, votes: Object.fromEntries(Object.keys(result.state.votes).map(k => [k, "voted"])) };
              broadcast(msg.roomId, { type: "game:state", state: maskedState });
              if (allVoted) {
                const revealed = wyr.revealVotes(msg.roomId);
                if (revealed) broadcast(msg.roomId, { type: "game:state", state: revealed });
              }
            }

          } else if (action === "wyr:next") {
            if (room.hostGuestId !== msg.guestId) break;
            const result = wyr.advance(msg.roomId);
            if (!result) break;
            broadcast(msg.roomId, { type: "game:state", state: result.state });
            if (!result.done) {
              setTimeout(() => showAndBroadcastPrompt(msg.roomId), 1000);
            } else {
              rooms.endRound(msg.roomId);
            }
          }
        } else if (room.experience === "guesstimate") {
          if (msg.action === "guess:submit") {
            const guess = Number((msg.payload as any)?.guess);
            if (isNaN(guess)) break;
            const state = guesstimate.submitGuess(msg.roomId, msg.guestId, guess);
            if (!state) break;
            const activeIds = rooms.getMembers(msg.roomId).map(m => m.guestId);
            const allGuessed = activeIds.every(id => state.guesses[id] !== undefined);
            const masked = { ...state, guesses: Object.fromEntries(Object.keys(state.guesses).map(k => [k, "guessed"])) };
            broadcast(msg.roomId, { type: "game:state", state: masked });
            if (allGuessed) { const revealed = guesstimate.revealGuesses(msg.roomId); if (revealed) broadcast(msg.roomId, { type: "game:state", state: revealed }); }
          }
        } else if (room.experience === "buzzer") {
          if (msg.action === "buzz:buzz") {
            const state = buzzer.buzz(msg.roomId, msg.guestId);
            if (state) broadcast(msg.roomId, { type: "game:state", state });
          } else if (msg.action === "buzz:answer") {
            const answer = (msg.payload as any)?.answer as string;
            if (!["a","b","c","d"].includes(answer)) break;
            const state = buzzer.submitAnswer(msg.roomId, msg.guestId, answer as any);
            if (state) broadcast(msg.roomId, { type: "game:state", state });
          }
        } else if (room.experience === "rankit") {
          if (msg.action === "rank:submit") {
            const order = (msg.payload as any)?.order as string[];
            if (!Array.isArray(order)) break;
            const state = rankit.submitRanking(msg.roomId, msg.guestId, order);
            if (!state) break;
            const activeIds = rooms.getMembers(msg.roomId).map(m => m.guestId);
            const allDone = activeIds.every(id => state.submissions[id]);
            broadcast(msg.roomId, { type: "game:state", state: { ...state, submissions: Object.fromEntries(Object.keys(state.submissions).map(k => [k, "submitted"])) } });
            if (allDone) { const revealed = rankit.revealResults(msg.roomId); if (revealed) broadcast(msg.roomId, { type: "game:state", state: revealed }); }
          }
        } else if (room.experience === "connections") {
          if (msg.action === "conn:submit") {
            const tiles = (msg.payload as any)?.tiles as string[];
            if (!Array.isArray(tiles) || tiles.length !== 4) break;
            const result = connections.submitGroup(msg.roomId, msg.guestId, tiles);
            if (!result) break;
            const state = connections.getState(msg.roomId)!;
            // Send result event to submitter + broadcast state
            send(ws, { type: "game:event", event: "conn:result", payload: { correct: result.correct, color: result.color } });
            broadcast(msg.roomId, { type: "game:state", state });
          } else if (msg.action === "conn:reveal" && room.hostGuestId === msg.guestId) {
            const state = connections.forceReveal(msg.roomId);
            if (state) broadcast(msg.roomId, { type: "game:state", state });
          }
        } else if (room.experience === "geoguesser") {
          if (msg.action === "geo:pin") {
            const lat = Number((msg.payload as any)?.lat);
            const lng = Number((msg.payload as any)?.lng);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) break;
            const state = geoguesser.submitPin(msg.roomId, msg.guestId, lat, lng);
            if (!state) break;
            const activeIds = rooms.getMembers(msg.roomId).map(m => m.guestId);
            const allPinned = activeIds.every(id => state.pins[id]);
            // Mask others' pins until reveal
            const masked = { ...state, pins: Object.fromEntries(Object.keys(state.pins).map(k => [k, "pinned"])) };
            broadcast(msg.roomId, { type: "game:state", state: masked });
            if (allPinned) {
              const revealed = geoguesser.revealAnswers(msg.roomId);
              if (revealed) broadcast(msg.roomId, { type: "game:state", state: revealed });
            }
          } else if (msg.action === "geo:answer") {
            // legacy text-clue path — still tolerated but no-op
            geoguesser.submitAnswer(msg.roomId, msg.guestId, (msg.payload as any)?.answer ?? "");
          }
        } else if (room.experience === "thedraft") {
          if (msg.action === "draft:pick") {
            const itemId = (msg.payload as any)?.itemId as string;
            if (!itemId) break;
            const state = thedraft.pickItem(msg.roomId, msg.guestId, itemId);
            if (state) broadcast(msg.roomId, { type: "game:state", state });
          } else if (msg.action === "draft:custom_pick") {
            const name = (msg.payload as any)?.name as string;
            if (!name) break;
            const state = thedraft.pickCustom(msg.roomId, msg.guestId, name);
            if (state) broadcast(msg.roomId, { type: "game:state", state });
          }
        } else if (room.experience === "draw") {
          // Drawer-only actions: stroke + clear. Anyone-can guess.
          const drawState = draw.getState(msg.roomId);
          const isDrawer = drawState?.drawerId === msg.guestId;
          if ((msg.action === "draw:stroke" || msg.action === "draw:clear") && !isDrawer) {
            send(ws, { type: "room:error", code: "NOT_DRAWER", message: "Only the current drawer can do that" });
            break;
          }
          if (msg.action === "draw:stroke") {
            // Broadcast stroke to everyone except the drawer (drawer already sees it locally)
            broadcast(msg.roomId, { type: "game:event", event: "draw:stroke", payload: msg.payload }, msg.guestId);
          } else if (msg.action === "draw:clear") {
            broadcast(msg.roomId, { type: "game:event", event: "draw:clear", payload: {} });
          } else if (msg.action === "draw:guess") {
            const guess = ((msg.payload as any)?.guess ?? "").toString().trim();
            if (!guess) break;
            const result = draw.submitGuess(msg.roomId, msg.guestId, guess);
            if (!result) break;
            if (result.correct) {
              broadcast(msg.roomId, { type: "game:event", event: "draw:correct_guess", payload: { guestId: msg.guestId, displayName: rooms.getMembers(msg.roomId).find(m => m.guestId === msg.guestId)?.displayName ?? "?" } });
              broadcast(msg.roomId, { type: "game:state", state: result.state });
            } else {
              broadcast(msg.roomId, { type: "game:event", event: "draw:wrong_guess", payload: { guestId: msg.guestId, guess } });
            }
          } else if (msg.action === "draw:reveal" && room.hostGuestId === msg.guestId) {
            const state = draw.revealRound(msg.roomId);
            if (state) broadcast(msg.roomId, { type: "game:state", state });
          }
        } else {
          broadcast(msg.roomId, { type: "game:event", event: msg.action, payload: msg.payload });
        }
        break;
      }

      case "host:end_round": {
        const room = rooms.findRoom(msg.roomId);
        if (!room || room.hostGuestId !== msg.guestId) {
          send(ws, { type: "room:error", code: "UNAUTHORIZED", message: "Only the host can end the round" });
          return;
        }
        if (room.experience === "trivia") {
          const state = trivia.getState(msg.roomId);
          if (state?.phase === "question") {
            const revealed = trivia.revealAnswers(msg.roomId);
            if (revealed) broadcast(msg.roomId, { type: "game:state", state: revealed });
          }
        } else if (room.experience === "wyr") {
          const state = wyr.getState(msg.roomId);
          if (state?.phase === "question") {
            const revealed = wyr.revealVotes(msg.roomId);
            if (revealed) broadcast(msg.roomId, { type: "game:state", state: revealed });
          }
        } else if (room.experience === "guesstimate") {
          const s = guesstimate.getState(msg.roomId);
          if (s?.phase === "question") { const r = guesstimate.revealGuesses(msg.roomId); if (r) broadcast(msg.roomId, { type: "game:state", state: r }); }
        } else if (room.experience === "buzzer") {
          const s = buzzer.getState(msg.roomId);
          if (s?.phase === "question" || s?.phase === "buzzed") { const r = buzzer.revealAnswers(msg.roomId); if (r) broadcast(msg.roomId, { type: "game:state", state: r }); }
        } else if (room.experience === "rankit") {
          const s = rankit.getState(msg.roomId);
          if (s?.phase === "question") { const r = rankit.revealResults(msg.roomId); if (r) broadcast(msg.roomId, { type: "game:state", state: r }); }
        } else if (room.experience === "connections") {
          const s = connections.forceReveal(msg.roomId);
          if (s) broadcast(msg.roomId, { type: "game:state", state: s });
        } else if (room.experience === "geoguesser") {
          const s = geoguesser.getState(msg.roomId);
          if (s?.phase === "question") {
            const r = geoguesser.revealAnswers(msg.roomId);
            if (r) broadcast(msg.roomId, { type: "game:state", state: r });
          }
        } else if (room.experience === "draw") {
          const s = draw.revealRound(msg.roomId);
          if (s) broadcastDrawState(msg.roomId);
        } else {
          rooms.endRound(msg.roomId);
          broadcast(msg.roomId, { type: "room:phase_changed", phase: "results" });
        }
        break;
      }

      case "host:force_end": {
        const room = rooms.findRoom(msg.roomId);
        if (!room || room.hostGuestId !== msg.guestId) {
          send(ws, { type: "room:error", code: "UNAUTHORIZED", message: "Only the host can end the game" });
          return;
        }
        console.log(`[ws] host:force_end room=${room.code} exp=${room.experience}`);
        // For each game, jump to game_over preserving current scores AND persist
        // the leaderboard rows for Trivia + WYR.
        const setGameOver = (s: any) => { if (s) { s.phase = "game_over"; broadcast(msg.roomId, { type: "game:state", state: s }); } };
        if (room.experience === "trivia") {
          const s = trivia.getState(msg.roomId);
          if (s) {
            s.phase = "game_over";
            db.persistScores(s.sessionId, s.scores.map(x => ({
              guestId: x.guestId, displayName: x.displayName, score: x.score,
              correct: x.correct, wrong: x.wrong,
            })));
            broadcast(msg.roomId, { type: "game:state", state: s });
          }
        } else if (room.experience === "wyr") {
          const s = wyr.getState(msg.roomId);
          if (s) {
            s.phase = "game_over";
            db.persistScores(s.sessionId, s.scores.map(x => ({
              guestId: x.guestId, displayName: x.displayName, score: x.score,
              correct: (x as any).bold ?? 0, wrong: (x as any).safe ?? 0,
            })));
            broadcast(msg.roomId, { type: "game:state", state: s });
          }
        }
        else if (room.experience === "guesstimate")  setGameOver(guesstimate.getState(msg.roomId));
        else if (room.experience === "buzzer")       setGameOver(buzzer.getState(msg.roomId));
        else if (room.experience === "rankit")       setGameOver(rankit.getState(msg.roomId));
        else if (room.experience === "connections")  setGameOver(connections.getState(msg.roomId));
        else if (room.experience === "geoguesser")   setGameOver(geoguesser.getState(msg.roomId));
        else if (room.experience === "thedraft")     setGameOver(thedraft.getState(msg.roomId));
        else if (room.experience === "draw") {
          const s = draw.getState(msg.roomId);
          if (s) { s.phase = "game_over"; broadcastDrawState(msg.roomId); }
        }
        rooms.endRound(msg.roomId);
        break;
      }

      case "host:play_again": {
        const room = rooms.findRoom(msg.roomId);
        if (!room || room.hostGuestId !== msg.guestId) {
          send(ws, { type: "room:error", code: "UNAUTHORIZED", message: "Only the host can restart" });
          return;
        }
        trivia.cleanup(msg.roomId); wyr.cleanup(msg.roomId);
        guesstimate.cleanup(msg.roomId); buzzer.cleanup(msg.roomId);
        rankit.cleanup(msg.roomId); connections.cleanup(msg.roomId);
        geoguesser.cleanup(msg.roomId); thedraft.cleanup(msg.roomId);
        draw.cleanup(msg.roomId);
        rooms.resetRoom(msg.roomId);
        broadcast(msg.roomId, { type: "room:phase_changed", phase: "lobby" });
        broadcast(msg.roomId, { type: "room:members", members: rooms.getMembers(msg.roomId) });
        break;
      }

      case "host:kick": {
        const room = rooms.findRoom(msg.roomId);
        if (!room || room.hostGuestId !== msg.guestId) {
          send(ws, { type: "room:error", code: "UNAUTHORIZED", message: "Only the host can kick" });
          return;
        }
        rooms.kickGuest(msg.roomId, msg.targetGuestId);
        const kickedWs = sockets.get(msg.targetGuestId);
        if (kickedWs) send(kickedWs, { type: "room:kicked" });
        broadcast(msg.roomId, { type: "room:member_left", guestId: msg.targetGuestId }, msg.targetGuestId);
        break;
      }
    }
    } catch (err: any) {
      logEvent("ERROR", "ws.message", `${msg.type ?? "?"} :: ${err?.message ?? err}`, err?.stack);
      try { send(ws, { type: "room:error", code: "SERVER_ERROR", message: "Something went wrong on the server. Try again." }); } catch {}
    }
  });

  ws.on("close", () => {
    if (!connectedGuestId) return;
    if (sockets.get(connectedGuestId) !== ws) return;
    sockets.delete(connectedGuestId);
    const gid = connectedGuestId;
    const rid = connectedRoomId;

    setTimeout(() => {
      if (sockets.has(gid)) return;
      if (!rid) return;
      const room = rooms.findRoom(rid);
      if (!room) return;
      if (room.hostGuestId === gid) {
        broadcast(rid, { type: "room:closed" });
        rooms.closeRoom(rid);
        trivia.cleanup(rid); wyr.cleanup(rid);
        guesstimate.cleanup(rid); buzzer.cleanup(rid);
        rankit.cleanup(rid); connections.cleanup(rid);
        geoguesser.cleanup(rid); thedraft.cleanup(rid);
        draw.cleanup(rid);
      } else {
        rooms.leaveRoom(rid, gid);
        broadcast(rid, { type: "room:member_left", guestId: gid });
        // If The Draft was waiting on this guest to pick, advance past them
        if (room.experience === "thedraft") {
          const active = rooms.getMembers(rid).map(m => m.guestId);
          const advanced = thedraft.skipMissingPickers(rid, active);
          if (advanced) broadcast(rid, { type: "game:state", state: advanced });
        }
      }
    }, 15_000);
  });
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`[partyglue-box] HTTP + WebSocket on :${PORT}`);
  console.log(`[partyglue-box] Client dist: ${CLIENT_DIST}`);
});

function friendlyError(code: string): string {
  const map: Record<string, string> = {
    ROOM_NOT_FOUND: "Room not found — check the code and try again",
    ROOM_CLOSED: "This room has ended",
    UNAUTHORIZED: "You don't have permission to do that",
  };
  return map[code] ?? "Something went wrong";
}

process.on("SIGTERM", () => { wss.close(); httpServer.close(); process.exit(0); });
process.on("SIGINT",  () => { wss.close(); httpServer.close(); process.exit(0); });
