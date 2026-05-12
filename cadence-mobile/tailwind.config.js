// Cadence design tokens — single source of truth, mirrors docs/DESIGN_SYSTEM.md §2
// and §11. Never introduce a new color without updating the design system first.
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Ink (text)
        ink: {
          DEFAULT: '#2C3528',
          2: '#5A5A52',
          3: '#9A9A92',
        },

        // Surfaces
        bg: {
          DEFAULT: '#F4F3ED',
          deeper: '#ECE9DC',
        },
        card: '#FFFFFF',
        paper: {
          DEFAULT: '#F4F3ED',
          2: '#EAE8DE',
        },

        // Moss (primary)
        moss: {
          DEFAULT: '#4A5A40',
          light: '#7A8A6F',
          lighter: '#A3B39A',
          bg: '#EEF1E8',
          'bg-2': '#E3EBD9',
        },

        // Sand (gentle warning, grace)
        sand: {
          DEFAULT: '#F5EFDE',
          deep: '#C9B380',
          text: '#8A7A52',
          'text-deep': '#5A4D2A',
        },

        // Clay (over-zone, retired)
        clay: {
          DEFAULT: '#D4A890',
          bg: '#F4E6DC',
          text: '#6B4A36',
        },

        // Dust tones (avatars, circle members)
        dust: {
          blue: '#D8E0E8',
          'blue-text': '#3D4A55',
          pink: '#E8D8D4',
          'pink-text': '#6B3D3A',
          cream: '#E6DCC4',
          'cream-text': '#6B5A32',
          lilac: '#D8D4E2',
          'lilac-text': '#4A4263',
        },

        // Hairline borders — exported as utility classes too
        hairline: {
          DEFAULT: 'rgba(44, 53, 40, 0.08)',
          2: 'rgba(44, 53, 40, 0.16)',
        },
      },
      fontFamily: {
        serif: ['Iowan Old Style', 'Palatino', 'Georgia', 'serif'],
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
        mono: ['JetBrains Mono', 'SF Mono', 'Menlo', 'monospace'],
      },
      fontSize: {
        // Per DESIGN_SYSTEM.md §3 type scale
        micro: ['11px', { lineHeight: '14px', fontWeight: '500' }],
        eyebrow: ['11px', { lineHeight: '14px', letterSpacing: '0.08em', fontWeight: '500' }],
        caption: ['12px', { lineHeight: '16px', fontWeight: '400' }],
        'body-sm': ['13px', { lineHeight: '18px', fontWeight: '400' }],
        body: ['14px', { lineHeight: '20px', fontWeight: '400' }],
        h3: ['18px', { lineHeight: '22px', fontWeight: '500' }],
        h2: ['20px', { lineHeight: '24px', fontWeight: '500' }],
        h1: ['24px', { lineHeight: '28px', fontWeight: '500' }],
        display: ['32px', { lineHeight: '40px', fontWeight: '500' }],
      },
      letterSpacing: {
        eyebrow: '0.08em',
      },
      borderRadius: {
        // Aligned with DESIGN_SYSTEM.md §5
        sm: '4px',
        md: '8px',
        lg: '10px',
        xl: '12px',
        '2xl': '14px',
        '3xl': '18px',
      },
      borderWidth: {
        hairline: '0.5px',
      },
    },
  },
  plugins: [],
};
