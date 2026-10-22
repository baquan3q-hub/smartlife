import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Highlight, Ring } from "../components/Overlays";
import { SHOTS, ScreenScene } from "../components/ScreenScene";
import { Sfx } from "../components/Sfx";
import { CaptionSwap, typed } from "../components/Text";
import { useBeats } from "../lib/beat";
import { C, GRAD } from "../theme";

const PROMPT = "Hôm nay ăn sáng 30k, uống cafe 25k, đổ xăng 50k";
const ITEMS = [
  { icon: "🍳", name: "Ăn sáng", cat: "Ăn uống", amount: "−30.000đ" },
  { icon: "☕", name: "Cafe", cat: "Ăn uống", amount: "−25.000đ" },
  { icon: "⛽", name: "Đổ xăng", cat: "Di chuyển", amount: "−50.000đ" },
];

/** Dims the screenshot while the chat card is up. */
const Scrim: React.FC<{ at: number; until: number }> = ({ at, until }) => {
  const frame = useCurrentFrame();
  const v = Math.min(
    interpolate(frame, [at, at + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    interpolate(frame, [until - 10, until], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  );
  return <div style={{ position: "absolute", inset: 0, background: `rgba(10,16,32,${0.42 * v})` }} />;
};

const ChatCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { b } = useBeats();
  const open = spring({ frame: frame - b(13), fps, config: { damping: 18, stiffness: 140 } });
  const close = interpolate(frame, [b(31.5), b(32)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (frame < b(13) - 1 || close >= 1) return null;

  const sent = frame >= b(21);
  const input = sent ? "" : typed(PROMPT, frame, b(14), 16);
  const caretOn = Math.floor(frame / 8) % 2 === 0;
  const bubble = spring({ frame: frame - b(21), fps, config: { damping: 14, stiffness: 170 } });
  const thinking = frame >= b(22) && frame < b(24);
  const reply = spring({ frame: frame - b(22), fps, config: { damping: 16, stiffness: 160 } });
  const total = spring({ frame: frame - b(28), fps, config: { damping: 10, stiffness: 190 } });

  return (
    <div
      style={{
        position: "absolute",
        left: 880,
        top: 150,
        width: 820,
        height: 780,
        borderRadius: 32,
        background: "rgba(255,255,255,0.9)",
        backdropFilter: "blur(18px)",
        border: "1px solid rgba(255,255,255,0.7)",
        boxShadow: "0 50px 100px -30px rgba(8,14,32,0.55)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        opacity: Math.min(1, open * 1.4) * (1 - close),
        transform: `translateY(${(1 - open) * 80 + close * -40}px) scale(${0.9 + 0.1 * open})`,
      }}
    >
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "22px 28px", borderBottom: "1px solid rgba(14,21,37,0.07)" }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, backgroundImage: GRAD, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 26 }}>
          ✦
        </div>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, color: C.ink }}>SmartLife Advisor</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.muted, display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 9, height: 9, borderRadius: 5, background: C.green }} />
            Gemini 2.5 Flash · đang hoạt động
          </div>
        </div>
      </div>

      {/* messages */}
      <div style={{ flex: 1, padding: "26px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
        {sent ? (
          <div
            style={{
              alignSelf: "flex-end",
              maxWidth: 560,
              padding: "16px 22px",
              borderRadius: "22px 22px 6px 22px",
              background: C.blue,
              color: "#fff",
              fontSize: 23,
              fontWeight: 600,
              lineHeight: 1.4,
              opacity: bubble,
              transform: `translateY(${(1 - bubble) * 120}px) scale(${0.8 + 0.2 * bubble})`,
              transformOrigin: "right bottom",
            }}
          >
            {PROMPT}
          </div>
        ) : null}

        {frame >= b(22) ? (
          <div
            style={{
              alignSelf: "flex-start",
              width: 600,
              padding: "18px 22px",
              borderRadius: "22px 22px 22px 6px",
              background: "#F2F5FB",
              border: "1px solid rgba(14,21,37,0.06)",
              opacity: reply,
              transform: `translateY(${(1 - reply) * 30}px)`,
            }}
          >
            {thinking ? (
              <div style={{ display: "flex", gap: 8, padding: "6px 0" }}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      background: C.muted,
                      opacity: 0.35 + 0.65 * Math.max(0, Math.sin((frame - i * 4) / 4)),
                    }}
                  />
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 21, fontWeight: 600, color: C.ink }}>Đã hiểu! Mình ghi lại 3 khoản chi nhé:</div>
                {ITEMS.map((it, i) => {
                  const p = spring({ frame: frame - b(24 + i), fps, config: { damping: 12, stiffness: 190 } });
                  return (
                    <div
                      key={it.name}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        padding: "12px 16px",
                        borderRadius: 16,
                        background: "#fff",
                        boxShadow: "0 6px 18px -10px rgba(16,24,48,0.3)",
                        opacity: Math.min(1, p * 1.5),
                        transform: `translateX(${(1 - p) * -40}px) scale(${0.85 + 0.15 * p})`,
                      }}
                    >
                      <div style={{ fontSize: 30 }}>{it.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 22, fontWeight: 700, color: C.ink }}>{it.name}</div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: C.muted }}>{it.cat}</div>
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: C.red, fontVariantNumeric: "tabular-nums" }}>{it.amount}</div>
                    </div>
                  );
                })}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: 4,
                    opacity: total,
                    transform: `scale(${0.8 + 0.2 * total})`,
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", background: C.green, borderRadius: 999, padding: "6px 16px" }}>
                    ✓ Đã ghi vào Tài chính
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: C.ink }}>Tổng −105.000đ</div>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* input */}
      <div style={{ padding: "18px 24px", borderTop: "1px solid rgba(14,21,37,0.07)", display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            flex: 1,
            height: 62,
            borderRadius: 18,
            border: `2px solid ${frame < b(21) ? C.blue : "rgba(14,21,37,0.1)"}`,
            background: "#fff",
            display: "flex",
            alignItems: "center",
            padding: "0 20px",
            fontSize: 22,
            fontWeight: 500,
            color: input ? C.ink : "#9AA3B5",
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          {input || (sent ? "Nhập đi bạn ơi…" : "")}
          {!sent && caretOn ? <span style={{ width: 2, height: 28, background: C.blue, marginLeft: 2 }} /> : null}
        </div>
        <div
          style={{
            width: 62,
            height: 62,
            borderRadius: 18,
            background: C.blue,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
            transform: `scale(${frame >= b(21) && frame < b(21) + 6 ? 0.85 : 1})`,
          }}
        >
          ➤
        </div>
      </div>
    </div>
  );
};

