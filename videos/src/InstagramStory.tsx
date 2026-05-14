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

// 1080x1920 (9:16) — Instagram Story / Reel canvas. 18s at 30fps → 540
// frames. Vertical: caption on top, phone centered below. The phone is
// scaled up because we have the height to spare.
export const InstagramStory: React.FC = () => {
  const { fps } = useVideoConfig();
  const second = (s: number) => Math.round(s * fps);

  const phoneScale = 1.55;

  const scene = (
    children: React.ReactNode,
    eyebrow: string,
    headline: string,
  ) => (
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
        justifyContent: "flex-start",
        paddingTop: 160,
      }}
    >
      <FadeText delay={0}>
        <span
          style={{
            fontFamily: sans,
            fontSize: 26,
            letterSpacing: 3,
            color: colors.moss,
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          {eyebrow}
        </span>
      </FadeText>
      <div style={{ height: 20 }} />
      <FadeText delay={second(0.2)}>
        <span
          style={{
            fontFamily: serif,
            fontSize: 56,
            color: colors.ink,
            fontWeight: 500,
            textAlign: "center",
            lineHeight: 1.15,
          }}
        >
          {headline}
        </span>
      </FadeText>
      <div style={{ height: 60 }} />
      <PhoneScene scale={phoneScale} delay={second(0.1)}>
        {children}
      </PhoneScene>
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
          <BrandMark size={240} />
          <Wordmark fontSize={120} delay={second(0.5)} />
          <FadeText delay={second(1.0)}>
            <span
              style={{
                fontFamily: serif,
                fontStyle: "italic",
                fontSize: 40,
                color: colors.ink2,
                textAlign: "center",
              }}
            >
              A quiet habit tracker
              <br />
              for runners and the
              <br />
              quietly committed.
            </span>
          </FadeText>
        </div>
      </Sequence>

      {/* 2.5 – 6s · Today */}
      <Sequence
        from={second(2.5)}
        durationInFrames={second(3.5)}
        premountFor={second(0.6)}
        layout="none"
      >
        {scene(
          <TodayScreen />,
          "Today",
          "Habits, paired with\nwhat your watch knows.",
        )}
      </Sequence>

      {/* 6 – 9.5s · Run detail */}
      <Sequence
        from={second(6)}
        durationInFrames={second(3.5)}
        premountFor={second(0.6)}
        layout="none"
      >
        {scene(
          <RunDetailScreen />,
          "Run · in context",
          "Every run, beside\nlast night's sleep.",
        )}
      </Sequence>

      {/* 9.5 – 13s · Reflect */}
      <Sequence
        from={second(9.5)}
        durationInFrames={second(3.5)}
        premountFor={second(0.6)}
        layout="none"
      >
        {scene(
          <ReflectScreen />,
          "Reflect",
          "After two weeks,\npatterns surface.",
        )}
      </Sequence>

      {/* 13 – 15.5s · Circles */}
      <Sequence
        from={second(13)}
        durationInFrames={second(2.5)}
        premountFor={second(0.6)}
        layout="none"
      >
        {scene(
          <CirclesScreen />,
          "Circles",
          "Small circles.\nNo leaderboards.",
        )}
      </Sequence>

      {/* 15.5 – 18s · CTA */}
      <Sequence
        from={second(15.5)}
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
            gap: 32,
          }}
        >
          <BrandMark size={160} />
          <FadeText delay={second(0.2)}>
            <span
              style={{
                fontFamily: serif,
                fontSize: 76,
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
                fontSize: 28,
                color: colors.moss,
                letterSpacing: 1,
                fontWeight: 500,
              }}
            >
              Link in bio
            </span>
          </FadeText>
          <FadeText delay={second(1.1)}>
            <span
              style={{
                fontFamily: sans,
                fontSize: 22,
                color: colors.ink3,
                letterSpacing: 1,
              }}
            >
              Open source · cadence.gilla.fun
            </span>
          </FadeText>
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};
