// Skärmlager: pratbubblor, namnskyltar, ljussättning, disco, larm, väder, retrofilter.
import type { Bubble } from "../net.ts";
import type { RoomId } from "../../shared/map.ts";
import type { WorldState } from "../../shared/protocol.ts";
import { hash } from "./pixel.ts";
import type { StaticWorld } from "./staticLayer.ts";

export const FONT = '"Pixelify Sans", "VT323", ui-monospace, monospace';

interface Placed {
  x: number;
  y: number;
  w: number;
  h: number;
}

const wrapCache = new Map<string, { lines: string[]; w: number }>();

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, font: string): { lines: string[]; w: number } {
  const key = font + "|" + maxW + "|" + text;
  const hit = wrapCache.get(key);
  if (hit) return hit;
  ctx.font = font;
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  let w = 0;
  for (const word of words) {
    const test = cur ? cur + " " + word : word;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      w = Math.max(w, ctx.measureText(cur).width);
      cur = word;
    } else cur = test;
  }
  if (cur) {
    lines.push(cur);
    w = Math.max(w, ctx.measureText(cur).width);
  }
  // hårda brytningar för väldigt långa ord
  const out = { lines: lines.slice(0, 7), w: Math.min(maxW, Math.ceil(w)) };
  if (lines.length > 7) out.lines[6] = out.lines[6].replace(/.{0,2}$/, "…");
  if (wrapCache.size > 400) wrapCache.clear();
  wrapCache.set(key, out);
  return out;
}

