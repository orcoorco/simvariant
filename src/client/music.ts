// Procedurell bakgrundsmusik (originalkompositioner) med WebAudio.
// Servern bestämmer låt + starttid; alla klienter räknar fram samma takt och spelar
// samma deterministiska mönster, så alla hör ungefär samma ställe i låten.
import type { MusicState, TrackId } from "../shared/music.ts";
import { getAudioContext } from "./sound.ts";

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function hash(...n: number[]): number {
  let h = 2166136261;
  for (const v of n) {
    h ^= Math.floor(v * 7919) | 0;
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

interface NoteOpts {
  wave?: OscillatorType;
  vol?: number;
  attack?: number;
  release?: number;
  detune?: number; // två oscillatorer ± cent
  cutoff?: number;
  q?: number;
  vib?: number; // vibrato i cent
  vibRate?: number;
  pluck?: boolean; // exponentiell avklingning över hela längden
}

class Synth {
  out: GainNode;
  bus: GainNode;
  lp: BiquadFilterNode;
  private noise: AudioBuffer;
  constructor(public ctx: AudioContext) {
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.lp = ctx.createBiquadFilter();
    this.lp.type = "lowpass";
    this.lp.frequency.value = 12000;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 4;
    this.bus = ctx.createGain();
    this.bus.connect(this.lp).connect(comp).connect(this.out).connect(ctx.destination);
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  note(t: number, midi: number, dur: number, o: NoteOpts = {}) {
    const ctx = this.ctx;
    const vol = o.vol ?? 0.04;
    const a = o.attack ?? 0.01;
    const r = o.release ?? 0.08;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    if (o.pluck) g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + 0.02, dur));
    else {
      g.gain.setValueAtTime(vol, t + Math.max(a, dur - r));
      g.gain.linearRampToValueAtTime(0.0001, t + dur + r);
    }
    g.connect(this.bus);
    let dest: AudioNode = g;
    if (o.cutoff) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = o.cutoff;
      f.Q.value = o.q ?? 0.7;
      f.connect(g);
      dest = f;
    }
    const end = t + dur + r + 0.05;
    for (const det of o.detune ? [-o.detune, o.detune] : [0]) {
      const osc = ctx.createOscillator();
      osc.type = o.wave ?? "triangle";
      osc.frequency.value = mtof(midi);
      osc.detune.value = det;
      if (o.vib) {
        const l = ctx.createOscillator();
        const lg = ctx.createGain();
        l.frequency.value = o.vibRate ?? 5.5;
        lg.gain.value = o.vib;
        l.connect(lg).connect(osc.detune);
        l.start(t);
        l.stop(end);
      }
      osc.connect(dest);
      osc.start(t);
      osc.stop(end);
    }
  }

  chord(t: number, notes: number[], dur: number, o: NoteOpts = {}) {
    for (const n of notes) this.note(t, n, dur, o);
  }

  hit(t: number, vol: number, dur: number, hp: number, lp = 16000) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const h = ctx.createBiquadFilter();
    h.type = "highpass";
    h.frequency.value = hp;
    const l = ctx.createBiquadFilter();
    l.type = "lowpass";
    l.frequency.value = lp;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(h).connect(l).connect(g).connect(this.bus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  kick(t: number, vol = 0.4) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + 0.32);
  }

  snare(t: number, vol = 0.08, dur = 0.16) {
    this.hit(t, vol, dur, 1200);
    this.note(t, 54, 0.05, { wave: "triangle", vol: vol * 0.6, attack: 0.002, release: 0.04 });
  }

  hat(t: number, vol = 0.02, open = false) {
    this.hit(t, vol, open ? 0.22 : 0.035, 7000);
  }

  clap(t: number, vol = 0.06) {
    for (let i = 0; i < 3; i++) this.hit(t + i * 0.011, vol * (i === 2 ? 1 : 0.6), i === 2 ? 0.14 : 0.02, 1400, 6000);
  }

  rim(t: number, vol = 0.02) {
    this.note(t, 95, 0.02, { wave: "square", vol, attack: 0.001, release: 0.02, cutoff: 3000 });
    this.hit(t, vol * 0.7, 0.02, 3000);
  }

  ride(t: number, vol = 0.015) {
    this.hit(t, vol, 0.4, 5200);
    this.note(t, 100, 0.25, { wave: "sine", vol: vol * 0.25, pluck: true });
  }
}

interface TrackDef {
  bpm: number;
  steps: number; // sextondelar per takt (16 = 4/4, 12 = 3/4)
  swing: number; // andel av ett steg som udda steg förskjuts
  cutoff: number;
  master: number;
  play(s: Synth, bar: number, step: number, t: number, d: number): void;
}

