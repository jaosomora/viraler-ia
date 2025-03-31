/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // o 'media' para basar en preferencias del sistema
  theme: {
    extend: {
      colors: {
        // Colores principales
        purple: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        },
        // Colores secundarios
        indigo: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        // Colores para el modo oscuro mejorado
        dark: {
          bg: '#121212',
          card: '#1E1E1E',
          surface: '#242424',
          border: '#333333',
          text: {
            primary: '#FFFFFF',
            secondary: '#B3B3B3',
            muted: '#8C8C8C',
          }
        }
      },
      fontFamily: {
        sans: ['Inter var', 'Inter', 'sans-serif'],
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      backgroundColor: {
        'dark-card': '#1E1E1E',
        'dark-surface': '#242424',
      },
      textColor: {
        'dark-primary': '#FFFFFF',
        'dark-secondary': '#CCCCCC',
        'dark-muted': '#999999',
      },
      borderColor: {
        'dark-border': '#333333',
      }
    },
  },
  plugins: [],
}