import React from "react";

import { colors } from "../../tokens";
import { sans, serif } from "../../fonts";
import { StatusBar } from "./StatusBar";

const members = [
  { initials: "RG", tone: colors.moss },
  { initials: "AK", tone: colors.mossLight },
  { initials: "TM", tone: colors.ink2 },
  { initials: "SP", tone: colors.mossLighter },
];

const Flower: React.FC = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
    <circle cx={12} cy={6} r={3.2} fill={colors.moss} opacity={0.7} />
    <circle cx={18} cy={12} r={3.2} fill={colors.moss} opacity={0.7} />
    <circle cx={12} cy={18} r={3.2} fill={colors.moss} opacity={0.7} />
    <circle cx={6} cy={12} r={3.2} fill={colors.moss} opacity={0.7} />
    <circle cx={12} cy={12} r={2.4} fill={colors.bg} />
  </svg>
);

interface FeedRowProps {
  who: string;
  what: string;
  flowers: number;
}

const FeedRow: React.FC<FeedRowProps> = ({ who, what, flowers }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      paddingTop: 14,
      paddingBottom: 14,
      borderBottom: `1px solid ${colors.hairline}`,
    }}
  >
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: 16,
        background: colors.mossBg2,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: sans,
        fontSize: 11,
        fontWeight: 600,
        color: colors.moss,
        letterSpacing: 0.5,
      }}
    >
      {who.slice(0, 2).toUpperCase()}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontFamily: sans,
          fontSize: 13,
          color: colors.ink,
          fontWeight: 500,
        }}
      >
        {who}
      </div>
      <div
        style={{
          fontFamily: sans,
          fontSize: 12,
          color: colors.ink2,
          marginTop: 2,
        }}
      >
        {what}
      </div>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <Flower />
      <span
        style={{
          fontFamily: sans,
          fontSize: 11,
          color: colors.moss,
          fontWeight: 500,
        }}
      >
        {flowers}
      </span>
    </div>
  </div>
);

export const CirclesScreen: React.FC = () => {
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
          Circle · 4 friends
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
          Sunday runners.
        </div>

        <div style={{ display: "flex", gap: -6, marginTop: 14 }}>
          {members.map((m, i) => (
            <div
              key={i}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                background: m.tone,
                marginLeft: i === 0 ? 0 : -8,
                border: `2px solid ${colors.bg}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: sans,
                fontSize: 11,
                fontWeight: 600,
                color: colors.bg,
                letterSpacing: 0.5,
              }}
            >
              {m.initials}
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 22,
            background: colors.card,
            border: `1px solid ${colors.hairline}`,
            borderRadius: 16,
            padding: "16px 18px",
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
            Pact · 30 days
          </div>
          <span
            style={{
              fontFamily: serif,
              fontSize: 17,
              color: colors.ink,
              lineHeight: 1.3,
            }}
          >
            Eight runs together, by the new moon.
          </span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 12,
            }}
          >
            <div
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: colors.hairline2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: "75%",
                  height: "100%",
                  background: colors.moss,
                }}
              />
            </div>
            <span
              style={{
                fontFamily: sans,
                fontSize: 12,
                color: colors.moss,
                fontWeight: 600,
              }}
            >
              6 / 8
            </span>
          </div>
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
            This week
          </div>
          <FeedRow who="Ana" what="ran 4.2 km · easy" flowers={3} />
          <FeedRow who="Tom" what="read for 45 min" flowers={2} />
          <FeedRow who="Sara" what="ran 6.0 km · long" flowers={4} />
        </div>
      </div>
    </div>
  );
};
