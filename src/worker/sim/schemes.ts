// Kaotiska flerpersonsupptåg ("schemes"). Varje funktion returnerar true om upptåget startade.
import { DOWN, LEFT, ROOM_BY_ID, UP, type RoomId, type SpotKind } from "../../shared/map.ts";
import {
  BRAND_A,
  BRAND_B,
  CSS_CRISIS,
  CSS_HELP,
  CSS_SOLVED,
  DEBATES,
  IDEA_CON,
  IDEA_DOES,
  IDEA_HOOK,
  IDEA_OPEN,
  IDEA_PRO,
  IDEA_RESULT,
  IDEA_WHAT,
  KARAOKE_LINES,
  KARAOKE_SONGS,
  QUIRK,
  REACT,
  STANDUP_LINES,
  TOPIC_LINES,
  TOUR_FACTS,
  WORLD_EVENT_TEXT,
  cap,
  chance,
  fill,
  pick,
} from "./content.ts";
import { llmIdea } from "./dialogue.ts";
import { dist, type Char, type Scheme, type Step, type World } from "./world.ts";

const R = (a: number, b: number) => a + Math.random() * (b - a);

function pool(w: World, except: Char[], near?: Char, max = 99): Char[] {
  const list = w.chars.filter((c) => !except.includes(c) && w.interruptible(c));
  if (near) list.sort((a, b) => dist(a, near) - dist(b, near));
  else list.sort(() => Math.random() - 0.5);
  return list.slice(0, max);
}

/** Schemalägg en replik på tidslinjen och returnera ny tidpunkt. */
function line(w: World, t: number, who: Char, text: string, style: "say" | "shout" | "whisper" | "sing" = "say", log: boolean | "force" = false): number {
  w.later(t, () => w.say(who, text, style, { log }));
  return t + 1.8 + text.length * 0.045;
}

function alive(w: World, s: Scheme) {
  return w.schemes.has(s.id);
}

function tryJoin(w: World, s: Scheme, c: Char, delay: number) {
  w.later(delay, () => {
    if (!alive(w, s) || !w.interruptible(c)) return;
    w.enlist(s, c);
    s.onJoin?.(w, c);
  });
}

// ---------------------------------------------------------------------------
export function debate(w: World, init: Char, others: Char[]): boolean {
  for (const s of w.schemes.values()) if (s.kind === "debate") return false;
  const topic = pick(DEBATES);
  const parts = [init, ...others.slice(0, 2)];
  if (parts.length < 2) return false;
  const s = w.newScheme("debate", init, { label: `Debatt: ${topic.title}`, room: "passage", dur: 60 });
  for (const p of parts) {
    w.enlist(s, p);
    w.assign(p, [{ t: "face", toward: (p === init ? parts[1] : init).id }, { t: "anim", anim: "idle", dur: 60, act: `Debatterar ${topic.title}`, icon: "🔥" }]);
  }
  w.addLog(`Debatt vid kaffemaskinen: ${topic.title}!`, "🔥", "chaos", init.id, "Passagen");
  w.stats.kaos++;
  let t = line(w, 0.2, init, pick(topic.open), "say", true);
  for (let i = 0; i < 4; i++) {
    const sp = parts[(i + 1) % parts.length];
    t = line(w, t, sp, i % 2 === 0 ? pick(topic.pro) : pick(topic.con), chance(0.3) ? "shout" : "say", chance(0.3));
  }
  w.later(t * 0.6, () => w.stimulus(init, "shout", 0.6, { scheme: s.id, max: 2 }));
  t = line(w, t, init, pick([...topic.pro, ...topic.con]), "shout", true);
  w.later(t + 0.3, () => {
    w.addLog(pick(topic.verdicts), "⚖️", "chaos", undefined, "Passagen");
    for (const p of parts) {
      w.remember(p, `debatterade ${topic.title} vid kaffemaskinen`);
      for (const q of parts) if (p !== q) w.relate(p, q, chance(0.5) ? 2 : -3);
    }
    w.endScheme(s.id);
  });
  s.endsAt = w.time + t + 2;
  return true;
}

