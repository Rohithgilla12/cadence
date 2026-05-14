import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { PHONE_HEIGHT, PHONE_WIDTH, PhoneFrame } from "./PhoneFrame";

interface PhoneSceneProps {
  children: React.ReactNode;
  scale?: number;
  delay?: number;
}

// Wraps a screen mock in the PhoneFrame and lets it ease in with a calm
// fade + 12px rise + tiny scale-up. Spring damping 200, no bounce.
//
// The outer div reserves the *visual* (post-scale) footprint so flex layouts
// allocate the right amount of space. CSS transforms don't affect layout, so
// without this the scaled phone overflows its slot and crashes into adjacent
// captions — which is exactly what bit the InstagramStory composition.
export const PhoneScene: React.FC<PhoneSceneProps> = ({
  children,
  scale = 1,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200 },
    durationInFrames: fps * 1.2,
  });
  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const translateY = interpolate(progress, [0, 1], [16, 0]);
  const enterScale = interpolate(progress, [0, 1], [0.96, 1]);

  return (
    <div
      style={{
        width: PHONE_WIDTH * scale,
        height: PHONE_HEIGHT * scale,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          opacity,
          transform: `translateY(${translateY}px) scale(${scale * enterScale})`,
          transformOrigin: "center center",
        }}
      >
        <PhoneFrame>{children}</PhoneFrame>
      </div>
    </div>
  );
};
