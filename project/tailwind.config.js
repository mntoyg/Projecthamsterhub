/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        kmitl: {
          orange: '#FF6A00',
          'orange-light': '#FF8C2E',
          'orange-dark': '#CC5400',
          green: '#39FF7A',
          'green-glow': '#5EFF9A',
        },
        charcoal: {
          900: '#0B0F17',
          850: '#0F1420',
          800: '#141B2A',
          700: '#1B2435',
          600: '#243049',
          500: '#33415C',
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      animation: {
        'blink-waste': 'blinkWaste 1s steps(2, start) infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'scan-line': 'scanLine 3s linear infinite',
        'fade-in-up': 'fadeInUp 0.4s ease-out',
        'spin-slow': 'spin 8s linear infinite',
      },
      keyframes: {
        blinkWaste: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.25' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(57,255,122,0.4)' },
          '50%': { boxShadow: '0 0 22px rgba(57,255,122,0.85)' },
        },
        scanLine: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
