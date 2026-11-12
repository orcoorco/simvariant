// Förrenderade lager: golv, väggar, fönster, dörrar, mattor, väggföremål och omgivningen.
import {
  buildMap,
  DOORS,
  ROOMS,
  T_DOOR,
  T_FLOOR,
  T_VOID,
  T_WALL,
  T_WINDOW,
  TILE,
  type Furn,
  type OfficeMap,
  type RoomId,
} from "../../shared/map.ts";
import { ellipse, hash, hexToRgb, makeCanvas, pixelText, R, ring, rng, shade, type RGB } from "./pixel.ts";

export const M = 6; // marginal i rutor runt kartan

export type Region = "building" | "street" | "sidewalk" | "park" | "roof";

export interface StaticWorld {
  map: OfficeMap;
  W: number;
  H: number;
  base: HTMLCanvasElement;
  canopy: HTMLCanvasElement;
  sun: HTMLCanvasElement;
  roomPaths: Map<RoomId, Path2D>;
  roomBounds: Map<RoomId, [number, number, number, number]>; // världspixlar x0,y0,x1,y1
  outsidePath: Path2D;
  region: (tx: number, ty: number) => Region;
  minimap: HTMLCanvasElement;
  minimapScale: number;
}

const OAK: RGB[] = ["#c99a5f", "#c39257", "#d0a466", "#bd8a4f", "#cc9d62", "#c4945a", "#b98549"].map(hexToRgb);
const OAK_LIGHT: RGB[] = ["#d6ab72", "#cfa26a", "#dcb47c", "#c99b62", "#d3a970"].map(hexToRgb);

function dk(c: RGB, f: number): RGB {
  return [c[0] * f, c[1] * f, c[2] * f];
}
function lt(c: RGB, f: number): RGB {
  return [c[0] + (255 - c[0]) * f, c[1] + (255 - c[1]) * f, c[2] + (255 - c[2]) * f];
}

function floorPixel(kind: string, room: RoomId, gx: number, gy: number): RGB {
  const n = hash(gx, gy, 11);
  switch (kind) {
    case "herring": {
      const col = Math.floor(gx / 8);
      const lx = ((gx % 8) + 8) % 8;
      const even = (col & 1) === 0;
      const d = even ? gy + lx : gy - lx + 4096;
      const stripe = Math.floor(d / 4);
      const within = ((d % 4) + 4) % 4;
      let c = OAK[Math.floor(hash(col, stripe, 3) * OAK.length)];
      if (within === 0) c = dk(c, 0.8);
      else if (within === 1) c = lt(c, 0.06);
      if (lx === 0) c = dk(c, 0.9);
      if (n < 0.07) c = dk(c, 0.94);
      return c;
    }
    case "checker": {
      const sx = Math.floor(gx / 8);
      const sy = Math.floor(gy / 8);
      const lx = ((gx % 8) + 8) % 8;
      const ly = ((gy % 8) + 8) % 8;
      const black = ((sx + sy) & 1) === 0;
      let c: RGB = black ? [46, 46, 52] : [236, 234, 228];
      if (lx === 0 || ly === 0) c = black ? [62, 62, 68] : [214, 211, 204];
      else if (!black && n < 0.06) c = [224, 221, 214];
      else if (black && n < 0.06) c = [56, 56, 62];
      return c;
    }
    case "carpet": {
      let c: RGB = room === "samtal" ? [172, 132, 112] : [137, 142, 150];
      if ((gx + gy) % 2 === 0) c = dk(c, 0.97);
      if (n < 0.12) c = dk(c, 0.92);
      else if (n > 0.95) c = lt(c, 0.08);
      return c;
    }
    case "plank": {
      const row = Math.floor(gy / 5);
      const off = Math.floor(hash(row, 7) * 40);
      const idx = Math.floor((gx + off) / 36);
      let c = OAK_LIGHT[Math.floor(hash(row, idx, 5) * OAK_LIGHT.length)];
      if (((gy % 5) + 5) % 5 === 4) c = dk(c, 0.8);
      else if ((((gx + off) % 36) + 36) % 36 === 0) c = dk(c, 0.84);
      else if (hash(gx >> 2, gy, 9) < 0.12) c = dk(c, 0.95);
      return c;
    }
    case "tile": {
      const lx = ((gx % 5) + 5) % 5;
      const ly = ((gy % 5) + 5) % 5;
      if (lx === 0 || ly === 0) return [182, 192, 197];
      const v = hash(Math.floor(gx / 5), Math.floor(gy / 5), 2);
      let c: RGB = v < 0.15 ? [221, 229, 233] : [236, 241, 243];
      if (lx === 1 && ly === 1) c = lt(c, 0.5);
      return c;
    }
    case "server": {
      const lx = ((gx % 8) + 8) % 8;
      const ly = ((gy % 8) + 8) % 8;
      if (lx === 0 || ly === 0) return [104, 110, 118];
      if (lx >= 2 && lx <= 5 && ly >= 2 && ly <= 5 && (lx + ly) % 2 === 0) return [138, 144, 152];
      return n < 0.05 ? [160, 166, 173] : [168, 174, 181];
    }
    case "stone":
    case "balcony": {
      const row = Math.floor(gy / 7);
      const ly = ((gy % 7) + 7) % 7;
      const off = (row & 1) * 6;
      const lx = (((gx + off) % 12) + 12) % 12;
      if (ly === 0 || lx === 0) return [156, 147, 133];
      const v = hash(Math.floor((gx + off) / 12), row, 4);
      let c: RGB = [204, 196, 181];
      if (v < 0.3) c = [196, 188, 172];
      else if (v > 0.8) c = [212, 205, 190];
      if (n < 0.06) c = dk(c, 0.93);
      return c;
    }
    case "marble": {
      const v = Math.abs(Math.sin(gx * 0.11 + gy * 0.06 + Math.sin(gy * 0.09) * 2.5));
      if (v < 0.05) return [200, 186, 168];
      if (v < 0.1) return [222, 212, 198];
      return n < 0.05 ? [232, 224, 212] : [240, 234, 223];
    }
  }
  return [200, 180, 150];
}