const pickOf = <T,>(arr: T[], r: number) => arr[Math.floor(r * arr.length) % arr.length];

// ---------------------------------------------------------------------------
// Låtarna (alla originalkompositioner, genererade i realtid)
const DEFS: Record<Exclude<TrackId, "off">, TrackDef> = {
  // Barnhusgatan Lo-fi
  lofi: {
    bpm: 78,
    steps: 16,
    swing: 0.18,
    cutoff: 2600,
    master: 0.75,
    play(s, bar, step, t, d) {
      const chords = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]];
      const roots = [41, 40, 38, 36];
      const ci = bar % 4;
      const r = (k: number) => hash(1, bar, step, k);
      if (step === 0) {
        s.chord(t, chords[ci], d * 15, { wave: "triangle", vol: 0.02, attack: 0.05, release: 0.5, detune: 6, cutoff: 1700 });
        s.note(t, roots[ci], d * 6, { wave: "sine", vol: 0.13, release: 0.2 });
      }
      if (step === 10) s.note(t, roots[ci] + 7, d * 4, { wave: "sine", vol: 0.09, release: 0.15 });
      if (step === 0 || step === 10 || (step === 7 && r(1) < 0.5)) s.kick(t, 0.3);
      if (step === 4 || step === 12) s.snare(t, 0.045, 0.12);
      if (step % 2 === 0) s.hat(t, step % 4 === 2 ? 0.014 : 0.009);
      if (step % 2 === 0 && bar % 8 >= 2 && r(2) < 0.22) {
        const penta = [69, 72, 74, 76, 79, 81];
        s.note(t, pickOf(penta, r(3)), d * (2 + Math.floor(r(4) * 3)), { wave: "sine", vol: 0.04, vib: 9, attack: 0.02, release: 0.2 });
      }
      if (r(5) < 0.3) s.hit(t + r(6) * d, 0.006, 0.01, 2500); // vinylknaster
    },
  },
  // Fredagsdisco
  disco: {
    bpm: 120,
    steps: 16,
    swing: 0,
    cutoff: 9000,
    master: 0.7,
    play(s, bar, step, t, d) {
      const chords = [[57, 60, 64, 67], [57, 62, 65, 69], [55, 59, 62, 67], [55, 59, 64, 67]];
      const roots = [45, 50, 43, 48];
      const ci = bar % 4;
      const r = (k: number) => hash(2, bar, step, k);
      if (step % 4 === 0) s.kick(t, 0.42);
      if (step === 4 || step === 12) s.clap(t, 0.07);
      if (step % 4 === 2) s.hat(t, 0.022, true);
      else if (step % 2 === 1) s.hat(t, 0.008);
      if (step % 2 === 0) s.note(t, roots[ci] + (step % 4 === 2 ? 12 : 0), d * 1.6, { wave: "sawtooth", cutoff: 750, vol: 0.06, release: 0.03 });
      if (step === 3 || step === 11 || (step === 6 && r(1) < 0.5)) s.chord(t, chords[ci], d * 0.9, { wave: "square", vol: 0.009, cutoff: 2600, release: 0.04 });
      if (step === 0 && bar % 2 === 0) s.chord(t, chords[ci].map((n) => n + 12), d * 30, { wave: "sawtooth", vol: 0.006, attack: 0.4, release: 0.6, detune: 10, cutoff: 3200 });
      const hook = [76, 0, 74, 76, 0, 72, 74, 0, 72, 0, 69, 72, 0, 0, 67, 0];
      if (bar % 4 === 1 || bar % 4 === 3) {
        const n = hook[step];
        if (n) s.note(t, n + (bar % 8 === 7 ? 2 : 0), d * 1.5, { wave: "square", vol: 0.018, cutoff: 3600, vib: 6, release: 0.05 });
      }
    },
  },
  // Kaffejazz
  jazz: {
    bpm: 112,
    steps: 16,
    swing: 0.33,
    cutoff: 5200,
    master: 0.8,
    play(s, bar, step, t, d) {
      const roots = [38, 43, 36, 45];
      const thirds = [3, 4, 4, 4];
      const voicing = [[53, 57, 60, 64], [53, 57, 59, 64], [52, 55, 59, 62], [55, 58, 61, 64]];
      const ci = bar % 4;
      const next = roots[(ci + 1) % 4];
      const r = (k: number) => hash(3, bar, step, k);
      if (step % 4 === 0) {
        const beat = step / 4;
        const root = roots[ci];
        const bass = [root, root + thirds[ci] + (r(1) < 0.3 ? 12 : 0), root + 7, next + (r(2) < 0.5 ? 1 : -1)][beat];
        s.note(t, bass, d * 3.6, { wave: "triangle", vol: 0.12, attack: 0.005, release: 0.05, cutoff: 1000 });
        s.ride(t, 0.014);
      }
      if (step === 7 || step === 15) s.ride(t, 0.01);
      if (step === 4 || step === 12) s.hat(t, 0.008);
      if (step === 0 && r(3) < 0.4) s.kick(t, 0.1);
      if ((step === 6 && r(4) < 0.6) || (step === 11 && r(5) < 0.45) || (step === 2 && r(6) < 0.2)) s.chord(t, voicing[ci], d * 3, { wave: "triangle", vol: 0.016, attack: 0.004, pluck: true });
      if (bar % 8 >= 2 && bar % 8 <= 5 && step % 2 === 0 && r(7) < 0.4) {
        const pool = [...voicing[ci].map((n) => n + 12), voicing[ci][0] + 14];
        s.note(t, pickOf(pool, r(8)), d * (2 + Math.floor(r(9) * 3)), { wave: "sawtooth", cutoff: 1500, vol: 0.026, vib: 12, vibRate: 5, attack: 0.03, release: 0.12 });
      }
    },
  },
  // Kakelugnsvalsen (3/4)
  vals: {
    bpm: 138,
    steps: 12,
    swing: 0,
    cutoff: 4200,
    master: 0.75,
    play(s, bar, step, t, d) {
      const prog = ["G", "G", "D", "D", "C", "G", "D", "G"];
      const ROOT: Record<string, number> = { G: 43, D: 38, C: 36 };
      const CH: Record<string, number[]> = { G: [59, 62, 67], D: [57, 60, 66], C: [60, 64, 67] };
      const k = prog[bar % 8];
      const r = (q: number) => hash(4, bar, step, q);
      if (step === 0) s.note(t, ROOT[k], d * 3, { wave: "triangle", vol: 0.12, release: 0.05 });
      if (step === 4 || step === 8) s.chord(t, CH[k], d * 2, { wave: "square", vol: 0.009, cutoff: 1800, release: 0.04 });
      if (step === 0) s.hat(t, 0.006);
      const strong = step % 4 === 0;
      if (strong || (step % 2 === 0 && r(1) < 0.3)) {
        const scale = [67, 69, 71, 72, 74, 76, 78, 79];
        const n = strong ? pickOf(CH[k].map((x) => x + 12), r(2)) : pickOf(scale, r(3));
        s.note(t, n, d * (strong ? 3.5 : 1.8), { wave: "square", vol: 0.018, detune: 8, vib: 14, vibRate: 6, cutoff: 2600, attack: 0.03, release: 0.06 });
      }
    },
  },
  // Serverrummets brus
  ambient: {
    bpm: 60,
    steps: 16,
    swing: 0,
    cutoff: 2200,
    master: 0.85,
    play(s, bar, step, t, d) {
      const chords = [[48, 55, 59, 62, 64], [45, 52, 55, 59, 60], [41, 48, 52, 57, 59], [43, 50, 55, 57, 62]];
      const ci = Math.floor(bar / 2) % 4;
      const r = (k: number) => hash(5, bar, step, k);
      if (step === 0 && bar % 2 === 0) {
        s.chord(t, chords[ci], d * 30, { wave: "sine", vol: 0.022, attack: 2.5, release: 3 });
        s.chord(t, chords[ci].slice(2).map((n) => n + 12), d * 28, { wave: "triangle", vol: 0.007, attack: 3, release: 3, detune: 7 });
      }
      if (step === 0 && bar % 4 === 0) s.note(t, 36, d * 60, { wave: "sine", vol: 0.05, attack: 3, release: 4 });
      if (r(1) < 0.06) {
        const bells = [76, 79, 81, 84, 86, 88];
        const n = pickOf(bells, r(2));
        s.note(t, n, 2.5, { wave: "sine", vol: 0.026, pluck: true });
        s.note(t + d * 3, n, 2.5, { wave: "sine", vol: 0.01, pluck: true });
      }
    },
  },
  // 8-bit kontorsmarsch
  chiptune: {
    bpm: 150,
    steps: 16,
    swing: 0,
    cutoff: 12000,
    master: 0.6,
    play(s, bar, step, t, d) {
      const chords = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]];
      const roots = [48, 43, 45, 41];
      const ci = bar % 4;
      const ch = chords[ci];
      s.note(t, ch[step % 3] + 12 + (step % 8 >= 4 ? 12 : 0), d * 0.9, { wave: "square", vol: 0.009, release: 0.02 });
      if (step % 2 === 0) s.note(t, roots[ci] + (step % 4 === 2 ? 12 : 0), d * 1.8, { wave: "triangle", vol: 0.1, release: 0.02 });
      if (step === 0 || step === 8) s.kick(t, 0.3);
      if (step === 4 || step === 12) s.hit(t, 0.05, 0.08, 1500);
      if (step % 2 === 0) s.hit(t, 0.01, 0.02, 8000);
      const motifA = [72, 0, 76, 0, 79, 0, 76, 0, 74, 0, 72, 0, 71, 0, 67, 0];
      const motifB = [69, 0, 72, 0, 76, 0, 74, 72, 71, 0, 72, 0, 74, 0, 0, 0];
      const m = (bar % 4 < 2 ? motifA : motifB)[step];
      if (m && bar % 16 >= 4) s.note(t, m + (bar % 8 >= 6 ? 12 : 0), d * 1.8, { wave: "square", vol: 0.018, vib: 6, release: 0.03 });
    },
  },
  // Synthwave över Norra Bantorget
  synthwave: {
    bpm: 100,
    steps: 16,
    swing: 0,
    cutoff: 6000,
    master: 0.7,
    play(s, bar, step, t, d) {
      const chords = [[57, 60, 64], [57, 60, 65], [55, 60, 64], [55, 59, 62]];
      const roots = [45, 41, 48, 43];
      const ci = bar % 4;
      const ch = chords[ci];
      s.note(t, roots[ci] - 12 + (step % 2 ? 12 : 0), d * 0.8, { wave: "sawtooth", cutoff: 520, q: 4, vol: 0.05, release: 0.02 });
      if (step === 0) s.chord(t, ch.map((n) => n + 12), d * 15, { wave: "sawtooth", vol: 0.008, attack: 0.6, release: 1, detune: 14, cutoff: 2200 });
      if (step % 2 === 0) {
        const arp = [ch[0], ch[1], ch[2], ch[0] + 12][(step / 2) % 4] + 12;
        s.note(t, arp, d * 1.2, { wave: "sawtooth", cutoff: 3000, vol: 0.012, release: 0.04 });
        s.note(t + d * 3, arp, d * 1.2, { wave: "sawtooth", cutoff: 2200, vol: 0.004, release: 0.04 });
      }
      if (step === 0 || step === 8) s.kick(t, 0.42);
      if (step === 4 || step === 12) s.snare(t, 0.08, 0.4);
      if (step % 2 === 1) s.hat(t, 0.008);
      if (bar % 8 >= 4 && (step === 0 || step === 8)) s.note(t, ch[2] + 12 + (step === 8 ? 2 : 0), d * 7, { wave: "square", vol: 0.016, vib: 10, cutoff: 2500, attack: 0.05, release: 0.2 });
    },
  },
  // Hissmusik (sedan 1998)
  hiss: {
    bpm: 125,
    steps: 16,
    swing: 0,
    cutoff: 3600,
    master: 0.8,
    play(s, bar, step, t, d) {
      const roots = [36, 38, 40, 45];
      const ch = [[52, 55, 59], [53, 57, 60], [55, 59, 62], [55, 61, 64]];
      const ci = bar % 4;
      const r = (k: number) => hash(8, bar, step, k);
      if (step === 0 || step === 8) s.note(t, roots[ci], d * 4, { wave: "triangle", vol: 0.1, pluck: true });
      if (step === 6 || step === 14) s.note(t, roots[ci] + 7, d * 3, { wave: "triangle", vol: 0.08, pluck: true });
      if ([0, 3, 6, 10, 12].includes(step)) s.chord(t, ch[ci], d * 2, { wave: "triangle", vol: 0.014, pluck: true });
      if ([0, 3, 6, 10, 13].includes(step)) s.rim(t, 0.016);
      s.hit(t, step % 2 === 0 ? 0.007 : 0.004, 0.03, 6000);
      if (step % 2 === 0 && bar % 4 !== 0 && r(1) < 0.18) {
        const fl = [72, 74, 76, 77, 79, 81, 83, 84];
        s.note(t, pickOf(fl, r(2)), d * (3 + r(3) * 4), { wave: "sine", vol: 0.032, vib: 14, vibRate: 5, attack: 0.06, release: 0.2 });
      }
    },
  },
};

