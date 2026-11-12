// Procedurella chibi-figurer (16×24 i en 20×28-buffert), NPC:er och hållna föremål.
import type { Look } from "../../shared/consultants.ts";
import type { Anim, CharSnap, Item, NpcSnap } from "../../shared/protocol.ts";
import { ellipse, hash, makeCanvas, mix, PixBuf, R, shade, strHash } from "./pixel.ts";

export const BW = 20;
export const BH = 28;
export const FOOT_X = 10;
export const FOOT_Y = 25;

type Dir4 = 0 | 1 | 2 | 3;
type Body = "stand" | "sit" | "crouch";
type Legs = "stand" | "w1" | "w3" | "sit" | "yoga" | "together";
type Arms =
  | "down"
  | "swing1"
  | "swing2"
  | "up"
  | "upL"
  | "upR"
  | "wave1"
  | "wave2"
  | "forward"
  | "type1"
  | "type2"
  | "hold"
  | "mouth"
  | "ear"
  | "chin"
  | "hips"
  | "flex"
  | "point"
  | "face"
  | "yoga"
  | "juggle1"
  | "juggle2"
  | "draw1"
  | "draw2"
  | "game"
  | "read";
type Mouth = "closed" | "open" | "smile";
type Eyes = "open" | "closed" | "wide" | "happy";

export interface FigureOpts {
  dir: Dir4;
  body: Body;
  legs: Legs;
  arms: Arms;
  mouth: Mouth;
  eyes: Eyes;
  vr: boolean;
  lie?: boolean; // liggande (filt + kudde)
}

export interface Figure {
  img: HTMLCanvasElement;
  hand: [number, number]; // buffertkoordinater för föremålshanden
  head: number; // y för huvudets topp (buffert)
}

const EYE = "#2a2023";
const OUTLINE = "#2a2230";

// --------------------------------------------------------------- målare

type Seg = [kind: "u" | "f" | "h", x: number, y: number, w: number, h: number];

function armSegs(arms: Arms, side: boolean): { L: Seg[]; R: Seg[]; hand: [number, number] } {
  if (side) {
    // höger-vänd profil: bara främre armen syns tydligt
    const A = (s: Seg[], hand: [number, number]) => ({ L: [] as Seg[], R: s, hand });
    switch (arms) {
      case "swing1":
        return A([["u", 8, 11, 2, 2], ["f", 9, 13, 2, 2], ["h", 10, 15, 2, 1]], [11, 15]);
      case "swing2":
        return A([["u", 6, 11, 2, 2], ["f", 5, 13, 2, 2], ["h", 4, 15, 2, 1]], [4, 15]);
      case "up":
      case "upL":
      case "upR":
      case "yoga":
      case "wave1":
        return A([["u", 7, 8, 2, 3], ["f", 8, 4, 2, 4], ["h", 8, 2, 2, 2]], [9, 2]);
      case "wave2":
      case "draw2":
        return A([["u", 7, 8, 2, 3], ["f", 9, 4, 2, 4], ["h", 10, 2, 2, 2]], [11, 2]);
      case "draw1":
        return A([["u", 7, 8, 2, 3], ["f", 9, 5, 2, 3], ["h", 10, 4, 2, 2]], [11, 4]);
      case "forward":
      case "type1":
      case "type2":
      case "hold":
      case "game":
      case "read":
      case "juggle1":
      case "juggle2": {
        const dy = arms === "type2" ? -1 : 0;
        return A([["u", 7, 11, 2, 2], ["f", 9, 13 + dy, 3, 1], ["h", 12, 13 + dy, 2, 1]], [13, 13]);
      }
      case "mouth":
        return A([["u", 7, 11, 2, 2], ["f", 9, 10, 2, 2], ["h", 11, 9, 2, 2]], [12, 9]);
      case "ear":
        return A([["u", 7, 9, 2, 3], ["f", 8, 7, 2, 2], ["h", 8, 5, 2, 2]], [9, 6]);
      case "chin":
      case "face":
        return A([["u", 7, 11, 2, 2], ["f", 9, 11, 2, 1], ["h", 10, 10, 2, 1]], [11, 10]);
      case "point":
        return A([["u", 8, 11, 2, 2], ["f", 10, 11, 3, 2], ["h", 13, 11, 2, 2]], [14, 11]);
      case "hips":
        return A([["u", 7, 11, 2, 2], ["f", 6, 13, 2, 1], ["h", 7, 14, 2, 1]], [7, 14]);
      case "flex":
        return A([["u", 8, 10, 3, 2], ["f", 10, 7, 2, 3], ["h", 10, 6, 2, 1]], [11, 6]);
      default:
        return A([["u", 7, 11, 2, 2], ["f", 7, 13, 2, 3], ["h", 7, 16, 2, 1]], [8, 16]);
    }
  }
  const mirror = (s: Seg[]): Seg[] => s.map(([k, x, y, w, h]) => [k, 15 - x - w + 1, y, w, h] as Seg);
  const down: Seg[] = [["u", 3, 11, 2, 2], ["f", 3, 13, 2, 3], ["h", 3, 16, 2, 1]];
  const up: Seg[] = [["u", 3, 9, 2, 3], ["f", 2, 5, 2, 4], ["h", 2, 3, 2, 2]];
  switch (arms) {
    case "swing1":
      return { L: [["u", 3, 11, 2, 2], ["f", 3, 13, 2, 4], ["h", 3, 17, 2, 1]], R: mirror([["u", 3, 11, 2, 2], ["f", 3, 13, 2, 2], ["h", 3, 15, 2, 1]]), hand: [12, 15] };
    case "swing2":
      return { L: [["u", 3, 11, 2, 2], ["f", 3, 13, 2, 2], ["h", 3, 15, 2, 1]], R: mirror([["u", 3, 11, 2, 2], ["f", 3, 13, 2, 4], ["h", 3, 17, 2, 1]]), hand: [12, 17] };
    case "up":
      return { L: up, R: mirror(up), hand: [13, 3] };
    case "upL":
      return { L: up, R: mirror(down), hand: [12, 16] };
    case "upR":
      return { L: down, R: mirror(up), hand: [13, 3] };
    case "wave1":
      return { L: down, R: [["u", 11, 9, 2, 3], ["f", 12, 5, 2, 4], ["h", 12, 3, 2, 2]], hand: [13, 3] };
    case "wave2":
      return { L: down, R: [["u", 11, 9, 2, 3], ["f", 13, 5, 2, 4], ["h", 14, 3, 2, 2]], hand: [14, 3] };
    case "forward":
    case "hold":
      return {
        L: [["u", 4, 11, 2, 2], ["f", 5, 13, 2, 1], ["h", 5, 14, 2, 1]],
        R: [["u", 10, 11, 2, 2], ["f", 9, 13, 2, 1], ["h", 9, 14, 2, 1]],
        hand: [8, 14],
      };
    case "type1":
    case "type2": {
      const dy = arms === "type2" ? -1 : 0;
      const dx = arms === "type2" ? 1 : 0;
      return {
        L: [["u", 4, 11, 2, 2], ["f", 5, 13, 2, 1], ["h", 5 + dx, 14 + dy, 2, 1]],
        R: [["u", 10, 11, 2, 2], ["f", 9, 13, 2, 1], ["h", 9 - dx, 14 + (arms === "type1" ? -1 : 0), 2, 1]],
        hand: [8, 14],
      };
    }
    case "game":
      return { L: [["u", 4, 11, 2, 2], ["h", 6, 13, 2, 1]], R: [["u", 10, 11, 2, 2], ["h", 8, 13, 2, 1]], hand: [8, 13] };
    case "read":
      return { L: [["u", 4, 11, 2, 2], ["h", 4, 13, 2, 1]], R: [["u", 10, 11, 2, 2], ["h", 10, 13, 2, 1]], hand: [8, 13] };
    case "mouth":
      return { L: down, R: [["u", 11, 11, 2, 2], ["f", 10, 10, 2, 1], ["h", 8, 9, 2, 2]], hand: [9, 10] };
    case "ear":
      return { L: down, R: [["u", 11, 10, 2, 2], ["f", 12, 7, 2, 3], ["h", 12, 5, 2, 2]], hand: [13, 6] };
    case "chin":
      return { L: down, R: [["u", 11, 11, 2, 2], ["f", 10, 11, 2, 1], ["h", 8, 10, 2, 1]], hand: [9, 10] };
    case "hips":
      return {
        L: [["u", 2, 11, 2, 2], ["f", 2, 13, 2, 1], ["h", 3, 14, 2, 1]],
        R: [["u", 12, 11, 2, 2], ["f", 12, 13, 2, 1], ["h", 11, 14, 2, 1]],
        hand: [12, 14],
      };
    case "flex":
      return {
        L: [["u", 1, 10, 3, 2], ["f", 1, 7, 2, 3], ["h", 1, 6, 2, 1]],
        R: [["u", 12, 10, 3, 2], ["f", 13, 7, 2, 3], ["h", 13, 6, 2, 1]],
        hand: [14, 6],
      };
    case "point":
      return { L: down, R: [["u", 12, 11, 2, 2], ["f", 13, 11, 2, 2], ["h", 15, 11, 1, 2]], hand: [15, 12] };
    case "face":
      return {
        L: [["u", 3, 11, 2, 1], ["f", 4, 9, 2, 2], ["h", 5, 7, 2, 2]],
        R: [["u", 11, 11, 2, 1], ["f", 10, 9, 2, 2], ["h", 9, 7, 2, 2]],
        hand: [10, 8],
      };
    case "yoga":
      return {
        L: [["u", 3, 8, 2, 3], ["f", 4, 4, 2, 4], ["h", 6, 2, 2, 2]],
        R: [["u", 11, 8, 2, 3], ["f", 10, 4, 2, 4], ["h", 8, 2, 2, 2]],
        hand: [8, 2],
      };
    case "juggle1":
      return { L: [["u", 3, 11, 2, 2], ["h", 2, 12, 2, 1]], R: [["u", 11, 11, 2, 2], ["f", 12, 13, 2, 1], ["h", 13, 13, 2, 1]], hand: [14, 13] };
    case "juggle2":
      return { L: [["u", 3, 11, 2, 2], ["f", 2, 13, 2, 1], ["h", 2, 13, 2, 1]], R: [["u", 11, 11, 2, 2], ["h", 13, 12, 2, 1]], hand: [14, 12] };
    case "draw1":
      return { L: down, R: [["u", 11, 9, 2, 3], ["f", 12, 5, 2, 4], ["h", 12, 4, 2, 2]], hand: [13, 4] };
    case "draw2":
      return { L: down, R: [["u", 11, 9, 2, 3], ["f", 11, 5, 2, 4], ["h", 10, 4, 2, 2]], hand: [11, 4] };
    default:
      return { L: down, R: mirror(down), hand: [12, 16] };
  }
}

