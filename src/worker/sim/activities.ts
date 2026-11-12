// Aktivitetsbiblioteket: färdiga handlingskedjor (används av AI, scheman och spelarkommandon).
import type { RoomId, SpotKind } from "../../shared/map.ts";
import {
  ARCADE_LINES,
  BALCONY_SPEECHES,
  COFFEE_BROKEN,
  COFFEE_LINES,
  COFFEE_OVERLOAD,
  DRAMATIC_NAP,
  EAT_LINES,
  FRUIT_LINES,
  HEADLINES,
  KAKELUGN_LINES,
  MUG_ACCUSE,
  MUG_DENY,
  MUG_FOUND,
  MUG_MISSING,
  NAP_LINES,
  PHONE_LINES,
  PLANT_REPLIES,
  PLANT_TALK,
  PRINTER_LINES,
  QUIRK,
  SEEK_INSPIRATION,
  SERVER_LINES,
  TOILET_LINES,
  WANDER_THOUGHTS,
  WATER_LINES,
  WHITEBOARD_SKETCHES,
  WINDOW_THOUGHTS,
  WORK_THOUGHTS,
  chance,
  fill,
  pick,
} from "./content.ts";
import { localAnswer } from "./dialogue.ts";
import { MUSIC_PICK } from "./content.ts";
import { PLAYABLE, TRACK_BY_ID, type TrackId } from "../../shared/music.ts";
import * as S from "./schemes.ts";
import { dist, type Char, type Step, type World } from "./world.ts";

const R = (a: number, b: number) => a + Math.random() * (b - a);

export function coffee(w: World, c: Char): Step[] {
  if (c.mugHidden && chance(0.75)) return searchMug(w, c);
  return [
    { t: "act", act: "Går och hämtar kaffe", icon: "☕" },
    { t: "spot", kind: "coffee", label: "Gå till kaffemaskinen" },
    {
      t: "do",
      fn: (w) => {
        if (w.coffeeBroken) return { replace: brokenCoffee(w, c) };
        const others = w.chars.filter((o) => o !== c && dist(o, c) < 3.2 && w.interruptible(o));
        if (others.length && c.ctrl === "ai" && chance(0.2 + c.c.traits.kaos * 0.35) && !w.activeBig()) {
          if (S.debate(w, c, others)) return { replace: [] };
        }
      },
    },
    { t: "anim", anim: "idle", dur: 2.2, act: "Brygger kaffe", label: "Brygga kaffe" },
    { t: "fx", fx: "steam", at: [19.5, 17.6], dur: 2.2, n: 2 },
    { t: "item", item: "kaffe", dur: 80 },
    { t: "needs", d: { koffein: 45, energi: 6 } },
    {
      t: "do",
      fn: (w) => {
        c.coffees++;
        w.stats.kaffe++;
        w.worldDirty = true;
        if (c.needs.koffein > 135) {
          w.addLog(`${c.name} har druckit ${c.coffees} koppar kaffe och ser ljud.`, "⚡", "chaos", c.id);
          return { replace: overload(w, c) };
        }
        if (chance(0.45)) w.say(c, fill(pick(COFFEE_LINES), { n: String(c.coffees) }));
      },
    },
    { t: "anim", anim: "drink", dur: 2.4, label: "Dricka kaffe" },
    { t: "leave" },
  ];
}

export function overload(w: World, c: Char): Step[] {
  const steps: Step[] = [{ t: "effect", effect: "sparkle", dur: 18 }, { t: "act", act: "Koffeinchock!", icon: "⚡" }];
  const rooms: RoomId[] = ["passage", "hall", "kontor3", "mote_stor", "pentry", "korridor"];
  for (let i = 0; i < 4; i++) {
    const p = w.randomTileIn(pick(rooms));
    if (p) steps.push({ t: "go", x: p.x, y: p.y, run: true, moveAnim: "panic", speed: 7.5 });
    if (i % 2 === 0) steps.push({ t: "say", text: pick(COFFEE_OVERLOAD), style: "shout", log: true });
  }
  steps.push({
    t: "do",
    fn: (w) => {
      w.stimulus(c, "panic", 0.8);
      c.needs.koffein = 70;
      c.needs.kaos = Math.min(100, c.needs.kaos + 20);
    },
  });
  steps.push({ t: "anim", anim: "sleep", pose: "lie", dur: 6, act: "Har landat" }, { t: "anim", anim: "idle", pose: "stand", dur: 0.5 });
  return steps;
}

