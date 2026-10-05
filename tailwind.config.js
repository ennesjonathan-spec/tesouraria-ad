/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f2f6fb',
          100: '#e2ebf5',
          200: '#c3d6ea',
          300: '#94b6d8',
          400: '#5d8fc0',
          500: '#3a6fa6',
          600: '#2a5686',
          700: '#23456c',
          800: '#1b3756',
          900: '#0f2a4a',
          950: '#0a1c32',
        },
        gold: { 300: '#e3c57d', 400: '#d4ad52', 500: '#bd9336', 600: '#9a762a' },
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}
