// Durable Object "Office": den enda delade världen på Barnhusgatan 20.
// Server-auktoritativ simulering, WebSockets, SQLite (användare, sessioner, världsläge, logg).
import { DurableObject } from "cloudflare:workers";
import { CONSULTANT_BY_ID } from "../shared/consultants.ts";
import type { ClientMsg, Me, ServerMsg } from "../shared/protocol.ts";
import { ACCOUNTS, DEFAULT_PASSWORD, normalizeEmail } from "./accounts.ts";
import { clearCookie, hashPassword, parseCookies, randomHex, SESSION_COOKIE, SESSION_DAYS, sessionCookie, verifyPassword } from "./auth.ts";
import * as brain from "./sim/brain.ts";
import { handlePrompt } from "./sim/commands.ts";
import { doorbell, poke, worldTick } from "./sim/events.ts";
import { makeLlm, type LlmEnv } from "./sim/llm.ts";
import { World } from "./sim/world.ts";

export interface Env extends LlmEnv {
  OFFICE: DurableObjectNamespace<Office>;
}

interface Conn {
  ws: WebSocket;
  userId: string | null;
  lastPoke: number;
  lastBell: number;
  lastPrompt: number;
  busy: boolean;
  lastMe: string;
}

const TICK_MS = 100;
const IDLE_TICK_MS = 1000;
const SAVE_MS = 10_000;
const ALARM_MS = 30_000;
const MAX_CATCHUP_S = 180;

async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
}

