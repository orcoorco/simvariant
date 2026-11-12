// Möbelsprites (förrenderade) + dynamiska detaljer (skärmar, ånga, lysdioder, klocka, neon).
import { DOWN, LEFT, RIGHT, TILE, UP, type Furn, type FurnKind, type OfficeMap } from "../../shared/map.ts";
import type { WorldState } from "../../shared/protocol.ts";
import { ellipse, hash, makeCanvas, pixelText, R, ring, rng, shade } from "./pixel.ts";
import { M } from "./staticLayer.ts";

export const KIND_LABEL: Record<FurnKind, string> = {
  desk: "Skrivbordet",
  chair: "Stolen",
  officechair: "Kontorsstolen",
  monitor: "Skärmen",
  dining_table: "Matbordet",
  round_table: "Mötesbordet",
  coffee_table: "Soffbordet",
  side_table: "Sidobordet",
  sofa: "Soffan",
  armchair: "Fåtöljen",
  bench: "Bänken",
  counter: "Köksbänken",
  fridge: "Kylskåpet",
  sink: "Diskhon",
  stove: "Mikron",
  dishwasher: "Diskmaskinen",
  coffee_machine: "Kaffemaskinen",
  water_cooler: "Vattenautomaten",
  plant: "Krukväxten",
  big_plant: "Fikusen",
  server_rack: "Servern",
  arcade: "Arkadmaskinen",
  toilet: "Toaletten",
  wc_sink: "Handfatet",
  whiteboard: "Whiteboarden",
  tv: "Tv:n",
  painting: "Tavlan",
  clock: "Klockan",
  kakelugn: "Kakelugnen",
  coat_rack: "Hatthyllan",
  shoe_rack: "Skohyllan",
  bookshelf: "Bokhyllan",
  lockers: "Skåpen",
  cabinet: "Skåpet",
  printer: "Skrivaren",
  rug: "Mattan",
  round_rug: "Mattan",
  doormat: "Dörrmattan",
  lamp_maskros: "Maskroslampan",
  lamp_pendant: "Taklampan",
  neon_sign: "Neonskylten",
  elevator: "Hissen",
  railing: "Räcket",
  flowerbox: "Blomlådan",
  trash: "Soptunnan",
  fruit_bowl: "Fruktskålen",
  projector_screen: "Projektorduken",
  phone_booth: "Telefonen",
};

const PX = 6; // sidomarginal i sprite-canvas
const PT = 38; // toppmarginal (höga möbler)

export interface FurnDrawable {
  f: Furn;
  img: HTMLCanvasElement;
  dx: number; // världspixel för canvasens övre vänstra hörn
  dy: number;
  sortY: number;
  back?: { img: HTMLCanvasElement; sortY: number };
  dyn: boolean;
  hit: [number, number, number, number];
  isBengt?: boolean;
}

const COUNTERISH = new Set<FurnKind>(["counter", "sink", "stove", "dishwasher", "fridge", "fruit_bowl", "water_cooler", "printer", "coffee_machine"]);
const SEATS = new Set<FurnKind>(["sofa", "armchair", "bench", "toilet"]);
const DYN = new Set<FurnKind>(["coffee_machine", "server_rack", "arcade", "printer", "water_cooler", "monitor", "kakelugn"]);

type Ctx = CanvasRenderingContext2D;

