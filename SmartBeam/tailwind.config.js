/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: '#101B36', brand: '#3867F5', cyan: '#20C4D8',
        bg: '#F6F8FC', surface: '#FFFFFF', ink: '#172033', muted: '#6B7690', line: '#E3E8F2',
        bgd: '#0B1220', surfd: '#16213A', inkd: '#EAF0FF', mutedd: '#9AA7C7', lined: '#26324F',
        danger: '#E5484D', success: '#18A957', warn: '#F5A524'
      }
    }
  }
};
