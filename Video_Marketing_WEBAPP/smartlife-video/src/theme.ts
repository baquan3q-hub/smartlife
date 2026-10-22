import { loadFont } from "@remotion/google-fonts/BeVietnamPro";

export const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700", "800", "900"],
  subsets: ["vietnamese", "latin"],
});

export const C = {
  ink: "#0E1525",
  muted: "#5B6478",
  bg: "#F5F7FB",
  dark: "#070B16",
  blue: "#2F6BFF",
  green: "#22C55E",
  purple: "#8B5CF6",
  teal: "#14B8A6",
  orange: "#F59E0B",
  red: "#EF4444",
  white: "#FFFFFF",
};

// accent gradient sampled from the four logo tiles
export const GRAD = `linear-gradient(100deg, ${C.blue} 0%, ${C.teal} 38%, ${C.green} 62%, ${C.purple} 100%)`;

export const SHADOW = "0 40px 80px -20px rgba(16, 24, 48, 0.28), 0 12px 30px -10px rgba(16, 24, 48, 0.18)";