const LONG_SLEEVE = new Set(["shirt", "blazer", "sweater", "blouse", "jacket"]);

export function paintFigure(look: Look, o: FigureOpts): { buf: PixBuf; hand: [number, number]; head: number } {
  const b = new PixBuf(BW, BH);
  const side = o.dir === 2 || o.dir === 3;
  const back = o.dir === 1;
  const dy = o.body === "sit" ? 3 : o.body === "crouch" ? 2 : 0;
  const P = (x: number, y: number, c: string) => b.set(x + 2, y + 2 + dy, c);
  const PL = (x: number, y: number, c: string) => b.set(x + 2, y + 2, c); // ben (utan förskjutning)
  const rect = (x: number, y: number, w: number, h: number, c: string) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) P(x + i, y + j, c);
  };
  const rectL = (x: number, y: number, w: number, h: number, c: string) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) PL(x + i, y + j, c);
  };

  const skin = look.skin;
  const skinDk = shade(skin, -0.14);
  const hair = look.hair;
  const hairDk = shade(hair, -0.28);
  const hairHi = shade(hair, 0.28);
  const top = look.top;
  const topDk = shade(top, -0.22);
  const topHi = shade(top, 0.18);
  const pants = look.pants;
  const pantsDk = shade(pants, -0.3);
  const shoes = look.shoes;
  const shoesHi = shade(shoes, 0.35);
  const blush = mix(skin, "#e46c7a", 0.32);
  const mouthC = look.lips ?? shade(skin, -0.42);
  const longSleeve = LONG_SLEEVE.has(look.topStyle);

  // kudde bakom huvudet när man ligger
  if (o.lie) {
    rect(1, 0, 14, 7, "#f4f1ea");
    rect(1, 6, 14, 1, "#d8d2c6");
  }

  // ---- ben
  if (o.body === "sit") {
    if (o.dir === 0) {
      rectL(4, 19, 8, 3, pants);
      rectL(7, 19, 2, 3, pantsDk);
      rectL(4, 22, 3, 1, shoes);
      rectL(9, 22, 3, 1, shoes);
      rectL(4, 23, 3, 1, shoesHi);
      rectL(9, 23, 3, 1, shoesHi);
    } else if (o.dir === 1) {
      rectL(4, 20, 8, 2, pants);
    } else {
      rectL(6, 18, 6, 3, pants);
      rectL(11, 20, 2, 2, pants);
      rectL(11, 22, 3, 1, shoes);
      rectL(12, 22, 1, 1, shoesHi);
    }
  } else if (o.body === "crouch") {
    if (side) {
      rectL(5, 19, 6, 2, pants);
      rectL(9, 21, 2, 1, pants);
      rectL(9, 22, 3, 1, shoes);
      rectL(4, 21, 2, 1, pantsDk);
      rectL(3, 22, 3, 1, shoes);
    } else {
      rectL(4, 19, 3, 2, pants);
      rectL(9, 19, 3, 2, pants);
      rectL(4, 21, 3, 1, pants);
      rectL(9, 21, 3, 1, pants);
      rectL(4, 22, 3, 1, shoes);
      rectL(9, 22, 3, 1, shoes);
    }
  } else if (side) {
    if (o.legs === "w1" || o.legs === "w3") {
      const fc = o.legs === "w1" ? pants : pantsDk;
      const bc = o.legs === "w1" ? pantsDk : pants;
      rectL(4, 17, 3, 3, bc);
      rectL(3, 20, 3, 1, bc);
      rectL(2, 21, 3, 1, shoes);
      rectL(8, 17, 3, 3, fc);
      rectL(9, 20, 3, 1, fc);
      rectL(10, 21, 3, 1, shoes);
      rectL(12, 21, 1, 1, shoesHi);
    } else {
      rectL(6, 17, 4, 4, pants);
      rectL(7, 17, 1, 4, pantsDk);
      rectL(6, 21, 5, 1, shoes);
      rectL(10, 21, 1, 1, shoesHi);
      rectL(6, 22, 5, 1, shoes);
    }
  } else {
    const L = (len: number) => {
      rectL(5, 17, 3, len, pants);
      rectL(7, 17, 1, len, pantsDk);
      rectL(5, 17 + len, 3, 1, shoes);
      rectL(5, 18 + len, 3, 1, back ? shoes : shoesHi);
    };
    const Rr = (len: number) => {
      rectL(8, 17, 3, len, pants);
      rectL(8, 17, 1, len, pantsDk);
      rectL(8, 17 + len, 3, 1, shoes);
      rectL(8, 18 + len, 3, 1, back ? shoes : shoesHi);
    };
    if (o.legs === "w1") {
      L(5);
      Rr(3);
    } else if (o.legs === "w3") {
      L(3);
      Rr(5);
    } else if (o.legs === "yoga") {
      L(4);
      rectL(9, 17, 3, 2, pants);
      rectL(8, 19, 2, 1, pants);
      rectL(8, 20, 2, 1, shoes);
    } else {
      L(4);
      Rr(4);
    }
  }

  // ---- bål
  const segs = armSegs(o.arms, side);
  const sleeve = top;
  const armColor = (k: Seg[0]) => (k === "h" ? skin : k === "u" ? sleeve : longSleeve ? sleeve : skin);
  const paintArm = (s: Seg[], shadeIt: boolean) => {
    for (const [k, x, y, w, h] of s) {
      const c = armColor(k);
      rect(x, y, w, h, c);
      if (shadeIt && k !== "h" && w >= 2) rect(x + w - 1, y, 1, h, shade(c, -0.15));
    }
  };

  if (side) {
    // bakre arm (skymd, mörkare)
    if (o.arms === "swing1" || o.arms === "swing2") {
      const bx = o.arms === "swing1" ? 5 : 8;
      rect(bx, 12, 2, 4, shade(top, -0.3));
    }
    rect(5, 11, 6, 6, top);
    rect(5, 11, 6, 1, topHi);
    rect(10, 11, 1, 6, topDk);
    if (look.topStyle === "blazer" || look.topStyle === "jacket") {
      const inner = look.inner ?? "#f2efe9";
      for (let y = 11; y < 16; y++) P(10, y, inner === "zebra" ? ((y & 1) ? "#111" : "#f2f2f2") : inner);
      P(9, 11, topDk);
    } else if (look.topStyle === "shirt") {
      P(9, 11, topHi);
      P(10, 11, topHi);
    } else if (look.topStyle === "tshirt") {
      P(9, 11, skin);
    }
    rect(5, 16, 6, 1, shade(pants, -0.2));
  } else {
    rect(4, 11, 8, 6, top);
    rect(4, 11, 8, 1, topHi);
    P(4, 11, top);
    P(11, 11, top);
    rect(4, 16, 8, 1, shade(pants, -0.15));
    if (!back) {
      switch (look.topStyle) {
        case "tshirt":
          P(7, 11, skin);
          P(8, 11, skin);
          break;
        case "shirt":
          P(6, 11, topHi);
          P(9, 11, topHi);
          P(7, 11, skin);
          P(8, 11, skin);
          for (let y = 12; y < 16; y += 2) P(8, y, topDk);
          break;
        case "blouse":
          P(7, 11, skin);
          P(8, 11, skin);
          P(7, 12, look.inner ?? skin);
          P(8, 12, look.inner ?? skin);
          if (look.inner) {
            P(7, 13, look.inner);
            P(8, 13, look.inner);
          }
          break;
        case "sweater":
          rect(6, 11, 4, 1, topDk);
          rect(4, 15, 8, 1, topDk);
          break;
        case "blazer":
        case "jacket": {
          const inner = look.inner ?? (look.topStyle === "jacket" ? "#2a2a2e" : "#f2efe9");
          for (let y = 11; y < 16; y++)
            for (let x = 6; x < 10; x++) {
              const c = inner === "zebra" ? ((x + y * 2) % 3 === 0 ? "#151515" : "#f2f2f2") : inner;
              P(x, y, c);
            }
          P(5, 11, topDk);
          P(5, 12, topDk);
          P(10, 11, topDk);
          P(10, 12, topDk);
          if (look.topStyle === "jacket") rect(7, 12, 2, 4, shade(inner === "zebra" ? "#888888" : inner, 0.3));
          break;
        }
      }
    } else {
      rect(7, 12, 2, 4, shade(top, -0.06));
    }
  }

  const armsRaised = ["up", "upL", "upR", "wave1", "wave2", "flex", "yoga", "face", "ear", "draw1", "draw2", "mouth", "chin"].includes(o.arms);
  if (!armsRaised) {
    paintArm(segs.L, true);
    paintArm(segs.R, true);
  }

  // ---- huvud
  const headRows: [number, number, number][] = side
    ? [[1, 6, 10], [2, 5, 11], [3, 4, 12], [4, 4, 12], [5, 4, 12], [6, 4, 12], [7, 4, 12], [8, 4, 12], [9, 4, 12], [10, 5, 11]]
    : [[1, 5, 10], [2, 4, 11], [3, 3, 12], [4, 3, 12], [5, 3, 12], [6, 3, 12], [7, 3, 12], [8, 3, 12], [9, 3, 12], [10, 4, 11]];
  for (const [y, x0, x1] of headRows) for (let x = x0; x <= x1; x++) P(x, y, skin);
  if (side) {
    P(13, 7, skin);
    for (let y = 3; y <= 9; y++) P(4, y, skinDk);
  } else if (!back) {
    P(3, 9, skinDk);
    P(12, 9, skinDk);
  }

  const style = look.hairStyle;
  const H = (x: number, y: number) => P(x, y, hair);
  const HD = (x: number, y: number) => P(x, y, hairDk);
  const HH = (x: number, y: number) => P(x, y, hairHi);
  const rowH = (y: number, x0: number, x1: number, c = hair) => {
    for (let x = x0; x <= x1; x++) P(x, y, c);
  };

  if (style === "bald") {
    if (side) {
      P(7, 2, shade(skin, 0.18));
    } else {
      P(6, 2, shade(skin, 0.2));
      P(7, 2, shade(skin, 0.12));
    }
  } else if (style === "buzz") {
    const dith = mix(hair, skin, 0.45);
    for (const [y, x0, x1] of headRows) {
      if (y > (back ? 9 : 3)) continue;
      for (let x = x0; x <= x1; x++) P(x, y, (x + y) % 2 ? hair : dith);
    }
    if (side) for (let y = 4; y <= 8; y++) P(5, y, (y % 2) ? hair : dith);
    else if (!back) {
      P(3, 4, hair);
      P(12, 4, hair);
    }
  } else if (style === "curly") {
    const region: [number, number, number][] = side
      ? [[0, 5, 10], [1, 3, 12], [2, 2, 12], [3, 2, 12], [4, 2, 9], [5, 2, 8], [6, 2, 8], [7, 2, 8], [8, 2, 8], [9, 2, 8], [10, 2, 8], [11, 2, 7], [12, 3, 6]]
      : back
        ? [[0, 4, 11], [1, 2, 13], [2, 1, 14], [3, 1, 14], [4, 1, 14], [5, 1, 14], [6, 1, 14], [7, 1, 14], [8, 1, 14], [9, 1, 14], [10, 1, 14], [11, 2, 13], [12, 3, 12]]
        : [[0, 4, 11], [1, 2, 13], [2, 1, 14], [3, 1, 14], [4, 1, 14], [5, 1, 3], [6, 1, 3], [7, 1, 3], [8, 1, 3], [9, 1, 3], [10, 1, 3], [11, 1, 4], [12, 2, 4]];
    for (const [y, x0, x1] of region)
      for (let x = x0; x <= x1; x++) {
        const v = hash(x, y, 31);
        P(x, y, v < 0.28 ? hairDk : v > 0.86 ? hairHi : hair);
      }
    if (!side && !back) {
      for (const [y, x0, x1] of region.map(([y]) => [y, 12, 14] as [number, number, number]))
        if (y >= 5 && y <= 12) for (let x = x0; x <= x1; x++) P(x, y, hash(x, y, 31) < 0.28 ? hairDk : hair);
      for (let x = 4; x <= 11; x += 2) P(x, 4, hairDk);
      P(5, 5, hair);
      P(10, 5, hair);
    }
    if (side) {
      for (let x = 9; x <= 12; x += 2) P(x, 4, hairDk);
    }
  } else {
    // gemensam topp
    if (side) {
      rowH(1, 6, 10);
      rowH(2, 5, 11);
      rowH(3, 4, 12);
      HH(8, 2);
      HH(9, 2);
    } else {
      rowH(1, 5, 10);
      rowH(2, 4, 11);
      rowH(3, 3, 12);
      HH(6, 2);
      HH(7, 2);
      HD(3, 3);
      HD(12, 3);
    }
    if (back) {
      // bakhuvud
      for (let y = 4; y <= 9; y++) rowH(y, 3, 12);
      if (style === "short" || style === "side" || style === "pixie") {
        rowH(10, 5, 10, hairDk);
        P(3, 6, skin);
        P(12, 6, skin);
      } else {
        rowH(10, 4, 11);
      }
      if (style === "bob") {
        for (let y = 4; y <= 10; y++) {
          H(2, y);
          H(13, y);
        }
        rowH(10, 2, 13, hairDk);
      } else if (style === "shoulder" || style === "wavy") {
        for (let y = 4; y <= 13; y++) {
          rowH(y, 2, 13);
          if (style === "wavy" && y % 3 === 0) {
            H(1, y);
            H(14, y);
          }
        }
        rowH(13, 3, 12, hairDk);
        for (let y = 5; y < 13; y += 3) HD(7, y);
      } else if (style === "long") {
        for (let y = 4; y <= 16; y++) rowH(y, y > 13 ? 4 : 3, y > 13 ? 11 : 12);
        rowH(16, 5, 10, hairDk);
        for (let y = 5; y < 16; y += 3) HD(7, y);
        for (let y = 6; y < 16; y += 4) HH(5, y);
      }
    } else if (side) {
      const backHair = (y0: number, y1: number, x0: number, x1: number) => {
        for (let y = y0; y <= y1; y++) rowH(y, x0, x1);
      };
      switch (style) {
        case "short":
          backHair(4, 8, 4, 6);
          rowH(4, 8, 10);
          break;
        case "side":
          backHair(4, 8, 4, 6);
          rowH(4, 7, 12);
          H(12, 5);
          break;
        case "pixie":
          backHair(4, 9, 4, 6);
          rowH(4, 7, 12);
          H(11, 5);
          H(12, 5);
          break;
        case "bob":
          P(6, 0, hair);
          rowH(0, 6, 10);
          backHair(4, 10, 3, 7);
          rowH(4, 8, 12);
          rowH(10, 3, 7, hairDk);
          break;
        case "shoulder":
        case "wavy":
          backHair(4, 13, 3, 7);
          rowH(4, 8, 11);
          if (style === "wavy") for (let y = 5; y <= 13; y += 3) H(2, y);
          rowH(13, 3, 7, hairDk);
          break;
        case "long":
          backHair(4, 12, 3, 7);
          backHair(13, 16, 4, 6);
          rowH(4, 8, 11);
          rowH(16, 4, 6, hairDk);
          break;
      }
      if (style === "short" || style === "side" || style === "pixie") {
        P(7, 6, skin);
        P(7, 7, skinDk);
      }
    } else {
      // framifrån
      switch (style) {
        case "short":
          for (const x of [3, 4, 5, 7, 8, 10, 11, 12]) H(x, 4);
          H(3, 5);
          H(3, 6);
          H(12, 5);
          H(12, 6);
          break;
        case "side":
          rowH(4, 3, 9);
          HH(5, 3);
          H(3, 5);
          H(4, 5);
          H(5, 5);
          H(12, 4);
          H(12, 5);
          break;
        case "pixie":
          rowH(4, 3, 12);
          for (const x of [3, 4, 5, 6, 10, 11, 12]) H(x, 5);
          H(3, 6);
          H(3, 7);
          H(12, 6);
          H(12, 7);
          HD(8, 4);
          break;
        case "bob":
          rowH(0, 5, 10);
          rowH(4, 3, 12);
          HD(6, 4);
          HD(9, 4);
          for (let y = 4; y <= 10; y++) {
            H(2, y);
            H(3, y);
            H(12, y);
            H(13, y);
          }
          for (let y = 5; y <= 10; y++) {
            HD(2, y);
            HD(13, y);
          }
          rowH(10, 2, 4, hairDk);
          rowH(10, 11, 13, hairDk);
          break;
        case "shoulder":
        case "wavy":
          rowH(0, 6, 9);
          rowH(4, 3, 5);
          rowH(4, 10, 12);
          H(3, 5);
          H(12, 5);
          for (let y = 4; y <= 13; y++) {
            H(2, y);
            H(3, y);
            H(12, y);
            H(13, y);
            if (style === "wavy" && y % 3 === 1) {
              H(1, y);
              H(14, y);
            }
          }
          for (let y = 6; y <= 13; y += 3) {
            HD(2, y);
            HD(13, y);
          }
          rowH(13, 2, 3, hairDk);
          rowH(13, 12, 13, hairDk);
          break;
        case "long":
          rowH(0, 6, 9);
          rowH(4, 3, 5);
          rowH(4, 10, 12);
          H(3, 5);
          H(12, 5);
          for (let y = 4; y <= 15; y++) {
            H(2, y);
            H(3, y);
            H(12, y);
            H(13, y);
          }
          for (let y = 6; y <= 15; y += 3) {
            HD(2, y);
            HD(13, y);
            HH(3, y + 1);
          }
          rowH(16, 3, 3, hairDk);
          rowH(16, 12, 12, hairDk);
          break;
      }
    }
  }

  // ---- ansikte
  if (!back) {
    if (side) {
      const ex = 10;
      if (o.eyes === "closed") {
        P(ex, 7, EYE);
        P(ex + 1, 7, EYE);
      } else if (o.eyes === "wide") {
        P(ex, 6, "#ffffff");
        P(ex + 1, 6, "#ffffff");
        P(ex, 7, "#ffffff");
        P(ex + 1, 7, EYE);
      } else if (o.eyes === "happy") {
        P(ex, 7, EYE);
        P(ex + 1, 6, EYE);
      } else {
        P(ex, 6, EYE);
        P(ex, 7, EYE);
      }
      P(10, 8, blush);
      if (o.mouth === "open") {
        P(11, 9, "#6b2b2b");
        P(12, 9, "#6b2b2b");
        P(11, 10, "#6b2b2b");
      } else if (o.mouth === "smile") {
        P(11, 9, mouthC);
        P(12, 8, mouthC);
      } else P(11, 9, mouthC);
    } else {
      if (o.eyes === "closed") {
        for (const x of [5, 6, 9, 10]) P(x, 7, EYE);
      } else if (o.eyes === "wide") {
        for (const [x, y] of [[5, 6], [6, 6], [5, 7], [9, 6], [10, 6], [10, 7]]) P(x, y, "#ffffff");
        P(6, 7, EYE);
        P(9, 7, EYE);
      } else if (o.eyes === "happy") {
        P(5, 7, EYE);
        P(6, 6, EYE);
        P(7, 7, EYE);
        P(8, 7, EYE);
        P(9, 6, EYE);
        P(10, 7, EYE);
      } else {
        P(6, 6, EYE);
        P(6, 7, EYE);
        P(9, 6, EYE);
        P(9, 7, EYE);
      }
      P(5, 8, blush);
      P(10, 8, blush);
    }
  }

  // skägg
  if (look.beard && !back) {
    const bc = look.beardColor ?? hairDk;
    if (side) {
      if (look.beard === "stubble") {
        for (const [x, y] of [[8, 8], [9, 9], [11, 10], [10, 10], [12, 9]]) P(x, y, mix(skin, bc, 0.5));
      } else {
        for (const [x, y] of [[8, 8], [8, 9], [9, 9], [9, 10], [10, 10], [11, 10], [12, 10], [12, 9]]) P(x, y, bc);
        if (look.beard === "full") {
          P(11, 8, bc);
          P(12, 8, bc);
          P(10, 11, bc);
          P(11, 11, bc);
        }
      }
    } else if (look.beard === "stubble") {
      for (const [x, y] of [[4, 8], [11, 8], [5, 9], [10, 9], [6, 10], [8, 10], [10, 10], [5, 10], [9, 10]]) P(x, y, mix(skin, bc, 0.45));
    } else {
      for (const [x, y] of [[4, 8], [11, 8], [4, 9], [5, 9], [6, 9], [9, 9], [10, 9], [11, 9]]) P(x, y, bc);
      for (let x = 5; x <= 10; x++) P(x, 10, bc);
      P(4, 7, bc);
      P(11, 7, bc);
      if (look.beard === "full") {
        for (let x = 6; x <= 9; x++) P(x, 8, bc);
        for (let x = 6; x <= 9; x++) P(x, 11, bc);
      }
    }
  }
  // mun (över skägget)
  if (!back && !side) {
    if (o.mouth === "open") {
      P(7, 9, "#6b2b2b");
      P(8, 9, "#6b2b2b");
      P(7, 10, "#8f3a3a");
      P(8, 10, "#8f3a3a");
    } else if (o.mouth === "smile") {
      P(6, 9, mouthC);
      P(7, 10, mouthC);
      P(8, 10, mouthC);
      P(9, 9, mouthC);
    } else {
      P(7, 9, mouthC);
      P(8, 9, mouthC);
    }
  }

  // glasögon
  if (look.glasses) {
    const g = look.glasses;
    const round = look.glassesStyle === "round";
    if (side) {
      for (const [x, y] of [[9, 5], [10, 5], [11, 5], [9, 8], [10, 8], [11, 8], [9, 6], [9, 7], [11, 6], [11, 7]]) {
        if (round && (x === 9 || x === 11) && (y === 5 || y === 8)) continue;
        P(x, y, g);
      }
      P(7, 6, g);
      P(8, 6, g);
    } else if (back) {
      P(3, 6, g);
      P(12, 6, g);
    } else {
      for (const lx of [5, 8]) {
        for (let x = lx; x <= lx + 2; x++) {
          if (!(round && (x === lx || x === lx + 2))) {
            P(x, 5, g);
            P(x, 8, g);
          }
        }
        P(lx, 6, g);
        P(lx, 7, g);
        P(lx + 2, 6, g);
        P(lx + 2, 7, g);
      }
      P(4, 6, g);
      P(11, 6, g);
    }
  }
  // keps
  if (look.cap) {
    const cap = look.cap;
    const capDk = shade(cap, -0.28);
    if (side) {
      rowH(0, 6, 10, cap);
      rowH(1, 5, 11, cap);
      rowH(2, 4, 11, cap);
      rowH(3, 4, 11, cap);
      rowH(3, 11, 14, capDk);
      P(7, 1, shade(cap, 0.3));
    } else {
      rowH(0, 5, 10, cap);
      rowH(1, 4, 11, cap);
      rowH(2, 3, 12, cap);
      rowH(3, 3, 12, cap);
      P(6, 1, shade(cap, 0.3));
      P(7, 1, shade(cap, 0.3));
      if (back) rowH(4, 6, 9, capDk);
      else {
        P(7, 2, "#ffffff");
        P(8, 2, "#ffffff");
        rowH(4, 3, 12, capDk);
      }
    }
  }
  // örhängen
  if (look.earrings && !back && (style === "bob" || style === "short" || style === "pixie" || style === "side")) {
    if (side) P(7, 9, look.earrings);
    else {
      P(3, 10, look.earrings);
      P(12, 10, look.earrings);
    }
  }
  // VR-glasögon
  if (o.vr) {
    if (side) {
      rect(9, 5, 5, 3, "#2b2d33");
      P(13, 6, "#4cc9f0");
      rowH(5, 4, 8, "#444852");
    } else if (!back) {
      rect(4, 5, 8, 3, "#2b2d33");
      rect(5, 6, 6, 1, "#4cc9f0");
      P(3, 6, "#444852");
      P(12, 6, "#444852");
    } else {
      rowH(6, 3, 12, "#444852");
    }
  }

  if (armsRaised) {
    paintArm(segs.L, true);
    paintArm(segs.R, true);
  }

  // filt över kroppen när man ligger
  if (o.lie) {
    for (let y = 14; y <= 22; y++)
      for (let x = 2; x <= 13; x++) P(x, y, (x + y) % 4 === 0 ? "#b5603f" : y === 14 ? "#e08a63" : "#c96f4a");
  }

  return { buf: b, hand: [segs.hand[0] + 2, segs.hand[1] + 2 + dy], head: 2 + dy };
}

