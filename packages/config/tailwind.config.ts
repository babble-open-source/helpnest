import type { Config } from 'tailwindcss'

const config: Partial<Config> = {
  content: [],
  theme: {
    extend: {
      colors: {
        cream: '#F7F4EE',
        ink: '#1A1814',
        muted: '#7A756C',
        border: '#E2DDD5',
        accent: '#C8622A',
        green: {
          DEFAULT: '#2D6A4F',
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          700: '#2D6A4F',
        },
      },
      fontFamily: {
        serif: ['Instrument Serif', 'Georgia', 'serif'],
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