export class Office extends DurableObject<Env> {
  private sql: SqlStorage;
  private world!: World;
  private conns = new Set<Conn>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastTick = Date.now();
  private lastSave = 0;
  private lastDetail = 0;
  private lastWorldMsg = 0;
  private lastPersistedLog = 0;
  private loginFails = new Map<string, { n: number; t: number }>();
  private globalBell = 0;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    ctx.blockConcurrencyWhile(async () => {
      this.migrate();
      await this.seed();
      this.world = new World(
        { decide: brain.decide, updateNeeds: brain.updateNeeds, react: brain.react, npcThink: brain.npcThink, worldTick, musicChanged: brain.musicChanged },
        makeLlm(env),
      );
      this.restore();
      await this.ctx.storage.setAlarm(Date.now() + ALARM_MS);
      this.startLoop();
    });
  }

  // ------------------------------------------------------------------ databas
  private migrate() {
    this.sql.exec(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      pw_hash TEXT NOT NULL,
      pw_salt TEXT NOT NULL,
      must_change INTEGER NOT NULL DEFAULT 1,
      updated INTEGER NOT NULL
    )`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created INTEGER NOT NULL,
      last_seen INTEGER NOT NULL
    )`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS log (id INTEGER PRIMARY KEY, ts INTEGER NOT NULL, json TEXT NOT NULL)`);
  }

  private async seed() {
    const existing = new Set(this.sql.exec<{ id: string }>("SELECT id FROM users").toArray().map((r) => r.id));
    for (const [email, id] of Object.entries(ACCOUNTS)) {
      if (existing.has(id)) continue;
      const { hash, salt } = await hashPassword(DEFAULT_PASSWORD);
      this.sql.exec("INSERT OR IGNORE INTO users (id, email, pw_hash, pw_salt, must_change, updated) VALUES (?, ?, ?, ?, 1, ?)", id, email, hash, salt, Date.now());
    }
  }

  private restore() {
    const row = this.sql.exec<{ value: string }>("SELECT value FROM kv WHERE key = 'world'").toArray()[0];
    const logs = this.sql.exec<{ id: number; json: string }>("SELECT id, json FROM log ORDER BY id DESC LIMIT 150").toArray().reverse();
    for (const l of logs) {
      try {
        this.world.log.push(JSON.parse(l.json));
      } catch {
        /* ignorera trasig rad */
      }
    }
    this.lastPersistedLog = logs.length ? logs[logs.length - 1].id : 0;
    this.world.logSeq = Math.max(this.world.logSeq, this.lastPersistedLog + 1);
    if (row) {
      const savedAt = this.world.restore(row.value);
      const away = Math.min(MAX_CATCHUP_S, Math.max(0, (Date.now() - savedAt) / 1000));
      if (away > 5) this.fastForward(away);
    } else {
      this.world.addLog("Kontoret på Barnhusgatan 20 öppnar för första gången. Dammbert vaknar.", "🏢", "world");
    }
    this.world.flush();
  }

  private fastForward(seconds: number) {
    let left = seconds;
    while (left > 0) {
      const dt = Math.min(0.25, left);
      this.world.tick(dt);
      this.world.flush();
      left -= dt;
    }
  }

  private save() {
    this.lastSave = Date.now();
    this.sql.exec("INSERT OR REPLACE INTO kv (key, value) VALUES ('world', ?)", this.world.serialize());
    for (const e of this.world.log) {
      if (e.id <= this.lastPersistedLog) continue;
      this.sql.exec("INSERT OR REPLACE INTO log (id, ts, json) VALUES (?, ?, ?)", e.id, e.ts, JSON.stringify(e));
      this.lastPersistedLog = e.id;
    }
    this.sql.exec("DELETE FROM log WHERE id < ?", this.lastPersistedLog - 300);
    this.sql.exec("DELETE FROM sessions WHERE last_seen < ?", Date.now() - SESSION_DAYS * 86400_000);
  }

  // ------------------------------------------------------------------ loop
  private startLoop() {
    if (this.timer) return;
    this.lastTick = Date.now();
    this.timer = setInterval(() => this.step(), TICK_MS);
  }

  private step() {
    const now = Date.now();
    const idle = this.conns.size === 0;
    if (idle && now - this.lastTick < IDLE_TICK_MS) return;
    let dt = (now - this.lastTick) / 1000;
    this.lastTick = now;
    if (dt > 2) {
      this.fastForward(Math.min(MAX_CATCHUP_S, dt));
      dt = 0.1;
    }
    this.world.viewers = this.conns.size;
    try {
      let left = dt;
      while (left > 0) {
        const d = Math.min(0.25, left);
        this.world.tick(d);
        left -= d;
      }
    } catch (err) {
      console.error("tick", err);
    }
    const events = this.world.flush();
    if (!idle) {
      this.broadcast({ t: "snap", ts: now, c: this.world.snapChars(), n: this.world.snapNpcs() });
      if (events.length) this.broadcast({ t: "ev", e: events });
      if (now - this.lastDetail > 1000) {
        this.lastDetail = now;
        this.refreshOnline();
        this.broadcast({ t: "detail", d: this.world.details() });
        for (const c of this.conns) if (c.userId) this.sendMe(c);
      }
      if (this.world.worldDirty || now - this.lastWorldMsg > 5000) {
        this.world.worldDirty = false;
        this.lastWorldMsg = now;
        this.broadcast({ t: "world", w: this.world.worldState(), viewers: this.conns.size });
      }
    }
    if (now - this.lastSave > SAVE_MS) {
      try {
        this.save();
      } catch (err) {
        console.error("save", err);
      }
    }
  }

  async alarm() {
    // Håller simuleringen vid liv även när ingen tittar.
    this.startLoop();
    await this.ctx.storage.setAlarm(Date.now() + ALARM_MS);
  }

  private broadcast(msg: ServerMsg) {
    const data = JSON.stringify(msg);
    for (const c of this.conns) {
      try {
        c.ws.send(data);
      } catch {
        this.conns.delete(c);
      }
    }
  }

  private send(c: Conn, msg: ServerMsg) {
    try {
      c.ws.send(JSON.stringify(msg));
    } catch {
      this.conns.delete(c);
    }
  }

  private refreshOnline() {
    const online = new Set([...this.conns].map((c) => c.userId).filter(Boolean));
    for (const ch of this.world.chars) ch.online = online.has(ch.id);
  }

  private meFor(userId: string | null): Me | null {
    if (!userId) return null;
    const ch = this.world.byId.get(userId);
    const row = this.sql.exec<{ must_change: number }>("SELECT must_change FROM users WHERE id = ?", userId).toArray()[0];
    if (!ch || !row) return null;
    const idleIn = ch.ctrl === "player" && ch.playerIdleSince ? Math.max(0, Math.ceil(25 - (this.world.time - ch.playerIdleSince))) : 0;
    return { id: ch.id, name: CONSULTANT_BY_ID[ch.id].name, mustChange: row.must_change === 1, ctrl: ch.ctrl, queue: ch.planLabels.slice(0, 8), idleIn };
  }

  private sendMe(c: Conn, force = false) {
    const me = this.meFor(c.userId);
    const key = JSON.stringify(me);
    if (!force && key === c.lastMe) return;
    c.lastMe = key;
    this.send(c, { t: "me", me });
  }

  // ------------------------------------------------------------------ sessioner
  private async userFromRequest(req: Request): Promise<string | null> {
    const token = parseCookies(req.headers.get("cookie"))[SESSION_COOKIE];
    if (!token || token.length < 32) return null;
    const h = await sha256(token);
    const row = this.sql.exec<{ user_id: string; last_seen: number }>("SELECT user_id, last_seen FROM sessions WHERE token_hash = ?", h).toArray()[0];
    if (!row) return null;
    if (Date.now() - row.last_seen > SESSION_DAYS * 86400_000) return null;
    if (Date.now() - row.last_seen > 3600_000) this.sql.exec("UPDATE sessions SET last_seen = ? WHERE token_hash = ?", Date.now(), h);
    return row.user_id;
  }

  // ------------------------------------------------------------------ HTTP
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const secure = url.protocol === "https:";
    try {
      switch (url.pathname) {
        case "/api/ws":
          return await this.handleWs(req);
        case "/api/health":
          return json({ ok: true, viewers: this.conns.size, llm: this.world.llmLabel, time: this.world.time });
        case "/api/me": {
          const uid = await this.userFromRequest(req);
          return json({ me: this.meFor(uid) });
        }
        case "/api/login":
          if (req.method !== "POST") return json({ error: "Metoden stöds inte" }, 405);
          return await this.login(req, secure);
        case "/api/logout": {
          if (req.method !== "POST") return json({ error: "Metoden stöds inte" }, 405);
          const token = parseCookies(req.headers.get("cookie"))[SESSION_COOKIE];
          if (token) this.sql.exec("DELETE FROM sessions WHERE token_hash = ?", await sha256(token));
          return json({ ok: true }, 200, { "set-cookie": clearCookie(secure) });
        }
        case "/api/password":
          if (req.method !== "POST") return json({ error: "Metoden stöds inte" }, 405);
          return await this.changePassword(req);
        default:
          return json({ error: "Hittades inte" }, 404);
      }
    } catch (err) {
      console.error("fetch", err);
      return json({ error: "Något gick fel på servern." }, 500);
    }
  }

  private async login(req: Request, secure: boolean): Promise<Response> {
    let body: { email?: string; password?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Ogiltig förfrågan." }, 400);
    }
    const email = normalizeEmail(String(body.email ?? ""));
    const password = String(body.password ?? "");
    const fail = this.loginFails.get(email);
    if (fail && fail.n >= 8 && Date.now() - fail.t < 10 * 60_000) return json({ error: "För många försök. Vänta en stund och försök igen." }, 429);
    const row = this.sql.exec<{ id: string; pw_hash: string; pw_salt: string; must_change: number }>("SELECT id, pw_hash, pw_salt, must_change FROM users WHERE email = ?", email).toArray()[0];
    const ok = row ? await verifyPassword(password, row.pw_hash, row.pw_salt) : (await hashPassword(password), false);
    if (!row || !ok) {
      const f = fail && Date.now() - fail.t < 10 * 60_000 ? fail : { n: 0, t: Date.now() };
      f.n++;
      this.loginFails.set(email, f);
      return json({ error: "Fel e-post eller lösenord." }, 401);
    }
    this.loginFails.delete(email);
    const token = randomHex(32);
    this.sql.exec("INSERT INTO sessions (token_hash, user_id, created, last_seen) VALUES (?, ?, ?, ?)", await sha256(token), row.id, Date.now(), Date.now());
    const ch = this.world.byId.get(row.id);
    if (ch) {
      this.world.addLog(`${ch.name} loggade in och tar kontroll över sin karaktär.`, "🔑", "player", ch.id);
      this.world.setIcon(ch, "👋", 6);
      this.world.say(ch, "Hallå! Det är jag på riktigt nu.", "say", { log: false });
    }
    return json({ ok: true, me: this.meFor(row.id) }, 200, { "set-cookie": sessionCookie(token, secure) });
  }

  private async changePassword(req: Request): Promise<Response> {
    const uid = await this.userFromRequest(req);
    if (!uid) return json({ error: "Du är inte inloggad." }, 401);
    let body: { current?: string; next?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Ogiltig förfrågan." }, 400);
    }
    const current = String(body.current ?? "");
    const next = String(body.next ?? "");
    const row = this.sql.exec<{ pw_hash: string; pw_salt: string }>("SELECT pw_hash, pw_salt FROM users WHERE id = ?", uid).toArray()[0];
    if (!row || !(await verifyPassword(current, row.pw_hash, row.pw_salt))) return json({ error: "Nuvarande lösenord stämmer inte." }, 400);
    if (next.length < 6) return json({ error: "Det nya lösenordet måste vara minst 6 tecken." }, 400);
    if (next.length > 200) return json({ error: "Det nya lösenordet är för långt." }, 400);
    if (next.trim().toUpperCase() === DEFAULT_PASSWORD) return json({ error: "Välj något annat än BANAN 🍌" }, 400);
    const { hash, salt } = await hashPassword(next);
    this.sql.exec("UPDATE users SET pw_hash = ?, pw_salt = ?, must_change = 0, updated = ? WHERE id = ?", hash, salt, Date.now(), uid);
    // Logga ut andra sessioner för samma användare
    const token = parseCookies(req.headers.get("cookie"))[SESSION_COOKIE];
    if (token) this.sql.exec("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?", uid, await sha256(token));
    for (const c of this.conns) if (c.userId === uid) this.sendMe(c, true);
    return json({ ok: true });
  }

  // ------------------------------------------------------------------ WebSocket
  private async handleWs(req: Request): Promise<Response> {
    if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") return json({ error: "Förväntade WebSocket" }, 426);
    const userId = await this.userFromRequest(req);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    const conn: Conn = { ws: server, userId, lastPoke: 0, lastBell: 0, lastPrompt: 0, busy: false, lastMe: "" };
    this.conns.add(conn);
    this.refreshOnline();
    this.startLoop();
    this.send(conn, {
      t: "hello",
      me: this.meFor(userId),
      world: this.world.worldState(),
      chars: this.world.snapChars(),
      npcs: this.world.snapNpcs(),
      details: this.world.details(),
      log: this.world.log.slice(-120),
      llm: this.world.llmLabel,
      viewers: this.conns.size,
      ts: Date.now(),
    });
    conn.lastMe = JSON.stringify(this.meFor(userId));
    this.world.worldDirty = true;
    server.addEventListener("message", (ev) => {
      void this.onMessage(conn, ev.data);
    });
    const close = () => {
      this.conns.delete(conn);
      this.refreshOnline();
      this.world.worldDirty = true;
    };
    server.addEventListener("close", close);
    server.addEventListener("error", close);
    return new Response(null, { status: 101, webSocket: client });
  }

  private async onMessage(conn: Conn, data: string | ArrayBuffer) {
    if (typeof data !== "string" || data.length > 4000) return;
    let msg: ClientMsg;
    try {
      msg = JSON.parse(data) as ClientMsg;
    } catch {
      return;
    }
    const now = Date.now();
    switch (msg.t) {
      case "ping":
        return;
      case "prompt": {
        if (!conn.userId) return this.send(conn, { t: "ack", ok: false, text: "Logga in för att styra din karaktär." });
        if (conn.busy || now - conn.lastPrompt < 1200) return this.send(conn, { t: "ack", ok: false, text: "Lugn i stormen – vänta en sekund." });
        const ch = this.world.byId.get(conn.userId);
        if (!ch) return;
        conn.busy = true;
        conn.lastPrompt = now;
        try {
          const res = await handlePrompt(this.world, ch, String(msg.text ?? ""));
          this.send(conn, { t: "ack", ok: res.ok, text: res.text, plan: res.plan, via: res.via });
        } catch (err) {
          console.error("prompt", err);
          this.send(conn, { t: "ack", ok: false, text: "Något gick snett när instruktionen tolkades." });
        } finally {
          conn.busy = false;
          this.sendMe(conn, true);
        }
        return;
      }
      case "autopilot": {
        if (!conn.userId) return;
        const ch = this.world.byId.get(conn.userId);
        if (!ch) return;
        if (ch.schemeId) this.world.leaveScheme(ch);
        ch.ctrl = "ai";
        ch.queue = [];
        ch.step = null;
        ch.path = [];
        ch.planLabels = [];
        ch.playerIdleSince = 0;
        this.world.addLog(`${ch.name} slår på autopiloten.`, "🤖", "player", ch.id);
        this.sendMe(conn, true);
        return;
      }
      case "doorbell": {
        if (now - conn.lastBell < 30_000 || now - this.globalBell < 15_000) return this.send(conn, { t: "ack", ok: false, text: "Någon har redan ringt nyss. Ha tålamod!" });
        conn.lastBell = now;
        const by = conn.userId ? CONSULTANT_BY_ID[conn.userId]?.first ?? "någon" : "en besökare";
        if (doorbell(this.world, `ringt av ${by}`)) {
          this.globalBell = now;
          this.send(conn, { t: "ack", ok: true, text: "Ding dong! Någon går och öppnar..." });
        } else this.send(conn, { t: "ack", ok: false, text: "Budet står redan i dörren." });
        return;
      }
      case "poke": {
        if (now - conn.lastPoke < 400) return;
        conn.lastPoke = now;
        poke(this.world, String(msg.what ?? "").slice(0, 40));
        return;
      }
    }
  }
}
