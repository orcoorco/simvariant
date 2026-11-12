// Barnhusgatan 20 – kartan.
//
// Planskissen (New Property) är översatt till rumspolygoner i planritningens
// pixelkoordinater. De rastreras till ett rutnät där varje ruta motsvarar
// 20×20 pixlar på planskissen. Väggar uppstår automatiskt runt golvytor och
// mellan rum, dörrar/fönster karvas ut explicit. Möbler och interaktions-
// platser anges i rutkoordinater.

export const TILE = 16; // renderade pixlar per ruta
const PLAN_PX = 20; // planskisspixlar per ruta
const OX = 260;
const OY = 40;
export const MAP_W = 38;
export const MAP_H = 80;

export const T_VOID = 0;
export const T_FLOOR = 1;
export const T_WALL = 2;
export const T_DOOR = 3;
export const T_WINDOW = 4;

export type Dir = 0 | 1 | 2 | 3; // 0 ned, 1 upp, 2 vänster, 3 höger
export const DOWN: Dir = 0;
export const UP: Dir = 1;
export const LEFT: Dir = 2;
export const RIGHT: Dir = 3;

export type FloorKind =
  | "herring"
  | "checker"
  | "carpet"
  | "plank"
  | "tile"
  | "server"
  | "stone"
  | "balcony"
  | "marble";

export type RoomId =
  | "pentry"
  | "server"
  | "passage"
  | "rwc"
  | "wc"
  | "kontor1"
  | "kontor2"
  | "kontor3"
  | "hall"
  | "samtal"
  | "korridor"
  | "mote_stor"
  | "mote_rund"
  | "lounge"
  | "balkong"
  | "trapphus";

type Pt = [number, number];
type Shape =
  | { poly: Pt[] }
  | { ellipse: [cx: number, cy: number, rx: number, ry: number]; clip?: [y0: number, y1: number] }
  | { circle: [cx: number, cy: number, r: number] };

export interface RoomInfo {
  id: RoomId;
  name: string; // visningsnamn
  inRoom: string; // "i pentryt"
  toRoom: string; // "till pentryt"
  floor: FloorKind;
  zone: string; // rum i samma zon får inga väggar mellan sig
  wall: string; // väggfärg (fasad mot söder)
  quiet?: boolean;
  social?: boolean;
  outside?: boolean;
  shapes: Shape[];
}

