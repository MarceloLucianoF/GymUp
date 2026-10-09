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
      }
    },
  },
  plugins: [],
}