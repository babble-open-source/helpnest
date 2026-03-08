export interface HelpNestTheme {
  id: string
  name: string
  description: string
  colors: {
    cream: string
    ink: string
    muted: string
    border: string
    accent: string
    green: string
    white: string
  }
  fonts: {
    heading: string
    body: string
    headingUrl?: string
    bodyUrl?: string
  }
  radius: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  dark: boolean
}

/** Convert a hex color like #F7F4EE to space-separated RGB channels "247 244 238" */
function hexToChannels(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `${r} ${g} ${b}`
}

const radiusScale: Record<HelpNestTheme['radius'], string> = {
  none: '0px',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
}

/**
 * Generate a CSS :root block for a theme.
 * Colors use RGB channels so Tailwind opacity utilities (bg-cream/90) keep working.
 * Fonts use --font-heading/--font-body which Tailwind's font-serif/font-sans read.
 */
export function themeToCSS(theme: HelpNestTheme): string {
  const { colors, fonts } = theme
  return [
    `--color-cream: ${hexToChannels(colors.cream)};`,
    `--color-ink: ${hexToChannels(colors.ink)};`,
    `--color-muted: ${hexToChannels(colors.muted)};`,
    `--color-border: ${hexToChannels(colors.border)};`,
    `--color-accent: ${hexToChannels(colors.accent)};`,
    `--color-green: ${hexToChannels(colors.green)};`,
    `--color-white: ${hexToChannels(colors.white)};`,
    `--font-heading: ${fonts.heading};`,
    `--font-body: ${fonts.body};`,
    `--radius: ${radiusScale[theme.radius]};`,
  ].join(' ')
}

export const themes: HelpNestTheme[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'Warm cream tones with serif headings — the classic HelpNest look.',
    colors: { cream: '#F7F4EE', ink: '#1A1814', muted: '#7A756C', border: '#E2DDD5', accent: '#C8622A', green: '#2D6A4F', white: '#FFFFFF' },
    fonts: {
      heading: "'Instrument Serif', Georgia, serif",
      body: "'DM Sans', system-ui, sans-serif",
      headingUrl: 'https://fonts.googleapis.com/css2?family=Instrument+Serif&display=swap',
      bodyUrl: 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..700&display=swap',
    },
    radius: 'md',
    dark: false,
  },
  {
    id: 'dark',
    name: 'Dark',
    description: 'Deep charcoal with warm off-white text. Same warmth, different mood.',
    colors: { cream: '#1A1814', ink: '#F7F4EE', muted: '#9E9890', border: '#2E2B26', accent: '#E07A4A', green: '#3A8A65', white: '#232017' },
    fonts: {
      heading: "'Instrument Serif', Georgia, serif",
      body: "'DM Sans', system-ui, sans-serif",
      headingUrl: 'https://fonts.googleapis.com/css2?family=Instrument+Serif&display=swap',
      bodyUrl: 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..700&display=swap',
    },
    radius: 'md',
    dark: true,
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Clean blue tones for a corporate, trustworthy feel.',
    colors: { cream: '#F0F7FF', ink: '#0D2340', muted: '#5B7FA6', border: '#C5DAFA', accent: '#1A6FD9', green: '#0E7C5B', white: '#FFFFFF' },
    fonts: {
      heading: "'Plus Jakarta Sans', system-ui, sans-serif",
      body: "'Inter', system-ui, sans-serif",
      headingUrl: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600&display=swap',
      bodyUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap',
    },
    radius: 'lg',
    dark: false,
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Deep earthy greens with a classic serif. Calm and grounded.',
    colors: { cream: '#F2F7F4', ink: '#1A2E20', muted: '#5A7A63', border: '#C5DEC9', accent: '#2D6A4F', green: '#1B4332', white: '#FFFFFF' },
    fonts: {
      heading: "'Lora', Georgia, serif",
      body: "'Source Sans 3', system-ui, sans-serif",
      headingUrl: 'https://fonts.googleapis.com/css2?family=Lora:wght@400;500&display=swap',
      bodyUrl: 'https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;500&display=swap',
    },
    radius: 'sm',
    dark: false,
  },
  {
    id: 'aurora',
    name: 'Aurora',
    description: 'Violet and purple tones with modern geometric fonts. Playful and bold.',
    colors: { cream: '#F8F5FF', ink: '#1E1040', muted: '#7B6EA8', border: '#DDD5F8', accent: '#7C3AED', green: '#059669', white: '#FFFFFF' },
    fonts: {
      heading: "'Syne', system-ui, sans-serif",
      body: "'Nunito', system-ui, sans-serif",
      headingUrl: 'https://fonts.googleapis.com/css2?family=Syne:wght@400;600&display=swap',
      bodyUrl: 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;500&display=swap',
    },
    radius: 'xl',
    dark: false,
  },
  {
    id: 'slate',
    name: 'Slate',
    description: 'Neutral grays with IBM Plex for a minimal, enterprise feel.',
    colors: { cream: '#F8F9FA', ink: '#111827', muted: '#6B7280', border: '#E5E7EB', accent: '#374151', green: '#059669', white: '#FFFFFF' },
    fonts: {
      heading: "'IBM Plex Serif', Georgia, serif",
      body: "'IBM Plex Sans', system-ui, sans-serif",
      headingUrl: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Serif:wght@400;500&display=swap',
      bodyUrl: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500&display=swap',
    },
    radius: 'sm',
    dark: false,
  },
  {
    id: 'rose',
    name: 'Rose',
    description: 'Soft pinks with Playfair Display. Warm, friendly, approachable.',
    colors: { cream: '#FFF5F7', ink: '#3D0A14', muted: '#9B6472', border: '#F5D0DA', accent: '#E11D48', green: '#0E7C5B', white: '#FFFFFF' },
    fonts: {
      heading: "'Playfair Display', Georgia, serif",
      body: "'Lato', system-ui, sans-serif",
      headingUrl: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500&display=swap',
      bodyUrl: 'https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap',
    },
    radius: 'lg',
    dark: false,
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Deep navy with JetBrains Mono. Premium dark theme for developer tools.',
    colors: { cream: '#0D1117', ink: '#E6EDF3', muted: '#8B949E', border: '#21262D', accent: '#58A6FF', green: '#3FB950', white: '#161B22' },
    fonts: {
      heading: "'JetBrains Mono', monospace",
      body: "'Inter', system-ui, sans-serif",
      headingUrl: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap',
      bodyUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap',
    },
    radius: 'md',
    dark: true,
  },
]

export function getTheme(id: string): HelpNestTheme {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return themes.find((t) => t.id === id) ?? themes[0]!
}