export const ROOMS: RoomInfo[] = [
  {
    id: "pentry",
    name: "Pentry/Matsal",
    inRoom: "i pentryt",
    toRoom: "till pentryt",
    floor: "checker",
    zone: "pentry",
    wall: "#f1ede4",
    social: true,
    shapes: [{ poly: [[285, 182], [528, 188], [528, 405], [430, 405], [292, 268]] }],
  },
  {
    id: "server",
    name: "Serverrummet",
    inRoom: "i serverrummet",
    toRoom: "till serverrummet",
    floor: "server",
    zone: "server",
    wall: "#9aa3ad",
    quiet: true,
    shapes: [{ poly: [[540, 165], [655, 165], [655, 225], [540, 225]] }],
  },
  {
    id: "passage",
    name: "Passagen",
    inRoom: "i passagen",
    toRoom: "till passagen",
    floor: "herring",
    zone: "hall",
    wall: "#e9e4d8",
    social: true,
    shapes: [
      {
        poly: [
          [540, 245], [655, 245], [655, 545], [605, 545], [605, 585], [642, 585], [642, 625], [540, 625],
        ],
      },
    ],
  },
  {
    id: "rwc",
    name: "RWC",
    inRoom: "på RWC:n",
    toRoom: "till RWC:n",
    floor: "tile",
    zone: "rwc",
    wall: "#c9d3d6",
    quiet: true,
    shapes: [{ poly: [[440, 420], [522, 420], [522, 520], [480, 520], [440, 478]] }],
  },
  {
    id: "wc",
    name: "WC",
    inRoom: "på toa",
    toRoom: "till toa",
    floor: "tile",
    zone: "wc",
    wall: "#c9d3d6",
    quiet: true,
    shapes: [{ poly: [[422, 545], [500, 545], [500, 605], [422, 605]] }],
  },
  {
    id: "kontor1",
    name: "Kontor Norr",
    inRoom: "i Kontor Norr",
    toRoom: "till Kontor Norr",
    floor: "carpet",
    zone: "kontor1",
    wall: "#f4f1ea",
    quiet: true,
    shapes: [{ poly: [[680, 58], [925, 58], [925, 282], [680, 282]] }],
  },
  {
    id: "kontor2",
    name: "Burspråkskontoret",
    inRoom: "i burspråkskontoret",
    toRoom: "till burspråkskontoret",
    floor: "plank",
    zone: "kontor2",
    wall: "#f4f1ea",
    quiet: true,
    shapes: [
      { poly: [[680, 300], [935, 300], [935, 540], [680, 540]] },
      { poly: [[935, 318], [968, 318], [1000, 352], [1000, 488], [968, 522], [935, 522]] },
    ],
  },
  {
    id: "kontor3",
    name: "Storkontoret",
    inRoom: "i storkontoret",
    toRoom: "till storkontoret",
    floor: "herring",
    zone: "kontor3",
    wall: "#f4f1ea",
    shapes: [{ poly: [[662, 562], [905, 562], [905, 932], [662, 932]] }],
  },
  {
    id: "hall",
    name: "Entrén/Kapprummet",
    inRoom: "i entrén",
    toRoom: "till entrén",
    floor: "herring",
    zone: "hall",
    wall: "#a9c2b2",
    social: true,
    shapes: [
      {
        poly: [
          [422, 625], [612, 625], [612, 962], [578, 998], [500, 998], [500, 985], [422, 935],
        ],
      },
    ],
  },
  {
    id: "samtal",
    name: "Samtalsrummet",
    inRoom: "i samtalsrummet",
    toRoom: "till samtalsrummet",
    floor: "carpet",
    zone: "samtal",
    wall: "#e3d9cc",
    quiet: true,
    shapes: [{ poly: [[392, 995], [482, 995], [482, 1088], [446, 1088], [384, 1028]] }],
  },
  {
    id: "korridor",
    name: "Korridoren",
    inRoom: "i korridoren",
    toRoom: "till korridoren",
    floor: "herring",
    zone: "hall",
    wall: "#a9c2b2",
    shapes: [{ poly: [[498, 995], [553, 995], [553, 1160], [498, 1160]] }],
  },
  {
    id: "mote_stor",
    name: "Stora mötesrummet",
    inRoom: "i stora mötesrummet",
    toRoom: "till stora mötesrummet",
    floor: "herring",
    zone: "mote_stor",
    wall: "#f4f1ea",
    social: true,
    shapes: [{ ellipse: [800, 1098, 195, 155], clip: [960, 1240] }],
  },
  {
    id: "mote_rund",
    name: "Runda mötesrummet",
    inRoom: "i runda mötesrummet",
    toRoom: "till runda mötesrummet",
    floor: "herring",
    zone: "mote_rund",
    wall: "#f4f1ea",
    shapes: [{ circle: [505, 1322, 136] }],
  },
  {
    id: "lounge",
    name: "Loungen",
    inRoom: "i loungen",
    toRoom: "till loungen",
    floor: "herring",
    zone: "lounge",
    wall: "#f4f1ea",
    social: true,
    shapes: [
      {
        poly: [
          [662, 1262], [908, 1262], [908, 1470], [872, 1528], [780, 1550], [632, 1462], [636, 1390], [662, 1330],
        ],
      },
    ],
  },
  {
    id: "balkong",
    name: "Kungsbalkongen",
    inRoom: "på Kungsbalkongen",
    toRoom: "till Kungsbalkongen",
    floor: "balcony",
    zone: "balkong",
    wall: "#d9cbb5",
    outside: true,
    shapes: [
      {
        poly: [
          [790, 1562], [872, 1548], [915, 1512], [942, 1472], [952, 1522], [918, 1578], [850, 1612], [765, 1600],
        ],
      },
    ],
  },
  {
    id: "trapphus",
    name: "Trapphuset",
    inRoom: "i trapphuset",
    toRoom: "till trapphuset",
    floor: "marble",
    zone: "trapphus",
    wall: "#d8b48a",
    outside: true,
    shapes: [{ poly: [[342, 680], [402, 680], [402, 740], [342, 740]] }],
  },
];

export const ROOM_BY_ID: Record<RoomId, RoomInfo> = Object.fromEntries(ROOMS.map((r) => [r.id, r])) as Record<
  RoomId,
  RoomInfo
>;

// Dörrar i rutkoordinater (karvas ut genom väggar).
export interface DoorDef {
  tiles: Pt[];
  a: RoomId;
  b: RoomId;
  double?: boolean;
  label?: string;
}