function outsidePixel(region: Region, tx: number, ty: number, gx: number, gy: number): RGB {
  const n = hash(gx, gy, 21);
  switch (region) {
    case "street": {
      let c: RGB = [72, 75, 81];
      if (n < 0.1) c = [64, 67, 72];
      else if (n > 0.93) c = [84, 87, 93];
      // mittlinje (streckad) mellan körfälten
      const center = (41 + M) * TILE;
      if (Math.abs(gx - center) < 1 && Math.floor(gy / 10) % 2 === 0) c = [226, 226, 218];
      // övergångsställe söderut
      if (ty >= 76 && ty <= 77 && Math.floor(gx / 3) % 2 === 0) c = [226, 226, 218];
      return c;
    }
    case "sidewalk": {
      const lx = ((gx % 8) + 8) % 8;
      const ly = ((gy % 8) + 8) % 8;
      if (lx === 0 || ly === 0) return [158, 156, 150];
      return n < 0.08 ? [178, 176, 170] : [189, 187, 181];
    }
    case "park": {
      // grus­gångar diagonalt genom Norra Bantorget
      const p1 = Math.abs((((gx - gy * 0.7) % 150) + 150) % 150 - 75);
      const p2 = Math.abs((((gx + gy * 0.9) % 210) + 210) % 210 - 105);
      if (p1 < 5 || p2 < 4) return n < 0.2 ? [190, 174, 146] : [204, 189, 160];
      let c: RGB = [104, 150, 82];
      if (n < 0.15) c = [92, 138, 72];
      else if (n > 0.9) c = [120, 166, 94];
      return c;
    }
    case "roof":
    default: {
      const bx = Math.floor((tx + 40) / 7);
      const by = Math.floor((ty + 40) / 9);
      const kind = Math.floor(hash(bx, by, 8) * 4);
      const lx = ((gx % 112) + 112) % 112;
      const ly = ((gy % 144) + 144) % 144;
      if (lx === 0 || ly === 0) return [58, 60, 66];
      if (kind === 0 || kind === 3) {
        // zinkplåt med falsar
        let c: RGB = kind === 0 ? [122, 133, 145] : [92, 98, 108];
        if (gx % 6 === 0) c = lt(c, 0.12);
        else if (gx % 6 === 1) c = dk(c, 0.88);
        if (n < 0.05) c = dk(c, 0.95);
        return c;
      }
      if (kind === 1) {
        // kopparplåt med ärg
        let c: RGB = [104, 158, 138];
        if (gx % 7 === 0) c = lt(c, 0.12);
        if (n < 0.1) c = [92, 140, 122];
        if (hash(gx >> 1, gy >> 1, 2) < 0.04) c = [132, 182, 160];
        return c;
      }
      // tegel
      const r = Math.floor(gy / 4);
      const off = (r & 1) * 3;
      let c: RGB = [158, 86, 66];
      if (gy % 4 === 3) c = [118, 62, 48];
      else if ((gx + off) % 6 === 0) c = [138, 74, 56];
      if (n < 0.06) c = [172, 98, 76];
      return c;
    }
  }
}