// ---------------------------------------------------------------------------
class MusicPlayer {
  private synth: Synth | null = null;
  private enabled = false;
  private state: MusicState | null = null;
  private offset = 0;
  private timer: number | undefined;
  private stepIdx = 0;
  private nextT = 0;
  private def: TrackDef | null = null;
  private trackId: TrackId | null = null;
  private volume = 0.7;

  constructor() {
    try {
      this.enabled = localStorage.getItem("sv_music") === "1";
      const v = parseFloat(localStorage.getItem("sv_music_vol") ?? "");
      if (!Number.isNaN(v)) this.volume = v;
    } catch {
      /* privat läge */
    }
  }

  isEnabled() {
    return this.enabled;
  }

  getVolume() {
    return this.volume;
  }

  /** Serverns klocka minus klientens (ms). */
  setServerOffset(ms: number) {
    this.offset = ms;
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    try {
      localStorage.setItem("sv_music_vol", String(this.volume));
    } catch {
      /* privat läge */
    }
    if (this.synth && this.def) {
      const now = this.synth.ctx.currentTime;
      this.synth.out.gain.cancelScheduledValues(now);
      this.synth.out.gain.setTargetAtTime(this.def.master * this.volume, now, 0.1);
    }
  }

  /** Slå på/av (måste anropas från en användargest första gången). */
  setEnabled(on: boolean) {
    this.enabled = on;
    try {
      localStorage.setItem("sv_music", on ? "1" : "0");
    } catch {
      /* privat läge */
    }
    if (on) this.start(true);
    else this.fadeOut();
  }