// ---------------------------------------------------------------------------
export function rave(w: World, init: Char, room?: RoomId): boolean {
  if (w.activeBig()) return false;
  const r: RoomId = room ?? pick(["mote_stor", "lounge"] as RoomId[]);
  const s = w.newScheme("rave", init, { label: "Kontorsrave", room: r, joinable: true, big: true, dur: 45 });
  const p = w.randomTileIn(r);
  w.assign(init, [
    { t: "say", text: `RAVE! NU! ALLA ${ROOM_BY_ID[r].toRoom.toUpperCase()}!`, style: "shout", log: "force" },
    ...(p ? ([{ t: "go", x: p.x, y: p.y, run: true }] as Step[]) : []),
    {
      t: "do",
      fn: (w) => {
        w.disco = r;
        w.worldDirty = true;
        w.sound("tada");
        w.fx("notes", init.x, init.y - 1.5, 3, 3);
        w.stimulus(init, "rave", 0.9, { scheme: s.id, radius: 14, max: 5 });
      },
    },
    { t: "anim", anim: "dance", dur: 45, act: "Ravear", icon: "🪩" },
  ]);
  w.addLog(`${init.name} drar igång ett kontorsrave ${ROOM_BY_ID[r].inRoom}!`, "🪩", "chaos", init.id);
  w.stats.kaos++;
  s.onJoin = (w, c) => {
    const q = w.randomTileIn(r);
    w.assign(c, [
      { t: "say", text: pick(REACT.rave), wait: 0.2 },
      ...(q ? ([{ t: "go", x: q.x, y: q.y, run: true }] as Step[]) : []),
      { t: "anim", anim: "dance", dur: 45, act: "Ravear", icon: "🪩" },
    ]);
  };
  for (const c of pool(w, [init])) {
    const p = (c.c.traits.kaos + c.c.traits.social + c.c.traits.energi) / 3;
    if (chance(p * 0.75)) tryJoin(w, s, c, R(2, 9));
  }
  for (let i = 0; i < 9; i++)
    w.later(4 + i * 4.5, () => {
      if (!alive(w, s)) return;
      const q = w.randomTileIn(r, false);
      if (q) w.fx(pick(["notes", "sparkle", "stars"] as const), q.x + 0.5, q.y - 0.5, 2.5, 2);
    });
  s.onEnd = (w) => {
    w.disco = null;
    w.worldDirty = true;
    w.addLog(pick(["Raven avbröts av att någon behövde rummet för ett kundmöte.", "Raven tog slut när någon tände taklampan.", "Raven är över. Ingen pratar om den igen.", "DJ:n (Dammbert) gick på laddning."]), "🪩", "chaos");
    for (const id of s.members) {
      const c = w.byId.get(id);
      if (c) {
        w.remember(c, `ravade ${ROOM_BY_ID[r].inRoom}`);
        c.needs.kaos = 5;
        c.needs.socialt = 100;
      }
    }
  };
  return true;
}

// ---------------------------------------------------------------------------
export function conga(w: World, init: Char): boolean {
  if (w.activeBig()) return false;
  const s = w.newScheme("conga", init, { label: "Kongatåg genom Barnhusgatan", joinable: true, big: true, dur: 60 });
  const route: [number, number][] = [
    [12, 36], [15, 26], [16, 14], [17, 22], [16, 28], [24, 28], [29, 43], [25, 48], [22, 56], [13, 53], [13, 46], [11, 38],
  ];
  const chain: string[] = [init.id];
  const steps: Step[] = [{ t: "say", text: "KONGATÅG! Häng på allihopa!", style: "shout", log: "force" }, { t: "act", act: "Leder kongatåget", icon: "💃" }];
  for (const [x, y] of route) steps.push({ t: "go", x, y, moveAnim: "conga" });
  steps.push({ t: "say", text: "...och så var vi tillbaka! Bästa mötet i år.", style: "shout", log: true }, { t: "anim", anim: "cheer", dur: 3 });
  steps.push({ t: "do", fn: (w) => w.endScheme(s.id) });
  w.assign(init, steps);
  w.addLog(`${init.name} startar ett kongatåg genom hela våningen!`, "💃", "chaos", init.id);
  w.stats.kaos++;
  s.onJoin = (w, c) => {
    const leader = chain[chain.length - 1];
    chain.push(c.id);
    w.assign(c, [{ t: "say", text: pick(REACT.conga), wait: 0.2 }, { t: "toChar", id: leader, run: true }, { t: "follow", id: leader, dur: 60, moveAnim: "conga" }]);
  };
  for (const c of pool(w, [init], init, 9)) if (chance(0.25 + c.c.traits.social * 0.5)) tryJoin(w, s, c, R(1, 10));
  w.later(3, () => w.stimulus(init, "conga", 0.8, { scheme: s.id, radius: 10 }));
  s.onEnd = (w) => w.addLog(`Kongatåget tog slut med ${chain.length} deltagare.`, "💃", "chaos");
  return true;
}

