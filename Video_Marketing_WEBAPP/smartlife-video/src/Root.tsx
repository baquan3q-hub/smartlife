import React from "react";
import { Composition } from "remotion";
import { FPS, HEIGHT, TOTAL_FRAMES, WIDTH } from "./timeline";
import { SmartLifeLaunch } from "./Video";

export const RemotionRoot: React.FC = () => (
  <Composition id="SmartLifeLaunch" component={SmartLifeLaunch} durationInFrames={TOTAL_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} />
);
