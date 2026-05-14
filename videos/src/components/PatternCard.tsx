import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { colors } from "../tokens";
import { sans, serif } from "../fonts";

interface PatternCardProps {
  delay?: number;
  width?: number;
}

// Mirrors the in-app pattern card on Reflect: card-bg, hairline border,
// rounded corners, small moss "PATTERN NOTICED" eyebrow, the rendered
// insight string below. Animates in with a calm scale + fade.
export const PatternCard: React.FC<PatternCardProps> = ({
  delay = 0,
  width = 880,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200 },
    durationInFrames: fps * 1.1,
  });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const scale = interpolate(enter, [0, 1], [0.96, 1]);

  // The rendered text reveals via a subtle slide after the card is in
  // place. PRD §8 sample template: "You run 2.3× more often after nights
  // over 7h sleep."
  const textProgress = spring({
    frame: frame - delay - fps * 0.5,
    fps,
    config: { damping: 200 },
    durationInFrames: fps * 1.0,
  });
  const textOpacity = interpolate(textProgress, [0, 1], [0, 1]);
  const textY = interpolate(textProgress, [0, 1], [8, 0]);

  return (
    <div
      style={{
        width,
        background: colors.card,
        borderRadius: 24,
        border: `1px solid ${colors.hairline}`,
        padding: "32px 36px",
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: colors.moss,
          }}
        />
        <span
          style={{
            fontFamily: sans,
            fontSize: 16,
            fontWeight: 500,
            letterSpacing: 1.5,
            color: colors.moss,
            textTransform: "uppercase",
          }}
        >
          Pattern noticed
        </span>
      </div>
      <div
        style={{
          opacity: textOpacity,
          transform: `translateY(${textY}px)`,
        }}
      >
        <span
          style={{
            fontFamily: serif,
            fontSize: 40,
            lineHeight: 1.25,
            color: colors.ink,
            fontWeight: 400,
          }}
        >
          You run{" "}
          <span style={{ fontWeight: 600 }}>2.3× more often</span> after nights
          over 7 hours of sleep.
        </span>
      </div>
    </div>
  );
};
