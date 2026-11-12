// GameView – canvas-renderaren för SimVariant.
import type { WorldStore } from "../net.ts";
import { CONSULTANT_BY_ID, NPCS } from "../../shared/consultants.ts";
import { T_VOID, T_WINDOW, TILE } from "../../shared/map.ts";
import type { CharSnap, NpcSnap, WorldState } from "../../shared/protocol.ts";
import {
  BW,
  drawExtras,
  drawShadow,
  FOOT_X,
  FOOT_Y,
  getFigure,
  itemSprite,
  npcLook,
  npcSprite,
  phaseOf,
  poseFor,
} from "./characters.ts";
import { bengtSprite, buildFurniture, drawFurnDyn, drawWallDyn, KIND_LABEL, overheadSprite, type FurnDrawable } from "./furniture.ts";
import { drawFx } from "./fx.ts";
import { drawBubbles, drawDisco, drawLighting, drawNameTag, drawRetro, drawWeather, FONT, type Light } from "./overlay.ts";
import { ellipse, hash, R } from "./pixel.ts";
import { buildStatic, M, type StaticWorld } from "./staticLayer.ts";

export { renderPortrait } from "./characters.ts";

export interface GameViewOptions {
  store: WorldStore;
  onSelect: (id: string | null) => void;
  onHover?: (id: string | null) => void;
  onPoke: (what: string, label: string) => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
const NPC_BY_ID = new Map(NPCS.map((n) => [n.id, n]));

type Drawable =
  | { y: number; k: 0; d: FurnDrawable }
  | { y: number; k: 1; d: FurnDrawable }
  | { y: number; k: 2; s: CharSnap }
  | { y: number; k: 3; n: NpcSnap };

interface Anchor {
  hx: number; // huvudets topp (världspixel)
  hy: number;
  fx: number; // fötter
  fy: number;
  w: number; // halv bredd för träffyta
  h: number;
}

export class GameView {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private opts: GameViewOptions;
  private store: WorldStore;
  private sw: StaticWorld;
  private furn: ReturnType<typeof buildFurniture>;
  private seatVertical = new Set<number>();
  private camX: number;
  private camY: number;
  private zoom = 2;
  private targetZoom = 2;
  private dpr = 1;
  private cssW = 1;
  private cssH = 1;
  private selected: string | null = null;
  private follow: string | null = null;
  private mine: string | null = null;
  private hover: string | null = null;
  private showNames = false;
  private retro = false;
  private raf = 0;
  private lastT = 0;
  private lastWheel = 0;
  private pointers = new Map<number, { x: number; y: number }>();
  private drag: { x: number; y: number; camX: number; camY: number; moved: boolean } | null = null;
  private pinch: { d: number; zoom: number; mx: number; my: number; wx: number; wy: number } | null = null;
  private keys = new Set<string>();
  private anchors = new Map<string, Anchor>();
  private drawables: Drawable[] = [];
  private trails = new Map<string, [number, number][]>();
  private mini: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; last: number; cleanup: () => void } | null = null;
  private ro: ResizeObserver;
  private cleanup: (() => void)[] = [];
  private flash = { v: 0 };
  private initialized = false;