export const DOORS: DoorDef[] = [
  { tiles: [[16, 9], [17, 9]], a: "passage", b: "server" },
  { tiles: [[13, 11], [13, 12]], a: "passage", b: "pentry" },
  { tiles: [[20, 10], [20, 11]], a: "passage", b: "kontor1" },
  { tiles: [[20, 15], [20, 16]], a: "passage", b: "kontor2" },
  { tiles: [[21, 12], [22, 12]], a: "kontor1", b: "kontor2" },
  { tiles: [[22, 25], [23, 25]], a: "kontor2", b: "kontor3" },
  { tiles: [[13, 22]], a: "passage", b: "rwc" },
  { tiles: [[11, 28]], a: "hall", b: "wc" },
  { tiles: [[19, 27], [19, 28]], a: "passage", b: "kontor3" },
  { tiles: [[7, 32], [7, 33]], a: "hall", b: "trapphus", double: true, label: "Entrén" },
  { tiles: [[11, 50]], a: "korridor", b: "samtal" },
  { tiles: [[22, 45], [23, 45], [27, 45], [28, 45]], a: "kontor3", b: "mote_stor", double: true },
  { tiles: [[16, 47], [17, 47], [18, 47], [18, 48]], a: "hall", b: "mote_stor" },
  { tiles: [[12, 56], [13, 56]], a: "korridor", b: "mote_rund", double: true },
  { tiles: [[16, 58], [17, 58], [18, 58], [19, 58]], a: "mote_rund", b: "mote_stor" },
  { tiles: [[22, 60], [23, 60], [27, 60], [28, 60]], a: "mote_stor", b: "lounge", double: true },
  { tiles: [[19, 64], [19, 65]], a: "mote_rund", b: "lounge" },
  { tiles: [[28, 75], [29, 75]], a: "lounge", b: "balkong", double: true, label: "Balkongdörren" },
];

// Fönster: rektanglar i planskisskoordinater. Väggrutor inuti blir fönster.
const WINDOW_RECTS: [number, number, number, number][] = [
  [255, 195, 290, 270], // pentry väst
  [300, 300, 420, 420], // pentry sydväst (diagonal)
  [915, 100, 950, 190], // kontor norr öst (fransk balkong)
  [990, 330, 1030, 510], // burspråk öst
  [940, 290, 1010, 340], // burspråk snett
  [940, 500, 1010, 550], // burspråk snett
  [905, 585, 935, 655], // storkontoret
  [905, 685, 935, 770],
  [905, 785, 935, 855],
  [960, 990, 1030, 1210], // stora mötesrummets burspråk
  [350, 1400, 480, 1500], // runda mötesrummets burspråk
  [350, 1200, 395, 1290],
  [620, 1462, 760, 1540], // loungen sydväst
  [905, 1440, 935, 1490],
];

export type FurnKind =
  | "desk"
  | "chair"
  | "officechair"
  | "monitor"
  | "dining_table"
  | "round_table"
  | "coffee_table"
  | "side_table"
  | "sofa"
  | "armchair"
  | "bench"
  | "counter"
  | "fridge"
  | "sink"
  | "stove"
  | "dishwasher"
  | "coffee_machine"
  | "water_cooler"
  | "plant"
  | "big_plant"
  | "server_rack"
  | "arcade"
  | "toilet"
  | "wc_sink"
  | "whiteboard"
  | "tv"
  | "painting"
  | "clock"
  | "kakelugn"
  | "coat_rack"
  | "shoe_rack"
  | "bookshelf"
  | "lockers"
  | "cabinet"
  | "printer"
  | "rug"
  | "round_rug"
  | "doormat"
  | "lamp_maskros"
  | "lamp_pendant"
  | "neon_sign"
  | "elevator"
  | "railing"
  | "flowerbox"
  | "trash"
  | "fruit_bowl"
  | "projector_screen"
  | "phone_booth";

export interface Furn {
  id: string;
  kind: FurnKind;
  x: number;
  y: number;
  w: number;
  h: number;
  room: RoomId;
  solid: boolean;
  dir?: Dir;
  wall?: boolean; // ritas på väggens fasad
  overhead?: boolean; // ritas ovanpå figurer (taklampor)
  variant?: number;
  label?: string;
}

export type SpotKind =
  | "desk"
  | "coffee"
  | "fridge"
  | "sink"
  | "stove"
  | "dishwasher"
  | "dining"
  | "sofa"
  | "armchair"
  | "bench"
  | "meeting"
  | "whiteboard"
  | "plant"
  | "server"
  | "arcade"
  | "toilet"
  | "window"
  | "balcony"
  | "phone"
  | "kakelugn"
  | "printer"
  | "tv"
  | "coatrack"
  | "water"
  | "entrance"
  | "fruit";

export type Pose = "stand" | "sit" | "lie";

export interface Spot {
  id: string;
  kind: SpotKind;
  x: number;
  y: number;
  face: Dir;
  room: RoomId;
  pose: Pose;
  furn?: string;
  label: string;
}

export interface OfficeMap {
  w: number;
  h: number;
  tiles: Uint8Array;
  room: Int8Array; // index i ROOMS, -1 = inget rum
  blocked: Uint8Array; // 1 = går inte att gå igenom
  furniture: Furn[];
  spots: Spot[];
  doors: DoorDef[];
}

