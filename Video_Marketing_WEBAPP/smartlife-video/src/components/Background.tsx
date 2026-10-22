import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C } from "../theme";

const BLOBS = [
  { color: C.blue, x: 12, y: 18, r: 46, sp: 0.011 },
  { color: C.green, x: 88, y: 22, r: 38, sp: 0.009 },
  { color: C.purple, x: 78, y: 92, r: 44, sp: 0.013 },
  { color: C.teal, x: 20, y: 88, r: 36, sp: 0.01 },
];

export const Background: React.FC<{ dark?: boolean; intensity?: number }> = ({ dark = false, intensity = 1 }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: dark ? C.dark : C.bg, overflow: "hidden" }}>
      {BLOBS.map((b, i) => {
        const dx = Math.sin(f * b.sp + i * 1.7) * 6;
        const dy = Math.cos(f * b.sp * 0.8 + i) * 5;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${b.x + dx - b.r / 2}%`,
              top: `${b.y + dy - b.r / 2}%`,
              width: `${b.r}%`,
              aspectRatio: "1",
              borderRadius: "50%",
              background: `radial-gradient(circle, ${b.color} 0%, transparent 68%)`,
              opacity: (dark ? 0.28 : 0.16) * intensity,
              filter: "blur(40px)",
            }}
          />
        );
      })}
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${dark ? "rgba(255,255,255,0.06)" : "rgba(14,21,37,0.06)"} 1.2px, transparent 1.2px)`,
          backgroundSize: "28px 28px",
        }}
      />
    </AbsoluteFill>
  );
};
