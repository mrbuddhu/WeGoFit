/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#e8ecf0',
          100: '#c5cdd8',
          200: '#9eabbe',
          300: '#7789a4',
          400: '#566f90',
          500: '#35567c',
          600: '#2a4a6e',
          700: '#1e3a5c',
          800: '#162b47',
          900: '#0D1B2A',
          950: '#080f18',
        },
        green: {
          50: '#e6fff5',
          100: '#b3ffe2',
          200: '#80ffcc',
          300: '#4dffb5',
          400: '#26ff9f',
          500: '#00FF87',
          600: '#00cc6c',
          700: '#009952',
          800: '#006637',
          900: '#00331c',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        heading: ['Syne', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.4s ease-out forwards',
        'bounce-subtle': 'bounceSubtle 0.3s ease-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        bounceSubtle: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(0.95)' },
          '100%': { transform: 'scale(1)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 10px rgba(0,255,135,0.3)' },
          '100%': { boxShadow: '0 0 25px rgba(0,255,135,0.7), 0 0 50px rgba(0,255,135,0.3)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
