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
        green: 'rgb(var(--color-green) / <alpha-value>)',
        white: 'rgb(var(--color-white) / <alpha-value>)',
      },
      fontFamily: {
        // Driven by CSS variables so themes can swap fonts without a rebuild.
        // Fallbacks ensure legibility if the variable is not yet set.
        serif: ['var(--font-heading, "Instrument Serif")', 'Georgia', 'serif'],
        sans: ['var(--font-body, "DM Sans")', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: 'max(calc(var(--radius, 8px) - 4px), 0px)',
        DEFAULT: 'var(--radius, 8px)',
        md: 'var(--radius, 8px)',
        lg: 'calc(var(--radius, 8px) + 4px)',
        xl: 'calc(var(--radius, 8px) + 8px)',
        '2xl': 'calc(var(--radius, 8px) + 12px)',
      },
    },
  },
  plugins: [],
}

export default config