export function buildFurniture(map: OfficeMap): { items: FurnDrawable[]; overhead: Furn[]; wallDyn: Furn[] } {
  const items: FurnDrawable[] = [];
  const overhead: Furn[] = [];
  const wallDyn: Furn[] = [];
  const at = (x: number, y: number) => map.furniture.filter((q) => !q.wall && !q.overhead && x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h);
  for (const f of map.furniture) {
    if (f.overhead) {
      overhead.push(f);
      continue;
    }
    if (f.wall) {
      if (f.kind === "clock" || f.kind === "neon_sign" || f.kind === "tv") wallDyn.push(f);
      continue;
    }
    if (f.kind === "rug" || f.kind === "round_rug" || f.kind === "doormat") continue;
    const W = f.w * TILE;
    const H = f.h * TILE;
    const r = rng(f.x * 977 + f.y * 131 + f.w);
    const below = at(f.x, f.y + f.h).some((q) => COUNTERISH.has(q.kind));
    const [img, c] = makeCanvas(W + PX * 2, H + PT + 6);
    c.translate(PX, PT);
    let back: HTMLCanvasElement | undefined;
    const wx = (f.x + M) * TILE;
    const wy = (f.y + M) * TILE;
    let sortY = wy + H;
    let backSort = 0;
    const isBengt = f.kind === "big_plant" && f.room === "hall" && f.x === 17 && f.y === 32;
    switch (f.kind) {
      case "desk":
        desk(c, W, H, r, f);
        break;
      case "monitor": {
        monitor(c, f.dir ?? DOWN);
        const d = at(f.x, f.y).find((q) => q.kind === "desk");
        sortY = d ? (d.y + d.h + M) * TILE + 0.5 : wy + H;
        break;
      }
      case "officechair":
      case "chair": {
        const parts = chair(f);
        c.drawImage(parts.base, -PX, -PT);
        back = parts.back ?? undefined;
        const dir = f.dir ?? DOWN;
        sortY = wy + 2;
        backSort = wy + 15;
        if (dir === UP) sortY = wy + 3;
        break;
      }
      case "dining_table":
        diningTable(c, W, H, r);
        break;
      case "round_table":
        roundTable(c, W, H, r);
        break;
      case "coffee_table":
        coffeeTable(c, W, H);
        break;
      case "side_table":
        sideTable(c);
        break;
      case "sofa": {
        const p = sofa(f, W, H);
        c.drawImage(p.base, -PX, -PT);
        sortY = wy + 1;
        break;
      }
      case "armchair": {
        const p = armchair(f);
        c.drawImage(p.base, -PX, -PT);
        back = p.back ?? undefined;
        sortY = wy + 1;
        backSort = wy + 15;
        break;
      }
      case "bench": {
        const p = bench(W, H);
        c.drawImage(p.base, -PX, -PT);
        back = p.back;
        sortY = wy + 1;
        backSort = wy + H - 1;
        break;
      }
      case "counter":
        counter(c, f.room === "pentry" ? "#9a6a43" : "#e6e4de", below);
        break;
      case "sink":
        counter(c, "#9a6a43", below);
        R(c, 4, 1, 9, 8, "#aeb5bc");
        R(c, 5, 2, 7, 6, "#8f979f");
        R(c, 8, 5, 1, 1, "#5b636b");
        R(c, 13, 2, 1, 4, "#d5dade");
        R(c, 11, 2, 3, 1, "#d5dade");
        R(c, 2, 9, 2, 3, "#f2c230");
        break;
      case "stove":
        counter(c, "#9a6a43", below);
        R(c, 1, -9, 14, 11, "#f3f3f1");
        R(c, 1, -9, 14, 1, "#ffffff");
        R(c, 2, -7, 9, 7, "#2b2d31");
        R(c, 3, -6, 2, 1, "#5a5e66");
        R(c, 12, -7, 2, 7, "#d6d8db");
        R(c, 12, -6, 1, 1, "#3ddc84");
        R(c, 12, -4, 1, 1, "#9aa0a6");
        R(c, 12, -2, 1, 1, "#9aa0a6");
        break;
      case "dishwasher":
        counter(c, "#9a6a43", true);
        R(c, 0, 10, 16, 6, "#c8cdd2");
        R(c, 0, 10, 16, 1, "#e3e7ea");
        R(c, 3, 12, 10, 1, "#8d949b");
        pixelText(c, "DM", 5, 3, "#6d4a2c");
        break;
      case "trash":
        R(c, 4, 3, 8, 11, "#c3c8cd");
        R(c, 4, 3, 2, 11, "#dfe3e6");
        R(c, 10, 3, 2, 11, "#a7adb3");
        R(c, 3, 1, 10, 3, "#9aa1a8");
        R(c, 3, 1, 10, 1, "#c5cacf");
        R(c, 7, 14, 3, 1, "#555a60");
        break;
      case "fridge":
        fridge(c, r);
        break;
      case "coffee_machine":
        counter(c, "#e6e4de", below);
        coffeeMachine(c);
        break;
      case "water_cooler":
        R(c, 3, 0, 10, 14, "#eef0f2");
        R(c, 3, 0, 10, 1, "#ffffff");
        R(c, 12, 0, 1, 14, "#cfd3d7");
        R(c, 6, 3, 4, 2, "#dfe3e7");
        R(c, 6, 3, 1, 1, "#3c7bd9");
        R(c, 9, 3, 1, 1, "#e04848");
        R(c, 5, 9, 6, 1, "#c8ccd0");
        R(c, 4, -13, 8, 13, "#a8d8f4");
        R(c, 4, -8, 8, 8, "#7cc0ea");
        R(c, 5, -12, 1, 11, "#e2f4fd");
        R(c, 6, -14, 4, 1, "#3c7bd9");
        break;
      case "printer":
        counter(c, "#e6e4de", below);
        R(c, 1, -6, 14, 11, "#dfe1e3");
        R(c, 1, -6, 14, 3, "#c5c8cc");
        R(c, 1, -6, 14, 1, "#eef0f1");
        R(c, 3, -1, 10, 1, "#4a4d52");
        R(c, 3, 3, 10, 2, "#ffffff");
        R(c, 9, -5, 3, 1, "#6fb7ff");
        break;
      case "fruit_bowl":
        counter(c, "#e6e4de", below);
        ellipse(c, 8, 6, 6, 3, "#f2efe8");
        R(c, 3, 2, 6, 1, "#f2d03b");
        R(c, 4, 3, 6, 1, "#e9c22d");
        R(c, 2, 2, 1, 1, "#7a5a1a");
        R(c, 9, 3, 2, 2, "#d23a2f");
        R(c, 6, 4, 2, 2, "#7bbf3a");
        R(c, 11, 4, 2, 2, "#f08a24");
        R(c, 10, 3, 1, 1, "#ffffff");
        break;
      case "plant":
        plant(c, f.variant ?? 0, r);
        break;
      case "big_plant":
        bigPlant(c, 1, r);
        break;
      case "server_rack":
        serverRack(c);
        break;
      case "arcade":
        arcade(c);
        break;
      case "toilet":
        R(c, 4, 0, 8, 4, "#f4f6f6");
        R(c, 4, 0, 8, 1, "#ffffff");
        R(c, 7, 1, 2, 1, "#c9d0d4");
        ellipse(c, 8, 9, 4, 5, "#c9d0d4");
        ellipse(c, 8, 9, 3, 4, "#f7f8f8");
        ellipse(c, 8, 9, 2, 2, "#bfe3f2");
        R(c, 13, 7, 2, 3, "#ffffff");
        R(c, 13, 7, 2, 1, "#dfe3e6");
        sortY = wy + 1;
        break;
      case "wc_sink":
        ellipse(c, 8, 8, 6, 4, "#c9d0d4");
        ellipse(c, 8, 7, 6, 4, "#f7f8f8");
        ellipse(c, 8, 7, 4, 2, "#dfe8ec");
        R(c, 7, 2, 2, 3, "#c0c7cc");
        R(c, 12, 2, 2, 3, "#7fd1a8");
        break;
      case "kakelugn":
        kakelugn(c, f.variant ?? 0);
        break;
      case "coat_rack":
        coatRack(c, H, r);
        break;
      case "shoe_rack":
        shoeRack(c, H, r);
        break;
      case "bookshelf":
        bookshelf(c, W, f.room === "kontor3" ? "#f2f0ea" : "#a2774c", r);
        break;
      case "lockers":
        lockers(c, H);
        break;
      case "cabinet":
        cabinet(c, W, H, r);
        break;
      case "phone_booth":
        ellipse(c, 8, 10, 5, 4, "#6b4527");
        ellipse(c, 8, 9, 5, 4, "#8b5e3c");
        R(c, 5, 3, 6, 5, "#c0392b");
        R(c, 5, 3, 6, 1, "#e0574a");
        R(c, 4, 1, 8, 2, "#a93226");
        R(c, 4, 1, 2, 1, "#c0392b");
        R(c, 10, 1, 2, 1, "#c0392b");
        ring(c, 8, 6, 2, 1, "#f5f5f5");
        R(c, 12, 6, 1, 4, "#222");
        break;
      case "flowerbox":
        R(c, 1, 7, 14, 7, "#8b5e3c");
        R(c, 1, 7, 14, 1, "#a8744d");
        R(c, 2, 6, 12, 2, "#4a3526");
        for (let i = 0; i < 6; i++) {
          const x = 2 + i * 2;
          R(c, x, 3 + (i % 2), 1, 3, "#3e8a3a");
          R(c, x, 2 + (i % 2), 2, 2, i % 3 === 0 ? "#e8456b" : "#d42f2f");
        }
        break;
      default:
        R(c, 2, 2, W - 4, H - 4, "#8a8a8a");
    }
    const hitTop = f.kind === "kakelugn" ? -30 : ["fridge", "server_rack", "arcade", "bookshelf", "big_plant", "water_cooler", "coffee_machine"].includes(f.kind) ? -18 : -4;
    items.push({
      f,
      img,
      dx: wx - PX,
      dy: wy - PT,
      sortY,
      back: back ? { img: back, sortY: backSort } : undefined,
      dyn: DYN.has(f.kind) || isBengt,
      hit: [wx, wy + hitTop, wx + W, wy + H],
      isBengt,
    });
  }
  return { items, overhead, wallDyn };
}

// ---------------------------------------------------------------- möbler