// ---------------------------------------------------------------------------
export function chairRace(w: World, init: Char): boolean {
  if (w.activeBig()) return false;
  const opp = pool(w, [init], init, 4)[0];
  if (!opp) return false;
  const s = w.newScheme("race", init, { label: "Stolrace i passagen", big: true, dur: 45 });
  w.enlist(s, opp);
  const lanes: [Char, number][] = [[init, 15], [opp, 17]];
  w.addLog(`${init.name} utmanar ${opp.name} på stolrace genom passagen!`, "🏁", "chaos", init.id, "Passagen");
  w.stats.kaos++;
  let winner: Char | null = null;
  const tStart = Math.max(w.travelTime(init, 15, 11), w.travelTime(opp, 17, 11)) + 1;
  for (const [c, x] of lanes) {
    w.assign(c, [
      { t: "say", text: c === init ? `${opp.name}! Stolrace! Nu!` : pick(["Du är så körd.", "Jag har tränat för det här i hela mitt liv.", "Okej. Men bara en gång."]), style: "shout" },
      { t: "go", x, y: 11, run: true },
      { t: "face", dir: DOWN },
      { t: "anim", anim: "sit", pose: "sit", dur: 60, act: "Gör sig redo för stolrace", icon: "🏁" },
    ]);
  }
  let t = tStart;
  t = line(w, t, init, "3...", "shout");
  t = line(w, t - 0.8, init, "2...", "shout");
  t = line(w, t - 0.8, init, "1... KÖR!", "shout");
  w.later(t, () => {
    if (!alive(w, s)) return;
    w.sound("whoosh");
    w.stimulus(init, "race", 0.9, { scheme: s.id, radius: 12, max: 4 });
    for (const [c, x] of lanes) {
      const speed = R(4.2, 7.5);
      w.interrupt(c, [
        { t: "go", x: x === 15 ? 11 : 14, y: 44, moveAnim: "sit", movePose: "sit", speed },
        {
          t: "do",
          fn: (w) => {
            if (!winner) {
              winner = c;
              w.say(c, "VINST!!! Jag är stolens mästare!", "shout", { log: "force" });
              w.fx("confetti", c.x, c.y - 1, 3, 3);
              w.sound("tada");
              c.item = "pokal";
              c.itemUntil = w.time + 60;
              w.remember(c, "vann stolracet i passagen");
              return [{ t: "anim", anim: "cheer", dur: 4 }, { t: "do", fn: (w) => w.endScheme(s.id) }];
            }
            w.say(c, pick(["Fusk! Min stol hade sämre hjul!", "Jag vann moraliskt.", "Revansch nästa fredag."]), "say", { log: true });
            w.remember(c, "förlorade stolracet");
            return [{ t: "anim", anim: "cry", dur: 3 }];
          },
        },
      ]);
    }
  });
  return true;
}

// ---------------------------------------------------------------------------
export function gympa(w: World, init: Char): boolean {
  if (w.activeBig()) return false;
  const s = w.newScheme("gympa", init, { label: "Synkroniserad pausgympa", joinable: true, big: true, dur: 45 });
  const slots: [number, number][] = [[10, 37], [12, 37], [14, 37], [10, 39], [12, 39], [14, 39], [11, 41], [13, 41], [9, 41], [15, 41]];
  let slot = 0;
  w.assign(init, [
    { t: "say", text: "PAUSGYMPA! Alla till entrén! Nu sträcker vi på oss!", style: "shout", log: "force" },
    { t: "go", x: 12, y: 34, run: true },
    { t: "face", dir: DOWN },
    { t: "anim", anim: "idle", dur: 45, act: "Leder pausgympa", icon: "🤸" },
  ]);
  w.addLog(`${init.name} drar igång synkroniserad pausgympa i entrén!`, "🤸", "chaos", init.id, "Entrén");
  s.onJoin = (w, c) => {
    const [x, y] = slots[slot++ % slots.length];
    w.assign(c, [{ t: "say", text: pick(REACT.gympa), wait: 0.2 }, { t: "go", x, y, run: true }, { t: "face", dir: UP }, { t: "anim", anim: "idle", dur: 45, act: "Pausgympar", icon: "🤸" }]);
  };
  for (const c of pool(w, [init], init, 9)) if (chance(0.3 + c.c.traits.energi * 0.45)) tryJoin(w, s, c, R(1, 6));
  const moves: [string, "cheer" | "jump" | "yoga" | "pushup" | "flex" | "dance"][] = [
    ["Armarna upp mot taket!", "cheer"],
    ["Hoppa! Hoppa! Hoppa!", "jump"],
    ["Yoga-träd! Balans!", "yoga"],
    ["Armhävningar för designsystemet!", "pushup"],
    ["Flexa för Bengt!", "flex"],
    ["Och så dansa loss!", "dance"],
  ];
  let t = 9;
  for (const [txt, anim] of moves) {
    w.later(t, () => {
      if (!alive(w, s)) return;
      w.say(init, txt, "shout");
      for (const id of s.members) {
        const c = w.byId.get(id);
        if (c && !c.path.length) w.interrupt(c, [{ t: "anim", anim, dur: 4 }, { t: "anim", anim: "idle", dur: 60 }]);
      }
    });
    t += 5;
  }
  w.later(t, () => {
    if (!alive(w, s)) return;
    w.say(init, "Bra jobbat! Nu tillbaka till Figma.", "shout", { log: true });
    for (const id of s.members) {
      const c = w.byId.get(id);
      if (c) {
        c.needs.energi = Math.min(100, c.needs.energi + 25);
        c.needs.kaos = Math.max(0, c.needs.kaos - 30);
      }
    }
    w.later(2, () => w.endScheme(s.id));
  });
  return true;
}

