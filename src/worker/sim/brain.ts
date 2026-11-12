// Karaktärernas autonoma AI: behov, nyttobaserade beslut, reaktioner och samtal.
import type { RoomId, SpotKind } from "../../shared/map.ts";
import * as A from "./activities.ts";
import {
  DAMMBERT_LINES,
  GHOST_LINES,
  GUNNAR_LINES,
  MUSIC_COMMENT,
  MUSIC_HATE,
  MUSIC_LOVE,
  MUSIC_SILENCE_HATE,
  MUSIC_WAR,
  NIGHT_LINES,
  REACT,
  SHHH,
  chance,
  fill,
  pick,
} from "./content.ts";
import { TRACK_BY_ID, type TrackId } from "../../shared/music.ts";
import { llmDialogue, localDialogue, type Line } from "./dialogue.ts";
import * as S from "./schemes.ts";
import { dist, type Actor, type Char, type Npc, type Step, type StimulusOpts, type World } from "./world.ts";

const R = (a: number, b: number) => a + Math.random() * (b - a);

export function updateNeeds(w: World, c: Char, dt: number) {
  const n = c.needs;
  const t = c.c.traits;
  const working = c.anim === "type";
  const sleeping = c.anim === "sleep";
  const socializing = c.anim === "talk" || c.anim === "dance" || c.anim === "conga" || !!c.schemeId;
  n.koffein = Math.max(0, n.koffein - dt * (0.11 + t.energi * 0.07));
  n.energi = Math.max(0, Math.min(100, n.energi + dt * (sleeping ? 3 : -0.1 - (c.anim === "run" || c.anim === "dance" ? 0.3 : 0))));
  n.hunger = Math.min(100, n.hunger + dt * 0.13);
  n.socialt = Math.max(0, Math.min(100, n.socialt + dt * (socializing ? 1.6 : -0.22 * (0.5 + t.social))));
  n.fokus = Math.max(0, Math.min(100, n.fokus + dt * (working ? 0.7 : -0.12)));
  n.inspiration = Math.max(0, Math.min(100, n.inspiration + dt * (working ? -0.15 : 0.05) + (Math.random() < 0.002 ? 20 : 0)));
  let k = dt * (0.11 * (0.4 + t.kaos) + (n.koffein > 85 ? 0.25 : 0) + (n.energi < 20 ? 0.1 : 0) + (working ? -0.08 : 0));
  if (sleeping) k = -dt * 0.6;
  n.kaos = Math.max(0, Math.min(100, n.kaos + k));
}

type Option = { key: string; score: number; run: () => Step[] | boolean; cd: number };

