import React from "react";
import { AbsoluteFill, Easing, interpolate } from "remotion";
import { linearTiming, TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { TransitionKind } from "../timeline";

type NoProps = Record<string, never>;

/** Old scene punches forward and blurs out while the new one zooms in from behind: a whip-zoom. */
const ZoomBlur: React.FC<TransitionPresentationComponentProps<NoProps>> = ({ children, presentationDirection, presentationProgress: p }) => {
  const entering = presentationDirection === "entering";
  const scale = entering ? interpolate(p, [0, 1], [0.85, 1]) : interpolate(p, [0, 1], [1, 1.45]);
  const blur = entering ? (1 - p) * 22 : p * 22;
  // the old scene stays opaque underneath so the shrunken new scene never exposes the black root
  const opacity = entering ? interpolate(p, [0, 0.45], [0, 1], { extrapolateRight: "clamp" }) : 1;
  return <AbsoluteFill style={{ transform: `scale(${scale})`, filter: `blur(${blur}px)`, opacity }}>{children}</AbsoluteFill>;
};

/** White flash: old scene blows out to white, new scene resolves out of it. */
const Flash: React.FC<TransitionPresentationComponentProps<NoProps>> = ({ children, presentationDirection, presentationProgress: p }) => {
  const entering = presentationDirection === "entering";
  const white = entering ? interpolate(p, [0.5, 1], [1, 0], { extrapolateLeft: "clamp" }) : interpolate(p, [0, 0.5], [0, 1], { extrapolateRight: "clamp" });
  const visible = entering ? p >= 0.5 : p < 0.5;
  return (
    <AbsoluteFill style={{ opacity: visible ? 1 : 0 }}>
      <AbsoluteFill style={{ transform: `scale(${entering ? 1.08 - 0.08 * p : 1 + 0.08 * p})` }}>{children}</AbsoluteFill>
      <AbsoluteFill style={{ background: "#fff", opacity: white }} />
    </AbsoluteFill>
  );
};

const zoomBlur = (): TransitionPresentation<NoProps> => ({ component: ZoomBlur, props: {} });
const flash = (): TransitionPresentation<NoProps> => ({ component: Flash, props: {} });

export const presentationFor = (kind: TransitionKind): TransitionPresentation<any> => {
  switch (kind) {
    case "zoomBlur":
      return zoomBlur();
    case "flash":
      return flash();
    case "slideUp":
      return slide({ direction: "from-bottom" });
    case "slideLeft":
      return slide({ direction: "from-right" });
    case "wipeRight":
      return wipe({ direction: "from-left" });
    case "wipeLeft":
      return wipe({ direction: "from-right" });
    default:
      return zoomBlur();
  }
};

export const timingFor = (frames: number) => linearTiming({ durationInFrames: frames, easing: Easing.bezier(0.7, 0, 0.3, 1) });
