import React from "react";
import { SHADOW } from "../theme";

/** iPhone-style bezel. `height` is the outer height; the screen keeps the 720×1560 aspect of the demo video. */
export const PhoneFrame: React.FC<{ height: number; children: React.ReactNode }> = ({ height, children }) => {
  const bezel = height * 0.018;
  const screenH = height - bezel * 2;
  const screenW = screenH * (720 / 1560);
  return (
    <div
      style={{
        width: screenW + bezel * 2,
        height,
        padding: bezel,
        borderRadius: height * 0.075,
        background: "linear-gradient(145deg, #2A2F3A, #0B0E14)",
        boxShadow: `${SHADOW}, inset 0 0 0 2px rgba(255,255,255,0.08)`,
      }}
    >
      <div style={{ width: screenW, height: screenH, borderRadius: height * 0.06, overflow: "hidden", background: "#000" }}>
        {children}
      </div>
    </div>
  );
};