export function brokenCoffee(w: World, c: Char): Step[] {
  return [
    { t: "fx", fx: "smoke", at: [19.5, 17.5], dur: 3, n: 2 },
    { t: "anim", anim: "panic", dur: 2.5, act: "Kaffemaskinen är trasig!", icon: "💥" },
    { t: "say", text: pick(COFFEE_BROKEN), style: "shout", log: true },
    { t: "do", fn: (w) => w.stimulus(c, "panic", 0.6) },
    { t: "anim", anim: "cry", dur: 3 },
    { t: "leave" },
  ];
}

export function searchMug(w: World, c: Char): Step[] {
  const mh = c.mugHidden!;
  const steps: Step[] = [
    { t: "act", act: "Letar efter sin kopp", icon: "❓" },
    { t: "anim", anim: "panic", dur: 1.5 },
    { t: "say", text: pick(MUG_MISSING), style: "shout", log: true },
  ];
  const decoys: SpotKind[] = ["fridge", "sink", "coffee", "sofa", "printer"];
  const d = w.findSpot(pick(decoys), c);
  if (d) steps.push({ t: "go", x: d.x, y: d.y }, { t: "anim", anim: "think", dur: 1.5 }, { t: "say", text: "Inte här...", wait: 0.3 });
  steps.push({ t: "go", x: mh.x, y: mh.y, run: chance(0.4) });
  steps.push({
    t: "do",
    fn: (w) => {
      w.say(c, fill(pick(MUG_FOUND), { place: mh.place }), "shout", { log: "force" });
      w.fx("exclaim", c.x, c.y - 1.6, 1.5);
      const culprit = w.byId.get(mh.by);
      c.mugHidden = null;
      c.item = "kopp";
      c.itemUntil = w.time + 60;
      w.remember(c, `hittade min kopp ${mh.place}`);
      if (culprit && chance(0.6)) {
        // anklaga någon (inte alltid rätt person)
        const suspects = w.chars.filter((o) => o !== c && dist(o, c) < 10);
        const accused = chance(0.5) || !suspects.length ? culprit : pick(suspects);
        w.later(2.5, () => {
          w.say(c, fill(pick(MUG_ACCUSE), { name: accused.name }), "shout", { log: "force" });
          w.relate(c, accused, -8);
          w.later(2.2, () => {
            if (accused === culprit && chance(0.5)) w.say(accused, "...okej, det var jag. Det var ett socialt experiment.", "say", { log: "force" });
            else w.say(accused, pick(MUG_DENY), "say", { log: true });
          });
        });
      }
    },
  });
  steps.push({ t: "anim", anim: "drink", dur: 2 });
  return steps;
}

export function eat(w: World, c: Char): Step[] {
  return [
    { t: "act", act: "Hungrig – på väg till pentryt", icon: "🍱" },
    { t: "spot", kind: "fridge", label: "Gå till kylskåpet" },
    { t: "anim", anim: "idle", dur: 1.5, act: "Letar i kylen" },
    { t: "spot", kind: "stove" },
    { t: "anim", anim: "idle", dur: 2.5, act: "Micrar matlådan" },
    { t: "do", fn: (w) => (chance(0.15) ? (w.say(c, "PIIP PIIP PIIP. Varför piper mikron alltid tre gånger?"), undefined) : undefined) },
    { t: "spot", kind: ["dining", "sofa", "armchair"], label: "Sätta sig och äta" },
    { t: "anim", anim: "eat", dur: R(9, 14), act: "Äter lunch", icon: "🍱" },
    { t: "do", fn: (w) => (chance(0.4) ? (w.say(c, pick(EAT_LINES)), undefined) : undefined) },
    { t: "needs", d: { hunger: -100, energi: 12, socialt: 8 } },
    { t: "anim", anim: "sit", dur: R(2, 5) },
    { t: "leave" },
  ];
}

