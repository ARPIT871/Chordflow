/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#1a1a2e',
        card: '#2d2d44',
        accent: {
          pink: '#ff6b9d',
          teal: '#4ecdc4',
        },
        ink: {
          primary: '#ffffff',
          secondary: '#a0a0b8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
