// Simuleringskärnan: aktörer, handlingsköer, platser, händelser och tillstånd.
import {
  buildMap,
  ROOMS,
  ROOM_BY_ID,
  DOWN,
  UP,
  LEFT,
  RIGHT,
  type Dir,
  type OfficeMap,
  type Pose,
  type RoomId,
  type RoomInfo,
  type Spot,
  type SpotKind,
} from "../../shared/map.ts";
import { CONSULTANTS, NPCS, type Consultant, type NpcKind } from "../../shared/consultants.ts";
import type {
  Anim,
  BubbleStyle,
  CharDetail,
  CharSnap,
  Control,
  Effect,
  FxKind,
  GameEvent,
  Item,
  LogEntry,
  LogTag,
  Needs,
  NpcSnap,
  WorldState,
} from "../../shared/protocol.ts";
import { buildCostMap, findPath, type P } from "./path.ts";
import { TRACK_BY_ID, type MusicState, type TrackId } from "../../shared/music.ts";
import type { LlmClient } from "./llm.ts";

// ---------------------------------------------------------------------------
// Steg i en handlingskö
export type DoResult = void | Step[] | { replace: Step[] };

export type Step = (
  | { t: "go"; x: number; y: number; face?: Dir; run?: boolean; moveAnim?: Anim; movePose?: Pose; speed?: number }
  | {
      t: "spot";
      kind: SpotKind | SpotKind[];
      room?: RoomId;
      prefer?: string; // spot-id som föredras (t.ex. eget skrivbord)
      pose?: Pose; // överskrid platsens pose (t.ex. ligga i soffan)
      run?: boolean;
      anim?: Anim; // animation när man kommit fram
    }
  | { t: "toChar"; id: string; run?: boolean; dist?: number }
  | { t: "follow"; id: string; dur: number; moveAnim?: Anim; run?: boolean }
  | { t: "anim"; anim: Anim; dur: number; pose?: Pose; act?: string; icon?: string }
  | { t: "say"; text: string; style?: BubbleStyle; dur?: number; log?: boolean | "force"; wait?: number; to?: string }
  | { t: "think"; text: string }
  | { t: "wait"; dur: number }
  | { t: "face"; dir?: Dir; toward?: string }
  | { t: "item"; item: Item | null; dur?: number }
  | { t: "fx"; fx: FxKind; dur?: number; n?: number; text?: string; at?: [number, number] }
  | { t: "do"; fn: (w: World, a: Actor) => DoResult }
  | { t: "leave" }
  | { t: "act"; act: string; icon?: string }
  | { t: "effect"; effect: Effect; dur: number }
  | { t: "needs"; d: Partial<Needs> }
  | { t: "teleport"; x: number; y: number }
) & { label?: string };

export interface ActorBase {
  id: string;
  name: string;
  x: number;
  y: number;
  dir: Dir;
  anim: Anim;
  pose: Pose;
  path: P[];
  moveAnim: Anim | null;
  speed: number;
  queue: Step[];
  step: Step | null;
  stepT: number;
  stepInit: boolean;
  stepData: Record<string, unknown>;
  moonwalk: number; // sim-tid då moonwalk slutar
  spot: Spot | null;
}

export interface Char extends ActorBase {
  type: "char";
  c: Consultant;
  needs: Needs;
  act: string;
  icon: string | null;
  iconUntil: number;
  thought: string;
  item: Item | null;
  itemUntil: number;
  effects: Map<Effect, number>;
  ctrl: Control;
  playerIdleSince: number; // sim-tid då spelarens kö tog slut
  schemeId: string | null;
  mem: string[];
  rel: Record<string, number>;
  lastSay: number;
  lastReact: number;
  cooldown: Record<string, number>;
  mugHidden: { place: string; by: string; x: number; y: number } | null;
  online: boolean;
  coffees: number;
  homeSpot: string | null;
  planLabels: string[];
}

export interface Npc extends ActorBase {
  type: "npc";
  kind: NpcKind;
  visible: boolean;
  until: number; // när synligheten upphör (0 = alltid)
  brainT: number;
}

export type Actor = Char | Npc;

export interface Scheme {
  id: string;
  kind: string;
  label: string;
  init: string;
  members: Set<string>;
  room: RoomId | null;
  joinable: boolean;
  big: boolean;
  endsAt: number;
  onJoin?: (w: World, c: Char) => void;
  onEnd?: (w: World) => void;
}

interface Timer {
  at: number;
  fn: () => void;
}

export interface Hooks {
  decide: (w: World, c: Char) => void;
  updateNeeds: (w: World, c: Char, dt: number) => void;
  react: (w: World, c: Char, src: Actor, kind: string, opts: StimulusOpts) => void;
  npcThink: (w: World, n: Npc) => void;
  worldTick: (w: World, dt: number) => void;
  musicChanged: (w: World, by: Actor | null, prev: TrackId) => void;
}

export interface StimulusOpts {
  radius?: number;
  scheme?: string;
  max?: number;
}

const WALK_SPEED = 3.1;
const RUN_SPEED = 5.6;

export function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

function stockholmNow(d = new Date()) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "long",
    month: "numeric",
    day: "numeric",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hour = parseInt(get("hour"), 10) % 24;
  const minute = parseInt(get("minute"), 10);
  return { hour, minute, weekday: get("weekday"), month: parseInt(get("month"), 10), day: parseInt(get("day"), 10) };
}

