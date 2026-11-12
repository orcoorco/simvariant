// Spelarens textprompt → handlingskö. Lokal svensk tolk + valfri LLM + easter eggs.
import { ROOMS, type RoomId, type SpotKind } from "../../shared/map.ts";
import { CONSULTANTS } from "../../shared/consultants.ts";
import type { Anim, BubbleStyle, FxKind, Item } from "../../shared/protocol.ts";
import * as A from "./activities.ts";
import { startChat } from "./brain.ts";
import { IMPROVISE, REACT, chance, cap, fill, pick } from "./content.ts";
import { localAnswer } from "./dialogue.ts";
import { callVacuum, summonGhost, summonPigeon, summonStrindberg } from "./events.ts";
import * as S from "./schemes.ts";
import { dist, type Char, type Step, type World } from "./world.ts";

export interface PromptResult {
  ok: boolean;
  text: string;
  plan: string[];
  via: string;
}

export type Intent =
  | { do: "goto"; target: string; run?: boolean; sneak?: boolean }
  | { do: "say"; text: string; style?: BubbleStyle }
  | { do: "ask"; person: string; question: string }
  | { do: "tell"; person: string; text: string }
  | { do: "anim"; anim: Anim; seconds?: number; room?: string }
  | { do: "use"; object: string }
  | { do: "draw"; what?: string }
  | { do: "scheme"; name: string; target?: string; topic?: string }
  | { do: "wait"; seconds: number }
  | { do: "think"; text: string }
  | { do: "item"; item: Item | null }
  | { do: "fx"; fx: FxKind }
  | { do: "follow"; person: string; seconds?: number }
  | { do: "hug"; person: string }
  | { do: "chat"; person: string; topic?: string }
  | { do: "sit"; target?: string }
  | { do: "improvise"; text: string };

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

// ---------------------------------------------------------------------------
// Målresolvering
type Target = { kind: "person"; id: string } | { kind: "room"; id: RoomId } | { kind: "spot"; spot: SpotKind; prefer?: string } | { kind: "npc"; id: string };

const ROOM_WORDS: [RegExp, RoomId][] = [
  [/kok|pentry|matsal|fikarum|lunchrum|kylen|fikat/, "pentry"],
  [/server/, "server"],
  [/passag/, "passage"],
  [/\brwc|handikapptoa|stora toa/, "rwc"],
  [/\btoa|toalett|\bwc|badrum|dass|muggen/, "wc"],
  [/kontor norr|norra kontor|lilla kontor|kontor 1|alt 1/, "kontor1"],
  [/burspr/, "kontor2"],
  [/storkontor|stora kontor|kontorslandskap|landskapet|open space|alt 2/, "kontor3"],
  [/entre|hall|kapprum|reception|ingang/, "hall"],
  [/samtal|telefonbas|telefonrum|fokusrum/, "samtal"],
  [/korridor/, "korridor"],
  [/runda motesrum|runda rummet|lilla motesrum/, "mote_rund"],
  [/stora motesrum|motesrum|konferens/, "mote_stor"],
  [/lounge|soffrum|vardagsrum|soffhorn/, "lounge"],
  [/balkong|kungsbalkong|ut pa balkongen|utomhus|ute/, "balkong"],
  [/trapphus|trappan|trapporna/, "trapphus"],
];

const SPOT_WORDS: [RegExp, SpotKind][] = [
  [/kaffe|espresso|cortado|latte/, "coffee"],
  [/kylskap|kylen/, "fridge"],
  [/diskmaskin/, "dishwasher"],
  [/diskho|vasken|kranen/, "sink"],
  [/mikro|spisen/, "stove"],
  [/whiteboard|tavlan|skrivtavla/, "whiteboard"],
  [/fatolj/, "armchair"],
  [/soffa/, "sofa"],
  [/bank(en)?\b/, "bench"],
  [/fonst|utsikt/, "window"],
  [/vaxt|blomm|bengt|krukvaxt/, "plant"],
  [/serverrack|servern/, "server"],
  [/arkad|spelmaskin|tv-spel/, "arcade"],
  [/kakelugn|ugnen|brasan/, "kakelugn"],
  [/skrivar|printer/, "printer"],
  [/frukt|banan|apple/, "fruit"],
  [/vattenautomat|vattnet|vatten/, "water"],
  [/hatthyll|jackor|klader/, "coatrack"],
  [/skrivbord|min plats|mitt bord|datorn/, "desk"],
  [/matbord/, "dining"],
  [/tv:n|\btv\b|teven|skarmen/, "tv"],
  [/telefon/, "phone"],
  [/dorr|entredorr|ytterdorr/, "entrance"],
];

const ALIASES: [RegExp, string][] = [
  [/sara\s*d\b|doltz/, "sara_d"],
  [/sara\s*h\b|hernandez/, "sara_h"],
];

export function resolvePerson(w: World, c: Char, raw: string): Char | null {
  const s = norm(raw);
  for (const [re, id] of ALIASES) if (re.test(s)) return w.byId.get(id) ?? null;
  const hits = w.chars.filter((o) => {
    const full = norm(o.c.name);
    const first = norm(o.c.first.split(" ")[0]);
    return s === full || s.includes(full) || new RegExp(`(^|\\W)${first}(\\W|$|s\\b)`).test(s);
  });
  if (hits.length) return hits.filter((h) => h !== c).sort((a, b) => dist(a, c) - dist(b, c))[0] ?? hits[0];
  if (/\b(narmaste|nagon|en kollega|nagon kollega|grannen)\b/.test(s)) {
    return w.chars.filter((o) => o !== c).sort((a, b) => dist(a, c) - dist(b, c))[0] ?? null;
  }
  if (/\b(slumpmassig|random|vem som helst)\b/.test(s)) return pick(w.chars.filter((o) => o !== c));
  return null;
}

export function resolveTarget(w: World, c: Char, raw: string): Target | null {
  const s = norm(raw);
  if (!s) return null;
  if (/dammbert|dammsugar/.test(s)) return { kind: "npc", id: "dammbert" };
  const p = resolvePerson(w, c, raw);
  if (p && p !== c) return { kind: "person", id: p.id };
  if (/mitt skrivbord|min plats|mitt bord|skrivbordet/.test(s) && c.homeSpot) return { kind: "spot", spot: "desk", prefer: c.homeSpot };
  // föremål först om ordet är specifikt (t.ex. "kaffemaskinen", "whiteboarden"), annars rum
  for (const [re, k] of SPOT_WORDS) if (re.test(s) && !/^(kok|pentry|hall|entre)/.test(s)) return { kind: "spot", spot: k };
  for (const [re, id] of ROOM_WORDS) if (re.test(s)) return { kind: "room", id };
  const room = ROOMS.find((r) => norm(r.name).includes(s) || s.includes(norm(r.name)));
  if (room) return { kind: "room", id: room.id };
  return null;
}

function roomGoal(w: World, room: RoomId, c: Char): { x: number; y: number } | null {
  // Försök hitta en ledig ruta nära rummets "mitt"
  const tiles: { x: number; y: number }[] = [];
  const idx = ROOMS.findIndex((r) => r.id === room);
  for (let y = 0; y < w.map.h; y++) for (let x = 0; x < w.map.w; x++) if (w.map.room[y * w.map.w + x] === idx && w.walkable(x, y) && w.map.tiles[y * w.map.w + x] === 1) tiles.push({ x, y });
  if (!tiles.length) return null;
  const cx = tiles.reduce((s, t) => s + t.x, 0) / tiles.length;
  const cy = tiles.reduce((s, t) => s + t.y, 0) / tiles.length;
  const free = tiles.filter((t) => !w.occupied(t.x, t.y, c));
  const list = free.length ? free : tiles;
  list.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy) + (Math.random() - 0.5) * 3);
  return list[0];
}

