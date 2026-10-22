// Synthesizes every SFX (plus a 120 BPM placeholder music track) as WAV in public/sfx.
// No samples from outside, so there are no licensing concerns.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "sfx");
fs.mkdirSync(OUT, { recursive: true });

const SR = 44100;
const TAU = Math.PI * 2;

// ---------- helpers ----------
let seed = 1337;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const noise = () => rnd() * 2 - 1;

function writeWav(name, data, peak = 0.89) {
  let max = 0;
  for (const v of data) max = Math.max(max, Math.abs(v));
  const g = max > 0 ? peak / max : 1;
  const buf = Buffer.alloc(44 + data.length * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + data.length * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(data.length * 2, 40);
  for (let i = 0; i < data.length; i++) {
    const s = Math.max(-1, Math.min(1, data[i] * g));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log("wrote", name, (data.length / SR).toFixed(2) + "s");
}

// RBJ biquad, coefficients may change every sample (for sweeps).
class Biquad {
  constructor() {
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
  }
  set(type, f, q) {
    const w = (TAU * Math.min(f, SR * 0.45)) / SR;
    const cs = Math.cos(w);
    const a = Math.sin(w) / (2 * q);
    let b0, b1, b2;
    if (type === "lp") [b0, b1, b2] = [(1 - cs) / 2, 1 - cs, (1 - cs) / 2];
    else if (type === "hp") [b0, b1, b2] = [(1 + cs) / 2, -(1 + cs), (1 + cs) / 2];
    else [b0, b1, b2] = [a, 0, -a]; // band-pass
    const a0 = 1 + a;
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = (-2 * cs) / a0;
    this.a2 = (1 - a) / a0;
    return this;
  }
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

const make = (sec, fn) => {
  const n = Math.round(sec * SR);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = fn(i / SR, i, n);
  return out;
};

// ---------- SFX ----------
function whoosh(sec, f0, fPeak, f1, peakAt) {
  const bp = new Biquad();
  const lp = new Biquad().set("lp", 400, 0.7);
  return make(sec, (t) => {
    const p = t / sec;
    const f = p < peakAt ? f0 * Math.pow(fPeak / f0, p / peakAt) : fPeak * Math.pow(f1 / fPeak, (p - peakAt) / (1 - peakAt));
    bp.set("bp", f, 1.4);
    const env = p < peakAt ? Math.pow(p / peakAt, 2.2) : Math.pow(1 - (p - peakAt) / (1 - peakAt), 1.6);
    const n = noise();
    return (bp.run(n) * 1.0 + lp.run(n) * 0.35) * env;
  });
}

writeWav("whoosh.wav", whoosh(0.7, 250, 3200, 900, 0.6));
writeWav("whip.wav", whoosh(0.38, 700, 6500, 2000, 0.55));

writeWav(
  "pop.wav",
  make(0.16, (t) => {
    // pitch glides 1080 Hz → 180 Hz; phase is the integral of that curve
    const ph = TAU * (180 * t + (900 / 32) * (1 - Math.exp(-t * 32)));
    return Math.sin(ph) * Math.exp(-t * 26) + noise() * Math.exp(-t * 400) * 0.25;
  }),
);

{
  const hp = new Biquad().set("hp", 2500, 0.7);
  writeWav(
    "click.wav",
    make(0.03, (t) => hp.run(noise()) * Math.exp(-t * 220) * 0.7 + Math.sin(TAU * 3200 * t) * Math.exp(-t * 300)),
  );
}

writeWav(
  "tick.wav",
  make(0.035, (t) => Math.sin(TAU * 2300 * t) * Math.exp(-t * 230) + noise() * Math.exp(-t * 900) * 0.2),
  0.5,
);

{
  const bp = new Biquad();
  const lp = new Biquad();
  writeWav(
    "riser.wav",
    make(2.2, (t) => {
      const p = t / 2.2;
      bp.set("bp", 200 * Math.pow(40, p), 2);
      const pitch = 110 * Math.pow(8, p);
      const saw = ((pitch * t) % 1) * 2 - 1;
      lp.set("lp", 300 + 5000 * p * p, 1);
      const env = Math.pow(p, 2.4) * (p > 0.97 ? (1 - p) / 0.03 : 1);
      return (bp.run(noise()) * 0.9 + lp.run(saw) * 0.35) * env;
    }),
  );
}

{
  const lp = new Biquad().set("lp", 900, 0.8);
  writeWav(
    "impact.wav",
    make(2.0, (t) => {
      const ph = TAU * (42 * t + ((150 - 42) / 18) * (1 - Math.exp(-t * 18)));
      const body = Math.sin(ph) * Math.exp(-t * 2.4);
      const crack = lp.run(noise()) * Math.exp(-t * 14) * 0.9;
      return Math.tanh((body * 1.2 + crack) * 1.8);
    }),
  );
}

{
  const tone = (t, f) =>
    (Math.sin(TAU * f * t) * Math.exp(-t * 4) +
      Math.sin(TAU * f * 2.0 * t) * Math.exp(-t * 7) * 0.4 +
      Math.sin(TAU * f * 2.76 * t) * Math.exp(-t * 10) * 0.25 +
      Math.sin(TAU * f * 5.4 * t) * Math.exp(-t * 18) * 0.12) *
    Math.min(1, t * 400);
  writeWav(
    "ding.wav",
    make(1.4, (t) => tone(t, 1318.5) * 0.7 + (t > 0.09 ? tone(t - 0.09, 1760) : 0)),
  );
}

{
  let f = 400;
  let gate = 1;
  writeWav(
    "glitch.wav",
    make(0.32, (t, i) => {
      if (i % Math.round(SR * 0.018) === 0) {
        f = 90 + rnd() * 1600;
        gate = rnd() > 0.25 ? 1 : 0;
      }
      const sq = Math.sin(TAU * f * t) > 0 ? 1 : -1;
      const crushed = Math.round((sq * 0.6 + noise() * 0.4) * 4) / 4;
      return crushed * gate * (1 - t / 0.32) * 0.8;
    }),
  );
}

{
  const notes = Array.from({ length: 9 }, (_, k) => ({ at: k * 0.075, f: 2000 + rnd() * 3200 }));
  writeWav(
    "sparkle.wav",
    make(1.3, (t) => {
      let s = 0;
      for (const n of notes) {
        if (t >= n.at) {
          const u = t - n.at;
          s += Math.sin(TAU * n.f * u) * Math.exp(-u * 9) * Math.min(1, u * 600);
        }
      }
      return s * 0.4;
    }),
  );
}

// ---------- placeholder music: 120 BPM, A minor (Am-F-C-G), 96 bars ----------
if (!process.argv.includes("--no-music")) {
  const BPM = 120;
  const beat = 60 / BPM;
  const bar = beat * 4;
  const BARS = 96;
  const dur = BARS * bar + 2;
  const n = Math.round(dur * SR);
  const mix = new Float32Array(n);
  const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const chords = [
    [57, 60, 64], // Am
    [53, 57, 60], // F
    [48, 52, 55], // C
    [55, 59, 62], // G
  ];
  const roots = [45, 41, 48, 43];
  const add = (start, buf, gain) => {
    const s0 = Math.round(start * SR);
    for (let i = 0; i < buf.length && s0 + i < n; i++) mix[s0 + i] += buf[i] * gain;
  };
  const kick = make(0.32, (t) => Math.sin(TAU * (45 * t + ((140 - 45) / 22) * (1 - Math.exp(-t * 22)))) * Math.exp(-t * 9));
  const bpC = new Biquad().set("bp", 1700, 0.9);
  const clap = make(0.2, (t) => bpC.run(noise()) * Math.exp(-t * 22));
  const hpH = new Biquad().set("hp", 7000, 0.7);
  const hat = make(0.05, (t) => hpH.run(noise()) * Math.exp(-t * 90));
  const hpO = new Biquad().set("hp", 6000, 0.7);
  const ohat = make(0.25, (t) => hpO.run(noise()) * Math.exp(-t * 14));

  // section energy per bar: 0 = intro (hook), 1 = full, 2 = outro
  const section = (b) => (b < 6 ? 0 : b >= 90 ? 2 : 1);

  for (let b = 0; b < BARS; b++) {
    const t0 = b * bar;
    const sec = section(b);
    for (let k = 0; k < 4; k++) {
      const tb = t0 + k * beat;
      if (sec === 1 || (sec === 0 && k === 0 && b >= 2)) add(tb, kick, 0.9);
      if (sec === 1 && (k === 1 || k === 3)) add(tb, clap, 0.35);
      add(tb + beat / 2, hat, sec === 2 ? 0.08 : 0.16);
      if (sec === 1) add(tb, hat, 0.07);
      if (sec === 1 && k === 3) add(tb + beat / 2, ohat, 0.08);
    }
  }

  // tonal layers rendered per-sample (pad + bass + pluck), with sidechain pump
  const padLP = new Biquad();
  const bassLP = new Biquad();
  const plLP = new Biquad().set("lp", 3000, 0.7);
  const det = [-0.11, 0, 0.12];
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const b = Math.floor(t / bar);
    if (b >= BARS) break;
    const sec = section(b);
    const ci = b % 4;
    const inBeat = (t % beat) / beat;
    const pump = sec === 1 ? 0.35 + 0.65 * Math.min(1, inBeat * 2.2) : 1;
    // pad
    let pad = 0;
    for (const m of chords[ci]) {
      for (const d of det) {
        const f = midi(m + d);
        pad += ((f * t) % 1) * 2 - 1;
      }
    }
    padLP.set("lp", sec === 0 ? 600 + 900 * (b / 6) : 1400 + 400 * Math.sin(TAU * t * 0.05), 0.8);
    let s = padLP.run(pad / 9) * 0.32 * pump;
    // bass: 8th notes
    if (sec === 1 || (sec === 0 && b >= 4)) {
      const f = midi(roots[ci]);
      const eighth = (t % (beat / 2)) / (beat / 2);
      const saw = ((f * t) % 1) * 2 - 1;
      bassLP.set("lp", 380, 1.1);
      s += bassLP.run(saw) * 0.42 * Math.exp(-eighth * 2.5) * pump;
    }
    // pluck arp on 16ths in the full section after bar 10
    if (sec === 1 && b >= 10) {
      const six = Math.floor((t % bar) / (beat / 4));
      const notes = chords[ci].map((m) => m + 12);
      const m = notes[[0, 1, 2, 1][six % 4]] + (six >= 8 ? 12 : 0);
      const u = t % (beat / 4);
      const tri = Math.asin(Math.sin(TAU * midi(m) * t)) / (Math.PI / 2);
      s += plLP.run(tri) * Math.exp(-u * 26) * 0.12;
    }
    // global fade in/out
    const fadeIn = Math.min(1, t / 1.0);
    const fadeOut = b >= 90 ? Math.max(0, 1 - (t - 90 * bar) / (6 * bar)) : 1;
    mix[i] += s * fadeIn * fadeOut;
  }
  // soft limiter
  for (let i = 0; i < n; i++) mix[i] = Math.tanh(mix[i] * 1.1);
  writeWav("placeholder-bgm.wav", mix, 0.8);
}
