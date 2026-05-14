import React from "react";

import { colors } from "../../tokens";
import { sans, serif } from "../../fonts";
import { StatusBar } from "./StatusBar";

const zones = [
  { label: "Z1", value: 0.1 },
  { label: "Z2", value: 0.55 },
  { label: "Z3", value: 0.25 },
  { label: "Z4", value: 0.1 },
  { label: "Z5", value: 0.0 },
];

interface StatProps {
  label: string;
  value: string;
}

const Stat: React.FC<StatProps> = ({ label, value }) => (
  <div style={{ flex: 1 }}>
    <div
      style={{
        fontFamily: sans,
        fontSize: 9,
        color: colors.ink3,
        letterSpacing: 1.5,
        textTransform: "uppercase",
        marginBottom: 4,
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontFamily: serif,
        fontSize: 22,
        color: colors.ink,
        fontWeight: 500,
      }}
    >
      {value}
    </div>
  </div>
);

export const RunDetailScreen: React.FC = () => {
  return (
    <div style={{ width: "100%", height: "100%", background: colors.bg }}>
      <StatusBar />
      <div style={{ paddingLeft: 24, paddingRight: 24 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 4,
            marginBottom: 16,
          }}
        >
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <path
              d="M15 6l-6 6 6 6"
              stroke={colors.ink}
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span
            style={{
              fontFamily: sans,
              fontSize: 13,
              color: colors.ink2,
              fontWeight: 500,
            }}
          >
            Run
          </span>
        </div>

        <div
          style={{
            fontFamily: sans,
            fontSize: 11,
            color: colors.ink3,
            letterSpacing: 1.5,
            textTransform: "uppercase",
          }}
        >
          Tuesday morning
        </div>
        <div
          style={{
            fontFamily: serif,
            fontSize: 28,
            color: colors.ink,
            fontWeight: 500,
            lineHeight: 1.15,
            marginTop: 4,
          }}
        >
          A steady five.
        </div>

        <div
          style={{
            marginTop: 18,
            background: colors.card,
            border: `1px solid ${colors.hairline}`,
            borderRadius: 16,
            padding: 18,
            display: "flex",
            gap: 12,
          }}
        >
          <Stat label="Distance" value="5.1 km" />
          <Stat label="Time" value="28:04" />
          <Stat label="Pace" value="5:30" />
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
              marginBottom: 10,
            }}
          >
            Heart rate · zones
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 90 }}>
            {zones.map((z) => (
              <div
                key={z.label}
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
                    height: 70 * z.value + 4,
                    background: colors.moss,
                    opacity: z.value === 0 ? 0.15 : 0.35 + z.value * 0.65,
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
                  {z.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            marginTop: 22,
            background: colors.mossBg,
            borderRadius: 14,
            padding: "12px 14px",
          }}
        >
          <div
            style={{
              fontFamily: sans,
              fontSize: 10,
              color: colors.moss,
              letterSpacing: 2,
              textTransform: "uppercase",
              fontWeight: 500,
              marginBottom: 6,
            }}
          >
            That morning
          </div>
          <span
            style={{
              fontFamily: serif,
              fontSize: 14,
              color: colors.ink2,
              lineHeight: 1.5,
            }}
          >
            Slept 7h 12m · HRV 48 ms · woke calm.
          </span>
        </div>

        <div
          style={{
            marginTop: 16,
            fontFamily: sans,
            fontSize: 10,
            color: colors.ink3,
            letterSpacing: 1,
            textAlign: "center",
          }}
        >
          Auto-detected from Apple Health
        </div>
      </div>
    </div>
  );
};