function desk(c: Ctx, W: number, H: number, r: () => number, f: Furn) {
  R(c, 1, H - 1, W - 2, 1, "rgba(0,0,0,0.18)");
  R(c, 2, H - 6, 2, 6, "#7b7e85");
  R(c, W - 4, H - 6, 2, 6, "#7b7e85");
  R(c, 1, 0, W - 2, H - 7, "#f4f4f1");
  R(c, 1, 0, W - 2, 1, "#ffffff");
  R(c, W - 2, 0, 1, H - 7, "#e4e4e0");
  R(c, 1, H - 7, W - 2, 2, "#d3d3ce");
  R(c, 1, H - 5, W - 2, 1, "#b9b9b4");
  // grejer på skrivbordet
  const n = 2 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const x = 2 + Math.floor(r() * (W - 8));
    const y = 1 + Math.floor(r() * Math.max(1, H - 13));
    const k = Math.floor(r() * 5);
    if (k === 0) {
      R(c, x, y, 5, 4, "#ffffff");
      R(c, x + 1, y + 1, 3, 1, "#b8bcc4");
      R(c, x + 1, y + 2, 2, 1, "#b8bcc4");
    } else if (k === 1) {
      const mug = ["#e85d75", "#3c7bd9", "#2fb380", "#f2c230", "#222"][Math.floor(r() * 5)];
      R(c, x, y, 3, 3, mug);
      R(c, x + 3, y + 1, 1, 1, mug);
      R(c, x + 1, y, 1, 1, "#5a3a24");
    } else if (k === 2) {
      R(c, x, y + 1, 3, 2, "#c56a43");
      R(c, x, y - 1, 1, 2, "#3e8a3a");
      R(c, x + 2, y - 1, 1, 2, "#4fa14a");
      R(c, x + 1, y - 2, 1, 2, "#3e8a3a");
    } else if (k === 3) {
      R(c, x, y, 4, 5, f.room === "kontor3" ? "#2b3a6a" : "#7a2d2f");
      R(c, x + 3, y, 1, 5, "#ffffff");
    } else {
      R(c, x, y + 2, 5, 1, "#2d6cdf");
      R(c, x + 1, y, 4, 1, "#d63c3c");
    }
  }
}

function monitor(c: Ctx, dir: number) {
  if (dir === DOWN) {
    R(c, 3, 10, 10, 3, "#cfd2d6");
    R(c, 3, 10, 10, 1, "#e9ebee");
    for (let i = 0; i < 5; i++) R(c, 4 + i * 2, 11, 1, 1, "#a9adb3");
    R(c, 14, 11, 1, 2, "#e9ebee");
    R(c, 5, 8, 6, 1, "#9da2a9");
    R(c, 7, 5, 2, 3, "#b5b9bf");
    R(c, 2, -6, 12, 11, "#c9ccd1");
    R(c, 2, -6, 12, 1, "#e3e6e9");
    R(c, 3, -5, 10, 7, "#1d2a44");
    R(c, 2, 3, 12, 2, "#dfe2e6");
  } else if (dir === UP) {
    R(c, 3, 1, 10, 3, "#cfd2d6");
    R(c, 3, 1, 10, 1, "#e9ebee");
    for (let i = 0; i < 5; i++) R(c, 4 + i * 2, 2, 1, 1, "#a9adb3");
    R(c, 14, 2, 1, 2, "#e9ebee");
    R(c, 2, -2, 12, 11, "#d7dade");
    R(c, 2, -2, 12, 1, "#eef0f2");
    R(c, 13, -2, 1, 11, "#bfc3c8");
    R(c, 7, 2, 2, 2, "#b9bdc3");
    R(c, 6, 9, 4, 2, "#b5b9bf");
  } else {
    const L = dir === LEFT;
    const fx = (x: number, w: number) => (L ? x : 16 - x - w);
    R(c, fx(1, 3), 3, 3, 9, "#cfd2d6");
    for (let i = 0; i < 4; i++) R(c, fx(2, 1), 4 + i * 2, 1, 1, "#a9adb3");
    R(c, fx(8, 5), 10, 5, 2, "#9da2a9");
    R(c, fx(9, 2), 5, 2, 6, "#b5b9bf");
    R(c, fx(6, 3), -5, 3, 13, "#c9ccd1");
    R(c, fx(6, 1), -4, 1, 11, "#7fb3ff");
  }
}

function chair(f: Furn): { base: HTMLCanvasElement; back: HTMLCanvasElement | null } {
  const office = f.kind === "officechair";
  const meeting = f.room.startsWith("mote") || f.room === "lounge";
  const seatC = office ? "#2f3036" : meeting ? "#8c8f94" : "#1f1f23";
  const backC = office ? "#26272c" : meeting ? "#7c7f84" : "#18181b";
  const hiC = shade(seatC, 0.18);
  const legC = office ? "#55585f" : "#2a2a2e";
  const dir = f.dir ?? DOWN;
  const [base, b] = makeCanvas(16 + PX * 2, 16 + PT + 6);
  b.translate(PX, PT);
  let back: HTMLCanvasElement | null = null;
  const legs = (y: number) => {
    if (office) {
      R(b, 7, y, 2, 3, legC);
      R(b, 3, y + 2, 10, 1, legC);
      R(b, 2, y + 3, 2, 1, "#1a1a1a");
      R(b, 12, y + 3, 2, 1, "#1a1a1a");
      R(b, 7, y + 4, 2, 1, "#1a1a1a");
    } else {
      R(b, 4, y, 1, 4, legC);
      R(b, 11, y, 1, 4, legC);
    }
  };
  const mk = (): [HTMLCanvasElement, Ctx] => {
    const [cv, cc] = makeCanvas(16 + PX * 2, 16 + PT + 6);
    cc.translate(PX, PT);
    return [cv, cc];
  };
  if (dir === DOWN) {
    R(b, 4, -7, 8, 10, backC);
    R(b, 4, -7, 8, 1, hiC);
    if (office) for (let y = -5; y < 2; y += 2) R(b, 5, y, 6, 1, shade(backC, 0.12));
    R(b, 3, 3, 10, 6, seatC);
    R(b, 3, 3, 10, 1, hiC);
    legs(9);
  } else if (dir === UP) {
    R(b, 3, 1, 10, 6, seatC);
    R(b, 3, 1, 10, 1, hiC);
    legs(7);
    const [bc, bb] = mk();
    R(bb, 3, 2, 10, 10, backC);
    R(bb, 3, 2, 10, 1, hiC);
    if (office) for (let y = 4; y < 11; y += 2) R(bb, 4, y, 8, 1, shade(backC, 0.12));
    back = bc;
  } else {
    const L = dir === LEFT;
    R(b, 3, 4, 10, 6, seatC);
    R(b, 3, 4, 10, 1, hiC);
    legs(10);
    const [bc, bb] = mk();
    const x = L ? 12 : 1;
    R(bb, x, -6, 3, 14, backC);
    R(bb, x, -6, 3, 1, hiC);
    back = bc;
  }
  return { base, back };
}

function diningTable(c: Ctx, W: number, H: number, r: () => number) {
  R(c, 1, H - 1, W - 2, 1, "rgba(0,0,0,0.18)");
  R(c, 3, H - 8, 2, 8, "#1e1e22");
  R(c, W - 5, H - 8, 2, 8, "#1e1e22");
  R(c, 1, 0, W - 2, H - 8, "#f5f4f0");
  R(c, 1, 0, W - 2, 1, "#ffffff");
  R(c, 1, H - 8, W - 2, 3, "#d8d6cf");
  R(c, 1, H - 5, W - 2, 1, "#bdbbb4");
  // bricka med flaskor
  ellipse(c, W / 2, 11, 9, 5, "#7a4c2c");
  ellipse(c, W / 2, 10, 8, 4, "#a26d44");
  R(c, W / 2 - 4, 4, 2, 7, "#3f5a2a");
  R(c, W / 2 - 4, 3, 2, 1, "#c9a54e");
  R(c, W / 2 - 1, 5, 2, 6, "#6b2a2a");
  R(c, W / 2 + 2, 7, 3, 4, "#e9e6df");
  // eukalyptus i vas
  R(c, 14, 8, 3, 5, "#e9edf0");
  for (let i = 0; i < 9; i++) R(c, 12 + Math.floor(r() * 8), 2 + Math.floor(r() * 7), 2, 1, i % 2 ? "#8fb3a0" : "#6f9a86");
  // tidning
  R(c, W - 20, 6, 8, 6, "#ece8dc");
  R(c, W - 19, 7, 6, 1, "#9a948a");
  R(c, W - 19, 9, 4, 1, "#9a948a");
}

