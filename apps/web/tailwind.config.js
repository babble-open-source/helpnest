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
    			cream: 'rgb(var(--color-cream) / <alpha-value>)',
    			ink: 'rgb(var(--color-ink) / <alpha-value>)',
    			green: 'rgb(var(--color-green) / <alpha-value>)',
    			white: 'rgb(var(--color-white) / <alpha-value>)',
    			muted: {
    				DEFAULT: 'rgb(var(--color-muted) / <alpha-value>)',
    				foreground: 'rgb(var(--color-muted-foreground) / <alpha-value>)'
    			},
    			accent: {
    				DEFAULT: 'rgb(var(--color-accent) / <alpha-value>)',
    				foreground: 'rgb(var(--color-accent-foreground) / <alpha-value>)'
    			},
    			border: 'rgb(var(--color-border) / <alpha-value>)',
    			background: 'rgb(var(--color-background) / <alpha-value>)',
    			foreground: 'rgb(var(--color-foreground) / <alpha-value>)',
    			card: {
    				DEFAULT: 'rgb(var(--color-card) / <alpha-value>)',
    				foreground: 'rgb(var(--color-card-foreground) / <alpha-value>)'
    			},
    			popover: {
    				DEFAULT: 'rgb(var(--color-popover) / <alpha-value>)',
    				foreground: 'rgb(var(--color-popover-foreground) / <alpha-value>)'
    			},
    			primary: {
    				DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
    				foreground: 'rgb(var(--color-primary-foreground) / <alpha-value>)'
    			},
    			secondary: {
    				DEFAULT: 'rgb(var(--color-secondary) / <alpha-value>)',
    				foreground: 'rgb(var(--color-secondary-foreground) / <alpha-value>)'
    			},
    			destructive: {
    				DEFAULT: 'rgb(var(--color-destructive) / <alpha-value>)',
    				foreground: 'rgb(var(--color-destructive-foreground) / <alpha-value>)'
    			},
    			input: 'var(--input-color, rgb(var(--color-input)))',
    			ring: 'rgb(var(--color-ring) / <alpha-value>)',
    			chart: {
    				'1': 'rgb(var(--color-chart-1) / <alpha-value>)',
    				'2': 'rgb(var(--color-chart-2) / <alpha-value>)',
    				'3': 'rgb(var(--color-chart-3) / <alpha-value>)',
    				'4': 'rgb(var(--color-chart-4) / <alpha-value>)',
    				'5': 'rgb(var(--color-chart-5) / <alpha-value>)'
    			},
    			sidebar: {
    				DEFAULT: 'hsl(var(--sidebar-background))',
    				foreground: 'hsl(var(--sidebar-foreground))',
    				primary: 'hsl(var(--sidebar-primary))',
    				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
    				accent: 'hsl(var(--sidebar-accent))',
    				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
    				border: 'hsl(var(--sidebar-border))',
    				ring: 'hsl(var(--sidebar-ring))'
    			}
    		},
    		borderColor: {
    			DEFAULT: 'var(--border-color)'
    		},
    		borderRadius: {
                ...baseConfig.theme?.extend?.borderRadius
    		}
    	}
    },
};
export default config;
