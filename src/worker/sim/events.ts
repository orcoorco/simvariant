// Världshändelser, tidsstyrda händelser, NPC-besök, åskådarnas "pokes" och dörrklockan.
import type { RoomId } from "../../shared/map.ts";
import * as A from "./activities.ts";
import { vacuumBumps } from "./brain.ts";
import {
  ARCADE_VOICE,
  BENGT_VOICE,
  COFFEE_FIX,
  COFFEE_MACHINE_VOICE,
  COURIER_LINES,
  ELEVATOR_VOICE,
  FRIDAY_LINES,
  GUNNAR_LINES,
  HEADLINES,
  LEET,
  MORNING_LINES,
  MYSTERY_BOX,
  POKE_VOICE,
  REACT,
  SERVER_VOICE,
  STRINDBERG_LINES,
  WHITEBOARD_SKETCHES,
  WORLD_EVENT_TEXT,
  chance,
  fill,
  pick,
} from "./content.ts";
import * as S from "./schemes.ts";
import { PLAYABLE, TRACK_BY_ID } from "../../shared/music.ts";
import { dist, type Char, type Npc, type Step, type World } from "./world.ts";

const R = (a: number, b: number) => a + Math.random() * (b - a);

function freeChars(w: World) {
  return w.chars.filter((c) => w.interruptible(c));
}

function npc(w: World, id: string) {
  return w.npcById.get(id)!;
}

function show(w: World, n: Npc, x: number, y: number, dur: number) {
  n.x = x;
  n.y = y;
  n.visible = true;
  n.until = w.time + dur;
  n.queue = [];
  n.step = null;
  n.path = [];
}

// ---------------------------------------------------------------------------
// Besökare
export function summonStrindberg(w: World): boolean {
  const n = npc(w, "strindberg");
  if (n.visible) return false;
  show(w, n, 5.5, 33.5, 70);
  w.addLog("En man med vilt hår och mustasch kliver in från trapphuset. Det är... August S. från Intima Teatern?!", "🎭", "secret");
  w.sound("bell");
  const steps: Step[] = [{ t: "go", x: 12, y: 36 }];
  for (const l of [...STRINDBERG_LINES].sort(() => Math.random() - 0.5).slice(0, 3)) steps.push({ t: "say", text: l, style: "shout", wait: 4.5 });
  steps.push({ t: "do", fn: (w, a) => w.stimulus(a, "dramatic", 0.8, { radius: 12, max: 4 }) });
  steps.push({ t: "say", text: "Adjö! Jag har en pjäs att skriva. Om er.", log: true, wait: 2 }, { t: "go", x: 5, y: 33 }, { t: "do", fn: (_w, a) => void ((a as Npc).visible = false) });
  w.assign(n, steps);
  return true;
}

export function summonGhost(w: World): boolean {
  const n = npc(w, "spoket");
  if (n.visible) return false;
  show(w, n, 9.5, 44.5, 45);
  w.addLog("Ett kallt drag sveper genom entrén. Spöket från Stora Barnhuset har vaknat.", "👻", "secret", undefined, "Entrén");
  w.fx("smoke", 8.5, 43.5, 3, 2);
  return true;
}

export function summonPigeon(w: World): boolean {
  const n = npc(w, "gunnar");
  show(w, n, 31.5, 77.5, 90);
  w.addLog("Duvan Gunnar har landat på Kungsbalkongen och tittar in med dömande blick.", "🐦", "world", undefined, "Kungsbalkongen");
  w.later(2, () => w.say(n, pick(GUNNAR_LINES)));
  const c = freeChars(w).sort(() => Math.random() - 0.5)[0];
  if (c && chance(0.6)) w.interrupt(c, [{ t: "say", text: pick(["GUNNAR ÄR HÄR!", "Duvan! Den är tillbaka!", "Ska vi ge Gunnar en smula?"]), style: "shout", log: true }, ...A.balcony(w, c, "Gunnar! Du är vår maskot!")]);
  return true;
}

export function callVacuum(w: World, target: Char): boolean {
  const n = npc(w, "dammbert");
  n.visible = true;
  n.until = 0;
  w.assign(n, [{ t: "say", text: "BEEP BOOP. KOMMER." }, { t: "toChar", id: target.id }, { t: "say", text: "BEEP. HÄR ÄR JAG. VAD VILL DU?" }, { t: "wait", dur: 4 }]);
  return true;
}

