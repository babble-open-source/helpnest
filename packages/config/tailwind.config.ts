import type { Config } from 'tailwindcss'

const config: Partial<Config> = {
  content: [],
  theme: {
    extend: {
      colors: {
        cream: 'rgb(var(--color-cream) / <alpha-value>)',
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        green: {
          DEFAULT: 'rgb(var(--color-green) / <alpha-value>)',
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          700: '#2D6A4F',
        },
        white: 'rgb(var(--color-white) / <alpha-value>)',
      },
      fontFamily: {
        // Driven by CSS variables so themes can swap fonts without a rebuild.
        // Fallbacks ensure legibility if the variable is not yet set.
        serif: ['var(--font-heading, "Instrument Serif")', 'Georgia', 'serif'],
        sans: ['var(--font-body, "DM Sans")', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