function roundTable(c: Ctx, W: number, H: number, r: () => number) {
  const cx = W / 2;
  const cy = H / 2 - 2;
  ellipse(c, cx + 1, cy + 6, W / 2 - 4, H / 2 - 7, "rgba(0,0,0,0.15)");
  R(c, cx - 2, cy + 8, 4, 9, "#2a2a2e");
  ellipse(c, cx, cy + 3, W / 2 - 4, H / 2 - 8, "#d5d5d0");
  ellipse(c, cx, cy, W / 2 - 4, H / 2 - 8, "#f6f6f3");
  ellipse(c, cx - 4, cy - 4, W / 4, H / 6, "#fbfbf9");
  // karaff och glas
  R(c, cx - 2, cy - 5, 4, 6, "#bfe0f0");
  R(c, cx - 1, cy - 7, 2, 2, "#bfe0f0");
  R(c, cx - 2, cy - 5, 1, 6, "#e6f5fb");
  R(c, cx + 6, cy, 2, 3, "#d9eef8");
  R(c, cx - 9, cy + 2, 2, 3, "#d9eef8");
  R(c, cx + 2, cy + 5, 6, 4, "#2b3a6a");
  R(c, cx + 2, cy + 5, 6, 1, "#3d4f86");
  if (r() < 0.6) {
    R(c, cx - 10, cy - 6, 4, 4, "#ffe36e");
  }
}

function coffeeTable(c: Ctx, W: number, H: number) {
  if (W > 16) {
    const cx = W / 2;
    const cy = H / 2 - 1;
    ellipse(c, cx + 1, cy + 4, 12, 9, "rgba(0,0,0,0.15)");
    ellipse(c, cx, cy + 2, 12, 9, "#a8743f");
    ellipse(c, cx, cy, 12, 9, "#c99a64");
    ellipse(c, cx - 3, cy - 3, 6, 4, "#d6aa76");
    R(c, cx - 7, cy - 2, 6, 5, "#e8e4da");
    R(c, cx - 6, cy - 1, 4, 1, "#d06a5a");
    R(c, cx + 3, cy - 3, 3, 4, "#f4efe4");
    R(c, cx + 4, cy - 5, 1, 2, "#ffcf5a");
    R(c, cx + 1, cy + 3, 3, 3, "#4f8a4a");
    return;
  }
  ellipse(c, 9, 11, 6, 4, "rgba(0,0,0,0.15)");
  ellipse(c, 8, 10, 6, 5, "#946338");
  ellipse(c, 8, 8, 6, 5, "#c08b55");
  ellipse(c, 6, 6, 3, 2, "#d3a06a");
  R(c, 5, 6, 5, 3, "#2b3a6a");
  R(c, 5, 6, 5, 1, "#3d4f86");
}

function sideTable(c: Ctx) {
  ellipse(c, 9, 12, 5, 3, "rgba(0,0,0,0.15)");
  ellipse(c, 8, 11, 5, 4, "#946338");
  ellipse(c, 8, 9, 5, 4, "#c08b55");
  R(c, 8, 1, 1, 8, "#b38a3e");
  R(c, 5, -3, 7, 5, "#f3eadb");
  R(c, 5, -3, 7, 1, "#fffaf0");
  R(c, 6, 2, 5, 1, "#d9cdb5");
}

function sofa(f: Furn, W: number, H: number): { base: HTMLCanvasElement } {
  const [base, c] = makeCanvas(W + PX * 2, H + PT + 6);
  c.translate(PX, PT);
  const col = "#a7a6a2";
  const dkc = "#8e8d89";
  const arm = "#9c9b97";
  if ((f.dir ?? LEFT) === LEFT) {
    R(c, 1, H, 2, 2, "#3a3a3a");
    R(c, 1, -2, 1, 2, "#3a3a3a");
    R(c, 9, -5, 7, H + 6, dkc);
    R(c, 9, -5, 7, 1, "#b0afab");
    R(c, 15, -5, 1, H + 6, "#7d7c78");
    R(c, 1, -5, 14, 6, arm);
    R(c, 1, -5, 14, 1, "#b8b7b3");
    R(c, 1, H - 5, 14, 6, arm);
    R(c, 1, H - 5, 14, 1, "#b8b7b3");
    R(c, 1, H + 1, 14, 1, "#6f6e6a");
    for (let y = 1; y < H - 5; y++) R(c, 1, y, 8, 1, col);
    for (let i = 1; i < f.h; i++) R(c, 1, i * 16 - 1, 8, 1, "#8f8e8a");
    for (let i = 0; i < f.h; i++) R(c, 1, i * 16 + 1, 8, 1, "#b8b7b3");
    R(c, 0, 1, 1, H - 6, "#868581");
    R(c, 7, 6, 3, 7, "#d9a441");
    R(c, 7, 6, 3, 1, "#e9bd5f");
    R(c, 7, H - 22, 3, 7, "#c96f4a");
    R(c, 7, H - 22, 3, 1, "#dd8a66");
  } else {
    R(c, 0, -5, W, 7, dkc);
    R(c, 0, -5, W, 1, "#b0afab");
    R(c, 0, -5, 4, H, arm);
    R(c, W - 4, -5, 4, H, arm);
    R(c, 4, 2, W - 8, H - 6, col);
    R(c, 0, H - 4, W, 3, "#8f8e8a");
  }
  return { base };
}

function armchair(f: Furn): { base: HTMLCanvasElement; back: HTMLCanvasElement | null } {
  const col = f.room === "kontor2" ? "#c99a3c" : f.room === "samtal" ? "#4f7a5a" : "#9fa1a4";
  const bk = shade(col, -0.16);
  const ar = shade(col, -0.06);
  const hi = shade(col, 0.15);
  const dir = f.dir ?? DOWN;
  const mk = (): [HTMLCanvasElement, Ctx] => {
    const [cv, cc] = makeCanvas(16 + PX * 2, 16 + PT + 6);
    cc.translate(PX, PT);
    return [cv, cc];
  };
  const [base, c] = mk();
  ellipse(c, 8, 14, 7, 2, "rgba(0,0,0,0.15)");
  let back: HTMLCanvasElement | null = null;
  if (dir === DOWN) {
    R(c, 1, -5, 14, 8, bk);
    R(c, 1, -5, 14, 1, hi);
    R(c, 1, 1, 3, 12, ar);
    R(c, 12, 1, 3, 12, ar);
    R(c, 1, 1, 3, 1, hi);
    R(c, 12, 1, 3, 1, hi);
    R(c, 4, 3, 8, 9, col);
    R(c, 4, 3, 8, 1, hi);
    R(c, 2, 12, 12, 2, shade(col, -0.25));
  } else if (dir === UP) {
    R(c, 1, -1, 3, 13, ar);
    R(c, 12, -1, 3, 13, ar);
    R(c, 4, 0, 8, 10, col);
    R(c, 4, 0, 8, 1, hi);
    const [bc, bb] = mk();
    R(bb, 1, 9, 14, 6, bk);
    R(bb, 1, 9, 14, 1, hi);
    back = bc;
  } else {
    const L = dir === LEFT;
    R(c, 0, 0, 15, 3, ar);
    R(c, 0, 0, 15, 1, hi);
    R(c, 0, 11, 15, 3, ar);
    R(c, L ? 1 : 4, 3, 10, 8, col);
    R(c, L ? 1 : 4, 3, 10, 1, hi);
    const [bc, bb] = mk();
    R(bb, L ? 11 : 0, -4, 5, 17, bk);
    R(bb, L ? 11 : 0, -4, 5, 1, hi);
    back = bc;
  }
  return { base, back };
}