function flipBuf(src: PixBuf): PixBuf {
  const out = new PixBuf(src.w, src.h);
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) out.data[y * src.w + (src.w - 1 - x)] = src.data[y * src.w + x];
  return out;
}

// --------------------------------------------------------------- cache

const figCache = new Map<string, Figure>();

export function getFigure(id: string, look: Look, o: FigureOpts, tint?: string): Figure {
  const key = `${id}|${o.dir}|${o.body}|${o.legs}|${o.arms}|${o.mouth}|${o.eyes}|${o.vr ? 1 : 0}|${o.lie ? 1 : 0}|${tint ?? ""}`;
  let f = figCache.get(key);
  if (f) return f;
  if (figCache.size > 6000) figCache.clear();
  const paintDir: Dir4 = o.dir === 2 ? 3 : o.dir;
  const { buf, hand, head } = paintFigure(look, { ...o, dir: paintDir });
  let b = buf;
  let h: [number, number] = hand;
  if (o.dir === 2) {
    b = flipBuf(buf);
    h = [BW - 1 - hand[0], hand[1]];
  }
  f = { img: b.toCanvas(OUTLINE, tint, tint ? 0.45 : 0), hand: h, head };
  figCache.set(key, f);
  return f;
}

// --------------------------------------------------------------- animation → pose

