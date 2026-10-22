import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";

// All overlays live inside KenBurns' image layer and use image-relative (0–1) coordinates.
type Rect = { x0: number; y0: number; x1: number; y1: number };
const pct = (r: Rect): React.CSSProperties => ({
  position: "absolute",
  left: `${r.x0 * 100}%`,
  top: `${r.y0 * 100}%`,
  width: `${(r.x1 - r.x0) * 100}%`,
  height: `${(r.y1 - r.y0) * 100}%`,
});

const visibility = (frame: number, at: number, until?: number) => {
  const inP = interpolate(frame, [at, at + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const outP = until === undefined ? 1 : interpolate(frame, [until - 8, until], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return Math.min(inP, outP);
};

/** Glowing outline around a UI region. */
export const Highlight: React.FC<Rect & { at: number; until?: number; color?: string; radius?: number }> = ({
  at,
  until,
  color = C.blue,
  radius = 14,
  ...r
}) => {
  const frame = useCurrentFrame();
  const v = visibility(frame, at, until);
  if (v <= 0) return null;
  const pulse = 0.5 + 0.5 * Math.sin((frame - at) / 5);
  return (
    <div
      style={{
        ...pct(r),
        borderRadius: radius,
        border: `4px solid ${color}`,
        boxShadow: `0 0 ${18 + pulse * 22}px ${color}, inset 0 0 ${10 + pulse * 10}px ${color}55`,
        opacity: v,
        transform: `scale(${1.12 - 0.12 * v})`,
      }}
    />
  );
};

/** Dims everything except one region. */
export const Spotlight: React.FC<Rect & { at: number; until?: number; radius?: number }> = ({ at, until, radius = 16, ...r }) => {
  const frame = useCurrentFrame();
  const v = visibility(frame, at, until);
  if (v <= 0) return null;
  return (
    <div
      style={{
        ...pct(r),
        borderRadius: radius,
        boxShadow: `0 0 0 9999px rgba(8,12,24,${0.6 * v}), 0 0 40px 8px rgba(47,107,255,${0.8 * v})`,
      }}
    />
  );
};

/** Expanding ring at a point, for taps and emphasis. */
export const Ring: React.FC<{ x: number; y: number; at: number; color?: string; size?: number }> = ({ x, y, at, color = C.blue, size = 120 }) => {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0 || t > 24) return null;
  const p = t / 24;
  return (
    <div
      style={{
        position: "absolute",
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        borderRadius: "50%",
        border: `5px solid ${color}`,
        opacity: 1 - p,
        transform: `scale(${0.3 + p * 1.2})`,
      }}
    />
  );
};

/** Floating badge that pops in with a spring. */
export const Badge: React.FC<{ x: number; y: number; at: number; until?: number; text: string; color?: string; size?: number }> = ({
  x,
  y,
  at,
  until,
  text,
  color = C.red,
  size = 22,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - at, fps, config: { damping: 10, stiffness: 200, mass: 0.6 } });
  const v = visibility(frame, at, until);
  if (v <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        transform: `translate(-50%, -50%) scale(${p})`,
        padding: `${size * 0.4}px ${size * 0.8}px`,
        borderRadius: 999,
        background: color,
        color: "#fff",
        fontSize: size,
        fontWeight: 800,
        whiteSpace: "nowrap",
        boxShadow: `0 10px 30px -8px ${color}`,
        opacity: v,
      }}
    >
      {text}
    </div>
  );
};
