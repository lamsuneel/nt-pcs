import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        nt: {
          bg: '#F3FAF9',
          panel: '#FFFFFF',
          panel2: '#F6FCFB',
          border: '#DCEDEA',
          borderStrong: '#C3E3DE',
          teal: '#0EA89A',
          tealDim: '#0A8C80',
          tealBright: '#1FE3C2',
          text: '#0B1113',
          muted: '#5B726E',
          muted2: '#8CA19D',
          compliant: '#0EA89A',
          flagged: '#B9780C',
          blocked: '#C2362B',
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
