import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";

import { BrandMark } from "./components/BrandMark";
import { FadeText } from "./components/FadeText";
import { PhoneScene } from "./components/PhoneScene";
import { Wordmark } from "./components/Wordmark";
import { CirclesScreen } from "./components/screens/CirclesScreen";
import { ReflectScreen } from "./components/screens/ReflectScreen";
import { RunDetailScreen } from "./components/screens/RunDetailScreen";
import { TodayScreen } from "./components/screens/TodayScreen";
import { colors } from "./tokens";
import { sans, serif } from "./fonts";

// 1920x1080 (16:9) — Twitter inline-video canvas. 16 seconds at 30fps
// → 480 frames. Magazine-style layout: phone right, caption left.
export const TwitterPost: React.FC = () => {
  const { fps } = useVideoConfig();
  const second = (s: number) => Math.round(s * fps);

  // Mid-canvas Y for the phone column. PHONE_HEIGHT = 864 (after scale 1).
  // We scale phones to 1.05 in landscape for legibility, height 907.
  const phoneScale = 1.05;

  const scene = (
    children: React.ReactNode,
    eyebrow: string,
    headline: string,
    sub?: string,
  ) => (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <div
        style={{
          flex: 1,
          paddingLeft: 140,
          paddingRight: 60,
          display: "flex",
          flexDirection: "column",
          gap: 22,
        }}
      >
        <FadeText delay={0}>
          <span
            style={{
              fontFamily: sans,
              fontSize: 18,
              letterSpacing: 3,
              color: colors.moss,
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            {eyebrow}
          </span>
        </FadeText>
        <FadeText delay={second(0.2)}>
          <span
            style={{
              fontFamily: serif,
              fontSize: 64,
              color: colors.ink,
              fontWeight: 500,
              lineHeight: 1.15,
            }}
          >
            {headline}
          </span>
        </FadeText>
        {sub && (
          <FadeText delay={second(0.5)}>
            <span
              style={{
                fontFamily: serif,
                fontStyle: "italic",
                fontSize: 30,
                color: colors.ink2,
                lineHeight: 1.4,
              }}
            >
              {sub}
            </span>
          </FadeText>
        )}
      </div>
      <div
        style={{
          width: 720,
          paddingRight: 140,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <PhoneScene scale={phoneScale} delay={second(0.1)}>
          {children}
        </PhoneScene>
      </div>
    </div>
  );

  return (
    <AbsoluteFill style={{ background: colors.bg }}>
      {/* 0 – 2.5s · brand intro */}
      <Sequence from={second(0)} durationInFrames={second(2.5)} layout="none">
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 36,
          }}
        >
          <BrandMark size={180} />
          <Wordmark fontSize={132} delay={second(0.5)} />
          <FadeText delay={second(1.0)}>
            <span
              style={{
                fontFamily: serif,
                fontStyle: "italic",
                fontSize: 36,
                color: colors.ink2,
              }}
            >
              A quiet habit tracker.
            </span>
          </FadeText>
        </div>
      </Sequence>

      {/* 2.5 – 5.5s · Today */}
      <Sequence
        from={second(2.5)}
        durationInFrames={second(3)}
        premountFor={second(0.6)}
        layout="none"
      >
        {scene(
          <TodayScreen />,
          "Today",
          "Habits, with the data\nyour watch already has.",
          "Auto-detected runs, sleep, mood — no double-logging.",
        )}
      </Sequence>

      {/* 5.5 – 8.5s · Run detail */}
      <Sequence
        from={second(5.5)}
        durationInFrames={second(3)}
        premountFor={second(0.6)}
        layout="none"
      >
        {scene(
          <RunDetailScreen />,
          "Run · in context",
          "Every run, paired\nwith last night's sleep.",
          "Heart-rate zones, HRV, and the morning that made it possible.",
        )}
      </Sequence>

      {/* 8.5 – 11.5s · Reflect */}
      <Sequence
        from={second(8.5)}
        durationInFrames={second(3)}
        premountFor={second(0.6)}
        layout="none"
      >
        {scene(
          <ReflectScreen />,
          "Reflect · after two weeks",
          "The patterns surface\nwithout you asking.",
          "Plain-English insights. Observational, not prescriptive.",
        )}
      </Sequence>

      {/* 11.5 – 13.5s · Circles */}
      <Sequence
        from={second(11.5)}
        durationInFrames={second(2)}
        premountFor={second(0.6)}
        layout="none"
      >
        {scene(
          <CirclesScreen />,
          "Circles",
          "Small circles.\nNo leaderboards.",
          "Three friends, a shared pact, a quiet feed.",
        )}
      </Sequence>

      {/* 13.5 – 16s · CTA */}
      <Sequence
        from={second(13.5)}
        durationInFrames={second(2.5)}
        premountFor={second(0.6)}
        layout="none"
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
          }}
        >
          <BrandMark size={120} />
          <FadeText delay={second(0.2)}>
            <span
              style={{
                fontFamily: serif,
                fontSize: 64,
                color: colors.ink,
                fontWeight: 500,
                textAlign: "center",
              }}
            >
              iOS beta open.
            </span>
          </FadeText>
          <FadeText delay={second(0.7)}>
            <span
              style={{
                fontFamily: sans,
                fontSize: 24,
                color: colors.ink2,
                letterSpacing: 1,
                textAlign: "center",
              }}
            >
              Open source on GitHub · cadence.gilla.fun
            </span>
          </FadeText>
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};
