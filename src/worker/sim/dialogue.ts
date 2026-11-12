// Samtal mellan konsulter: lokal generator + valfri LLM.
import {
  AGREE,
  ANSWER_MAYBE,
  ANSWER_NO,
  ANSWER_TOPIC,
  ANSWER_YES,
  CLOSERS,
  DISAGREE,
  GREETINGS,
  GREET_REPLIES,
  TANGENTS,
  TOPIC_LINES,
  chance,
  fill,
  pick,
} from "./content.ts";
import type { Char, World } from "./world.ts";

export interface Line {
  who: Char;
  text: string;
}

function topicLine(c: Char, key?: string): string {
  const k = key && TOPIC_LINES[key] ? key : pick(c.c.interests);
  const lines = TOPIC_LINES[k];
  return lines ? pick(lines) : pick(TANGENTS);
}

/** Lokal samtalsgenerator: 4–6 repliker. */
export function localDialogue(w: World, a: Char, b: Char): Line[] {
  const lines: Line[] = [];
  lines.push({ who: a, text: fill(pick(GREETINGS), { name: b.name }) });
  lines.push({ who: b, text: pick(GREET_REPLIES) });
  const shared = a.c.interests.find((i) => b.c.interests.includes(i));
  const key = shared ?? pick(a.c.interests);
  lines.push({ who: a, text: topicLine(a, key) });
  const likes = (b.rel[a.id] ?? 0) + (Math.random() * 40 - 20);
  if (likes > 5) {
    lines.push({ who: b, text: `${pick(AGREE)} ${chance(0.5) ? topicLine(b) : ""}`.trim() });
    w.relate(a, b, 3);
  } else {
    lines.push({ who: b, text: pick(DISAGREE) });
    w.relate(a, b, -1);
  }
  if (chance(0.55)) {
    const mem = a.mem.length && chance(0.4) ? `Kommer du ihåg när ${a.mem[a.mem.length - 1].replace(/^./, (m) => m.toLowerCase())}?` : null;
    lines.push({ who: a, text: mem ?? (chance(0.5) ? pick(a.c.catch) : pick(TANGENTS)) });
    if (chance(0.6)) lines.push({ who: b, text: chance(0.5) ? pick(b.c.catch) : pick(AGREE) });
  }
  lines.push({ who: chance(0.5) ? a : b, text: pick(CLOSERS) });
  return lines;
}

/** Svar på en direkt fråga. */
export function localAnswer(b: Char, question: string, asker?: Char): string {
  for (const [re, opts] of ANSWER_TOPIC) if (re.test(question)) return pick(opts);
  const rel = asker ? b.rel[asker.id] ?? 0 : 0;
  const r = Math.random() + rel / 200 + (b.c.traits.kaos - 0.5) * 0.3;
  const base = r > 0.65 ? pick(ANSWER_YES) : r < 0.3 ? pick(ANSWER_NO) : pick(ANSWER_MAYBE);
  return chance(0.35) ? `${base} ${pick(b.c.catch)}` : base;
}

function persona(c: Char): string {
  return `${c.c.name} (${c.c.title}). ${c.c.bio} Egenhet: ${c.c.quirkText} Typiska repliker: ${c.c.catch.slice(0, 2).join(" / ")}`;
}

/** LLM-dialog. Returnerar null om det inte går. */
export async function llmDialogue(w: World, a: Char, b: Char): Promise<Line[] | null> {
  if (!w.llm) return null;
  const recent = w.log
    .slice(-6)
    .map((e) => e.text)
    .join(" | ");
  const system =
    "Du skriver repliker till SimVariant, ett humoristiskt pixel-simspel som utspelar sig på designbyrån Variants kontor på Barnhusgatan 20 i Stockholm (sekelskifteslägenhet från 1906 med kakelugnar, Kungsbalkong mot Norra Bantorget, en kaffemaskin som ibland får medvetande, krukväxten Bengt, robotdammsugaren Dammbert och duvan Gunnar). " +
    "Skriv på svenska, kort (max 90 tecken per replik), varmt, absurt och roligt – aldrig elakt eller kränkande. Låt personligheterna lysa igenom.";
  const user =
    `Skriv ett kort samtal (4–6 repliker, växelvis) mellan A och B som just möts på kontoret ${w.roomOf(a)?.inRoom ?? ""}.\n` +
    `A: ${persona(a)}\nA:s senaste minnen: ${a.mem.slice(-3).join("; ") || "inga"}\n` +
    `B: ${persona(b)}\nB:s senaste minnen: ${b.mem.slice(-3).join("; ") || "inga"}\n` +
    `Klockan är ${w.worldState().clock}. Senaste händelser på kontoret: ${recent || "lugnt"}\n` +
    'Svara som JSON: {"lines":[{"who":"A","text":"..."},{"who":"B","text":"..."}]}';
  const res = await w.llm.json<{ lines?: { who?: string; text?: string }[] }>(system, user, { maxTokens: 1200, timeoutMs: 9000 });
  if (!res?.lines?.length) return null;
  const out: Line[] = [];
  for (const l of res.lines.slice(0, 7)) {
    if (!l.text) continue;
    out.push({ who: l.who === "B" ? b : a, text: String(l.text).slice(0, 160) });
  }
  return out.length >= 2 ? out : null;
}

/** LLM-genererad galen affärsidé. */
export async function llmIdea(w: World, c: Char): Promise<string | null> {
  if (!w.llm) return null;
  const res = await w.llm.json<{ pitch?: string }>(
    "Du hittar på galna, roliga men harmlösa affärsidéer för ett humoristiskt kontorsspel på designbyrån Variant (Barnhusgatan 20, Stockholm). Svenska, max 160 tecken.",
    `Hitta på en vild idé som ${c.c.name} (${c.c.title}; ${c.c.quirkText}) pitchar på ett krismöte vid whiteboarden. Svara som JSON: {"pitch":"..."}`,
    { maxTokens: 600, timeoutMs: 8000 },
  );
  return res?.pitch ? String(res.pitch).slice(0, 200) : null;
}
