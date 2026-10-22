import React, { createContext, useContext } from "react";
import { useCurrentFrame } from "remotion";
import { BAR, BEAT } from "../timeline";

type Ctx = { lead: number; duration: number };
const SceneCtx = createContext<Ctx>({ lead: 0, duration: 0 });

export const SceneProvider: React.FC<Ctx & { children: React.ReactNode }> = ({ children, ...v }) => (
  <SceneCtx.Provider value={v}>{children}</SceneCtx.Provider>
);

export const useScene = () => useContext(SceneCtx);

/** Local frame of beat `k` (0 = the scene's first downbeat). Fractions allowed. */
export const useBeats = () => {
  const { lead, duration } = useScene();
  const b = (k: number) => Math.round(lead + k * BEAT);
  return { b, lead, duration };
};

/** A small scale bump on every beat (bigger on the bar's downbeat) to keep things moving with the music. */
export const useBeatPunch = (amount = 0.012) => {
  const frame = useCurrentFrame();
  const { lead } = useScene();
  const t = frame - lead;
  if (t < 0) return 1;
  const inBeat = (t % BEAT) / BEAT;
  const isDown = Math.floor((t % BAR) / BEAT) === 0;
  return 1 + amount * (isDown ? 1.6 : 1) * Math.exp(-inBeat * 7);
};