export function decide(w: World, c: Char) {
  const n = c.needs;
  const t = c.c.traits;
  const h = w.clock.hour;
  const lunch = h >= 11 && h < 13;
  const night = w.nightFactor() > 0.5;
  const cdOk = (k: string) => (c.cooldown[k] ?? 0) <= w.time;
  const opts: Option[] = [];
  const add = (key: string, score: number, run: () => Step[] | boolean, cd = 0) => {
    if (cdOk(key) && score > 0) opts.push({ key, score: score + Math.random() * 0.45, run, cd });
  };

  add("coffee", ((100 - n.koffein) / 100) * 1.1 + (n.koffein < 25 ? 0.6 : 0) - 0.15, () => A.coffee(w, c), 60);
  add("eat", (n.hunger / 100) * 1.15 + (lunch ? 0.45 : 0) - 0.25, () => A.eat(w, c), 60);
  add("fruit", (n.hunger / 100) * 0.45, () => A.fruit(w, c), 90);
  add("work", 0.55 + t.fokus * 0.4 - (night ? 0.25 : 0) - n.kaos / 300 + (n.fokus < 40 ? 0.15 : 0), () => A.work(w, c), 5);
  add("chat", ((100 - n.socialt) / 100) * (0.55 + t.social * 0.8), () => startChat(w, c), 18);
  add("nap", ((100 - n.energi) / 100) * 1.25 - 0.35 + (night ? 0.35 : 0), () => A.nap(w, c), 90);
  add("toilet", 0.07 + Math.min(0.2, c.coffees * 0.015), () => A.toilet(w, c), 160);
  add("whiteboard", (n.inspiration / 100) * 0.42 * (0.5 + t.nyfiken), () => A.whiteboard(w, c), 180);
  add(
    "inspire",
    ((100 - n.inspiration) / 100) * 0.75,
    () => {
      const r = Math.random();
      if (r < 0.3) return A.lookOutWindow(w, c);
      if (r < 0.5) return A.plant(w, c);
      if (r < 0.68) return A.balcony(w, c);
      if (r < 0.82) return A.server(w, c);
      return A.kakelugn(w, c);
    },
    45,
  );
  add("quirk", 0.38 + t.drama * 0.25, () => A.quirk(w, c), 75);
  add("chaos", n.kaos > 50 ? ((n.kaos - 50) / 50) * 1.7 : 0, () => chaos(w, c), 45);
  add(
    "misc",
    0.3,
    () => {
      const r = Math.random();
      if (r < 0.14) return A.arcade(w, c);
      if (r < 0.26) return A.printer(w, c);
      if (r < 0.38) return A.water(w, c);
      if (r < 0.48) return A.tv(w, c);
      if (r < 0.64) return A.sofaRead(w, c);
      if (r < 0.74) return A.phone(w, c);
      if (r < 0.77) return A.dishwasher(w, c);
      if (r < 0.86) return A.plant(w, c);
      return A.wander(w, c);
    },
    20,
  );
  add("wander", 0.18, () => A.wander(w, c), 8);
  if (w.time >= w.musicNext) {
    const cur = w.music.track;
    const taste = c.c.music;
    add("music", 0.02 + (cur === taste.hate ? 0.45 : 0) + (cur === "off" ? 0.3 : 0) + (n.kaos > 60 ? 0.1 : 0) - (cur === taste.fav ? 0.4 : 0), () => A.jukebox(w, c), 600);
  }
  if (night) add("night", 0.25, () => [{ t: "think", text: pick(NIGHT_LINES) }, ...A.wander(w, c)], 60);

  // Vilt jokerkort: ibland gör man bara något helt oväntat
  if (chance(0.07)) opts.push({ key: "chaos", score: 99, run: () => chaos(w, c), cd: 45 });

  opts.sort((a, b) => b.score - a.score);
  for (const o of opts.slice(0, 4)) {
    const res = o.run();
    c.cooldown[o.key] = w.time + o.cd + Math.random() * o.cd * 0.5;
    if (res === true) return;
    if (Array.isArray(res) && res.length) {
      w.assign(c, res);
      return;
    }
  }
  w.assign(c, [{ t: "anim", anim: c.pose === "sit" ? "sit" : "idle", dur: R(1, 3) }]);
}

