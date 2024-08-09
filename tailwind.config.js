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
  plugins: [
    nextui({
      themes: {
        gray: {
          extend: 'dark',
          colors: {
            background: '#18181b',
            content1: '#27272a',
            content2: '#3f3f46',
            content3: '#52525b',
            default: {
              DEFAULT: '#52525b',
              50: '#27272a',
              100: '#3f3f46',
              200: '#52525b',
              300: '#71717a',
              400: '#a1a1aa'
            }
          }
        }
      }
    })
  ]
}
