import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Background } from "../components/Background";
import { Sfx } from "../components/Sfx";
import { Chip, KineticText } from "../components/Text";
import { useBeats } from "../lib/beat";
import { C } from "../theme";

const L = 360; // logo size
const QUADS = [
  { qx: 0, qy: 0, fx: -900, fy: -600, r: -50 },
  { qx: 1, qy: 0, fx: 900, fy: -600, r: 45 },
  { qx: 0, qy: 1, fx: -900, fy: 600, r: 40 },
  { qx: 1, qy: 1, fx: 900, fy: 600, r: -45 },
];

export const LogoReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { b } = useBeats();
  const hit = b(4);

  const fly = Easing.in(Easing.cubic)(interpolate(frame, [b(0.5), hit], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const after = frame >= hit;
  const punch = spring({ frame: frame - hit, fps, config: { damping: 9, stiffness: 160 } });
  const lift = spring({ frame: frame - b(5), fps, config: { damping: 18, stiffness: 100 } });
  const flash = interpolate(frame, [hit, hit + 14], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const glow = 0.5 + 0.5 * Math.sin(frame / 10);

  return (
    <AbsoluteFill style={{ background: C.dark }}>
      {after ? <Background /> : <Background dark intensity={0.5} />}

      {/* shockwave */}
      {after && frame < hit + 30 ? (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <div
            style={{
              width: 300,
              height: 300,
              borderRadius: "50%",
              border: `${10 * (1 - (frame - hit) / 30)}px solid ${C.blue}`,
              transform: `scale(${1 + ((frame - hit) / 30) * 6})`,
              opacity: 1 - (frame - hit) / 30,
            }}
          />
        </AbsoluteFill>
      ) : null}

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            position: "relative",
            width: L,
            height: L,
            transform: `translateY(${-150 * lift}px) scale(${after ? 0.8 + 0.2 * punch - 0.18 * lift : 1})`,
            filter: after ? `drop-shadow(0 30px 60px rgba(47,107,255,${0.25 + glow * 0.15}))` : undefined,
          }}
        >
          {QUADS.map((q, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: (q.qx * L) / 2,
                top: (q.qy * L) / 2,
                width: L / 2,
                height: L / 2,
                backgroundImage: `url(${staticFile("logo-mark.jpg")})`,
                // round only the quadrant's outer corner so the assembled mark has rounded corners
                [`border${q.qy ? "Bottom" : "Top"}${q.qx ? "Right" : "Left"}Radius`]: L * 0.15,
                backgroundSize: `${L}px ${L}px`,
                backgroundPosition: `${(-q.qx * L) / 2}px ${(-q.qy * L) / 2}px`,
                opacity: frame < b(0.5) ? 0 : 1,
                transform: `translate(${q.fx * (1 - fly)}px, ${q.fy * (1 - fly)}px) rotate(${q.r * (1 - fly)}deg)`,
              }}
            />
          ))}
        </div>
      </AbsoluteFill>

      {frame >= b(5) - 2 ? (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", paddingTop: 300 }}>
          <KineticText text="**SmartLife**" at={b(5)} size={150} weight={900} align="center" />
          <KineticText
            text="Hệ sinh thái quản trị bản thân cho sinh viên"
            at={b(7)}
            size={40}
            weight={600}
            color={C.muted}
            align="center"
            stagger={1}
            style={{ marginTop: 6 }}
          />
          <div style={{ display: "flex", gap: 18, marginTop: 40 }}>
            <Chip at={b(9)} icon="📚" label="Học tập" color={C.blue} />
            <Chip at={b(10)} icon="💰" label="Tài chính" color={C.green} />
            <Chip at={b(11)} icon="⏰" label="Thời gian" color={C.purple} />
            <Chip at={b(12)} icon="💚" label="Sức khoẻ tinh thần" color={C.teal} />
          </div>
        </AbsoluteFill>
      ) : null}

      <AbsoluteFill style={{ background: "#fff", opacity: flash, pointerEvents: "none" }} />

      <Sfx at={hit - 66} name="riser" volume={0.5} />
      <Sfx at={hit} name="impact" volume={0.75} />
      <Sfx at={b(5)} name="sparkle" volume={0.45} />
      {[9, 10, 11, 12].map((k) => (
        <Sfx key={k} at={b(k)} name="pop" volume={0.45} />
      ))}
    </AbsoluteFill>
  );
};
