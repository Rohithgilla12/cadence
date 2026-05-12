// Cadence design tokens as TypeScript constants. Mirrors tailwind.config.js
// and docs/DESIGN_SYSTEM.md. Use these for places where Tailwind classes
// cannot reach (icon colors, SVG fills, animation values).

export const colors = {
  ink: '#2C3528',
  ink2: '#5A5A52',
  ink3: '#9A9A92',

  bg: '#F4F3ED',
  bgDeeper: '#ECE9DC',
  card: '#FFFFFF',
  paper: '#F4F3ED',
  paper2: '#EAE8DE',

  moss: '#4A5A40',
  mossLight: '#7A8A6F',
  mossLighter: '#A3B39A',
  mossBg: '#EEF1E8',
  mossBg2: '#E3EBD9',

  sand: '#F5EFDE',
  sandDeep: '#C9B380',
  sandText: '#8A7A52',
  sandTextDeep: '#5A4D2A',

  clay: '#D4A890',
  clayBg: '#F4E6DC',
  clayText: '#6B4A36',

  dustBlue: '#D8E0E8',
  dustBlueText: '#3D4A55',
  dustPink: '#E8D8D4',
  dustPinkText: '#6B3D3A',
  dustCream: '#E6DCC4',
  dustCreamText: '#6B5A32',
  dustLilac: '#D8D4E2',
  dustLilacText: '#4A4263',

  hairline: 'rgba(44, 53, 40, 0.08)',
  hairline2: 'rgba(44, 53, 40, 0.16)',
} as const;

export type ColorToken = keyof typeof colors;

export const dustTones = [
  { bg: colors.dustBlue, text: colors.dustBlueText },
  { bg: colors.dustPink, text: colors.dustPinkText },
  { bg: colors.dustCream, text: colors.dustCreamText },
  { bg: colors.dustLilac, text: colors.dustLilacText },
] as const;

export type DustTone = (typeof dustTones)[number];

// Deterministic avatar color: same name → same tone, every time. (DS §2)
export function dustToneFor(name: string): DustTone {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % dustTones.length;
  return dustTones[index];
}

export const fonts = {
  serif: 'Iowan Old Style',
  sans: 'System',
  mono: 'JetBrains Mono',
} as const;

export const radii = {
  sm: 4,
  md: 8,
  lg: 10,
  xl: 12,
  '2xl': 14,
  '3xl': 18,
  full: 9999,
} as const;

export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
} as const;

export const motion = {
  // Per DS §9 — easeOut curve, short durations
  easeOut: [0.2, 0, 0.13, 1] as const,
  fast: 150,
  medium: 240,
  hero: 320,
} as const;

// Conventional screen padding per DS §4 — 22px is deliberate.
export const screenPaddingX = 22;