function bench(W: number, H: number): { base: HTMLCanvasElement; back: HTMLCanvasElement } {
  const [base, c] = makeCanvas(W + PX * 2, H + PT + 6);
  c.translate(PX, PT);
  R(c, 3, 0, 10, H, "#8f9297");
  for (let i = 1; i < H / 16; i++) R(c, 3, i * 16, 10, 1, "#7d8085");
  for (let i = 0; i < H / 16; i++) R(c, 3, i * 16 + 1, 10, 1, "#a3a6ab");
  R(c, 12, -1, 3, H + 2, "#c9a06a");
  R(c, 12, -1, 1, H + 2, "#dcb683");
  R(c, 3, H, 12, 1, "#6d5034");
  const [back, b] = makeCanvas(W + PX * 2, H + PT + 6);
  b.translate(PX, PT);
  R(b, 0, -5, 4, H + 5, "#d6d0c4");
  R(b, 0, -5, 4, 1, "#ece7dd");
  R(b, 3, -5, 1, H + 5, "#bdb6a8");
  return { base, back };
}

function counter(c: Ctx, top: string, continues: boolean) {
  const wood = top !== "#e6e4de";
  R(c, 0, -2, 16, continues ? 18 : 13, top);
  R(c, 0, -2, 16, 1, shade(top, 0.15));
  if (wood) {
    R(c, 0, 3, 16, 1, shade(top, -0.08));
    R(c, 0, 8, 16, 1, shade(top, -0.06));
  }
  // skåpfront mot rummet (väster)
  R(c, 0, -2, 3, continues ? 18 : 13, "#f3f2ee");
  R(c, 1, 3, 1, 4, "#9aa0a6");
  R(c, 3, -2, 1, continues ? 18 : 13, "#d6d4ce");
  if (!continues) {
    R(c, 0, 11, 16, 5, "#f2f1ed");
    R(c, 0, 11, 16, 1, "#d9d7d1");
    R(c, 6, 13, 4, 1, "#9aa0a6");
    R(c, 0, 15, 16, 1, "#c9c7c1");
  }
}

function fridge(c: Ctx, r: () => number) {
  R(c, 1, 15, 14, 1, "rgba(0,0,0,0.2)");
  R(c, 1, -15, 14, 30, "#f5f5f3");
  R(c, 1, -15, 14, 3, "#ffffff");
  R(c, 14, -15, 1, 30, "#dcdcd8");
  R(c, 1, -15, 1, 30, "#e8e8e4");
  R(c, 1, -3, 14, 1, "#d2d2ce");
  R(c, 12, -11, 1, 6, "#b6babf");
  R(c, 12, 1, 1, 8, "#b6babf");
  // magneter och en teckning
  R(c, 3, -10, 5, 6, "#ffffff");
  R(c, 4, -9, 3, 1, "#e85d75");
  R(c, 4, -7, 2, 2, "#3c7bd9");
  for (let i = 0; i < 4; i++) R(c, 3 + Math.floor(r() * 8), 1 + Math.floor(r() * 10), 2, 2, ["#e04848", "#f2c230", "#2fb380", "#7f5af0"][i]);
  R(c, 3, 8, 6, 2, "#ffe36e");
}

function coffeeMachine(c: Ctx) {
  R(c, 10, -16, 4, 5, "#2a2b30");
  R(c, 10, -16, 4, 2, "#6b4a2e");
  R(c, 2, -11, 12, 14, "#2a2b30");
  R(c, 2, -11, 12, 3, "#b8bec4");
  R(c, 2, -11, 12, 1, "#dfe3e6");
  R(c, 3, -13, 2, 2, "#f4f4f4");
  R(c, 6, -13, 2, 2, "#f4f4f4");
  R(c, 3, -7, 8, 1, "#3a3c42");
  R(c, 6, -5, 4, 2, "#9aa1a8");
  R(c, 7, -3, 1, 2, "#6b7078");
  R(c, 8, -3, 1, 2, "#6b7078");
  R(c, 4, 1, 8, 2, "#6b7078");
  R(c, 7, -1, 2, 2, "#f4f4f4");
  R(c, 12, -6, 1, 5, "#cfd4d9");
  R(c, 13, -9, 1, 1, "#3ddc84");
  R(c, 3, 3, 10, 1, "#1a1b1f");
}

function plant(c: Ctx, v: number, r: () => number) {
  const pot = ["#c56a43", "#eeeeea", "#3e8f8a", "#8b8f94"][v % 4];
  ellipse(c, 8, 14, 5, 2, "rgba(0,0,0,0.2)");
  R(c, 4, 7, 8, 7, pot);
  R(c, 4, 7, 2, 7, shade(pot, 0.12));
  R(c, 10, 7, 2, 7, shade(pot, -0.12));
  R(c, 3, 6, 10, 2, shade(pot, 0.18));
  R(c, 4, 6, 8, 1, "#4a3526");
  if (v === 1) {
    // svärmorstunga
    for (let k = 0; k < 6; k++) {
      const x = 4 + k * 1.4;
      const hgt = 10 + Math.floor(r() * 7);
      R(c, Math.round(x), 6 - hgt, 2, hgt, k % 2 ? "#3f7d3a" : "#4f8f45");
      R(c, Math.round(x), 6 - hgt, 1, hgt, "#c9c46a");
    }
  } else if (v === 2) {
    // monstera
    const leaves: [number, number, number][] = [[4, -2, 4], [11, -1, 4], [7, -6, 5], [8, 1, 3]];
    for (const [x, y, s] of leaves) {
      ellipse(c, x, y, s, s - 1, "#2f7a3a");
      ellipse(c, x - 1, y - 1, s - 2, s - 2, "#3f9449");
      R(c, x, y - s + 1, 1, s, "#1f5a28");
      R(c, x - s + 1, y, 1, 1, "#1f5a28");
    }
  } else if (v === 3) {
    // ormbunke/hängväxt
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI / 2 + (k - 3) * 0.45;
      for (let s = 0; s < 8; s++) {
        const x = 8 + Math.cos(a) * s * 1.1;
        const y = 5 + Math.sin(a) * s * 1.1 + (s * s) / 14;
        R(c, Math.round(x), Math.round(y), 1, 1, s % 2 ? "#5aa04e" : "#3e8a3a");
        if (s % 2 === 0) R(c, Math.round(x) + 1, Math.round(y), 1, 1, "#74b863");
      }
    }
  } else {
    ellipse(c, 8, 1, 6, 5, "#3e8a3a");
    ellipse(c, 6, -1, 4, 3, "#4fa14a");
    ellipse(c, 10, 2, 3, 3, "#4a9a45");
    for (let i = 0; i < 8; i++) R(c, 3 + Math.floor(r() * 10), -3 + Math.floor(r() * 8), 1, 1, i % 2 ? "#6fbf5f" : "#2f6b2c");
  }
}

