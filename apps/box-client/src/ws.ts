import type { ClientMessage, ServerMessage } from "./types";

function resolveWsUrl(): string {
  if (import.meta.env.DEV) return `ws://${window.location.host}/ws`;
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}`;
}

type MessageHandler = (msg: ServerMessage) => void;
type ReconnectHandler = () => void;
type StatusHandler = (s: "connecting" | "connected" | "disconnected") => void;

export type WsStatus = "connecting" | "connected" | "disconnected";

export class BoxSocket {
  private ws: WebSocket | null = null;
  private handlers = new Set<MessageHandler>();
  private reconnectHandlers = new Set<ReconnectHandler>();
  private statusHandlers = new Set<StatusHandler>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private isFirstConnect = true;
  private _status: WsStatus = "connecting";

  get status(): WsStatus { return this._status; }

  private setStatus(s: WsStatus) {
    this._status = s;
    for (const h of this.statusHandlers) h(s);
  }

  connect(): void {
    this.intentionalClose = false;
    this._open();
  }

  private _open(): void {
    this.setStatus("connecting");
    const url = resolveWsUrl();
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.setStatus("connected");
      this.pingTimer = setInterval(() => this.send({ type: "ping" }), 20_000);
      if (!this.isFirstConnect) {
        for (const h of this.reconnectHandlers) h();
      }
      this.isFirstConnect = false;
    };

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as ServerMessage;
        for (const h of this.handlers) h(msg);
      } catch { /* ignore malformed */ }
    };

    this.ws.onclose = () => {
      if (this.pingTimer) clearInterval(this.pingTimer);
      if (!this.intentionalClose) {
        this.setStatus("disconnected");
        this.reconnectTimer = setTimeout(() => this._open(), 2_000);
      }
    };

    this.ws.onerror = (e) => {
      console.warn("[ws] error", e);
      this.ws?.close();
    };
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  on(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  onReconnect(handler: ReconnectHandler): () => void {
    this.reconnectHandlers.add(handler);
    return () => this.reconnectHandlers.delete(handler);
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  close(): void {
    this.intentionalClose = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.ws?.close();
  }
}

export const socket = new BoxSocket();