export function buildStatic(): StaticWorld {
  const map = buildMap();
  const MW = map.w;
  const MH = map.h;
  const W = (MW + 2 * M) * TILE;
  const H = (MH + 2 * M) * TILE;
  const tileAt = (tx: number, ty: number) => (tx < 0 || ty < 0 || tx >= MW || ty >= MH ? T_VOID : map.tiles[ty * MW + tx]);
  const roomIdx = (tx: number, ty: number) => (tx < 0 || ty < 0 || tx >= MW || ty >= MH ? -1 : map.room[ty * MW + tx]);
  const isFloor = (tx: number, ty: number) => {
    const t = tileAt(tx, ty);
    return t === T_FLOOR || t === T_DOOR;
  };
  const isWallish = (tx: number, ty: number) => {
    const t = tileAt(tx, ty);
    return t === T_WALL || t === T_WINDOW;
  };

  // Byggnadens östfasad per rad (för gatan)
  const eastEdge: number[] = [];
  for (let ty = 0; ty < MH; ty++) {
    let e = -1;
    for (let tx = 0; tx < MW; tx++) if (tileAt(tx, ty) !== T_VOID) e = tx;
    eastEdge.push(e);
  }
  const region = (tx: number, ty: number): Region => {
    if (tileAt(tx, ty) !== T_VOID) return "building";
    if (tx >= MW) return tx === MW || tx === MW + 5 ? "sidewalk" : "street";
    if (ty >= MH) return "park";
    if (ty >= 72 && tx >= 0 && ty < MH) return "park";
    if (tx >= 0 && ty >= 0 && ty < MH && tx > eastEdge[ty]) return "sidewalk";
    return "roof";
  };

  const [base, bctx] = makeCanvas(W, H);
  const img = bctx.createImageData(W, H);
  const put = (x: number, y: number, c: RGB) => {
    const k = (y * W + x) * 4;
    img.data[k] = c[0];
    img.data[k + 1] = c[1];
    img.data[k + 2] = c[2];
    img.data[k + 3] = 255;
  };

  // 1) Per-pixel: golv och omgivning
  for (let ty = -M; ty < MH + M; ty++) {
    for (let tx = -M; tx < MW + M; tx++) {
      const t = tileAt(tx, ty);
      const x0 = (tx + M) * TILE;
      const y0 = (ty + M) * TILE;
      if (t === T_FLOOR || t === T_DOOR) {
        const ri = roomIdx(tx, ty);
        const room = ROOMS[Math.max(0, ri)];
        for (let py = 0; py < TILE; py++)
          for (let px = 0; px < TILE; px++) {
            const gx = tx * TILE + px;
            const gy = ty * TILE + py;
            put(x0 + px, y0 + py, floorPixel(room.floor, room.id, gx, gy));
          }
      } else if (t === T_VOID) {
        const reg = region(tx, ty);
        // skugga från byggnaden (ljus från nordväst)
        const shW = tileAt(tx - 1, ty) !== T_VOID && tx - 1 >= 0 && tx - 1 < MW;
        const shN = tileAt(tx, ty - 1) !== T_VOID && ty - 1 >= 0 && ty - 1 < MH;
        const shNW = tileAt(tx - 1, ty - 1) !== T_VOID;
        for (let py = 0; py < TILE; py++)
          for (let px = 0; px < TILE; px++) {
            const gx = x0 + px;
            const gy = y0 + py;
            let c = outsidePixel(reg, tx, ty, gx, gy);
            if ((shW && px < 7) || (shN && py < 7) || (shNW && px < 7 && py < 7)) c = dk(c, 0.68);
            put(gx, gy, c);
          }
      }
    }
  }
  bctx.putImageData(img, 0, 0);

  const ctx = bctx;
  const WX = (tx: number) => (tx + M) * TILE;
  const WY = (ty: number) => (ty + M) * TILE;

  // 2) Utomhusdetaljer: skorstenar, kupol, gatlyktor, cykelställ
  const rr = rng(1906);
  for (let i = 0; i < 70; i++) {
    const tx = Math.floor(rr() * (MW + 2 * M)) - M;
    const ty = Math.floor(rr() * (MH + 2 * M)) - M;
    if (region(tx, ty) !== "roof") continue;
    if (region(tx + 1, ty) !== "roof" || region(tx, ty + 1) !== "roof") continue;
    const x = WX(tx) + Math.floor(rr() * 8);
    const y = WY(ty) + Math.floor(rr() * 6);
    // skorsten
    R(ctx, x + 2, y + 9, 9, 3, "rgba(0,0,0,0.25)");
    R(ctx, x, y, 8, 10, "#9b5040");
    R(ctx, x, y, 8, 1, "#c06a55");
    for (let j = 2; j < 10; j += 3) R(ctx, x, y + j, 8, 1, "#7d3e32");
    R(ctx, x + 1, y + 1, 6, 3, "#2b2526");
    R(ctx, x - 1, y - 1, 10, 2, "#6b6d72");
  }
  // Kopparkupol (som tornet på hörnet)
  {
    const cx = WX(-3);
    const cy = WY(58);
    ellipse(ctx, cx + 3, cy + 4, 15, 13, "rgba(0,0,0,0.25)");
    ellipse(ctx, cx, cy, 14, 13, "#5f9c86");
    ellipse(ctx, cx - 3, cy - 3, 9, 8, "#79b59d");
    ellipse(ctx, cx - 5, cy - 5, 4, 3, "#a3d6c0");
    ring(ctx, cx, cy, 14, 13, "#3f6e5d");
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      R(ctx, Math.round(cx + Math.cos(ang) * 10), Math.round(cy + Math.sin(ang) * 9), 1, 1, "#3f6e5d");
    }
    R(ctx, cx - 2, cy - 2, 4, 4, "#d6b45a");
    R(ctx, cx - 1, cy - 1, 2, 2, "#f1d98a");
  }
  // Gatlyktor och cykelställ längs trottoaren
  for (let ty = -M + 2; ty < MH + M; ty += 9) {
    const x = WX(MW) + 2;
    const y = WY(ty);
    R(ctx, x + 2, y + 3, 4, 4, "rgba(0,0,0,0.25)");
    R(ctx, x, y, 4, 4, "#2b2d33");
    R(ctx, x + 1, y + 1, 2, 2, "#f6e7a8");
    const x2 = WX(MW + 5) + 9;
    R(ctx, x2, y + 40, 4, 4, "#2b2d33");
    R(ctx, x2 + 1, y + 41, 2, 2, "#f6e7a8");
  }
  for (let ty = 4; ty < 70; ty += 17) {
    const y = WY(ty);
    const x = WX(MW + 5) + 3;
    for (let k = 0; k < 4; k++) {
      R(ctx, x, y + k * 4, 10, 1, "#555a62");
      R(ctx, x + 1, y + k * 4 + 1, 1, 2, hash(ty, k) < 0.5 ? "#c0392b" : "#2e86de");
      R(ctx, x + 7, y + k * 4 + 1, 1, 2, "#222");
    }
  }

  // 3) Väggar och fönster
  const curtainColor = (ri: number) => (ri >= 0 && ROOMS[ri].id === "kontor3" ? "#f0a38a" : "#efe6d6");
  for (let ty = 0; ty < MH; ty++) {
    for (let tx = 0; tx < MW; tx++) {
      const t = tileAt(tx, ty);
      if (t !== T_WALL && t !== T_WINDOW) continue;
      const x0 = WX(tx);
      const y0 = WY(ty);
      let exterior = false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (tileAt(tx + dx, ty + dy) === T_VOID) exterior = true;
      // Balkongkant: väggrutor som bara gränsar till balkongen blir stenkant + smidesräcke
      {
        let balc = false;
        let other = false;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if (!isFloor(tx + dx, ty + dy)) continue;
            const ri = roomIdx(tx + dx, ty + dy);
            if (ri >= 0 && ROOMS[ri].id === "balkong" && tileAt(tx + dx, ty + dy) === T_FLOOR) balc = true;
            else other = true;
          }
        if (balc && !other) {
          for (let py = 0; py < TILE; py++)
            for (let px = 0; px < TILE; px++) {
              const c = floorPixel("balcony", "balkong", tx * TILE + px, ty * TILE + py);
              ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
              ctx.fillRect(x0 + px, y0 + py, 1, 1);
            }
          const iron = "#1f2024";
          const v = (dx: number, dy: number) => tileAt(tx + dx, ty + dy) === T_VOID;
          if (v(0, 1)) {
            R(ctx, x0, y0 + 12, 16, 2, iron);
            for (let i = 1; i < 16; i += 3) R(ctx, x0 + i, y0 + 9, 1, 3, iron);
            R(ctx, x0, y0 + 14, 16, 2, "rgba(0,0,0,0.25)");
          }
          if (v(1, 0)) {
            R(ctx, x0 + 12, y0, 2, 16, iron);
            for (let i = 1; i < 16; i += 3) R(ctx, x0 + 9, y0 + i, 3, 1, iron);
          }
          if (v(-1, 0)) {
            R(ctx, x0 + 2, y0, 2, 16, iron);
            for (let i = 1; i < 16; i += 3) R(ctx, x0 + 4, y0 + i, 3, 1, iron);
          }
          if (v(0, -1)) R(ctx, x0, y0 + 2, 16, 2, iron);
          continue;
        }
      }
      const cap = exterior ? "#383b43" : "#454952";
      const capHi = exterior ? "#4b4f58" : "#5a5f69";
      const face = isFloor(tx, ty + 1);
      if (face) {
        const ri = roomIdx(tx, ty + 1);
        const room = ROOMS[Math.max(0, ri)];
        const wc = room.wall;
        R(ctx, x0, y0, 16, 5, cap);
        R(ctx, x0, y0, 16, 1, capHi);
        R(ctx, x0, y0 + 5, 16, 1, "#fffdf7");
        R(ctx, x0, y0 + 6, 16, 1, "#ddd7cb");
        R(ctx, x0, y0 + 7, 16, 6, wc);
        R(ctx, x0, y0 + 12, 16, 1, shade(wc, -0.06));
        R(ctx, x0, y0 + 13, 16, 1, shade(wc, -0.16));
        R(ctx, x0, y0 + 14, 16, 1, "#f7f5ef");
        R(ctx, x0, y0 + 15, 16, 1, "#cfc9bd");
        if (room.id === "hall" || room.id === "korridor" || room.id === "passage") {
          // boasering (panelfält)
          for (const px of [2, 10]) {
            R(ctx, x0 + px, y0 + 8, 5, 1, shade(wc, 0.18));
            R(ctx, x0 + px, y0 + 8, 1, 4, shade(wc, 0.18));
            R(ctx, x0 + px, y0 + 12, 5, 1, shade(wc, -0.12));
            R(ctx, x0 + px + 5, y0 + 8, 1, 5, shade(wc, -0.12));
          }
        }
        // hörnskuggor där fasaden tar slut
        if (!isWallish(tx - 1, ty) || !isFloor(tx - 1, ty + 1)) R(ctx, x0, y0 + 5, 1, 11, "rgba(0,0,0,0.18)");
        if (!isWallish(tx + 1, ty) || !isFloor(tx + 1, ty + 1)) R(ctx, x0 + 15, y0 + 5, 1, 11, "rgba(0,0,0,0.12)");
        if (t === T_WINDOW) {
          // högt sekelskiftesfönster
          R(ctx, x0 + 2, y0 + 1, 12, 14, "#f4f2ec");
          R(ctx, x0 + 3, y0 + 2, 10, 5, "#c4e4f6");
          R(ctx, x0 + 3, y0 + 7, 10, 6, "#97c8e6");
          R(ctx, x0 + 4, y0 + 3, 1, 3, "#ffffff");
          R(ctx, x0 + 5, y0 + 3, 1, 1, "#ffffff");
          R(ctx, x0 + 10, y0 + 8, 1, 3, "#d8eef9");
          R(ctx, x0 + 7, y0 + 2, 2, 11, "#f4f2ec");
          R(ctx, x0 + 3, y0 + 6, 10, 1, "#f4f2ec");
          R(ctx, x0 + 1, y0 + 13, 14, 2, "#ffffff");
          R(ctx, x0 + 1, y0 + 15, 14, 1, "#d6d0c4");
          const cc = curtainColor(ri);
          if (!(tileAt(tx - 1, ty) === T_WINDOW && isFloor(tx - 1, ty + 1))) {
            R(ctx, x0, y0 + 1, 3, 15, cc);
            R(ctx, x0 + 1, y0 + 1, 1, 15, shade(cc, -0.1));
          }
          if (!(tileAt(tx + 1, ty) === T_WINDOW && isFloor(tx + 1, ty + 1))) {
            R(ctx, x0 + 13, y0 + 1, 3, 15, cc);
            R(ctx, x0 + 14, y0 + 1, 1, 15, shade(cc, -0.1));
          }
        }
        continue;
      }
      // Endast krön (ovanifrån)
      R(ctx, x0, y0, 16, 16, cap);
      if (hash(tx, ty, 77) < 0.5) R(ctx, x0 + 3, y0 + 5, 1, 1, shade(cap, 0.08));
      if (isFloor(tx - 1, ty)) R(ctx, x0, y0, 1, 16, capHi);
      if (isFloor(tx + 1, ty)) R(ctx, x0 + 15, y0, 1, 16, shade(cap, -0.2));
      if (isFloor(tx, ty - 1)) {
        R(ctx, x0, y0, 16, 1, capHi);
        R(ctx, x0, y0 + 1, 16, 2, "#f2efe7"); // listen syns ovanifrån
      }
      if (t === T_WINDOW) {
        const fw = isFloor(tx - 1, ty) || (!isFloor(tx + 1, ty) && (isFloor(tx - 1, ty - 1) || isFloor(tx - 1, ty + 1)));
        const fe = isFloor(tx + 1, ty) || (!fw && (isFloor(tx + 1, ty - 1) || isFloor(tx + 1, ty + 1)));
        const fn = isFloor(tx, ty - 1);
        if (fw || fe) {
          R(ctx, x0 + 5, y0, 1, 16, "#f4f2ec");
          R(ctx, x0 + 6, y0, 4, 16, "#a7d4ee");
          R(ctx, x0 + 6, y0, 1, 16, "#d4ecf8");
          R(ctx, x0 + 10, y0, 1, 16, "#f4f2ec");
          R(ctx, x0 + 5, y0 + 15, 6, 1, "#f4f2ec");
          const sx = fw ? x0 : x0 + 13;
          R(ctx, sx, y0, 3, 16, "#ffffff");
          const ri = fw ? roomIdx(tx - 1, ty) : roomIdx(tx + 1, ty);
          const cc = curtainColor(ri);
          // gardiner längs fönsterkanten
          const cx = fw ? x0 - 2 : x0 + 16;
          if (tileAt(tx, ty - 1) !== T_WINDOW) R(ctx, cx, y0, 2, 7, cc);
          if (tileAt(tx, ty + 1) !== T_WINDOW) R(ctx, cx, y0 + 9, 2, 7, cc);
        } else if (fn) {
          R(ctx, x0, y0 + 5, 16, 1, "#f4f2ec");
          R(ctx, x0, y0 + 6, 16, 4, "#a7d4ee");
          R(ctx, x0, y0 + 6, 16, 1, "#d4ecf8");
          R(ctx, x0, y0 + 10, 16, 1, "#f4f2ec");
          R(ctx, x0, y0, 16, 3, "#ffffff");
        } else {
          R(ctx, x0 + 4, y0 + 4, 8, 8, "#f4f2ec");
          R(ctx, x0 + 5, y0 + 5, 6, 6, "#a7d4ee");
        }
      }
    }
  }

  // 4) Dörrar: trösklar, karmar och öppna dörrblad
  for (const d of DOORS) {
    const set = new Set(d.tiles.map(([x, y]) => `${x},${y}`));
    const has = (x: number, y: number) => set.has(`${x},${y}`);
    for (const [tx, ty] of d.tiles) {
      const x0 = WX(tx);
      const y0 = WY(ty);
      const wallLR = (isWallish(tx - 1, ty) || has(tx - 1, ty)) && (isWallish(tx + 1, ty) || has(tx + 1, ty));
      const wallUD = (isWallish(tx, ty - 1) || has(tx, ty - 1)) && (isWallish(tx, ty + 1) || has(tx, ty + 1));
      const floorUD = isFloor(tx, ty - 1) && isFloor(tx, ty + 1);
      const floorLR = isFloor(tx - 1, ty) && isFloor(tx + 1, ty);
      if (wallLR && floorUD) {
        // dörr i horisontell vägg
        R(ctx, x0, y0, 16, 3, "#454952");
        R(ctx, x0, y0 + 3, 16, 1, "#f2efe7");
        R(ctx, x0, y0 + 6, 16, 4, "#b48a5a");
        R(ctx, x0, y0 + 6, 16, 1, "#d6aa76");
        R(ctx, x0, y0 + 9, 16, 1, "#8a6440");
        if (!has(tx - 1, ty)) {
          R(ctx, x0, y0 + 3, 2, 13, "#f6f3ec");
          R(ctx, x0 + 2, y0 + 3, 1, 13, "#d9d3c6");
          // dörrblad (öppet in mot rummet söderut)
          R(ctx, x0 + 1, y0 + 12, 2, 13, "#f7f5f0");
          R(ctx, x0 + 3, y0 + 12, 1, 13, "#cfc8bb");
          R(ctx, x0 + 2, y0 + 20, 1, 1, "#c9a54e");
        }
        if (!has(tx + 1, ty)) {
          R(ctx, x0 + 14, y0 + 3, 2, 13, "#f6f3ec");
          R(ctx, x0 + 13, y0 + 3, 1, 13, "#d9d3c6");
          if (d.double) {
            R(ctx, x0 + 13, y0 + 12, 2, 13, "#f7f5f0");
            R(ctx, x0 + 12, y0 + 12, 1, 13, "#cfc8bb");
            R(ctx, x0 + 13, y0 + 20, 1, 1, "#c9a54e");
          }
        }
      } else if (wallUD && floorLR) {
        // dörr i vertikal vägg
        R(ctx, x0 + 6, y0, 4, 16, "#b48a5a");
        R(ctx, x0 + 6, y0, 1, 16, "#d6aa76");
        R(ctx, x0 + 9, y0, 1, 16, "#8a6440");
        const bIsEast = roomIdx(tx + 1, ty) >= 0 && ROOMS[roomIdx(tx + 1, ty)].id === d.b;
        if (!has(tx, ty - 1)) {
          R(ctx, x0, y0, 16, 2, "#f6f3ec");
          if (bIsEast) {
            R(ctx, x0 + 10, y0 + 1, 13, 2, "#f7f5f0");
            R(ctx, x0 + 10, y0 + 3, 13, 1, "#cfc8bb");
          } else {
            R(ctx, x0 - 7, y0 + 1, 13, 2, "#f7f5f0");
            R(ctx, x0 - 7, y0 + 3, 13, 1, "#cfc8bb");
          }
        }
        if (!has(tx, ty + 1)) R(ctx, x0, y0 + 14, 16, 2, "#f6f3ec");
      }
    }
  }

  // 5) Mattor, dörrmatta, Kungsbalkongens räcke
  for (const f of map.furniture) {
    const x0 = WX(f.x);
    const y0 = WY(f.y);
    const w = f.w * TILE;
    const h = f.h * TILE;
    if (f.kind === "rug") drawRug(ctx, f, x0, y0, w, h);
    else if (f.kind === "round_rug") drawRoundRug(ctx, f, x0, y0, w, h);
    else if (f.kind === "doormat") drawDoormat(ctx, x0, y0, w, h);
  }
  // räcke längs balkongens yttre kant
  for (let ty = 0; ty < MH; ty++)
    for (let tx = 0; tx < MW; tx++) {
      const ri = roomIdx(tx, ty);
      if (ri < 0 || ROOMS[ri].id !== "balkong" || tileAt(tx, ty) !== T_FLOOR) continue;
      const x0 = WX(tx);
      const y0 = WY(ty);
      const out = (dx: number, dy: number) => tileAt(tx + dx, ty + dy) === T_VOID || tileAt(tx + dx, ty + dy) === T_WALL;
      const bar = (x: number, y: number, w: number, hh: number) => {
        R(ctx, x, y, w, hh, "#1f2024");
      };
      if (out(0, 1) && tileAt(tx, ty + 1) === T_VOID) {
        bar(x0, y0 + 13, 16, 2);
        for (let i = 1; i < 16; i += 3) bar(x0 + i, y0 + 10, 1, 3);
        R(ctx, x0, y0 + 13, 16, 1, "#3a3c44");
      }
      if (tileAt(tx + 1, ty) === T_VOID) {
        bar(x0 + 13, y0, 2, 16);
        for (let i = 1; i < 16; i += 3) bar(x0 + 11, y0 + i, 2, 1);
      }
      if (tileAt(tx - 1, ty) === T_VOID) {
        bar(x0 + 1, y0, 2, 16);
        for (let i = 1; i < 16; i += 3) bar(x0 + 3, y0 + i, 2, 1);
      }
    }

  // 6) Väggmonterade föremål
  for (const f of map.furniture) {
    if (!f.wall) continue;
    if (tileAt(f.x, f.y) !== T_WALL && tileAt(f.x, f.y) !== T_WINDOW) continue;
    drawWallItem(ctx, f, WX(f.x), WY(f.y));
  }

  // 7) Trädkronor (eget lager ovanpå trafiken)
  const [canopy, cctx] = makeCanvas(W, H);
  const tr = rng(77);
  const trees: [number, number, number][] = [];
  for (let i = 0; i < 260; i++) {
    const tx = Math.floor(tr() * (MW + 2 * M)) - M;
    const ty = Math.floor(tr() * (MH + 2 * M)) - M;
    const reg = region(tx, ty);
    if (reg !== "park" && !(reg === "sidewalk" && tx >= 0 && tx < MW && tr() < 0.15)) continue;
    const x = WX(tx) + Math.floor(tr() * 16);
    const y = WY(ty) + Math.floor(tr() * 16);
    if (trees.some(([a, b]) => Math.hypot(a - x, b - y) < 18)) continue;
    trees.push([x, y, 9 + Math.floor(tr() * 7)]);
  }
  trees.sort((a, b) => a[1] - b[1]);
  for (const [x, y, r] of trees) drawTree(cctx, x, y, r, tr);

  // 8) Solfläckar från fönstren
  const [sun, sctx] = makeCanvas(W, H);
  sctx.fillStyle = "rgba(255,232,180,0.55)";
  for (let ty = 0; ty < MH; ty++)
    for (let tx = 0; tx < MW; tx++) {
      if (tileAt(tx, ty) !== T_WINDOW) continue;
      const x0 = WX(tx);
      const y0 = WY(ty);
      sctx.beginPath();
      if (isFloor(tx, ty + 1)) {
        sctx.moveTo(x0 + 3, y0 + 16);
        sctx.lineTo(x0 + 13, y0 + 16);
        sctx.lineTo(x0 + 19, y0 + 46);
        sctx.lineTo(x0 + 7, y0 + 46);
      } else if (isFloor(tx - 1, ty)) {
        sctx.moveTo(x0, y0 + 1);
        sctx.lineTo(x0, y0 + 15);
        sctx.lineTo(x0 - 34, y0 + 27);
        sctx.lineTo(x0 - 34, y0 + 13);
      } else if (isFloor(tx + 1, ty)) {
        sctx.moveTo(x0 + 16, y0 + 1);
        sctx.lineTo(x0 + 16, y0 + 15);
        sctx.lineTo(x0 + 50, y0 + 27);
        sctx.lineTo(x0 + 50, y0 + 13);
      } else if (isFloor(tx, ty - 1)) {
        sctx.moveTo(x0 + 2, y0);
        sctx.lineTo(x0 + 14, y0);
        sctx.lineTo(x0 + 18, y0 - 18);
        sctx.lineTo(x0 + 6, y0 - 18);
      } else continue;
      sctx.closePath();
      sctx.fill();
    }
  // 9) Rumsbanor
  const roomPaths = new Map<RoomId, Path2D>();
  const roomBounds = new Map<RoomId, [number, number, number, number]>();
  for (let ty = 0; ty < MH; ty++)
    for (let tx = 0; tx < MW; tx++) {
      if (!isFloor(tx, ty)) continue;
      const ri = roomIdx(tx, ty);
      if (ri < 0) continue;
      const id = ROOMS[ri].id;
      let p = roomPaths.get(id);
      if (!p) {
        p = new Path2D();
        roomPaths.set(id, p);
      }
      p.rect(WX(tx), WY(ty), 16, 16);
      const b = roomBounds.get(id) ?? [Infinity, Infinity, -Infinity, -Infinity];
      b[0] = Math.min(b[0], WX(tx));
      b[1] = Math.min(b[1], WY(ty));
      b[2] = Math.max(b[2], WX(tx) + 16);
      b[3] = Math.max(b[3], WY(ty) + 16);
      roomBounds.set(id, b);
    }
  const outsidePath = new Path2D();
  for (let ty = -M; ty < MH + M; ty++)
    for (let tx = -M; tx < MW + M; tx++) {
      const t = tileAt(tx, ty);
      const ri = roomIdx(tx, ty);
      if (t === T_VOID || (ri >= 0 && ROOMS[ri].id === "balkong")) outsidePath.rect(WX(tx), WY(ty), 16, 16);
    }

  // 10) Minikarta (3 px per ruta)
  const S = 3;
  const [minimap, mctx] = makeCanvas(MW * S, MH * S);
  const floorAvg: Record<string, string> = {
    herring: "#c4935a",
    checker: "#8f8e8c",
    carpet: "#8b8f96",
    plank: "#d2a66d",
    tile: "#dfe6e9",
    server: "#a5abb2",
    stone: "#c9c1b0",
    balcony: "#c9c1b0",
    marble: "#ebe3d5",
  };
  for (let ty = 0; ty < MH; ty++)
    for (let tx = 0; tx < MW; tx++) {
      const t = tileAt(tx, ty);
      let c = "#1d2027";
      if (t === T_FLOOR || t === T_DOOR) {
        const ri = roomIdx(tx, ty);
        c = ri >= 0 ? floorAvg[ROOMS[ri].floor] : "#c4935a";
      } else if (t === T_WALL) c = "#3c4049";
      else if (t === T_WINDOW) c = "#8ec4e3";
      else {
        const reg = region(tx, ty);
        c = reg === "park" ? "#5c8a48" : reg === "sidewalk" ? "#8d8b86" : "#4b525c";
      }
      mctx.fillStyle = c;
      mctx.fillRect(tx * S, ty * S, S, S);
    }

  return { map, W, H, base, canopy, sun: maskSun(sun, map, WX, WY, isFloor), roomPaths, roomBounds, outsidePath, region, minimap, minimapScale: S };
}