  constructor(canvas: HTMLCanvasElement, opts: GameViewOptions) {
    this.canvas = canvas;
    this.opts = opts;
    this.store = opts.store;
    this.ctx = canvas.getContext("2d")!;
    this.sw = buildStatic();
    this.furn = buildFurniture(this.sw.map);
    for (const f of this.sw.map.furniture)
      if ((f.kind === "sofa" || f.kind === "bench") && f.h > f.w)
        for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) this.seatVertical.add(y * 1000 + x);
    this.camX = (20 + M) * TILE;
    this.camY = (36 + M) * TILE;
    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.bindInput();
    this.raf = requestAnimationFrame(this.frame);
  }

  // ------------------------------------------------------------------ API

  setSelected(id: string | null) {
    this.selected = id;
  }
  setFollow(id: string | null) {
    this.follow = id;
  }
  getFollow() {
    return this.follow;
  }
  setMine(id: string | null) {
    this.mine = id;
  }
  setShowNames(on: boolean) {
    this.showNames = on;
  }
  setRetro(on: boolean) {
    this.retro = on;
  }
  centerOn(id: string) {
    const p = this.posOf(id);
    if (p) {
      this.camX = p[0];
      this.camY = p[1] - 10;
    }
  }
  zoomBy(steps: number) {
    const z = this.clampZoom(Math.round((this.targetZoom + steps * 0.5) * 2) / 2);
    this.targetZoom = z;
    this.lastWheel = 0;
  }
  attachMinimap(canvas: HTMLCanvasElement) {
    this.mini?.cleanup();
    const ctx = canvas.getContext("2d")!;
    let down = false;
    const move = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const { s, ox, oy } = this.miniLayout(r.width, r.height);
      const tx = (e.clientX - r.left - ox) / s;
      const ty = (e.clientY - r.top - oy) / s;
      this.camX = (tx + M) * TILE;
      this.camY = (ty + M) * TILE;
      this.follow = null;
    };
    const pd = (e: PointerEvent) => {
      down = true;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      move(e);
      e.preventDefault();
      e.stopPropagation();
    };
    const pm = (e: PointerEvent) => {
      if (down) move(e);
    };
    const pu = () => {
      down = false;
    };
    canvas.addEventListener("pointerdown", pd);
    canvas.addEventListener("pointermove", pm);
    canvas.addEventListener("pointerup", pu);
    canvas.addEventListener("pointercancel", pu);
    this.mini = {
      canvas,
      ctx,
      last: 0,
      cleanup: () => {
        canvas.removeEventListener("pointerdown", pd);
        canvas.removeEventListener("pointermove", pm);
        canvas.removeEventListener("pointerup", pu);
        canvas.removeEventListener("pointercancel", pu);
      },
    };
  }
  destroy() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    for (const c of this.cleanup) c();
    this.mini?.cleanup();
    this.mini = null;
  }

  // ------------------------------------------------------------------ kamera

  private clampZoom(z: number) {
    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
  }

  private resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    this.cssW = Math.max(1, r.width);
    this.cssH = Math.max(1, r.height);
    const w = Math.round(this.cssW * this.dpr);
    const h = Math.round(this.cssH * this.dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    if (!this.initialized && this.cssW > 10) {
      this.initialized = true;
      const z = Math.round(Math.max(1.5, Math.min(3.5, this.cssW / (30 * TILE))) * 2) / 2;
      this.zoom = this.targetZoom = z;
    }
  }

  private screenToWorld(sx: number, sy: number): [number, number] {
    return [(sx - this.cssW / 2) / this.zoom + this.camX, (sy - this.cssH / 2) / this.zoom + this.camY];
  }

  private worldToScreen(wx: number, wy: number): [number, number] {
    return [(wx - this.camX) * this.zoom + this.cssW / 2, (wy - this.camY) * this.zoom + this.cssH / 2];
  }

  private zoomAt(sx: number, sy: number, factor: number) {
    const [wx, wy] = this.screenToWorld(sx, sy);
    this.zoom = this.targetZoom = this.clampZoom(this.zoom * factor);
    this.camX = wx - (sx - this.cssW / 2) / this.zoom;
    this.camY = wy - (sy - this.cssH / 2) / this.zoom;
    this.lastWheel = performance.now();
  }

  private clampCam() {
    const pad = 4 * TILE;
    this.camX = Math.max(pad, Math.min(this.sw.W - pad, this.camX));
    this.camY = Math.max(pad, Math.min(this.sw.H - pad, this.camY));
  }

  private posOf(id: string): [number, number] | null {
    const a = this.anchors.get(id);
    if (a) return [a.fx, a.fy];
    const { chars, npcs } = this.store.sample(performance.now());
    const c = chars.find((q) => q.i === id) ?? npcs.find((q) => q.i === id);
    return c ? [(c.x + M) * TILE, (c.y + M) * TILE] : null;
  }

  // ------------------------------------------------------------------ input

  private bindInput() {
    const cv = this.canvas;
    cv.style.touchAction = "none";
    const local = (e: PointerEvent | WheelEvent | MouseEvent) => {
      const r = cv.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top] as [number, number];
    };
    const pd = (e: PointerEvent) => {
      try {
        cv.setPointerCapture(e.pointerId);
      } catch {
        /* syntetiska händelser */
      }
      const [x, y] = local(e);
      this.pointers.set(e.pointerId, { x, y });
      if (this.pointers.size === 1) {
        this.drag = { x, y, camX: this.camX, camY: this.camY, moved: false };
      } else if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const [wx, wy] = this.screenToWorld(mx, my);
        this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.zoom, mx, my, wx, wy };
        if (this.drag) this.drag.moved = true;
      }
    };
    const pm = (e: PointerEvent) => {
      const [x, y] = local(e);
      if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x, y });
      if (this.pinch && this.pointers.size >= 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        this.zoom = this.targetZoom = this.clampZoom(this.pinch.zoom * (d / Math.max(10, this.pinch.d)));
        this.camX = this.pinch.wx - (mx - this.cssW / 2) / this.zoom;
        this.camY = this.pinch.wy - (my - this.cssH / 2) / this.zoom;
        this.lastWheel = performance.now();
        this.follow = null;
        return;
      }
      if (this.drag && this.pointers.size === 1) {
        const dx = x - this.drag.x;
        const dy = y - this.drag.y;
        if (!this.drag.moved && Math.hypot(dx, dy) > 5) {
          this.drag.moved = true;
          this.follow = null;
        }
        if (this.drag.moved) {
          this.camX = this.drag.camX - dx / this.zoom;
          this.camY = this.drag.camY - dy / this.zoom;
          cv.style.cursor = "grabbing";
        }
        return;
      }
      // hover
      const hit = this.hitActor(x, y);
      if (hit !== this.hover) {
        this.hover = hit;
        this.opts.onHover?.(hit);
      }
      cv.style.cursor = hit || this.hitFurniture(x, y) ? "pointer" : "grab";
    };
    const pu = (e: PointerEvent) => {
      const [x, y] = local(e);
      const wasDrag = this.drag?.moved ?? false;
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      if (this.pointers.size === 0) {
        if (this.drag && !wasDrag) this.click(x, y);
        this.drag = null;
        cv.style.cursor = "grab";
      } else if (this.pointers.size === 1) {
        const [p] = [...this.pointers.values()];
        this.drag = { x: p.x, y: p.y, camX: this.camX, camY: this.camY, moved: true };
      }
    };
    const pl = () => {
      if (this.hover) {
        this.hover = null;
        this.opts.onHover?.(null);
      }
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const [x, y] = local(e);
      if (e.ctrlKey) {
        this.zoomAt(x, y, Math.exp(-e.deltaY * 0.012));
      } else if (e.deltaMode === 0 && (Math.abs(e.deltaX) > 0.5 || (Math.abs(e.deltaY) < 50 && !Number.isInteger(e.deltaY)))) {
        this.camX += e.deltaX / this.zoom;
        this.camY += e.deltaY / this.zoom;
        this.follow = null;
      } else {
        this.zoomAt(x, y, e.deltaY < 0 ? 1.2 : 1 / 1.2);
      }
    };
    const isTyping = () => {
      const a = document.activeElement as HTMLElement | null;
      return !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT" || a.isContentEditable);
    };
    const kd = (e: KeyboardEvent) => {
      if (isTyping() || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(k)) {
        this.keys.add(k);
        this.follow = null;
        e.preventDefault();
      } else if (k === "+" || k === "=") this.zoomBy(1);
      else if (k === "-" || k === "_") this.zoomBy(-1);
    };
    const ku = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
    const blur = () => this.keys.clear();
    cv.addEventListener("pointerdown", pd);
    cv.addEventListener("pointermove", pm);
    cv.addEventListener("pointerup", pu);
    cv.addEventListener("pointercancel", pu);
    cv.addEventListener("pointerleave", pl);
    cv.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    window.addEventListener("blur", blur);
    cv.style.cursor = "grab";
    this.cleanup.push(() => {
      cv.removeEventListener("pointerdown", pd);
      cv.removeEventListener("pointermove", pm);
      cv.removeEventListener("pointerup", pu);
      cv.removeEventListener("pointercancel", pu);
      cv.removeEventListener("pointerleave", pl);
      cv.removeEventListener("wheel", wheel);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      window.removeEventListener("blur", blur);
    });
  }

  private hitActor(sx: number, sy: number): string | null {
    const [wx, wy] = this.screenToWorld(sx, sy);
    let best: string | null = null;
    let bestY = -Infinity;
    for (const [id, a] of this.anchors) {
      if (a.w <= 0) continue;
      if (wx >= a.fx - a.w && wx <= a.fx + a.w && wy >= a.fy - a.h && wy <= a.fy + 2 && a.fy > bestY) {
        best = id;
        bestY = a.fy;
      }
    }
    return best;
  }

  private hitFurniture(sx: number, sy: number): FurnDrawable | null {
    const [wx, wy] = this.screenToWorld(sx, sy);
    let best: FurnDrawable | null = null;
    for (const d of this.furn.items) {
      const [x0, y0, x1, y1] = d.hit;
      if (wx >= x0 && wx < x1 && wy >= y0 && wy < y1) if (!best || d.sortY > best.sortY) best = d;
    }
    return best;
  }

  private click(sx: number, sy: number) {
    const actor = this.hitActor(sx, sy);
    if (actor) {
      this.opts.onSelect(actor);
      return;
    }
    const f = this.hitFurniture(sx, sy);
    if (f) {
      const label = f.isBengt ? "Bengt (fikusen)" : f.f.label ?? KIND_LABEL[f.f.kind];
      this.opts.onPoke(f.f.kind, label);
      return;
    }
    const [wx, wy] = this.screenToWorld(sx, sy);
    const tx = Math.floor(wx / TILE) - M;
    const ty = Math.floor(wy / TILE) - M;
    const map = this.sw.map;
    for (const f2 of map.furniture) {
      if (!f2.wall) continue;
      if (tx >= f2.x && tx < f2.x + f2.w && ty >= f2.y && ty < f2.y + f2.h) {
        if (f2.kind === "elevator") this.opts.onPoke("elevator", "Hissen");
        else this.opts.onPoke(f2.kind, f2.label ?? KIND_LABEL[f2.kind]);
        return;
      }
    }
    const inMap = tx >= 0 && ty >= 0 && tx < map.w && ty < map.h;
    const t = inMap ? map.tiles[ty * map.w + tx] : T_VOID;
    if (t === T_WINDOW) {
      this.opts.onPoke("window", "Fönstret");
      return;
    }
    if (t === T_VOID) {
      this.opts.onPoke("outside", "Barnhusgatan");
      return;
    }
    this.opts.onSelect(null);
  }

  // ------------------------------------------------------------------ loop

  private frame = (nowMs: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const now = nowMs;
    const dt = Math.min(0.1, this.lastT ? (now - this.lastT) / 1000 : 0.016);
    this.lastT = now;
    try {
      this.render(now, dt);
    } catch (err) {
      console.error("Renderfel", err);
    }
  };

  private render(now: number, dt: number) {
    const t = now / 1000;
    const ctx = this.ctx;
    const store = this.store;
    const world = store.world;
    const { chars, npcs } = store.sample(now);

    // kamera: tangenter, följ, zoom
    const pan = (500 / this.zoom) * dt;
    if (this.keys.has("arrowleft") || this.keys.has("a")) this.camX -= pan;
    if (this.keys.has("arrowright") || this.keys.has("d")) this.camX += pan;
    if (this.keys.has("arrowup") || this.keys.has("w")) this.camY -= pan;
    if (this.keys.has("arrowdown") || this.keys.has("s")) this.camY += pan;
    if (this.follow) {
      const c = chars.find((q) => q.i === this.follow) ?? npcs.find((q) => q.i === this.follow);
      if (c) {
        const tx = (c.x + M) * TILE;
        const ty = (c.y + M) * TILE - 10;
        const k = 1 - Math.exp(-dt * 4);
        this.camX += (tx - this.camX) * k;
        this.camY += (ty - this.camY) * k;
      }
    }
    if (!this.pinch && now - this.lastWheel > 450) {
      const snapped = Math.round(this.targetZoom * 2) / 2;
      this.targetZoom = this.clampZoom(snapped);
    }
    if (Math.abs(this.targetZoom - this.zoom) > 0.001) {
      this.zoom += (this.targetZoom - this.zoom) * (1 - Math.exp(-dt * 14));
      if (Math.abs(this.targetZoom - this.zoom) < 0.002) this.zoom = this.targetZoom;
    }
    this.clampCam();

    const dpr = this.dpr;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const s = this.zoom * dpr;
    const ox = Math.round((this.cssW / 2) * dpr - this.camX * s);
    const oy = Math.round((this.cssH / 2) * dpr - this.camY * s);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#14161c";
    ctx.fillRect(0, 0, W, H);
    ctx.setTransform(s, 0, 0, s, ox, oy);
    ctx.imageSmoothingEnabled = false;
    const vx0 = -ox / s;
    const vy0 = -oy / s;
    const vx1 = vx0 + W / s;
    const vy1 = vy0 + H / s;

    ctx.drawImage(this.sw.base, 0, 0);
    this.drawStreetLife(ctx, t, world?.night ?? 0);
    ctx.drawImage(this.sw.canopy, 0, 0);
    const night = world?.night ?? 0;
    const dayK = (1 - night) * (world?.weather === "regn" || world?.weather === "moln" ? 0.45 : 1);
    if (dayK > 0.02) {
      ctx.globalAlpha = 0.32 * dayK;
      ctx.drawImage(this.sw.sun, 0, 0);
      ctx.globalAlpha = 1;
    }
    for (const f of this.furn.wallDyn) drawWallDyn(ctx, f, t, world);

    // y-sortering
    const list = this.drawables;
    list.length = 0;
    const margin = 48;
    for (const d of this.furn.items) {
      const [x0, y0, x1, y1] = d.hit;
      if (x1 < vx0 - margin || x0 > vx1 + margin || y1 < vy0 - margin || y0 > vy1 + margin + 40) continue;
      list.push({ y: d.sortY, k: 0, d });
      if (d.back) list.push({ y: d.back.sortY, k: 1, d });
    }
    this.anchors.clear();
    for (const c of chars) {
      const fy = (c.y + M) * TILE;
      list.push({ y: fy + 0.01, k: 2, s: c });
    }
    for (const n of npcs) list.push({ y: (n.y + M) * TILE + 0.005, k: 3, n });
    list.sort((a, b) => a.y - b.y);

    for (const it of list) {
      if (it.k === 0) {
        const d = it.d;
        if (d.isBengt) {
          const img = bengtSprite(world?.plantSize ?? 1);
          ctx.drawImage(img, d.dx, d.dy - 24);
        } else ctx.drawImage(d.img, d.dx, d.dy);
        if (d.dyn) drawFurnDyn(ctx, d, t, world);
      } else if (it.k === 1) {
        ctx.drawImage(it.d.back!.img, it.d.dx, it.d.dy);
      } else if (it.k === 2) {
        this.drawChar(ctx, it.s, t);
      } else {
        this.drawNpc(ctx, it.n, t);
      }
    }

    // taklampor
    for (const f of this.furn.overhead) {
      const img = overheadSprite(f);
      const cx = (f.x + M) * TILE + 8;
      const cy = (f.y + M) * TILE + 8;
      ctx.globalAlpha = 0.95;
      ctx.drawImage(img, cx - 16, cy - 74);
      ctx.globalAlpha = 1;
    }

    // effekter
    drawFx(ctx, store.activeFx(now), now, this.flash);
    if (world?.disco) drawDisco(ctx, this.sw, world.disco, t);
    if (world) drawWeather(ctx, this.sw, world, t, [vx0, vy0, vx1, vy1]);
    this.drawMineMarker(ctx, t);

    // ljus
    if (world) {
      let dark = night * 0.8;
      if (!world.lights) dark = Math.max(dark, 0.55) + 0.2;
      dark = Math.min(0.9, dark);
      if (dark > 0.01) drawLighting(ctx, W, H, dark, this.collectLights(world, s, ox, oy, night));
      if (world.alarm) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const pulse = 0.5 + 0.5 * Math.sin(t * 9);
        ctx.fillStyle = `rgba(255,30,40,${0.12 + 0.18 * pulse})`;
        ctx.fillRect(0, 0, W, H);
        const bw = Math.max(6, Math.round(10 * dpr));
        ctx.fillStyle = `rgba(255,40,40,${0.35 + 0.4 * pulse})`;
        ctx.fillRect(0, 0, W, bw);
        ctx.fillRect(0, H - bw, W, bw);
        ctx.fillRect(0, 0, bw, H);
        ctx.fillRect(W - bw, 0, bw, H);
      }
    }
    if (this.flash.v > 0.01) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = `rgba(255,255,255,${this.flash.v * 0.7})`;
      ctx.fillRect(0, 0, W, H);
      this.flash.v *= Math.exp(-dt * 8);
    }

    // skärmlager (CSS-pixlar)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    const bubbles = store.activeBubbles(now);
    const talking = new Set(bubbles.map((b) => b.i));
    for (const c of chars) {
      const a = this.anchors.get(c.i);
      if (!a) continue;
      const con = CONSULTANT_BY_ID[c.i];
      if (!con) continue;
      const [sx, sy] = this.worldToScreen(a.fx, a.fy);
      if (sx < -60 || sy < -60 || sx > this.cssW + 60 || sy > this.cssH + 60) continue;
      const strong = c.i === this.mine;
      if (this.showNames || c.i === this.hover || c.i === this.selected || c.i === this.follow || strong) {
        drawNameTag(ctx, sx, sy + 3, con.first, con.color, strong);
      }
      if (c.ic && !talking.has(c.i)) {
        const [hx, hy] = this.worldToScreen(a.hx, a.hy);
        ctx.font = `${Math.round(10 + this.zoom * 1.5)}px ${FONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(c.ic, hx + 6 * this.zoom * 0.5, hy - 2);
        ctx.textAlign = "left";
      }
    }
    for (const n of npcs) {
      const a = this.anchors.get(n.i);
      if (!a || a.w <= 0) continue;
      if (n.i === this.hover || n.i === this.selected || n.i === this.follow || this.showNames) {
        const info = NPC_BY_ID.get(n.i);
        const [sx, sy] = this.worldToScreen(a.fx, a.fy);
        drawNameTag(ctx, sx, sy + 3, info?.name ?? n.i, "#cfd8ff", false);
      }
    }
    // flytande texter från effekter
    for (const f of store.activeFx(now)) {
      if (!f.text) continue;
      const p = Math.min(1, (now - f.start) / Math.max(1, f.end - f.start));
      const [sx, sy] = this.worldToScreen((f.x + M) * TILE, (f.y + M) * TILE - 28);
      ctx.globalAlpha = 1 - p * p;
      ctx.font = `bold 14px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#1d1b26";
      ctx.strokeText(f.text, sx, sy - p * 30);
      ctx.fillStyle = "#ffe066";
      ctx.fillText(f.text, sx, sy - p * 30);
      ctx.textAlign = "left";
      ctx.globalAlpha = 1;
    }
    drawBubbles(
      ctx,
      bubbles,
      (id) => {
        const a = this.anchors.get(id);
        if (!a) return null;
        const [x, y] = this.worldToScreen(a.hx, a.hy);
        return { x, y };
      },
      now,
      this.cssW,
      this.cssH,
    );
    if (this.retro) drawRetro(ctx, W, H, t);
    if (this.mini) this.drawMinimap(now, chars, npcs);
  }

  // ------------------------------------------------------------------ figurer

  private drawChar(ctx: CanvasRenderingContext2D, c: CharSnap, t: number) {
    const con = CONSULTANT_BY_ID[c.i];
    if (!con) return;
    const fx = Math.round((c.x + M) * TILE);
    const fy = Math.round((c.y + M) * TILE);
    const phase = phaseOf(c.i);
    const vertSeat = this.seatVertical.has(Math.floor(c.y) * 1000 + Math.floor(c.x));
    const ps = poseFor(c, t, phase, vertSeat);
    const fig = getFigure(c.i, con.look, ps.o, ps.tint);
    const e = c.e ?? [];
    const scale = e.includes("tiny") ? 0.6 : e.includes("giant") ? 1.7 : 1;
    const ghost = e.includes("ghost");
    let sitShift = 0;
    if (c.p === "sit") sitShift = c.d === 1 ? 1 : c.d === 0 ? 3 : 2;
    const yo = ps.yo + sitShift;

    // trail
    if (e.includes("rainbow")) {
      let tr = this.trails.get(c.i);
      if (!tr) this.trails.set(c.i, (tr = []));
      const last = tr[tr.length - 1];
      if (!last || Math.hypot(last[0] - fx, last[1] - fy) > 2) tr.push([fx, fy]);
      if (tr.length > 24) tr.shift();
      const cols = ["#ff4d4d", "#ff9f1c", "#ffd23f", "#3ddc84", "#4cc9f0", "#7f5af0"];
      for (let i = 0; i < tr.length; i++) {
        ctx.globalAlpha = (i / tr.length) * 0.8;
        for (let k = 0; k < 6; k++) R(ctx, tr[i][0] - 3 + k, tr[i][1] - 6, 1, 2, cols[k]);
      }
      ctx.globalAlpha = 1;
    } else this.trails.delete(c.i);

    if (c.i === this.selected) {
      const col = con.color;
      const r = Math.round(7 * scale);
      ctx.globalAlpha = 0.85;
      for (let a = 0; a < 16; a++) {
        if ((a + Math.floor(t * 8)) % 4 === 0) continue;
        const ang = (a / 16) * Math.PI * 2;
        R(ctx, Math.round(fx + Math.cos(ang) * r), Math.round(fy + Math.sin(ang) * r * 0.45), 1, 1, col);
      }
      ctx.globalAlpha = 1;
    }
    if (c.i === this.mine || e.includes("mine")) {
      ctx.globalAlpha = 0.25 + 0.1 * Math.sin(t * 3);
      ellipse(ctx, fx, fy, 9, 4, "#ffe066");
      ctx.globalAlpha = 1;
    }
    if (e.includes("gold")) {
      const g = ctx.createRadialGradient(fx, fy - 12, 2, fx, fy - 12, 20);
      g.addColorStop(0, `rgba(255,214,90,${0.55 + 0.2 * Math.sin(t * 5)})`);
      g.addColorStop(1, "rgba(255,214,90,0)");
      ctx.fillStyle = g;
      ctx.fillRect(fx - 20, fy - 32, 40, 40);
    }
    if (!ps.horizontal && !ps.o.lie && c.p !== "sit") drawShadow(ctx, fx, fy, ps.shadowScale * scale);

    if (ghost) ctx.globalAlpha = 0.45;
    let headX = fx;
    let headY = fy - FOOT_Y + fig.head + yo;
    if (ps.horizontal) {
      ctx.save();
      ctx.translate(fx, fy - 5 + ps.yo);
      ctx.rotate(-Math.PI / 2);
      ctx.drawImage(fig.img, -10, -14);
      ctx.restore();
      headX = fx - 12;
      headY = fy - 12;
    } else if (ps.o.lie) {
      ctx.drawImage(fig.img, fx - FOOT_X, fy - FOOT_Y + 9);
      headY = fy - FOOT_Y + 9 + 2;
    } else if (scale !== 1) {
      const w = BW * scale;
      const h = 28 * scale;
      ctx.drawImage(fig.img, Math.round(fx - FOOT_X * scale + ps.xo), Math.round(fy - FOOT_Y * scale + yo), w, h);
      headY = fy - FOOT_Y * scale + fig.head * scale + yo;
    } else {
      ctx.drawImage(fig.img, fx - FOOT_X + ps.xo, fy - FOOT_Y + yo);
    }
    if (ghost) ctx.globalAlpha = 1;

    // föremål i handen
    if (c.h && !(c.h === "vr" && (c.a === "vr" || ps.o.vr)) && !ps.horizontal && !ps.o.lie) {
      const img = itemSprite(c.h);
      const hx = fx - FOOT_X + fig.hand[0] * scale + ps.xo;
      const hy = fy - FOOT_Y + fig.hand[1] * scale + yo;
      ctx.drawImage(img, Math.round(hx - 6), Math.round(hy - 8));
      if (c.h === "kaffe") {
        const p = (t * 0.8 + phaseOf(c.i)) % 1;
        ctx.globalAlpha = 0.6 * (1 - p);
        R(ctx, Math.round(hx - 1 + Math.sin(p * 6) * 1), Math.round(hy - 7 - p * 6), 1, 2, "#ffffff");
        ctx.globalAlpha = 1;
      }
    }
    drawExtras(ctx, ps, fx + ps.xo, fy + yo, t);

    // effekter på figuren
    if (e.includes("fire")) {
      for (let i = 0; i < 7; i++) {
        const p = (t * 2 + i / 7) % 1;
        R(ctx, Math.round(headX - 3 + (i % 4) * 2 + Math.sin(t * 9 + i)), Math.round(headY - 1 - p * 7), 2, 2, p < 0.3 ? "#fff3a8" : p < 0.6 ? "#ffb347" : "#ff5b2f");
      }
    }
    if (e.includes("wet")) {
      for (let i = 0; i < 3; i++) {
        const p = (t * 1.5 + i / 3) % 1;
        R(ctx, fx - 5 + i * 5, Math.round(fy - 16 + p * 14), 1, 2, "#7fc8ff");
      }
    }
    if (e.includes("sparkle") || e.includes("gold")) {
      for (let i = 0; i < 4; i++) {
        if (Math.sin(t * 7 + i * 2) < 0.3) continue;
        const a = i * 1.7 + t;
        R(ctx, Math.round(fx + Math.cos(a) * 9), Math.round(fy - 12 + Math.sin(a) * 10), 1, 1, "#fff6a8");
      }
    }
    if (e.includes("zzz") || c.a === "sleep") {
      for (let i = 0; i < 2; i++) {
        const p = (t * 0.6 + i / 2) % 1;
        ctx.globalAlpha = 1 - p;
        const zx = Math.round(headX + 5 + p * 7);
        const zy = Math.round(headY - 3 - p * 10);
        R(ctx, zx, zy, 3, 1, "#cfd8ff");
        R(ctx, zx + 1, zy + 1, 1, 1, "#cfd8ff");
        R(ctx, zx, zy + 2, 3, 1, "#cfd8ff");
      }
      ctx.globalAlpha = 1;
    }

    this.anchors.set(c.i, {
      hx: headX,
      hy: headY,
      fx,
      fy,
      w: 7 * scale,
      h: ps.horizontal ? 12 : 25 * scale,
    });
  }

  private drawNpc(ctx: CanvasRenderingContext2D, n: NpcSnap, t: number) {
    const fx = Math.round((n.x + M) * TILE);
    const fy = Math.round((n.y + M) * TILE);
    if (n.k === "object") {
      this.anchors.set(n.i, { hx: fx, hy: fy - 16, fx, fy, w: 0, h: 0 });
      return;
    }
    if (!n.v) {
      this.anchors.set(n.i, { hx: fx, hy: fy - 20, fx, fy, w: 0, h: 0 });
      return;
    }
    const look = npcLook(n.k);
    if (look) {
      const ps = poseFor({ i: n.i, x: n.x, y: n.y, d: n.d, a: n.a, p: "stand", h: n.k === "courier" ? "kartong" : undefined }, t, phaseOf(n.i), false);
      const fig = getFigure("npc_" + n.i, look, ps.o);
      drawShadow(ctx, fx, fy, 1);
      ctx.drawImage(fig.img, fx - FOOT_X + ps.xo, fy - FOOT_Y + ps.yo);
      if (n.k === "courier") {
        const img = itemSprite("kartong");
        ctx.drawImage(img, fx - FOOT_X + fig.hand[0] - 6, fy - FOOT_Y + fig.hand[1] - 8 + ps.yo);
      }
      this.anchors.set(n.i, { hx: fx, hy: fy - FOOT_Y + fig.head + ps.yo, fx, fy, w: 7, h: 25 });
      return;
    }
    const sp = npcSprite(n, t);
    if (!sp) return;
    if (n.k !== "ghost") drawShadow(ctx, fx, fy, n.k === "vacuum" ? 1.1 : 0.6);
    else {
      ctx.globalAlpha = 0.18;
      ellipse(ctx, fx, fy, 5, 2, "#1a1420");
      ctx.globalAlpha = 1;
    }
    const wob = n.k === "vacuum" && n.a === "walk" ? Math.round(Math.sin(t * 25) * 0.6) : 0;
    ctx.globalAlpha = sp.alpha;
    ctx.drawImage(sp.img, fx - sp.ax + wob, fy - sp.ay + sp.yo);
    ctx.globalAlpha = 1;
    const hgt = n.k === "ghost" ? 18 : n.k === "vacuum" ? 9 : 10;
    this.anchors.set(n.i, { hx: fx, hy: fy - hgt + sp.yo - 2, fx, fy, w: 8, h: hgt + 2 });
  }

  private drawMineMarker(ctx: CanvasRenderingContext2D, t: number) {
    if (!this.mine) return;
    const a = this.anchors.get(this.mine);
    if (!a) return;
    const bob = Math.round(Math.sin(t * 4) * 2);
    const x = Math.round(a.hx);
    const y = Math.round(a.hy - 9 + bob);
    R(ctx, x - 4, y - 1, 9, 3, "#2a2230");
    R(ctx, x - 3, y + 2, 7, 1, "#2a2230");
    R(ctx, x - 2, y + 3, 5, 1, "#2a2230");
    R(ctx, x - 1, y + 4, 3, 1, "#2a2230");
    R(ctx, x - 3, y, 7, 1, "#ffe066");
    R(ctx, x - 2, y + 1, 5, 1, "#ffe066");
    R(ctx, x - 1, y + 2, 3, 1, "#ffd23f");
    R(ctx, x, y + 3, 1, 1, "#ffd23f");
  }

  // ------------------------------------------------------------------ ljus

  private collectLights(world: WorldState, s: number, ox: number, oy: number, night: number): Light[] {
    const out: Light[] = [];
    const P = (wx: number, wy: number): [number, number] => [wx * s + ox, wy * s + oy];
    if (world.lights) {
      for (const f of this.furn.overhead) {
        const [x, y] = P((f.x + M) * TILE + 8, (f.y + M) * TILE + 8);
        out.push({ x, y, r: 72 * s, color: `rgba(255,190,110,${0.18 * night})`, strength: 0.95 });
      }
      // svagt allmänljus i varje rum
      for (const [id, b] of this.sw.roomBounds) {
        if (id === "balkong" || id === "trapphus") continue;
        const [x, y] = P((b[0] + b[2]) / 2, (b[1] + b[3]) / 2);
        const r = Math.max(b[2] - b[0], b[3] - b[1]) * 0.7 * s;
        out.push({ x, y, r, color: "rgba(0,0,0,0)", strength: 0.32 });
      }
    }
    for (const d of this.furn.items) {
      const f = d.f;
      if (f.kind === "monitor" && (f.dir ?? 0) !== 1) {
        const [x, y] = P((f.x + M) * TILE + 8, (f.y + M) * TILE + 2);
        out.push({ x, y, r: 20 * s, color: `rgba(110,170,255,${0.22 * night + 0.05})`, strength: 0.8 });
      } else if (f.kind === "arcade") {
        const [x, y] = P((f.x + M) * TILE + 8, (f.y + M) * TILE - 6);
        out.push({ x, y, r: 26 * s, color: `rgba(255,94,196,${0.25 * night + 0.05})`, strength: 0.85 });
      } else if (f.kind === "server_rack") {
        const [x, y] = P((f.x + M) * TILE + 8, (f.y + M) * TILE);
        out.push({ x, y, r: 14 * s, color: `rgba(61,220,132,${0.15 * night})`, strength: 0.6 });
      } else if (f.kind === "jukebox") {
        // jukeboxen lyser i takt med musiken (färgen skiftar långsamt)
        const playing = !!world.music && world.music.track !== "off";
        const hue = Math.floor((performance.now() / 40) % 360);
        const [x, y] = P((f.x + M) * TILE + 8, (f.y + M) * TILE - 6);
        out.push({ x, y, r: (playing ? 34 : 18) * s, color: playing ? `hsla(${hue},90%,62%,${0.3 * night + 0.06})` : `rgba(140,110,200,${0.12 * night})`, strength: playing ? 0.9 : 0.5 });
      } else if (f.kind === "kakelugn" && night > 0.3) {
        const [x, y] = P((f.x + M) * TILE + 8, (f.y + M) * TILE + 2);
        out.push({ x, y, r: 26 * s, color: `rgba(255,150,60,${0.2 * night})`, strength: 0.7 });
      }
    }
    for (const f of this.furn.wallDyn) {
      if (f.kind === "neon_sign") {
        const [x, y] = P((f.x + M) * TILE + f.w * 8, (f.y + M) * TILE + 12);
        out.push({ x, y, r: 54 * s, color: `rgba(255,94,196,${0.35 * night + 0.05})`, strength: 0.9 });
      } else if (f.kind === "tv") {
        const [x, y] = P((f.x + M) * TILE + f.w * 8, (f.y + M) * TILE + 12);
        out.push({ x, y, r: 30 * s, color: `rgba(120,160,255,${0.2 * night})`, strength: 0.7 });
      }
    }
    if (world.disco) {
      const b = this.sw.roomBounds.get(world.disco);
      if (b) {
        const [x, y] = P((b[0] + b[2]) / 2, (b[1] + b[3]) / 2);
        out.push({ x, y, r: Math.max(b[2] - b[0], b[3] - b[1]) * 0.75 * s, color: "rgba(0,0,0,0)", strength: 0.8 });
      }
    }
    // gatlyktor
    if (night > 0.2) {
      for (let ty = -M + 2; ty < this.sw.map.h + M; ty += 9) {
        const [x, y] = P((this.sw.map.w + M) * TILE + 4, (ty + M) * TILE + 2);
        out.push({ x, y, r: 30 * s, color: `rgba(255,200,120,${0.16 * night})`, strength: 0.55 });
      }
    }
    return out;
  }

  // ------------------------------------------------------------------ gatuliv

  private drawStreetLife(ctx: CanvasRenderingContext2D, t: number, night: number) {
    const H = this.sw.H;
    const roadX = (this.sw.map.w + 1 + M) * TILE;
    const cars = ["#c0392b", "#2e86de", "#f1f2f6", "#2d3436", "#f9ca24", "#6ab04c", "#e17055", "#a29bfe"];
    for (let i = 0; i < 9; i++) {
      const south = i % 2 === 0;
      const lane = south ? roadX + 8 : roadX + 40;
      const sp = 26 + hash(i, 1) * 34;
      const len = H + 120;
      let y = ((t * sp + hash(i, 2) * len) % len) - 60;
      if (!south) y = H - y;
      const col = cars[i % cars.length];
      const x = Math.round(lane + (hash(i, 3) > 0.5 ? 2 : 0));
      const yy = Math.round(y);
      R(ctx, x + 2, yy + 2, 11, 19, "rgba(0,0,0,0.25)");
      R(ctx, x, yy, 11, 19, col);
      R(ctx, x + 1, yy + (south ? 12 : 3), 9, 4, "#1f2a38");
      R(ctx, x + 2, yy + (south ? 5 : 8), 7, 5, "#3a4a5e");
      R(ctx, x + 1, yy + 1, 1, 17, "rgba(255,255,255,0.25)");
      const front = south ? yy + 18 : yy;
      R(ctx, x + 1, front, 2, 1, "#fff6c4");
      R(ctx, x + 8, front, 2, 1, "#fff6c4");
      const rear = south ? yy : yy + 18;
      R(ctx, x + 1, rear, 2, 1, "#ff4d4d");
      R(ctx, x + 8, rear, 2, 1, "#ff4d4d");
      if (night > 0.3) {
        ctx.globalAlpha = 0.25 * night;
        ctx.fillStyle = "#fff6c4";
        ctx.beginPath();
        const fy = south ? front + 1 : front;
        const dir = south ? 1 : -1;
        ctx.moveTo(x + 1, fy);
        ctx.lineTo(x + 10, fy);
        ctx.lineTo(x + 15, fy + dir * 26);
        ctx.lineTo(x - 4, fy + dir * 26);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    // fotgängare på trottoarerna
    const coats = ["#2b3a6a", "#a8323a", "#3d6b4a", "#d9a441", "#1f1f23", "#7a7f88", "#c96f4a"];
    for (let i = 0; i < 12; i++) {
      const left = i % 2 === 0;
      const x = left ? (this.sw.map.w + M) * TILE + 7 : (this.sw.map.w + 5 + M) * TILE + 6;
      const sp = 7 + hash(i, 5) * 6;
      const len = H + 40;
      let y = ((t * sp + hash(i, 6) * len) % len) - 20;
      if (hash(i, 7) > 0.5) y = H - y;
      const step = Math.floor(t * 4 + i) % 2;
      const yy = Math.round(y);
      R(ctx, x + 1, yy + 6, 4, 2, "rgba(0,0,0,0.25)");
      R(ctx, x, yy + 1, 4, 5, coats[i % coats.length]);
      R(ctx, x + 1, yy - 2, 2, 3, ["#f2d0b4", "#c98f63", "#9c6844", "#e9bf9c"][i % 4]);
      R(ctx, x + step, yy + 6, 1, 1, "#222");
    }
    // folk i parken (Norra Bantorget)
    const parkY0 = (72 + M) * TILE;
    for (let i = 0; i < 8; i++) {
      const sp = 5 + hash(i, 8) * 5;
      const span = H - parkY0;
      const gy = parkY0 + ((t * sp + hash(i, 9) * span) % span);
      const k = Math.floor(hash(i, 10) * 4) - 1;
      const gx = 75 + 0.7 * (gy - M * TILE) + k * 150 + M * TILE * 0;
      const x = Math.round(gx);
      const yy = Math.round(gy);
      if (x < 0 || x > this.sw.W) continue;
      R(ctx, x, yy, 4, 5, coats[(i + 3) % coats.length]);
      R(ctx, x + 1, yy - 3, 2, 3, "#f2d0b4");
      if (i % 3 === 0) {
        R(ctx, x + 6, yy + 3, 4, 2, "#8a5a36");
        R(ctx, x + 9, yy + 2, 2, 2, "#8a5a36");
      }
    }
  }

  // ------------------------------------------------------------------ minikarta

  private miniLayout(cw: number, ch: number) {
    const mw = this.sw.map.w;
    const mh = this.sw.map.h;
    const s = Math.min(cw / mw, ch / mh);
    return { s, ox: (cw - mw * s) / 2, oy: (ch - mh * s) / 2 };
  }

  private drawMinimap(now: number, chars: CharSnap[], npcs: NpcSnap[]) {
    const m = this.mini!;
    if (now - m.last < 160) return;
    m.last = now;
    const r = m.canvas.getBoundingClientRect();
    const dpr = this.dpr;
    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    if (m.canvas.width !== w || m.canvas.height !== h) {
      m.canvas.width = w;
      m.canvas.height = h;
    }
    const c = m.ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, r.width, r.height);
    const { s, ox, oy } = this.miniLayout(r.width, r.height);
    c.imageSmoothingEnabled = false;
    c.drawImage(this.sw.minimap, ox, oy, this.sw.map.w * s, this.sw.map.h * s);
    const world = this.store.world;
    if (world?.disco) {
      const b = this.sw.roomBounds.get(world.disco);
      if (b) {
        c.fillStyle = `rgba(255,94,196,${0.3 + 0.2 * Math.sin(now / 200)})`;
        c.fillRect(ox + (b[0] / TILE - M) * s, oy + (b[1] / TILE - M) * s, ((b[2] - b[0]) / TILE) * s, ((b[3] - b[1]) / TILE) * s);
      }
    }
    for (const n of npcs) {
      if (!n.v || n.k === "object") continue;
      c.fillStyle = "#cfd8ff";
      c.fillRect(ox + n.x * s - 1, oy + n.y * s - 1, 2, 2);
    }
    for (const ch2 of chars) {
      const con = CONSULTANT_BY_ID[ch2.i];
      const mine = ch2.i === this.mine;
      const sz = mine ? 4 : ch2.i === this.selected ? 4 : 3;
      c.fillStyle = "#1d1b26";
      c.fillRect(ox + ch2.x * s - sz / 2 - 0.5, oy + ch2.y * s - sz / 2 - 0.5, sz + 1, sz + 1);
      c.fillStyle = mine ? "#ffe066" : con?.color ?? "#fff";
      c.fillRect(ox + ch2.x * s - sz / 2, oy + ch2.y * s - sz / 2, sz, sz);
    }
    // vy-rektangel
    const [wx0, wy0] = this.screenToWorld(0, 0);
    const [wx1, wy1] = this.screenToWorld(this.cssW, this.cssH);
    c.strokeStyle = "rgba(255,255,255,0.9)";
    c.lineWidth = 1;
    c.strokeRect(ox + (wx0 / TILE - M) * s, oy + (wy0 / TILE - M) * s, ((wx1 - wx0) / TILE) * s, ((wy1 - wy0) / TILE) * s);
  }
}

