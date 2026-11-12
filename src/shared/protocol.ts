// Meddelanden mellan server (Durable Object) och klient över WebSocket.
import type { Dir, Pose, RoomId } from "./map.ts";
import type { NpcKind } from "./consultants.ts";

export type Anim =
  | "idle"
  | "walk"
  | "run"
  | "sit"
  | "type"
  | "drink"
  | "talk"
  | "dance"
  | "sleep"
  | "panic"
  | "jump"
  | "draw"
  | "phone"
  | "wave"
  | "eat"
  | "think"
  | "cheer"
  | "point"
  | "sneak"
  | "yoga"
  | "juggle"
  | "vr"
  | "conga"
  | "cry"
  | "flex"
  | "read"
  | "game"
  | "pushup"
  | "frozen"
  | "float";

export type Item =
  | "kaffe"
  | "kopp"
  | "laptop"
  | "banan"
  | "tarta"
  | "postit"
  | "mikrofon"
  | "kartong"
  | "vr"
  | "telefon"
  | "bulle"
  | "vatten"
  | "papper"
  | "blomma"
  | "pokal";

export type Effect = "gold" | "tiny" | "giant" | "ghost" | "wet" | "fire" | "rainbow" | "sparkle" | "zzz" | "mine" | "spin";

export interface CharSnap {
  i: string; // id
  x: number; // rutor (flyttal, mitt av ruta = n + 0.5)
  y: number;
  d: Dir;
  a: Anim;
  p: Pose;
  h?: Item; // håller i
  e?: Effect[];
  ic?: string; // status-emoji ovanför huvudet
}

export interface NpcSnap {
  i: string;
  k: NpcKind;
  x: number;
  y: number;
  d: Dir;
  a: Anim;
  v: boolean; // synlig
}

export interface Needs {
  koffein: number;
  fokus: number;
  socialt: number;
  inspiration: number;
  kaos: number;
  energi: number;
  hunger: number;
}

export type Control = "ai" | "player" | "scheme";

export interface CharDetail {
  i: string;
  act: string; // nuvarande aktivitet
  thought: string; // senaste tanke
  mood: string; // humör (text)
  moodIcon: string;
  needs: Needs;
  ctrl: Control;
  rel: [string, number][]; // relationer (id, -100..100), starkaste först
  mem: string[]; // senaste minnen
  room: string;
  online: boolean; // spelaren är inloggad just nu
}

export interface WorldState {
  clock: string; // "14:32" Stockholmstid
  weekday: string;
  night: number; // 0 = dag, 1 = mitt i natten
  lights: boolean;
  disco: RoomId | null;
  alarm: boolean;
  weather: "sol" | "moln" | "regn" | "sno";
  coffeeBroken: boolean;
  plantSize: number; // krukväxten Bengt växer
  stats: { kaffe: number; moten: number; kaos: number; ideer: number; kramar: number };
  banner: string | null; // löpsedel/banderoll över kontoret
  special: string | null; // aktiv specialhändelse (för UI)
}

export type FxKind =
  | "confetti"
  | "bananas"
  | "smoke"
  | "hearts"
  | "notes"
  | "sparkle"
  | "steam"
  | "splash"
  | "lightning"
  | "postits"
  | "explosion"
  | "rainbow"
  | "zzz"
  | "fire"
  | "bubbles"
  | "money"
  | "stars"
  | "paper"
  | "feathers"
  | "question"
  | "exclaim"
  | "shockwave";

export type BubbleStyle = "say" | "shout" | "whisper" | "think" | "sing";

export type LogTag = "say" | "event" | "chaos" | "social" | "player" | "world" | "secret";

export interface LogEntry {
  id: number;
  ts: number; // ms
  text: string;
  icon: string;
  tag: LogTag;
  who?: string;
  room?: string;
}

export type GameEvent =
  | { k: "say"; i: string; text: string; style: BubbleStyle; dur: number }
  | { k: "log"; e: LogEntry }
  | { k: "fx"; fx: FxKind; x: number; y: number; dur: number; n?: number; text?: string }
  | { k: "sound"; s: "ding" | "pop" | "alarm" | "tada" | "boing" | "whoosh" | "bell" };

export interface Me {
  id: string;
  name: string;
  mustChange: boolean;
  ctrl: Control;
  queue: string[]; // återstående steg i spelarens plan
  idleIn: number; // sekunder kvar tills autopiloten tar över (0 = inte aktuellt)
}

export type ServerMsg =
  | {
      t: "hello";
      me: Me | null;
      world: WorldState;
      chars: CharSnap[];
      npcs: NpcSnap[];
      details: CharDetail[];
      log: LogEntry[];
      llm: string; // "lokal motor" | "Gemini (…)" | "Claude (…)"
      viewers: number;
      ts: number;
    }
  | { t: "snap"; ts: number; c: CharSnap[]; n: NpcSnap[] }
  | { t: "detail"; d: CharDetail[] }
  | { t: "ev"; e: GameEvent[] }
  | { t: "world"; w: WorldState; viewers: number }
  | { t: "me"; me: Me | null }
  | { t: "ack"; ok: boolean; text: string; plan?: string[]; via?: string };

export type ClientMsg =
  | { t: "prompt"; text: string }
  | { t: "autopilot" }
  | { t: "doorbell" }
  | { t: "poke"; what: string }
  | { t: "ping" };

export const SNAP_HZ = 8;
export const PLAYER_IDLE_SECONDS = 25;