function maskSun(
  sun: HTMLCanvasElement,
  map: OfficeMap,
  WX: (t: number) => number,
  WY: (t: number) => number,
  isFloor: (x: number, y: number) => boolean,
): HTMLCanvasElement {
  const [out, o] = makeCanvas(sun.width, sun.height);
  for (let ty = 0; ty < map.h; ty++)
    for (let tx = 0; tx < map.w; tx++) if (isFloor(tx, ty)) o.fillRect(WX(tx), WY(ty), 16, 16);
  o.globalCompositeOperation = "source-in";
  o.drawImage(sun, 0, 0);
  o.globalCompositeOperation = "source-over";
  return out;
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rnd: () => number) {
  ellipse(ctx, x + 5, y + 6, r, Math.round(r * 0.8), "rgba(20,40,20,0.3)");
  const greens = ["#3f7a3a", "#4d8c45", "#5c9c50", "#6fae5c"];
  ellipse(ctx, x, y, r, r, greens[0]);
  for (let i = 0; i < 6; i++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * r * 0.55;
    ellipse(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, Math.round(r * 0.5), Math.round(r * 0.5), greens[1]);
  }
  ellipse(ctx, x - r * 0.25, y - r * 0.3, Math.round(r * 0.55), Math.round(r * 0.5), greens[2]);
  ellipse(ctx, x - r * 0.35, y - r * 0.4, Math.round(r * 0.25), Math.round(r * 0.22), greens[3]);
  for (let i = 0; i < 10; i++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * r * 0.85;
    R(ctx, Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d), 1, 1, rnd() < 0.5 ? "#7cc06a" : "#2f5f2c");
  }
}