// ---------------------------------------------------------------------------
export function krismote(w: World, init: Char, topic?: string): boolean {
  for (const s of w.schemes.values()) if (s.kind === "krismote") return false;
  const wb = w.findSpot("whiteboard", init);
  if (!wb) return false;
  const att = pool(w, [init], undefined, 3);
  if (!att.length) return false;
  const s = w.newScheme("krismote", init, { label: "Krismöte vid whiteboarden", dur: 70 });
  const names = att.map((a) => a.name).join(", ").replace(/, ([^,]*)$/, " och $1");
  w.assign(init, [
    { t: "say", text: `KRISMÖTE! ${names} – till whiteboarden NU!`, style: "shout", log: "force" },
    { t: "go", x: wb.x, y: wb.y, run: true },
    { t: "face", dir: wb.face },
    { t: "item", item: "postit", dur: 60 },
    { t: "anim", anim: "draw", dur: 70, act: "Leder ett krismöte", icon: "🚨" },
  ]);
  w.stats.moten++;
  w.worldDirty = true;
  let maxT = w.travelTime(init, wb.x, wb.y);
  att.forEach((a, i) => {
    w.enlist(s, a);
    const x = wb.x - 1 + i;
    const y = wb.y + 2;
    const tx = w.walkable(x, y) ? x : wb.x;
    const ty = w.walkable(x, y) ? y : wb.y + 1;
    maxT = Math.max(maxT, w.travelTime(a, tx, ty));
    w.assign(a, [
      { t: "say", text: pick(["Vad nu då?", "Kommer!", "Är det brand?", "Jag tar med kaffe.", "Är det ett riktigt krismöte eller ett Alexander-krismöte?"]), wait: 0.3 },
      { t: "go", x: tx, y: ty, run: chance(0.5) },
      { t: "face", dir: UP },
      { t: "anim", anim: "idle", dur: 70, act: "Sitter i krismöte", icon: "🚨" },
    ]);
  });
  w.addLog(`${init.name} kallar till krismöte med ${names}!`, "🚨", "chaos", init.id);
  let idea: string | null = null;
  void llmIdea(w, init).then((x) => {
    idea = x;
  });
  let t = maxT + 1.2;
  t = line(w, t, init, pick(IDEA_OPEN), "shout");
  w.later(t, () => {
    if (!alive(w, s)) return;
    const brand = pick(BRAND_A) + pick(BRAND_B);
    const pitch = topic ? `Vi ska ${topic.replace(/^att /, "")}!` : idea ?? `Vi bygger ${pick(IDEA_WHAT)} ${pick(IDEA_DOES)}. ${fill(pick(IDEA_HOOK), { brand })}`;
    w.say(init, pitch, "say", { log: "force", dur: 8 });
    w.fx("postits", init.x, init.y - 1.5, 3, 3);
    w.stats.ideer++;
    let yes = 1;
    let no = 0;
    let tt = 4 + pitch.length * 0.04;
    for (const a of att) {
      const pro = (a.rel[init.id] ?? 0) / 100 + a.c.traits.kaos * 0.6 + Math.random() * 0.6 > 0.7;
      if (pro) yes++;
      else no++;
      const text = pro ? pick(IDEA_PRO) : pick(IDEA_CON);
      w.later(tt, () => {
        w.say(a, text, "say", { log: chance(0.5) });
        if (pro) w.interrupt(a, [{ t: "anim", anim: "cheer", dur: 2 }, { t: "anim", anim: "idle", dur: 60 }]);
        w.relate(a, init, pro ? 4 : -2);
        w.remember(a, `var på ${init.name}s krismöte`);
      });
      tt += 2.4 + text.length * 0.04;
    }
    w.later(tt + 0.5, () => {
      w.addLog(fill(pick(IDEA_RESULT), { yes: String(yes), no: String(no) }), "📋", "chaos", init.id);
      w.remember(init, `pitchade en idé på ett krismöte`);
      w.endScheme(s.id);
    });
  });
  return true;
}

// ---------------------------------------------------------------------------
const HIDING: [string, SpotKind][] = [
  ["i kylskåpet", "fridge"],
  ["bakom en krukväxt", "plant"],
  ["i serverrummet", "server"],
  ["i hatthyllan", "coatrack"],
  ["i kakelugnen", "kakelugn"],
  ["vid skrivaren", "printer"],
  ["i arkadmaskinen", "arcade"],
];

export function hideMug(w: World, init: Char, victimId?: string): boolean {
  const victims = w.chars.filter((c) => c !== init && c.homeSpot && !c.mugHidden && (victimId ? c.id === victimId : dist(c, init) > 5));
  const victim = victimId ? w.byId.get(victimId) : pick(victims);
  if (!victim || !victim.homeSpot || victim.mugHidden) return false;
  const desk = w.spotById(victim.homeSpot)!;
  let place = "";
  let hide = null as ReturnType<World["findSpot"]>;
  for (const [pl, kind] of [...HIDING].sort(() => Math.random() - 0.5)) {
    hide = w.findSpot(kind, init);
    if (hide) {
      place = pl;
      break;
    }
  }
  if (!hide) return false;
  const s = w.newScheme("mug", init, { label: "Koppgömmaren", dur: 60 });
  w.assign(init, [
    { t: "act", act: "Smyger runt...", icon: "🤫" },
    { t: "think", text: `Hehehe. ${victim.name}s kopp...` },
    { t: "go", x: desk.x, y: desk.y + (desk.face === UP ? 1 : desk.face === DOWN ? -1 : 0), moveAnim: "sneak", speed: 2.2 },
    { t: "anim", anim: "sneak", dur: 1.5 },
    { t: "item", item: "kopp" },
    { t: "say", text: "*fnissar tyst*", style: "whisper" },
    { t: "go", x: hide.x, y: hide.y, moveAnim: "sneak", speed: 2.4 },
    { t: "anim", anim: "sneak", dur: 1.5 },
    { t: "item", item: null },
    {
      t: "do",
      fn: (w) => {
        victim.mugHidden = { place, by: init.id, x: hide.x, y: hide.y };
        w.addLog(`${init.name} har gömt ${victim.name}s kaffekopp ${place}. Ingen såg något.`, "🤫", "secret", init.id);
        w.remember(init, `gömde ${victim.name}s kopp ${place}`);
        w.think(init, "Perfekt brott.");
        w.endScheme(s.id);
      },
    },
  ]);
  return true;
}

