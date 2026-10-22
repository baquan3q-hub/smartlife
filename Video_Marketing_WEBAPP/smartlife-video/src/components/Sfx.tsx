import React from "react";
import { Audio, Sequence, staticFile } from "remotion";

export type SfxName = "whoosh" | "whip" | "pop" | "click" | "tick" | "riser" | "impact" | "ding" | "glitch" | "sparkle";

const LENGTH: Record<SfxName, number> = {
  whoosh: 24,
  whip: 14,
  pop: 8,
  click: 4,
  tick: 4,
  riser: 70,
  impact: 62,
  ding: 44,
  glitch: 12,
  sparkle: 42,
};

export const Sfx: React.FC<{ at: number; name: SfxName; volume?: number }> = ({ at, name, volume = 0.5 }) => (
  <Sequence from={at} durationInFrames={LENGTH[name]} layout="none" name={`sfx:${name}`}>
    <Audio src={staticFile(`sfx/${name}.wav`)} volume={volume} />
  </Sequence>
);