export function doorbell(w: World, by: string): boolean {
  const n = npc(w, "budet");
  if (n.visible) return false;
  w.sound("bell");
  w.addLog(`Det ringer på dörren! (${by})`, "🔔", "world", undefined, "Entrén");
  show(w, n, 5.5, 32.5, 60);
  const c = freeChars(w).sort((a, b) => dist(a, { x: 9, y: 33 }) - dist(b, { x: 9, y: 33 }))[0];
  const box = pick(MYSTERY_BOX);
  w.assign(n, [{ t: "go", x: 6, y: 33 }, { t: "face", dir: 3 }, { t: "say", text: pick(COURIER_LINES), wait: 6 }, { t: "wait", dur: 12 }]);
  for (const o of w.chars) if (o !== c && dist(o, { x: 9, y: 33 }) < 15 && chance(0.3)) w.later(R(0.5, 2), () => w.say(o, pick(["Vem är det?", "Har någon beställt något?", "Jag öppnar inte. Det kan vara en kund.", "DÖRREN!"])));
  if (c) {
    w.interrupt(c, [
      { t: "say", text: "Jag tar det!", wait: 0.2 },
      { t: "go", x: 8, y: 33, run: true },
      { t: "face", dir: 2 },
      { t: "say", text: "Hej! Vad är det för paket?", wait: 2 },
      { t: "item", item: "kartong", dur: 30 },
      { t: "anim", anim: "think", dur: 2 },
      {
        t: "do",
        fn: (w) => {
          w.say(c, `Det är... ${box}?!`, "shout", { log: "force" });
          w.fx("question", c.x, c.y - 1.6, 2);
          w.stimulus(c, "generic", 0.7, { max: 3 });
          w.later(2, () => n.until = w.time + 1);
        },
      },
      { t: "anim", anim: "idle", dur: 3 },
    ]);
  }
  return true;
}

// ---------------------------------------------------------------------------
// Slumpmässiga världshändelser
type Ev = [number, (w: World) => boolean];