export function fruit(w: World, c: Char): Step[] {
  return [
    { t: "spot", kind: "fruit", label: "Gå till fruktskålen" },
    { t: "item", item: "banan", dur: 12 },
    { t: "anim", anim: "eat", dur: 3, act: "Äter en banan", icon: "🍌" },
    { t: "do", fn: (w) => (chance(0.35) ? (w.say(c, pick(FRUIT_LINES)), undefined) : undefined) },
    { t: "needs", d: { hunger: -25 } },
    { t: "item", item: null },
    { t: "leave" },
  ];
}

export function water(w: World, c: Char): Step[] {
  return [
    { t: "spot", kind: "water", label: "Gå till vattenautomaten" },
    { t: "item", item: "vatten", dur: 20 },
    { t: "anim", anim: "drink", dur: 2.5, act: "Dricker vatten", icon: "💧" },
    { t: "do", fn: (w) => (chance(0.3) ? (w.say(c, pick(WATER_LINES)), undefined) : undefined) },
    { t: "leave" },
  ];
}

export function work(w: World, c: Char, dur = R(25, 55)): Step[] {
  const flex = !c.homeSpot;
  const steps: Step[] = [
    { t: "act", act: "På väg till skrivbordet", icon: "💻" },
    flex
      ? { t: "spot", kind: ["desk", "sofa", "armchair", "dining", "bench"], label: "Hitta en plats att jobba på" }
      : { t: "spot", kind: "desk", prefer: c.homeSpot!, label: "Gå till skrivbordet" },
  ];
  if (flex) steps.push({ t: "item", item: "laptop", dur: dur + 5 });
  const chunks = Math.max(2, Math.round(dur / 12));
  for (let i = 0; i < chunks; i++) {
    steps.push({ t: "anim", anim: "type", dur: dur / chunks, act: pick(c.c.work), icon: i === 0 ? "💻" : undefined, label: i === 0 ? "Jobba" : undefined });
    steps.push({
      t: "do",
      fn: (w) => {
        c.needs.fokus = Math.min(100, c.needs.fokus + 6);
        if (c.item === "kaffe" && chance(0.5)) return [{ t: "anim", anim: "drink", dur: 1.8 }];
        if (chance(0.18)) w.think(c, pick(WORK_THOUGHTS));
        if (chance(0.015) && (c.cooldown.css ?? 0) < w.time) {
          c.cooldown.css = w.time + 900;
          if (S.cssCrisis(w, c)) return { replace: [] };
        }
      },
    });
  }
  steps.push({ t: "item", item: null }, { t: "leave" });
  return steps;
}

export function nap(w: World, c: Char, dramatic = false): Step[] {
  const room: RoomId | undefined = dramatic ? (chance(0.5) ? "hall" : "lounge") : undefined;
  return [
    { t: "act", act: dramatic ? "Gör en dramatisk tupplur" : "Letar efter en soffa", icon: "😴" },
    ...(dramatic ? ([{ t: "say", text: pick(DRAMATIC_NAP), style: "shout", log: "force" }] as Step[]) : []),
    { t: "spot", kind: ["sofa", "bench"], room, pose: "lie", anim: "sleep", label: "Lägga sig i soffan" },
    { t: "effect", effect: "zzz", dur: dramatic ? 40 : 25 },
    { t: "do", fn: (w) => (chance(0.4) ? (w.say(c, pick(NAP_LINES), "whisper"), undefined) : undefined) },
    { t: "anim", anim: "sleep", pose: "lie", dur: dramatic ? 38 : R(16, 26), act: "Sover", icon: "💤" },
    { t: "needs", d: { energi: 60, kaos: -15 } },
    { t: "do", fn: (w) => (chance(0.3) ? (w.say(c, "*gäsp* Har jag missat något?"), undefined) : undefined) },
    { t: "leave" },
  ];
}

