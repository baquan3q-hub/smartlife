import React from "react";
import { Highlight, Ring } from "../components/Overlays";
import { SHOTS, ScreenScene } from "../components/ScreenScene";
import { Sfx } from "../components/Sfx";
import { CaptionSwap } from "../components/Text";
import { useBeats } from "../lib/beat";
import { C } from "../theme";

export const Todo: React.FC = () => {
  const { b, duration } = useBeats();
  const caps = [
    { at: b(0), kicker: "Công việc", title: "Kanban rõ ràng, **từng việc một**", sub: "Backlog → Todo → Doing → Done. Kéo–thả, gắn hạn chót và checklist." },
    { at: b(10), kicker: "Tập trung", title: "Pomodoro **+ nhạc Lofi**", sub: "Chế độ cổ điển hoặc chuyên sâu, nằm ngay cạnh danh sách việc cần làm." },
    { at: b(19), kicker: "Thói quen", title: "Xây thói quen **mỗi ngày**", sub: "Học từ vựng, tập thể dục, uống đủ nước… và giữ chuỗi streak 🔥" },
    { at: b(26), kicker: "Ghi chú", title: "Ghi chú & bookmark **trong tầm tay**", sub: "Ý tưởng chợt đến? Ghi lại ngay, không cần mở app khác." },
  ];
  return (
    <ScreenScene
      shot={SHOTS.todo}
      textSide="left"
      caption={<CaptionSwap items={caps} width={600} size={60} end={duration + 20} />}
      keys={[
        { f: 0, x: 0.5, y: 0.5, z: 1 },
        { f: b(1), x: 0.5, y: 0.5, z: 1 },
        { f: b(2), x: 0.36, y: 0.34, z: 1.55 },
        { f: b(9), x: 0.44, y: 0.36, z: 1.6 },
        { f: b(10), x: 0.865, y: 0.25, z: 2.5 },
        { f: b(18), x: 0.86, y: 0.27, z: 2.4 },
        { f: b(19), x: 0.56, y: 0.86, z: 2.0 },
        { f: b(25), x: 0.6, y: 0.86, z: 2.0 },
        { f: b(26), x: 0.865, y: 0.74, z: 2.2 },
        { f: b(31), x: 0.86, y: 0.72, z: 2.1 },
      ]}
      overlays={
        <>
          <Highlight x0={0.565} y0={0.13} x1={0.715} y1={0.62} at={b(4)} until={b(9)} color={C.green} />
          <Ring x={0.831} y={0.386} at={b(12)} color={C.blue} size={160} />
          <Ring x={0.831} y={0.386} at={b(14)} color={C.blue} size={160} />
          <Ring x={0.831} y={0.386} at={b(16)} color={C.blue} size={160} />
          <Highlight x0={0.41} y0={0.75} x1={0.72} y1={0.82} at={b(21)} until={b(25)} color={C.orange} />
        </>
      }
      extra={
        <>
          <Sfx at={b(4)} name="pop" volume={0.4} />
          {[10, 19, 26].map((k) => (
            <Sfx key={k} at={b(k) - 6} name="whoosh" volume={0.35} />
          ))}
          {[12, 14, 16].map((k) => (
            <Sfx key={k} at={b(k)} name="click" volume={0.5} />
          ))}
          <Sfx at={b(21)} name="ding" volume={0.3} />
        </>
      }
    />
  );
};
