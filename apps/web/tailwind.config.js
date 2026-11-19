/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#080b14', 900: '#0c1120', 850: '#11172a', 800: '#161e35', 700: '#222c49' },
        accent: { 400: '#7c9cff', 500: '#5b7cfa', 600: '#4563e8' },
        mint: '#3ddc97',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        panel: '0 24px 60px -30px rgba(0,0,0,0.8)',
        glow: '0 0 0 1px rgba(124,156,255,0.25), 0 12px 40px -12px rgba(91,124,250,0.35)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        pulseSoft: { '0%,100%': { opacity: '0.5' }, '50%': { opacity: '1' } },
      },
      animation: {
        'fade-up': 'fade-up 0.35s ease-out both',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