export interface PoseState {
  o: FigureOpts;
  yo: number; // vertikal förskjutning (hopp/svävning)
  xo: number;
  horizontal: boolean; // liggande på golvet (roteras)
  tint?: string;
  balls?: boolean;
  tears?: boolean;
  sweat?: boolean;
  shadowScale: number;
}

const MOVING = new Set<Anim>(["walk", "run", "conga", "sneak", "panic"]);

export function poseFor(s: CharSnap, t: number, phase: number, onVerticalSeat: boolean): PoseState {
  let dir = s.d as Dir4;
  const sit = s.p === "sit";
  const lie = s.p === "lie";
  const blink = ((t + phase * 7) % 4.3) < 0.13;
  const o: FigureOpts = {
    dir,
    body: sit ? "sit" : "stand",
    legs: sit ? "sit" : "stand",
    arms: "down",
    mouth: "closed",
    eyes: blink ? "closed" : "open",
    vr: s.h === "vr" && s.a === "vr",
  };
  let yo = 0;
  let xo = 0;
  let horizontal = false;
  let tint: string | undefined;
  let balls = false;
  let tears = false;
  let sweat = false;
  let shadowScale = 1;
  const walkFrame = (fps: number) => {
    const f = Math.floor(t * fps + phase * 4) % 4;
    o.legs = f === 1 ? "w1" : f === 3 ? "w3" : "stand";
    if (o.arms === "down") o.arms = f === 1 ? "swing1" : f === 3 ? "swing2" : "down";
    return f;
  };
  const a = s.a;
  if (s.e?.includes("spin")) {
    const seq: Dir4[] = [0, 3, 1, 2];
    dir = seq[Math.floor(t * 10) % 4];
    o.dir = dir;
  }
  if (lie || a === "pushup") {
    o.dir = 0;
    o.body = "stand";
    o.legs = "together";
    o.eyes = a === "sleep" || lie ? "closed" : o.eyes;
    o.lie = lie && onVerticalSeat;
    horizontal = !(lie && onVerticalSeat);
    if (a === "pushup") {
      o.lie = false;
      o.eyes = "open";
      o.mouth = Math.floor(t * 2) % 2 ? "open" : "closed";
      yo = Math.floor(t * 2) % 2 ? -1 : 0;
    }
    return { o, yo, xo, horizontal, shadowScale: 0 };
  }
  switch (a) {
    case "walk":
      walkFrame(7);
      break;
    case "run": {
      const f = walkFrame(12);
      yo = f % 2 ? -1 : 0;
      break;
    }
    case "conga": {
      o.arms = "forward";
      const f = walkFrame(7);
      yo = f % 2 ? -1 : 0;
      o.mouth = "smile";
      break;
    }
    case "sneak":
      o.body = "crouch";
      o.arms = "forward";
      walkFrame(4);
      o.legs = "stand";
      break;
    case "panic": {
      o.arms = "up";
      o.eyes = "wide";
      o.mouth = "open";
      walkFrame(13);
      xo = Math.sin(t * 50) > 0 ? 1 : 0;
      sweat = true;
      break;
    }
    case "type":
      o.arms = Math.floor(t * 7 + phase * 3) % 2 ? "type1" : "type2";
      if (!sit) o.arms = "forward";
      break;
    case "drink":
      o.arms = (t + phase * 3) % 3 < 1.1 ? "mouth" : "down";
      break;
    case "eat":
      o.arms = (t + phase * 3) % 1.6 < 0.6 ? "mouth" : "down";
      o.mouth = (t * 3) % 1 < 0.5 ? "open" : "closed";
      break;
    case "talk":
      o.mouth = Math.floor(t * 6 + phase * 5) % 2 ? "open" : "closed";
      o.arms = (t + phase * 5) % 4 < 1.2 ? "point" : (t + phase * 5) % 4 < 2 ? "hips" : "down";
      if (sit) o.arms = (t + phase) % 3 < 1 ? "chin" : "down";
      break;
    case "phone":
      o.arms = "ear";
      o.mouth = Math.floor(t * 5) % 3 === 0 ? "open" : "closed";
      break;
    case "dance": {
      const f = Math.floor(t * 4 + phase * 4) % 4;
      o.arms = (["up", "upL", "up", "upR"] as Arms[])[f];
      o.legs = f % 2 ? "w1" : "w3";
      yo = f % 2 ? -2 : 0;
      o.mouth = "smile";
      o.eyes = "happy";
      if (sit) {
        o.legs = "sit";
        yo = f % 2 ? -1 : 0;
      }
      break;
    }
    case "sleep":
      o.eyes = "closed";
      if (sit) yo = Math.floor(t * 0.8) % 2 ? 1 : 0;
      break;
    case "jump":
      o.arms = "up";
      o.legs = "together";
      yo = -Math.round(Math.abs(Math.sin(t * 6 + phase)) * 6);
      o.mouth = "open";
      shadowScale = 1 + yo / 12;
      break;
    case "cheer":
      o.arms = "up";
      o.mouth = "open";
      o.eyes = "happy";
      yo = sit ? 0 : -Math.round(Math.abs(Math.sin(t * 8 + phase)) * 3);
      break;
    case "draw":
      o.arms = Math.floor(t * 3) % 2 ? "draw1" : "draw2";
      break;
    case "wave":
      o.arms = Math.floor(t * 4) % 2 ? "wave1" : "wave2";
      o.mouth = "smile";
      break;
    case "think":
      o.arms = "chin";
      if ((t + phase) % 5 < 1.5) o.eyes = "closed";
      break;
    case "point":
      o.arms = "point";
      o.mouth = "open";
      break;
    case "yoga":
      o.arms = "yoga";
      if (!sit) o.legs = "yoga";
      o.eyes = "closed";
      o.mouth = "smile";
      break;
    case "juggle":
      o.arms = Math.floor(t * 4) % 2 ? "juggle1" : "juggle2";
      balls = true;
      o.mouth = "smile";
      break;
    case "vr":
      o.vr = true;
      o.arms = "forward";
      xo = Math.round(Math.sin(t * 1.7 + phase) * 1);
      break;
    case "cry":
      o.arms = "face";
      o.mouth = "open";
      tears = true;
      break;
    case "flex":
      o.arms = Math.floor(t * 1.5) % 2 ? "flex" : "hips";
      o.mouth = "smile";
      break;
    case "read":
      o.arms = "read";
      break;
    case "game":
      o.arms = "game";
      break;
    case "frozen":
      o.arms = phase > 0.5 ? "point" : "upL";
      o.eyes = "open";
      tint = "#9fd8ff";
      break;
    case "float":
      o.arms = "up";
      yo = -7 + Math.round(Math.sin(t * 2 + phase * 6) * 2);
      shadowScale = 0.6;
      o.eyes = "happy";
      break;
    default:
      break;
  }
  if (MOVING.has(a) && sit) {
    o.legs = "sit";
  }
  if (s.h && (o.arms === "down" || o.arms === "swing1" || o.arms === "swing2") && (s.h === "kartong" || s.h === "laptop" || s.h === "tarta")) {
    o.arms = "hold";
  }
  return { o, yo, xo, horizontal, tint, balls, tears, sweat, shadowScale };
}