function bigPlant(c: Ctx, size: number, r: () => number) {
  const s = Math.max(0.7, Math.min(2.2, 0.75 + size * 0.25));
  ellipse(c, 8, 15, 6, 2, "rgba(0,0,0,0.22)");
  R(c, 3, 6, 10, 9, "#e9e6df");
  R(c, 3, 6, 3, 9, "#f6f4ef");
  R(c, 11, 6, 2, 9, "#d4d0c6");
  R(c, 2, 5, 12, 2, "#ffffff");
  R(c, 3, 5, 10, 1, "#4a3526");
  const top = Math.round(-22 * s);
  R(c, 7, top + 6, 2, 6 - top, "#6b4b2e");
  const n = Math.round(9 * s);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const y = Math.round(top + t * (8 - top) - 2);
    const side = i % 2 ? 1 : -1;
    const x = 8 + side * (3 + Math.floor(r() * 3));
    ellipse(c, x, y, 3, 4, "#2b6630");
    ellipse(c, x - side, y - 1, 2, 3, "#3c8a40");
    R(c, x, y - 3, 1, 6, "#5aa65a");
  }
  ellipse(c, 8, top + 2, 3, 4, "#3c8a40");
}

function serverRack(c: Ctx) {
  R(c, 1, 15, 14, 1, "rgba(0,0,0,0.3)");
  R(c, 1, -17, 14, 32, "#1b1d22");
  R(c, 1, -17, 14, 2, "#2f323a");
  R(c, 1, -17, 1, 32, "#30333a");
  for (let y = -14; y < 12; y += 4) {
    R(c, 3, y, 10, 3, "#24272e");
    R(c, 3, y, 10, 1, "#30343c");
    for (let x = 4; x < 9; x += 2) R(c, x, y + 1, 1, 1, "#121317");
  }
}

function arcade(c: Ctx) {
  R(c, 2, 15, 13, 1, "rgba(0,0,0,0.3)");
  R(c, 2, -21, 12, 36, "#5b2a9e");
  R(c, 2, -21, 1, 36, "#7a46c4");
  R(c, 13, -21, 1, 36, "#41207a");
  R(c, 3, -22, 10, 7, "#ffd23f");
  pixelText(c, "SV", 5, -21, "#5b2a9e");
  R(c, 3, -14, 10, 9, "#111");
  R(c, 4, -13, 8, 7, "#0b1430");
  R(c, 2, -4, 12, 4, "#3a1d6e");
  R(c, 2, -4, 12, 1, "#5d34a6");
  R(c, 5, -7, 1, 3, "#222");
  R(c, 4, -8, 3, 2, "#e33b3b");
  R(c, 9, -3, 2, 1, "#3cf");
  R(c, 11, -2, 2, 1, "#fd3");
  R(c, 6, 4, 4, 6, "#2a1650");
  R(c, 7, 6, 2, 1, "#ff9f1c");
  for (let y = -18; y < 12; y += 6) {
    R(c, 3, y, 1, 3, "#ff5ec4");
    R(c, 12, y + 3, 1, 3, "#ffd23f");
  }
}

function kakelugn(c: Ctx, v: number) {
  const base = v ? "#e9eef2" : "#6e9f86";
  const hi = v ? "#ffffff" : "#93c2a8";
  const line = v ? "#c3ced8" : "#4f7d67";
  const deco = v ? "#5f84b8" : "#d9c27a";
  R(c, 1, 15, 15, 1, "rgba(0,0,0,0.25)");
  R(c, 1, 9, 14, 6, line);
  R(c, 1, 9, 14, 1, hi);
  R(c, 2, -21, 12, 30, base);
  for (let y = -21; y < 9; y += 5) R(c, 2, y, 12, 1, line);
  for (let y = -21; y < 9; y += 5)
    for (let x = 2; x < 14; x += 4) {
      R(c, x, y, 1, 5, line);
      R(c, x + 1, y + 1, 1, 1, hi);
      R(c, x + 2, y + 2, 1, 1, deco);
    }
  R(c, 13, -21, 1, 30, shade(base, -0.12));
  R(c, 1, -7, 14, 2, "#efe9dc");
  R(c, 0, -27, 16, 6, "#efe9dc");
  R(c, 0, -27, 16, 1, "#ffffff");
  for (let x = 1; x < 15; x += 2) R(c, x, -24, 1, 2, "#cfc6b4");
  R(c, 3, -30, 10, 3, "#efe9dc");
  R(c, 6, -32, 4, 2, "#efe9dc");
  R(c, 5, -2, 6, 6, "#c9a54e");
  R(c, 5, -2, 6, 1, "#f1d98a");
  R(c, 7, 0, 2, 1, "#7a5a1a");
}

function coatRack(c: Ctx, H: number, r: () => number) {
  const coats = ["#2b3a6a", "#b98552", "#a8323a", "#3d6b4a", "#1f1f23", "#d9a441", "#7a7f88", "#5a3a6a", "#c96f4a"];
  R(c, 0, -6, 8, 2, "#8b5e3c");
  R(c, 0, -6, 8, 1, "#a8744d");
  R(c, 0, -4, 2, H + 2, "#8b5e3c");
  const n = Math.floor(H / 7);
  for (let i = 0; i < n; i++) {
    const y = 1 + i * 7;
    const col = coats[Math.floor(r() * coats.length)];
    R(c, 0, y, 2, 1, "#c9a54e");
    R(c, 1, y + 1, 7 + Math.floor(r() * 2), 7, col);
    R(c, 1, y + 1, 7, 1, shade(col, 0.2));
    R(c, 6, y + 2, 1, 6, shade(col, -0.2));
    if (r() < 0.3) R(c, 2, y + 3, 5, 1, "#e8e1cf");
  }
  for (let i = 0; i < 3; i++) {
    const x = 1 + i * 2;
    R(c, x, -9 - (i % 2), 3, 3, ["#1f1f23", "#a8323a", "#b98552"][i]);
  }
  R(c, 2, H - 6, 6, 6, "#4b4f57");
  R(c, 3, H - 12, 1, 6, "#c0392b");
  R(c, 5, H - 11, 1, 5, "#2e86de");
}

function shoeRack(c: Ctx, H: number, r: () => number) {
  R(c, 0, 1, 9, H - 2, "#a0744a");
  R(c, 0, 1, 9, 1, "#bf8f60");
  for (let y = 4; y < H - 3; y += 6) {
    R(c, 1, y, 7, 1, "#7b5634");
    const col = ["#f4f4f4", "#1f1f23", "#c0392b", "#2e86de", "#d9a441"][Math.floor(r() * 5)];
    R(c, 2, y - 3, 2, 3, col);
    R(c, 5, y - 3, 2, 3, col);
  }
}

function bookshelf(c: Ctx, W: number, frame: string, r: () => number) {
  R(c, 0, 15, W, 1, "rgba(0,0,0,0.25)");
  R(c, 0, -19, W, 34, frame);
  R(c, 2, -17, W - 4, 30, shade(frame, -0.35));
  R(c, 0, -19, W, 1, shade(frame, 0.2));
  const books = ["#c0392b", "#2e86de", "#27ae60", "#f1c40f", "#8e44ad", "#e67e22", "#ecf0f1", "#2c3e50", "#e85d75"];
  for (let s = 0; s < 4; s++) {
    const y = -17 + s * 7;
    R(c, 1, y + 6, W - 2, 1, frame);
    let x = 2;
    while (x < W - 3) {
      const bw = 1 + Math.floor(r() * 2);
      const bh = 3 + Math.floor(r() * 3);
      if (r() < 0.12) {
        x += 2;
        continue;
      }
      R(c, x, y + 6 - bh, bw, bh, books[Math.floor(r() * books.length)]);
      x += bw;
    }
  }
  R(c, 2, -23, 3, 4, "#c56a43");
  R(c, 2, -26, 1, 3, "#3e8a3a");
  R(c, 4, -25, 1, 2, "#4fa14a");
}