export const AIAdvisor: React.FC = () => {
  const { b, duration } = useBeats();
  const caps = [
    {
      at: b(0),
      kicker: "AI Advisor",
      title: "Trợ lý AI **hiểu cuộc sống của bạn**",
      sub: "Đọc trực tiếp dữ liệu của bạn — chi tiêu, lịch trình, mục tiêu — để trả lời đúng hoàn cảnh.",
    },
    { at: b(13), kicker: "Ngôn ngữ tự nhiên", title: "Chỉ cần **nói,** AI tự ghi chép", sub: "Giao dịch, lịch học, việc cần làm — gõ như nhắn tin là xong." },
    { at: b(32), kicker: "Phân tích", title: "Phân tích, dự đoán, **tư vấn tiết kiệm**", sub: "Dự đoán chi tiêu tháng tới, so sánh thu–chi, đánh giá ngân sách." },
  ];
  return (
    <ScreenScene
      shot={SHOTS.ai}
      textSide="left"
      caption={<CaptionSwap items={caps} width={600} size={60} end={duration + 20} />}
      keys={[
        { f: 0, x: 0.5, y: 0.5, z: 1 },
        { f: b(1), x: 0.5, y: 0.5, z: 1 },
        { f: b(2), x: 0.55, y: 0.27, z: 1.7 },
        { f: b(6), x: 0.57, y: 0.29, z: 1.7 },
        { f: b(7), x: 0.88, y: 0.2, z: 2.3 },
        { f: b(11), x: 0.88, y: 0.22, z: 2.3 },
        { f: b(13), x: 0.5, y: 0.5, z: 1 },
        { f: b(31), x: 0.52, y: 0.5, z: 1.05 },
        { f: b(32), x: 0.6, y: 0.75, z: 1.6 },
        { f: b(39), x: 0.62, y: 0.76, z: 1.65 },
        { f: b(41), x: 0.5, y: 0.5, z: 1 },
      ]}
      overlays={
        <>
          <Highlight x0={0.385} y0={0.19} x1={0.79} y1={0.345} at={b(3)} until={b(6.5)} color={C.purple} radius={16} />
          <Highlight x0={0.788} y0={0.125} x1={0.972} y1={0.19} at={b(8)} until={b(12)} color={C.blue} radius={16} />
          <Scrim at={b(13)} until={b(32)} />
          <Ring x={0.37} y={0.72} at={b(33)} color={C.purple} size={140} />
          <Ring x={0.629} y={0.72} at={b(34)} color={C.orange} size={140} />
          <Ring x={0.629} y={0.796} at={b(35)} color={C.teal} size={140} />
          <Ring x={0.37} y={0.871} at={b(36)} color={C.red} size={140} />
        </>
      }
      extra={
        <>
          <ChatCard />
          {[2, 7, 13, 32].map((k) => (
            <Sfx key={k} at={b(k) - 6} name="whoosh" volume={0.3} />
          ))}
          <Sfx at={b(8)} name="pop" volume={0.4} />
          {Array.from({ length: 22 }, (_, i) => (
            <Sfx key={`t${i}`} at={b(14) + i * 4} name="tick" volume={0.18} />
          ))}
          <Sfx at={b(21)} name="click" volume={0.6} />
          {[24, 25, 26].map((k) => (
            <Sfx key={k} at={b(k)} name="pop" volume={0.45} />
          ))}
          <Sfx at={b(28)} name="ding" volume={0.45} />
          {[33, 34, 35, 36].map((k) => (
            <Sfx key={k} at={b(k)} name="click" volume={0.4} />
          ))}
        </>
      }
    />
  );
};
