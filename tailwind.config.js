module.exports = {
  content: [
    "./app//*.{js,jsx,ts,tsx}",
    "./components//*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          dark: '#05070a',
          blue: '#0a0f18',
          light: '#1a2332'
        },
        accent: {
          blue: '#3b82f6',
          cyan: '#06b6d4',
          white: '#e6f0ff'
        }
      },
      fontFamily: {
        'montserrat': ['Montserrat', 'sans-serif'],
      }
    },
  },
  plugins: [],
}