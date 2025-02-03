/** @type {import('tailwindcss').Config} */
const { heroui } = require('@heroui/react')

module.exports = {
  content: [
    './src/renderer/src/**/*.{js,ts,jsx,tsx}',
    './node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {}
  },
  darkMode: 'class',
  plugins: [heroui()]
}