function drawRug(ctx: CanvasRenderingContext2D, f: Furn, x0: number, y0: number, w: number, h: number) {
  const x = x0 + 2;
  const y = y0 + 2;
  const ww = w - 4;
  const hh = h - 4;
  if (f.variant === 3) {
    // persisk löpare
    R(ctx, x, y, ww, hh, "#7a2d2f");
    R(ctx, x + 2, y + 2, ww - 4, hh - 4, "#2c3a6a");
    R(ctx, x + 4, y + 4, ww - 8, hh - 8, "#8e3a36");
    const cx = x + ww / 2;
    const cy = y + hh / 2;
    for (let j = 0; j < hh - 10; j++)
      for (let i = 0; i < ww - 10; i++) {
        const dx = Math.abs(i - (ww - 10) / 2);
        const dy = Math.abs(j - (hh - 10) / 2);
        if ((dx + dy * 0.6) % 6 < 1) R(ctx, x + 5 + i, y + 5 + j, 1, 1, "#d7b36a");
      }
    R(ctx, Math.round(cx) - 2, Math.round(cy) - 3, 4, 6, "#d7b36a");
    for (let i = 0; i < ww; i += 2) {
      R(ctx, x + i, y - 2, 1, 2, "#efe7d6");
      R(ctx, x + i, y + hh, 1, 2, "#efe7d6");
    }
  } else {
    // ljus mönstrad hallmatta
    R(ctx, x, y, ww, hh, "#b9a184");
    R(ctx, x + 2, y + 2, ww - 4, hh - 4, "#e1d4bd");
    for (let j = 4; j < hh - 4; j++)
      for (let i = 4; i < ww - 4; i++) if ((i + j) % 8 === 0 || (i - j + 400) % 8 === 0) R(ctx, x + i, y + j, 1, 1, "#c9b597");
  }
  R(ctx, x, y + hh - 1, ww, 1, "rgba(0,0,0,0.12)");
}

