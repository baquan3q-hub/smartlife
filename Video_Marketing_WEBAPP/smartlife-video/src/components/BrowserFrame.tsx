import React from "react";
import { C, SHADOW } from "../theme";

export const BAR_H = 46;

/** Minimal browser chrome around the screenshot viewport. */
export const BrowserFrame: React.FC<{ width: number; height: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  width,
  height,
  children,
  style,
}) => (
  <div
    style={{
      width,
      height: height + BAR_H,
      borderRadius: 22,
      overflow: "hidden",
      background: "#fff",
      boxShadow: SHADOW,
      border: "1px solid rgba(14,21,37,0.08)",
      ...style,
    }}
  >
    <div
      style={{
        height: BAR_H,
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "0 20px",
        background: "linear-gradient(#FBFCFE, #F3F5FA)",
        borderBottom: "1px solid rgba(14,21,37,0.07)",
      }}
    >
      {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
        <div key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />
      ))}
      <div
        style={{
          marginLeft: 22,
          height: 28,
          padding: "0 18px",
          borderRadius: 14,
          background: "#fff",
          border: "1px solid rgba(14,21,37,0.08)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 15,
          fontWeight: 600,
          color: C.muted,
        }}
      >
        <svg width="12" height="14" viewBox="0 0 12 14">
          <rect x="1" y="6" width="10" height="7.5" rx="2" fill={C.green} />
          <path d="M3.3 6V4.2a2.7 2.7 0 0 1 5.4 0V6" stroke={C.green} strokeWidth="1.6" fill="none" />
        </svg>
        SmartLife
      </div>
    </div>
    {children}
  </div>
);
