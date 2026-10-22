import React from "react";
import { Badge, Highlight, Ring } from "../components/Overlays";
import { SHOTS, ScreenScene } from "../components/ScreenScene";
import { Sfx } from "../components/Sfx";
import { Caption } from "../components/Text";
import { useBeats } from "../lib/beat";
import { C } from "../theme";

const MOODS = [0.292, 0.377, 0.462, 0.546, 0.631];
const FIT = 0.913; // whole page visible (the journal shot is taller than the viewport aspect)

export const Journal: React.FC = () => {
  const { b } = useBeats();
  return (
    <ScreenScene
      shot={SHOTS.journal}
      textSide="left"
      caption={
        <Caption
          at={b(0)}
          kicker="Sức khoẻ tinh thần"
          title="Nhật ký chữa lành, **riêng tư tuyệt đối**"
          sub="Ghi cảm xúc mỗi ngày, gợi ý chủ đề viết, 3 điều biết ơn. Khoá riêng bằng mã PIN 🔒"
          width={600}
          size={60}
        />
      }
      keys={[
        { f: 0, x: 0.5, y: 0.5, z: FIT },
        { f: b(1), x: 0.5, y: 0.5, z: FIT },
        { f: b(2), x: 0.46, y: 0.3, z: 2.0 },
        { f: b(8), x: 0.46, y: 0.31, z: 2.0 },
        { f: b(9), x: 0.46, y: 0.43, z: 1.6 },
        { f: b(12), x: 0.46, y: 0.44, z: 1.6 },
        { f: b(13), x: 0.81, y: 0.28, z: 1.9 },
        { f: b(17), x: 0.81, y: 0.28, z: 1.9 },
        { f: b(19), x: 0.5, y: 0.5, z: FIT },
      ]}
      overlays={
        <>
          {MOODS.map((x, i) => (
            <Ring key={i} x={x} y={0.3} at={b(3 + i)} color={[C.red, C.orange, C.muted, C.green, C.purple][i]} size={130} />
          ))}
          <Highlight x0={0.594} y0={0.265} x1={0.669} y1={0.357} at={b(7)} until={b(8.5)} color={C.purple} radius={16} />
          <Badge x={0.631} y={0.235} at={b(7.25)} until={b(8.5)} text="Hôm nay: Tuyệt vời!" color={C.purple} size={16} />
          <Highlight x0={0.254} y0={0.38} x1={0.67} y1={0.492} at={b(9) + 4} until={b(12.5)} color={C.green} radius={18} />
          <Highlight x0={0.703} y0={0.127} x1={0.92} y1={0.427} at={b(13) + 4} until={b(17.5)} color={C.red} radius={22} />
        </>
      }
      extra={
        <>
          {MOODS.map((_, i) => (
            <Sfx key={i} at={b(3 + i)} name="pop" volume={0.4} />
          ))}
          <Sfx at={b(7.25)} name="sparkle" volume={0.35} />
          {[2, 9, 13].map((k) => (
            <Sfx key={k} at={b(k) - 6} name="whoosh" volume={0.3} />
          ))}
          <Sfx at={b(13) + 4} name="ding" volume={0.25} />
        </>
      }
    />
  );
};
