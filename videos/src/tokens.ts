// Cadence design tokens — mirrors src/theme/tokens.ts in cadence-mobile.
// Hard-coded here so the videos package stays self-contained.
export const colors = {
  ink: "#2C3528",
  ink2: "#5A5A52",
  ink3: "#9A9A92",

  bg: "#F4F3ED",
  bgDeeper: "#ECE9DC",
  card: "#FFFFFF",
  paper2: "#EAE8DE",

  moss: "#4A5A40",
  mossLight: "#7A8A6F",
  mossLighter: "#A3B39A",
  mossBg: "#EEF1E8",
  mossBg2: "#E3EBD9",

  hairline: "rgba(44, 53, 40, 0.08)",
  hairline2: "rgba(44, 53, 40, 0.16)",
} as const;