export function phaseOf(id: string): number {
  return (strHash(id) % 1000) / 1000;
}

// --------------------------------------------------------------- föremål

const itemCache = new Map<string, HTMLCanvasElement>();

export function itemSprite(item: Item): HTMLCanvasElement {
  let cv = itemCache.get(item);
  if (cv) return cv;
  const [c, x] = makeCanvas(12, 12);
  const o = 2;
  switch (item) {
    case "kaffe":
      R(x, o + 2, o + 3, 4, 4, "#f7f5f0");
      R(x, o + 2, o + 3, 4, 1, "#5a3a24");
      R(x, o + 6, o + 4, 1, 2, "#f7f5f0");
      R(x, o + 2, o + 6, 4, 1, "#d8d3c8");
      break;
    case "kopp":
      R(x, o + 2, o + 3, 4, 4, "#e85d75");
      R(x, o + 6, o + 4, 1, 2, "#e85d75");
      R(x, o + 2, o + 3, 4, 1, "#3a2416");
      break;
    case "laptop":
      R(x, 1, 3, 10, 6, "#c9ccd1");
      R(x, 2, 4, 8, 4, "#5b8cff");
      R(x, 1, 9, 10, 2, "#dfe2e6");
      break;
    case "banan":
      R(x, o + 1, o + 5, 5, 1, "#f2d03b");
      R(x, o + 2, o + 6, 4, 1, "#e0b92a");
      R(x, o, o + 4, 1, 1, "#f2d03b");
      R(x, o + 6, o + 4, 1, 1, "#6b4a1a");
      break;
    case "tarta":
      R(x, 2, 6, 8, 4, "#fbe3ea");
      R(x, 2, 6, 8, 1, "#ff9fc4");
      R(x, 2, 8, 8, 1, "#e85d75");
      R(x, 5, 3, 1, 3, "#ffffff");
      R(x, 5, 2, 1, 1, "#ffcf5a");
      break;
    case "postit":
      R(x, o + 1, o + 2, 5, 5, "#ffe36e");
      R(x, o + 1, o + 2, 5, 1, "#ffd23f");
      R(x, o + 2, o + 4, 3, 1, "#c9a542");
      break;
    case "mikrofon":
      R(x, o + 3, o + 3, 1, 5, "#1f1f23");
      R(x, o + 2, o + 1, 3, 3, "#9aa1a8");
      break;
    case "kartong":
      R(x, 0, 3, 12, 8, "#b98552");
      R(x, 0, 3, 12, 1, "#d6a46e");
      R(x, 5, 3, 2, 8, "#e8d7b6");
      break;
    case "vr":
      R(x, o + 1, o + 3, 6, 3, "#2b2d33");
      R(x, o + 2, o + 4, 4, 1, "#4cc9f0");
      break;
    case "telefon":
      R(x, o + 2, o + 2, 3, 5, "#1f1f23");
      R(x, o + 3, o + 3, 1, 3, "#5b8cff");
      break;
    case "bulle":
      R(x, o + 1, o + 3, 5, 4, "#b8743a");
      R(x, o + 2, o + 4, 3, 2, "#e0a35e");
      R(x, o + 3, o + 4, 1, 1, "#ffffff");
      break;
    case "vatten":
      R(x, o + 2, o + 2, 3, 5, "#cfe9f7");
      R(x, o + 2, o + 4, 3, 3, "#8fc8ef");
      break;
    case "papper":
      R(x, o + 1, o + 1, 5, 6, "#ffffff");
      R(x, o + 2, o + 2, 3, 1, "#b8bcc4");
      R(x, o + 2, o + 4, 3, 1, "#b8bcc4");
      break;
    case "blomma":
      R(x, o + 3, o + 4, 1, 4, "#3e8a3a");
      R(x, o + 2, o + 1, 3, 3, "#e8456b");
      R(x, o + 3, o + 2, 1, 1, "#ffd23f");
      break;
    case "pokal":
      R(x, o + 1, o + 1, 5, 3, "#e8c13a");
      R(x, o + 3, o + 4, 1, 2, "#c9a02a");
      R(x, o + 2, o + 6, 3, 1, "#c9a02a");
      R(x, o + 2, o + 1, 1, 1, "#fff2a8");
      break;
  }
  itemCache.set(item, c);
  return c;
}

