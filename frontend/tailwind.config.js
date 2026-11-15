/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Civic-Fintech Canvas & Surface
        canvas:  '#FAF8F4', // Warm Ivory canvas
        surface: '#FFFFFF', // Pure White card surfaces
        hairline: '#E5E0D5', // Subtle warm hairline border

        // High-contrast ink typography
        ink: {
          DEFAULT:   '#1C1917', // Deep Espresso Ink (base text >= 4.5:1)
          secondary: '#57534E', // Warm Slate
          muted:     '#78716C', // Muted captions & placeholders
          border:    '#E5E0D5', // Border lines
        },

        // Primary Brand & Action: Deep Spruce-Teal
        spruce: {
          DEFAULT: '#0F4C4C',
          hover:   '#0B3B3B',
          dark:    '#072727',
          subtle:  '#EBF3F3',
          light:   '#D8E8E8',
        },

        // Warm Accent & Navigation Highlight: Burnished Gold
        gold: {
          DEFAULT: '#B7791F',
          soft:    '#FEF7EA',
          border:  '#F5DCB1',
          dark:    '#925C14',
        },

        // High-Contrast SPEC Section 8.1 Verdict States
        verified: {
          DEFAULT: '#15803D', // Emerald Green
          bg:      '#ECFDF5',
          border:  '#86EFAC',
          dark:    '#166534',
        },
        unverified: {
          DEFAULT: '#475569', // Cool Slate Grey
          bg:      '#F1F5F9',
          border:  '#CBD5E1',
          dark:    '#334155',
        },
        caution: {
          DEFAULT: '#B45309', // Warm Amber
          bg:      '#FFFBEB',
          border:  '#FDE68A',
          dark:    '#92400E',
        },
        danger: {
          DEFAULT: '#B91C1C', // Crimson Red
          bg:      '#FEF2F2',
          border:  '#FCA5A5',
          dark:    '#991B1B',
        },
      },

      borderColor: {
        hairline: '#E5E0D5',
        DEFAULT:  '#E5E0D5',
      },

      fontFamily: {
        sans: [
          '"Atkinson Hyperlegible"',
          '"Noto Sans Telugu"',
          '"Noto Sans Devanagari"',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
        mono: [
          '"IBM Plex Mono"',
          'monospace',
        ],
      },

      fontSize: {
        xs:   ['0.8125rem', { lineHeight: '1.25rem' }],
        sm:   ['0.9375rem', { lineHeight: '1.4rem' }],
        base: ['1.0625rem', { lineHeight: '1.65rem' }],
        lg:   ['1.1875rem', { lineHeight: '1.75rem' }],
        xl:   ['1.375rem',  { lineHeight: '1.85rem' }],
        '2xl':['1.625rem',  { lineHeight: '2.1rem' }],
        '3xl':['2rem',      { lineHeight: '2.4rem' }],
        '4xl':['2.5rem',    { lineHeight: '2.8rem' }],
      },

      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '24px',
      },

      boxShadow: {
        sm: '0 1px 2px 0 rgba(28, 25, 23, 0.04)',
        DEFAULT: '0 1px 3px 0 rgba(28, 25, 23, 0.06), 0 1px 2px 0 rgba(28, 25, 23, 0.04)',
        md: '0 4px 6px -1px rgba(28, 25, 23, 0.07), 0 2px 4px -1px rgba(28, 25, 23, 0.04)',
        lg: '0 10px 15px -3px rgba(28, 25, 23, 0.08), 0 4px 6px -2px rgba(28, 25, 23, 0.04)',
      },
    },
  },
  plugins: [],
}
