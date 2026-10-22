import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { useBeatPunch } from "../lib/beat";
import { Background } from "./Background";
import { BrowserFrame, BAR_H } from "./BrowserFrame";
import { CamKey, KenBurns } from "./KenBurns";

export type Shot = { src: string; w: number; h: number };

export const SHOTS = {
  dashboard: { src: "s-dashboard.png", w: 2805, h: 1585 },
  todo: { src: "s-todo.png", w: 2794, h: 1596 },
  calendar: { src: "s-calendar.png", w: 2807, h: 1604 },
  finance: { src: "s-finance.png", w: 2794, h: 1596 },
  ai: { src: "s-ai.png", w: 2801, h: 1603 },
  goals: { src: "s-goals.png", w: 2800, h: 1596 },
  gpa: { src: "s-gpa.png", w: 2800, h: 1603 },
  journal: { src: "s-journal.png", w: 2544, h: 1592 },
  storage: { src: "s-storage.png", w: 1702, h: 1473 },
} satisfies Record<string, Shot>;

const FRAME_W = 1260;
const VIEW_H = Math.round(FRAME_W / 1.75);

/**
 * Standard feature scene: caption column on one side, a browser window on the other that bleeds
 * off the screen edge, slides in with a 3D swing, floats gently and pulses on the beat.
 */
export const ScreenScene: React.FC<{
  shot: Shot;
  keys: CamKey[];
  textSide: "left" | "right";
  caption: React.ReactNode;
  overlays?: React.ReactNode;
  extra?: React.ReactNode;
}> = ({ shot, keys, textSide, caption, overlays, extra }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const punch = useBeatPunch(0.008);
  const enter = spring({ frame, fps, config: { damping: 20, stiffness: 90, mass: 1 } });
  const dir = textSide === "left" ? 1 : -1;
  const floatY = Math.sin(frame / 38) * 7;
  const rotY = (1 - enter) * -28 * dir + Math.sin(frame / 55) * 1.2 * dir;
  const frameLeft = textSide === "left" ? 760 : 1920 - 760 - FRAME_W;
  const top = (1080 - (VIEW_H + BAR_H)) / 2;

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ perspective: 2200 }}>
        <div
          style={{
            position: "absolute",
            left: frameLeft,
            top,
            transform: `translateX(${(1 - enter) * 500 * dir}px) translateY(${floatY}px) rotateY(${rotY}deg) scale(${punch})`,
            transformOrigin: textSide === "left" ? "left center" : "right center",
            opacity: Math.min(1, enter * 1.6),
          }}
        >
          <BrowserFrame width={FRAME_W} height={VIEW_H}>
            <KenBurns src={shot.src} imgW={shot.w} imgH={shot.h} width={FRAME_W} height={VIEW_H} keys={keys}>
              {overlays}
            </KenBurns>
          </BrowserFrame>
        </div>
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          display: "flex",
          alignItems: "center",
          ...(textSide === "left" ? { left: 110 } : { right: 110 }),
        }}
      >
        {caption}
      </div>
      {extra}
    </AbsoluteFill>
  );
};
