// Partikeleffekter. Tillståndslösa: varje partikel är en funktion av (effekt-id, index, tid).
import type { FxInst } from "../net.ts";
import { hash, R } from "./pixel.ts";
import { M } from "./staticLayer.ts";

const CONFETTI = ["#ff5ec4", "#ffd23f", "#4cc9f0", "#3ddc84", "#ff8a3d", "#a78bfa", "#ffffff"];

function heart(c: CanvasRenderingContext2D, x: number, y: number, col: string) {
  R(c, x, y, 2, 1, col);
  R(c, x + 3, y, 2, 1, col);
  R(c, x - 1, y + 1, 7, 2, col);
  R(c, x, y + 3, 5, 1, col);
  R(c, x + 1, y + 4, 3, 1, col);
  R(c, x + 2, y + 5, 1, 1, col);
}

function note(c: CanvasRenderingContext2D, x: number, y: number, col: string) {
  R(c, x, y + 4, 3, 2, col);
  R(c, x + 2, y, 1, 5, col);
  R(c, x + 3, y, 2, 1, col);
  R(c, x + 4, y + 1, 1, 1, col);
}

function star(c: CanvasRenderingContext2D, x: number, y: number, s: number, col: string) {
  R(c, x, y - s, 1, s * 2 + 1, col);
  R(c, x - s, y, s * 2 + 1, 1, col);
  if (s > 1) {
    R(c, x - 1, y - 1, 3, 3, col);
  }
}

function zz(c: CanvasRenderingContext2D, x: number, y: number, col: string) {
  R(c, x, y, 4, 1, col);
  R(c, x + 2, y + 1, 1, 1, col);
  R(c, x + 1, y + 2, 1, 1, col);
  R(c, x, y + 3, 4, 1, col);
}

function banana(c: CanvasRenderingContext2D, x: number, y: number, flip: boolean) {
  const dx = flip ? -1 : 1;
  R(c, x, y, 4 * dx || 1, 1, "#f2d03b");
  for (let i = 0; i < 5; i++) R(c, x + i * dx, y + (i === 0 || i === 4 ? 0 : 1), 1, 1, "#f2d03b");
  R(c, x + 1 * dx, y + 2, 3, 1, "#e0b92a");
  R(c, x + 5 * dx, y - 1, 1, 1, "#6b4a1a");
}

