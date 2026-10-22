import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Highlight } from "../components/Overlays";
import { SHOTS, ScreenScene } from "../components/ScreenScene";
import { Sfx } from "../components/Sfx";
import { Caption, gradientText, useCount } from "../components/Text";
import { useBeats } from "../lib/beat";
import { C } from "../theme";

const BigGPA: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - at, fps, config: { damping: 14, stiffness: 140 } });
  const gpa = useCount(0, 3.34, at, 30);
  const grade = frame >= at + 30 ? spring({ frame: frame - at - 30, fps, config: { damping: 9, stiffness: 200 } }) : 0;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 20, opacity: p, transform: `scale(${0.8 + 0.2 * p})`, transformOrigin: "right bottom" }}>
      <div style={{ fontSize: 150, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums", ...gradientText }}>
        {gpa.toFixed(2)}
      </div>
      <div style={{ paddingBottom: 18, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 30, fontWeight: 700, color: C.muted }}>/ 4.0</div>
        <div
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: "#fff",
            background: C.blue,
            borderRadius: 999,
            padding: "6px 18px",
            transform: `scale(${grade})`,
          }}
        >
          Giỏi
        </div>
      </div>
    </div>
  );
};

export const GPA: React.FC = () => {
  const { b } = useBeats();
  return (
    <ScreenScene
      shot={SHOTS.gpa}
      textSide="right"
      caption={
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 30 }}>
          <Caption
            at={b(0)}
            kicker="Học tập"
            title="GPA Tracker **chuẩn quy chế ĐHQGHN**"
            sub="Tự quy đổi thang 10 → điểm chữ → hệ 4. Biết ngay kỳ tới cần bao nhiêu điểm."
            width={600}
            size={60}
            align="right"
          />
          <BigGPA at={b(3)} />
        </div>
      }
      keys={[
        { f: 0, x: 0.5, y: 0.5, z: 1 },
        { f: b(1), x: 0.5, y: 0.5, z: 1 },
        { f: b(2), x: 0.16, y: 0.24, z: 2.4 },
        { f: b(7), x: 0.17, y: 0.25, z: 2.4 },
        { f: b(8), x: 0.6, y: 0.6, z: 1.5 },
        { f: b(13), x: 0.62, y: 0.6, z: 1.55 },
        { f: b(14), x: 0.86, y: 0.6, z: 2.2 },
        { f: b(18), x: 0.86, y: 0.62, z: 2.2 },
        { f: b(19), x: 0.62, y: 0.92, z: 1.7 },
        { f: b(23), x: 0.62, y: 0.92, z: 1.7 },
        { f: b(25), x: 0.5, y: 0.5, z: 1 },
      ]}
      overlays={
        <>
          <Highlight x0={0.866} y0={0.47} x1={0.912} y1={0.82} at={b(14) + 4} until={b(18.5)} color={C.blue} radius={14} />
          <Highlight x0={0.72} y0={0.9} x1={0.97} y1={0.97} at={b(19) + 4} until={b(23.5)} color={C.green} radius={14} />
        </>
      }
      extra={
        <>
          {Array.from({ length: 10 }, (_, i) => (
            <Sfx key={i} at={b(3) + i * 3} name="tick" volume={0.25} />
          ))}
          <Sfx at={b(3) + 30} name="ding" volume={0.45} />
          {[2, 8, 14, 19].map((k) => (
            <Sfx key={k} at={b(k) - 6} name="whoosh" volume={0.3} />
          ))}
        </>
      }
    />
  );
};
