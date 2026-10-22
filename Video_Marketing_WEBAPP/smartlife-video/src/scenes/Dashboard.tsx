import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Background } from "../components/Background";
import { BrowserFrame } from "../components/BrowserFrame";
import { KenBurns } from "../components/KenBurns";
import { Highlight } from "../components/Overlays";
import { SHOTS } from "../components/ScreenScene";
import { Sfx } from "../components/Sfx";
import { Chip, Kicker, KineticText } from "../components/Text";
import { useBeatPunch, useBeats } from "../lib/beat";
import { C } from "../theme";

const W = 1400;
const H = Math.round(W / 1.77);

export const Dashboard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { b } = useBeats();
  const punch = useBeatPunch(0.008);
  const enter = spring({ frame, fps, config: { damping: 22, stiffness: 70 } });
  const shot = SHOTS.dashboard;

  const regions = [
    { at: 4, until: 9, x0: 0.09, y0: 0.15, x1: 0.295, y1: 0.66, color: C.blue },
    { at: 9, until: 14, x0: 0.308, y0: 0.16, x1: 0.73, y1: 0.44, color: C.purple },
    { at: 14, until: 19, x0: 0.758, y0: 0.13, x1: 0.975, y1: 0.7, color: C.green },
    { at: 19, until: 24, x0: 0.075, y0: 0.71, x1: 0.745, y1: 0.995, color: C.teal },
  ];
  const chips = [
    { at: 4, label: "Todo", icon: "⚡", color: C.blue, region: 0 },
    { at: 4.5, label: "Tài chính", icon: "💰", color: C.blue, region: 0 },
    { at: 9, label: "Lịch trình", icon: "📅", color: C.purple, region: 1 },
    { at: 14, label: "Tâm trạng", icon: "😊", color: C.green, region: 2 },
    { at: 14.5, label: "Thói quen", icon: "🔥", color: C.green, region: 2 },
    { at: 19, label: "GPA", icon: "🎓", color: C.teal, region: 3 },
    { at: 19.5, label: "Mục tiêu", icon: "🎯", color: C.teal, region: 3 },
  ];
  const activeRegion = regions.findIndex((r) => frame >= b(r.at) && frame < b(r.until));

  return (
    <AbsoluteFill>
      <Background />
      <div style={{ position: "absolute", left: 110, top: 52, display: "flex", alignItems: "center", gap: 28 }}>
        <Kicker text="Tổng quan" at={b(0)} />
        <KineticText text="Cả cuộc sống, **trên một màn hình.**" at={b(0) + 4} size={52} />
      </div>

      <AbsoluteFill style={{ perspective: 2000 }}>
        <div
          style={{
            position: "absolute",
            left: (1920 - W) / 2,
            top: 168,
            transform: `translateY(${(1 - enter) * 420 + Math.sin(frame / 40) * 6}px) rotateX(${(1 - enter) * 32}deg) scale(${(0.86 + 0.14 * enter) * punch})`,
            transformOrigin: "center top",
            opacity: Math.min(1, enter * 1.5),
          }}
        >
          <BrowserFrame width={W} height={H}>
            <KenBurns
              src={shot.src}
              imgW={shot.w}
              imgH={shot.h}
              width={W}
              height={H}
              keys={[
                { f: 0, x: 0.5, y: 0.5, z: 1 },
                { f: b(3), x: 0.5, y: 0.5, z: 1 },
                { f: b(4), x: 0.26, y: 0.42, z: 1.65 },
                { f: b(8), x: 0.24, y: 0.4, z: 1.7 },
                { f: b(9), x: 0.52, y: 0.32, z: 1.75 },
                { f: b(13), x: 0.54, y: 0.3, z: 1.8 },
                { f: b(14), x: 0.86, y: 0.42, z: 1.85 },
                { f: b(18), x: 0.86, y: 0.45, z: 1.9 },
                { f: b(19), x: 0.42, y: 0.86, z: 1.6 },
                { f: b(23), x: 0.45, y: 0.86, z: 1.65 },
                { f: b(24.5), x: 0.5, y: 0.5, z: 1 },
              ]}
            >
              {regions.map((r, i) => (
                <Highlight key={i} {...r} at={b(r.at) + 4} until={b(r.until)} />
              ))}
            </KenBurns>
          </BrowserFrame>
        </div>
      </AbsoluteFill>

      <div style={{ position: "absolute", left: 0, right: 0, bottom: 34, display: "flex", justifyContent: "center", gap: 14 }}>
        {chips.map((c) => (
          <Chip key={c.label} at={b(c.at)} label={c.label} icon={c.icon} color={c.color} size={23} active={activeRegion === c.region} />
        ))}
      </div>

      {regions.map((r) => (
        <Sfx key={r.at} at={b(r.at) - 5} name="whoosh" volume={0.3} />
      ))}
      {chips.map((c) => (
        <Sfx key={c.label} at={b(c.at)} name="pop" volume={0.4} />
      ))}
      <Sfx at={b(24) - 4} name="whoosh" volume={0.3} />
    </AbsoluteFill>
  );
};