const EVENTS: Ev[] = [
  [
    1.2,
    (w) => {
      if (w.coffeeBroken) return false;
      w.coffeeBroken = true;
      w.worldDirty = true;
      w.fx("explosion", 19.5, 17.6, 2, 2);
      w.fx("smoke", 19.5, 17.4, 6, 3);
      w.sound("boing");
      w.addLog("PANG! Kaffemaskinen har gått sönder.", "💥", "world", undefined, "Passagen");
      const k = npc(w, "kaffemaskinen");
      w.later(1.5, () => w.say(k, "*gurgel* ...hjälp...", "whisper"));
      const near = w.chars.filter((c) => dist(c, k) < 9);
      for (const c of near.slice(0, 2)) w.later(R(0.5, 2), () => w.say(c, pick(REACT.explosion), "shout"));
      // Någon lagar den efter ett tag
      w.later(R(45, 90), () => {
        const fixer = w.byId.get("rhoda") && w.interruptible(w.byId.get("rhoda")!) ? w.byId.get("rhoda")! : freeChars(w)[0];
        if (!fixer) {
          w.coffeeBroken = false;
          w.worldDirty = true;
          return;
        }
        w.interrupt(fixer, [
          { t: "say", text: "Jag fixar kaffemaskinen. Ingen panik.", log: true },
          { t: "spot", kind: "coffee", run: true },
          { t: "anim", anim: "type", dur: 5, act: "Lagar kaffemaskinen", icon: "🔧" },
          {
            t: "do",
            fn: (w) => {
              w.coffeeBroken = false;
              w.worldDirty = true;
              w.say(fixer, pick(COFFEE_FIX), "say", { log: "force" });
              w.fx("sparkle", 19.5, 17.5, 2, 2);
              w.sound("tada");
              for (const o of w.chars) if (o !== fixer) w.relate(o, fixer, 3);
            },
          },
          { t: "leave" },
        ]);
      });
      return true;
    },
  ],
  [
    0.8,
    (w) => {
      const k = npc(w, "kaffemaskinen");
      w.say(k, pick(COFFEE_MACHINE_VOICE), "shout");
      w.addLog("Kaffemaskinen har fått medvetande. Igen.", "☕", "world", undefined, "Passagen");
      for (const c of w.chars.filter((c) => dist(c, k) < 8).slice(0, 2)) w.later(R(1, 2.5), () => w.say(c, pick(["Pratade kaffemaskinen just?!", "Jag hörde ingenting.", "Det är dags att avkalka den.", "Den har rätt, faktiskt."])));
      return true;
    },
  ],
  [
    0.7,
    (w) => {
      if (!w.lights) return false;
      w.lights = false;
      w.worldDirty = true;
      w.addLog(WORLD_EVENT_TEXT.power[0], "⚡", "world");
      for (const c of w.chars.slice().sort(() => Math.random() - 0.5).slice(0, 4)) w.later(R(0.5, 3), () => w.say(c, pick(["Vem släckte?!", "AAAH!", "Min Figma! Ojdå, den är i molnet.", "Är det här en workshopövning?", "Någon har ett stearinljus?"]), "shout"));
      w.later(12, () => {
        w.lights = true;
        w.worldDirty = true;
        w.addLog(WORLD_EVENT_TEXT.power[1], "💡", "world");
      });
      return true;
    },
  ],
  [0.6, (w) => S.firedrill(w)],
  [1, (w) => summonPigeon(w)],
  [0.7, (w) => doorbell(w, "ett bud")],
  [
    0.9,
    (w) => {
      w.addLog(WORLD_EVENT_TEXT.wifi[0], "📶", "world");
      const list = freeChars(w).slice(0, 7);
      for (const c of list) {
        const win = w.findSpot("window", c);
        w.interrupt(c, [
          { t: "say", text: pick(["WI-FI:T!", "Jag har ingen täckning!", "Håll upp laptopen mot fönstret!", "Är det här slutet?"]), style: "shout" },
          { t: "item", item: "laptop", dur: 20 },
          ...(win ? ([{ t: "go", x: win.x, y: win.y, run: true }] as Step[]) : []),
          { t: "anim", anim: "cheer", dur: 6, act: "Letar Wi-Fi med laptopen", icon: "📶" },
          { t: "item", item: null },
        ]);
      }
      w.later(16, () => w.addLog(WORLD_EVENT_TEXT.wifi[1], "📶", "world"));
      return true;
    },
  ],
  [
    0.7,
    (w) => {
      w.addLog(WORLD_EVENT_TEXT.smell[0], "🐟", "world", undefined, "Pentryt");
      for (const c of w.charsInRoom("pentry")) {
        const p = w.randomTileIn(pick(["passage", "hall"] as RoomId[]));
        if (c.ctrl !== "player" && !c.schemeId) w.interrupt(c, [{ t: "say", text: pick(["Vem har micrat fisk?!", "Jag kan inte andas!", "Evakuera pentryt!"]), style: "shout" }, ...(p ? ([{ t: "go", x: p.x, y: p.y, run: true, moveAnim: "panic" }] as Step[]) : [])]);
      }
      w.fx("smoke", 7, 12, 6, 2);
      w.later(8, () => w.addLog(WORLD_EVENT_TEXT.smell[1], "🐟", "world"));
      return true;
    },
  ],
  [
    0.8,
    (w) => {
      w.addLog(WORLD_EVENT_TEXT.figma[0], "💥", "world");
      for (const c of w.chars.filter((c) => c.anim === "type").slice(0, 5)) w.later(R(0.2, 2), () => w.say(c, pick(["FIGMA ÄR NERE!", "Mina komponenter!", "Okej, jag går och tar en kaffe.", "Det här är det bästa som hänt idag."]), "shout"));
      w.later(15, () => w.addLog(WORLD_EVENT_TEXT.figma[1], "✅", "world"));
      return true;
    },
  ],
  [0.6, (w) => S.fika(w, null, WORLD_EVENT_TEXT.baked[0])],
  [
    0.7,
    (w) => {
      w.addLog(WORLD_EVENT_TEXT.client[0], "🕴️", "world");
      for (const c of freeChars(w).slice(0, 8)) {
        const p = w.randomTileIn(pick(["hall", "passage", "kontor3", "lounge"] as RoomId[]));
        w.interrupt(c, [{ t: "say", text: pick(["STÄDA!", "Göm post-itsen!", "Ser det professionellt ut?!", "Var är min kavaj?!"]), style: "shout" }, ...(p ? ([{ t: "go", x: p.x, y: p.y, run: true }] as Step[]) : []), { t: "anim", anim: "panic", dur: 2 }]);
      }
      w.later(12, () => {
        w.addLog(WORLD_EVENT_TEXT.client[1], "🐦", "world");
        summonPigeon(w);
      });
      return true;
    },
  ],
  [
    0.6,
    (w) => {
      w.plantSize = Math.min(4, w.plantSize + 0.06);
      w.worldDirty = true;
      w.addLog("Krukväxten Bengt har vuxit 3 cm. Ingen vet hur.", "🌿", "world", undefined, "Entrén");
      w.fx("sparkle", 17.5, 31.5, 2, 1);
      return true;
    },
  ],
  [
    0.5,
    (w) => {
      const h = npc(w, "hissen");
      w.say(h, pick(ELEVATOR_VOICE), "say");
      w.sound("ding");
      w.addLog("Hissen plingade. Ingen kom ut.", "🛗", "world", undefined, "Trapphuset");
      return true;
    },
  ],
  [
    0.5,
    (w) => {
      w.addLog(WORLD_EVENT_TEXT.demo[0], "📢", "world");
      for (const c of freeChars(w).slice(0, 4)) {
        const win = w.findSpot("window", c);
        if (win) w.interrupt(c, [{ t: "go", x: win.x, y: win.y }, { t: "anim", anim: "think", dur: 4 }, { t: "say", text: pick(["Vad ropar de?", "Jag tror de vill ha bättre UX!", "Är det en kör?"]) }]);
      }
      w.later(14, () => w.addLog(WORLD_EVENT_TEXT.demo[1], "🎶", "world"));
      return true;
    },
  ],
  [
    0.5,
    (w) => {
      const weathers = ["sol", "moln", "regn", "sno"] as const;
      const next = pick(weathers.filter((x) => x !== w.weather));
      w.weather = next;
      w.worldDirty = true;
      w.addLog(next === "sno" ? "Det har börjat snöa över Norra Bantorget." : next === "regn" ? "Regnet smattrar mot fönstren." : next === "sol" ? "Solen tittar fram över Barnhusgatan!" : "Molnen drar in över Stockholm.", next === "sno" ? "❄️" : next === "regn" ? "🌧️" : next === "sol" ? "☀️" : "☁️", "world");
      return true;
    },
  ],
  [
    0.35,
    (w) => {
      const sara = w.byId.get("sara_d");
      const text = pick(HEADLINES);
      w.banner = text;
      w.bannerUntil = w.time + 40;
      w.worldDirty = true;
      w.addLog(`Löpsedel: ${text}`, "📰", "world");
      if (sara && w.interruptible(sara)) w.interrupt(sara, [{ t: "say", text, style: "shout" }, { t: "anim", anim: "point", dur: 2 }]);
      return true;
    },
  ],
  [
    0.5,
    (w) => {
      const v = npc(w, "dammbert");
      if (!v.visible || w.activeBig()) return false;
      const track = pick(PLAYABLE.filter((t) => t !== w.music.track));
      w.assign(v, [
        { t: "go", x: 21, y: 61 },
        { t: "say", text: "*BONK*" },
        {
          t: "do",
          fn: (w, a) => {
            w.addLog(`Dammbert körde in i jukeboxen. Den bytte till ${TRACK_BY_ID[track].name}.`, "🤖", "world", undefined, "Loungen");
            w.setMusic(a, track, { log: false });
            w.fx("notes", 20.5, 60.2, 2.5, 2);
          },
        },
        { t: "say", text: "BEEP. DAMMBERT ÄR DJ NU." },
        { t: "wait", dur: 3 },
      ]);
      return true;
    },
  ],
  [0.25, (w) => summonStrindberg(w)],
  [0.25, (w) => (w.nightFactor() > 0.5 || chance(0.3) ? summonGhost(w) : false)],
];