// --------------------------------------------------------------- NPC:er

const npcCache = new Map<string, HTMLCanvasElement>();

const STRINDBERG: Look = {
  skin: "#f0d4c0",
  hair: "#e2e2e2",
  hairStyle: "curly",
  beard: "full",
  beardColor: "#cfcfcf",
  top: "#2b2b30",
  topStyle: "blazer",
  inner: "#f2f2f2",
  pants: "#2b2b30",
  shoes: "#111111",
};
const COURIER: Look = {
  skin: "#d9a982",
  hair: "#3a2a20",
  hairStyle: "short",
  cap: "#c0392b",
  top: "#c0392b",
  topStyle: "tshirt",
  pants: "#2b2b30",
  shoes: "#111111",
};

export function npcLook(kind: string): Look | null {
  if (kind === "strindberg") return STRINDBERG;
  if (kind === "courier") return COURIER;
  return null;
}

export function npcSprite(n: NpcSnap, t: number): { img: HTMLCanvasElement; ax: number; ay: number; alpha: number; yo: number } | null {
  const frame = Math.floor(t * 4) % 2;
  const flip = n.d === 2;
  const key = `${n.k}|${frame}|${flip ? 1 : 0}|${n.a}`;
  let cv = npcCache.get(key);
  const alpha = n.k === "ghost" ? 0.62 + 0.15 * Math.sin(t * 3) : 1;
  let yo = 0;
  if (n.k === "ghost") yo = -6 + Math.round(Math.sin(t * 2.4) * 2);
  if (n.k === "pigeon" && n.a === "walk") yo = frame ? -1 : 0;
  if (!cv) {
    const b = new PixBuf(18, 20);
    if (n.k === "vacuum") {
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 14; x++) {
          const dx = (x - 6.5) / 7;
          const dy = (y - 3.5) / 4;
          if (dx * dx + dy * dy <= 1) b.set(x + 2, y + 10, y < 3 ? "#5a5f69" : "#3c4048");
        }
      for (let x = 4; x < 12; x++) b.set(x, 17, "#25282e");
      b.set(9, 11, "#8a909b");
      b.set(10, 11, "#8a909b");
      b.set(7, 12, frame ? "#4cc9f0" : "#1f6f8a");
    } else if (n.k === "pigeon") {
      const pk = n.a === "eat" || (n.a === "idle" && frame === 1);
      const body: [number, number, string][] = [];
      for (let x = 4; x < 12; x++) for (let y = 12; y < 17; y++) body.push([x, y, y < 14 ? "#8d939c" : "#7a808a"]);
      for (const [x, y, c] of body) b.set(x, y, c);
      for (let x = 5; x < 10; x++) b.set(x, 13, "#6c727c");
      b.set(12, 13, "#6c727c");
      b.set(13, 14, "#5a6069");
      const hx = pk ? 11 : 10;
      const hy = pk ? 13 : 9;
      for (let y = hy; y < hy + 3; y++) for (let x = hx; x < hx + 3; x++) b.set(x, y, "#9aa0a9");
      b.set(hx, hy + 3, "#5fa58c");
      b.set(hx + 1, hy + 3, "#8a5aa8");
      b.set(hx + 2, hy + 1, "#e07b28");
      b.set(hx + 3, hy + 1, "#3a3a3a");
      b.set(6, 17, "#d0786a");
      b.set(9, 17, "#d0786a");
    } else if (n.k === "ghost") {
      for (let y = 2; y < 19; y++)
        for (let x = 2; x < 16; x++) {
          const top = y < 9 ? (x - 9) ** 2 / 49 + (y - 9) ** 2 / 49 <= 1 : true;
          const wave = y >= 16 ? ((x + frame) % 3 !== 0 || y < 17) : true;
          if (top && wave) b.set(x, y, y > 14 ? "#e6eef8" : "#f6fbff");
        }
      b.set(7, 8, "#1b1d2a");
      b.set(7, 9, "#1b1d2a");
      b.set(11, 8, "#1b1d2a");
      b.set(11, 9, "#1b1d2a");
      b.set(9, 11, "#1b1d2a");
      b.set(9, 12, "#1b1d2a");
      b.set(5, 6, "#ffffff");
    } else if (n.k === "cat") {
      for (let x = 4; x < 13; x++) for (let y = 14; y < 18; y++) b.set(x, y, (x + y) % 3 ? "#e39a4b" : "#c97b2f");
      for (let x = 11; x < 15; x++) for (let y = 11; y < 15; y++) b.set(x, y, "#e39a4b");
      b.set(11, 10, "#e39a4b");
      b.set(14, 10, "#e39a4b");
      b.set(12, 12, "#2a2023");
      b.set(14, 12, "#2a2023");
      b.set(13, 13, "#e46c7a");
      b.set(3, 13 - frame, "#c97b2f");
      b.set(2, 12 - frame, "#c97b2f");
      b.set(5, 18, "#c97b2f");
      b.set(11, 18, "#c97b2f");
    }
    let buf = b;
    if (flip) {
      const out = new PixBuf(b.w, b.h);
      for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) out.data[y * b.w + (b.w - 1 - x)] = b.data[y * b.w + x];
      buf = out;
    }
    cv = buf.toCanvas(n.k === "ghost" ? "#9fb3cc" : OUTLINE);
    npcCache.set(key, cv);
  }
  return { img: cv, ax: 9, ay: 19, alpha, yo };
}

