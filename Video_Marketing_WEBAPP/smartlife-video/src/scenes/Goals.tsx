import React from "react";
import { Badge, Highlight, Ring, Spotlight } from "../components/Overlays";
import { SHOTS, ScreenScene } from "../components/ScreenScene";
import { Sfx } from "../components/Sfx";
import { Caption } from "../components/Text";
import { useBeats } from "../lib/beat";
import { C } from "../theme";

export const Goals: React.FC = () => {
  const { b } = useBeats();
  return (
    <ScreenScene
      shot={SHOTS.goals}
      textSide="right"
      caption={
        <Caption
          at={b(0)}
          kicker="Sự nghiệp"
          title={"Lộ trình nghề nghiệp\n**do AI vạch ra**"}
          sub="Chọn nghề mục tiêu — AI đề xuất kỹ năng, chứng chỉ, tài liệu và theo dõi tiến độ giúp bạn."
          width={660}
          size={58}
          align="right"
        />
      }
      keys={[
        { f: 0, x: 0.5, y: 0.5, z: 1 },
        { f: b(1), x: 0.5, y: 0.5, z: 1 },
        { f: b(2), x: 0.8, y: 0.08, z: 2.6 },
        { f: b(8), x: 0.8, y: 0.09, z: 2.5 },
        { f: b(9), x: 0.5, y: 0.55, z: 1.35 },
        { f: b(13), x: 0.5, y: 0.56, z: 1.4 },
        { f: b(14), x: 0.84, y: 0.18, z: 2.0 },
        { f: b(17), x: 0.84, y: 0.19, z: 2.0 },
        { f: b(19), x: 0.5, y: 0.5, z: 1 },
      ]}
      overlays={
        <>
          <Spotlight x0={0.7425} y0={0.051} x1={0.8725} y1={0.09} at={b(3)} until={b(8.5)} radius={14} />
          <Ring x={0.8075} y={0.07} at={b(4)} color="#fff" size={120} />
          <Ring x={0.8075} y={0.07} at={b(4.5)} color={C.blue} size={120} />
          <Highlight x0={0.077} y0={0.343} x1={0.367} y1={0.742} at={b(10)} until={b(13.5)} color={C.blue} radius={22} />
          <Highlight x0={0.38} y0={0.343} x1={0.671} y1={0.742} at={b(10.5)} until={b(13.5)} color={C.purple} radius={22} />
          <Highlight x0={0.684} y0={0.343} x1={0.974} y1={0.742} at={b(11)} until={b(13.5)} color={C.teal} radius={22} />
          <Highlight x0={0.712} y0={0.155} x1={0.965} y1={0.205} at={b(14) + 4} until={b(18)} color={C.green} radius={12} />
          <Badge x={0.84} y={0.245} at={b(15)} until={b(18)} text="📈 Theo dõi từng kỹ năng" color={C.green} size={18} />
        </>
      }
      extra={
        <>
          {[2, 9, 14].map((k) => (
            <Sfx key={k} at={b(k) - 6} name="whoosh" volume={0.3} />
          ))}
          <Sfx at={b(4)} name="click" volume={0.6} />
          <Sfx at={b(4.5)} name="sparkle" volume={0.4} />
          {[10, 10.5, 11].map((k) => (
            <Sfx key={k} at={b(k)} name="pop" volume={0.35} />
          ))}
          <Sfx at={b(15)} name="ding" volume={0.3} />
        </>
      }
    />
  );
};