/** Vilda infall när kaosmätaren är hög. */
export function chaos(w: World, c: Char): Step[] | boolean {
  const t = c.c.traits;
  const big = !!w.activeBig();
  const opts: [number, () => boolean | Step[]][] = [
    [t.smyg * 1.2, () => S.hideMug(w, c)],
    [t.nyfiken * 0.9 + t.drama * 0.4, () => S.krismote(w, c)],
    [t.drama * 0.8, () => A.balcony(w, c)],
    [t.drama * 0.6, () => A.nap(w, c, true)],
    [0.25, () => A.overload(w, c)],
    [0.15, () => A.dishwasher(w, c)],
    [0.12, () => (S.cssCrisis(w, c) ? [] : false)],
  ];
  if (!big) {
    opts.push(
      [(t.drama + t.social) * 0.6, () => S.rave(w, c)],
      [t.social * 0.8, () => S.conga(w, c)],
      [(t.energi + t.kaos) * 0.45, () => S.chairRace(w, c)],
      [t.energi * 0.6, () => S.gympa(w, c)],
      [t.drama * 0.6, () => S.karaoke(w, c)],
      [t.drama * 0.35, () => S.flashmob(w, c)],
      [t.social * 0.35, () => S.tour(w, c)],
      [0.25, () => S.plantCeremony(w, c)],
      [t.social * 0.3, () => S.fika(w, c)],
    );
  }
  const total = opts.reduce((s, o) => s + o[0], 0);
  for (let tries = 0; tries < 4; tries++) {
    let r = Math.random() * total;
    for (const [wgt, fn] of opts) {
      r -= wgt;
      if (r <= 0) {
        const res = fn();
        if (res === true || (Array.isArray(res) && res.length)) {
          c.needs.kaos = Math.max(0, c.needs.kaos - 55);
          w.stats.kaos++;
          w.worldDirty = true;
          return res;
        }
        break;
      }
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Samtal
export function startChat(w: World, c: Char, target?: Char, topicText?: string): Step[] | boolean {
  const cand =
    target ??
    w.chars
      .filter((o) => o !== c && w.interruptible(o) && o.anim !== "sleep" && dist(o, c) < 30)
      .map((o) => ({ o, s: (c.rel[o.id] ?? 0) / 40 + Math.random() * 2 - dist(o, c) / 25 }))
      .sort((a, b) => b.s - a.s)[0]?.o;
  if (!cand) return false;
  return [
    { t: "act", act: `Går för att prata med ${cand.name}`, icon: "💬" },
    { t: "toChar", id: cand.id, label: `Gå till ${cand.name}` },
    {
      t: "do",
      fn: (w) => {
        if (cand.ctrl === "player" || (!w.interruptible(cand) && cand.schemeId)) {
          w.think(c, `${cand.name} verkar upptagen...`);
          return;
        }
        if (c.ctrl === "ai" && chance(cand.c.traits.fokus * 0.25) && cand.anim === "type") {
          w.say(c, `${cand.name}, har du en sekund?`);
          w.later(1.5, () => w.say(cand, pick(["Inte riktigt, jag är i flow!", "Sen! Jag har en deadline.", "*hörlurar på*"])));
          return [{ t: "wait", dur: 3 }];
        }
        converse(w, c, cand, topicText);
        return { replace: [{ t: "anim", anim: "idle", dur: 40 }] };
      },
    },
  ];
}

export function converse(w: World, a: Char, b: Char, topicText?: string) {
  const s = w.newScheme("chat", a, { label: `${a.name} & ${b.name} pratar`, dur: 45 });
  w.enlist(s, b);
  w.release(b);
  w.assign(b, [{ t: "face", toward: a.id }, { t: "anim", anim: "idle", dur: 45 }]);
  w.faceTo(a, b);
  w.setIcon(a, "💬", 8);
  w.setIcon(b, "💬", 8);
  a.act = `Pratar med ${b.name}`;
  b.act = `Pratar med ${a.name}`;

  const play = (lines: Line[], start: number) => {
    let t = start;
    for (const l of lines) {
      const text = l.text;
      w.later(t, () => {
        if (!w.schemes.has(s.id)) return;
        w.say(l.who, text, "say", { log: chance(0.35) });
      });
      t += 2.2 + text.length * 0.05;
    }
    w.later(t + 0.2, () => {
      w.remember(a, `pratade med ${b.name}`);
      w.remember(b, `pratade med ${a.name}`);
      w.relate(a, b, 2);
      w.endScheme(s.id);
    });
    s.endsAt = w.time + t + 2;
  };

  if (topicText) {
    play([{ who: a, text: topicText }, ...localDialogue(w, a, b).slice(3)], 0.2);
    return;
  }
  const useLlm = w.llm && w.viewers > 0 && w.time >= llmNext;
  if (useLlm) {
    llmNext = w.time + 9;
    const local = localDialogue(w, a, b);
    // hälsning direkt, resten när LLM svarat (eller lokalt som reserv)
    play(local.slice(0, 1), 0.2);
    s.endsAt = w.time + 45;
    let done = false;
    const fallback = () => {
      if (done) return;
      done = true;
      play(local.slice(1), 0.1);
    };
    w.later(9, fallback);
    void llmDialogue(w, a, b).then((lines) => {
      if (done || !w.schemes.has(s.id)) return;
      if (!lines) return fallback();
      done = true;
      play(lines.slice(1), 0.1);
    });
  } else {
    play(localDialogue(w, a, b), 0.2);
  }
}
let llmNext = 0;

// ---------------------------------------------------------------------------
// Social smitta
export function react(w: World, c: Char, src: Actor, kind: string, opts: StimulusOpts) {
  const t = c.c.traits;
  const s = opts.scheme ? w.schemes.get(opts.scheme) : null;
  if (s?.joinable && w.interruptible(c)) {
    const joinP = (t.kaos + t.social + t.energi) / 3;
    if (chance(joinP * 0.85)) {
      w.enlist(s, c);
      s.onJoin?.(w, c);
      return;
    }
  }
  if (src.type === "char" && src.anim === "sleep") {
    w.later(R(0.3, 1.2), () => w.say(c, pick(SHHH), "whisper"));
    return;
  }
  if (kind === "ghost") {
    if (!w.interruptible(c)) return void w.say(c, pick(REACT.ghost), "shout");
    const away = w.randomTileIn(pick(["kontor1", "pentry", "lounge", "samtal"] as RoomId[]));
    w.interrupt(c, [{ t: "say", text: pick(REACT.ghost), style: "shout", log: true }, ...(away ? ([{ t: "go", x: away.x, y: away.y, run: true, moveAnim: "panic" }] as Step[]) : []), { t: "anim", anim: "panic", dur: 3 }]);
    return;
  }
  const loud = ["shout", "rave", "panic", "race", "explosion", "conga"].includes(kind);
  const lines = REACT[kind] ?? REACT.generic;
  if (loud && t.fokus > 0.72 && w.interruptible(c) && chance(0.35)) {
    const quiet: SpotKind[] = ["phone", "armchair", "desk", "server"];
    w.interrupt(c, [{ t: "say", text: pick(REACT.flee), wait: 0.3 }, { t: "spot", kind: quiet, room: pick(["samtal", "kontor1", "server"] as RoomId[]) }, { t: "anim", anim: "type", dur: 15, act: "Flydde till ett tystare rum", icon: "🎧" }, { t: "leave" }]);
    return;
  }
  if (w.interruptible(c) && chance(t.nyfiken * 0.45) && dist(c, src) < 14 && src.type === "char") {
    w.interrupt(c, [{ t: "toChar", id: src.id, dist: 2 }, { t: "say", text: pick(lines) }, { t: "anim", anim: kind === "idea" ? "think" : "idle", dur: 2.5 }]);
    return;
  }
  w.later(R(0.4, 1.6), () => w.say(c, pick(lines), "say", { log: chance(0.15) }));
}

// ---------------------------------------------------------------------------
// NPC:er
export function npcThink(w: World, n: Npc) {
  switch (n.kind) {
    case "vacuum": {
      const rooms: RoomId[] = ["passage", "hall", "kontor3", "kontor2", "mote_stor", "lounge", "pentry", "korridor", "kontor1", "mote_rund"];
      const p = w.randomTileIn(pick(rooms), false);
      const steps: Step[] = [];
      if (p) steps.push({ t: "go", x: p.x, y: p.y });
      steps.push({ t: "wait", dur: R(1, 5) });
      if (chance(0.06)) steps.push({ t: "say", text: pick(DAMMBERT_LINES) });
      w.assign(n, steps);
      break;
    }
    case "pigeon": {
      const p = w.randomTileIn("balkong", false);
      w.assign(n, [...(p ? ([{ t: "go", x: p.x, y: p.y, speed: 1.6 }] as Step[]) : []), { t: "anim", anim: "eat", dur: R(2, 5) }, ...(chance(0.25) ? ([{ t: "say", text: pick(GUNNAR_LINES) }] as Step[]) : [])]);
      break;
    }
    case "ghost": {
      const p = w.randomTileIn(pick(["hall", "passage", "korridor", "mote_rund", "pentry"] as RoomId[]), false);
      w.assign(n, [
        ...(p ? ([{ t: "go", x: p.x, y: p.y, moveAnim: "float", speed: 1.4 }] as Step[]) : []),
        { t: "anim", anim: "float", dur: R(2, 4) },
        { t: "say", text: pick(GHOST_LINES), style: "whisper" },
        { t: "do", fn: (w, a) => w.stimulus(a, "ghost", 0.7, { radius: 6, max: 3 }) },
      ]);
      break;
    }
    default: {
      // Strindberg, budet m.fl. lämnar via trapphuset när de är klara
      w.assign(n, [
        { t: "go", x: 5, y: 33 },
        {
          t: "do",
          fn: (_w, a) => {
            (a as Npc).visible = false;
          },
        },
      ]);
    }
  }
}

export function vacuumBumps(w: World) {
  const v = w.npcById.get("dammbert");
  if (!v || !v.visible) return;
  for (const c of w.chars) {
    if (dist(c, v) < 0.9 && w.time - c.lastReact > 20 && chance(0.25)) {
      c.lastReact = w.time;
      w.say(c, pick(["Dammbert! Igen!", "Aj, mina tår!", "Dammbert, vi har pratat om det här.", "Hej Dammbert! Duktig robot.", "Den går efter mig. Jag svär."]), "say", { log: chance(0.2) });
      w.say(v, pick(DAMMBERT_LINES));
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Musik: reaktioner när någon byter låt
export function musicChanged(w: World, by: Actor | null, prev: TrackId) {
  const track = w.music.track;
  const info = TRACK_BY_ID[track];
  const byName = by?.name ?? "jukeboxen";
  let n = 0;
  let war = false;
  for (const c of [...w.chars].sort(() => Math.random() - 0.5)) {
    if (c === by || c.ctrl === "player" || n >= 4) continue;
    const taste = c.c.music;
    const vars = { track: info.name, name: byName };
    if (track === taste.fav && chance(0.55)) {
      n++;
      const line = fill(pick(MUSIC_LOVE), vars);
      if (w.interruptible(c) && c.anim !== "sleep" && chance(0.6)) w.interrupt(c, [{ t: "wait", dur: R(0.3, 1.5) }, { t: "say", text: line, style: "shout" }, { t: "anim", anim: "dance", dur: 6, act: `Dansar till ${info.name}`, icon: "🎶" }]);
      else w.later(R(0.5, 2), () => w.say(c, line, "say", { log: chance(0.3) }));
      if (by?.type === "char") w.relate(c, by, 3);
    } else if ((track === taste.hate || (track === "off" && prev === taste.fav)) && chance(0.6)) {
      n++;
      const line = track === "off" ? pick(MUSIC_SILENCE_HATE) : fill(pick(MUSIC_HATE), vars);
      w.later(R(0.5, 2), () => w.say(c, line, "say", { log: chance(0.4) }));
      if (by?.type === "char") w.relate(c, by, -3);
      // Musikkrig: gå och byt tillbaka
      if (!war && by?.type === "char" && w.interruptible(c) && chance(0.12 + c.c.traits.kaos * 0.2)) {
        war = true;
        w.musicNext = w.time + 15;
        w.later(R(1.5, 3), () => {
          if (!w.interruptible(c)) return;
          w.addLog(`Musikkrig! ${c.name} tänker inte acceptera ${info.name}.`, "⚔️", "chaos", c.id, "Loungen");
          w.interrupt(c, [{ t: "say", text: fill(pick(MUSIC_WAR), vars), style: "shout", wait: 0.3 }, ...A.jukebox(w, c, taste.fav)]);
        });
      }
    } else if (chance(0.05)) {
      n++;
      w.later(R(1, 4), () => w.say(c, pick(MUSIC_COMMENT)));
    }
  }
}