/** Juggling-bollar, tårar och svett ritas runt figuren. */
export function drawExtras(c: CanvasRenderingContext2D, ps: PoseState, x: number, y: number, t: number) {
  if (ps.balls) {
    for (let i = 0; i < 3; i++) {
      const a = t * 5 + (i * Math.PI * 2) / 3;
      const bx = Math.round(x + Math.cos(a) * 6);
      const by = Math.round(y - 22 - Math.abs(Math.sin(a)) * 7);
      R(c, bx, by, 2, 2, ["#ff5ec4", "#ffd23f", "#4cc9f0"][i]);
    }
  }
  if (ps.tears) {
    const p = (t * 2) % 1;
    R(c, x - 3, Math.round(y - 17 + p * 6), 1, 2, "#7fc8ff");
    R(c, x + 2, Math.round(y - 17 + ((p + 0.5) % 1) * 6), 1, 2, "#7fc8ff");
  }
  if (ps.sweat) {
    const p = (t * 3) % 1;
    R(c, x + 6, Math.round(y - 24 + p * 4), 1, 2, "#bfe6ff");
    R(c, x - 6, Math.round(y - 22 + ((p + 0.4) % 1) * 4), 1, 2, "#bfe6ff");
  }
}

export function drawShadow(c: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  if (scale <= 0) return;
  c.globalAlpha = 0.28;
  ellipse(c, x, y, Math.max(2, Math.round(5 * scale)), Math.max(1, Math.round(2 * scale)), "#1a1420");
  c.globalAlpha = 1;
}