function pointInPoly(x: number, y: number, pts: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inShape(x: number, y: number, s: Shape): boolean {
  if ("poly" in s) return pointInPoly(x, y, s.poly);
  if ("circle" in s) {
    const [cx, cy, r] = s.circle;
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  }
  const [cx, cy, rx, ry] = s.ellipse;
  if (s.clip && (y < s.clip[0] || y > s.clip[1])) return false;
  return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
}

const ROOM_INDEX: Record<string, number> = Object.fromEntries(ROOMS.map((r, i) => [r.id, i]));

function furnitureList(): Furn[] {
  const f: Furn[] = [];
  let n = 0;
  const add = (kind: FurnKind, x: number, y: number, w: number, h: number, room: RoomId, extra: Partial<Furn> = {}) => {
    const solid = extra.solid ?? !["chair", "officechair", "rug", "round_rug", "doormat", "lamp_maskros", "lamp_pendant", "monitor"].includes(kind);
    f.push({ id: `${kind}_${n++}`, kind, x, y, w, h, room, solid, ...extra });
  };

  // ---------- Pentry / Matsal ----------
  add("lamp_maskros", 6, 9, 1, 1, "pentry", { overhead: true });
  add("dining_table", 4, 9, 5, 2, "pentry");
  for (const x of [4, 6, 8]) {
    add("chair", x, 8, 1, 1, "pentry", { dir: DOWN });
    add("chair", x, 11, 1, 1, "pentry", { dir: UP });
  }
  add("chair", 3, 10, 1, 1, "pentry", { dir: RIGHT });
  add("chair", 9, 9, 1, 1, "pentry", { dir: LEFT });
  add("fridge", 12, 12, 1, 1, "pentry", { label: "Kylskåpet" });
  add("counter", 12, 13, 1, 1, "pentry");
  add("sink", 12, 14, 1, 1, "pentry", { label: "Diskhon" });
  add("stove", 12, 15, 1, 1, "pentry", { label: "Mikron" });
  add("counter", 12, 16, 1, 1, "pentry");
  add("counter", 12, 17, 1, 1, "pentry");
  add("counter", 11, 17, 1, 1, "pentry");
  add("dishwasher", 10, 17, 1, 1, "pentry", { label: "Diskmaskinen" });
  add("trash", 9, 17, 1, 1, "pentry");
  add("plant", 1, 8, 1, 1, "pentry", { variant: 1 });
  add("clock", 6, 6, 1, 1, "pentry", { wall: true, solid: false });
  add("painting", 9, 6, 2, 1, "pentry", { wall: true, solid: false, variant: 2 });

  // ---------- Server ----------
  add("server_rack", 14, 6, 1, 1, "server", { label: "Servern" });
  add("server_rack", 15, 6, 1, 1, "server");
  add("server_rack", 16, 6, 1, 1, "server");
  add("arcade", 19, 6, 1, 1, "server", { label: "Arkadmaskinen" });

  // ---------- Passagen ----------
  add("coffee_machine", 19, 18, 1, 1, "passage", { label: "Kaffemaskinen" });
  add("counter", 19, 19, 1, 1, "passage");
  add("fruit_bowl", 19, 20, 1, 1, "passage", { label: "Fruktskålen" });
  add("counter", 19, 21, 1, 1, "passage");
  add("water_cooler", 19, 22, 1, 1, "passage", { label: "Vattenautomaten" });
  add("counter", 19, 23, 1, 1, "passage");
  add("printer", 19, 24, 1, 1, "passage", { label: "Skrivaren" });
  add("plant", 14, 10, 1, 1, "passage", { variant: 2 });
  add("painting", 15, 9, 1, 1, "passage", { wall: true, solid: false, variant: 1 });
  add("rug", 15, 13, 3, 4, "passage", { variant: 3 });

  // ---------- RWC / WC ----------
  add("toilet", 11, 19, 1, 1, "rwc", { label: "Toaletten" });
  add("wc_sink", 9, 21, 1, 1, "rwc");
  add("toilet", 10, 25, 1, 1, "wc", { label: "Toaletten" });
  add("wc_sink", 8, 25, 1, 1, "wc");

  // ---------- Kontor Norr (Alt 1) ----------
  add("desk", 23, 4, 3, 2, "kontor1");
  add("desk", 26, 4, 3, 2, "kontor1");
  add("desk", 23, 6, 3, 2, "kontor1");
  add("desk", 26, 6, 3, 2, "kontor1");
  add("monitor", 24, 4, 1, 1, "kontor1", { dir: UP });
  add("monitor", 27, 4, 1, 1, "kontor1", { dir: UP });
  add("monitor", 24, 7, 1, 1, "kontor1", { dir: DOWN });
  add("monitor", 27, 7, 1, 1, "kontor1", { dir: DOWN });
  add("officechair", 24, 3, 1, 1, "kontor1", { dir: DOWN });
  add("officechair", 27, 3, 1, 1, "kontor1", { dir: DOWN });
  add("officechair", 24, 8, 1, 1, "kontor1", { dir: UP });
  add("officechair", 27, 8, 1, 1, "kontor1", { dir: UP });
  add("whiteboard", 22, 0, 3, 1, "kontor1", { wall: true, solid: false, label: "Whiteboarden" });
  add("bookshelf", 30, 1, 2, 1, "kontor1");
  add("cabinet", 32, 9, 1, 2, "kontor1");
  add("big_plant", 32, 1, 1, 1, "kontor1");
  add("plant", 21, 9, 1, 1, "kontor1", { variant: 3 });
  add("painting", 27, 0, 2, 1, "kontor1", { wall: true, solid: false, variant: 3 });
  add("lamp_pendant", 25, 5, 1, 1, "kontor1", { overhead: true });

  // ---------- Burspråkskontoret (Alt 1) ----------
  add("kakelugn", 21, 13, 1, 1, "kontor2", { label: "Kakelugnen" });
  add("cabinet", 23, 13, 1, 1, "kontor2");
  add("cabinet", 24, 13, 1, 1, "kontor2");
  add("cabinet", 25, 13, 1, 1, "kontor2");
  add("desk", 25, 17, 3, 2, "kontor2");
  add("desk", 28, 17, 3, 2, "kontor2");
  add("desk", 25, 19, 3, 2, "kontor2");
  add("desk", 28, 19, 3, 2, "kontor2");
  add("monitor", 26, 17, 1, 1, "kontor2", { dir: UP });
  add("monitor", 29, 17, 1, 1, "kontor2", { dir: UP });
  add("monitor", 26, 20, 1, 1, "kontor2", { dir: DOWN });
  add("monitor", 29, 20, 1, 1, "kontor2", { dir: DOWN });
  add("officechair", 26, 16, 1, 1, "kontor2", { dir: DOWN });
  add("officechair", 29, 16, 1, 1, "kontor2", { dir: DOWN });
  add("officechair", 26, 21, 1, 1, "kontor2", { dir: UP });
  add("officechair", 29, 21, 1, 1, "kontor2", { dir: UP });
  add("armchair", 35, 17, 1, 1, "kontor2", { dir: LEFT });
  add("big_plant", 35, 21, 1, 1, "kontor2");
  add("painting", 29, 12, 2, 1, "kontor2", { wall: true, solid: false, variant: 4 });
  add("lamp_pendant", 28, 19, 1, 1, "kontor2", { overhead: true });

  // ---------- Storkontoret (Alt 2) ----------
  for (let r = 0; r < 4; r++) {
    const y = 29 + r * 3;
    add("desk", 24, y, 2, 3, "kontor3", { variant: 1 });
    add("desk", 26, y, 2, 3, "kontor3", { variant: 1 });
    add("monitor", 24, y + 1, 1, 1, "kontor3", { dir: LEFT });
    add("monitor", 27, y + 1, 1, 1, "kontor3", { dir: RIGHT });
    add("officechair", 23, y + 1, 1, 1, "kontor3", { dir: RIGHT });
    add("officechair", 28, y + 1, 1, 1, "kontor3", { dir: LEFT });
  }
  add("lockers", 20, 31, 1, 6, "kontor3", { label: "Skåpen" });
  add("whiteboard", 26, 25, 3, 1, "kontor3", { wall: true, solid: false, label: "Whiteboarden" });
  add("neon_sign", 29, 25, 3, 1, "kontor3", { wall: true, solid: false });
  add("big_plant", 31, 27, 1, 1, "kontor3");
  add("big_plant", 21, 43, 1, 1, "kontor3");
  add("plant", 31, 43, 1, 1, "kontor3", { variant: 1 });
  add("bookshelf", 30, 26, 1, 1, "kontor3");
  add("lamp_pendant", 25, 32, 1, 1, "kontor3", { overhead: true });
  add("lamp_pendant", 25, 38, 1, 1, "kontor3", { overhead: true });

  // ---------- Entrén / Kapprummet ----------
  add("doormat", 8, 32, 2, 2, "hall");
  add("coat_rack", 8, 35, 1, 4, "hall", { label: "Hatthyllan" });
  add("shoe_rack", 8, 40, 1, 2, "hall");
  add("kakelugn", 8, 44, 1, 1, "hall", { label: "Kakelugnen", variant: 1 });
  add("sofa", 17, 34, 1, 4, "hall", { dir: LEFT, label: "Hallsoffan" });
  add("coffee_table", 15, 35, 1, 1, "hall");
  add("side_table", 15, 37, 1, 1, "hall");
  add("big_plant", 17, 32, 1, 1, "hall");
  add("plant", 17, 39, 1, 1, "hall", { variant: 2 });
  add("rug", 11, 36, 3, 5, "hall", { variant: 1 });
  add("painting", 10, 28, 1, 1, "hall", { wall: true, solid: false, variant: 5 });
  add("lamp_pendant", 12, 38, 1, 1, "hall", { overhead: true });

  // ---------- Samtalsrummet ----------
  add("phone_booth", 9, 48, 1, 1, "samtal", { label: "Samtalsfåtöljen" });
  add("armchair", 8, 49, 1, 1, "samtal", { dir: RIGHT });
  add("plant", 10, 48, 1, 1, "samtal", { variant: 3 });

  // ---------- Stora mötesrummet ----------
  add("round_rug", 26, 50, 7, 7, "mote_stor", { variant: 0 });
  add("round_table", 28, 52, 3, 3, "mote_stor");
  add("chair", 29, 51, 1, 1, "mote_stor", { dir: DOWN });
  add("chair", 31, 52, 1, 1, "mote_stor", { dir: LEFT });
  add("chair", 31, 54, 1, 1, "mote_stor", { dir: LEFT });
  add("chair", 27, 54, 1, 1, "mote_stor", { dir: RIGHT });
  add("chair", 27, 52, 1, 1, "mote_stor", { dir: RIGHT });
  add("bench", 18, 51, 1, 5, "mote_stor", { dir: RIGHT, label: "Bänken" });
  add("whiteboard", 24, 45, 3, 1, "mote_stor", { wall: true, solid: false, label: "Whiteboarden" });
  add("tv", 30, 45, 2, 1, "mote_stor", { wall: true, solid: false });
  add("big_plant", 34, 50, 1, 1, "mote_stor");
  add("lamp_pendant", 29, 53, 1, 1, "mote_stor", { overhead: true });

  // ---------- Runda mötesrummet ----------
  add("round_rug", 9, 60, 7, 7, "mote_rund", { variant: 1 });
  add("round_table", 11, 62, 3, 3, "mote_rund", { variant: 1 });
  add("chair", 12, 61, 1, 1, "mote_rund", { dir: DOWN });
  add("chair", 14, 62, 1, 1, "mote_rund", { dir: LEFT });
  add("chair", 14, 64, 1, 1, "mote_rund", { dir: LEFT });
  add("chair", 10, 64, 1, 1, "mote_rund", { dir: RIGHT });
  add("chair", 10, 62, 1, 1, "mote_rund", { dir: RIGHT });
  add("tv", 14, 57, 2, 1, "mote_rund", { wall: true, solid: false });
  add("cabinet", 7, 59, 1, 1, "mote_rund");
  add("big_plant", 6, 66, 1, 1, "mote_rund");
  add("lamp_pendant", 12, 63, 1, 1, "mote_rund", { overhead: true });

  // ---------- Loungen ----------
  add("round_rug", 20, 66, 8, 8, "lounge", { variant: 2 });
  add("sofa", 31, 63, 1, 5, "lounge", { dir: LEFT, label: "Loungesoffan" });
  add("big_plant", 31, 62, 1, 1, "lounge");
  add("coffee_table", 23, 69, 2, 2, "lounge", { variant: 1 });
  add("armchair", 22, 67, 1, 1, "lounge", { dir: DOWN });
  add("armchair", 26, 68, 1, 1, "lounge", { dir: LEFT });
  add("armchair", 21, 71, 1, 1, "lounge", { dir: RIGHT });
  add("armchair", 25, 72, 1, 1, "lounge", { dir: UP });
  add("projector_screen", 24, 60, 3, 1, "lounge", { wall: true, solid: false });
  add("plant", 29, 72, 1, 1, "lounge", { variant: 1 });

  // ---------- Kungsbalkongen ----------
  add("flowerbox", 32, 76, 1, 1, "balkong");

  // ---------- Trapphuset ----------
  add("elevator", 4, 31, 2, 1, "trapphus", { wall: true, solid: false, label: "Hissen" });

  return f;
}

function spotList(f: Furn[]): Spot[] {
  const s: Spot[] = [];
  let n = 0;
  const add = (kind: SpotKind, x: number, y: number, face: Dir, room: RoomId, pose: Pose, label: string, furn?: string) =>
    s.push({ id: `${kind}_${n++}`, kind, x, y, face, room, pose, label, furn });
  const find = (kind: FurnKind, x: number, y: number) => f.find((q) => q.kind === kind && q.x === x && q.y === y)?.id;

  // Skrivbord (kontorsstolar)
  for (const q of f.filter((q) => q.kind === "officechair")) {
    // Stolens riktning = hållet den sittande tittar (mot skrivbordet)
    add("desk", q.x, q.y, q.dir ?? DOWN, q.room, "sit", `skrivbordet ${ROOM_BY_ID[q.room].inRoom}`, q.id);
  }
  // Stolar runt bord
  for (const q of f.filter((q) => q.kind === "chair")) {
    const kind: SpotKind = q.room === "pentry" ? "dining" : "meeting";
    add(kind, q.x, q.y, q.dir ?? DOWN, q.room, "sit", q.room === "pentry" ? "matbordet" : `mötesbordet ${ROOM_BY_ID[q.room].inRoom}`, q.id);
  }
  for (const q of f.filter((q) => q.kind === "armchair")) add("armchair", q.x, q.y, q.dir ?? DOWN, q.room, "sit", `fåtöljen ${ROOM_BY_ID[q.room].inRoom}`, q.id);
  for (const q of f.filter((q) => q.kind === "sofa")) {
    for (let i = 0; i < q.h; i++) add("sofa", q.x, q.y + i, q.dir ?? LEFT, q.room, "sit", q.label ?? "soffan", q.id);
  }
  for (const q of f.filter((q) => q.kind === "bench")) {
    for (let i = 0; i < q.h; i++) add("bench", q.x, q.y + i, q.dir ?? RIGHT, q.room, "sit", "bänken", q.id);
  }
  add("coffee", 18, 18, RIGHT, "passage", "stand", "kaffemaskinen", find("coffee_machine", 19, 18));
  add("fruit", 18, 20, RIGHT, "passage", "stand", "fruktskålen", find("fruit_bowl", 19, 20));
  add("water", 18, 22, RIGHT, "passage", "stand", "vattenautomaten", find("water_cooler", 19, 22));
  add("printer", 18, 24, RIGHT, "passage", "stand", "skrivaren", find("printer", 19, 24));
  add("fridge", 11, 12, RIGHT, "pentry", "stand", "kylskåpet", find("fridge", 12, 12));
  add("sink", 11, 14, RIGHT, "pentry", "stand", "diskhon", find("sink", 12, 14));
  add("stove", 11, 15, RIGHT, "pentry", "stand", "mikron", find("stove", 12, 15));
  add("dishwasher", 10, 16, DOWN, "pentry", "stand", "diskmaskinen", find("dishwasher", 10, 17));
  add("server", 15, 7, UP, "server", "stand", "serverracket", find("server_rack", 15, 6));
  add("arcade", 19, 7, UP, "server", "stand", "arkadmaskinen", find("arcade", 19, 6));
  add("toilet", 11, 19, DOWN, "rwc", "sit", "toaletten", find("toilet", 11, 19));
  add("toilet", 10, 25, DOWN, "wc", "sit", "toaletten", find("toilet", 10, 25));
  add("whiteboard", 23, 1, UP, "kontor1", "stand", "whiteboarden i Kontor Norr");
  add("whiteboard", 27, 26, UP, "kontor3", "stand", "whiteboarden i storkontoret");
  add("whiteboard", 25, 46, UP, "mote_stor", "stand", "whiteboarden i stora mötesrummet");
  add("tv", 30, 46, UP, "mote_stor", "stand", "tv:n i stora mötesrummet");
  add("tv", 14, 58, UP, "mote_rund", "stand", "tv:n i runda mötesrummet");
  add("kakelugn", 22, 14, LEFT, "kontor2", "stand", "kakelugnen i burspråkskontoret", find("kakelugn", 21, 13));
  add("kakelugn", 9, 44, LEFT, "hall", "stand", "kakelugnen i entrén", find("kakelugn", 8, 44));
  add("coatrack", 9, 37, LEFT, "hall", "stand", "hatthyllan", find("coat_rack", 8, 35));
  add("phone", 8, 49, RIGHT, "samtal", "sit", "samtalsfåtöljen");
  add("entrance", 8, 33, LEFT, "hall", "stand", "entrédörren");
  // Fönster
  add("window", 1, 9, LEFT, "pentry", "stand", "pentryfönstret");
  add("window", 32, 5, RIGHT, "kontor1", "stand", "balkongdörren i Kontor Norr");
  add("window", 36, 19, RIGHT, "kontor2", "stand", "burspråket");
  add("window", 31, 30, RIGHT, "kontor3", "stand", "fönstret i storkontoret");
  add("window", 31, 36, RIGHT, "kontor3", "stand", "fönstret i storkontoret");
  add("window", 35, 53, RIGHT, "mote_stor", "stand", "burspråket i stora mötesrummet");
  add("window", 7, 68, LEFT, "mote_rund", "stand", "burspråket i runda mötesrummet");
  // Balkongen
  add("balcony", 29, 77, DOWN, "balkong", "stand", "Kungsbalkongens räcke");
  add("balcony", 31, 77, DOWN, "balkong", "stand", "Kungsbalkongens räcke");
  add("balcony", 33, 76, DOWN, "balkong", "stand", "Kungsbalkongens räcke");
  // Växter (stå bredvid och prata)
  for (const q of f.filter((q) => q.kind === "plant" || q.kind === "big_plant")) {
    const cands: [number, number, Dir][] = [
      [q.x, q.y + 1, UP],
      [q.x - 1, q.y, RIGHT],
      [q.x + 1, q.y, LEFT],
      [q.x, q.y - 1, DOWN],
    ];
    s.push({ id: `plant_${n++}`, kind: "plant", x: cands[0][0], y: cands[0][1], face: cands[0][2], room: q.room, pose: "stand", label: "krukväxten", furn: q.id });
    (s[s.length - 1] as Spot & { alts?: [number, number, Dir][] }).alts = cands;
  }
  return s;
}

let cached: OfficeMap | null = null;

export function buildMap(): OfficeMap {
  if (cached) return cached;
  const w = MAP_W;
  const h = MAP_H;
  const tiles = new Uint8Array(w * h);
  const room = new Int8Array(w * h).fill(-1);

  // 1) Rastrera rum
  for (let ty = 0; ty < h; ty++) {
    for (let tx = 0; tx < w; tx++) {
      const px = OX + tx * PLAN_PX + PLAN_PX / 2;
      const py = OY + ty * PLAN_PX + PLAN_PX / 2;
      for (let r = 0; r < ROOMS.length; r++) {
        if (ROOMS[r].shapes.some((s) => inShape(px, py, s))) {
          tiles[ty * w + tx] = T_FLOOR;
          room[ty * w + tx] = r;
          break;
        }
      }
    }
  }
  // 2) Väggar mellan rum i olika zoner (om de råkar ligga kant i kant)
  for (let ty = 0; ty < h; ty++) {
    for (let tx = 0; tx < w; tx++) {
      const i = ty * w + tx;
      if (room[i] < 0) continue;
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const nx = tx + dx;
        const ny = ty + dy;
        if (nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (room[j] >= 0 && ROOMS[room[j]].zone !== ROOMS[room[i]].zone) {
          tiles[j] = T_VOID;
          room[j] = -1;
        }
      }
    }
  }
  // 3) Dörrar
  for (const d of DOORS) {
    for (const [x, y] of d.tiles) {
      tiles[y * w + x] = T_DOOR;
      room[y * w + x] = ROOM_INDEX[d.a];
    }
  }
  // 4) Väggar runt allt golv
  for (let ty = 0; ty < h; ty++) {
    for (let tx = 0; tx < w; tx++) {
      const i = ty * w + tx;
      if (tiles[i] !== T_VOID) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++)
        for (let dx = -1; dx <= 1 && !near; dx++) {
          const nx = tx + dx;
          const ny = ty + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const t = tiles[ny * w + nx];
          if (t === T_FLOOR || t === T_DOOR) near = true;
        }
      if (near) tiles[i] = T_WALL;
    }
  }
  // 5) Fönster
  for (let ty = 0; ty < h; ty++) {
    for (let tx = 0; tx < w; tx++) {
      const i = ty * w + tx;
      if (tiles[i] !== T_WALL) continue;
      const px = OX + tx * PLAN_PX + PLAN_PX / 2;
      const py = OY + ty * PLAN_PX + PLAN_PX / 2;
      if (WINDOW_RECTS.some(([x0, y0, x1, y1]) => px >= x0 && px <= x1 && py >= y0 && py <= y1)) tiles[i] = T_WINDOW;
    }
  }

  const furniture = furnitureList();
  const blocked = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) blocked[i] = tiles[i] === T_FLOOR || tiles[i] === T_DOOR ? 0 : 1;
  for (const q of furniture) {
    if (!q.solid || q.wall || q.overhead) continue;
    for (let y = q.y; y < q.y + q.h; y++) for (let x = q.x; x < q.x + q.w; x++) blocked[y * w + x] = 1;
  }
  const spots = spotList(furniture);
  cached = { w, h, tiles, room, blocked, furniture, spots, doors: DOORS };
  return cached;
}

export function roomAt(m: OfficeMap, x: number, y: number): RoomInfo | null {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return null;
  const r = m.room[ty * m.w + tx];
  return r >= 0 ? ROOMS[r] : null;
}

export function isWalkable(m: OfficeMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= m.w || y >= m.h) return false;
  return m.blocked[y * m.w + x] === 0;
}
