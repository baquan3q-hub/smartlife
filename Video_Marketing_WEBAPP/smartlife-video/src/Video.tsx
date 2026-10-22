import React from "react";
import { AbsoluteFill, Audio, interpolate, staticFile } from "remotion";
import { TransitionSeries } from "@remotion/transitions";
import { Sfx } from "./components/Sfx";
import { SceneProvider } from "./lib/beat";
import { presentationFor, timingFor } from "./lib/transitions";
import { AIAdvisor } from "./scenes/AIAdvisor";
import { Calendar } from "./scenes/Calendar";
import { CTA } from "./scenes/CTA";
import { Dashboard } from "./scenes/Dashboard";
import { Finance } from "./scenes/Finance";
import { GPA } from "./scenes/GPA";
import { Goals } from "./scenes/Goals";
import { Hook } from "./scenes/Hook";
import { Journal } from "./scenes/Journal";
import { LogoReveal } from "./scenes/LogoReveal";
import { Mobile } from "./scenes/Mobile";
import { Recap } from "./scenes/Recap";
import { Storage } from "./scenes/Storage";
import { Todo } from "./scenes/Todo";
import { FPS, MUSIC, MUSIC_SECONDS, SceneId, TIMELINE, TOTAL_FRAMES } from "./timeline";
import { fontFamily } from "./theme";

const SCENES: Record<SceneId, React.FC> = {
  hook: Hook,
  logo: LogoReveal,
  dashboard: Dashboard,
  todo: Todo,
  calendar: Calendar,
  finance: Finance,
  gpa: GPA,
  ai: AIAdvisor,
  goals: Goals,
  journal: Journal,
  storage: Storage,
  mobile: Mobile,
  recap: Recap,
  cta: CTA,
};

// whoosh sound per transition, timed so its peak lands on the downbeat where the new scene settles
const TRANSITION_SFX = { zoomBlur: "whip", flash: "whoosh", slideUp: "whoosh", slideLeft: "whoosh", wipeRight: "whoosh", wipeLeft: "whoosh", none: null } as const;

export const SmartLifeLaunch: React.FC = () => {
  const musicVolume = (f: number) =>
    0.8 *
    interpolate(f, [0, FPS], [0, 1], { extrapolateRight: "clamp" }) *
    interpolate(f, [TOTAL_FRAMES - 3 * FPS, TOTAL_FRAMES], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ fontFamily, background: "#000" }}>
      <TransitionSeries>
        {TIMELINE.flatMap((s) => {
          const Scene = SCENES[s.id];
          const items = [
            <TransitionSeries.Sequence key={s.id} durationInFrames={s.duration} name={s.id}>
              <SceneProvider lead={s.lead} duration={s.duration}>
                <Scene />
              </SceneProvider>
            </TransitionSeries.Sequence>,
          ];
          if (s.out !== "none") {
            items.push(<TransitionSeries.Transition key={`${s.id}-t`} presentation={presentationFor(s.out)} timing={timingFor(s.outFrames)} />);
          }
          return items;
        })}
      </TransitionSeries>

      <Audio src={staticFile(MUSIC)} volume={musicVolume} loop={MUSIC_SECONDS * FPS < TOTAL_FRAMES} />

      {TIMELINE.map((s) => {
        const name = TRANSITION_SFX[s.out];
        if (!name) return null;
        const peak = name === "whip" ? 8 : 14; // frames from sound start to its loudest point
        return <Sfx key={s.id} at={s.boundary - peak} name={name} volume={0.5} />;
      })}
    </AbsoluteFill>
  );
};