export function toilet(w: World, c: Char): Step[] {
  return [
    { t: "act", act: "Måste gå på toa", icon: "🚽" },
    { t: "spot", kind: "toilet", label: "Gå på toa" },
    { t: "anim", anim: chance(0.3) ? "read" : "sit", dur: R(8, 18), act: "Är på toa", icon: "🚽" },
    { t: "do", fn: (w) => (chance(0.25) ? (w.say(c, pick(TOILET_LINES), "say", { log: true }), undefined) : undefined) },
    { t: "leave" },
  ];
}

export function whiteboard(w: World, c: Char, what?: string): Step[] {
  const sketch = what ?? pick(WHITEBOARD_SKETCHES);
  return [
    { t: "act", act: "Har en idé!", icon: "💡" },
    { t: "spot", kind: "whiteboard", label: "Gå till närmaste whiteboard" },
    { t: "item", item: "postit", dur: 14 },
    { t: "anim", anim: "draw", dur: 5, act: "Ritar på whiteboarden", icon: "🖊️", label: "Rita på whiteboarden" },
    {
      t: "do",
      fn: (w) => {
        w.say(c, `Ta-da! ${sketch.charAt(0).toUpperCase()}${sketch.slice(1).replace(/[.!]+$/, "")}.`, "say", { log: c.ctrl === "player" ? "force" : chance(0.4) });
        w.fx("postits", c.x, c.y - 1.5, 2.5, 2);
        w.stats.ideer++;
        w.worldDirty = true;
        c.needs.inspiration = Math.max(0, c.needs.inspiration - 40);
        w.stimulus(c, "idea", 0.5);
        w.remember(c, `ritade ${sketch}`);
      },
    },
    { t: "anim", anim: "point", dur: 2.5 },
    { t: "item", item: null },
    { t: "leave" },
  ];
}

export function plant(w: World, c: Char): Step[] {
  return [
    { t: "act", act: "Pratar med en krukväxt", icon: "🌱" },
    { t: "spot", kind: "plant", label: "Gå till en krukväxt" },
    { t: "say", text: pick(PLANT_TALK), wait: 2.5 },
    {
      t: "do",
      fn: (w) => {
        c.needs.inspiration = Math.min(100, c.needs.inspiration + 15);
        if (chance(0.35)) {
          const obj = w.npcById.get("objekt");
          if (obj) {
            obj.x = c.x + (c.dir === 3 ? 1 : c.dir === 2 ? -1 : 0);
            obj.y = c.y - (c.dir === 1 ? 1 : 0) - 0.3;
            w.say(obj, pick(PLANT_REPLIES), "whisper");
            w.later(2.5, () => w.say(c, "...hörde ni? Den PRATADE!", "shout", { log: "force" }));
          }
        }
      },
    },
    { t: "anim", anim: "think", dur: 2.5 },
    { t: "leave" },
  ];
}

export function lookOutWindow(w: World, c: Char): Step[] {
  return [
    { t: "act", act: "Tittar ut genom fönstret", icon: "🪟" },
    { t: "spot", kind: "window", label: "Gå till fönstret" },
    { t: "anim", anim: "think", dur: R(4, 8) },
    { t: "do", fn: (w) => w.think(c, pick(WINDOW_THOUGHTS)) },
    { t: "needs", d: { inspiration: 25 } },
    { t: "anim", anim: "idle", dur: 2 },
    { t: "leave" },
  ];
}