function runRandomEvent(w: World) {
  const total = EVENTS.reduce((s, e) => s + e[0], 0);
  for (let tries = 0; tries < 5; tries++) {
    let r = Math.random() * total;
    for (const [wgt, fn] of EVENTS) {
      r -= wgt;
      if (r <= 0) {
        if (fn(w)) return;
        break;
      }
    }
  }
}

function once(w: World, key: string): boolean {
  const k = `${w.clock.month}-${w.clock.day}-${key}`;
  if (w.firedToday.has(k)) return false;
  w.firedToday.add(k);
  if (w.firedToday.size > 200) w.firedToday = new Set([...w.firedToday].slice(-50));
  return true;
}

function timeTriggers(w: World) {
  const { hour, minute, weekday } = w.clock;
  const weekend = weekday === "lördag" || weekday === "söndag";
  const fri = weekday === "fredag";
  if (hour === 8 && minute >= 30 && once(w, "morning")) {
    const c = freeChars(w)[0];
    if (c) w.say(c, pick(MORNING_LINES), "say", { log: true });
  }
  if (!weekend && hour === 9 && minute >= 15 && minute < 30 && once(w, "standup")) S.standup(w, null);
  if (hour === 11 && minute >= 30 && once(w, "lunch")) {
    w.addLog("Klockan är halv tolv. Lunchrusningen mot pentryt har börjat.", "🍱", "event", undefined, "Pentryt");
    for (const c of w.chars) c.needs.hunger = Math.max(c.needs.hunger, 70 + Math.random() * 30);
  }
  if (hour === 13 && minute === 37 && once(w, "leet")) {
    const c = pick(w.chars);
    w.say(c, pick(LEET), "shout", { log: "force" });
    w.fx("stars", c.x, c.y - 1.5, 2.5, 2);
  }
  if (fri && hour === 15 && minute < 30 && once(w, "fredagsfika")) {
    S.fika(w, null, "FREDAGSFIKA! Alla till pentryt!");
    const c = freeChars(w)[0];
    if (c) w.say(c, pick(FRIDAY_LINES), "shout");
  }
  if (fri && hour === 17 && minute < 30 && once(w, "aw")) {
    const dj = freeChars(w).sort((a, b) => b.c.traits.drama - a.c.traits.drama)[0];
    if (dj) {
      w.addLog("Fredag kväll – AW-läge aktiverat!", "🍻", "event");
      S.rave(w, dj, "lounge");
    }
  }
  if ((hour === 0 || hour === 3) && minute < 10 && once(w, `ghost${hour}`)) summonGhost(w);
}

