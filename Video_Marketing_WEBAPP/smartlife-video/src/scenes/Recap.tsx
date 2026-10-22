import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Background } from "../components/Background";
import { SHOTS } from "../components/ScreenScene";
import { Sfx } from "../components/Sfx";
import { KineticText } from "../components/Text";
import { useBeatPunch, useBeats } from "../lib/beat";
import { C } from "../theme";

const TILES = [
  { shot: SHOTS.dashboard, label: "Tổng quan" },
  { shot: SHOTS.todo, label: "Công việc" },
  { shot: SHOTS.calendar, label: "Lịch trình" },
  { shot: SHOTS.finance, label: "Tài chính" },
  { shot: SHOTS.gpa, label: "GPA" },
  { shot: SHOTS.ai, label: "AI Advisor" },
  { shot: SHOTS.goals, label: "Sự nghiệp" },
  { shot: SHOTS.journal, label: "Nhật ký" },
  { shot: SHOTS.storage, label: "My Storage" },
];
const TW = 520;
const TH = 292;
const GAP = 30;

export const Recap: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { b } = useBeats();
  const punch = useBeatPunch(0.015);
  const back = spring({ frame: frame - b(8), fps, config: { damping: 20, stiffness: 90 } });

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          transform: `scale(${(1 - 0.12 * back) * punch})`,
          filter: `blur(${back * 7}px)`,
          opacity: 1 - 0.6 * back,
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: `repeat(3, ${TW}px)`, gap: GAP }}>
          {TILES.map((t, i) => {
            const at = b(i * 0.5);
            const p = spring({ frame: frame - at, fps, config: { damping: 13, stiffness: 170 } });
            const flash = interpolate(frame, [at, at + 6], [0.6, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return (
              <div
                key={t.label}
                style={{
                  position: "relative",
                  width: TW,
                  height: TH,
                  borderRadius: 20,
                  overflow: "hidden",
                  background: "#fff",
                  boxShadow: "0 20px 40px -18px rgba(16,24,48,0.4)",
                  border: "1px solid rgba(14,21,37,0.08)",
                  opacity: Math.min(1, p * 1.5),
                  transform: `scale(${0.6 + 0.4 * p}) rotate(${(1 - p) * (i % 2 ? 6 : -6)}deg)`,
                }}
              >
                <Img
                  src={staticFile(t.shot.src)}
                  style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "left top" }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: 14,
                    bottom: 14,
                    padding: "8px 16px",
                    borderRadius: 999,
                    background: "rgba(14,21,37,0.82)",
                    color: "#fff",
                    fontSize: 20,
                    fontWeight: 700,
                  }}
                >
                  {t.label}
                </div>
                <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: flash }} />
              </div>
            );
          })}
        </div>
      </AbsoluteFill>

      {frame >= b(8) - 2 ? (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 24 }}>
          <KineticText text="9 tính năng. **1 ứng dụng.**" at={b(8)} size={140} weight={900} align="center" stagger={3} />
          <KineticText
            text="Học tập · Tài chính · Thời gian · Sức khoẻ tinh thần"
            at={b(11)}
            size={38}
            weight={600}
            color={C.muted}
            align="center"
            stagger={2}
          />
        </AbsoluteFill>
      ) : null}

      {TILES.map((_, i) => (
        <Sfx key={i} at={b(i * 0.5)} name="click" volume={0.4} />
      ))}
      <Sfx at={b(8)} name="impact" volume={0.55} />
      <Sfx at={b(11)} name="sparkle" volume={0.35} />
    </AbsoluteFill>
  );
};