function drawRoundRug(ctx: CanvasRenderingContext2D, f: Furn, x0: number, y0: number, w: number, h: number) {
  const cx = x0 + w / 2;
  const cy = y0 + h / 2;
  const rx = w / 2 - 2;
  const ry = h / 2 - 2;
  const pink = f.variant === 2;
  const base = pink ? "#d6a2a6" : "#45484e";
  const edge = pink ? "#c48b90" : "#383b40";
  const hi = pink ? "#e2b6b9" : "#50545a";
  ellipse(ctx, cx + 1, cy + 2, rx, ry, "rgba(0,0,0,0.12)");
  ellipse(ctx, cx, cy, rx, ry, edge);
  ellipse(ctx, cx, cy, rx - 2, ry - 2, base);
  for (let j = -ry; j < ry; j += 1)
    for (let i = -rx; i < rx; i += 1) {
      if ((i * i) / (rx * rx) + (j * j) / (ry * ry) > 0.85) continue;
      if (hash(i, j, pink ? 1 : 2) < 0.06) R(ctx, Math.round(cx + i), Math.round(cy + j), 1, 1, hi);
    }
}

function drawDoormat(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number) {
  R(ctx, x0 + 2, y0 + 4, w - 4, h - 8, "#3a2f28");
  R(ctx, x0 + 3, y0 + 5, w - 6, h - 10, "#8b6a43");
  for (let j = 0; j < h - 10; j += 2) R(ctx, x0 + 3, y0 + 5 + j, w - 6, 1, "#7c5d3a");
  pixelText(ctx, "20", x0 + w / 2 - 4, y0 + h / 2 - 2, "#3a2f28");
}

