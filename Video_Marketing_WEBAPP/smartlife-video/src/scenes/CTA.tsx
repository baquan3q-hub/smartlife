import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Background } from "../components/Background";
import { Sfx } from "../components/Sfx";
import { KineticText } from "../components/Text";
import { useBeats } from "../lib/beat";
import { C } from "../theme";

export const CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { b, duration } = useBeats();
  const logo = spring({ frame: frame - b(0), fps, config: { damping: 10, stiffness: 130 } });
  const glow = 0.5 + 0.5 * Math.sin(frame / 12);
  const fade = interpolate(frame, [duration - 36, duration - 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const line = interpolate(frame, [b(3), b(4)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <Background intensity={1.3} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
        <Img
          src={staticFile("logo-mark.jpg")}
          style={{
            width: 220,
            height: 220,
            borderRadius: 33,
            transform: `scale(${logo}) rotate(${(1 - logo) * -20}deg)`,
            filter: `drop-shadow(0 30px 60px rgba(47,107,255,${0.25 + glow * 0.2}))`,
          }}
        />
        <KineticText text="**SmartLife**" at={b(1)} size={150} weight={900} align="center" style={{ marginTop: 26 }} />
        <KineticText text="Mỗi ngày một bước tiến vững chắc." at={b(3)} size={56} weight={700} align="center" stagger={2} />
        <div style={{ width: 520 * line, height: 5, borderRadius: 3, marginTop: 18, background: C.blue, opacity: 0.8 }} />
        <KineticText
          text="Hệ sinh thái quản trị bản thân cho sinh viên"
          at={b(5)}
          size={32}
          weight={600}
          color={C.muted}
          align="center"
          stagger={1}
          style={{ marginTop: 22 }}
        />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "#000", opacity: fade }} />

      <Sfx at={b(0)} name="impact" volume={0.6} />
      <Sfx at={b(1)} name="sparkle" volume={0.45} />
      <Sfx at={b(3)} name="ding" volume={0.35} />
    </AbsoluteFill>
  );
};