export function worldTick(w: World, dt: number) {
  if (w.time >= w.nextWorldEvent) {
    w.nextWorldEvent = w.time + R(70, 150);
    if (!w.activeBig() || chance(0.4)) runRandomEvent(w);
  }
  if (Math.floor(w.time) !== Math.floor(w.time - dt)) {
    if (Math.floor(w.time) % 10 === 0) timeTriggers(w);
    if (Math.floor(w.time) % 2 === 0) vacuumBumps(w);
  }
}

// ---------------------------------------------------------------------------
// Åskådarnas klick på föremål
export function poke(w: World, what: string): boolean {
  const now = w.time;
  const pc = w.pokeCounts.get(what) ?? { n: 0, t: now };
  if (now - pc.t > 20) {
    pc.n = 0;
    pc.t = now;
  }
  pc.n++;
  w.pokeCounts.set(what, pc);
  const speak = (id: string, text: string, style: "say" | "shout" | "whisper" = "say") => {
    const n = w.npcById.get(id);
    if (n) w.say(n, text, style);
  };
  switch (what) {
    case "coffee_machine":
      if (pc.n >= 5) {
        pc.n = 0;
        speak("kaffemaskinen", pick(COFFEE_MACHINE_VOICE), "shout");
        w.addLog("Någon petade på kaffemaskinen för många gånger. Den svarade.", "☕", "secret");
      } else {
        w.fx("steam", 19.5, 17.5, 1.5, 1);
      }
      return true;
    case "plant":
    case "big_plant":
      speak("bengt", pick(BENGT_VOICE), "whisper");
      if (pc.n >= 7) {
        pc.n = 0;
        w.plantSize = Math.min(4, w.plantSize + 0.08);
        w.worldDirty = true;
        w.fx("sparkle", 17.5, 31, 2, 2);
        w.addLog("Bengt växte av all uppmärksamhet.", "🌿", "secret");
      }
      return true;
    case "server_rack":
      speak("servern", pick(SERVER_VOICE));
      return true;
    case "arcade":
      speak("arkaden", pick(ARCADE_VOICE));
      return true;
    case "elevator":
      speak("hissen", pick(ELEVATOR_VOICE));
      w.sound("ding");
      return true;
    case "window":
    case "outside":
      w.fx("feathers", 33, 40 + Math.random() * 20, 2, 1);
      if (chance(0.3)) w.addLog(pick(["En mås skriker utanför fönstret.", "Någon på Norra Bantorget vinkar upp mot kontoret.", "En spårvagn som inte borde finnas här plingar förbi."]), "🪟", "secret");
      return true;
    case "kakelugn":
      if (pc.n >= 4 && w.nightFactor() > 0.3) {
        pc.n = 0;
        summonGhost(w);
      } else {
        const o = w.npcById.get("objekt")!;
        o.x = 8.5;
        o.y = 43.3;
        w.say(o, pick(POKE_VOICE.kakelugn), "whisper");
        w.fx("smoke", 8.5, 43.2, 2, 1);
      }
      return true;
    default: {
      const lines = POKE_VOICE[what] ?? POKE_VOICE.default;
      const f = w.map.furniture.find((q) => q.kind === what);
      const o = w.npcById.get("objekt")!;
      if (f) {
        o.x = f.x + f.w / 2;
        o.y = f.y + 0.2;
      }
      w.say(o, fill(pick(lines), { clock: w.worldState().clock, sketch: pick(WHITEBOARD_SKETCHES), track: TRACK_BY_ID[w.music.track].name }), "say");
      return true;
    }
  }
}