function drawWallItem(ctx: CanvasRenderingContext2D, f: Furn, x0: number, y0: number) {
  const w = f.w * TILE;
  const r = rng(f.x * 131 + f.y * 17);
  switch (f.kind) {
    case "whiteboard": {
      R(ctx, x0 + 1, y0 + 2, w - 2, 12, "#9aa1a9");
      R(ctx, x0 + 2, y0 + 3, w - 4, 10, "#fbfbfa");
      R(ctx, x0 + 2, y0 + 3, w - 4, 1, "#ffffff");
      // klotter: rutor, pilar, kurvor
      const cols = ["#2d6cdf", "#d63c3c", "#2f9e57", "#222"];
      for (let k = 0; k < 4; k++) {
        const bx = x0 + 4 + Math.floor(r() * (w - 14));
        const by = y0 + 4 + Math.floor(r() * 5);
        const c = cols[Math.floor(r() * cols.length)];
        if (r() < 0.5) {
          R(ctx, bx, by, 6, 1, c);
          R(ctx, bx, by + 3, 6, 1, c);
          R(ctx, bx, by, 1, 4, c);
          R(ctx, bx + 5, by, 1, 4, c);
        } else {
          for (let i = 0; i < 7; i++) R(ctx, bx + i, by + Math.round(Math.sin(i * 0.9) * 1.5) + 2, 1, 1, c);
        }
      }
      for (let k = 0; k < 2; k++) {
        const ax = x0 + 6 + Math.floor(r() * (w - 16));
        R(ctx, ax, y0 + 10, 5, 1, "#222");
        R(ctx, ax + 4, y0 + 9, 1, 3, "#222");
      }
      R(ctx, x0 + w - 7, y0 + 4, 3, 3, "#ffe36e");
      R(ctx, x0 + w - 11, y0 + 5, 3, 3, "#ff9fc4");
      R(ctx, x0 + 3, y0 + 13, w - 6, 1, "#7d848c");
      R(ctx, x0 + 6, y0 + 12, 3, 1, "#d63c3c");
      R(ctx, x0 + 10, y0 + 12, 3, 1, "#2d6cdf");
      break;
    }
    case "tv": {
      R(ctx, x0 + 2, y0 + 3, w - 4, 10, "#16171b");
      R(ctx, x0 + 3, y0 + 4, w - 6, 8, "#23324a");
      R(ctx, x0 + w / 2 - 1, y0 + 13, 2, 1, "#16171b");
      break;
    }
    case "painting": {
      const v = f.variant ?? 0;
      const frame = v === 5 ? "#b38a3e" : v === 6 ? "#1d1d22" : v % 2 ? "#2b2420" : "#d9c08a";
      R(ctx, x0 + 2, y0 + 3, w - 4, 10, frame);
      const ix = x0 + 3;
      const iy = y0 + 4;
      const iw = w - 6;
      const ih = 8;
      if (v === 1) {
        R(ctx, ix, iy, iw, ih, "#f2efe6");
        R(ctx, ix, iy, 4, 4, "#d23a2f");
        R(ctx, ix + iw - 3, iy + 4, 3, 4, "#2d55b5");
        R(ctx, ix + 5, iy + 5, 3, 3, "#f2c230");
        R(ctx, ix + 4, iy, 1, ih, "#111");
        R(ctx, ix, iy + 4, iw, 1, "#111");
      } else if (v === 2) {
        R(ctx, ix, iy, iw, 4, "#a9d1ec");
        R(ctx, ix, iy + 4, iw, 4, "#3f6fa0");
        R(ctx, ix + 3, iy + 3, 7, 2, "#4f8a4a");
        R(ctx, ix + iw - 8, iy + 4, 6, 2, "#4f8a4a");
        R(ctx, ix + 5, iy + 2, 2, 2, "#b5372d");
      } else if (v === 3) {
        R(ctx, ix, iy, iw, ih, "#f4ecd9");
        for (let i = 0; i < iw; i += 4) {
          R(ctx, ix + i + 1, iy + 2, 1, 5, "#4f7d3f");
          R(ctx, ix + i, iy + 3, 1, 1, "#6ca05a");
          R(ctx, ix + i + 2, iy + 2, 1, 1, "#e07b9d");
        }
      } else if (v === 4) {
        R(ctx, ix, iy, iw, ih, "#f3d8c8");
        ellipse(ctx, ix + iw / 2 - 3, iy + 4, 5, 3, "#ef8f6e");
        ellipse(ctx, ix + iw / 2 + 5, iy + 5, 4, 2, "#e86a8a");
      } else if (v === 5) {
        R(ctx, ix, iy, iw, ih, "#3a2e2a");
        R(ctx, ix + iw / 2 - 2, iy + 1, 4, 4, "#e2c3a4");
        R(ctx, ix + iw / 2 - 2, iy + 1, 4, 1, "#d6d6d6");
        R(ctx, ix + iw / 2 - 2, iy + 4, 4, 1, "#cfcfcf");
        R(ctx, ix + iw / 2 - 3, iy + 5, 6, 3, "#1f1f26");
      } else if (v === 6) {
        R(ctx, ix, iy, iw, ih, "#f6f2ea");
        R(ctx, ix + 1, iy + 2, iw - 2, 1, "#ff5ec4");
        R(ctx, ix + 1, iy + 4, iw - 2, 1, "#5b8cff");
        R(ctx, ix + 1, iy + 6, iw - 2, 1, "#31c48d");
      } else {
        R(ctx, ix, iy, iw, ih, "#e6d6b8");
        R(ctx, ix + 2, iy + 2, iw - 4, ih - 4, "#c5873d");
      }
      R(ctx, x0 + 2, y0 + 13, w - 4, 1, "rgba(0,0,0,0.2)");
      break;
    }
    case "clock": {
      ellipse(ctx, x0 + 8, y0 + 8, 5, 5, "#2a2a2e");
      ellipse(ctx, x0 + 8, y0 + 8, 4, 4, "#fbfaf6");
      for (const [dx, dy] of [[0, -3], [3, 0], [0, 3], [-3, 0]]) R(ctx, x0 + 8 + dx, y0 + 8 + dy, 1, 1, "#555");
      break;
    }
    case "neon_sign": {
      R(ctx, x0 + 1, y0 + 4, w - 2, 9, "#2a2230");
      R(ctx, x0 + 1, y0 + 4, w - 2, 1, "#3b3242");
      break;
    }
    case "projector_screen": {
      R(ctx, x0 + 1, y0 + 2, w - 2, 2, "#2a2a2e");
      R(ctx, x0 + 2, y0 + 4, w - 4, 10, "#f7f7f5");
      R(ctx, x0 + 2, y0 + 13, w - 4, 1, "#d0d0cc");
      R(ctx, x0 + 5, y0 + 6, w - 10, 1, "#c9d3e6");
      R(ctx, x0 + 5, y0 + 8, w - 16, 1, "#dfe5ef");
      R(ctx, x0 + 5, y0 + 10, w - 12, 1, "#dfe5ef");
      break;
    }
    case "elevator": {
      R(ctx, x0 + 3, y0 + 1, w - 6, 15, "#a8823f");
      R(ctx, x0 + 5, y0 + 3, w - 10, 13, "#1b1a1d");
      for (let i = 0; i < w - 10; i++)
        for (let j = 0; j < 13; j++) if ((i + j) % 4 === 0 || (i - j + 40) % 4 === 0) R(ctx, x0 + 5 + i, y0 + 3 + j, 1, 1, "#c9a14e");
      R(ctx, x0 + w / 2 - 2, y0 + 1, 4, 1, "#f1d98a");
      break;
    }
  }
}