// ---------------------------------------------------------------------------
export function cssCrisis(w: World, c: Char): boolean {
  for (const s of w.schemes.values()) if (s.kind === "css" && s.init === c.id) return false;
  const s = w.newScheme("css", c, { label: "Existentiell CSS-kris", dur: 40 });
  w.assign(c, [
    { t: "anim", anim: "panic", dur: 2, act: "Har en existentiell CSS-kris", icon: "😱" },
    { t: "say", text: pick(CSS_CRISIS), style: "shout", log: "force" },
    { t: "do", fn: (w) => w.stimulus(c, "panic", 0.5, { scheme: s.id, max: 2 }) },
    { t: "anim", anim: "cry", dur: 4 },
    { t: "say", text: pick(CSS_CRISIS) },
    { t: "anim", anim: "cry", dur: 8 },
  ]);
  w.addLog(`${c.name} har en existentiell kris över en CSS-bugg.`, "😱", "chaos", c.id);
  const helpers = pool(w, [c], c, 2).filter((h) => dist(h, c) < 14);
  helpers.forEach((h, i) => {
    w.enlist(s, h);
    w.assign(h, [{ t: "wait", dur: 1 + i * 2 }, { t: "toChar", id: c.id }, { t: "say", text: pick(CSS_HELP), to: c.id, wait: 2 }, { t: "anim", anim: "point", dur: 3 }, { t: "anim", anim: "idle", dur: 8 }]);
  });
  w.later(16, () => {
    if (!alive(w, s)) return;
    w.say(c, pick(CSS_SOLVED), "say", { log: "force" });
    w.fx("sparkle", c.x, c.y - 1.2, 2, 2);
    for (const h of helpers) w.relate(c, h, 7);
    w.remember(c, "överlevde en CSS-kris");
    w.interrupt(c, [{ t: "anim", anim: "cheer", dur: 2.5 }, { t: "do", fn: (w) => w.endScheme(s.id) }]);
  });
  return true;
}

// ---------------------------------------------------------------------------
export function fika(w: World, init: Char | null, reason?: string): boolean {
  if (w.activeBig()) return false;
  const s = w.newScheme("fika", init, { label: "Fika i pentryt", joinable: true, big: true, dur: 45 });
  const head = reason ?? (init ? `${init.name} utlyser spontanfika!` : "FIKA i pentryt!");
  w.addLog(head, "🥐", "chaos", init?.id, "Pentryt");
  w.sound("bell");
  const go = (c: Char): Step[] => [
    { t: "spot", kind: ["dining"], room: "pentry", run: chance(0.4) },
    { t: "item", item: chance(0.5) ? "bulle" : "tarta", dur: 30 },
    { t: "anim", anim: "eat", dur: 8, act: "Fikar", icon: "🥐" },
    { t: "do", fn: (w) => (chance(0.5) ? (w.say(c, pick(["Mmm, kardemumma!", "Vem har bakat? Gift dig med mig. Professionellt.", "Det här är kontorets bästa möte.", "Bästa fikat sedan 1906."])), undefined) : undefined) },
    { t: "needs", d: { hunger: -50, socialt: 40, kaos: -10 } },
    { t: "anim", anim: "talk", dur: 15 },
    { t: "item", item: null },
    { t: "leave" },
  ];
  if (init) w.assign(init, [{ t: "say", text: reason ? reason : "FIKA! Alla till pentryt!", style: "shout", log: "force" }, ...go(init)]);
  s.onJoin = (w, c) => w.assign(c, [{ t: "say", text: pick(["FIKA!", "Jag kommer!", "Bullar?!", "Äntligen!"]), wait: 0.2 }, ...go(c)]);
  for (const c of pool(w, init ? [init] : [])) if (chance(0.75)) tryJoin(w, s, c, R(0.5, 6));
  w.later(6, () => w.fx("confetti", 6.5, 9, 3, 3));
  return true;
}

