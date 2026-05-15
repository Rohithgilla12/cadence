import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";

import { BrandMark } from "./components/BrandMark";
import { FadeText } from "./components/FadeText";
import { PhoneScene } from "./components/PhoneScene";
import { Wordmark } from "./components/Wordmark";
import { CirclesScreen } from "./components/screens/CirclesScreen";
import { ReflectScreen } from "./components/screens/ReflectScreen";
import { TodayScreen } from "./components/screens/TodayScreen";
import { colors } from "./tokens";
import { sans, serif } from "./fonts";

// 1920x1080 (16:9) — Twitter inline-video canvas. 16 seconds at 30fps
// → 480 frames. Three-pillar pitch:
//   I  · Watches itself  → Today screen
//   II · Surfaces patterns → Reflect screen
//   III · Small circles  → Circles screen
// Each pillar is a magazine spread: roman-numeral eyebrow + pillar
// name, serif headline that *claims* the differentiator, body line
// that grounds the claim in mechanics. Phone on the right.
export const TwitterPost: React.FC = () => {
  const { fps } = useVideoConfig();
  const second = (s: number) => Math.round(s * fps);

  const phoneScale = 1.05;

  const pillarScene = (
    children: React.ReactNode,
    numeral: string,
    pillar: string,
    headline: string,
    body: string,
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
          gap: 24,
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
            {numeral} · {pillar}
          </span>
        </FadeText>
        <FadeText delay={second(0.2)}>
          <span
            style={{
              fontFamily: serif,
              fontSize: 60,
              color: colors.ink,
              fontWeight: 500,
              lineHeight: 1.12,
            }}
          >
            {headline}
          </span>
        </FadeText>
        <FadeText delay={second(0.5)}>
          <span
            style={{
              fontFamily: serif,
              fontStyle: "italic",
              fontSize: 26,
              color: colors.ink2,
              lineHeight: 1.45,
            }}
          >
            {body}
          </span>
        </FadeText>
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
      {/* 0 – 2s · brand intro */}
      <Sequence from={second(0)} durationInFrames={second(2)} layout="none">
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
            gap: 28,
          }}
        >
          <BrandMark size={180} />
          <Wordmark fontSize={132} delay={second(0.4)} />
          <FadeText delay={second(0.9)}>
            <span
              style={{
                fontFamily: serif,
                fontStyle: "italic",
                fontSize: 32,
                color: colors.ink2,
              }}
            >
              Three things to know.
            </span>
          </FadeText>
        </div>
      </Sequence>

      {/* 2 – 6s · I · Watches itself */}
      <Sequence
        from={second(2)}
        durationInFrames={second(4)}
        premountFor={second(0.6)}
        layout="none"
      >
        {pillarScene(
          <TodayScreen />,
          "I",
          "Watches itself",
          "Cadence reads\nyour watch.",
          "Apple Health knows you ran. Cadence ticks the practice and pairs it with last night's sleep — no manual logging.",
        )}
      </Sequence>

      {/* 6 – 10s · II · Surfaces patterns */}
      <Sequence
        from={second(6)}
        durationInFrames={second(4)}
        premountFor={second(0.6)}
        layout="none"
      >
        {pillarScene(
          <ReflectScreen />,
          "II",
          "Surfaces patterns",
          "Plain-English\ninsights.",
          "After about two weeks, the patterns surface. Deterministic templates, p<0.05, observational — never fabricated.",
        )}
      </Sequence>

      {/* 10 – 13.5s · III · Small circles */}
      <Sequence
        from={second(10)}
        durationInFrames={second(3.5)}
        premountFor={second(0.6)}
        layout="none"
      >
        {pillarScene(
          <CirclesScreen />,
          "III",
          "Small circles",
          "Three friends.\nOne pact.",
          "A single flower for showing up. No leaderboards, no public feed.",
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
                fontSize: 60,
                color: colors.ink,
                fontWeight: 500,
                textAlign: "center",
              }}
            >
              iOS beta open.
            </span>
          </FadeText>
          <FadeText delay={second(0.6)}>
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
