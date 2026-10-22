import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Badge, Highlight } from "../components/Overlays";
import { SHOTS, ScreenScene } from "../components/ScreenScene";
import { Sfx } from "../components/Sfx";
import { Caption, formatVND, useCount } from "../components/Text";
import { useBeats } from "../lib/beat";
import { C } from "../theme";

const Stat: React.FC<{ label: string; value: number; sign?: string; color: string; at: number }> = ({ label, value, sign = "", color, at }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - at, fps, config: { damping: 16, stiffness: 150 } });
  const n = useCount(0, value, at, 26);
  return (
    <div
      style={{
        padding: "16px 24px",
        borderRadius: 20,
        background: "rgba(255,255,255,0.92)",
        border: "1px solid rgba(14,21,37,0.07)",
        boxShadow: "0 16px 34px -18px rgba(16,24,48,0.35)",
        opacity: p,
        transform: `translateX(${(1 - p) * -60}px)`,
        width: 460,
      }}
    >
      <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "0.1em", color: C.muted, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 44, fontWeight: 800, color, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
        {sign}
        {formatVND(n)} đ
      </div>
    </div>
  );
};

export const Finance: React.FC = () => {
  const { b } = useBeats();
  const counts = [2, 3, 4];
  return (
    <ScreenScene
      shot={SHOTS.finance}
      textSide="left"
      caption={
        <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
          <Caption
            at={b(0)}
            kicker="Tài chính"
            title="Biết rõ **tiền đi đâu** mỗi tháng"
            sub="Ngân sách theo danh mục, cảnh báo khi chi vượt mức, biểu đồ thu–chi 6 tháng."
            width={600}
            size={60}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Stat label="Số dư khả dụng" value={3184000} color={C.ink} at={b(counts[0])} />
            <Stat label="Thu nhập T10" value={5480000} sign="+" color="#16A34A" at={b(counts[1])} />
            <Stat label="Chi tiêu T10" value={2865000} sign="−" color={C.red} at={b(counts[2])} />
          </div>
        </div>
      }
      keys={[
        { f: 0, x: 0.5, y: 0.5, z: 1 },
        { f: b(1), x: 0.5, y: 0.5, z: 1 },
        { f: b(2), x: 0.42, y: 0.16, z: 1.35 },
        { f: b(7), x: 0.44, y: 0.18, z: 1.4 },
        { f: b(8), x: 0.47, y: 0.47, z: 1.35 },
        { f: b(15), x: 0.48, y: 0.48, z: 1.38 },
        { f: b(16), x: 0.36, y: 0.84, z: 1.7 },
        { f: b(21), x: 0.38, y: 0.84, z: 1.7 },
        { f: b(22), x: 0.83, y: 0.8, z: 2.0 },
        { f: b(27), x: 0.83, y: 0.8, z: 2.0 },
        { f: b(29), x: 0.5, y: 0.5, z: 1 },
      ]}
      overlays={
        <>
          <Highlight x0={0.09} y0={0.315} x1={0.52} y1={0.45} at={b(10)} until={b(15.5)} color={C.red} radius={20} />
          <Badge x={0.43} y={0.335} at={b(10.5)} until={b(15.5)} text="⚠ Vượt ngân sách" color={C.red} size={20} />
          <Highlight x0={0.53} y0={0.465} x1={0.96} y1={0.6} at={b(12)} until={b(15.5)} color={C.green} radius={20} />
          <Badge x={0.88} y={0.485} at={b(12.5)} until={b(15.5)} text="✓ Trong hạn mức" color="#16A34A" size={20} />
        </>
      }
      extra={
        <>
          {counts.map((k) =>
            Array.from({ length: 8 }, (_, i) => <Sfx key={`${k}-${i}`} at={b(k) + i * 3} name="tick" volume={0.25} />),
          )}
          <Sfx at={b(2) + 26} name="ding" volume={0.4} />
          <Sfx at={b(10.5)} name="glitch" volume={0.25} />
          <Sfx at={b(12.5)} name="pop" volume={0.45} />
          {[8, 16, 22].map((k) => (
            <Sfx key={k} at={b(k) - 6} name="whoosh" volume={0.3} />
          ))}
        </>
      }
    />
  );
};
