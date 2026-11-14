/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: '#FAF8F5',
          cream: '#FDFBF7',
          dark: '#EFEBE1',
          sand: '#E6E0D2',
        },
        ink: {
          DEFAULT: '#1C1917',
          muted: '#57534E',
          soft: '#78716C',
        },
        terracotta: {
          DEFAULT: '#C05621',
          hover: '#A84518',
          active: '#8C3411',
          light: '#FEEBC8',
          subtle: '#FFF7ED',
        },
        ochre: {
          DEFAULT: '#D97706',
          light: '#FEF3C7',
          dark: '#B45309',
        },
        forest: {
          DEFAULT: '#15803D',
          hover: '#166534',
          light: '#DCFCE7',
          subtle: '#F0FDF4',
        },
        verdict: {
          verified: '#15803D',
          'verified-bg': '#ECFDF5',
          'verified-border': '#86EFAC',
          unverified: '#4B5563',
          'unverified-bg': '#F3F4F6',
          'unverified-border': '#D1D5DB',
          caution: '#B45309',
          'caution-bg': '#FFFBEB',
          'caution-border': '#FDE68A',
          danger: '#B91C1C',
          'danger-bg': '#FEF2F2',
          'danger-border': '#FCA5A5',
        },
      },
      fontFamily: {
        sans: ['"Atkinson Hyperlegible"', '"Noto Sans Telugu"', '"Noto Sans Devanagari"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      borderWidth: {
        '1.5': '1.5px',
        '2': '2px',
        '2.5': '2.5px',
      },
      boxShadow: {
        flat: '3px 3px 0px #1C1917',
        'flat-sm': '2px 2px 0px #1C1917',
        'flat-lg': '4px 4px 0px #1C1917',
        'warm-glow': '0 0 15px rgba(192, 86, 33, 0.15)',
        'trust-glow': '0 0 15px rgba(21, 128, 61, 0.15)',
      },
    },
  },
  plugins: [],
}
