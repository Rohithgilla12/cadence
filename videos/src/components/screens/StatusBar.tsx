import React from "react";

import { colors } from "../../tokens";
import { sans } from "../../fonts";

export const StatusBar: React.FC = () => {
  return (
    <div
      style={{
        height: 44,
        paddingTop: 14,
        paddingLeft: 24,
        paddingRight: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontFamily: sans,
        fontSize: 13,
        fontWeight: 600,
        color: colors.ink,
      }}
    >
      <span>9:41</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            width: 16,
            height: 10,
            borderRadius: 2,
            border: `1px solid ${colors.ink2}`,
            position: "relative",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 1,
              left: 1,
              right: 5,
              bottom: 1,
              background: colors.ink,
              borderRadius: 1,
            }}
          />
        </span>
      </div>
    </div>
  );
};
