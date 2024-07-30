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
        dark: {
          colors: {
            primary: {
              DEFAULT: '#006FEE',
              foreground: '#FFFFFF'
            }
          }
        },
        light: {
          colors: {
            primary: {
              DEFAULT: '#41C3F8',
              foreground: '#000000'
            }
          }
        }
      }
    })
  ]
}
