import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Background } from "../components/Background";
import { KenBurns } from "../components/KenBurns";
import { Badge, Highlight, Ring } from "../components/Overlays";
import { SHOTS } from "../components/ScreenScene";
import { Sfx } from "../components/Sfx";
import { Caption, Chip } from "../components/Text";
import { useBeatPunch, useBeats } from "../lib/beat";
import { C, SHADOW } from "../theme";

const W = 1000;
const H = Math.round(W / (SHOTS.storage.w / SHOTS.storage.h));
// crop away the blurred page around the modal
const FULL = { x: 0.516, y: 0.494, z: 1.085 };
const TABS = [
  { x: 228, label: "Ghi chú", icon: "📝", color: C.orange },
  { x: 450, label: "Liên kết", icon: "🔗", color: C.blue },
  { x: 646, label: "Tệp tin", icon: "📄", color: C.teal },
  { x: 849, label: "Hình ảnh", icon: "🖼️", color: C.purple },
  { x: 1069, label: "Âm thanh", icon: "🎵", color: C.green },
  { x: 1271, label: "Video", icon: "🎬", color: C.red },
];

export const Storage: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { b } = useBeats();
  const punch = useBeatPunch(0.008);
  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 100 } });
  const floatY = Math.sin(frame / 38) * 7;

  return (
    <AbsoluteFill>
      <Background />
      <div style={{ position: "absolute", left: 110, top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 36 }}>
        <Caption
          at={b(0)}
          kicker="My Storage"
          title="Một kho riêng cho **mọi tài liệu**"
          sub="Ghi chú, liên kết, tệp, ảnh, âm thanh, video — lưu riêng tư, tìm lại trong một giây."
          width={600}
          size={60}
        />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, width: 600 }}>
          {TABS.map((t, i) => (
            <Chip key={t.label} at={b(3 + i)} icon={t.icon} label={t.label} color={t.color} size={22} />
          ))}
        </div>
      </div>

      <AbsoluteFill style={{ perspective: 2200 }}>
        <div
          style={{
            position: "absolute",
            left: 790,
            top: (1080 - H) / 2,
            width: W,
            height: H,
            borderRadius: 44,
            overflow: "hidden",
            boxShadow: SHADOW,
            opacity: Math.min(1, enter * 1.6),
            transform: `translateY(${(1 - enter) * 300 + floatY}px) rotateX(${(1 - enter) * 30}deg) scale(${(0.85 + 0.15 * enter) * punch})`,
          }}
        >
          <KenBurns
            src={SHOTS.storage.src}
            imgW={SHOTS.storage.w}
            imgH={SHOTS.storage.h}
            width={W}
            height={H}
            keys={[
              { f: 0, ...FULL },
              { f: b(2), ...FULL },
              { f: b(3), x: 0.3, y: 0.28, z: 2.0 },
              { f: b(8), x: 0.7, y: 0.28, z: 2.0 },
              { f: b(10), ...FULL },
            ]}
          >
            {TABS.map((t, i) => (
              <Ring key={t.label} x={t.x / SHOTS.storage.w} y={0.18} at={b(3 + i)} color={t.color} size={150} />
            ))}
            <Highlight x0={0.074} y0={0.33} x1={0.504} y1={0.728} at={b(10.5)} until={b(14.5)} color={C.orange} radius={26} />
            <Badge x={0.29} y={0.33} at={b(11)} until={b(14.5)} text="📌 Ghim ghi chú quan trọng" color={C.orange} size={22} />
            <Badge x={0.18} y={0.12} at={b(12)} until={b(14.5)} text="🔒 Riêng tư & Bảo mật" color={C.ink} size={22} />
          </KenBurns>
        </div>
      </AbsoluteFill>

      {TABS.map((_, i) => (
        <Sfx key={i} at={b(3 + i)} name="pop" volume={0.4} />
      ))}
      <Sfx at={b(3) - 6} name="whoosh" volume={0.3} />
      <Sfx at={b(11)} name="click" volume={0.5} />
      <Sfx at={b(12)} name="ding" volume={0.3} />
    </AbsoluteFill>
  );
};
