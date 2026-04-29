// Client-side logger — sends errors to the server's /api/log endpoint
// so we have a centralized log of every crash and warning across all phones + tablet.

interface LogPayload {
  level: "ERROR" | "WARN" | "INFO";
  where: string;
  message: string;
  stack?: string;
  ua?: string;
}

let queue: LogPayload[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  if (queue.length === 0) return;
  const batch = queue;
  queue = [];
  for (const entry of batch) {
    fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
      keepalive: true,
    }).catch(() => { /* swallow — logger must never crash the app */ });
  }
}

export function logToServer(level: "ERROR" | "WARN" | "INFO", where: string, message: string, stack?: string) {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  queue.push({ level, where, message: message.slice(0, 1000), stack: stack?.slice(0, 4000), ua: ua.slice(0, 200) });
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, 200);
}

let installed = false;
export function installGlobalErrorHandlers() {
  if (installed) return;
  installed = true;

  window.addEventListener("error", (e) => {
    logToServer("ERROR", "window.error", e.message ?? "unknown error", e.error?.stack);
  });

  window.addEventListener("unhandledrejection", (e) => {
    const reason: any = e.reason;
    const msg = reason?.message ?? String(reason);
    logToServer("ERROR", "unhandledRejection", msg, reason?.stack);
  });

  // Also pipe console.error and console.warn to server for visibility
  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);
  console.error = (...args: any[]) => {
    try { logToServer("ERROR", "console", args.map(serialize).join(" ")); } catch {}
    origError(...args);
  };
  console.warn = (...args: any[]) => {
    try { logToServer("WARN", "console", args.map(serialize).join(" ")); } catch {}
    origWarn(...args);
  };
}

function serialize(v: any): string {
  if (typeof v === "string") return v;
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  try { return JSON.stringify(v); } catch { return String(v); }
}
