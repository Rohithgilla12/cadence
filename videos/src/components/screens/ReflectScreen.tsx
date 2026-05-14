import React from "react";

import { colors } from "../../tokens";
import { sans, serif } from "../../fonts";
import { StatusBar } from "./StatusBar";

const rhythm = [0.45, 0.7, 0.55, 0.9, 0.3, 0.8, 0.65];

interface StreakProps {
  title: string;
  days: number;
}

const Streak: React.FC<StreakProps> = ({ title, days }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: 10,
      paddingBottom: 10,
      borderBottom: `1px solid ${colors.hairline}`,
    }}
  >
    <span
      style={{
        fontFamily: sans,
        fontSize: 14,
        color: colors.ink,
        fontWeight: 500,
      }}
    >
      {title}
    </span>
    <span
      style={{
        fontFamily: serif,
        fontSize: 16,
        color: colors.moss,
        fontWeight: 500,
      }}
    >
      {days}d
    </span>
  </div>
);

export const ReflectScreen: React.FC = () => {
  return (
    <div style={{ width: "100%", height: "100%", background: colors.bg }}>
      <StatusBar />
      <div style={{ paddingLeft: 24, paddingRight: 24 }}>
        <div
          style={{
            fontFamily: sans,
            fontSize: 11,
            color: colors.ink3,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            marginTop: 12,
          }}
        >
          Weekly mirror
        </div>
        <div
          style={{
            fontFamily: serif,
            fontSize: 30,
            color: colors.ink,
            fontWeight: 500,
            lineHeight: 1.15,
            marginTop: 4,
          }}
        >
          Reflect.
        </div>

        <div
          style={{
            marginTop: 18,
            background: colors.card,
            border: `1px solid ${colors.hairline}`,
            borderRadius: 16,
            padding: "16px 18px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 8,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                background: colors.moss,
              }}
            />
            <span
              style={{
                fontFamily: sans,
                fontSize: 10,
                color: colors.moss,
                letterSpacing: 1.5,
                fontWeight: 500,
                textTransform: "uppercase",
              }}
            >
              Pattern noticed
            </span>
          </div>
          <span
            style={{
              fontFamily: serif,
              fontSize: 18,
              color: colors.ink,
              lineHeight: 1.3,
            }}
          >
            You run 2.3× more often after nights over 7 hours of sleep.
          </span>
          <div
            style={{
              fontFamily: sans,
              fontSize: 11,
              color: colors.ink3,
              marginTop: 10,
              letterSpacing: 0.5,
            }}
          >
            18 days · p &lt; 0.01 · observational
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <div
            style={{
              fontFamily: sans,
              fontSize: 10,
              color: colors.moss,
              letterSpacing: 2,
              textTransform: "uppercase",
              fontWeight: 500,
              marginBottom: 10,
            }}
          >
            Rhythm · last 7 days
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 90 }}>
            {rhythm.map((v, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: 70 * v + 4,
                    background: colors.moss,
                    opacity: 0.35 + v * 0.5,
                    borderRadius: 4,
                  }}
                />
                <span
                  style={{
                    fontFamily: sans,
                    fontSize: 9,
                    color: colors.ink3,
                    letterSpacing: 1,
                  }}
                >
                  {["M", "T", "W", "T", "F", "S", "S"][i]}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <div
            style={{
              fontFamily: sans,
              fontSize: 10,
              color: colors.moss,
              letterSpacing: 2,
              textTransform: "uppercase",
              fontWeight: 500,
              marginBottom: 4,
            }}
          >
            Coming back
          </div>
          <Streak title="Reading" days={12} />
          <Streak title="Morning run" days={5} />
          <Streak title="Sleep before 11" days={2} />
        </div>
      </div>
    </div>
  );
};
