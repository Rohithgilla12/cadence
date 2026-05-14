import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface FadeTextProps {
  children: React.ReactNode;
  delay?: number;
  durationInFrames?: number;
  translateYFrom?: number;
  style?: React.CSSProperties;
}

// Calm fade-in with a 12px translate. No bounce — matches PRD §3 voice.
// Wraps any text content; styling is up to the caller.
export const FadeText: React.FC<FadeTextProps> = ({
  children,
  delay = 0,
  translateYFrom = 12,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200 },
    durationInFrames: fps * 0.9,
  });
  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const translateY = interpolate(progress, [0, 1], [translateYFrom, 0]);

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