// ---------------------------------------------------------------------------
export function allhands(w: World, init: Char): boolean {
  if (w.activeBig()) return false;
  const s = w.newScheme("allhands", init, { label: "Spontan all-hands", joinable: true, big: true, dur: 45 });
  w.assign(init, [
    { t: "say", text: "ALL-HANDS i loungen! Om två minuter! Ta med energi!", style: "shout", log: "force" },
    { t: "go", x: 25, y: 62, run: true },
    { t: "face", dir: DOWN },
    { t: "anim", anim: "point", dur: 45, act: "Håller all-hands", icon: "📣" },
  ]);
  w.addLog(`${init.name} kallar till spontan all-hands i loungen.`, "📣", "chaos", init.id, "Loungen");
  s.onJoin = (w, c) => {
    const q = w.randomTileIn("lounge");
    w.assign(c, [{ t: "say", text: pick(["Kommer!", "Är det obligatoriskt?", "Finns det kaffe?", "Jag tar med en stol."]), wait: 0.2 }, ...(q ? ([{ t: "go", x: q.x, y: q.y }] as Step[]) : []), { t: "face", toward: init.id }, { t: "anim", anim: "idle", dur: 45 }]);
  };
  for (const c of pool(w, [init])) if (chance(0.7)) tryJoin(w, s, c, R(1, 7));
  let t = 12;
  t = line(w, t, init, "Slide 1 av 42: Varför vi finns.", "shout");
  t = line(w, t, init, pick(QUIRK.allhands.lines));
  t = line(w, t, init, pick(["Vi har haft ett fantastiskt kvartal. Bengt har vuxit 3 cm.", "Våra värderingar: öppenhet, lärglädje och generositet. Och fika.", "Fråga från publiken? Nej? Toppen. Slide 2."]));
  w.later(t, () => {
    if (!alive(w, s)) return;
    for (const id of s.members) {
      const c = w.byId.get(id);
      if (c && c !== init) w.interrupt(c, [{ t: "anim", anim: "cheer", dur: 3 }, { t: "anim", anim: "idle", dur: 30 }]);
    }
    w.fx("confetti", 25, 63, 3, 3);
    w.later(4, () => w.endScheme(s.id));
  });
  return true;
}

// ---------------------------------------------------------------------------
export function firedrill(w: World): boolean {
  if (w.activeBig()) return false;
  const s = w.newScheme("firedrill", null, { label: "Brandövning!", big: true, dur: 32 });
  w.alarm = true;
  w.worldDirty = true;
  w.sound("alarm");
  w.addLog(WORLD_EVENT_TEXT.firedrill[0], "🚨", "world");
  for (const c of w.chars) {
    if (c.ctrl === "player") continue;
    w.enlist(s, c);
    const q = w.randomTileIn(pick(["hall", "hall", "korridor"] as RoomId[]));
    w.assign(c, [
      { t: "anim", anim: "panic", dur: R(0.3, 1.5) },
      ...(chance(0.4) ? ([{ t: "say", text: pick(REACT.panic), style: "shout" }] as Step[]) : []),
      ...(q ? ([{ t: "go", x: q.x, y: q.y, run: true, moveAnim: "panic" }] as Step[]) : []),
      { t: "anim", anim: "panic", dur: 30 },
    ]);
  }
  w.later(4, () => w.sound("alarm"));
  w.later(16, () => {
    w.alarm = false;
    w.worldDirty = true;
    w.addLog(WORLD_EVENT_TEXT.firedrill[1], "🤖", "world");
    const vac = w.npcById.get("dammbert");
    if (vac) w.say(vac, "BEEP. FÖRLÅT.", "say");
    w.later(3, () => w.endScheme(s.id));
  });
  return true;
}

// ---------------------------------------------------------------------------
export function flashmob(w: World, init: Char): boolean {
  if (w.activeBig()) return false;
  const s = w.newScheme("flashmob", init, { label: "Mannequin challenge", big: true, dur: 16 });
  w.say(init, "FRYS! Mannequin challenge!", "shout", { log: "force" });
  w.addLog(`${init.name} startar en mannequin challenge. Hela kontoret fryser.`, "🧊", "chaos", init.id);
  for (const c of w.chars) {
    if (c.ctrl === "player" && c !== init) continue;
    if (c !== init && !w.interruptible(c)) continue;
    w.enlist(s, c);
    w.assign(c, [{ t: "wait", dur: R(0.2, 1.2) }, { t: "anim", anim: "frozen", dur: 11 }]);
  }
  w.later(12.5, () => {
    w.say(init, "...och TILLBAKA!", "shout", { log: true });
    w.later(1, () => w.endScheme(s.id));
  });
  return true;
}