function lockers(c: Ctx, H: number) {
  R(c, 11, 0, 2, H, "rgba(0,0,0,0.15)");
  R(c, 0, -9, 11, H + 9, "#f1f1ee");
  R(c, 0, -9, 11, 2, "#ffffff");
  R(c, 10, -9, 1, H + 9, "#cfcfca");
  for (let y = -7; y < H; y += 16) {
    R(c, 0, y, 11, 1, "#d2d2cd");
    R(c, 9, y + 6, 1, 3, "#8d939a");
    R(c, 3, y + 3, 3, 2, "#c9c9c4");
    R(c, 3, y + 10, 4, 1, "#e0e0dc");
    R(c, 3, y + 12, 4, 1, "#e0e0dc");
  }
}

function cabinet(c: Ctx, W: number, H: number, r: () => number) {
  R(c, 0, H - 1, W, 1, "rgba(0,0,0,0.2)");
  R(c, 0, -7, W, 5, "#ffffff");
  R(c, 0, -2, W, H + 1, "#efeeea");
  R(c, W - 1, -2, 1, H + 1, "#d6d5d0");
  for (let y = -2; y < H; y += 16) {
    R(c, Math.floor(W / 2), y, 1, Math.min(16, H - y), "#d6d5d0");
    R(c, Math.floor(W / 2) - 2, y + 6, 1, 3, "#9aa0a6");
    R(c, Math.floor(W / 2) + 2, y + 6, 1, 3, "#9aa0a6");
  }
  const k = Math.floor(r() * 3);
  if (k === 0) {
    R(c, 3, -11, 3, 4, "#c56a43");
    R(c, 3, -14, 1, 3, "#3e8a3a");
    R(c, 5, -13, 1, 2, "#4fa14a");
  } else if (k === 1) {
    R(c, 3, -10, 6, 2, "#2e86de");
    R(c, 3, -12, 5, 2, "#c0392b");
  } else {
    R(c, 4, -12, 3, 5, "#d6b45a");
    R(c, 3, -12, 5, 1, "#f1d98a");
  }
}

// ---------------------------------------------------------------- dynamiskt

const bengtCache = new Map<number, HTMLCanvasElement>();

export function bengtSprite(size: number): HTMLCanvasElement {
  const key = Math.round(Math.max(0, Math.min(8, size)) * 2) / 2;
  let cv = bengtCache.get(key);
  if (!cv) {
    const [c, x] = makeCanvas(16 + PX * 2, 16 + PT + 30);
    x.translate(PX, PT + 24);
    bigPlant(x, key, rng(42));
    cv = c;
    bengtCache.set(key, cv);
  }
  return cv;
}

/** Dynamiska detaljer ovanpå en möbel. wx/wy = världspixel för fotavtryckets övre vänstra hörn. */
export function drawFurnDyn(c: Ctx, d: FurnDrawable, t: number, world: WorldState | null) {
  const f = d.f;
  const wx = (f.x + M) * TILE;
  const wy = (f.y + M) * TILE;
  const seed = f.x * 13 + f.y * 7;
  switch (f.kind) {
    case "monitor": {
      const dir = f.dir ?? DOWN;
      if (dir === DOWN) {
        const sx = wx + 3;
        const sy = wy - 5;
        const mode = Math.floor(hash(seed, Math.floor(t / 9)) * 3);
        R(c, sx, sy, 10, 7, mode === 2 ? "#f4f4f6" : "#1d2a44");
        if (mode === 0) {
          for (let i = 0; i < 5; i++) {
            const w = 2 + Math.floor(hash(seed, i, Math.floor(t * 1.5)) * 6);
            R(c, sx + 1 + (i % 2), sy + 1 + i, w, 1, ["#7fd1a8", "#7fb7ff", "#ffd86b", "#ff8a8a", "#d0a8ff"][i]);
          }
        } else if (mode === 1) {
          R(c, sx + 1, sy + 1, 4, 3, "#ff5ec4");
          R(c, sx + 6, sy + 1, 3, 2, "#5b8cff");
          R(c, sx + 6, sy + 4, 3, 2, "#31c48d");
          R(c, sx + 1, sy + 5, 4, 1, "#ffd23f");
        } else {
          R(c, sx + 1, sy + 1, 8, 1, "#2d6cdf");
          R(c, sx + 1, sy + 3, 6, 1, "#c9ced6");
          R(c, sx + 1, sy + 5, 7, 1, "#c9ced6");
        }
        if ((t * 2 + seed) % 1 < 0.5) R(c, sx + 8, sy + 5, 1, 1, "#ffffff");
      } else if (dir === LEFT || dir === RIGHT) {
        const x = dir === LEFT ? wx + 5 : wx + 10;
        R(c, x, wy - 4, 1, 11, hash(seed, Math.floor(t * 2)) < 0.5 ? "#7fb3ff" : "#9fd0ff");
      }
      break;
    }
    case "coffee_machine": {
      const broken = !!world?.coffeeBroken;
      R(c, wx + 3, wy - 7, 1, 1, broken ? (Math.floor(t * 6) % 2 ? "#ff4d4d" : "#550000") : "#ff4d4d");
      if (broken) {
        for (let i = 0; i < 4; i++) {
          const p = (t * 0.7 + i / 4) % 1;
          const x = wx + 7 + Math.sin(p * 9 + i) * 3;
          const y = wy - 12 - p * 18;
          c.globalAlpha = 0.6 * (1 - p);
          ellipse(c, x, y, 2 + p * 3, 2 + p * 3, "#55585f");
          c.globalAlpha = 1;
        }
        if (Math.floor(t * 9) % 5 === 0) {
          R(c, wx + 12, wy - 9, 1, 1, "#ffe36e");
          R(c, wx + 14, wy - 11, 1, 1, "#fff");
          R(c, wx + 10, wy - 12, 1, 1, "#ffe36e");
        }
      } else {
        const p = (t * 0.5) % 1;
        c.globalAlpha = 0.5 * (1 - p);
        R(c, Math.round(wx + 7 + Math.sin(t * 3) * 1.5), Math.round(wy - 14 - p * 8), 1, 2, "#ffffff");
        R(c, Math.round(wx + 9 + Math.cos(t * 2.5) * 1.5), Math.round(wy - 15 - p * 7), 1, 2, "#ffffff");
        c.globalAlpha = 1;
      }
      break;
    }
    case "server_rack": {
      for (let y = -14; y < 12; y += 4)
        for (let k = 0; k < 3; k++) {
          const on = hash(seed + y, k, Math.floor(t * (3 + k))) < 0.6;
          if (on) R(c, wx + 10 + k, wy + y + 1, 1, 1, k === 0 ? "#3ddc84" : k === 1 ? "#ffb703" : "#4cc9f0");
        }
      break;
    }
    case "arcade": {
      const sx = wx + 4;
      const sy = wy - 13;
      R(c, sx, sy, 8, 7, "#0b1430");
      const ph = Math.floor(t * 4);
      for (let i = 0; i < 3; i++) {
        const ix = sx + ((i * 3 + ph) % 7);
        R(c, ix, sy + 1, 1, 1, ["#ff5ec4", "#3ddc84", "#ffd23f"][i]);
      }
      R(c, sx + 3 + Math.round(Math.sin(t * 2) * 2), sy + 5, 2, 1, "#4cc9f0");
      if (ph % 3 === 0) R(c, sx + 4, sy + 3, 1, 1, "#fff");
      break;
    }
    case "printer": {
      R(c, wx + 12, wy - 4, 1, 1, Math.floor(t * 1.5) % 2 ? "#3ddc84" : "#1f7a48");
      const p = (t * 0.25 + seed) % 1;
      if (p < 0.3) R(c, wx + 4, wy + 1 + Math.round(p * 6), 8, 2, "#ffffff");
      break;
    }
    case "water_cooler": {
      const p = (t * 0.3 + 0.5) % 1;
      if (p < 0.5) {
        const by = wy - 1 - Math.round(p * 14);
        R(c, wx + 7 + (Math.floor(p * 10) % 2), by, 1, 1, "#e2f4fd");
      }
      break;
    }
    case "kakelugn": {
      const night = world?.night ?? 0;
      if (night > 0.3) {
        c.globalAlpha = 0.5 + 0.3 * Math.sin(t * 7 + seed);
        R(c, wx + 6, wy - 1, 4, 3, "#ffb347");
        R(c, wx + 7, wy, 2, 2, "#ffe08a");
        c.globalAlpha = 1;
      }
      break;
    }
  }
}

