import React from "react";
import { Highlight, Ring } from "../components/Overlays";
import { SHOTS, ScreenScene } from "../components/ScreenScene";
import { Sfx } from "../components/Sfx";
import { Caption, Chip } from "../components/Text";
import { useBeats } from "../lib/beat";
import { C } from "../theme";

export const Calendar: React.FC = () => {
  const { b } = useBeats();
  const views = ["Tuần", "Hôm nay", "Tháng", "Danh sách"];
  return (
    <ScreenScene
      shot={SHOTS.calendar}
      textSide="right"
      caption={
        <div style={{ display: "flex", flexDirection: "column", gap: 34 }}>
          <Caption
            at={b(0)}
            kicker="Lịch trình"
            title="Thời khoá biểu **đồng bộ Google Calendar**"
            sub="Lịch học, lịch làm, lịch hẹn ở cùng một chỗ. Không bỏ lỡ buổi nào."
            width={600}
            size={60}
          />
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {views.map((v, i) => (
              <Chip key={v} at={b(4 + i)} label={v} color={C.purple} size={22} />
            ))}
          </div>
        </div>
      }
      keys={[
        { f: 0, x: 0.5, y: 0.5, z: 1 },
        { f: b(2), x: 0.5, y: 0.5, z: 1 },
        { f: b(3), x: 0.24, y: 0.42, z: 1.7 },
        { f: b(8), x: 0.3, y: 0.44, z: 1.7 },
        { f: b(9), x: 0.5, y: 0.42, z: 1.7 },
        { f: b(13), x: 0.54, y: 0.44, z: 1.75 },
        { f: b(14), x: 0.66, y: 0.4, z: 1.9 },
        { f: b(19), x: 0.66, y: 0.42, z: 1.95 },
        { f: b(20), x: 0.86, y: 0.11, z: 2.3 },
        { f: b(24), x: 0.86, y: 0.12, z: 2.3 },
        { f: b(25.5), x: 0.5, y: 0.5, z: 1 },
      ]}
      overlays={
        <>
          <Highlight x0={0.596} y0={0.222} x1={0.718} y1={0.848} at={b(14) + 4} until={b(19.5)} color={C.blue} radius={22} />
          <Highlight x0={0.879} y0={0.067} x1={0.972} y1={0.114} at={b(20) + 4} until={b(25)} color={C.green} radius={18} />
          <Ring x={0.925} y={0.091} at={b(21)} color={C.green} size={150} />
        </>
      }
      extra={
        <>
          {[4, 5, 6, 7].map((k) => (
            <Sfx key={k} at={b(k)} name="pop" volume={0.4} />
          ))}
          {[3, 9, 14, 20].map((k) => (
            <Sfx key={k} at={b(k) - 6} name="whoosh" volume={0.3} />
          ))}
          <Sfx at={b(21)} name="click" volume={0.6} />
          <Sfx at={b(21) + 3} name="ding" volume={0.3} />
        </>
      }
    />
  );
};
