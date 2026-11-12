// A* på rutnätet, 8 riktningar utan att skära hörn genom väggar/möbler.
import type { OfficeMap } from "../../shared/map.ts";

export interface P {
  x: number;
  y: number;
}

const SQ2 = Math.SQRT2;

class Heap {
  private a: number[] = [];
  private f: Float64Array;
  constructor(size: number) {
    this.f = new Float64Array(size);
  }
  push(i: number, f: number) {
    this.f[i] = f;
    const a = this.a;
    a.push(i);
    let k = a.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (this.f[a[p]] <= this.f[a[k]]) break;
      [a[p], a[k]] = [a[k], a[p]];
      k = p;
    }
  }
  pop(): number {
    const a = this.a;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < a.length && this.f[a[l]] < this.f[a[m]]) m = l;
        if (r < a.length && this.f[a[r]] < this.f[a[m]]) m = r;
        if (m === k) break;
        [a[m], a[k]] = [a[k], a[m]];
        k = m;
      }
    }
    return top;
  }
  get size() {
    return this.a.length;
  }
}

/** Extra kostnad för rutor (t.ex. stolar) så att figurer helst går runt dem. */
export function buildCostMap(m: OfficeMap): Float32Array {
  const cost = new Float32Array(m.w * m.h).fill(1);
  for (const f of m.furniture) {
    if (f.kind === "chair" || f.kind === "officechair") cost[f.y * m.w + f.x] = 4;
  }
  return cost;
}

export function findPath(m: OfficeMap, cost: Float32Array, sx: number, sy: number, gx: number, gy: number): P[] | null {
  const W = m.w;
  const H = m.h;
  if (gx < 0 || gy < 0 || gx >= W || gy >= H) return null;
  const start = sy * W + sx;
  const goal = gy * W + gx;
  if (start === goal) return [];
  const g = new Float64Array(W * H).fill(Infinity);
  const from = new Int32Array(W * H).fill(-1);
  const closed = new Uint8Array(W * H);
  const open = new Heap(W * H);
  g[start] = 0;
  const h = (i: number) => {
    const dx = Math.abs((i % W) - gx);
    const dy = Math.abs(((i / W) | 0) - gy);
    return dx + dy + (SQ2 - 2) * Math.min(dx, dy);
  };
  open.push(start, h(start));
  const walk = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < W && y < H && (m.blocked[y * W + x] === 0 || y * W + x === goal);
  let iter = 0;
  while (open.size) {
    const cur = open.pop();
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (++iter > 6000) return null;
    const cx = cur % W;
    const cy = (cur / W) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (!walk(nx, ny)) continue;
        if (dx && dy && (!walk(cx + dx, cy) || !walk(cx, cy + dy))) continue;
        const ni = ny * W + nx;
        if (closed[ni]) continue;
        const step = (dx && dy ? SQ2 : 1) * cost[ni];
        const ng = g[cur] + step;
        if (ng < g[ni]) {
          g[ni] = ng;
          from[ni] = cur;
          open.push(ni, ng + h(ni));
        }
      }
    }
  }
  if (from[goal] < 0) return null;
  const out: P[] = [];
  for (let c = goal; c !== start; c = from[c]) out.push({ x: c % W, y: (c / W) | 0 });
  out.reverse();
  return out;
}
