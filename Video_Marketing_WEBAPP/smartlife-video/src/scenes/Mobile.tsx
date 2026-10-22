import React from "react";
import { AbsoluteFill, OffthreadVideo, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Background } from "../components/Background";
import { PhoneFrame } from "../components/PhoneFrame";
import { Sfx } from "../components/Sfx";
import { Caption } from "../components/Text";
import { useBeatPunch, useBeats } from "../lib/beat";
import { C, GRAD } from "../theme";

// The demo recording shows a profile page with personal data after ~40 s, so only play up to SAFE_END.
const SAFE_END = 39;

// What the demo recording shows from each second onward.
const SEGMENTS = [
  { t: 0, icon: "📊", label: "Tổng quan trong một chạm" },
  { t: 6, icon: "📈", label: "Xu hướng thu–chi theo tháng" },
  { t: 11, icon: "➕", label: "Thêm giao dịch siêu nhanh" },
  { t: 17, icon: "🗓️", label: "Lịch chi tiêu theo ngày" },
  { t: 22, icon: "🧾", label: "Lịch sử giao dịch rõ ràng" },
  { t: 28, icon: "🏷️", label: "Danh mục tuỳ chỉnh" },
  { t: 34, icon: "📋", label: "Kanban công việc" },
];

const PHONE_H = 940;

export const Mobile: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { b, duration } = useBeats();
  const punch = useBeatPunch(0.01);
  const rate = Math.min(2, Math.max(1, SAFE_END / (duration / fps)));
  const at = (videoSec: number) => Math.round((videoSec / rate) * fps);
  const videoNow = (frame / fps) * rate;
  const active = SEGMENTS.reduce((acc, s, i) => (videoNow >= s.t ? i : acc), 0);

  const enter = spring({ frame, fps, config: { damping: 17, stiffness: 90 } });
  const floatY = Math.sin(frame / 34) * 10;
  const tilt = Math.sin(frame / 60) * 2.5;

  return (
    <AbsoluteFill>
      <Background />

      {/* glow behind the phone */}
      <div
        style={{
          position: "absolute",
          left: 1380 - 380,
          top: 540 - 380,
          width: 760,
          height: 760,
          borderRadius: "50%",
          backgroundImage: GRAD,
          opacity: 0.22 * enter,
          filter: "blur(90px)",
        }}
      />

      <div
        style={{
          position: "absolute",
          left: 1380,
          top: 540,
          transform: `translate(-50%, -50%) translateY(${(1 - enter) * 900 + floatY}px) rotate(${tilt}deg) scale(${punch})`,
        }}
      >
        <PhoneFrame height={PHONE_H}>
          <OffthreadVideo src={staticFile("demo-phone.mp4")} muted playbackRate={rate} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </PhoneFrame>
      </div>

      <div style={{ position: "absolute", left: 110, top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 34 }}>
        <Caption
          at={b(0)}
          kicker="Mobile"
          title="Mọi lúc, mọi nơi — **ngay trên điện thoại**"
          width={720}
          size={60}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {SEGMENTS.map((s, i) => {
            const start = Math.max(b(1), at(s.t));
            const p = spring({ frame: frame - start, fps, config: { damping: 15, stiffness: 170 } });
            const isActive = i === active && frame >= start;
            const glow = interpolate(frame, [start, start + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return (
              <div
                key={s.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  width: 560,
                  padding: "12px 20px",
                  borderRadius: 18,
                  background: isActive ? "#fff" : "transparent",
                  boxShadow: isActive ? `0 16px 34px -18px rgba(16,24,48,0.4), inset 4px 0 0 ${C.blue}` : "none",
                  opacity: Math.min(1, p * 1.5) * (isActive ? 1 : 0.5 + 0.1 * glow),
                  transform: `translateX(${(1 - p) * -50}px) scale(${isActive ? 1.03 : 1})`,
                  transformOrigin: "left center",
                }}
              >
                <div style={{ fontSize: 30 }}>{s.icon}</div>
                <div style={{ fontSize: 28, fontWeight: isActive ? 800 : 600, color: C.ink }}>{s.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      <Sfx at={0} name="whoosh" volume={0.35} />
      {SEGMENTS.map((s, i) => (
        <Sfx key={i} at={Math.max(b(1), at(s.t))} name="pop" volume={0.35} />
      ))}
    </AbsoluteFill>
  );
};