// ---------------------------------------------------------------------------
export class World {
  map: OfficeMap;
  cost: Float32Array;
  chars: Char[] = [];
  byId = new Map<string, Char>();
  npcs: Npc[] = [];
  npcById = new Map<string, Npc>();
  time = 0;
  events: GameEvent[] = [];
  log: LogEntry[] = [];
  logSeq = 1;
  spotsTaken = new Map<string, string>();
  timers: Timer[] = [];
  schemes = new Map<string, Scheme>();
  schemeSeq = 1;
  llm: LlmClient | null;
  llmLabel: string;
  viewers = 0;
  worldDirty = true;
  hooks: Hooks;
  // tillstånd
  lights = true;
  disco: RoomId | null = null;
  alarm = false;
  weather: WorldState["weather"] = "moln";
  coffeeBroken = false;
  plantSize = 1;
  stats = { kaffe: 0, moten: 0, kaos: 0, ideer: 0, kramar: 0 };
  banner: string | null = null;
  bannerUntil = 0;
  special: string | null = null;
  music: MusicState = { track: "lofi", by: null, at: Date.now() };
  musicNext = 0; // tidigaste sim-tid då AI:n får byta musik igen
  clock = { hour: 12, minute: 0, weekday: "", month: 1, day: 1 };
  clockT = -10;
  nextWorldEvent = 40;
  lastPlayerActivity = -999;
  pokeCounts = new Map<string, { n: number; t: number }>();
  firedToday = new Set<string>();

  constructor(hooks: Hooks, llm: LlmClient | null) {
    this.hooks = hooks;
    this.llm = llm;
    this.llmLabel = llm ? llm.label : "lokal motor";
    this.map = buildMap();
    this.cost = buildCostMap(this.map);
    for (const c of CONSULTANTS) {
      const home = c.desk ? this.map.spots.find((s) => s.kind === "desk" && s.x === c.desk![0] && s.y === c.desk![1]) : null;
      const ch: Char = {
        type: "char",
        id: c.id,
        name: c.first,
        c,
        x: 12.5,
        y: 36.5,
        dir: DOWN,
        anim: "idle",
        pose: "stand",
        path: [],
        moveAnim: null,
        speed: WALK_SPEED,
        queue: [],
        step: null,
        stepT: 0,
        stepInit: false,
        stepData: {},
        moonwalk: 0,
        spot: null,
        needs: {
          koffein: 40 + Math.random() * 50,
          fokus: 30 + Math.random() * 40,
          socialt: 30 + Math.random() * 50,
          inspiration: 30 + Math.random() * 50,
          kaos: 10 + Math.random() * 40 * c.traits.kaos,
          energi: 50 + Math.random() * 45,
          hunger: Math.random() * 50,
        },
        act: "Kommer till kontoret",
        icon: null,
        iconUntil: 0,
        thought: c.catch[0],
        item: null,
        itemUntil: 0,
        effects: new Map(),
        ctrl: "ai",
        playerIdleSince: 0,
        schemeId: null,
        mem: [],
        rel: {},
        lastSay: -99,
        lastReact: -99,
        cooldown: {},
        mugHidden: null,
        online: false,
        coffees: 0,
        homeSpot: home?.id ?? null,
        planLabels: [],
      };
      this.chars.push(ch);
      this.byId.set(c.id, ch);
    }
    // relationer
    for (const a of this.chars) {
      for (const b of this.chars) {
        if (a === b) continue;
        let v = Math.round(Math.random() * 40 - 8);
        const ra = a.homeSpot ? this.map.spots.find((s) => s.id === a.homeSpot)?.room : null;
        const rb = b.homeSpot ? this.map.spots.find((s) => s.id === b.homeSpot)?.room : null;
        if (ra && ra === rb) v += 18;
        a.rel[b.id] = v;
      }
    }
    // startpositioner: vid skrivbordet eller i loungen/pentryt
    for (const ch of this.chars) {
      const s = ch.homeSpot ? this.map.spots.find((q) => q.id === ch.homeSpot) : null;
      if (s && !this.spotsTaken.has(s.id)) this.seat(ch, s);
      else {
        const free = this.map.spots.filter((q) => (q.kind === "sofa" || q.kind === "armchair" || q.kind === "dining") && !this.spotsTaken.has(q.id));
        const q = free[Math.floor(Math.random() * free.length)];
        if (q) this.seat(ch, q);
      }
    }
    // NPC:er
    const npcPos: Record<string, [number, number, boolean]> = {
      dammbert: [15.5, 15.5, true],
      gunnar: [31.5, 77.5, false],
      spoket: [9.5, 44.5, false],
      strindberg: [5.5, 33.5, false],
      budet: [5.5, 32.5, false],
    };
    for (const n of NPCS) {
      const [x, y, v] = npcPos[n.id] ?? [12.5, 36.5, false];
      this.addNpc(n.id, n.kind, n.name, x, y, v);
    }
    const objects: [string, string, number, number][] = [
      ["kaffemaskinen", "Kaffemaskinen", 19.5, 18.3],
      ["bengt", "Krukväxten Bengt", 17.5, 32.3],
      ["servern", "Servern", 15.5, 6.3],
      ["arkaden", "Arkadmaskinen", 19.5, 6.3],
      ["hissen", "Hissen", 5, 31.3],
      ["objekt", "Föremålet", 12, 36],
    ];
    for (const [id, name, x, y] of objects) this.addNpc(id, "object", name, x, y, false);
    this.weather = (["moln", "regn", "sno", "sol"] as const)[Math.floor(Math.random() * 4)];
  }