export function drawWallDyn(c: Ctx, f: Furn, t: number, world: WorldState | null) {
  const wx = (f.x + M) * TILE;
  const wy = (f.y + M) * TILE;
  if (f.kind === "clock") {
    const clock = world?.clock ?? "12:00";
    const [hh, mm] = clock.split(":").map((v) => parseInt(v, 10) || 0);
    const cx = wx + 8;
    const cy = wy + 8;
    const ah = ((hh % 12) / 12 + mm / 720) * Math.PI * 2 - Math.PI / 2;
    const am = (mm / 60) * Math.PI * 2 - Math.PI / 2;
    for (let s = 0; s <= 2; s++) R(c, Math.round(cx + Math.cos(ah) * s), Math.round(cy + Math.sin(ah) * s), 1, 1, "#1d1d22");
    for (let s = 0; s <= 3; s++) R(c, Math.round(cx + Math.cos(am) * s), Math.round(cy + Math.sin(am) * s), 1, 1, "#555a62");
    const as = (t % 60) / 60 * Math.PI * 2 - Math.PI / 2;
    R(c, Math.round(cx + Math.cos(as) * 3), Math.round(cy + Math.sin(as) * 3), 1, 1, "#d63c3c");
  } else if (f.kind === "neon_sign") {
    const flick = hash(Math.floor(t * 12), 3) < 0.04 ? 0.25 : 1;
    const night = world?.night ?? 0;
    const glow = 0.35 + night * 0.5;
    c.save();
    c.globalAlpha = glow * flick * 0.5;
    c.fillStyle = "#ff5ec4";
    c.fillRect(wx, wy + 3, f.w * TILE, 11);
    c.globalAlpha = flick;
    neonText(c, wx + 4, wy + 6, "#ff9be0", "#ff5ec4");
    c.restore();
  } else if (f.kind === "tv") {
    const sx = wx + 3;
    const sy = wy + 4;
    const sw = f.w * TILE - 6;
    R(c, sx, sy, sw, 8, "#101828");
    const mode = Math.floor(t / 12 + f.x) % 3;
    if (mode === 0) {
      // studsande logga (skärmsläckare)
      const px = Math.abs(((t * 6) % ((sw - 6) * 2)) - (sw - 6));
      const py = Math.abs(((t * 3.3) % 8) - 4);
      const col = ["#ff5ec4", "#5b8cff", "#31c48d", "#ffd23f"][Math.floor(t / 2) % 4];
      R(c, Math.round(sx + px), Math.round(sy + 1 + py), 6, 2, col);
    } else if (mode === 1) {
      R(c, sx, sy, sw, 8, "#f6f2ea");
      for (let i = 0; i < 3; i++) R(c, sx + 2, sy + 2 + i * 2, Math.round((sw - 4) * (0.4 + 0.2 * i)), 1, ["#ff5ec4", "#5b8cff", "#31c48d"][i]);
    } else {
      R(c, sx, sy, sw, 8, "#1f3b2c");
      for (let i = 0; i < sw; i += 3) R(c, sx + i, sy + 7 - Math.round(3 + Math.sin(i * 0.7 + t * 2) * 3), 2, 1, "#3ddc84");
    }
  }
}

function neonText(c: Ctx, x: number, y: number, core: string, edge: string) {
  // "Variant" i pixelskrivstil, 5 px hög
  const glyphs: string[][] = [
    ["10001", "10001", "01010", "01010", "00100"], // V
    ["0000", "0110", "1001", "1011", "0101"], // a
    ["000", "101", "110", "100", "100"], // r
    ["1", "0", "1", "1", "1"], // i
    ["0000", "0110", "1001", "1011", "0101"], // a
    ["0000", "1110", "1001", "1001", "1001"], // n
    ["010", "111", "010", "010", "011"], // t
  ];
  let cx = x;
  for (const g of glyphs) {
    for (let j = 0; j < 5; j++)
      for (let i = 0; i < g[j].length; i++)
        if (g[j][i] === "1") {
          R(c, cx + i, y + j, 1, 1, core);
        }
    cx += g[0].length + 1;
  }
  void edge;
}

// ---------------------------------------------------------------- taklampor

const lampCache = new Map<string, HTMLCanvasElement>();

export function overheadSprite(f: Furn): HTMLCanvasElement {
  let cv = lampCache.get(f.kind);
  if (cv) return cv;
  const [c, x] = makeCanvas(32, 64);
  if (f.kind === "lamp_maskros") {
    R(x, 16, 26, 1, 10, "#cfccc4");
    const cx = 16;
    const cy = 44;
    for (let i = 0; i < 70; i++) {
      const a = (i / 70) * Math.PI * 2 + (i % 3) * 0.1;
      const rr = 8 + (i % 4) * 1.2;
      const px = Math.round(cx + Math.cos(a) * rr);
      const py = Math.round(cy + Math.sin(a) * rr * 0.9);
      R(x, px, py, 1, 1, py > cy + 3 ? "#d6d2c8" : "#fbfaf6");
      R(x, Math.round(cx + Math.cos(a) * rr * 0.6), Math.round(cy + Math.sin(a) * rr * 0.55), 1, 1, "#eeebe3");
    }
    ellipse(x, cx, cy, 4, 4, "#e6e2d8");
    ellipse(x, cx - 1, cy - 1, 2, 2, "#fffdf6");
  } else {
    R(x, 16, 36, 1, 7, "#3a3a3e");
    ellipse(x, 16, 45, 5, 3, "#f5f4f0");
    R(x, 11, 45, 11, 2, "#f5f4f0");
    R(x, 11, 47, 11, 1, "#cfccc4");
    R(x, 14, 48, 5, 1, "#fff3c4");
    R(x, 13, 43, 2, 1, "#ffffff");
  }
  lampCache.set(f.kind, c);
  return c;
}
