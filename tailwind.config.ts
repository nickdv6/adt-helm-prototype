import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        navy: { 50: '#eef2f8', 500: '#2E5A88', 700: '#1F3864', 900: '#152849' },
        helm: {
          green: '#E2EFDA',
          yellow: '#FFF2CC',
          amber: '#FCE4A6',
          red: '#F8CBAD',
          blue: '#D9E2F3',
          purple: '#E4D9F3',
          gray: '#F2F2F2',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
