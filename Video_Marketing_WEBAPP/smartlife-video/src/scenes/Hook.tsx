import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Background } from "../components/Background";
import { Sfx } from "../components/Sfx";
import { KineticText } from "../components/Text";
import { useBeats } from "../lib/beat";
import { C, GRAD } from "../theme";

// Each pain point takes the stage for 3 beats, then shrinks into the growing clutter.
const LINES = [
  { icon: "💸", text: "Chi tiêu ghi ở app này.", park: { x: -560, y: -300, r: -7 } },
  { icon: "✅", text: "To-do nằm ở app khác.", park: { x: 520, y: -330, r: 6 } },
  { icon: "📊", text: "Điểm GPA trong file Excel.", park: { x: -540, y: 320, r: 5 } },
  { icon: "📔", text: "Nhật ký trong cuốn sổ tay.", park: { x: 560, y: 300, r: -6 } },
];

export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { b } = useBeats();
  const ease = Easing.bezier(0.7, 0, 0.3, 1);

  const overloadAt = b(12);
  const questionAt = b(16);
  // clutter shakes while "Quá tải." is on, then everything is swept away
  const shake = frame >= overloadAt && frame < questionAt ? Math.sin(frame * 2.3) * 9 : 0;
  const sweep = interpolate(frame, [questionAt - 6, questionAt + 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const glitchOn = (frame >= overloadAt && frame < overloadAt + 7) || (frame >= b(13) && frame < b(13) + 5) || (frame >= b(14.5) && frame < b(14.5) + 4);

  return (
    <AbsoluteFill style={{ background: C.dark }}>
      <Background dark intensity={0.7} />

      {LINES.map((l, i) => {
        const start = b(i * 3);
        const parkAt = b(i * 3 + 3) - 6;
        if (frame < start - 2) return null;
        const pk = ease(interpolate(frame, [parkAt, parkAt + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
        const x = l.park.x * pk + shake * (i % 2 ? 1 : -1);
        const y = l.park.y * pk;
        const s = 1 - 0.55 * pk;
        const o = (1 - 0.6 * pk) * (1 - sweep);
        return (
          <AbsoluteFill key={i} style={{ justifyContent: "center", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 28,
                transform: `translate(${x}px, ${y}px) rotate(${l.park.r * pk}deg) scale(${s * (1 + sweep * 0.6)})`,
                opacity: o,
                filter: `blur(${sweep * 12}px)`,
              }}
            >
              <span style={{ fontSize: 96, opacity: interpolate(frame, [start, start + 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
                {l.icon}
              </span>
              <KineticText text={l.text} at={start} size={92} color="#fff" style={{ whiteSpace: "nowrap" }} />
            </div>
          </AbsoluteFill>
        );
      })}

      {frame >= overloadAt && frame < questionAt + 6 ? (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: 1 - sweep }}>
          {/* RGB-split glitch: three offset copies while the glitch is on */}
          {(glitchOn
            ? [
                { c: "#FF2D55", dx: -10, dy: 3 },
                { c: "#00E5FF", dx: 10, dy: -3 },
                { c: "#fff", dx: 0, dy: 0 },
              ]
            : [{ c: "#fff", dx: 0, dy: 0 }]
          ).map((g, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                fontSize: 230,
                fontWeight: 900,
                letterSpacing: "-0.04em",
                color: g.c,
                mixBlendMode: glitchOn ? "screen" : "normal",
                transform: `translate(${g.dx + shake}px, ${g.dy}px) scale(${interpolate(frame, [overloadAt, overloadAt + 5], [1.5, 1], {
                  extrapolateRight: "clamp",
                })})`,
                clipPath: glitchOn && i === 2 ? `inset(${(frame * 37) % 60}% 0 ${(frame * 23) % 30}% 0)` : undefined,
              }}
            >
              Quá tải.
            </div>
          ))}
        </AbsoluteFill>
      ) : null}

      {frame >= questionAt - 2 ? (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 34 }}>
          <KineticText text="Nếu tất cả ở cùng" at={questionAt} size={104} color="#fff" align="center" stagger={3} />
          <KineticText text="**một nơi?**" at={questionAt + 10} size={150} align="center" weight={900} />
          <div
            style={{
              width: interpolate(frame, [questionAt + 14, questionAt + 34], [0, 520], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              height: 6,
              borderRadius: 3,
              backgroundImage: GRAD,
            }}
          />
        </AbsoluteFill>
      ) : null}

      {LINES.map((_, i) => (
        <Sfx key={i} at={b(i * 3) - 2} name="whip" volume={0.4} />
      ))}
      <Sfx at={overloadAt} name="glitch" volume={0.55} />
      <Sfx at={overloadAt} name="impact" volume={0.35} />
      <Sfx at={b(13)} name="glitch" volume={0.45} />
      <Sfx at={b(14.5)} name="glitch" volume={0.35} />
      <Sfx at={questionAt - 8} name="whoosh" volume={0.5} />
      <Sfx at={questionAt + 10} name="sparkle" volume={0.35} />
    </AbsoluteFill>
  );
};
