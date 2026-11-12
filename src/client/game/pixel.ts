// Små pixelverktyg: färger, deterministisk slump, buffertar och canvas.

export type RGB = [number, number, number];

const rgbCache = new Map<string, RGB>();

export function hexToRgb(hex: string): RGB {
  let c = rgbCache.get(hex);
  if (c) return c;
  let h = hex.replace("#", "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h.slice(0, 6), 16);
  c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  rgbCache.set(hex, c);
  return c;
}

export function rgbToHex(r: number, g: number, b: number): string {
  const cl = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return "#" + ((1 << 24) | (cl(r) << 16) | (cl(g) << 8) | cl(b)).toString(16).slice(1);
}

/** amt < 0 mörkare, amt > 0 ljusare (−1..1). */
export function shade(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  if (amt < 0) return rgbToHex(r * (1 + amt), g * (1 + amt), b * (1 + amt));
  return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
}

export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/** Deterministisk hash → 0..1 */
export function hash(a: number, b = 0, c = 0): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function strHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

/** Fyllrektangel – kort alias för pixelritning. */
export function R(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
}

/** Pixel-ellips (fylld) med heltalskanter. */
export function ellipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, c: string) {
  ctx.fillStyle = c;
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.0001))));
    ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2, 1);
  }
}

/** Pixel-ring (kontur av ellips). */
export function ring(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, c: string) {
  ctx.fillStyle = c;
  let prev = -1;
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.0001))));
    const yy = Math.round(cy + y);
    if (y === -ry || y === ry) {
      ctx.fillRect(Math.round(cx - w), yy, w * 2, 1);
    } else {
      const span = prev >= 0 ? Math.max(1, Math.abs(w - prev)) : 1;
      ctx.fillRect(Math.round(cx - w), yy, span, 1);
      ctx.fillRect(Math.round(cx + w - span), yy, span, 1);
    }
    prev = w;
  }
}

/** Pixelbuffert för figurer – möjliggör kontur i efterhand. */
export class PixBuf {
  data: (string | null)[];
  constructor(public w: number, public h: number) {
    this.data = new Array(w * h).fill(null);
  }
  set(x: number, y: number, c: string | null) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.data[y * this.w + x] = c;
  }
  get(x: number, y: number): string | null {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.data[y * this.w + x];
  }
  rect(x: number, y: number, w: number, h: number, c: string | null) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  /** Ritar bara där det redan finns pixlar (t.ex. skuggning). */
  over(x: number, y: number, c: string) {
    if (this.get(x, y)) this.set(x, y, c);
  }
  toCanvas(outline: string | null = "#241c2b", tint?: string, tintAmt = 0): HTMLCanvasElement {
    const [cv, ctx] = makeCanvas(this.w, this.h);
    const img = ctx.createImageData(this.w, this.h);
    const tr = tint ? hexToRgb(tint) : null;
    for (let i = 0; i < this.data.length; i++) {
      const c = this.data[i];
      if (!c) continue;
      let [r, g, b] = hexToRgb(c);
      if (tr) {
        r = r + (tr[0] - r) * tintAmt;
        g = g + (tr[1] - g) * tintAmt;
        b = b + (tr[2] - b) * tintAmt;
      }
      img.data[i * 4] = r;
      img.data[i * 4 + 1] = g;
      img.data[i * 4 + 2] = b;
      img.data[i * 4 + 3] = 255;
    }
    if (outline) {
      const [or, og, ob] = hexToRgb(outline);
      for (let y = 0; y < this.h; y++)
        for (let x = 0; x < this.w; x++) {
          if (this.data[y * this.w + x]) continue;
          const n =
            (x > 0 && this.data[y * this.w + x - 1]) ||
            (x < this.w - 1 && this.data[y * this.w + x + 1]) ||
            (y > 0 && this.data[(y - 1) * this.w + x]) ||
            (y < this.h - 1 && this.data[(y + 1) * this.w + x]);
          if (n) {
            const k = (y * this.w + x) * 4;
            img.data[k] = or;
            img.data[k + 1] = og;
            img.data[k + 2] = ob;
            img.data[k + 3] = 235;
          }
        }
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }
}

// Minimalt pixeltypsnitt (3×5) för skyltar och siffror.
const FONT: Record<string, string[]> = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "011", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
  S: ["111", "100", "111", "001", "111"],
  V: ["101", "101", "101", "101", "010"],
  A: ["010", "101", "111", "101", "101"],
  R: ["110", "101", "110", "101", "101"],
  I: ["111", "010", "010", "010", "111"],
  N: ["101", "111", "111", "111", "101"],
  T: ["111", "010", "010", "010", "010"],
  K: ["101", "101", "110", "101", "101"],
  P: ["110", "101", "110", "100", "100"],
  "!": ["010", "010", "010", "000", "010"],
  "?": ["111", "001", "011", "000", "010"],
  ":": ["000", "010", "000", "010", "000"],
  " ": ["000", "000", "000", "000", "000"],
};

export function pixelText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, c: string) {
  ctx.fillStyle = c;
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const g = FONT[ch] ?? FONT[" "];
    for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j][i] === "1") ctx.fillRect(cx + i, y + j, 1, 1);
    cx += 4;
  }
}
