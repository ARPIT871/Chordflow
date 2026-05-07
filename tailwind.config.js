/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Surface tokens (match the design's CSS custom properties)
        bg:      '#1a1a2e',
        'bg-2':  '#15152a',
        card:    '#2d2d44',
        'card-2':'#33334d',
        line:    '#3a3a55',
        'line-soft': '#2a2a40',
        accent: {
          pink:   '#ff6b9d',
          teal:   '#4ecdc4',
          amber:  '#f5a524',
          violet: '#a78bfa',
          'violet-d': '#8b6ee0',
        },
        ink: {
          primary:   '#ececf5',
          secondary: '#a0a0b8',
          tertiary:  '#6e6e88',
          mute:      '#5e5e7a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
}
