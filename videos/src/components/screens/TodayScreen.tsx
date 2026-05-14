import React from "react";

import { colors } from "../../tokens";
import { sans, serif } from "../../fonts";
import { StatusBar } from "./StatusBar";

const days = ["M", "T", "W", "T", "F", "S", "S"];

interface HabitRowProps {
  title: string;
  meta?: string;
  done: boolean;
  autoDetected?: boolean;
}

const HabitRow: React.FC<HabitRowProps> = ({ title, meta, done, autoDetected }) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        paddingTop: 14,
        paddingBottom: 14,
        borderBottom: `1px solid ${colors.hairline}`,
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          border: `1.5px solid ${done ? colors.moss : colors.ink3}`,
          background: done ? colors.moss : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {done && (
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none">
            <path
              d="M5 12.5l4 4 10-10"
              stroke={colors.bg}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: sans,
            fontSize: 15,
            fontWeight: 500,
            color: done ? colors.ink2 : colors.ink,
            textDecoration: done ? "line-through" : "none",
            textDecorationColor: colors.ink3,
          }}
        >
          {title}
        </div>
        {meta && (
          <div
            style={{
              fontFamily: sans,
              fontSize: 12,
              color: colors.ink3,
              marginTop: 2,
            }}
          >
            {meta}
          </div>
        )}
      </div>
      {autoDetected && (
        <div
          style={{
            fontFamily: sans,
            fontSize: 10,
            color: colors.moss,
            letterSpacing: 1,
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          auto
        </div>
      )}
    </div>
  );
};

export const TodayScreen: React.FC = () => {
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
          Tuesday · May 13
        </div>
        <div
          style={{
            fontFamily: serif,
            fontSize: 30,
            color: colors.ink,
            fontWeight: 500,
            marginTop: 6,
            lineHeight: 1.15,
          }}
        >
          Good morning,
          <br />
          Rohith.
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 22,
          }}
        >
          {days.map((d, i) => (
            <div
              key={i}
              style={{
                width: 32,
                height: 44,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
              }}
            >
              <span
                style={{
                  fontFamily: sans,
                  fontSize: 10,
                  color: i === 1 ? colors.ink : colors.ink3,
                  letterSpacing: 1,
                  fontWeight: i === 1 ? 600 : 500,
                }}
              >
                {d}
              </span>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  background: i < 2 ? colors.moss : colors.hairline2,
                }}
              />
              {i === 1 && (
                <span
                  style={{
                    width: 20,
                    height: 1,
                    background: colors.ink,
                    marginTop: 2,
                  }}
                />
              )}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 22 }}>
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
            Today
          </div>
          <HabitRow
            title="Morning run"
            meta="5.1 km · 28 min"
            done
            autoDetected
          />
          <HabitRow title="Read · 30 min" done />
          <HabitRow title="Sleep before 11" meta="last night: 11:42" done={false} />
        </div>

        <div
          style={{
            marginTop: 22,
            background: colors.card,
            border: `1px solid ${colors.hairline}`,
            borderRadius: 16,
            padding: "14px 16px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 6,
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
              fontSize: 16,
              color: colors.ink,
              lineHeight: 1.35,
            }}
          >
            You run 2.3× more often after nights over 7 hours of sleep.
          </span>
        </div>
      </div>
    </div>
  );
};