function gotoSteps(w: World, c: Char, t: Target, run?: boolean, sneak?: boolean): Step[] {
  const moveAnim: Anim | undefined = sneak ? "sneak" : undefined;
  const speed = sneak ? 2.2 : undefined;
  if (t.kind === "person") {
    const p = w.byId.get(t.id)!;
    return [{ t: "toChar", id: p.id, run, label: `Gå till ${p.name}` }];
  }
  if (t.kind === "npc") return [{ t: "toChar", id: t.id, run, label: "Gå till Dammbert" }];
  if (t.kind === "room") {
    const g = roomGoal(w, t.id, c);
    const r = ROOMS.find((q) => q.id === t.id)!;
    return g ? [{ t: "go", x: g.x, y: g.y, run, moveAnim, speed, label: `Gå ${r.toRoom}` }] : [];
  }
  return [{ t: "spot", kind: t.spot, prefer: t.prefer, run, label: `Gå till ${spotName(t.spot)}` }];
}

const SPOT_NAMES: Partial<Record<SpotKind, string>> = {
  coffee: "kaffemaskinen",
  fridge: "kylskåpet",
  dishwasher: "diskmaskinen",
  sink: "diskhon",
  stove: "mikron",
  whiteboard: "närmaste whiteboard",
  armchair: "en fåtölj",
  sofa: "soffan",
  bench: "bänken",
  window: "fönstret",
  plant: "en krukväxt",
  server: "servern",
  arcade: "arkadmaskinen",
  kakelugn: "kakelugnen",
  printer: "skrivaren",
  fruit: "fruktskålen",
  water: "vattenautomaten",
  coatrack: "hatthyllan",
  desk: "skrivbordet",
  dining: "matbordet",
  tv: "tv:n",
  phone: "samtalsrummet",
  entrance: "entrédörren",
  toilet: "toa",
  balcony: "balkongen",
};
const spotName = (k: SpotKind) => SPOT_NAMES[k] ?? k;

// ---------------------------------------------------------------------------
// Intent → steg
const ANIMS: Anim[] = ["idle", "dance", "jump", "wave", "cheer", "cry", "panic", "yoga", "juggle", "pushup", "flex", "think", "point", "sneak", "read", "drink", "eat", "phone", "talk", "sleep", "frozen", "float", "conga", "game", "vr", "draw", "type"];
const ANIM_NAMES: Partial<Record<Anim, string>> = {
  dance: "Dansa",
  jump: "Hoppa",
  wave: "Vinka",
  cheer: "Jubla",
  cry: "Gråta",
  panic: "Få panik",
  yoga: "Yoga",
  juggle: "Jonglera",
  pushup: "Armhävningar",
  flex: "Flexa",
  think: "Fundera",
  point: "Peka",
  sneak: "Smyga",
  read: "Läsa",
  frozen: "Frysa",
  float: "Sväva",
  game: "Spela",
};

function useSteps(w: World, c: Char, obj: string): Step[] {
  const t = resolveTarget(w, c, obj);
  const kind: SpotKind | null = t?.kind === "spot" ? t.spot : null;
  const room = t?.kind === "room" ? t.id : null;
  const label = (steps: Step[], l: string) => {
    if (steps[0]) steps[0].label = steps[0].label ?? l;
    return steps;
  };
  if (room === "balkong") return label(A.balcony(w, c), "Gå ut på balkongen");
  if (room === "wc" || room === "rwc") return label(A.toilet(w, c), "Gå på toa");
  if (room === "samtal") return label(A.phone(w, c), "Ringa ett samtal");
  switch (kind) {
    case "coffee":
      return label(A.coffee(w, c), "Hämta kaffe");
    case "fridge":
    case "stove":
    case "dining":
      return label(A.eat(w, c), "Äta");
    case "fruit":
      return label(A.fruit(w, c), "Äta frukt");
    case "water":
      return label(A.water(w, c), "Dricka vatten");
    case "whiteboard":
      return label(A.whiteboard(w, c), "Rita på whiteboarden");
    case "plant":
      return label(A.plant(w, c), "Prata med växten");
    case "window":
      return label(A.lookOutWindow(w, c), "Titta ut");
    case "server":
      return label(A.server(w, c), "Stirra på servern");
    case "arcade":
      return label(A.arcade(w, c), "Spela arkadspel");
    case "phone":
      return label(A.phone(w, c), "Ringa");
    case "kakelugn":
      return label(A.kakelugn(w, c), "Värma sig vid kakelugnen");
    case "printer":
      return label(A.printer(w, c), "Skriva ut");
    case "tv":
      return label(A.tv(w, c), "Titta på tv");
    case "sofa":
    case "armchair":
    case "bench":
      return label(A.sofaRead(w, c), "Sätta sig");
    case "dishwasher":
      return label(A.dishwasher(w, c), "Tömma diskmaskinen");
    case "desk":
      return label(A.work(w, c, 30), "Jobba");
    case "coatrack":
      return [{ t: "spot", kind: "coatrack", label: "Gå till hatthyllan" }, { t: "anim", anim: "think", dur: 2 }, { t: "say", text: "Var är min jacka? Den här är från 2017." }, { t: "leave" }];
    default:
      return t ? gotoSteps(w, c, t) : [];
  }
}

function swapPronouns(s: string): string {
  return s
    .replace(/\b(hen|han|hon)\b/gi, "du")
    .replace(/\b(hens|hans|hennes)\b/gi, "din")
    .replace(/\bsig själv\b/gi, "dig själv");
}

const EXPLAIN = [
  "Pilarna betyder 'typ'.",
  "Den här rutan är molnet. Den här rutan är också molnet.",
  "Allt hänger ihop via kaffemaskinen.",
  "Frågor? Bra. Inga svar.",
  "Jag kallar den 'Version 7 final FINAL'.",
  "Läs den uppifrån och ner, sen nerifrån och upp.",
];

function runScheme(w: World, c: Char, name: string, target?: string, topic?: string): Step[] {
  const label = SCHEME_LABEL[name] ?? `Starta ${name}`;
  return [
    {
      t: "do",
      label,
      fn: (w) => {
        const rest = [...c.queue];
        const room = target ? resolveTarget(w, c, target) : null;
        const roomId = room?.kind === "room" ? room.id : undefined;
        const person = target ? resolvePerson(w, c, target) : null;
        let ok = false;
        switch (name) {
          case "rave":
            ok = S.rave(w, c, roomId === "lounge" || roomId === "mote_stor" || roomId === "kontor3" || roomId === "hall" || roomId === "pentry" ? roomId : undefined);
            break;
          case "konga":
            ok = S.conga(w, c);
            break;
          case "stolrace":
            ok = S.chairRace(w, c);
            break;
          case "gympa":
            ok = S.gympa(w, c);
            break;
          case "krismote":
            ok = S.krismote(w, c, topic);
            break;
          case "debatt": {
            const near = w.chars.filter((o) => o !== c && w.interruptible(o)).sort((a, b) => dist(a, c) - dist(b, c)).slice(0, 2);
            for (const o of near) w.interrupt(o, [{ t: "toChar", id: c.id }]);
            ok = near.length > 0 && S.debate(w, c, near);
            break;
          }
          case "fika":
            ok = S.fika(w, c);
            break;
          case "karaoke":
            ok = S.karaoke(w, c);
            break;
          case "allhands":
            ok = S.allhands(w, c);
            break;
          case "brandovning":
            ok = S.firedrill(w);
            break;
          case "flashmob":
            ok = S.flashmob(w, c);
            break;
          case "tur":
            ok = S.tour(w, c);
            break;
          case "standup":
            ok = S.standup(w, c);
            break;
          case "ceremoni":
            ok = S.plantCeremony(w, c);
            break;
          case "gomkopp":
            ok = S.hideMug(w, c, person && person !== c ? person.id : undefined);
            break;
          case "csskris":
            ok = S.cssCrisis(w, c);
            break;
          case "gamote":
            ok = S.walkMeeting(w, c);
            break;
          case "enkat":
            ok = S.survey(w, c);
            break;
          case "tupplur":
            w.assign(c, A.nap(w, c, true));
            ok = true;
            break;
        }
        if (!ok) {
          const big = w.activeBig();
          if (big?.joinable && !big.members.has(c.id)) {
            w.say(c, `Det pågår redan ${big.label.toLowerCase()}! Jag hakar på!`, "say", { log: true });
            w.enlist(big, c);
            big.onJoin?.(w, c);
            c.queue.push(...rest);
            return;
          }
          w.say(c, big ? `Det pågår redan ${big.label.toLowerCase()} – jag tar det sen.` : pick(["Hmm, det gick inte just nu.", "Ingen ville vara med. Typiskt.", "Det fanns inget att gömma just nu."]));
          return;
        }
        c.queue.push(...rest);
      },
    },
  ];
}