/** Pixligt rundad ruta (urnupna hörn). */
function pixBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, border: string, fill: string, u = 2) {
  ctx.fillStyle = border;
  ctx.fillRect(x, y - u, w, h + 2 * u);
  ctx.fillRect(x - u, y, w + 2 * u, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
}

export function drawBubbles(
  ctx: CanvasRenderingContext2D,
  bubbles: Bubble[],
  anchorOf: (id: string) => { x: number; y: number } | null,
  now: number,
  vw: number,
  vh: number,
) {
  type Item = { b: Bubble; ax: number; ay: number; lines: string[]; w: number; h: number; font: string; lh: number };
  const items: Item[] = [];
  for (const b of bubbles) {
    const a = anchorOf(b.i);
    if (!a) continue;
    if (a.x < -200 || a.y < -200 || a.x > vw + 200 || a.y > vh + 300) continue;
    const whisper = b.style === "whisper";
    const font = `${whisper ? 11 : 13}px ${FONT}`;
    let text = b.text;
    if (b.style === "shout") text = text.toUpperCase();
    if (b.style === "sing") text = "♪ " + text + " ♪";
    const { lines, w } = wrap(ctx, text, whisper ? 150 : 190, font);
    const lh = whisper ? 13 : 15;
    items.push({ b, ax: a.x, ay: a.y, lines, w: w + 12, h: lines.length * lh + 8, font, lh });
  }
  items.sort((p, q) => q.ay - p.ay);
  const placed: Placed[] = [];
  for (const it of items) {
    let x = Math.round(it.ax - it.w / 2);
    let y = Math.round(it.ay - it.h - 12);
    x = Math.max(6, Math.min(vw - it.w - 6, x));
    for (let guard = 0; guard < 12; guard++) {
      const hitp = placed.find((p) => x < p.x + p.w + 4 && x + it.w + 4 > p.x && y < p.y + p.h + 6 && y + it.h + 6 > p.y);
      if (!hitp) break;
      y = hitp.y - it.h - 8;
    }
    y = Math.max(6, Math.min(vh - it.h - 6, y));
    placed.push({ x, y, w: it.w, h: it.h });

    const age = now - it.b.start;
    const left = it.b.end - now;
    const alpha = Math.max(0, Math.min(1, age / 140, left / 260));
    const pop = age < 140 ? 0.85 + 0.15 * (age / 140) : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (pop !== 1) {
      const cx = x + it.w / 2;
      const cy = y + it.h;
      ctx.translate(cx, cy);
      ctx.scale(pop, pop);
      ctx.translate(-cx, -cy);
    }
    const style = it.b.style;
    const border = "#1d1b26";
    const fill = style === "shout" ? "#ffe066" : style === "whisper" ? "#f0eef6" : "#ffffff";
    const tailX = Math.max(x + 6, Math.min(x + it.w - 8, Math.round(it.ax)));
    const by = y + it.h;
    if (style === "think") {
      ctx.fillStyle = border;
      ctx.beginPath();
      ctx.roundRect(x - 2, y - 2, it.w + 4, it.h + 4, 10);
      ctx.fill();
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.roundRect(x, y, it.w, it.h, 8);
      ctx.fill();
      const dots: [number, number, number][] = [[tailX, by + 6, 4], [tailX + 3, by + 13, 2.6]];
      for (const [cx, cy, r] of dots) {
        ctx.fillStyle = border;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      if (style === "shout") {
        // taggiga kanter
        ctx.fillStyle = border;
        for (let i = 0; i < it.w; i += 8) {
          ctx.fillRect(x + i + 2, y - 5, 4, 3);
          ctx.fillRect(x + i + 2, by + 2, 4, 3);
        }
        for (let j = 0; j < it.h; j += 8) {
          ctx.fillRect(x - 5, y + j + 2, 3, 4);
          ctx.fillRect(x + it.w + 2, y + j + 2, 3, 4);
        }
      }
      pixBox(ctx, x, y, it.w, it.h, border, fill);
      if (style === "whisper") {
        ctx.fillStyle = fill;
        for (let i = 2; i < it.w; i += 6) {
          ctx.fillRect(x + i, y - 2, 3, 2);
          ctx.fillRect(x + i, by, 3, 2);
        }
      }
      // svans
      ctx.fillStyle = border;
      ctx.fillRect(tailX - 4, by, 9, 2);
      ctx.fillRect(tailX - 3, by + 2, 7, 2);
      ctx.fillRect(tailX - 1, by + 4, 4, 2);
      ctx.fillRect(tailX, by + 6, 2, 2);
      ctx.fillStyle = fill;
      ctx.fillRect(tailX - 2, by - 2, 5, 2);
      ctx.fillRect(tailX - 1, by, 4, 2);
      ctx.fillRect(tailX, by + 2, 2, 2);
      // liten skugga
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fillRect(x, by + 2, it.w, 2);
    }
    ctx.font = it.font;
    ctx.textBaseline = "top";
    ctx.fillStyle = style === "whisper" ? "#6b6880" : style === "sing" ? "#7a2d8f" : "#1d1b26";
    for (let k = 0; k < it.lines.length; k++) ctx.fillText(it.lines[k], x + 6, y + 4 + k * it.lh);
    ctx.restore();
  }
}

export function drawNameTag(ctx: CanvasRenderingContext2D, x: number, y: number, name: string, dot: string, strong: boolean) {
  ctx.font = `11px ${FONT}`;
  const tw = Math.ceil(ctx.measureText(name).width);
  const w = tw + 16;
  const h = 15;
  const bx = Math.round(x - w / 2);
  const by = Math.round(y);
  ctx.fillStyle = strong ? "rgba(255,214,90,0.95)" : "rgba(18,16,28,0.78)";
  ctx.fillRect(bx, by + 1, w, h - 2);
  ctx.fillRect(bx + 1, by, w - 2, h);
  if (strong) {
    ctx.fillStyle = "rgba(18,16,28,0.88)";
    ctx.fillRect(bx + 2, by + 2, w - 4, h - 4);
  }
  ctx.fillStyle = dot;
  ctx.fillRect(bx + 5, by + 5, 5, 5);
  ctx.fillStyle = "#f6f2ff";
  ctx.textBaseline = "top";
  ctx.fillText(name, bx + 12, by + 2);
}

// --------------------------------------------------------------- ljus

export interface Light {
  x: number; // skärmpixlar (enhetspixlar)
  y: number;
  r: number;
  color: string; // rgba för glöd
  strength: number; // hur mycket mörker som lyfts (0..1)
}

let darkCv: HTMLCanvasElement | null = null;

export function drawLighting(ctx: CanvasRenderingContext2D, w: number, h: number, darkness: number, lights: Light[]) {
  if (darkness <= 0.01) return;
  if (!darkCv) darkCv = document.createElement("canvas");
  if (darkCv.width !== w || darkCv.height !== h) {
    darkCv.width = w;
    darkCv.height = h;
  }
  const d = darkCv.getContext("2d")!;
  d.globalCompositeOperation = "source-over";
  d.clearRect(0, 0, w, h);
  d.fillStyle = `rgba(10,12,34,${darkness})`;
  d.fillRect(0, 0, w, h);
  d.globalCompositeOperation = "destination-out";
  for (const L of lights) {
    if (L.x < -L.r || L.y < -L.r || L.x > w + L.r || L.y > h + L.r) continue;
    const g = d.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r);
    g.addColorStop(0, `rgba(0,0,0,${L.strength})`);
    g.addColorStop(0.55, `rgba(0,0,0,${L.strength * 0.55})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    d.fillStyle = g;
    d.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(darkCv, 0, 0);
  ctx.globalCompositeOperation = "lighter";
  for (const L of lights) {
    if (L.x < -L.r || L.y < -L.r || L.x > w + L.r || L.y > h + L.r) continue;
    const g = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r * 0.8);
    g.addColorStop(0, L.color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
  }
  ctx.restore();
}

/** Disco i ett rum: ritas i världskoordinater med klippning. */
export function drawDisco(ctx: CanvasRenderingContext2D, sw: StaticWorld, room: RoomId, t: number) {
  const path = sw.roomPaths.get(room);
  const b = sw.roomBounds.get(room);
  if (!path || !b) return;
  const [x0, y0, x1, y1] = b;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  ctx.save();
  ctx.clip(path);
  ctx.fillStyle = "rgba(20,8,40,0.35)";
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.globalCompositeOperation = "lighter";
  const cols = ["255,60,200", "60,200,255", "255,220,60", "90,255,140"];
  for (let i = 0; i < 4; i++) {
    const a = t * (0.9 + i * 0.3) + i * 1.7;
    const px = cx + Math.cos(a) * (x1 - x0) * 0.3;
    const py = cy + Math.sin(a * 1.3) * (y1 - y0) * 0.3;
    const g = ctx.createRadialGradient(px, py, 0, px, py, 46);
    g.addColorStop(0, `rgba(${cols[i]},0.7)`);
    g.addColorStop(1, `rgba(${cols[i]},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(px - 46, py - 46, 92, 92);
  }
  // roterande ljusstrålar från kulan
  for (let i = 0; i < 6; i++) {
    const a = t * 1.3 + (i / 6) * Math.PI * 2;
    ctx.fillStyle = `rgba(${cols[i % 4]},0.16)`;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 26);
    ctx.lineTo(cx + Math.cos(a - 0.12) * 140, cy - 26 + Math.sin(a - 0.12) * 110);
    ctx.lineTo(cx + Math.cos(a + 0.12) * 140, cy - 26 + Math.sin(a + 0.12) * 110);
    ctx.fill();
  }
  // prickar från discokulan
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2 + t * 0.8;
    const d = 12 + hash(i, 1) * Math.max(x1 - x0, y1 - y0) * 0.45;
    ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.3 * Math.sin(t * 5 + i)})`;
    ctx.fillRect(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d * 0.8), 2, 2);
  }
  ctx.restore();
  // discokula
  const by = cy - 26 + Math.sin(t * 2) * 1;
  ctx.fillStyle = "#9aa1a8";
  ctx.fillRect(Math.round(cx), Math.round(by - 20), 1, 14);
  for (let j = -4; j <= 4; j++)
    for (let i = -4; i <= 4; i++) {
      if (i * i + j * j > 18) continue;
      const v = hash(i + Math.floor(t * 6), j, 3);
      ctx.fillStyle = v > 0.8 ? "#ffffff" : v > 0.5 ? "#cfd6de" : "#8e98a3";
      ctx.fillRect(Math.round(cx + i), Math.round(by + j), 1, 1);
    }
}

export function drawWeather(ctx: CanvasRenderingContext2D, sw: StaticWorld, world: WorldState, t: number, view: [number, number, number, number]) {
  const [vx0, vy0, vx1, vy1] = view;
  if (world.weather === "regn" || world.weather === "sno") {
    ctx.save();
    ctx.clip(sw.outsidePath);
    const snow = world.weather === "sno";
    const n = snow ? 260 : 320;
    const W = vx1 - vx0;
    const H = vy1 - vy0;
    for (let i = 0; i < n; i++) {
      const sp = snow ? 18 + hash(i, 2) * 14 : 160 + hash(i, 2) * 80;
      const x = vx0 + ((hash(i, 1) * W + (snow ? Math.sin(t + i) * 8 : t * 20)) % W + W) % W;
      const y = vy0 + ((hash(i, 3) * H + t * sp) % H);
      if (snow) {
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.fillRect(Math.round(x), Math.round(y), hash(i, 4) > 0.7 ? 2 : 1, hash(i, 4) > 0.7 ? 2 : 1);
      } else {
        ctx.fillStyle = "rgba(170,200,235,0.55)";
        ctx.fillRect(Math.round(x), Math.round(y), 1, 4);
      }
    }
    ctx.restore();
  }
  if (world.weather === "moln" || world.weather === "regn") {
    ctx.save();
    ctx.globalAlpha = world.weather === "regn" ? 0.1 : 0.07;
    ctx.fillStyle = "#0b1020";
    for (let i = 0; i < 5; i++) {
      const W = sw.W + 400;
      const x = ((hash(i, 7) * W + t * (6 + i * 2)) % W) - 200;
      const y = hash(i, 8) * sw.H;
      ctx.beginPath();
      ctx.ellipse(x, y, 140 + hash(i, 9) * 80, 70 + hash(i, 10) * 40, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

export function drawRetro(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
  ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = "rgba(60,255,140,0.08)";
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "source-over";
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const ry = ((t * 60) % (h + 40)) - 20;
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.fillRect(0, ry, w, 18);
  ctx.restore();
}