export function server(w: World, c: Char): Step[] {
  return [
    { t: "act", act: "Stirrar på servern", icon: "🖥️" },
    { t: "spot", kind: "server", label: "Gå till serverrummet" },
    { t: "anim", anim: "think", dur: R(4, 7) },
    { t: "say", text: pick(SERVER_LINES), style: "whisper" },
    { t: "needs", d: { fokus: 10, inspiration: 10 } },
    { t: "leave" },
  ];
}

export function arcade(w: World, c: Char): Step[] {
  return [
    { t: "act", act: "Spelar på arkadmaskinen", icon: "🕹️" },
    { t: "spot", kind: "arcade", label: "Gå till arkadmaskinen" },
    { t: "anim", anim: "game", dur: R(8, 14) },
    { t: "do", fn: (w) => (w.say(c, pick(ARCADE_LINES), chance(0.3) ? "shout" : "say", { log: true }), undefined) },
    { t: "needs", d: { kaos: -15, inspiration: 10 } },
    { t: "leave" },
  ];
}

export function balcony(w: World, c: Char, speech?: string): Step[] {
  return [
    { t: "act", act: "Går ut på Kungsbalkongen", icon: "🏛️" },
    { t: "spot", kind: "balcony", label: "Gå ut på Kungsbalkongen" },
    { t: "anim", anim: "wave", dur: 2 },
    { t: "say", text: speech ?? pick(BALCONY_SPEECHES), style: "shout", log: "force", wait: 2 },
    { t: "anim", anim: "cheer", dur: 2.5 },
    { t: "do", fn: (w) => (chance(0.4) ? (w.fx("feathers", c.x + 1, c.y, 2), undefined) : undefined) },
    { t: "needs", d: { inspiration: 30, kaos: -20 } },
    { t: "anim", anim: "idle", dur: 2 },
    { t: "leave" },
  ];
}

export function phone(w: World, c: Char): Step[] {
  return [
    { t: "act", act: "Ringer ett samtal", icon: "📞" },
    { t: "spot", kind: ["phone", "armchair"], room: "samtal", label: "Gå till samtalsrummet" },
    { t: "item", item: "telefon", dur: 20 },
    { t: "anim", anim: "phone", dur: 5 },
    { t: "say", text: pick(PHONE_LINES), wait: 3 },
    { t: "anim", anim: "phone", dur: 5 },
    { t: "say", text: pick(PHONE_LINES), wait: 2 },
    { t: "item", item: null },
    { t: "leave" },
  ];
}

export function kakelugn(w: World, c: Char): Step[] {
  return [
    { t: "act", act: "Värmer händerna vid kakelugnen", icon: "🔥" },
    { t: "spot", kind: "kakelugn", label: "Gå till kakelugnen" },
    { t: "anim", anim: "idle", dur: 4 },
    { t: "say", text: pick(KAKELUGN_LINES), style: chance(0.5) ? "whisper" : "say" },
    { t: "do", fn: (w) => (chance(0.2) ? (w.fx("smoke", c.x - 1, c.y - 1, 3), undefined) : undefined) },
    { t: "leave" },
  ];
}

export function printer(w: World, c: Char): Step[] {
  return [
    { t: "act", act: "Skriver ut något", icon: "🖨️" },
    { t: "spot", kind: "printer", label: "Gå till skrivaren" },
    { t: "anim", anim: "idle", dur: 3 },
    {
      t: "do",
      fn: (w) => {
        if (chance(0.5)) {
          w.fx("paper", 19.5, 24, 2.5, 2);
          w.say(c, pick(PRINTER_LINES), "shout", { log: true });
          return [{ t: "anim", anim: "panic", dur: 2 }];
        }
        c.item = "papper";
        c.itemUntil = w.time + 15;
      },
    },
    { t: "leave" },
  ];
}