const SCHEME_LABEL: Record<string, string> = {
  rave: "Starta ett kontorsrave",
  konga: "Starta ett kongatåg",
  stolrace: "Utmana någon på stolrace",
  gympa: "Leda pausgympa",
  krismote: "Kalla till krismöte",
  debatt: "Starta en debatt",
  fika: "Utlysa fika",
  karaoke: "Sjunga karaoke",
  allhands: "Kalla till all-hands",
  brandovning: "Utlösa brandövning",
  flashmob: "Starta mannequin challenge",
  tur: "Hålla en guidad tur",
  standup: "Hålla daily standup",
  ceremoni: "Hylla Bengt",
  gomkopp: "Gömma någons kopp",
  csskris: "Få en CSS-kris",
  gamote: "Hålla gåmöte",
  enkat: "Skicka en enkät",
  tupplur: "Ta en dramatisk tupplur",
};

export function intentsToSteps(w: World, c: Char, intents: Intent[]): Step[] {
  const out: Step[] = [];
  for (const it of intents.slice(0, 10)) {
    switch (it.do) {
      case "goto": {
        const t = resolveTarget(w, c, it.target);
        if (!t) {
          out.push({ t: "say", text: `Var ligger "${it.target}"? Jag letar...`, label: `Leta efter ${it.target}` }, ...A.wander(w, c));
          break;
        }
        if (t.kind === "spot" && ["coffee", "whiteboard", "window", "plant", "sofa", "armchair", "server", "arcade", "kakelugn", "printer", "fruit", "water", "tv", "desk", "dining", "bench", "coatrack", "phone", "entrance", "fridge", "sink", "stove", "dishwasher"].includes(t.spot)) {
          out.push({ t: "spot", kind: t.spot, prefer: t.prefer, run: it.run, label: `Gå till ${spotName(t.spot)}` });
        } else out.push(...gotoSteps(w, c, t, it.run, it.sneak));
        break;
      }
      case "say": {
        const text = it.text.trim().slice(0, 200);
        if (!text) break;
        const style: BubbleStyle = it.style ?? (/!{2,}|^[A-ZÅÄÖ\s!?]{6,}$/.test(text) ? "shout" : "say");
        out.push({ t: "say", text, style, log: "force", wait: 1.2, label: `Säga "${text.length > 28 ? text.slice(0, 26) + "…" : text}"` });
        out.push({
          t: "do",
          fn: (w) => {
            // Nämner man någon vid namn svarar den personen
            const named = w.chars.find((o) => o !== c && new RegExp(`\\b${norm(o.c.first.split(" ")[0])}\\b`).test(norm(text)) && dist(o, c) < 14 && o.ctrl !== "player");
            if (named) {
              w.later(1.5, () => {
                w.faceTo(named, c);
                w.say(named, /\?/.test(text) ? localAnswer(named, text, c) : pick([...REACT.generic, "Ja?", "Vad vill du?", "Jag hör dig!"]));
              });
            } else w.stimulus(c, style === "shout" ? "shout" : /\?/.test(text) ? "question" : "generic", style === "shout" ? 0.7 : 0.3, { max: 2 });
          },
        });
        break;
      }
      case "ask": {
        if (/^(alla|allihop|nagon|rummet)$/.test(norm(it.person))) {
          out.push({ t: "say", text: cap(it.question.replace(/\?*$/, "?")), style: "shout", log: "force", wait: 1.5, label: "Fråga alla" });
          out.push({
            t: "do",
            fn: (w) => {
              const near = w.chars.filter((o) => o !== c && o.ctrl !== "player" && dist(o, c) < 12).slice(0, 3);
              near.forEach((o, i) => w.later(1 + i * 2, () => w.say(o, localAnswer(o, it.question, c), "say", { log: true })));
            },
          });
          break;
        }
        const p = resolvePerson(w, c, it.person);
        if (!p || p === c) {
          out.push({ t: "say", text: `${cap(it.question.replace(/\?*$/, "?"))} ...någon?`, label: "Fråga ut i rummet" });
          break;
        }
        out.push(...A.ask(w, c, p, cap(swapPronouns(it.question))));
        break;
      }
      case "tell": {
        const p = resolvePerson(w, c, it.person);
        if (!p) break;
        const msg = swapPronouns(it.text).replace(/\.$/, "");
        out.push({ t: "toChar", id: p.id, label: `Gå till ${p.name}` });
        out.push({ t: "say", text: `${p.name}, ${msg}!`, to: p.id, log: "force", wait: 1.5, label: `Berätta för ${p.name}` });
        out.push({
          t: "do",
          fn: (w) => {
            if (p.ctrl === "player") return;
            w.interrupt(p, [{ t: "face", toward: c.id }, { t: "wait", dur: 0.5 }]);
            w.later(1.4, () => w.say(p, /\?/.test(msg) ? localAnswer(p, msg, c) : pick(["Va?! Seriöst?", "Okej, tack för infon!", "Det här ändrar allt.", "Jag visste det!", "Hmm, intressant.", "Varför berättar du det här för mig?"]), "say", { log: true }));
          },
        });
        break;
      }
      case "anim": {
        const anim = ANIMS.includes(it.anim) ? it.anim : "think";
        if (it.room) {
          const t = resolveTarget(w, c, it.room);
          if (t) out.push(...gotoSteps(w, c, t));
        }
        if (anim === "sleep") {
          const st = A.nap(w, c);
          st[0].label = "Ta en tupplur";
          out.push(...st);
          break;
        }
        const dur = Math.max(2, Math.min(30, it.seconds ?? (anim === "dance" ? 12 : 5)));
        if (anim === "dance") out.push({ t: "fx", fx: "notes", dur: 3, n: 2 });
        out.push({ t: "anim", anim, dur, act: ANIM_NAMES[anim] ?? "Gör något", label: ANIM_NAMES[anim] ?? cap(anim) });
        if (anim === "dance" || anim === "panic" || anim === "cry")
          out.push({ t: "do", fn: (w) => w.stimulus(c, anim === "dance" ? "dance" : anim === "panic" ? "panic" : "dramatic", 0.55, { max: 3 }) });
        break;
      }
      case "use":
        out.push(...useSteps(w, c, it.object));
        break;
      case "draw": {
        const what = it.what?.trim() ? `${it.what.trim().replace(/^(en|ett)\s+/i, (m) => m)} – ${pick(EXPLAIN)}` : undefined;
        const st = A.whiteboard(w, c, what);
        st[1].label = "Gå till närmaste whiteboard";
        out.push(...st);
        break;
      }
      case "scheme":
        out.push(...runScheme(w, c, it.name, it.target, it.topic));
        break;
      case "wait":
        out.push({ t: "wait", dur: Math.max(1, Math.min(60, it.seconds)), label: `Vänta ${Math.round(it.seconds)} s` });
        break;
      case "think":
        out.push({ t: "think", text: it.text.slice(0, 160), label: "Tänka" });
        break;
      case "item":
        out.push({ t: "item", item: it.item, dur: 60, label: it.item ? `Ta ${it.item}` : "Lägga ifrån sig" });
        break;
      case "fx":
        out.push({ t: "fx", fx: it.fx, dur: 3, n: 3, label: "Specialeffekt!" });
        break;
      case "follow": {
        const p = resolvePerson(w, c, it.person);
        if (p) out.push({ t: "toChar", id: p.id, label: `Följa ${p.name}` }, { t: "follow", id: p.id, dur: Math.min(60, it.seconds ?? 25) });
        break;
      }
      case "hug": {
        const p = resolvePerson(w, c, it.person);
        if (p && p !== c) out.push(...S.hug(w, c, p));
        break;
      }
      case "chat": {
        const t = resolveTarget(w, c, it.person);
        if (t?.kind === "spot" && t.spot === "plant") {
          out.push(...A.plant(w, c));
          break;
        }
        const p = resolvePerson(w, c, it.person);
        if (p && p !== c) {
          const st = startChat(w, c, p, it.topic ? `${p.name}, jag måste prata om ${it.topic}.` : undefined);
          if (Array.isArray(st)) {
            st[1].label = `Prata med ${p.name}`;
            out.push(...st);
          }
        }
        break;
      }
      case "sit": {
        const t = it.target ? resolveTarget(w, c, it.target) : null;
        const kind: SpotKind[] = t?.kind === "spot" && ["sofa", "armchair", "bench", "dining", "desk", "toilet"].includes(t.spot) ? [t.spot] : ["sofa", "armchair", "bench", "dining"];
        out.push({ t: "spot", kind, room: t?.kind === "room" ? t.id : undefined, label: "Sätta sig" }, { t: "anim", anim: "sit", dur: 8 });
        break;
      }
      case "improvise": {
        const x = it.text.replace(/^(att|och)\s+/i, "").slice(0, 60);
        out.push(
          { t: "say", text: fill(pick(IMPROVISE), { x }), label: `Improvisera: ${x}` },
          { t: "fx", fx: "question", dur: 2 },
          { t: "anim", anim: pick(["dance", "jump", "think", "point", "flex", "juggle", "yoga"] as const), dur: 4 },
          { t: "do", fn: (w) => w.stimulus(c, "generic", 0.4, { max: 2 }) },
        );
        break;
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Lokal svensk tolk
const VERB_START =
  /^(ga|gar|spring|springer|rusa|smyg|promenera|vandra|ta dig|marschera|moonwalka|kryp|skutta|ila|sag|saga|ropa|skrik|viska|sjung|utbrist|berätta|beratta|meddela|annonsera|fraga|prata|snacka|chatta|krama|ge|folj|vanta|tank|fundera|hamta|ta|drick|gor|gora|brygg|fixa|at|ata|luncha|kaka|fika|dansa|sov|vila|lagg|tuppla|jobba|arbeta|koda|designa|skissa|rita|klottra|mala|ring|hoppa|vinka|jubla|heja|fira|applodera|grat|grina|panik|fa panik|yoga|meditera|jonglera|armhavningar|flexa|peka|las|spela|titta|kolla|vattna|hall|halla|starta|dra igang|kor|borja|ordna|utlys|kalla|organisera|stada|skriv|tom|oppna|varm|satt|stall|stand|gom|high|kasta|leta|besok|uppsok|forsok|hylla|bjud|sno|stjal|klappa|nys|hosta|sucka|le|skratta|lyssna|vissla|nynna|pussa|tacka|halsa|presentera|pitcha)\b/;

const PREFIX = /^(och|sen|sedan|da|darefter|sa|snalla|kan du|du ska|jag vill att du|var snall och|borja|fortsatt|forsok|ga och|spring och|ga bort och)\s+/;

function splitClauses(text: string, quotes: string[]): string[] {
  // Säg: … tar resten av texten som tal
  const parts = text.split(/(\s*(?:,|;|\.(?=\s|$)|!(?=\s)|\?(?=\s)|\boch sedan\b|\boch sen\b|\boch darefter\b|\boch dar\b|\bsedan\b|\bsen\b|\bdarefter\b|\boch\b|\bthen\b)\s*)/i);
  const clauses: string[] = [];
  let buf = "";
  for (let i = 0; i < parts.length; i += 2) {
    const piece = parts[i].trim();
    const sep = parts[i - 1] ?? "";
    if (!piece) continue;
    const n = norm(piece).replace(PREFIX, "");
    if (!buf || VERB_START.test(n) || /^⟦\d+⟧/.test(piece)) {
      if (buf) clauses.push(buf);
      buf = piece;
    } else buf += sep + piece;
  }
  if (buf) clauses.push(buf);
  void quotes;
  return clauses;
}

function restoreQuotes(s: string, quotes: string[]): string {
  return s.replace(/⟦(\d+)⟧/g, (_, i) => quotes[+i] ?? "");
}

function parseClause(w: World, c: Char, raw: string, quotes: string[]): Intent[] {
  const orig = restoreQuotes(raw, quotes).trim();
  let s = norm(raw).replace(PREFIX, "").replace(PREFIX, "");
  const sOrig = orig.replace(/^(och|sen|sedan|då|därefter|så|snälla|börja|fortsätt|försök)\s+/i, "");
  const out: Intent[] = [];
  const quoted = (): string | null => {
    const m = raw.match(/⟦(\d+)⟧/);
    return m ? quotes[+m[1]] : null;
  };
  const roomOf = (t: string) => {
    const r = resolveTarget(w, c, t);
    return r?.kind === "room" ? t : undefined;
  };

  // --- tal ---
  let m = s.match(/^(sag|saga|ropa|skrik|viska|sjung|utbrist|meddela|annonsera)\s+(?:till|at|for)\s+(.+?)\s+att\s+(.+)$/);
  if (m) {
    const style: BubbleStyle = m[1] === "ropa" || m[1] === "skrik" ? "shout" : m[1] === "viska" ? "whisper" : m[1] === "sjung" ? "sing" : "say";
    const who = m[2];
    const tail = quoted() ?? sOrig.replace(/^.*?\satt\s/i, "");
    if (/^(alla|allihop|alla pa kontoret)$/.test(who)) return [{ do: "say", text: cap(tail), style: style === "say" ? "shout" : style }];
    return [{ do: "tell", person: who, text: tail }];
  }
  m = s.match(/^(berätta|beratta)\s+(?:for|till)\s+(.+?)\s+(?:att|om)\s+(.+)$/);
  if (m) return [{ do: "tell", person: m[2], text: quoted() ?? sOrig.replace(/^.*?\s(att|om)\s/i, "") }];
  m = s.match(/^(sag|saga|ropa|skrik|viska|sjung|utbrist|meddela|annonsera)\b\s*:?\s*(.*)$/);
  if (m) {
    const style: BubbleStyle = m[1] === "ropa" || m[1] === "skrik" ? "shout" : m[1] === "viska" ? "whisper" : m[1] === "sjung" ? "sing" : "say";
    const text = quoted() ?? sOrig.replace(/^\S+\s*:?\s*/, "");
    if (!text) return [{ do: "say", text: style === "sing" ? "♪ La la laaa ♪" : "Hej!", style }];
    return [{ do: "say", text: style === "sing" && !/♪/.test(text) ? `♪ ${text} ♪` : text, style }];
  }
  // --- frågor ---
  m = s.match(/^fraga\s+(alla|allihop|nagon|rummet)\s*(?:om|:)?\s*(.*)$/);
  if (m) return [{ do: "ask", person: "alla", question: quoted() ?? sOrig.replace(/^fråga\s+\S+\s*(om|:)?\s*/i, "") }];
  m = s.match(/^fraga\s+(.+?)\s+(om|ifall|vad|hur|varfor|nar|vem|var|vilken|vilket|vilka|vart)\s+(.+)$/);
  if (m) {
    const who = m[1];
    const word = m[2];
    const restOrig = sOrig.replace(/^fråga\s+.+?\s+(om|ifall|vad|hur|varför|när|vem|var|vilken|vilket|vilka|vart)\s+/i, "");
    let q = quoted();
    if (!q) {
      if (word === "om" || word === "ifall") {
        // "om vi ska bygga X" → "ska vi bygga X"
        let r = swapPronouns(restOrig);
        const mm = r.match(/^(vi|du|jag|ni|de|man|det|den)\s+(\S+)\s*(.*)$/i);
        if (mm) r = `${mm[2]} ${mm[1].toLowerCase()} ${mm[3]}`.trim();
        q = r;
      } else {
        // "vad hon tycker om X" → "vad tycker du om X"
        const wh = sOrig.match(/\s(vad|hur|varför|när|vem|var|vilken|vilket|vilka|vart)\s/i)?.[1] ?? word;
        let r = swapPronouns(restOrig);
        const mm = r.match(/^(du|vi|jag|ni|de|man|det)\s+(\S+)\s*(.*)$/i);
        if (mm) r = `${mm[2]} ${mm[1].toLowerCase()} ${mm[3]}`.trim();
        q = `${wh} ${r}`;
      }
    }
    return [{ do: "ask", person: who, question: q }];
  }
  m = s.match(/^fraga\s+(.+)$/);
  if (m) {
    const q = quoted();
    const p = resolvePerson(w, c, m[1]);
    if (p) return [{ do: "ask", person: m[1], question: q ?? "Hur mår du egentligen?" }];
  }
  // --- sociala ---
  m = s.match(/^(prata|snacka|chatta|surra|diskutera)\s+(?:med\s+)?(.+?)(?:\s+om\s+(.+))?$/);
  if (m) return [{ do: "chat", person: m[2], topic: m[3] ? sOrig.replace(/^.*?\som\s/i, "") : undefined }];
  m = s.match(/^(krama|kramas med|ge\s+(.+?)\s+en kram|high[- ]?five(?:\s+med)?|ge\s+(.+?)\s+en high[- ]?five|klappa)\s*(.*)$/);
  if (m) return [{ do: "hug", person: m[2] ?? m[3] ?? m[4] ?? "" }];
  m = s.match(/^folj(?:\s+efter)?\s+(.+?)(?:\s+i\s+(\d+)\s*s.*)?$/);
  if (m) return [{ do: "follow", person: m[1], seconds: m[2] ? +m[2] : undefined }];
  m = s.match(/^(vanta|sta still|pausa)(?:\s+i)?\s*(\d+)?/);
  if (m) return [{ do: "wait", seconds: m[2] ? +m[2] : 5 }];
  m = s.match(/^(tank|fundera|grubbla)(?:\s+pa)?\s*(.*)$/);
  if (m) return [{ do: "think", text: quoted() ?? (sOrig.replace(/^\S+\s*(på)?\s*/i, "") || "Hmm...") }];

  // --- upptåg (scheman) ---
  const schemes: [RegExp, string][] = [
    [/\b(rave|fest|disco|party|klubb|dansgolv)\b/, "rave"],
    [/\b(konga|kongatag|conga)\b/, "konga"],
    [/\b(stolrace|kontorsstolsrace|race|kapplopning)\b/, "stolrace"],
    [/\b(pausgympa|gympa|jympa|traningspass|motionspass)\b/, "gympa"],
    [/\b(krismote|brainstorm|kris-mote|idemote)\b/, "krismote"],
    [/\b(debatt|gral|brak|diskussion|tvist)\b/, "debatt"],
    [/\b(fredagsfika|fikastund|utlys fika|bjud pa fika)\b/, "fika"],
    [/\bkaraoke\b/, "karaoke"],
    [/\b(all-?hands|stormote|personalmote)\b/, "allhands"],
    [/\b(brandovning|brandlarm)\b/, "brandovning"],
    [/\b(flashmob|mannequin|mannekang|frys alla)\b/, "flashmob"],
    [/\b(guidad tur|rundtur|visning|guida)\b/, "tur"],
    [/\b(standup|stand-up|daily)\b/, "standup"],
    [/\b(ceremoni|hylla bengt|hylla vaxten)\b/, "ceremoni"],
    [/\b(gom|gomma|sno|stjal)\b.*\bkopp|\bta\s+\w+s\s+kopp/, "gomkopp"],
    [/\b(css|centrera|div)\b/, "csskris"],
    [/\bgamote\b/, "gamote"],
    [/\b(enkat|undersokning)\b/, "enkat"],
    [/\bdramatisk tupplur\b/, "tupplur"],
  ];
  for (const [re, name] of schemes) {
    if (re.test(s) && (/^(starta|dra igang|kor|borja|ordna|anordna|utlys|kalla|hall|ha|organisera|gor|bjud|leda|led|ga pa|gom|gomma|sno|stjal|ta|fa|hylla|guida|skicka|sjung|frys|utlos|anordna|trigga|dramatisk)\b/.test(s) || s.split(" ").length <= 3)) {
      const target = s.match(/\b(?:i|pa|till)\s+(.+)$/)?.[1];
      const topic = name === "krismote" ? sOrig.match(/\bom\s+(.+)$/i)?.[1] : undefined;
      const victim = name === "gomkopp" ? s.match(/\b(\w+?)s?\s+kopp/)?.[1] : undefined;
      return [{ do: "scheme", name, target: victim ?? target, topic }];
    }
  }

  // --- förflyttning ---
  m = s.match(/^(ga|gar|spring|springer|rusa|smyg|smyger|promenera|vandra|ta dig|marschera|moonwalka|kryp|skutta|ila|besok|uppsok)\b\s*(?:in |ut |bort |fram |tillbaka |upp |ner |ivag |hem )?(?:till|in i|in pa|ut pa|ut till|mot|bort till|fram till|pa|i)?\s*(.*)$/);
  if (m) {
    const verb = m[1];
    let rest = m[2].trim();
    const run = /^(spring|springer|rusa|ila|skutta)/.test(verb);
    const sneak = /^(smyg|kryp)/.test(verb);
    if (verb === "moonwalka") c.moonwalk = w.time + 30;
    if (!rest) {
      out.push({ do: "anim", anim: sneak ? "sneak" : "think", seconds: 2 });
      return out;
    }
    rest = rest.replace(/^(narmaste|den narmaste|en|ett)\s+/, "");
    // "gå och X" hanteras av PREFIX; "gå till köket och hämta" splittas tidigare
    out.push({ do: "goto", target: rest, run, sneak });
    return out;
  }
  // --- ät/drick ---
  if (/\b(kaffe|espresso|cortado|latte|cappuccino|kaffekopp)\b/.test(s) && /^(hamta|ta|drick|gor|gora|brygg|fixa|kop|bestall|koka|en|lite|mer|ga|kaffe)/.test(s)) return [{ do: "use", object: "kaffemaskinen" }];
  if (/\bvatten\b/.test(s) && /^(hamta|ta|drick)/.test(s)) return [{ do: "use", object: "vattenautomaten" }];
  if (/\b(banan|frukt|apple|clementin)\b/.test(s) && /^(at|ata|ta|hamta|mumsa)/.test(s)) return [{ do: "use", object: "fruktskålen" }];
  if (/^(at|ata|luncha|kaka|mumsa|ta lunch|varm (min )?(mat|matlada)|fika)\b/.test(s)) return [{ do: "use", object: "kylskåpet" }];
  // --- rörelser/animationer ---
  const animMap: [RegExp, Anim][] = [
    [/^(dansa|dansar|disco|boogie|twerka|breakdansa|shuffla)/, "dance"],
    [/^(sov|sova|vila|ta en tupplur|tuppla|lagg dig|slumra|ta en powernap)/, "sleep"],
    [/^hoppa/, "jump"],
    [/^vinka/, "wave"],
    [/^(jubla|heja|fira|applodera|klappa handerna)/, "cheer"],
    [/^(grat|grata|grina|snyfta|bor(ja)? grata)/, "cry"],
    [/^(fa panik|panik|fa ett utbrott)/, "panic"],
    [/^(yoga|meditera|gor yoga)/, "yoga"],
    [/^jonglera/, "juggle"],
    [/^(gor )?armhavningar/, "pushup"],
    [/^(flexa|spann musklerna|visa musklerna)/, "flex"],
    [/^peka/, "point"],
    [/^(las|lasa)/, "read"],
    [/^(frys|sta helt still|var en staty)/, "frozen"],
    [/^(svav|levitera|flyg)/, "float"],
  ];
  for (const [re, anim] of animMap) {
    if (re.test(s)) {
      const room = s.match(/\b(?:i|pa|vid)\s+(.+)$/)?.[1];
      if (room && anim === "sleep") {
        const t = resolveTarget(w, c, room);
        if (t) out.push({ do: "goto", target: room });
      }
      out.push({ do: "anim", anim, room: room && anim !== "sleep" && roomOf(room) ? room : undefined, seconds: +(s.match(/(\d+)\s*s/)?.[1] ?? 0) || undefined });
      return out;
    }
  }
  // --- använda saker ---
  m = s.match(/^(rita|skissa|klottra|mala)\b\s*(.*)$/);
  if (m) {
    const what = sOrig.replace(/^\S+\s*/, "").replace(/\s*(på|på den|vid)\s+(närmaste\s+)?(whiteboard(en)?|tavlan).*$/i, "");
    return [{ do: "draw", what: what || undefined }];
  }
  if (/^(jobba|arbeta|koda|designa|pixelputsa|skriv kod|gor wireframes|figma|sitt och jobba)/.test(s)) return [{ do: "use", object: "mitt skrivbord" }];
  if (/^(ring|ringa|telefonera)/.test(s)) return [{ do: "use", object: "samtalsrummet" }];
  if (/^(spela)/.test(s)) return [{ do: "use", object: "arkadmaskinen" }];
  if (/^(titta|kolla|stirra)\b.*\b(ut|fonst|utsikt)/.test(s)) return [{ do: "use", object: "fönstret" }];
  if (/^(titta|kolla)\b.*\b(tv)/.test(s)) return [{ do: "use", object: "tv:n" }];
  if (/^vattna/.test(s) || /\bvaxt|bengt|blomm/.test(s)) return [{ do: "use", object: "krukväxten" }];
  if (/^(hall|halla)\b.*\btal/.test(s)) {
    const t = quoted() ?? sOrig.match(/\bom\s+(.+)$/i)?.[1];
    return [{ do: "goto", target: "balkongen" }, { do: "say", text: t ? `Folket på Norra Bantorget! ${cap(t)}!` : "Folket på Norra Bantorget! Jag har en vision!", style: "shout" }, { do: "anim", anim: "cheer", seconds: 3 }];
  }
  if (/^(skriv ut|printa)/.test(s)) return [{ do: "use", object: "skrivaren" }];
  if (/^(tom|toem)\b.*\bdiskmaskin/.test(s)) return [{ do: "use", object: "diskmaskinen" }];
  if (/^(oppna)\b.*\b(kyl)/.test(s)) return [{ do: "use", object: "kylskåpet" }];
  if (/^(varm|elda)\b/.test(s)) return [{ do: "use", object: "kakelugnen" }];
  if (/^(satt dig|sitt|ta plats)/.test(s)) return [{ do: "sit", target: s.replace(/^(satt dig|sitt|ta plats)\s*(i|pa|vid)?\s*/, "") || undefined }];
  if (/^(stall dig|stand upp|res dig)/.test(s)) return [{ do: "anim", anim: "idle", seconds: 1 }];
  if (/^(stada|plocka)/.test(s)) return [{ do: "goto", target: "passagen" }, { do: "anim", anim: "sneak", seconds: 5 }, { do: "say", text: "Det var ingen som städade. Nu är det jag. Ni är välkomna." }];
  if (/^(kasta|stro)\b.*\b(konfetti|glitter)/.test(s)) return [{ do: "fx", fx: "confetti" }, { do: "anim", anim: "cheer", seconds: 3 }];
  if (/^(skratta)/.test(s)) return [{ do: "say", text: "HAHAHAHA", style: "shout" }, { do: "anim", anim: "cheer", seconds: 2 }];
  if (/^(sucka)/.test(s)) return [{ do: "say", text: "*djup suck*", style: "whisper" }];
  if (/^(vissla|nynna)/.test(s)) return [{ do: "say", text: "♪ fiuu fiu fiuuu ♪", style: "sing" }];
  if (/^(nys)/.test(s)) return [{ do: "say", text: "ATJOO!", style: "shout" }];

  // Kanske är det ett rum/objekt direkt ("pentryt!", "kaffe!")
  const t = resolveTarget(w, c, s);
  if (t && s.split(" ").length <= 3) {
    if (t.kind === "spot") return [{ do: "use", object: s }];
    return [{ do: "goto", target: s }];
  }
  return [{ do: "improvise", text: sOrig }];
}

export function parseLocal(w: World, c: Char, text: string): Intent[] {
  const quotes: string[] = [];
  let t = text.replace(/(^|[\s:])["“”„«»']([^"“”„«»']{1,200})["“”„«»'](?=$|[\s,.!?;:])/g, (_, pre: string, q: string) => {
    quotes.push(q);
    return `${pre}⟦${quotes.length - 1}⟧`;
  });
  // "Säg: …" utan citattecken → resten är tal
  const colon = t.match(/^(.*?)(\b(?:säg|ropa|skrik|viska|sjung)\s*:\s*)(.+)$/i);
  let tail: Intent | null = null;
  if (colon && !/⟦/.test(colon[3])) {
    const verb = norm(colon[2]);
    const style: BubbleStyle = /ropa|skrik/.test(verb) ? "shout" : /viska/.test(verb) ? "whisper" : /sjung/.test(verb) ? "sing" : "say";
    tail = { do: "say", text: colon[3].trim(), style };
    t = colon[1];
  }
  const intents: Intent[] = [];
  for (const cl of t.trim() ? splitClauses(t, quotes) : []) intents.push(...parseClause(w, c, cl, quotes));
  if (tail) intents.push(tail);
  // Inga verb alls → det är troligen tal
  if (intents.length && intents.every((i) => i.do === "improvise") && text.length < 140 && !VERB_START.test(norm(text))) {
    return [{ do: "say", text: text.trim() }];
  }
  return intents;
}

// ---------------------------------------------------------------------------
// LLM-tolkning
const LLM_SCHEMES = ["rave", "konga", "stolrace", "gympa", "krismote", "debatt", "fika", "karaoke", "allhands", "brandovning", "flashmob", "tur", "standup", "ceremoni", "gomkopp", "csskris", "gamote", "enkat", "tupplur"];

async function parseLlm(w: World, c: Char, text: string): Promise<{ intents: Intent[]; reply: string } | null> {
  if (!w.llm) return null;
  const people = w.chars.map((o) => `${o.id} (${o.c.name})`).join(", ");
  const rooms = ROOMS.map((r) => `${r.id} (${r.name})`).join(", ");
  const objects = Object.entries(SPOT_NAMES)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
  const system = [
    "Du styr en karaktär i SimVariant, ett humoristiskt pixel-simspel på designbyrån Variants kontor (Barnhusgatan 20, Stockholm).",
    "Översätt spelarens svenska instruktion till en kort plan med konkreta steg. Var trogen instruktionen, i rätt ordning.",
    "Om instruktionen är vag, konstig eller omöjlig: välj närmaste möjliga handlingar och låt karaktären säga något roligt och personligt. Hitta aldrig på elaka eller kränkande saker.",
    `Rum (id): ${rooms}.`,
    `Föremål (id=namn): ${objects}.`,
    `Personer (id): ${people}.`,
    `Animationer: ${ANIMS.join(", ")}.`,
    `Upptåg (scheme): ${LLM_SCHEMES.join(", ")}.`,
    "Stegtyper (JSON):",
    '{"do":"goto","target":"<rum-id, föremåls-id eller person-id>","run":false}',
    '{"do":"say","text":"...","style":"say|shout|whisper|sing"}',
    '{"do":"ask","person":"<person-id eller alla>","question":"..."}',
    '{"do":"tell","person":"<person-id>","text":"..."}',
    '{"do":"anim","anim":"<animation>","seconds":5}',
    '{"do":"use","object":"<föremåls-id>"}  (kaffe=coffee, äta=fridge, jobba=desk, toa=toilet osv.)',
    '{"do":"draw","what":"vad som ritas på whiteboarden"}',
    '{"do":"scheme","name":"<upptåg>","target":"<rum/person valfritt>","topic":"<valfritt>"}',
    '{"do":"hug","person":"<person-id>"}  {"do":"chat","person":"<person-id>","topic":"..."}  {"do":"follow","person":"<id>","seconds":20}',
    '{"do":"think","text":"..."}  {"do":"wait","seconds":3}',
    'Svara som JSON: {"reply":"kort kommentar i karaktär (max 80 tecken)","plan":[ ...max 8 steg... ]}',
  ].join("\n");
  const user = `Karaktär: ${c.c.name} (${c.c.title}). Personlighet: ${c.c.quirkText} Står just nu ${w.roomOf(c)?.inRoom ?? "på kontoret"}.\nSpelarens instruktion: ${text}`;
  const res = await w.llm.json<{ reply?: string; plan?: Record<string, unknown>[] }>(system, user, { maxTokens: 1500, timeoutMs: 11000 });
  if (!res?.plan || !Array.isArray(res.plan) || !res.plan.length) return null;
  const intents: Intent[] = [];
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  for (const p of res.plan.slice(0, 10)) {
    const d = str(p.do);
    switch (d) {
      case "goto": {
        const tgt = str(p.target);
        const person = w.byId.get(tgt);
        const room = ROOMS.find((r) => r.id === tgt);
        intents.push({ do: "goto", target: person ? person.c.name : room ? room.name : SPOT_NAMES[tgt as SpotKind] ?? tgt, run: !!p.run });
        break;
      }
      case "say":
        intents.push({ do: "say", text: str(p.text), style: (["say", "shout", "whisper", "sing"].includes(str(p.style)) ? str(p.style) : "say") as BubbleStyle });
        break;
      case "ask":
      case "tell":
      case "hug":
      case "chat":
      case "follow": {
        const pid = str(p.person);
        const name = pid === "alla" ? "alla" : w.byId.get(pid)?.c.name ?? pid;
        if (d === "ask") intents.push({ do: "ask", person: name, question: str(p.question) || "Hur mår du?" });
        else if (d === "tell") intents.push({ do: "tell", person: name, text: str(p.text) });
        else if (d === "hug") intents.push({ do: "hug", person: name });
        else if (d === "chat") intents.push({ do: "chat", person: name, topic: str(p.topic) || undefined });
        else intents.push({ do: "follow", person: name, seconds: typeof p.seconds === "number" ? p.seconds : undefined });
        break;
      }
      case "anim":
        intents.push({ do: "anim", anim: (ANIMS.includes(str(p.anim) as Anim) ? str(p.anim) : "think") as Anim, seconds: typeof p.seconds === "number" ? p.seconds : undefined });
        break;
      case "use": {
        const o = str(p.object);
        intents.push({ do: "use", object: SPOT_NAMES[o as SpotKind] ?? ROOMS.find((r) => r.id === o)?.name ?? o });
        break;
      }
      case "draw":
        intents.push({ do: "draw", what: str(p.what) || undefined });
        break;
      case "scheme":
        if (LLM_SCHEMES.includes(str(p.name))) intents.push({ do: "scheme", name: str(p.name), target: str(p.target) || undefined, topic: str(p.topic) || undefined });
        break;
      case "think":
        intents.push({ do: "think", text: str(p.text) });
        break;
      case "wait":
        intents.push({ do: "wait", seconds: typeof p.seconds === "number" ? p.seconds : 3 });
        break;
    }
  }
  if (!intents.length) return null;
  return { intents, reply: str(res.reply).slice(0, 120) };
}

// ---------------------------------------------------------------------------
// Easter eggs
function egg(w: World, c: Char, text: string): { steps: Step[]; reply: string } | null {
  const s = norm(text);
  const sparkle: Step = { t: "fx", fx: "sparkle", dur: 2.5, n: 3 };
  if (/^(\/)?(hjalp|help|\?)$/.test(s)) return { steps: [], reply: "Testa: \"Gå till pentryt och hämta kaffe\", \"Säg 'Fredagsfika!!'\", \"Starta ett rave\", \"Fråga Emil om AI\", \"Rita en obegriplig arkitekturskiss\"… och leta easter eggs." };
  if (/^banan[!.]*$|losenord/.test(s)) {
    w.addLog(`${c.name} skrev lösenordet i chatten. Det regnar bananer.`, "🍌", "secret", c.id);
    const near = w.chars.filter((o) => o !== c && o.ctrl !== "player").sort((a, b) => dist(a, c) - dist(b, c))[0];
    if (near) w.later(1.5, () => w.say(near, "Psst... det där är ju lösenordet! Byt det!", "whisper", { log: true }));
    return { steps: [{ t: "fx", fx: "bananas", dur: 6, n: 5, at: [c.x, c.y - 3] }, { t: "item", item: "banan", dur: 30 }, { t: "say", text: "BANAN! Vänta... det var visst hemligt.", style: "shout", log: "force" }, { t: "anim", anim: "panic", dur: 2 }], reply: "🍌🍌🍌" };
  }
  if (/\b(iddqd|gudlage|god ?mode)\b/.test(s)) {
    w.addLog(`${c.name} har aktiverat gudläge.`, "✨", "secret", c.id);
    return { steps: [{ t: "effect", effect: "gold", dur: 60 }, sparkle, { t: "say", text: "Jag känner mig... odödlig.", style: "shout", log: "force" }, { t: "anim", anim: "float", dur: 5 }], reply: "Gudläge aktiverat i 60 sekunder." };
  }
  if (/\bmoonwalk/.test(s)) {
    c.moonwalk = w.time + 30;
    const p = w.randomTileIn(pick(["hall", "passage", "kontor3"] as RoomId[]));
    return { steps: [{ t: "say", text: "*glider baklänges med stil*", log: "force" }, ...(p ? ([{ t: "go", x: p.x, y: p.y, label: "Moonwalka" }] as Step[]) : [])], reply: "Moonwalk-läge i 30 sekunder." };
  }
  if (/\b42\b|meningen med livet/.test(s)) return { steps: [sparkle, { t: "say", text: "42.", style: "shout", log: "force" }, { t: "anim", anim: "think", dur: 3 }, { t: "say", text: "...men vad var frågan?" }], reply: "Svaret är 42." };
  if (/strindberg/.test(s)) {
    summonStrindberg(w);
    return { steps: [{ t: "say", text: "Strindberg? Bodde han inte runt hörnet?", log: true }, { t: "go", x: 10, y: 34 }, { t: "anim", anim: "panic", dur: 2 }], reply: "Du har väckt något." };
  }
  if (/\b(spoke|spoket|spoken|ande)\b/.test(s)) {
    summonGhost(w);
    return { steps: [{ t: "say", text: "Spöken finns inte... eller hur?", style: "whisper", log: true }, { t: "anim", anim: "panic", dur: 3 }], reply: "👻" };
  }
  if (/\b(kurr|duva|duvan|gunnar)\b/.test(s)) {
    summonPigeon(w);
    return { steps: A.balcony(w, c, "Kurr kurr! Gunnar, min vän!"), reply: "Gunnar är på väg." };
  }
  if (/dammbert|dammsugar/.test(s)) {
    callVacuum(w, c);
    return { steps: [{ t: "say", text: "DAMMBERT! Hit!", style: "shout", log: true }, { t: "anim", anim: "wave", dur: 3 }], reply: "Dammbert har fått ett uppdrag." };
  }
  if (/\b(abba|dancing queen|waterloo)\b/.test(s)) {
    const room = w.roomOf(c)?.id ?? "hall";
    w.disco = room;
    w.worldDirty = true;
    w.addLog(`${c.name} satte på ABBA. Hela rummet dansar.`, "🪩", "secret", c.id);
    for (const o of w.charsInRoom(room)) if (o !== c && w.interruptible(o)) w.interrupt(o, [{ t: "anim", anim: "dance", dur: 15 }]);
    w.later(18, () => {
      if (w.disco === room && !w.activeBig()) {
        w.disco = null;
        w.worldDirty = true;
      }
    });
    return { steps: [{ t: "say", text: "♪ Mamma mia, nu dansar vi! ♪", style: "sing", log: "force" }, { t: "anim", anim: "dance", dur: 15 }], reply: "🪩" };
  }
  if (/\b(xyzzy|plugh)\b/.test(s)) {
    const p = w.randomTileIn(pick(["server", "balkong", "samtal", "mote_rund", "pentry"] as RoomId[]));
    return { steps: [{ t: "say", text: "Ingenting händer." }, { t: "wait", dur: 2 }, sparkle, ...(p ? ([{ t: "teleport", x: p.x, y: p.y }] as Step[]) : []), sparkle, { t: "say", text: "...eller?", log: "force" }], reply: "Ett gammalt magiskt ord." };
  }
  if (/\bteleport/.test(s)) {
    const t = resolveTarget(w, c, s.replace(/.*teleport\w*\s*(till)?\s*/, ""));
    const p = t?.kind === "room" ? w.randomTileIn(t.id) : w.randomTileIn(pick(ROOMS.filter((r) => !r.outside)).id);
    return { steps: [sparkle, { t: "say", text: "Beam me up, Barnhusgatan!", log: "force" }, ...(p ? ([{ t: "teleport", x: p.x, y: p.y, label: "Teleportera" }] as Step[]) : []), sparkle], reply: "Teleporterar..." };
  }
  if (/\b(krymp|bli liten|liten som en mus)\b/.test(s)) return { steps: [sparkle, { t: "effect", effect: "tiny", dur: 45 }, { t: "say", text: "Varför är allt så STORT?!", style: "shout", log: "force" }], reply: "Du krymper." };
  if (/\b(vax|bli stor|jatte|enorm)\b/.test(s) && !/bengt|vaxt/.test(s)) return { steps: [sparkle, { t: "effect", effect: "giant", dur: 40 }, { t: "say", text: "JAG ÄR STOR NU. TAKHÖJDEN ÄR 3,4 METER, DET RÄCKER PRECIS.", style: "shout", log: "force" }], reply: "Du växer." };
  if (/\bregnbag/.test(s)) return { steps: [{ t: "effect", effect: "rainbow", dur: 40 }, { t: "fx", fx: "rainbow", dur: 4, n: 2 }, { t: "say", text: "Smaka på regnbågen!", log: "force" }], reply: "🌈" };
  if (/\b(brinn|i brand|eld i haret)\b/.test(s)) {
    w.later(1, () => w.stimulus(c, "panic", 0.9));
    return { steps: [{ t: "effect", effect: "fire", dur: 8 }, { t: "say", text: "VARFÖR ÄR DET VARMT PÅ MITT HUVUD?!", style: "shout", log: "force" }, { t: "anim", anim: "panic", dur: 4 }, { t: "say", text: "...okej det var bara en idé. En brinnande idé." }], reply: "🔥" };
  }
  if (/\bhissen\b/.test(s)) {
    const h = w.npcById.get("hissen");
    if (h) w.later(4, () => w.say(h, "Hissen är trasig sedan 1998.", "say"));
    return { steps: [{ t: "go", x: 8, y: 33, label: "Gå till hissen" }, { t: "anim", anim: "think", dur: 3 }, { t: "say", text: "Jag tar trappan. Som alltid." }], reply: "Hissen, ja..." };
  }
  if (/(kaffe\s*x\s*\d+|\d+\s*koppar kaffe|(tio|fem|tjugo|hundra) (koppar )?kaffe|massor av kaffe)/.test(s)) {
    c.needs.koffein = 160;
    return { steps: A.overload(w, c), reply: "Det där var mycket kaffe." };
  }
  if (/\b(konami|uuddlrlrba)\b/.test(s)) return { steps: [{ t: "say", text: "↑↑↓↓←→←→BA... prova på tangentbordet!", log: "force" }], reply: "Ett tips: tangentbordet." };
  if (/\b(rickroll|never gonna)\b/.test(s)) {
    for (const o of w.chars.filter((o) => o !== c && dist(o, c) < 10).slice(0, 3)) w.later(2 + Math.random() * 2, () => w.say(o, pick(["NEJ. Inte igen.", "Jag blev lurad. Igen.", "*suck*"])));
    return { steps: [{ t: "say", text: "*nynnar en misstänkt bekant 80-talslåt*", style: "sing", log: "force" }, { t: "anim", anim: "dance", dur: 8 }], reply: "Du vet vad du gjorde." };
  }
  if (/\b(hejda|hej da|ga hem)\b/.test(s)) return { steps: [{ t: "go", x: 8, y: 33, label: "Gå mot utgången" }, { t: "anim", anim: "wave", dur: 3 }, { t: "say", text: "Hejdå allihop! ...nej vänta, jag bor ju här nu.", log: "force" }, { t: "anim", anim: "think", dur: 2 }], reply: "Ingen lämnar Barnhusgatan." };
  if (/\b(fyrverkeri|fyrverkerier|smallare)\b/.test(s)) return { steps: [{ t: "fx", fx: "stars", dur: 3, n: 4 }, { t: "fx", fx: "confetti", dur: 3, n: 4 }, { t: "say", text: "GOTT NYTT ÅR! Eller vad det nu är för dag.", style: "shout", log: "force" }], reply: "🎆" };
  if (/\b(lat det snoa|snostorm|vinter)\b/.test(s)) {
    w.weather = "sno";
    w.worldDirty = true;
    return { steps: [{ t: "say", text: "Låt det snöa!", style: "shout", log: "force" }, { t: "anim", anim: "cheer", dur: 3 }], reply: "❄️" };
  }
  if (/\b(slack lampan|slack ljuset|slack allt|morker)\b/.test(s)) {
    w.lights = false;
    w.worldDirty = true;
    w.later(9, () => {
      w.lights = true;
      w.worldDirty = true;
    });
    return { steps: [{ t: "say", text: "*klick*", log: "force" }, { t: "wait", dur: 2 }, { t: "say", text: "Ooops.", style: "whisper" }], reply: "Mörkt." };
  }
  if (/\bbengt\b/.test(s) && !/ceremoni|hylla/.test(s)) {
    const b = w.npcById.get("bengt");
    return { steps: [{ t: "go", x: 16, y: 33, label: "Gå till Bengt" }, { t: "face", dir: 3 }, { t: "say", text: "Bengt, jag behöver ett råd." }, { t: "do", fn: (w) => void (b && w.later(1.5, () => w.say(b, pick(["Bengt säger: 'Mer ljus. Mindre möten.'", "Bengt säger: 'Vattna dina idéer.'", "Bengt säger: 'Jag har sett allt. Du klarar det.'"]), "whisper"))) }, { t: "wait", dur: 3 }], reply: "Bengt lyssnar." };
  }
  return null;
}

// ---------------------------------------------------------------------------
const OK_REPLIES = ["Uppfattat!", "Fixar det!", "Absolut, chefen!", "Jag är på det!", "Okej okej!", "Kör!", "Det här blir bra."];

export async function handlePrompt(w: World, c: Char, raw: string): Promise<PromptResult> {
  let text = raw.replace(/\s+/g, " ").trim().slice(0, 300);
  if (!text) return { ok: false, text: "Skriv vad du vill att din karaktär ska göra.", plan: [], via: "lokal" };
  let prefix: Step[] = [];
  const sudo = text.match(/^sudo\s+(.+)$/i);
  if (sudo) {
    text = sudo[1];
    prefix = [{ t: "say", text: "Okej.", log: "force" }, { t: "fx", fx: "sparkle", dur: 2, n: 3 }];
  }
  w.lastPlayerActivity = w.time;
  w.addLog(`${c.name} (spelare): ${text}`, "🎮", "player", c.id, w.roomOf(c)?.name);

  const e = egg(w, c, text);
  if (e) e.steps = e.steps.map((st) => ({ ...st }));
  if (e) {
    if (e.steps.length) {
      if (c.schemeId) w.leaveScheme(c);
      if (e.steps[0] && !e.steps[0].label) e.steps[0].label = "Hemligt kommando";
      w.assign(c, [...prefix, ...e.steps], "player");
      c.playerIdleSince = 0;
    }
    return { ok: true, text: e.reply, plan: e.steps.map((s) => s.label).filter((x): x is string => !!x), via: "easter egg" };
  }

  // Avbryt nuvarande aktivitet och visa att karaktären funderar
  if (c.schemeId) w.leaveScheme(c);
  c.ctrl = "player";
  c.playerIdleSince = 0;
  w.assign(c, [{ t: "anim", anim: c.pose === "sit" ? "sit" : "think", dur: 12, act: "Funderar på instruktionen", icon: "💭" }], "player");

  let intents: Intent[] | null = null;
  let reply = "";
  let via = "lokal tolk";
  if (w.llm) {
    const r = await parseLlm(w, c, text).catch(() => null);
    if (r) {
      intents = r.intents;
      reply = r.reply;
      via = w.llmLabel;
    }
  }
  if (!intents) intents = parseLocal(w, c, text);
  const steps = [...prefix, ...intentsToSteps(w, c, intents)];
  if (!steps.length) {
    w.assign(c, [{ t: "say", text: "Hmm, jag förstod inte riktigt. Kan du säga det på ett annat sätt?" }], "player");
    return { ok: false, text: "Karaktären förstod inte – prova t.ex. \"Gå till pentryt och säg 'Hej!'\".", plan: [], via };
  }
  w.assign(c, steps, "player");
  c.playerIdleSince = 0;
  const plan = steps.map((s) => s.label).filter((x): x is string => !!x);
  if (reply) w.say(c, reply, "think");
  return { ok: true, text: reply || pick(OK_REPLIES), plan, via };
}
