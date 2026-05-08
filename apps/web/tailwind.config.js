import baseConfig from '@helpnest/config/tailwind';
const config = {
    ...baseConfig,
    darkMode: ['class'],
    content: [
        './src/**/*.{js,ts,jsx,tsx,mdx}',
        '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
    ],
    theme: {
        ...baseConfig.theme,
        extend: {
            ...baseConfig.theme?.extend,
            colors: {
                // Help center colors — keep as-is (cream, ink, green, white stay flat)
                cream: 'rgb(var(--color-cream) / <alpha-value>)',
                ink: 'rgb(var(--color-ink) / <alpha-value>)',
                green: 'rgb(var(--color-green) / <alpha-value>)',
                white: 'rgb(var(--color-white) / <alpha-value>)',

                // Shared names — override with object format for shadcn foreground variants
                // DEFAULT keeps the same CSS var resolution as before (no help center breakage)
                muted: {
                    DEFAULT: 'rgb(var(--color-muted) / <alpha-value>)',
                    foreground: 'rgb(var(--color-muted-foreground) / <alpha-value>)',
                },
                accent: {
                    DEFAULT: 'rgb(var(--color-accent) / <alpha-value>)',
                    foreground: 'rgb(var(--color-accent-foreground) / <alpha-value>)',
                },
                border: 'rgb(var(--color-border) / <alpha-value>)',

                // shadcn semantic colors — only used in dashboard pages
                background: 'rgb(var(--color-background) / <alpha-value>)',
                foreground: 'rgb(var(--color-foreground) / <alpha-value>)',
                card: {
                    DEFAULT: 'rgb(var(--color-card) / <alpha-value>)',
                    foreground: 'rgb(var(--color-card-foreground) / <alpha-value>)',
                },
                popover: {
                    DEFAULT: 'rgb(var(--color-popover) / <alpha-value>)',
                    foreground: 'rgb(var(--color-popover-foreground) / <alpha-value>)',
                },
                primary: {
                    DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
                    foreground: 'rgb(var(--color-primary-foreground) / <alpha-value>)',
                },
                secondary: {
                    DEFAULT: 'rgb(var(--color-secondary) / <alpha-value>)',
                    foreground: 'rgb(var(--color-secondary-foreground) / <alpha-value>)',
                },
                destructive: {
                    DEFAULT: 'rgb(var(--color-destructive) / <alpha-value>)',
                    foreground: 'rgb(var(--color-destructive-foreground) / <alpha-value>)',
                },
                input: 'rgb(var(--color-input) / <alpha-value>)',
                ring: 'rgb(var(--color-ring) / <alpha-value>)',
                chart: {
                    1: 'rgb(var(--color-chart-1) / <alpha-value>)',
                    2: 'rgb(var(--color-chart-2) / <alpha-value>)',
                    3: 'rgb(var(--color-chart-3) / <alpha-value>)',
                    4: 'rgb(var(--color-chart-4) / <alpha-value>)',
                    5: 'rgb(var(--color-chart-5) / <alpha-value>)',
                },
                sidebar: {
                    DEFAULT: 'rgb(var(--color-sidebar) / <alpha-value>)',
                    foreground: 'rgb(var(--color-sidebar-foreground) / <alpha-value>)',
                    primary: 'rgb(var(--color-sidebar-primary) / <alpha-value>)',
                    'primary-foreground': 'rgb(var(--color-sidebar-primary-foreground) / <alpha-value>)',
                    accent: 'rgb(var(--color-sidebar-accent) / <alpha-value>)',
                    'accent-foreground': 'rgb(var(--color-sidebar-accent-foreground) / <alpha-value>)',
                    border: 'rgb(var(--color-sidebar-border) / <alpha-value>)',
                    ring: 'rgb(var(--color-sidebar-ring) / <alpha-value>)',
                },
            },
            borderRadius: {
                ...baseConfig.theme?.extend?.borderRadius,
            },
        },
    },
};
export default config;