// ---------------------------------------------------------------------------
export function karaoke(w: World, init: Char): boolean {
  if (w.activeBig()) return false;
  const s = w.newScheme("karaoke", init, { label: "Karaoke i loungen", joinable: true, big: true, dur: 40 });
  const song = pick(KARAOKE_SONGS);
  w.assign(init, [
    { t: "say", text: "Karaoke! Jag tar första låten!", style: "shout", log: "force" },
    { t: "go", x: 25, y: 63, run: true },
    { t: "face", dir: DOWN },
    { t: "item", item: "mikrofon", dur: 40 },
    { t: "anim", anim: "dance", dur: 40, act: "Sjunger karaoke", icon: "🎤" },
  ]);
  w.addLog(`${init.name} sjunger ${song} i loungen.`, "🎤", "chaos", init.id, "Loungen");
  s.onJoin = (w, c) => {
    const q = w.randomTileIn("lounge");
    w.assign(c, [...(q ? ([{ t: "go", x: q.x, y: q.y }] as Step[]) : []), { t: "face", toward: init.id }, { t: "anim", anim: "idle", dur: 40 }]);
  };
  for (const c of pool(w, [init], init, 6)) if (chance(0.55)) tryJoin(w, s, c, R(1, 5));
  let t = w.travelTime(init, 25, 63) + 1;
  for (let i = 0; i < 3; i++) {
    t = line(w, t, init, pick(KARAOKE_LINES), "sing", i === 0);
    w.later(t - 1, () => w.fx("notes", init.x, init.y - 1.5, 2.5, 2));
  }
  w.later(t + 0.5, () => {
    if (!alive(w, s)) return;
    for (const id of s.members) {
      const c = w.byId.get(id);
      if (c && c !== init) {
        w.interrupt(c, [{ t: "anim", anim: "cheer", dur: 3 }, { t: "say", text: pick(REACT.sing), wait: 0.2 }]);
      }
    }
    w.later(4, () => w.endScheme(s.id));
  });
  return true;
}

// ---------------------------------------------------------------------------
export function tour(w: World, guide: Char): boolean {
  if (w.activeBig()) return false;
  const s = w.newScheme("tour", guide, { label: "Guidad tur genom 1906", joinable: true, big: true, dur: 75 });
  const stops: [number, number, number][] = [[10, 34, 0], [10, 14, 7], [16, 13, 6], [16, 8, 6], [25, 27, 5], [16, 44, 3], [25, 74, 2]];
  const steps: Step[] = [{ t: "say", text: "Välkomna på guidad tur genom Barnhusgatan 20, byggt 1906!", style: "shout", log: "force" }, { t: "act", act: "Guidar en tur", icon: "🎩" }];
  for (const [x, y, f] of stops) steps.push({ t: "go", x, y }, { t: "say", text: TOUR_FACTS[f] ?? pick(TOUR_FACTS), wait: 4 });
  steps.push({ t: "say", text: "Tack för att ni följt med! Dricks tas emot i kanelbullar.", log: true }, { t: "do", fn: (w) => w.endScheme(s.id) });
  w.assign(guide, steps);
  w.addLog(`${guide.name} håller en guidad tur genom lägenheten.`, "🎩", "chaos", guide.id);
  let last = guide.id;
  s.onJoin = (w, c) => {
    const leader = last;
    last = c.id;
    w.assign(c, [{ t: "toChar", id: leader }, { t: "follow", id: leader, dur: 75 }]);
  };
  for (const c of pool(w, [guide], guide, 3)) if (chance(0.6)) tryJoin(w, s, c, R(1, 4));
  return true;
}

// ---------------------------------------------------------------------------
export function standup(w: World, init: Char | null): boolean {
  if (w.activeBig()) return false;
  const lead = init ?? pick(w.chars.filter((c) => w.interruptible(c)));
  if (!lead) return false;
  const s = w.newScheme("standup", lead, { label: "Daily standup", big: true, dur: 50 });
  const ring: [number, number][] = [[11, 35], [13, 35], [14, 37], [14, 39], [13, 41], [11, 41], [10, 39], [10, 37]];
  const parts = [lead, ...pool(w, [lead], undefined, 6)];
  parts.forEach((c, i) => {
    w.enlist(s, c);
    const [x, y] = ring[i % ring.length];
    w.assign(c, [{ t: "go", x, y }, { t: "do", fn: (w) => w.faceTo(c, { x: 12.5, y: 38.5 }) }, { t: "anim", anim: "idle", dur: 50, act: "Står på standup", icon: "🧍" }]);
  });
  w.addLog(`Daily standup i entrén. ${parts.length} deltagare, ${parts.length * 2} blockers.`, "🧍", "event", lead.id, "Entrén");
  let t = 9;
  t = line(w, t, lead, "Okej, snabb runda! Vad gjorde ni igår?", "say");
  for (const c of parts) t = line(w, t, c, pick(STANDUP_LINES));
  w.later(t, () => {
    w.say(lead, "Toppen! Det tog bara 15 minuter längre än planerat.", "say", { log: true });
    w.later(2, () => w.endScheme(s.id));
  });
  return true;
}

// ---------------------------------------------------------------------------
export function plantCeremony(w: World, init: Char): boolean {
  if (w.activeBig()) return false;
  const s = w.newScheme("plant", init, { label: "Ceremoni för Bengt", joinable: true, big: true, dur: 35 });
  w.assign(init, [
    { t: "say", text: "Samling vid Bengt! Vi ska hylla vår krukväxt!", style: "shout", log: "force" },
    { t: "go", x: 16, y: 33 },
    { t: "face", dir: UP },
    { t: "anim", anim: "point", dur: 35, act: "Hyllar Bengt", icon: "🌿" },
  ]);
  s.onJoin = (w, c) => {
    const q = w.randomTileIn("hall");
    w.assign(c, [...(q ? ([{ t: "go", x: q.x, y: q.y }] as Step[]) : []), { t: "face", toward: init.id }, { t: "anim", anim: "idle", dur: 35 }]);
  };
  for (const c of pool(w, [init], init, 5)) if (chance(0.55)) tryJoin(w, s, c, R(1, 5));
  let t = 9;
  t = line(w, t, init, "Bengt. Du har stått här i vått och torrt. Mest torrt.", "say", true);
  t = line(w, t, init, "Härmed utnämner vi dig till Kontorets Hedersväxt!", "shout");
  w.later(t, () => {
    w.plantSize = Math.min(4, w.plantSize + 0.15);
    w.worldDirty = true;
    w.fx("confetti", 17.5, 31.5, 3, 3);
    w.fx("sparkle", 17.5, 31, 3, 2);
    const b = w.npcById.get("bengt");
    if (b) w.say(b, "*prasslar rörd*", "whisper");
    w.addLog("Krukväxten Bengt har utnämnts till Hedersväxt och vuxit synbart.", "🌿", "chaos");
    w.later(4, () => w.endScheme(s.id));
  });
  return true;
}

