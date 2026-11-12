// Små syntljud med WebAudio. Av som standard – slås på i gränssnittet.
let ctx: AudioContext | null = null;
let enabled = false;

/** Delad AudioContext (skapas vid första användargesten). */
export function getAudioContext(create = true): AudioContext | null {
  if (!ctx && create) {
    try {
      ctx = new AudioContext();
    } catch {
      ctx = null;
    }
  }
  if (ctx && ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setSoundEnabled(on: boolean) {
  enabled = on;
  if (on) getAudioContext();
  try {
    localStorage.setItem("sv_sound", on ? "1" : "0");
  } catch {
    /* privat läge */
  }
}

export function soundEnabled() {
  return enabled;
}

export function initSoundPref() {
  try {
    enabled = localStorage.getItem("sv_sound") === "1";
  } catch {
    enabled = false;
  }
  return enabled;
}

function tone(freq: number, dur: number, type: OscillatorType = "square", vol = 0.05, delay = 0, slide = 0) {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.linearRampToValueAtTime(freq + slide, t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

export function playSound(s: string) {
  if (!enabled || !ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  switch (s) {
    case "ding":
      tone(880, 0.25, "triangle", 0.06);
      tone(1320, 0.3, "triangle", 0.04, 0.08);
      break;
    case "bell":
      tone(659, 0.35, "triangle", 0.07);
      tone(523, 0.5, "triangle", 0.07, 0.3);
      break;
    case "pop":
      tone(420, 0.08, "square", 0.04, 0, 300);
      break;
    case "alarm":
      for (let i = 0; i < 4; i++) tone(i % 2 ? 700 : 950, 0.18, "sawtooth", 0.035, i * 0.2);
      break;
    case "tada":
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, "square", 0.04, i * 0.09));
      break;
    case "boing":
      tone(200, 0.3, "sine", 0.08, 0, 400);
      break;
    case "whoosh":
      tone(900, 0.25, "sawtooth", 0.02, 0, -700);
      break;
  }
}
