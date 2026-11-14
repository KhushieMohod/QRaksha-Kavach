/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: '#F6F4EE',
        'paper-dark': '#EBE7DD',
        ink: '#1C1917',
        terracotta: {
          DEFAULT: '#C05621',
          hover: '#A84518',
          active: '#8C3411',
          light: '#FEEBC8',
        },
        verdict: {
          verified: '#15803D',
          'verified-bg': '#DCFCE7',
          unverified: '#4B5563',
          'unverified-bg': '#F3F4F6',
          caution: '#B45309',
          'caution-bg': '#FEF3C7',
          danger: '#B91C1C',
          'danger-bg': '#FEE2E2',
        },
      },
      fontFamily: {
        sans: ['"Atkinson Hyperlegible"', '"Noto Sans Telugu"', '"Noto Sans Devanagari"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      borderWidth: {
        '2': '2px',
      },
    },
  },
  plugins: [],
}