// ---------------------------------------------------------------------------
export function walkMeeting(w: World, init: Char): boolean {
  const partner = pool(w, [init], init, 3)[0];
  if (!partner) return false;
  const s = w.newScheme("walk", init, { label: "Gåmöte", dur: 45 });
  w.enlist(s, partner);
  const steps: Step[] = [{ t: "say", text: `${partner.name}! Vi tar det här mötet gående!`, log: true }, { t: "act", act: "Håller ett gåmöte", icon: "🚶" }];
  for (const room of ["passage", "hall", "korridor", "hall"] as RoomId[]) {
    const p = w.randomTileIn(room);
    if (p) steps.push({ t: "go", x: p.x, y: p.y });
  }
  steps.push({ t: "say", text: "Bra möte! Vi har en strategi. Typ.", log: true }, { t: "do", fn: (w) => w.endScheme(s.id) });
  w.assign(init, steps);
  w.assign(partner, [{ t: "toChar", id: init.id }, { t: "follow", id: init.id, dur: 45 }]);
  let t = 4;
  for (let i = 0; i < 4; i++) {
    const who = i % 2 ? partner : init;
    t = line(w, t, who, pick(TOPIC_LINES[pick(who.c.interests)] ?? TOPIC_LINES.helhet));
  }
  return true;
}

// ---------------------------------------------------------------------------
export function survey(w: World, init: Char): boolean {
  const targets = pool(w, [init], init, 2);
  if (!targets.length) return false;
  const s = w.newScheme("survey", init, { label: "Enkät", dur: 50 });
  const steps: Step[] = [{ t: "act", act: "Skickar enkäter", icon: "📋" }, { t: "item", item: "papper", dur: 50 }];
  for (const t of targets) {
    steps.push(
      { t: "toChar", id: t.id },
      { t: "say", text: `${t.name}! På en skala 1–7, hur nöjd är du med ${pick(["kaffet", "livet", "hissen", "det här ögonblicket", "Bengt"])}?`, to: t.id, wait: 1.5 },
      {
        t: "do",
        fn: (w) => {
          if (t.ctrl === "player") return;
          w.interrupt(t, [{ t: "face", toward: init.id }, { t: "wait", dur: 0.4 }]);
          w.later(1, () => w.say(t, pick([`${1 + Math.floor(Math.random() * 7)}. Kanske ${1 + Math.floor(Math.random() * 7)}.`, "Kan jag svara 'pizza'?", "Sju! Nej, tre. Kan jag ändra?", "Jag vill ha ett fritextfält."]), "say", { log: chance(0.4) }));
        },
      },
      { t: "wait", dur: 2.5 },
    );
  }
  steps.push({ t: "say", text: "Svarsfrekvens 100%. Tydligt mönster i datan.", log: true }, { t: "item", item: null }, { t: "do", fn: (w) => w.endScheme(s.id) });
  w.assign(init, steps);
  return true;
}

// ---------------------------------------------------------------------------
/** Ryck tag i någon och starta en spontan high-five/kram. */
export function hug(w: World, a: Char, b: Char): Step[] {
  return [
    { t: "toChar", id: b.id, label: `Gå till ${b.name}` },
    { t: "say", text: pick([`${b.name}! Kram!`, `Kom här, ${b.name}!`, `${b.name}, du förtjänar en kram.`]), to: b.id, label: `Krama ${b.name}` },
    {
      t: "do",
      fn: (w) => {
        if (b.ctrl !== "player") w.interrupt(b, [{ t: "face", toward: a.id }, { t: "anim", anim: "cheer", dur: 2.5 }, { t: "say", text: pick(["Aww!", "Okej då!", "*kramar tillbaka*", "Det här var oväntat. Och fint."]) }]);
        w.fx("hearts", (a.x + b.x) / 2, (a.y + b.y) / 2 - 1.4, 2.5, 3);
        w.relate(a, b, 8);
        w.stats.kramar++;
        w.worldDirty = true;
        w.addLog(`${a.name} kramade ${b.name}.`, "🤗", "social", a.id);
        w.stimulus(a, "hug", 0.4, { max: 2 });
      },
    },
    { t: "anim", anim: "cheer", dur: 2.5 },
  ];
}

export { LEFT };