  /** Försök starta om preferensen redan var på (anropas vid första klick). */
  resumeIfEnabled() {
    if (this.enabled && !this.synth) this.start(true);
  }

  setState(st: MusicState) {
    const changed = !this.state || st.track !== this.state.track || st.at !== this.state.at;
    this.state = st;
    if (changed && this.enabled && this.synth) this.start(false);
  }

  private fadeOut() {
    if (!this.synth) return;
    const now = this.synth.ctx.currentTime;
    this.synth.out.gain.cancelScheduledValues(now);
    this.synth.out.gain.setValueAtTime(this.synth.out.gain.value, now);
    this.synth.out.gain.linearRampToValueAtTime(0, now + 0.6);
    this.def = null;
    this.trackId = null;
  }

  private start(fromGesture: boolean) {
    if (!this.synth) {
      const ctx = getAudioContext(fromGesture);
      if (!ctx) return;
      this.synth = new Synth(ctx);
    }
    if (!this.state) return;
    const s = this.synth;
    const ctx = s.ctx;
    if (ctx.state === "suspended") void ctx.resume();
    const id = this.state.track;
    const now = ctx.currentTime;
    s.out.gain.cancelScheduledValues(now);
    s.out.gain.setValueAtTime(s.out.gain.value, now);
    if (id === "off") {
      s.out.gain.linearRampToValueAtTime(0, now + 0.8);
      this.def = null;
      this.trackId = id;
      return;
    }
    const def = DEFS[id];
    const switching = !!this.def && this.trackId !== id;
    const startAt = now + (switching ? 0.6 : 0.06);
    s.out.gain.linearRampToValueAtTime(0, now + (switching ? 0.5 : 0.02));
    s.lp.frequency.setValueAtTime(def.cutoff, startAt);
    s.out.gain.setValueAtTime(0, startAt);
    s.out.gain.linearRampToValueAtTime(def.master * this.volume, startAt + 1.5);
    this.def = def;
    this.trackId = id;
    const stepDur = 60 / def.bpm / 4;
    const elapsed = Math.max(0, (Date.now() + this.offset - this.state.at) / 1000 + (startAt - now));
    this.stepIdx = Math.ceil(elapsed / stepDur);
    this.nextT = startAt + (this.stepIdx * stepDur - elapsed);
    if (!this.timer) this.timer = window.setInterval(() => this.pump(), 40);
  }

  private pump() {
    if (!this.enabled || !this.synth || !this.def) return;
    const ctx = this.synth.ctx;
    const def = this.def;
    const stepDur = 60 / def.bpm / 4;
    if (this.nextT < ctx.currentTime - 0.4) {
      // fliken har sovit – synka om mot servertiden
      this.start(false);
      return;
    }
    const ahead = document.hidden ? 1.6 : 0.18;
    let guard = 0;
    while (this.nextT < ctx.currentTime + ahead && guard++ < 64) {
      const bar = Math.floor(this.stepIdx / def.steps);
      const step = this.stepIdx % def.steps;
      const sw = step % 2 === 1 ? def.swing * stepDur : 0;
      try {
        def.play(this.synth, bar, step, Math.max(ctx.currentTime + 0.005, this.nextT + sw), stepDur);
      } catch (err) {
        console.warn("musik", err);
      }
      this.stepIdx++;
      this.nextT += stepDur;
    }
  }
}

export const music = new MusicPlayer();