export function tv(w: World, c: Char): Step[] {
  return [
    { t: "spot", kind: "tv", label: "Gå till tv:n" },
    { t: "anim", anim: "idle", dur: R(4, 8), act: "Tittar på tv", icon: "📺" },
    { t: "say", text: pick(["Vem har satt på Bengt-dokumentären igen?", "Det här är mer spännande än ett kundmöte.", "Spola tillbaka! Dammbert körde in i väggen!"]) },
    { t: "leave" },
  ];
}

export function sofaRead(w: World, c: Char): Step[] {
  return [
    { t: "spot", kind: ["sofa", "armchair", "bench"], label: "Sätta sig i soffan" },
    { t: "item", item: "laptop", dur: 30 },
    { t: "anim", anim: "read", dur: R(12, 24), act: "Läser i soffan", icon: "📖" },
    { t: "needs", d: { energi: 10, inspiration: 10 } },
    { t: "item", item: null },
    { t: "leave" },
  ];
}

export function dishwasher(w: World, c: Char): Step[] {
  return [
    { t: "spot", kind: "dishwasher", label: "Gå till diskmaskinen" },
    { t: "say", text: "Jag... tömmer diskmaskinen.", style: "shout", log: "force" },
    { t: "anim", anim: "idle", dur: 4, act: "Tömmer diskmaskinen", icon: "🍽️" },
    {
      t: "do",
      fn: (w) => {
        w.addLog(`🏆 ${c.name} tömde diskmaskinen. Ett historiskt ögonblick.`, "🏆", "chaos", c.id);
        w.fx("sparkle", c.x, c.y - 1, 3, 3);
        w.stimulus(c, "dramatic", 0.9);
        for (const o of w.chars) if (o !== c) w.relate(o, c, 4);
      },
    },
    { t: "leave" },
  ];
}

export function wander(w: World, c: Char): Step[] {
  const rooms: RoomId[] = ["passage", "hall", "korridor", "kontor3", "mote_stor", "lounge", "pentry"];
  const p = w.randomTileIn(pick(rooms));
  const steps: Step[] = [{ t: "act", act: "Vandrar runt och tänker", icon: "🚶" }];
  if (p) steps.push({ t: "go", x: p.x, y: p.y });
  steps.push({ t: "anim", anim: "think", dur: R(2, 4) });
  if (chance(0.5)) steps.push({ t: "think", text: pick(c.needs.inspiration < 30 ? SEEK_INSPIRATION : WANDER_THOUGHTS) });
  return steps;
}