  private addNpc(id: string, kind: NpcKind, name: string, x: number, y: number, visible: boolean) {
    const n: Npc = {
      type: "npc",
      id,
      name,
      kind,
      x,
      y,
      dir: DOWN,
      anim: "idle",
      pose: "stand",
      path: [],
      moveAnim: null,
      speed: kind === "vacuum" ? 1.4 : kind === "ghost" ? 1.6 : WALK_SPEED,
      queue: [],
      step: null,
      stepT: 0,
      stepInit: false,
      stepData: {},
      moonwalk: 0,
      spot: null,
      visible,
      until: 0,
      brainT: 0,
    };
    this.npcs.push(n);
    this.npcById.set(id, n);
  }

  // ---------------------------------------------------------------- hjälpare
  actor(id: string): Actor | undefined {
    return this.byId.get(id) ?? this.npcById.get(id);
  }

  roomOf(a: { x: number; y: number }): RoomInfo | null {
    const tx = Math.floor(a.x);
    const ty = Math.floor(a.y);
    if (tx < 0 || ty < 0 || tx >= this.map.w || ty >= this.map.h) return null;
    const r = this.map.room[ty * this.map.w + tx];
    return r >= 0 ? ROOMS[r] : null;
  }

  walkable(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.map.w && y < this.map.h && this.map.blocked[y * this.map.w + x] === 0;
  }

  /** Slumpmässig gångbar ruta i ett rum (inte på möbler). */
  randomTileIn(room: RoomId, avoidOccupied = true): P | null {
    const idx = ROOMS.findIndex((r) => r.id === room);
    const cand: P[] = [];
    for (let y = 0; y < this.map.h; y++)
      for (let x = 0; x < this.map.w; x++) {
        const i = y * this.map.w + x;
        if (this.map.room[i] === idx && this.map.blocked[i] === 0 && this.map.tiles[i] === 1) cand.push({ x, y });
      }
    const free = avoidOccupied ? cand.filter((p) => !this.occupied(p.x, p.y)) : cand;
    const list = free.length ? free : cand;
    return list.length ? list[Math.floor(Math.random() * list.length)] : null;
  }

  occupied(x: number, y: number, except?: Actor): boolean {
    for (const c of this.chars) {
      if (c === except) continue;
      if (Math.floor(c.x) === x && Math.floor(c.y) === y) return true;
      const last = c.path[c.path.length - 1];
      if (last && last.x === x && last.y === y) return true;
    }
    return false;
  }

  charsInRoom(room: RoomId | null | undefined): Char[] {
    if (!room) return [];
    return this.chars.filter((c) => this.roomOf(c)?.id === room);
  }

  isFree(c: Char) {
    return c.ctrl === "ai" && !c.schemeId;
  }

  /** Kan avbrytas av reaktioner/inbjudningar. */
  interruptible(c: Char) {
    if (!this.isFree(c)) return false;
    if (c.spot?.kind === "toilet") return false;
    return true;
  }

  spotById(id: string) {
    return this.map.spots.find((s) => s.id === id);
  }

