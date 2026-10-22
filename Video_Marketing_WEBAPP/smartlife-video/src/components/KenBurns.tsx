import React from "react";
import { Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";

/** Camera keyframe: (x, y) = point of the image (0–1) to center, z = zoom (1 = image width fills the viewport). */
export type CamKey = { f: number; x: number; y: number; z: number };

const ease = Easing.bezier(0.65, 0, 0.35, 1);

const camAt = (keys: CamKey[], frame: number) => {
  if (frame <= keys[0].f) return keys[0];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (frame <= b.f) {
      const p = ease(interpolate(frame, [a.f, b.f], [0, 1]));
      // interpolate zoom in log space so zooming feels linear
      const z = Math.exp(Math.log(a.z) + (Math.log(b.z) - Math.log(a.z)) * p);
      return { f: frame, x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p, z };
    }
  }
  return keys[keys.length - 1];
};

/**
 * Pans and zooms a screenshot inside a fixed viewport. Children are overlays positioned in
 * image-relative percentages, so they stay pinned to the UI while the camera moves.
 */
export const KenBurns: React.FC<{
  src: string;
  imgW: number;
  imgH: number;
  width: number;
  height: number;
  keys: CamKey[];
  children?: React.ReactNode;
}> = ({ src, imgW, imgH, width, height, keys, children }) => {
  const frame = useCurrentFrame();
  const cam = camAt(keys, frame);
  const scale = (width / imgW) * cam.z;
  const dw = imgW * scale;
  const dh = imgH * scale;
  const clamp = (v: number, size: number, view: number) => (size <= view ? (view - size) / 2 : Math.min(0, Math.max(view - size, v)));
  const tx = clamp(width / 2 - cam.x * dw, dw, width);
  const ty = clamp(height / 2 - cam.y * dh, dh, height);
  return (
    <div style={{ position: "relative", width, height, overflow: "hidden", background: "#fff" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: dw, height: dh, transform: `translate(${tx}px, ${ty}px)` }}>
        <Img src={staticFile(src)} style={{ width: "100%", height: "100%", display: "block" }} />
        {children}
      </div>
    </div>
  );
};
