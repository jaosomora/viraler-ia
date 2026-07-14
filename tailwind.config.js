import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // dark-first: index.html aplica .dark antes de montar React
  theme: {
    extend: {
      colors: {
        // Sistema "Sala de edición" — ver docs/DESIGN.md
        ink: {
          50:  '#F5F3F0',
          100: '#EFECE8',
          200: '#E4E0DC',
          300: '#C9C3BE',
          400: '#9C9396',
          500: '#6E6668',
          600: '#3A3436',
          700: '#2A2526',
          800: '#1C1819',
          850: '#161314',
          900: '#131011',
          950: '#0D0B0C',
        },
        paper: '#F2EFEA',
        accent: {
          DEFAULT: '#1B60D4',
          bright: '#5B95FF',
          soft: '#EAF1FC',
          deep: '#16233F',
        },
        ok: {
          DEFAULT: '#3D7A4E',
          bright: '#93B889',
          soft: '#EAF3EC',
          deep: '#16251B',
        },
        warn: {
          DEFAULT: '#A2701F',
          bright: '#E3B86A',
          soft: '#FDF3E3',
          deep: '#2B2110',
        },
        danger: {
          DEFAULT: '#B0473B',
          bright: '#E08D82',
          soft: '#FBECEA',
          deep: '#331B18',
        },
      },
      fontFamily: {
        sans: ['Inter var', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Archivo', 'Inter var', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"SF Mono"', 'ui-monospace', 'Menlo', 'Consolas', '"Liberation Mono"', 'monospace'],
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'toast-in': 'toast-in 200ms cubic-bezier(0.2, 0.9, 0.3, 1) both',
      },
      keyframes: {
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
    },
  },
  plugins: [typography],
}