  findSpot(kinds: SpotKind | SpotKind[], near: { x: number; y: number }, opts: { room?: RoomId; prefer?: string; exceptId?: string } = {}): Spot | null {
    const ks = Array.isArray(kinds) ? kinds : [kinds];
    if (opts.prefer) {
      const p = this.spotById(opts.prefer);
      const by = p ? this.spotsTaken.get(p.id) : undefined;
      if (p && (!by || by === opts.exceptId)) return p;
    }
    let best: Spot | null = null;
    let bestD = Infinity;
    for (const s of this.map.spots) {
      if (!ks.includes(s.kind)) continue;
      if (opts.room && s.room !== opts.room) continue;
      const by = this.spotsTaken.get(s.id);
      if (by && by !== opts.exceptId) continue;
      if (this.occupied(s.x, s.y, opts.exceptId ? this.actor(opts.exceptId) : undefined) && s.pose === "stand") continue;
      const d = dist(near, { x: s.x + 0.5, y: s.y + 0.5 }) + Math.random() * 3;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  /** Spelare får "låna" en upptagen plats – AI-figuren som sitter där flyttar artigt på sig. */
  evictFor(a: Char, kinds: SpotKind | SpotKind[]): Spot | null {
    const ks = Array.isArray(kinds) ? kinds : [kinds];
    let best: Spot | null = null;
    let bestD = Infinity;
    for (const s of this.map.spots) {
      if (!ks.includes(s.kind)) continue;
      const by = this.spotsTaken.get(s.id);
      const occ = by ? this.byId.get(by) : undefined;
      if (by && (!occ || occ.ctrl === "player")) continue;
      const d = dist(a, { x: s.x + 0.5, y: s.y + 0.5 });
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    if (!best) return null;
    const occ = this.byId.get(this.spotsTaken.get(best.id) ?? "");
    if (occ) {
      if (occ.schemeId) this.leaveScheme(occ);
      this.release(occ);
      const away = this.randomTileIn(best.room) ?? { x: Math.floor(occ.x), y: Math.floor(occ.y) + 1 };
      this.assign(occ, [
        { t: "say", text: `Åh, ska du hit ${a.name}? Varsågod!`, wait: 0.6 },
        { t: "go", x: away.x, y: away.y },
        { t: "anim", anim: "idle", dur: 2 },
      ]);
    }
    return best;
  }

  seat(a: Actor, s: Spot) {
    this.release(a);
    this.spotsTaken.set(s.id, a.id);
    a.spot = s;
    a.x = s.x + 0.5;
    a.y = s.y + 0.5;
    a.dir = s.face;
    a.pose = s.pose;
    a.anim = s.pose === "sit" ? "sit" : s.pose === "lie" ? "sleep" : "idle";
  }

  release(a: Actor) {
    if (a.spot) {
      if (this.spotsTaken.get(a.spot.id) === a.id) this.spotsTaken.delete(a.spot.id);
      a.spot = null;
    }
    if (a.pose !== "stand") {
      a.pose = "stand";
      a.anim = "idle";
    }
  }

  later(sec: number, fn: () => void) {
    this.timers.push({ at: this.time + sec, fn });
  }

  /** Ersätt hela kön. */
  assign(a: Actor, steps: Step[], ctrl?: Control) {
    a.queue = [...steps];
    a.step = null;
    a.path = [];
    a.moveAnim = null;
    if (a.type === "char" && ctrl) a.ctrl = ctrl;
  }

  push(a: Actor, steps: Step[]) {
    a.queue.push(...steps);
  }

  /** Lägg steg först i kön (efter nuvarande steg avbryts). */
  interrupt(a: Actor, steps: Step[]) {
    a.queue = [...steps, ...a.queue];
    a.step = null;
    a.path = [];
    a.moveAnim = null;
  }

  travelTime(a: Actor, x: number, y: number) {
    return dist(a, { x: x + 0.5, y: y + 0.5 }) * 1.35 / WALK_SPEED + 0.4;
  }

  // ---------------------------------------------------------------- händelser
  say(a: Actor, text: string, style: BubbleStyle = "say", opts: { log?: boolean | "force"; dur?: number; to?: string } = {}) {
    const t = text.trim();
    if (!t) return;
    const dur = opts.dur ?? Math.min(9, 2.6 + t.length * 0.055);
    this.events.push({ k: "say", i: a.id, text: t.slice(0, 220), style, dur });
    if (a.type === "char") {
      a.lastSay = this.time;
      if (style === "think") a.thought = t;
      if (!a.path.length && a.pose === "stand" && (a.anim === "idle" || a.anim === "talk")) {
        a.anim = "talk";
        const id = a.id;
        this.later(Math.min(dur, 3), () => {
          const c = this.byId.get(id);
          if (c && c.anim === "talk" && !c.path.length) c.anim = "idle";
        });
      }
    }
    const room = this.roomOf(a);
    const logIt = opts.log === "force" || (opts.log !== false && style !== "think" && (style === "shout" ? Math.random() < 0.6 : Math.random() < 0.08));
    if (logIt) {
      const icon = style === "shout" ? "📢" : style === "sing" ? "🎤" : style === "whisper" ? "🤫" : "💬";
      const prefix = opts.to ? `${a.name} → ${this.actor(opts.to)?.name ?? opts.to}` : a.name;
      this.addLog(`${prefix}: "${t}"`, icon, a.type === "char" && a.ctrl === "player" ? "player" : "say", a.id, room?.name);
    }
  }

  think(c: Char, text: string, bubble = true) {
    c.thought = text;
    if (bubble) this.events.push({ k: "say", i: c.id, text, style: "think", dur: Math.min(7, 2.5 + text.length * 0.05) });
  }

  fx(fx: FxKind, x: number, y: number, dur = 2, n = 1, text?: string) {
    this.events.push({ k: "fx", fx, x, y, dur, n, text });
  }

  sound(s: "ding" | "pop" | "alarm" | "tada" | "boing" | "whoosh" | "bell") {
    this.events.push({ k: "sound", s });
  }

  addLog(text: string, icon: string, tag: LogTag, who?: string, room?: string) {
    const e: LogEntry = { id: this.logSeq++, ts: Date.now(), text, icon, tag, who, room };
    this.log.push(e);
    if (this.log.length > 300) this.log.splice(0, this.log.length - 300);
    this.events.push({ k: "log", e });
  }

  setIcon(c: Char, icon: string, dur = 6) {
    c.icon = icon;
    c.iconUntil = this.time + dur;
  }

  remember(c: Char, text: string) {
    c.mem.push(text);
    if (c.mem.length > 8) c.mem.shift();
  }

  relate(a: Char, b: Char, delta: number) {
    a.rel[b.id] = clamp((a.rel[b.id] ?? 0) + delta, -100, 100);
    b.rel[a.id] = clamp((b.rel[a.id] ?? 0) + delta * 0.8, -100, 100);
  }

  /** Något uppseendeväckande hände – grannar kan reagera. */
  stimulus(src: Actor, kind: string, intensity: number, opts: StimulusOpts = {}) {
    const radius = opts.radius ?? 7;
    const room = this.roomOf(src)?.id;
    let n = 0;
    const max = opts.max ?? 3;
    const list = [...this.chars].sort(() => Math.random() - 0.5);
    for (const c of list) {
      if (c === src || c.ctrl === "player") continue;
      if (c.schemeId && c.schemeId === opts.scheme) continue;
      if (this.time - c.lastReact < 6) continue;
      const d = dist(c, src);
      const same = this.roomOf(c)?.id === room;
      if (!same && d > radius) continue;
      const p = intensity * (0.3 + 0.7 * c.c.traits.nyfiken) * (d < 4 ? 1 : 0.55);
      if (Math.random() < p) {
        c.lastReact = this.time;
        this.hooks.react(this, c, src, kind, opts);
        if (++n >= max) break;
      }
    }
  }

  // ---------------------------------------------------------------- musik
  /** Byt låt i jukeboxen. Returnerar false om samma låt redan spelas. */
  setMusic(by: Actor | null, track: TrackId, opts: { log?: boolean; react?: boolean } = {}): boolean {
    if (this.music.track === track) return false;
    const prev = this.music.track;
    this.music = { track, by: by?.id ?? null, at: Date.now() };
    this.worldDirty = true;
    const info = TRACK_BY_ID[track];
    if (opts.log !== false) {
      const who = by?.name ?? "Jukeboxen";
      this.addLog(track === "off" ? `${who} stängde av musiken.` : by ? `${who} satte på ${info.name} i jukeboxen.` : `Jukeboxen bytte till ${info.name}.`, info.icon, "event", by?.id, "Loungen");
    }
    if (opts.react !== false) this.hooks.musicChanged(this, by, prev);
    return true;
  }

  // ---------------------------------------------------------------- scheman
  newScheme(kind: string, init: Char | null, o: { label: string; room?: RoomId | null; joinable?: boolean; big?: boolean; dur: number }): Scheme {
    const s: Scheme = {
      id: `s${this.schemeSeq++}`,
      kind,
      label: o.label,
      init: init?.id ?? "",
      members: new Set(),
      room: o.room ?? null,
      joinable: o.joinable ?? false,
      big: o.big ?? false,
      endsAt: this.time + o.dur,
    };
    this.schemes.set(s.id, s);
    if (init) this.enlist(s, init);
    this.special = s.big ? s.label : this.special;
    this.worldDirty = true;
    return s;
  }

  enlist(s: Scheme, c: Char) {
    if (c.schemeId && c.schemeId !== s.id) this.leaveScheme(c);
    s.members.add(c.id);
    c.schemeId = s.id;
    if (c.ctrl === "ai") c.ctrl = "scheme";
  }

  leaveScheme(c: Char) {
    const s = c.schemeId ? this.schemes.get(c.schemeId) : null;
    if (s) s.members.delete(c.id);
    c.schemeId = null;
    if (c.ctrl === "scheme") {
      c.ctrl = "ai";
      c.queue = [];
      c.step = null;
      c.path = [];
      c.moveAnim = null;
      if (c.anim !== "sit" && c.pose === "stand") c.anim = "idle";
    }
  }

  endScheme(id: string) {
    const s = this.schemes.get(id);
    if (!s) return;
    this.schemes.delete(id);
    try {
      s.onEnd?.(this);
    } catch (err) {
      console.error("scheme end", err);
    }
    for (const mid of s.members) {
      const c = this.byId.get(mid);
      if (c && c.schemeId === id) this.leaveScheme(c);
    }
    if (this.special === s.label) this.special = null;
    this.worldDirty = true;
  }

  activeBig() {
    for (const s of this.schemes.values()) if (s.big) return s;
    return null;
  }

  // ---------------------------------------------------------------- tick
  tick(dt: number) {
    this.time += dt;
    // klocka
    if (this.time - this.clockT > 5) {
      this.clockT = this.time;
      const prev = `${this.clock.hour}:${this.clock.minute}`;
      this.clock = stockholmNow();
      if (`${this.clock.hour}:${this.clock.minute}` !== prev) this.worldDirty = true;
    }
    // timers
    if (this.timers.length) {
      const due = this.timers.filter((t) => t.at <= this.time);
      if (due.length) {
        this.timers = this.timers.filter((t) => t.at > this.time);
        for (const t of due) {
          try {
            t.fn();
          } catch (err) {
            console.error("timer", err);
          }
        }
      }
    }
    // scheman som löpt ut
    for (const s of [...this.schemes.values()]) if (s.endsAt <= this.time) this.endScheme(s.id);
    if (this.banner && this.time > this.bannerUntil) {
      this.banner = null;
      this.worldDirty = true;
    }

    for (const c of this.chars) {
      this.hooks.updateNeeds(this, c, dt);
      // effekter som löpt ut
      for (const [e, until] of c.effects) if (until <= this.time) c.effects.delete(e);
      if (c.item && c.itemUntil && c.itemUntil <= this.time) {
        c.item = null;
        c.itemUntil = 0;
      }
      if (c.icon && c.iconUntil <= this.time) c.icon = null;
      this.runActor(c, dt);
      if (!c.step && !c.queue.length) {
        if (c.ctrl === "ai") this.hooks.decide(this, c);
        else if (c.ctrl === "player") {
          if (!c.playerIdleSince) c.playerIdleSince = this.time;
          if (this.time - c.playerIdleSince > 25) {
            c.ctrl = "ai";
            c.playerIdleSince = 0;
            c.planLabels = [];
            this.addLog(`${c.name} kopplar på autopiloten igen.`, "🤖", "player", c.id);
          }
        } else if (c.ctrl === "scheme" && !c.schemeId) c.ctrl = "ai";
      } else if (c.ctrl === "player") c.playerIdleSince = 0;
      if (c.ctrl === "player") c.planLabels = [c.step?.label, ...c.queue.map((s) => s.label)].filter((x): x is string => !!x);
    }
    for (const n of this.npcs) {
      if (n.kind === "object") continue;
      if (n.until && n.until <= this.time && n.visible) {
        n.visible = false;
        n.queue = [];
        n.step = null;
        n.path = [];
      }
      if (!n.visible) continue;
      this.runActor(n, dt);
      if (!n.step && !n.queue.length) this.hooks.npcThink(this, n);
    }
    this.hooks.worldTick(this, dt);
  }

  // ---------------------------------------------------------------- stegkörning
  private runActor(a: Actor, dt: number) {
    if (a.path.length) this.move(a, dt);
    for (let guard = 0; guard < 12; guard++) {
      if (!a.step) {
        const next = a.queue.shift();
        if (!next) return;
        a.step = next;
        a.stepInit = false;
        a.stepT = 0;
        a.stepData = {};
      }
      const done = this.exec(a, a.step, guard === 0 ? dt : 0);
      if (!done) return;
      a.step = null;
    }
  }

  private move(a: Actor, dt: number) {
    let budget = a.speed * dt;
    while (budget > 0 && a.path.length) {
      const nxt = a.path[0];
      const tx = nxt.x + 0.5;
      const ty = nxt.y + 0.5;
      const dx = tx - a.x;
      const dy = ty - a.y;
      const d = Math.hypot(dx, dy);
      if (d < 1e-3) {
        a.path.shift();
        continue;
      }
      let dir: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? RIGHT : LEFT) : dy > 0 ? DOWN : UP;
      if (a.moonwalk > this.time) dir = dir === RIGHT ? LEFT : dir === LEFT ? RIGHT : dir === UP ? DOWN : UP;
      a.dir = dir;
      if (d <= budget) {
        a.x = tx;
        a.y = ty;
        budget -= d;
        a.path.shift();
      } else {
        a.x += (dx / d) * budget;
        a.y += (dy / d) * budget;
        budget = 0;
      }
    }
    if (a.path.length) {
      a.anim = a.moveAnim ?? (a.speed > 4 ? "run" : "walk");
    }
  }

  private startPath(a: Actor, gx: number, gy: number): boolean {
    const sx = Math.floor(a.x);
    const sy = Math.floor(a.y);
    const p = findPath(this.map, this.cost, sx, sy, gx, gy);
    if (!p) return false;
    a.path = p;
    // börja från mitten av nuvarande ruta för att undvika att skära hörn
    if (p.length && Math.hypot(a.x - (sx + 0.5), a.y - (sy + 0.5)) > 0.15) a.path.unshift({ x: sx, y: sy });
    return true;
  }

  private beginMove(a: Actor, run?: boolean, moveAnim?: Anim, movePose?: Pose, speed?: number) {
    this.release(a);
    a.speed = speed ?? (run ? RUN_SPEED : a.type === "npc" && a.kind === "vacuum" ? 1.4 : WALK_SPEED);
    if (a.type === "char" && a.needs.koffein > 120) a.speed *= 1.6;
    if (a.type === "char" && a.effects.has("tiny")) a.speed *= 0.8;
    a.moveAnim = moveAnim ?? null;
    if (movePose) a.pose = movePose;
  }

  private endMove(a: Actor) {
    a.moveAnim = null;
    if (a.pose === "stand") a.anim = "idle";
    else if (a.pose === "sit") a.anim = "sit";
  }

  /** Kör ett steg. Returnerar true när steget är klart. */
  private exec(a: Actor, s: Step, dt: number): boolean {
    a.stepT += dt;
    const init = !a.stepInit;
    a.stepInit = true;
    switch (s.t) {
      case "go": {
        if (init) {
          this.beginMove(a, s.run, s.moveAnim, s.movePose, s.speed);
          if (!this.startPath(a, s.x, s.y)) {
            this.endMove(a);
            return true;
          }
        }
        if (a.path.length) return false;
        if (s.movePose) a.pose = "stand";
        this.endMove(a);
        if (s.face !== undefined) a.dir = s.face;
        return true;
      }
      case "spot": {
        if (init) {
          const sp = this.findSpot(s.kind, a, { room: s.room, prefer: s.prefer, exceptId: a.id });
          if (!sp) {
            const taken = a.type === "char" && a.ctrl === "player" ? this.evictFor(a, s.kind) : null;
            if (!taken) {
              if (a.type === "char" && (a.ctrl === "player" || Math.random() < 0.1)) this.think(a, "Allt är upptaget...", true);
              return true;
            }
            a.stepData.spot = taken;
            this.beginMove(a, s.run);
            this.spotsTaken.set(taken.id, a.id);
            if (!this.startPath(a, taken.x, taken.y)) {
              this.endMove(a);
              return true;
            }
            return false;
          }
          this.beginMove(a, s.run);
          this.spotsTaken.set(sp.id, a.id);
          a.stepData.spot = sp;
          if (!this.startPath(a, sp.x, sp.y)) {
            this.spotsTaken.delete(sp.id);
            this.endMove(a);
            return true;
          }
        }
        if (a.path.length) return false;
        const sp = a.stepData.spot as Spot;
        this.endMove(a);
        a.spot = sp;
        a.dir = sp.face;
        a.pose = s.pose ?? sp.pose;
        a.anim = s.anim ?? (a.pose === "sit" ? "sit" : a.pose === "lie" ? "sleep" : "idle");
        return true;
      }
      case "toChar": {
        const target = this.actor(s.id);
        if (!target) return true;
        const replan = () => {
          const want = s.dist ?? 1;
          let best: P | null = null;
          let bestD = Infinity;
          const tx = Math.floor(target.x);
          const ty = Math.floor(target.y);
          for (let dy = -want; dy <= want; dy++)
            for (let dx = -want; dx <= want; dx++) {
              if (!dx && !dy) continue;
              const x = tx + dx;
              const y = ty + dy;
              if (!this.walkable(x, y) || this.occupied(x, y, a)) continue;
              const d = Math.hypot(a.x - (x + 0.5), a.y - (y + 0.5)) + (Math.abs(dx) + Math.abs(dy) === 1 ? 0 : 0.6);
              if (d < bestD) {
                bestD = d;
                best = { x, y };
              }
            }
          a.stepData.goal = best;
          a.stepData.tpos = { x: target.x, y: target.y };
          a.stepData.replanAt = a.stepT;
          if (!best) return false;
          return this.startPath(a, best.x, best.y);
        };
        if (init) {
          this.beginMove(a, s.run);
          if (dist(a, target) < 1.6) {
            this.endMove(a);
            this.faceTo(a, target);
            return true;
          }
          if (!replan()) {
            this.endMove(a);
            return true;
          }
          return false;
        }
        const tpos = a.stepData.tpos as P;
        if (dist(tpos, target) > 1.5 && a.stepT - (a.stepData.replanAt as number) > 0.6) {
          if (!replan()) {
            this.endMove(a);
            return true;
          }
        }
        if (a.stepT > 25) {
          a.path = [];
          this.endMove(a);
          return true;
        }
        if (a.path.length) return false;
        this.endMove(a);
        this.faceTo(a, target);
        return true;
      }
      case "follow": {
        const target = this.actor(s.id);
        if (!target || a.stepT > s.dur) {
          a.path = [];
          this.endMove(a);
          return true;
        }
        if (init) this.beginMove(a, s.run, s.moveAnim);
        const lastT = (a.stepData.t as number | undefined) ?? -9;
        if (a.stepT - lastT > 0.45) {
          a.stepData.t = a.stepT;
          if (dist(a, target) > 1.3) {
            const tx = Math.floor(target.x);
            const ty = Math.floor(target.y);
            // gå till rutan bakom målet
            const back: [number, number][] = [
              [0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1],
            ];
            let best: P | null = null;
            let bd = Infinity;
            for (const [dx, dy] of back) {
              const x = tx + dx;
              const y = ty + dy;
              if (!this.walkable(x, y)) continue;
              const d = Math.hypot(a.x - (x + 0.5), a.y - (y + 0.5));
              if (d < bd) {
                bd = d;
                best = { x, y };
              }
            }
            if (best) this.startPath(a, best.x, best.y);
          } else {
            a.path = [];
            this.faceTo(a, target);
            a.anim = s.moveAnim ?? "idle";
          }
        }
        if (!a.path.length) a.anim = s.moveAnim ?? "idle";
        return false;
      }
      case "anim": {
        if (init) {
          a.anim = s.anim;
          if (s.pose) a.pose = s.pose;
          if (a.type === "char") {
            if (s.act) a.act = s.act;
            if (s.icon) this.setIcon(a, s.icon, s.dur);
          }
        } else if (a.anim !== s.anim && a.anim !== "talk") a.anim = s.anim;
        if (a.stepT < s.dur) return false;
        if (a.pose === "sit") a.anim = "sit";
        else if (a.pose === "lie") a.anim = "sleep";
        else a.anim = "idle";
        return true;
      }
      case "say": {
        if (init) this.say(a, s.text, s.style ?? "say", { log: s.log, dur: s.dur, to: s.to });
        return a.stepT >= (s.wait ?? 0.5);
      }
      case "think": {
        if (a.type === "char") this.think(a, s.text);
        else this.say(a, s.text, "think");
        return true;
      }
      case "wait":
        return a.stepT >= s.dur;
      case "face": {
        if (s.dir !== undefined) a.dir = s.dir;
        if (s.toward) {
          const t = this.actor(s.toward);
          if (t) this.faceTo(a, t);
        }
        return true;
      }
      case "item": {
        if (a.type === "char") {
          a.item = s.item;
          a.itemUntil = s.item && s.dur ? this.time + s.dur : 0;
        }
        return true;
      }
      case "fx": {
        const [x, y] = s.at ?? [a.x, a.y - 1];
        this.fx(s.fx, x, y, s.dur ?? 2, s.n ?? 1, s.text);
        return true;
      }
      case "do": {
        const r = s.fn(this, a);
        if (Array.isArray(r)) a.queue = [...r, ...a.queue];
        else if (r && "replace" in r) a.queue = [...r.replace];
        return true;
      }
      case "leave": {
        this.release(a);
        return true;
      }
      case "act": {
        if (a.type === "char") {
          a.act = s.act;
          if (s.icon) this.setIcon(a, s.icon, 8);
        }
        return true;
      }
      case "effect": {
        if (a.type === "char") a.effects.set(s.effect, this.time + s.dur);
        return true;
      }
      case "needs": {
        if (a.type === "char") for (const [k, v] of Object.entries(s.d)) a.needs[k as keyof Needs] = clamp(a.needs[k as keyof Needs] + (v as number), 0, 200);
        return true;
      }
      case "teleport": {
        this.release(a);
        a.path = [];
        a.x = s.x + 0.5;
        a.y = s.y + 0.5;
        return true;
      }
    }
  }

  faceTo(a: Actor, t: { x: number; y: number }) {
    const dx = t.x - a.x;
    const dy = t.y - a.y;
    a.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? RIGHT : LEFT) : dy > 0 ? DOWN : UP;
  }

  // ---------------------------------------------------------------- utdata
  snapChars(): CharSnap[] {
    return this.chars.map((c) => {
      const s: CharSnap = { i: c.id, x: Math.round(c.x * 100) / 100, y: Math.round(c.y * 100) / 100, d: c.dir, a: c.anim, p: c.pose };
      if (c.item) s.h = c.item;
      if (c.effects.size) s.e = [...c.effects.keys()];
      if (c.icon) s.ic = c.icon;
      return s;
    });
  }

  snapNpcs(): NpcSnap[] {
    return this.npcs.map((n) => ({ i: n.id, k: n.kind, x: Math.round(n.x * 100) / 100, y: Math.round(n.y * 100) / 100, d: n.dir, a: n.anim, v: n.visible }));
  }

  mood(c: Char): [string, string] {
    const n = c.needs;
    if (c.effects.has("gold")) return ["Gudomlig", "✨"];
    if (n.koffein > 120) return ["Koffeinchock", "⚡"];
    if (n.kaos > 80) return ["Kaotisk", "🌀"];
    if (n.energi < 18) return ["Utmattad", "😴"];
    if (n.hunger > 82) return ["Hangry", "🍔"];
    if (n.koffein < 12) return ["Kaffeabstinens", "☕"];
    if (n.socialt < 15) return ["Ensam", "🥺"];
    if (n.inspiration > 82) return ["Inspirerad", "💡"];
    if (n.fokus > 78) return ["I flow", "🎧"];
    if (n.kaos > 60) return ["Rastlös", "🔥"];
    const avg = (n.koffein + n.energi + n.socialt + n.inspiration + (100 - n.hunger)) / 5;
    if (avg > 65) return ["Pigg och glad", "😄"];
    if (avg > 45) return ["Nöjd", "🙂"];
    return ["Lite seg", "😐"];
  }

  details(): CharDetail[] {
    return this.chars.map((c) => {
      const [mood, moodIcon] = this.mood(c);
      const rel = Object.entries(c.rel)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .slice(0, 5)
        .map(([k, v]) => [k, Math.round(v)] as [string, number]);
      const needs = Object.fromEntries(Object.entries(c.needs).map(([k, v]) => [k, Math.round(Math.min(100, v))])) as unknown as Needs;
      return {
        i: c.id,
        act: c.act,
        thought: c.thought,
        mood,
        moodIcon,
        needs,
        ctrl: c.ctrl,
        rel,
        mem: c.mem.slice(-4).reverse(),
        room: this.roomOf(c)?.name ?? "Någonstans",
        online: c.online,
      };
    });
  }

  nightFactor(): number {
    const h = this.clock.hour + this.clock.minute / 60;
    if (h >= 7.5 && h < 16.5) return 0;
    if (h >= 16.5 && h < 19) return ((h - 16.5) / 2.5) * 0.85;
    if (h >= 19 || h < 5.5) return 0.85;
    return 0.85 * (1 - (h - 5.5) / 2);
  }

  worldState(): WorldState {
    const pad = (n: number) => String(n).padStart(2, "0");
    return {
      clock: `${pad(this.clock.hour)}:${pad(this.clock.minute)}`,
      weekday: this.clock.weekday,
      night: Math.round(this.nightFactor() * 100) / 100,
      lights: this.lights,
      disco: this.disco,
      alarm: this.alarm,
      weather: this.weather,
      coffeeBroken: this.coffeeBroken,
      plantSize: Math.round(this.plantSize * 100) / 100,
      stats: { ...this.stats },
      banner: this.banner,
      special: this.special,
      music: { ...this.music },
    };
  }

  flush(): GameEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  // ---------------------------------------------------------------- persistens
  serialize(): string {
    return JSON.stringify({
      v: 1,
      savedAt: Date.now(),
      chars: this.chars.map((c) => ({
        id: c.id,
        x: c.x,
        y: c.y,
        needs: c.needs,
        mem: c.mem,
        rel: c.rel,
        coffees: c.coffees,
        mugHidden: c.mugHidden,
        thought: c.thought,
      })),
      state: { plantSize: this.plantSize, stats: this.stats, weather: this.weather, logSeq: this.logSeq, music: this.music },
    });
  }

  restore(json: string): number {
    try {
      const d = JSON.parse(json) as {
        savedAt: number;
        chars: { id: string; x: number; y: number; needs: Needs; mem: string[]; rel: Record<string, number>; coffees: number; mugHidden: Char["mugHidden"]; thought: string }[];
        state: { plantSize: number; stats: World["stats"]; weather: World["weather"]; logSeq: number; music?: MusicState };
      };
      for (const s of d.chars) {
        const c = this.byId.get(s.id);
        if (!c) continue;
        c.needs = { ...c.needs, ...s.needs };
        c.mem = s.mem ?? [];
        c.rel = { ...c.rel, ...s.rel };
        c.coffees = s.coffees ?? 0;
        c.mugHidden = s.mugHidden ?? null;
        c.thought = s.thought ?? c.thought;
        const tx = Math.floor(s.x);
        const ty = Math.floor(s.y);
        const spot = this.map.spots.find((q) => q.x === tx && q.y === ty && (q.pose === "sit" || q.pose === "lie"));
        if (spot && !this.spotsTaken.has(spot.id)) this.seat(c, spot);
        else if (this.walkable(tx, ty)) {
          this.release(c);
          c.x = tx + 0.5;
          c.y = ty + 0.5;
        }
      }
      this.plantSize = d.state.plantSize ?? 1;
      this.stats = { ...this.stats, ...d.state.stats };
      this.weather = d.state.weather ?? this.weather;
      this.logSeq = Math.max(this.logSeq, d.state.logSeq ?? 1);
      if (d.state.music && TRACK_BY_ID[d.state.music.track]) this.music = { ...d.state.music };
      return d.savedAt ?? Date.now();
    } catch (err) {
      console.error("restore", err);
      return Date.now();
    }
  }
}

export { ROOM_BY_ID, UP, DOWN, LEFT, RIGHT };