/** Personlig specialhandling (från konsultdokumentets profil). */
export function quirk(w: World, c: Char): Step[] {
  const q = QUIRK[c.c.quirk];
  const line = pick(q.lines);
  switch (c.c.quirk) {
    case "workshop":
      return [...whiteboard(w, c, "en workshopplan med 47 steg och tre fikapauser").slice(0, 3), { t: "say", text: line, style: "shout", log: true }, { t: "anim", anim: "point", dur: 3, act: q.act, icon: q.icon }, { t: "do", fn: (w) => w.stimulus(c, "idea", 0.6) }, { t: "item", item: null }, { t: "leave" }];
    case "hobby":
      return [
        { t: "act", act: q.act, icon: q.icon },
        { t: "say", text: line, log: true },
        { t: "anim", anim: pick(["juggle", "yoga", "dance", "flex"] as const), dur: 7 },
        { t: "do", fn: (w) => w.stimulus(c, "dance", 0.4) },
      ];
    case "vr":
      return [
        { t: "item", item: "vr", dur: 25 },
        { t: "act", act: q.act, icon: q.icon },
        { t: "anim", anim: "vr", dur: 4 },
        ...(wander(w, c).filter((s) => s.t === "go").map((s) => ({ ...s, moveAnim: "vr" as const })) as Step[]),
        { t: "say", text: line, log: true },
        { t: "anim", anim: "vr", dur: 4 },
        { t: "item", item: null },
      ];
    case "allhands":
      if (!w.activeBig() && chance(0.45) && (c.cooldown.allhands ?? 0) < w.time) {
        c.cooldown.allhands = w.time + 400;
        if (S.allhands(w, c)) return [];
      }
      return [{ t: "act", act: q.act, icon: q.icon }, { t: "say", text: line, style: "shout", log: true }, { t: "anim", anim: "point", dur: 3 }];
    case "walkmeeting":
      if (S.walkMeeting(w, c)) return [];
      return wander(w, c);
    case "psykologi": {
      const t = w.chars.filter((o) => o !== c && w.interruptible(o)).sort((a, b) => dist(a, c) - dist(b, c))[0];
      if (!t) return wander(w, c);
      return [
        { t: "act", act: q.act, icon: q.icon },
        { t: "toChar", id: t.id },
        { t: "say", text: line, to: t.id },
        {
          t: "do",
          fn: (w) => {
            w.interrupt(t, [{ t: "face", toward: c.id }, { t: "anim", anim: "cheer", dur: 2 }, { t: "say", text: pick(["High five!", "Okej, jag är med!", "*klapp*", "Det där var trevligt, faktiskt."]) }]);
            w.fx("hearts", (c.x + t.x) / 2, (c.y + t.y) / 2 - 1.5, 2, 2);
            w.relate(c, t, 6);
            w.stats.kramar++;
            w.worldDirty = true;
          },
        },
        { t: "anim", anim: "cheer", dur: 2 },
      ];
    }
    case "nyheter": {
      const recent = w.log.filter((e) => e.tag === "chaos" || e.tag === "world").slice(-1)[0];
      const headline = recent && chance(0.6) ? `JUST NU: ${recent.text.replace(/["”]/g, "").toUpperCase().slice(0, 70)}` : pick(HEADLINES);
      return [
        { t: "act", act: q.act, icon: q.icon },
        { t: "item", item: "papper", dur: 10 },
        { t: "anim", anim: "read", dur: 3 },
        {
          t: "do",
          fn: (w) => {
            w.banner = headline;
            w.bannerUntil = w.time + 40;
            w.worldDirty = true;
            w.say(c, headline, "shout", { log: "force" });
          },
        },
        { t: "anim", anim: "point", dur: 2 },
      ];
    }
    case "enkat":
      if (S.survey(w, c)) return [];
      return [{ t: "say", text: line }];
    case "kundresa": {
      return [
        { t: "act", act: q.act, icon: q.icon },
        { t: "say", text: "Kundresan, steg 1: man går in genom entrén.", log: true },
        { t: "go", x: 9, y: 33 },
        { t: "say", text: "Steg 2: en känsla av förvirring. Var är kaffet?" },
        { t: "spot", kind: "coffee" },
        { t: "say", text: "Steg 3: moment of truth. Är maskinen hel?" },
        { t: "anim", anim: "think", dur: 2 },
        { t: "say", text: line, log: true },
        { t: "leave" },
      ];
    }
    case "streaming": {
      const recent = w.log.filter((e) => e.tag !== "say").slice(-1)[0];
      return [
        { t: "act", act: q.act, icon: q.icon },
        { t: "say", text: recent ? `Tidigare i Barnhusgatan: ${recent.text.replace(/^[^\w"ÅÄÖåäö]+/u, "")}` : line, log: true, wait: 3 },
        { t: "say", text: "*dramatisk musik* ...och i kväll: vem tömmer diskmaskinen?" },
        { t: "anim", anim: "point", dur: 2 },
      ];
    }
    case "abtest":
      return [
        { t: "act", act: q.act, icon: q.icon },
        { t: "spot", kind: "coffee" },
        { t: "item", item: "kaffe", dur: 40 },
        { t: "say", text: "Variant A: kaffe i vänster hand. Variant B: kaffe i höger hand.", log: true },
        { t: "anim", anim: "think", dur: 3 },
        { t: "say", text: chance(0.5) ? "Variant B vinner med 0,3 procentenheter. Signifikant? Nej. Men kul!" : line },
        { t: "leave" },
      ];
    case "kodar":
      return [
        { t: "act", act: q.act, icon: q.icon },
        ...work(w, c, 14).slice(0, 3),
        { t: "say", text: line, style: "whisper", log: true },
        { t: "anim", anim: "type", dur: 6 },
        { t: "leave" },
      ];
    case "webbhistoria":
      return [
        { t: "act", act: q.act, icon: q.icon },
        ...(chance(0.5) ? arcade(w, c).slice(0, 3) : plant(w, c).slice(0, 2)),
        { t: "say", text: line, log: true },
        { t: "leave" },
      ];
    default: {
      // transform, riskanalys, ai_hype, kontrast, trend, copy
      const targets: SpotKind[] = ["coffee", "plant", "window", "sofa", "printer", "fruit"];
      return [
        { t: "act", act: q.act, icon: q.icon },
        { t: "spot", kind: pick(targets) },
        { t: "anim", anim: "think", dur: 2.5 },
        { t: "say", text: line, log: true, wait: 2 },
        { t: "anim", anim: "point", dur: 2 },
        { t: "leave" },
      ];
    }
  }
}