// --------------------------------------------------------------- porträtt

import { CONSULTANT_BY_ID as CBI, NPCS as NPC_LIST } from "../../shared/consultants.ts";

/** Pixligt porträtt (huvud + axlar) för en konsult eller NPC. size = CSS-pixlar (kvadrat). */
export function renderPortrait(id: string, size: number): HTMLCanvasElement {
  const dpr = Math.min(3, (typeof window !== "undefined" && window.devicePixelRatio) || 1);
  const px = Math.max(1, Math.round(size * dpr));
  const [out, o] = makeCanvas(px, px);
  out.style.width = `${size}px`;
  out.style.height = `${size}px`;
  o.imageSmoothingEnabled = false;
  const con = CBI[id];
  const npc = NPC_LIST.find((n) => n.id === id);
  const look = con?.look ?? (npc ? npcLook(npc.kind) : null);
  if (look) {
    const fig = paintFigure(look, { dir: 0, body: "stand", legs: "stand", arms: "down", mouth: "smile", eyes: "open", vr: false });
    const img = fig.buf.toCanvas(OUTLINE);
    // beskär huvud + axlar (18×18 ur bufferten)
    o.drawImage(img, 1, 0, 18, 18, 0, 0, px, px);
    return out;
  }
  if (npc && npc.kind !== "object") {
    const sp = npcSprite({ i: id, k: npc.kind, x: 0, y: 0, d: 0, a: "idle", v: true }, 0);
    if (sp) {
      o.drawImage(sp.img, 0, 1, 18, 19, Math.round(px * 0.03), Math.round(px * 0.03), Math.round(px * 0.94), Math.round(px * 0.99));
      return out;
    }
  }
  // okänt / objekt: "?"
  const u = px / 16;
  o.fillStyle = "#2a2230";
  o.fillRect(4 * u, 2 * u, 8 * u, 12 * u);
  o.fillStyle = "#ffd23f";
  o.fillRect(5 * u, 3 * u, 6 * u, 2 * u);
  o.fillRect(9 * u, 5 * u, 2 * u, 2 * u);
  o.fillRect(7 * u, 7 * u, 2 * u, 2 * u);
  o.fillRect(7 * u, 10 * u, 2 * u, 2 * u);
  return out;
}
