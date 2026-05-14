import React from "react";
import { spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

import { colors } from "../tokens";
import { serif } from "../fonts";

interface WordmarkProps {
  fontSize: number;
  delay?: number;
}

export const Wordmark: React.FC<WordmarkProps> = ({ fontSize, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200 },
    durationInFrames: fps * 1.2,
  });
  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const translateY = interpolate(progress, [0, 1], [12, 0]);

  return (
    <span
      style={{
        fontFamily: serif,
        fontSize,
        fontWeight: 500,
        color: colors.ink,
        letterSpacing: -0.5,
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      Cadence
    </span>
  );
};
