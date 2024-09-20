/** @type {import('tailwindcss').Config} */
const { nextui } = require('@nextui-org/react')

module.exports = {
  content: [
    './src/renderer/src/**/*.{js,ts,jsx,tsx}',
    './node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {}
  },
  darkMode: 'class',
  plugins: [nextui()]
}
