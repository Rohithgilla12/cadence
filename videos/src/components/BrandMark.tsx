import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { colors } from "../tokens";

interface BrandMarkProps {
  size: number;
  delay?: number;
}

// The three concentric circles from the Cadence brand mark. Matches the
// mobile app's BrandMark.tsx — viewBox 240, outer radius 72, middle 52,
// inner 32. Animates in by drawing a sweep on the outer two rings while
// the inner solid disc fades.
export const BrandMark: React.FC<BrandMarkProps> = ({ size, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = frame - delay;
  const progress = spring({
    frame: localFrame,
    fps,
    config: { damping: 200 },
    durationInFrames: fps * 1.5,
  });

  // Outer ring sweep: animate stroke dash offset from full → 0
  const outerCirc = 2 * Math.PI * 72;
  const outerOffset = interpolate(progress, [0, 1], [outerCirc, 0]);
  const middleCirc = 2 * Math.PI * 52;
  const middleOffset = interpolate(progress, [0, 1], [middleCirc, 0]);

  // Inner disc fades + scales slightly
  const innerFrame = frame - delay - fps * 0.4;
  const innerProgress = spring({
    frame: innerFrame,
    fps,
    config: { damping: 200 },
    durationInFrames: fps * 0.8,
  });
  const innerScale = interpolate(innerProgress, [0, 1], [0.3, 1]);
  const innerOpacity = interpolate(innerProgress, [0, 1], [0, 1]);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 240 240"
      fill="none"
      style={{ overflow: "visible" }}
    >
      <circle
        cx={120}
        cy={120}
        r={72}
        stroke={colors.moss}
        strokeWidth={1.5}
        strokeDasharray={outerCirc}
        strokeDashoffset={outerOffset}
        transform="rotate(-90 120 120)"
      />
      <circle
        cx={120}
        cy={120}
        r={52}
        stroke={colors.moss}
        strokeWidth={1.5}
        strokeDasharray={middleCirc}
        strokeDashoffset={middleOffset}
        transform="rotate(-90 120 120)"
      />
      <circle
        cx={120}
        cy={120}
        r={32}
        fill={colors.moss}
        opacity={innerOpacity}
        transform={`translate(120 120) scale(${innerScale}) translate(-120 -120)`}
      />
    </svg>
  );
};
