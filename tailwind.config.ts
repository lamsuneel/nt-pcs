import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        nt: {
          bg: '#04080A',
          panel: '#0B1113',
          panel2: '#101A1D',
          border: '#1C2A2D',
          teal: '#1FE3C2',
          tealDim: '#15A890',
          text: '#E7F3F1',
          muted: '#8FA3A0',
          compliant: '#1FE3C2',
          flagged: '#F5B942',
          blocked: '#F15B50',
          info: '#5BA8F1',
        },
      },
      fontFamily: {
        display: ['var(--font-outfit)', 'sans-serif'],
        sans: ['var(--font-plex-sans)', 'sans-serif'],
        mono: ['var(--font-plex-mono)', 'monospace'],
      },
      borderRadius: {
        pill: '999px',
      },
    },
  },
  plugins: [],
};
export default config;