/** Ritar alla effekter i världskoordinater. Returnerar flytande texter (skärmlager). */
export function drawFx(c: CanvasRenderingContext2D, list: FxInst[], now: number, flash: { v: number }) {
  for (const f of list) {
    const T = (now - f.start) / 1000; // sekunder sedan start
    const life = (f.end - f.start) / 1000;
    const u = Math.min(1, T / Math.max(0.01, life));
    const fade = u > 0.8 ? (1 - u) / 0.2 : 1;
    const X = (f.x + M) * 16;
    const Y = (f.y + M) * 16;
    const n = Math.max(1, f.n);
    c.globalAlpha = Math.max(0, fade);
    switch (f.fx) {
      case "confetti": {
        const cnt = 36 * n;
        for (let i = 0; i < cnt; i++) {
          const a = hash(f.id, i, 1) * Math.PI * 2;
          const sp = 20 + hash(f.id, i, 2) * 50;
          const tt = (T + hash(f.id, i, 9) * 0.3) % Math.max(1.6, life);
          const px = X + Math.cos(a) * sp * Math.min(tt, 1.2) + Math.sin(tt * 4 + i) * 3;
          const py = Y - 14 + Math.sin(a) * sp * 0.5 * Math.min(tt, 1.2) - 40 * tt + 55 * tt * tt;
          const w = Math.abs(Math.cos(tt * 9 + i)) > 0.5 ? 2 : 1;
          R(c, Math.round(px), Math.round(py), w, 2, CONFETTI[i % CONFETTI.length]);
        }
        break;
      }
      case "bananas": {
        const cnt = 18 * n;
        for (let i = 0; i < cnt; i++) {
          const ox = (hash(f.id, i, 1) - 0.5) * 180;
          const period = 1.4 + hash(f.id, i, 2);
          const p = ((T + hash(f.id, i, 3) * period) % period) / period;
          const py = Y - 110 + p * 125;
          banana(c, Math.round(X + ox + Math.sin(p * 6 + i) * 4), Math.round(py), i % 2 === 0);
        }
        break;
      }
      case "smoke":
      case "steam": {
        const cnt = 10 * n;
        const col = f.fx === "smoke" ? "#6b6f78" : "#ffffff";
        for (let i = 0; i < cnt; i++) {
          const p = (T * 0.6 + hash(f.id, i, 1)) % 1;
          const px = X + (hash(f.id, i, 2) - 0.5) * 12 + Math.sin(p * 6 + i) * 4;
          const py = Y - 10 - p * 34;
          const r = 1 + p * 4;
          c.globalAlpha = fade * (1 - p) * (f.fx === "smoke" ? 0.7 : 0.5);
          c.fillStyle = col;
          c.beginPath();
          c.arc(px, py, r, 0, Math.PI * 2);
          c.fill();
        }
        break;
      }
      case "hearts": {
        const cnt = 6 * n;
        for (let i = 0; i < cnt; i++) {
          const p = (T * 0.5 + hash(f.id, i, 1)) % 1;
          const px = X + (hash(f.id, i, 2) - 0.5) * 26 + Math.sin(p * 8 + i) * 4;
          const py = Y - 18 - p * 30;
          c.globalAlpha = fade * (1 - p * 0.8);
          heart(c, Math.round(px), Math.round(py), i % 3 === 0 ? "#ff8fb1" : "#ff4d7d");
        }
        break;
      }
      case "notes": {
        const cnt = 6 * n;
        for (let i = 0; i < cnt; i++) {
          const p = (T * 0.45 + hash(f.id, i, 1)) % 1;
          const px = X + (hash(f.id, i, 2) - 0.5) * 30 + Math.sin(p * 7 + i) * 5;
          const py = Y - 20 - p * 34;
          c.globalAlpha = fade * (1 - p);
          note(c, Math.round(px), Math.round(py), CONFETTI[i % 5]);
        }
        break;
      }
      case "sparkle":
      case "stars": {
        const cnt = (f.fx === "stars" ? 14 : 10) * n;
        for (let i = 0; i < cnt; i++) {
          const tw = Math.sin(T * 8 + i * 1.7);
          if (tw < -0.2) continue;
          const r = f.fx === "stars" ? 8 + T * 30 : 14;
          const a = hash(f.id, i, 1) * Math.PI * 2;
          const d = hash(f.id, i, 2) * r;
          star(c, Math.round(X + Math.cos(a) * d), Math.round(Y - 12 + Math.sin(a) * d * 0.8), tw > 0.6 ? 2 : 1, i % 2 ? "#fff6a8" : "#ffffff");
        }
        break;
      }
      case "splash": {
        for (let i = 0; i < 16 * n; i++) {
          const a = -Math.PI * hash(f.id, i, 1);
          const sp = 20 + hash(f.id, i, 2) * 30;
          const tt = Math.min(T, 0.9);
          R(c, Math.round(X + Math.cos(a) * sp * tt), Math.round(Y - 6 + Math.sin(a) * sp * tt + 60 * tt * tt), 2, 2, i % 2 ? "#6b4226" : "#8fc8ef");
        }
        break;
      }
      case "lightning": {
        if (T < 0.25) flash.v = Math.max(flash.v, 1 - T * 4);
        if (T < 0.5) {
          c.globalAlpha = 1 - T * 2;
          let lx = X;
          let ly = Y - 80;
          for (let i = 0; i < 10; i++) {
            const nx = lx + (hash(f.id, i, 1) - 0.5) * 14;
            const ny = ly + 8;
            for (let s = 0; s < 8; s++) R(c, Math.round(lx + ((nx - lx) * s) / 8), Math.round(ly + s), 2, 1, "#fffbd0");
            lx = nx;
            ly = ny;
          }
        }
        break;
      }
      case "postits":
      case "paper":
      case "money":
      case "feathers": {
        const cnt = 16 * n;
        const cols =
          f.fx === "postits" ? ["#ffe36e", "#ff9fc4", "#8fd3ff", "#b6f09c"] : f.fx === "money" ? ["#5fbf6a", "#3f9a4a"] : f.fx === "feathers" ? ["#d9dde3", "#aeb4bd"] : ["#ffffff", "#eeeeee"];
        for (let i = 0; i < cnt; i++) {
          const period = 2 + hash(f.id, i, 2) * 1.5;
          const p = ((T + hash(f.id, i, 3) * period) % period) / period;
          const px = X + (hash(f.id, i, 1) - 0.5) * 90 + Math.sin(p * 9 + i) * 8;
          const py = Y - 70 + p * 80;
          const w = Math.abs(Math.sin(p * 12 + i)) > 0.4 ? 4 : 2;
          R(c, Math.round(px), Math.round(py), w, f.fx === "feathers" ? 1 : 3, cols[i % cols.length]);
        }
        break;
      }
      case "explosion": {
        const p = Math.min(1, T / 0.7);
        c.globalAlpha = fade * (1 - p);
        c.fillStyle = "#ffcf5a";
        c.beginPath();
        c.arc(X, Y - 8, 6 + p * 26, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#ff7a2f";
        c.beginPath();
        c.arc(X, Y - 8, 3 + p * 16, 0, Math.PI * 2);
        c.fill();
        c.globalAlpha = fade;
        for (let i = 0; i < 20; i++) {
          const a = hash(f.id, i, 1) * Math.PI * 2;
          const d = p * (20 + hash(f.id, i, 2) * 30);
          R(c, Math.round(X + Math.cos(a) * d), Math.round(Y - 8 + Math.sin(a) * d), 2, 2, i % 2 ? "#3a3a3a" : "#ff9f1c");
        }
        if (T < 0.15) flash.v = Math.max(flash.v, 0.5);
        break;
      }
      case "rainbow": {
        const cols = ["#ff4d4d", "#ff9f1c", "#ffd23f", "#3ddc84", "#4cc9f0", "#7f5af0"];
        c.globalAlpha = fade * Math.min(1, T * 2);
        for (let k = 0; k < cols.length; k++) {
          c.strokeStyle = cols[k];
          c.lineWidth = 2;
          c.beginPath();
          c.arc(X, Y, 34 - k * 2, Math.PI, 0);
          c.stroke();
        }
        break;
      }
      case "zzz": {
        for (let i = 0; i < 3; i++) {
          const p = (T * 0.5 + i / 3) % 1;
          c.globalAlpha = fade * (1 - p);
          zz(c, Math.round(X + 4 + p * 10 + i), Math.round(Y - 22 - p * 16), "#cfd8ff");
        }
        break;
      }
      case "fire": {
        for (let i = 0; i < 18 * n; i++) {
          const p = (T * 1.6 + hash(f.id, i, 1)) % 1;
          const px = X + (hash(f.id, i, 2) - 0.5) * 16 + Math.sin(p * 10 + i) * 2;
          const py = Y - 2 - p * 20;
          c.globalAlpha = fade * (1 - p);
          R(c, Math.round(px), Math.round(py), 2, 2, p < 0.3 ? "#fff3a8" : p < 0.6 ? "#ffb347" : "#ff5b2f");
        }
        break;
      }
      case "bubbles": {
        for (let i = 0; i < 10 * n; i++) {
          const p = (T * 0.35 + hash(f.id, i, 1)) % 1;
          const px = X + (hash(f.id, i, 2) - 0.5) * 40 + Math.sin(p * 6 + i) * 6;
          const py = Y - 10 - p * 50;
          c.globalAlpha = fade * (1 - p * 0.6);
          c.strokeStyle = "#bfe6ff";
          c.lineWidth = 1;
          c.beginPath();
          c.arc(px, py, 2 + (i % 3), 0, Math.PI * 2);
          c.stroke();
          R(c, Math.round(px - 1), Math.round(py - 1), 1, 1, "#ffffff");
        }
        break;
      }
      case "question":
      case "exclaim": {
        const bob = Math.round(Math.abs(Math.sin(T * 6)) * -3);
        const col = f.fx === "question" ? "#4cc9f0" : "#ffd23f";
        const x = Math.round(X) - 2;
        const y = Math.round(Y) - 40 + bob;
        R(c, x - 1, y - 1, 6, 11, "#2a2230");
        if (f.fx === "exclaim") {
          R(c, x + 1, y, 2, 6, col);
          R(c, x + 1, y + 7, 2, 2, col);
        } else {
          R(c, x, y, 4, 2, col);
          R(c, x + 3, y + 2, 1, 2, col);
          R(c, x + 1, y + 4, 2, 2, col);
          R(c, x + 1, y + 7, 2, 2, col);
        }
        break;
      }
      case "shockwave": {
        const p = Math.min(1, T / 0.9);
        c.globalAlpha = fade * (1 - p);
        c.strokeStyle = "#ffffff";
        c.lineWidth = 2;
        c.beginPath();
        c.ellipse(X, Y, 4 + p * 60, 2 + p * 30, 0, 0, Math.PI * 2);
        c.stroke();
        break;
      }
    }
  }
  c.globalAlpha = 1;
}
