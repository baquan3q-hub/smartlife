import beats from "./beats.json";

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

export const BPM = beats.bpm;
export const BEAT = (60 / BPM) * FPS; // frames per beat (may be fractional)
export const BAR = BEAT * 4;
export const OFFSET = beats.offset * FPS; // frame of the music's first downbeat
export const MUSIC = beats.music;
export const MUSIC_SECONDS = beats.duration;

export type TransitionKind = "zoomBlur" | "slideUp" | "slideLeft" | "wipeRight" | "wipeLeft" | "flash" | "none";

// `seconds` is the target length; it gets snapped to whole bars of the music.
// `out` is the transition into the next scene.
const SCENE_DEFS = [
  { id: "hook", seconds: 12, out: "zoomBlur" },
  { id: "logo", seconds: 10, out: "slideUp" },
  { id: "dashboard", seconds: 14, out: "zoomBlur" },
  { id: "todo", seconds: 16, out: "slideLeft" },
  { id: "calendar", seconds: 14, out: "wipeRight" },
  { id: "finance", seconds: 16, out: "zoomBlur" },
  { id: "gpa", seconds: 14, out: "flash" },
  { id: "ai", seconds: 22, out: "slideLeft" },
  { id: "goals", seconds: 10, out: "zoomBlur" },
  { id: "journal", seconds: 10, out: "slideUp" },
  { id: "storage", seconds: 8, out: "wipeLeft" },
  { id: "mobile", seconds: 22, out: "zoomBlur" },
  { id: "recap", seconds: 10, out: "flash" },
  { id: "cta", seconds: 8, out: "none" },
] as const satisfies readonly { id: string; seconds: number; out: TransitionKind }[];

export type SceneId = (typeof SCENE_DEFS)[number]["id"];

export type SceneTiming = {
  id: SceneId;
  out: TransitionKind;
  from: number; // absolute start frame (includes the incoming transition overlap)
  duration: number;
  lead: number; // local frame where the scene's first downbeat lands (= end of incoming transition)
  boundary: number; // absolute frame where the next scene is fully on screen (a downbeat)
  outFrames: number; // length of the outgoing transition
};

const transitionFrames = (kind: TransitionKind) => (kind === "none" ? 0 : Math.round(BEAT));

export const TIMELINE: SceneTiming[] = (() => {
  const out: SceneTiming[] = [];
  let bars = 0;
  let prevBoundary = Math.round(OFFSET);
  let prevT = 0;
  SCENE_DEFS.forEach((s, i) => {
    bars += Math.max(1, Math.round(s.seconds / (BAR / FPS)));
    const boundary = Math.round(OFFSET + bars * BAR);
    const from = i === 0 ? 0 : prevBoundary - prevT;
    const lead = i === 0 ? Math.round(OFFSET) : prevT;
    const t = transitionFrames(s.out);
    out.push({ id: s.id, out: s.out, from, duration: boundary - from, lead, boundary, outFrames: t });
    prevBoundary = boundary;
    prevT = t;
  });
  return out;
})();

export const TOTAL_FRAMES = TIMELINE[TIMELINE.length - 1].boundary;
