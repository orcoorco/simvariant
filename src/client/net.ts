// Klientens världsbild: WebSocket-anslutning, interpolering, bubblor, effekter och logg.
import type {
  BubbleStyle,
  CharDetail,
  CharSnap,
  ClientMsg,
  FxKind,
  GameEvent,
  LogEntry,
  Me,
  NpcSnap,
  ServerMsg,
  WorldState,
} from "../shared/protocol.ts";
import { playSound } from "./sound.ts";

export interface Bubble {
  id: number;
  i: string;
  text: string;
  style: BubbleStyle;
  start: number;
  end: number;
}

export interface FxInst {
  id: number;
  fx: FxKind;
  x: number;
  y: number;
  start: number;
  end: number;
  n: number;
  text?: string;
}

interface SnapFrame {
  at: number; // klienttid när den togs emot
  c: Map<string, CharSnap>;
  n: Map<string, NpcSnap>;
}

const INTERP_DELAY = 190;
let bubbleSeq = 1;
let fxSeq = 1;

type Listener = () => void;

export class WorldStore {
  frames: SnapFrame[] = [];
  details = new Map<string, CharDetail>();
  world: WorldState | null = null;
  log: LogEntry[] = [];
  bubbles: Bubble[] = [];
  fx: FxInst[] = [];
  me: Me | null = null;
  llm = "lokal motor";
  viewers = 0;
  connected = false;
  lastAck: { ok: boolean; text: string; plan?: string[]; via?: string; at: number } | null = null;
  version = 0;
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private retry = 0;
  private pingTimer: number | undefined;
  private closedByUs = false;

  subscribe = (fn: Listener) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = () => this.version;

  private bump() {
    this.version++;
    for (const l of this.listeners) l();
  }

  connect() {
    this.closedByUs = false;
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${location.host}/api/ws`);
    this.ws = ws;
    ws.onopen = () => {
      if (this.ws !== ws) return ws.close();
      this.connected = true;
      this.retry = 0;
      this.bump();
      window.clearInterval(this.pingTimer);
      this.pingTimer = window.setInterval(() => this.send({ t: "ping" }), 20000);
    };
    ws.onmessage = (ev) => {
      if (this.ws !== ws) return; // gammal socket – ignorera
      try {
        this.handle(JSON.parse(ev.data as string) as ServerMsg);
      } catch (err) {
        console.warn("Kunde inte tolka meddelande", err);
      }
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.connected = false;
      window.clearInterval(this.pingTimer);
      this.bump();
      if (this.closedByUs) return;
      const delay = Math.min(8000, 500 * 2 ** this.retry++);
      window.setTimeout(() => {
        if (this.ws === ws) this.connect();
      }, delay);
    };
    ws.onerror = () => ws.close();
  }

  reconnect() {
    const old = this.ws;
    this.ws = null;
    old?.close();
    this.frames = [];
    this.bubbles = [];
    this.connect();
  }

  send(msg: ClientMsg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private pushFrame(c: CharSnap[], n: NpcSnap[]) {
    const f: SnapFrame = {
      at: performance.now(),
      c: new Map(c.map((s) => [s.i, s])),
      n: new Map(n.map((s) => [s.i, s])),
    };
    this.frames.push(f);
    if (this.frames.length > 6) this.frames.shift();
  }

  private handle(m: ServerMsg) {
    switch (m.t) {
      case "hello":
        this.me = m.me;
        this.world = m.world;
        this.frames = [];
        this.pushFrame(m.chars, m.npcs);
        this.details = new Map(m.details.map((d) => [d.i, d]));
        this.log = m.log.slice(-200);
        this.llm = m.llm;
        this.viewers = m.viewers;
        this.bump();
        break;
      case "snap":
        this.pushFrame(m.c, m.n);
        break;
      case "detail":
        for (const d of m.d) this.details.set(d.i, d);
        this.bump();
        break;
      case "world":
        this.world = m.w;
        this.viewers = m.viewers;
        this.bump();
        break;
      case "me":
        this.me = m.me;
        this.bump();
        break;
      case "ack":
        this.lastAck = { ...m, at: Date.now() };
        this.bump();
        break;
      case "ev":
        for (const e of m.e) this.event(e);
        break;
    }
  }

  private event(e: GameEvent) {
    const now = performance.now();
    if (e.k === "say") {
      // Kö per person: ny bubbla startar när den förra är klar (men max 1,5 s väntan)
      const mine = this.bubbles.filter((b) => b.i === e.i && b.end > now);
      const last = mine.length ? Math.max(...mine.map((b) => b.end)) : now;
      const start = Math.min(last, now + 1500);
      if (mine.length >= 3) {
        // Trimma kön så att pratglada figurer inte hamnar efter
        const drop = mine.sort((a, b) => a.start - b.start)[0];
        this.bubbles = this.bubbles.filter((b) => b !== drop);
      }
      this.bubbles.push({ id: bubbleSeq++, i: e.i, text: e.text, style: e.style, start, end: start + e.dur * 1000 });
    } else if (e.k === "fx") {
      this.fx.push({ id: fxSeq++, fx: e.fx, x: e.x, y: e.y, start: now, end: now + e.dur * 1000, n: e.n ?? 1, text: e.text });
      if (this.fx.length > 80) this.fx.splice(0, this.fx.length - 80);
    } else if (e.k === "log") {
      if (this.log.length && this.log[this.log.length - 1].id >= e.e.id) return;
      this.log.push(e.e);
      if (this.log.length > 200) this.log.splice(0, this.log.length - 200);
      this.bump();
    } else if (e.k === "sound") {
      playSound(e.s);
    }
  }

  /** Interpolerade positioner för rendering. */
  sample(now: number): { chars: CharSnap[]; npcs: NpcSnap[] } {
    const fr = this.frames;
    if (!fr.length) return { chars: [], npcs: [] };
    const t = now - INTERP_DELAY;
    let a = fr[0];
    let b = fr[fr.length - 1];
    for (let k = fr.length - 1; k > 0; k--) {
      if (fr[k - 1].at <= t) {
        a = fr[k - 1];
        b = fr[k];
        break;
      }
    }
    const span = Math.max(1, b.at - a.at);
    const u = Math.max(0, Math.min(1, (t - a.at) / span));
    const lerp = <S extends { x: number; y: number }>(sa: S | undefined, sb: S): S => {
      if (!sa) return sb;
      const dx = sb.x - sa.x;
      const dy = sb.y - sa.y;
      if (dx * dx + dy * dy > 9) return sb; // teleport
      return { ...sb, x: sa.x + dx * u, y: sa.y + dy * u };
    };
    const chars: CharSnap[] = [];
    for (const [id, sb] of b.c) chars.push(lerp(a.c.get(id), sb));
    const npcs: NpcSnap[] = [];
    for (const [id, sb] of b.n) npcs.push(lerp(a.n.get(id), sb));
    return { chars, npcs };
  }

  /** Aktiva bubblor just nu (rensar gamla). */
  activeBubbles(now: number): Bubble[] {
    if (this.bubbles.length > 60) this.bubbles = this.bubbles.filter((b) => b.end > now);
    const active = this.bubbles.filter((b) => b.start <= now && b.end > now);
    if (this.bubbles.length && Math.random() < 0.02) this.bubbles = this.bubbles.filter((b) => b.end > now);
    return active;
  }

  activeFx(now: number): FxInst[] {
    this.fx = this.fx.filter((f) => f.end > now);
    return this.fx;
  }
}

export const store = new WorldStore();
