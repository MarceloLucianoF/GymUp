/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // <--- Ativa o Dark Mode manual
  content: [
    "./src/**/*.{js,jsx,ts,tsx}", // <--- Manda o Tailwind olhar dentro da pasta src
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#FFC107',
          dark: '#FFB300',
          yellow: '#FFC107',
          yellowDark: '#FFB300',
          darkBg: '#0D1117',
          darkCard: '#1F2937',
          grayText: '#6B7280',
        }
      },
      fontFamily: {
        display: ['Outfit', 'Inter', 'sans-serif'],
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(16px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'scale-in': { '0%': { opacity: '0', transform: 'scale(0.94)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        'slide-up': { '0%': { transform: 'translateY(100%)' }, '100%': { transform: 'translateY(0)' } },
        'float': { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        'shimmer': { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        'pulse-ring': { '0%': { boxShadow: '0 0 0 0 rgba(255,193,7,0.5)' }, '100%': { boxShadow: '0 0 0 14px rgba(255,193,7,0)' } },
        'aurora': { '0%,100%': { transform: 'translate(0,0) scale(1)' }, '50%': { transform: 'translate(30px,-20px) scale(1.15)' } },
        'draw': { '0%': { strokeDashoffset: 'var(--len, 300)' }, '100%': { strokeDashoffset: '0' } },
        'bar-grow': { '0%': { transform: 'scaleY(0)' }, '100%': { transform: 'scaleY(1)' } },
      },
      animation: {
        'fade-up': 'fade-up 0.6s cubic-bezier(0.22,1,0.36,1) both',
        'fade-in': 'fade-in 0.4s ease-out both',
        'scale-in': 'scale-in 0.35s cubic-bezier(0.22,1,0.36,1) both',
        'slide-up': 'slide-up 0.4s cubic-bezier(0.22,1,0.36,1) both',
        'float': 'float 4s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'pulse-ring': 'pulse-ring 1.8s ease-out infinite',
        'aurora': 'aurora 14s ease-in-out infinite',
        'draw': 'draw 1.4s ease-out both',
        'bar-grow': 'bar-grow 0.8s cubic-bezier(0.22,1,0.36,1) both',
      },
    },
  },
  plugins: [],
}