import baseConfig from '@helpnest/config/tailwind';
const config = {
    ...baseConfig,
    content: [
        './src/**/*.{js,ts,jsx,tsx,mdx}',
        '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
    ],
};
export default config;
