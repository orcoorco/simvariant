// Kontorets musik. Allt är originalmusik som genereras procedurellt i webbläsaren
// (src/client/music.ts) – servern bestämmer bara vilken låt som spelas och när den startade.

export type TrackId = "lofi" | "disco" | "jazz" | "vals" | "ambient" | "chiptune" | "synthwave" | "hiss" | "off";

export interface TrackInfo {
  id: TrackId;
  name: string;
  icon: string;
  desc: string;
  words: RegExp; // nyckelord för svensk kommandotolkning
}

export const TRACKS: TrackInfo[] = [
  { id: "lofi", name: "Barnhusgatan Lo-fi", icon: "☕", desc: "Lugna beats att designa till", words: /lo-?fi|lugn|chill|fokus|plugg|beats|mysig/ },
  { id: "disco", name: "Fredagsdisco", icon: "🪩", desc: "Fyra-på-golvet och glitter", words: /disco|dans|fest|party|fredag|rave|klubb|house/ },
  { id: "jazz", name: "Kaffejazz", icon: "🎷", desc: "Svängig jazz för kaffepausen", words: /jazz|swing|kaffe|cafe|lounge/ },
  { id: "vals", name: "Kakelugnsvalsen", icon: "🪗", desc: "Dragspel och tretakt från 1906", words: /vals|dragspel|folk|gammal|kakelugn|1906|nostalg/ },
  { id: "ambient", name: "Serverrummets brus", icon: "🖥️", desc: "Svävande ambient med servervibbar", words: /ambient|server|meditat|spa|lugnande|rymd|drone/ },
  { id: "chiptune", name: "8-bit kontorsmarsch", icon: "👾", desc: "Chiptune-energi från arkadmaskinen", words: /8-?bit|chiptune|spel|arkad|retro|marsch|nintendo/ },
  { id: "synthwave", name: "Synthwave över Norra Bantorget", icon: "🌆", desc: "Neon, arpeggion och 80-talskänsla", words: /synth|80-?tal|neon|retrowave|outrun/ },
  { id: "hiss", name: "Hissmusik (sedan 1998)", icon: "🛗", desc: "Bossa nova som aldrig tar slut", words: /hiss|bossa|vänt|muzak|telefonkö/ },
  { id: "off", name: "Tystnad", icon: "🤫", desc: "Någon har stängt av musiken", words: /tyst|stäng av|av musiken|stopp|ingen musik|sluta/ },
];

export const TRACK_BY_ID = Object.fromEntries(TRACKS.map((t) => [t.id, t])) as Record<TrackId, TrackInfo>;
export const PLAYABLE = TRACKS.filter((t) => t.id !== "off").map((t) => t.id);

export function findTrack(text: string): TrackId | null {
  const s = text.toLowerCase();
  for (const t of TRACKS) if (t.words.test(s) || s.includes(t.name.toLowerCase())) return t.id;
  return null;
}

export interface MusicState {
  track: TrackId;
  by: string | null; // konsult-id, NPC-id eller null (systemet)
  at: number; // servertid (ms) då låten startade
}
