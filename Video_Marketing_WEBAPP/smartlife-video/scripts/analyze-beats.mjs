// Finds the BPM and first downbeat of ../music/bgm.(mp3|wav|m4a|aac|ogg|flac), copies it into public/,
// and writes src/beats.json so every scene cut snaps to the music's bars.
// Without a music file it falls back to the 120 BPM placeholder from gen-sfx.mjs.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MUSIC_DIR = path.resolve(ROOT, "..", "music");
const OUT_JSON = path.join(ROOT, "src", "beats.json");

const exts = ["mp3", "wav", "m4a", "aac", "ogg", "flac"];
const src = process.argv[2] ?? exts.map((e) => path.join(MUSIC_DIR, `bgm.${e}`)).find((p) => fs.existsSync(p));

if (!src) {
  const placeholder = { music: "sfx/placeholder-bgm.wav", bpm: 120, offset: 0, duration: 194, placeholder: true };
  fs.writeFileSync(OUT_JSON, JSON.stringify(placeholder, null, 2));
  console.log("No music/bgm.* found → using placeholder", placeholder);
  process.exit(0);
}

const compositorDir = fs
  .readdirSync(path.join(ROOT, "node_modules", "@remotion"))
  .find((d) => d.startsWith("compositor-"));
const ffmpeg = path.join(ROOT, "node_modules", "@remotion", compositorDir, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");

const SR = 11025;
const dec = spawnSync(ffmpeg, ["-v", "error", "-i", src, "-ac", "1", "-ar", String(SR), "-c:a", "pcm_s16le", "-f", "wav", "-"], {
  maxBuffer: 1 << 30,
});
if (dec.status !== 0) {
  console.error(dec.stderr.toString());
  process.exit(1);
}
// bundled ffmpeg has no raw muxers, so read 16-bit PCM out of a piped WAV
const wav = dec.stdout;
const dataAt = wav.indexOf("data") + 8;
const pcm = new Float32Array(Math.floor((wav.length - dataAt) / 2));
for (let i = 0; i < pcm.length; i++) pcm[i] = wav.readInt16LE(dataAt + i * 2) / 32768;
const duration = pcm.length / SR;

// --- onset envelope from three bands (low / mid / high) ---
class OnePole {
  constructor(fc) {
    this.a = Math.exp((-2 * Math.PI * fc) / SR);
    this.y = 0;
  }
  run(x) {
    return (this.y = (1 - this.a) * x + this.a * this.y);
  }
}
const lp200 = new OnePole(200);
const lp2k = new OnePole(2000);
const HOP = 256;
const frames = Math.floor(pcm.length / HOP);
const eLow = new Float32Array(frames);
const eMid = new Float32Array(frames);
const eHigh = new Float32Array(frames);
for (let f = 0; f < frames; f++) {
  let l = 0, m = 0, h = 0;
  for (let i = f * HOP; i < (f + 1) * HOP; i++) {
    const x = pcm[i];
    const a = lp200.run(x);
    const b = lp2k.run(x);
    l += a * a;
    m += (b - a) * (b - a);
    h += (x - b) * (x - b);
  }
  eLow[f] = Math.log1p(l * 100);
  eMid[f] = Math.log1p(m * 100);
  eHigh[f] = Math.log1p(h * 100);
}
const env = new Float32Array(frames);
const kick = new Float32Array(frames);
for (let f = 1; f < frames; f++) {
  const dl = Math.max(0, eLow[f] - eLow[f - 1]);
  env[f] = dl * 1.5 + Math.max(0, eMid[f] - eMid[f - 1]) + Math.max(0, eHigh[f] - eHigh[f - 1]) * 0.7;
  kick[f] = dl;
}
const fps = SR / HOP;

// --- tempo by autocorrelation (80–160 BPM, mild prior around 120) ---
let best = { score: -1, lag: 0 };
const scores = [];
for (let lag = Math.floor((fps * 60) / 160); lag <= Math.ceil((fps * 60) / 80); lag++) {
  let s = 0;
  for (let f = 0; f + lag < frames; f++) s += env[f] * env[f + lag];
  const bpm = (60 * fps) / lag;
  s *= Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 0.6, 2));
  scores[lag] = s;
  if (s > best.score) best = { score: s, lag };
}
const l = best.lag;
const y0 = scores[l - 1] ?? best.score, y2 = scores[l + 1] ?? best.score;
const lagF = l + (0.5 * (y0 - y2)) / (y0 - 2 * best.score + y2 || 1);
const coarseBpm = (60 * fps) / lagF;

// --- refine BPM and beat phase together with a comb fit (autocorrelation alone drifts over 3 minutes) ---
const at = (t) => {
  const i = Math.floor(t), u = t - i;
  return (env[i] || 0) * (1 - u) + (env[i + 1] || 0) * u;
};
let bpm = coarseBpm, bestPhase = 0, bestPhaseScore = -1;
for (let cand = coarseBpm - 1.5; cand <= coarseBpm + 1.5; cand += 0.02) {
  const per = (60 / cand) * fps;
  for (let ph = 0; ph < per; ph += 0.25) {
    let sc = 0;
    for (let t = ph; t < frames; t += per) sc += at(t);
    if (sc > bestPhaseScore) {
      bestPhaseScore = sc;
      bestPhase = ph;
      bpm = cand;
    }
  }
}
bpm = Math.round(bpm * 100) / 100;
const period = (60 / bpm) * fps;
const barScores = [0, 0, 0, 0];
for (let k = 0, t = bestPhase; t < frames; k++, t += period) {
  const i = Math.round(t);
  barScores[k % 4] += (kick[i] || 0) + (kick[i + 1] || 0);
}
// only trust the low-end heuristic when one beat clearly dominates; otherwise start at the first beat
const sorted = [...barScores].sort((x, y) => y - x);
const down = sorted[0] > sorted[1] * 1.15 ? barScores.indexOf(sorted[0]) : 0;
const offset = Math.round(((bestPhase + down * period) / fps) * 1000) / 1000;

const ext = path.extname(src);
fs.copyFileSync(src, path.join(ROOT, "public", `bgm${ext}`));
const result = { music: `bgm${ext}`, bpm, offset, duration: Math.round(duration * 100) / 100, placeholder: false };
fs.writeFileSync(OUT_JSON, JSON.stringify(result, null, 2));
console.log(result);
if (duration < 185) console.warn("⚠ Track is shorter than the video (~3:05); it will be looped at a bar boundary.");