/** Gå till en kollega och fråga något – kollegan svarar. */
export function ask(w: World, c: Char, target: Char, question: string): Step[] {
  const q = question.trim().replace(/[.!]+$/, "");
  const text = /\?$/.test(q) ? q : `${q}?`;
  return [
    { t: "toChar", id: target.id, label: `Gå till ${target.name}` },
    { t: "say", text: `${target.name}, ${text.charAt(0).toLowerCase()}${text.slice(1)}`, to: target.id, log: "force", wait: 1.6, label: `Fråga ${target.name}` },
    {
      t: "do",
      fn: (w) => {
        if (target.ctrl === "player") return;
        w.interrupt(target, [{ t: "face", toward: c.id }, { t: "wait", dur: 0.6 }]);
        w.later(1.4, () => {
          const ans = localAnswer(target, text, c);
          w.say(target, ans, "say", { log: "force", to: c.id });
          w.remember(target, `${c.name} frågade mig: ${text}`);
          w.relate(c, target, 2);
          w.stimulus(c, "question", 0.25, { max: 1 });
        });
      },
    },
    { t: "wait", dur: 3 },
  ];
}

/** Gå till jukeboxen och byt musik (till egen favorit om inget anges). */
export function jukebox(w: World, c: Char, track?: TrackId): Step[] {
  const want: TrackId =
    track ?? (chance(0.7) && w.music.track !== c.c.music.fav ? c.c.music.fav : pick(PLAYABLE.filter((t) => t !== w.music.track && t !== c.c.music.hate)));
  const info = TRACK_BY_ID[want];
  return [
    { t: "act", act: "Går till jukeboxen", icon: "🎵" },
    { t: "spot", kind: "jukebox", label: "Gå till jukeboxen" },
    { t: "anim", anim: "point", dur: 1.6, act: `Väljer låt: ${info.name}`, label: want === "off" ? "Stänga av musiken" : `Sätta på ${info.name}` },
    {
      t: "do",
      fn: (w) => {
        if (w.music.track === want) {
          w.say(c, want === "off" ? "Det är redan tyst..." : `Det spelas ju redan ${info.name}!`);
          return;
        }
        w.setMusic(c, want);
        w.musicNext = w.time + (c.ctrl === "player" ? 150 : 270);
        w.say(c, pick(MUSIC_PICK[want] ?? ["Ny låt!"]), want === "disco" ? "shout" : "say", { log: true });
        if (want !== "off") w.fx("notes", 20.5, 60.2, 3, 3);
        w.remember(c, `satte på ${info.name}`);
        if (want === "off") return [{ t: "anim", anim: "idle", dur: 1.5 }];
      },
    },
    { t: "anim", anim: want === "off" ? "idle" : "dance", dur: 4 },
    { t: "leave" },
  ];
}
