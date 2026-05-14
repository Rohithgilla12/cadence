import React from "react";

import { colors } from "../tokens";

interface PhoneFrameProps {
  children: React.ReactNode;
}

// Inner screen is 380x840 — close to an iPhone 14 viewport in logical
// pixels. Outer bezel adds 10px on each side plus a thin hairline so the
// device reads as a phone without dominating the composition.
export const SCREEN_WIDTH = 380;
export const SCREEN_HEIGHT = 840;
export const PHONE_WIDTH = SCREEN_WIDTH + 24;
export const PHONE_HEIGHT = SCREEN_HEIGHT + 24;

export const PhoneFrame: React.FC<PhoneFrameProps> = ({ children }) => {
  return (
    <div
      style={{
        width: PHONE_WIDTH,
        height: PHONE_HEIGHT,
        background: colors.ink,
        borderRadius: 56,
        padding: 12,
        boxShadow: "0 30px 80px rgba(44, 53, 40, 0.18)",
      }}
    >
      <div
        style={{
          width: SCREEN_WIDTH,
          height: SCREEN_HEIGHT,
          background: colors.bg,
          borderRadius: 44,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {children}
      </div>
    </div>
  );
};
