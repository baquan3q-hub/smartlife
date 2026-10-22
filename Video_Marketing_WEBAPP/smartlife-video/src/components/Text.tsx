import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, GRAD } from "../theme";

/** Splits "plain **accent** plain" into words, tagging the accent ones. A "\n" forces a line break. */
const tokenize = (text: string) => {
  const words: { w: string; accent: boolean }[] = [];
  text.split("**").forEach((part, i) => {
    part
      .replace(/\n/g, " \n ")
      .split(" ")
      .filter(Boolean)
      .forEach((w) => words.push({ w, accent: i % 2 === 1 }));
  });
  return words;
};

export const gradientText: React.CSSProperties = {
  backgroundImage: GRAD,
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

const fadeOut = (frame: number, out?: number) =>
  out === undefined ? 0 : interpolate(frame, [out - 8, out], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

/** Word-by-word rise-in with blur; `**accent**` words get the brand gradient. */
export const KineticText: React.FC<{
  text: string;
  at: number;
  out?: number;
  size: number;
  weight?: number;
  color?: string;
  stagger?: number;
  align?: "left" | "center" | "right";
  lineHeight?: number;
  style?: React.CSSProperties;
}> = ({ text, at, out, size, weight = 800, color = C.ink, stagger = 2, align = "left", lineHeight = 1.14, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = fadeOut(frame, out);
  return (
    <div
      style={{
        fontSize: size,
        fontWeight: weight,
        color,
        lineHeight,
        letterSpacing: "-0.025em",
        textAlign: align,
        opacity: 1 - exit,
        transform: `translateY(${-exit * 30}px)`,
        ...style,
      }}
    >
      {tokenize(text).map(({ w, accent }, i) => {
        if (w === "\n") return <br key={i} />;
        const p = spring({ frame: frame - at - i * stagger, fps, config: { damping: 16, stiffness: 140, mass: 0.7 } });
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              marginRight: "0.26em",
              paddingBottom: "0.08em",
              opacity: Math.min(1, p * 1.4),
              transform: `translateY(${(1 - p) * size * 0.6}px)`,
              filter: `blur(${(1 - Math.min(1, p)) * 10}px)`,
              ...(accent ? gradientText : {}),
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

export const Kicker: React.FC<{ text: string; at: number; out?: number; dark?: boolean }> = ({ text, at, out, dark }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - at, fps, config: { damping: 18, stiffness: 160 } });
  const exit = fadeOut(frame, out);
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 20px",
        borderRadius: 999,
        background: dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.85)",
        border: `1px solid ${dark ? "rgba(255,255,255,0.14)" : "rgba(14,21,37,0.08)"}`,
        boxShadow: dark ? "none" : "0 8px 24px -12px rgba(16,24,48,0.25)",
        fontSize: 20,
        fontWeight: 700,
        letterSpacing: "0.14em",
        color: dark ? "#C9D3EA" : C.muted,
        textTransform: "uppercase",
        opacity: p * (1 - exit),
        transform: `translateX(${(1 - p) * -40}px) scale(${0.9 + p * 0.1})`,
        transformOrigin: "left center",
      }}
    >
      <div style={{ width: 12, height: 12, borderRadius: 6, backgroundImage: GRAD }} />
      {text}
    </div>
  );
};

/** Kicker + headline + sub line, all staggered from `at`. */
export const Caption: React.FC<{
  at: number;
  out?: number;
  kicker: string;
  title: string;
  sub?: string;
  size?: number;
  align?: "left" | "center" | "right";
  dark?: boolean;
  width?: number;
}> = ({ at, out, kicker, title, sub, size = 64, align = "left", dark, width = 620 }) => {
  const frame = useCurrentFrame();
  const subP = interpolate(frame, [at + 10, at + 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const exit = fadeOut(frame, out);
  return (
    <div
      style={{
        width,
        display: "flex",
        flexDirection: "column",
        alignItems: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
        gap: 26,
      }}
    >
      <Kicker text={kicker} at={at} out={out} dark={dark} />
      <KineticText text={title} at={at + 3} out={out} size={size} align={align} color={dark ? "#fff" : C.ink} />
      {sub ? (
        <div
          style={{
            fontSize: 27,
            lineHeight: 1.5,
            fontWeight: 500,
            color: dark ? "#AEB8CF" : C.muted,
            textAlign: align,
            opacity: subP * (1 - exit),
            transform: `translateY(${(1 - subP) * 16 - exit * 30}px)`,
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
};

/** Several captions in one slot, each replacing the previous one at its `at`. */
export const CaptionSwap: React.FC<{
  items: { at: number; kicker: string; title: string; sub?: string }[];
  end?: number;
  size?: number;
  align?: "left" | "center" | "right";
  width?: number;
}> = ({ items, end, size, align, width }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "relative" }}>
      {items.map((it, i) => {
        const out = items[i + 1]?.at ?? end;
        if (frame < it.at - 1 || (out !== undefined && frame > out)) return null;
        return (
          <div key={i} style={{ position: i === 0 ? "relative" : "absolute", top: 0, left: 0 }}>
            <Caption {...it} out={out} size={size} align={align} width={width} />
          </div>
        );
      })}
    </div>
  );
};

export const Chip: React.FC<{ at: number; label: string; icon?: string; color?: string; size?: number; dark?: boolean; active?: boolean }> = ({
  at,
  label,
  icon,
  color = C.blue,
  size = 24,
  dark,
  active,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - at, fps, config: { damping: 11, stiffness: 180, mass: 0.6 } });
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: `${size * 0.5}px ${size * 0.9}px`,
        borderRadius: 999,
        background: active ? color : dark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.92)",
        border: `1.5px solid ${color}44`,
        boxShadow: active ? `0 14px 30px -12px ${color}` : "0 12px 28px -14px rgba(16,24,48,0.35)",
        fontSize: size,
        fontWeight: 700,
        color: active || dark ? "#fff" : C.ink,
        opacity: Math.min(1, p * 1.5),
        transform: `scale(${0.4 + 0.6 * p})`,
        whiteSpace: "nowrap",
      }}
    >
      {icon ? (
        <span style={{ fontSize: size * 1.05 }}>{icon}</span>
      ) : (
        <div style={{ width: size * 0.45, height: size * 0.45, borderRadius: 99, background: active ? "#fff" : color }} />
      )}
      {label}
    </div>
  );
};

export const formatVND = (n: number) =>
  Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** Ease-out count from `from` to `to` over `dur` frames starting at `start`. */
export const useCount = (from: number, to: number, start: number, dur: number) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [start, start + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return from + (to - from) * (1 - Math.pow(1 - p, 3));
};

/** Prefix of `text` typed at `cps` characters per second from `start`. */
export const typed = (text: string, frame: number, start: number, cps: number, fps = 30) => {
  const chars = Math.max(0, Math.floor(((frame - start) / fps) * cps));
  return Array.from(text).slice(0, chars).join("");
};
