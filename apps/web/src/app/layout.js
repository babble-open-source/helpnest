import { Source_Sans_3, Lora } from 'next/font/google';
import './globals.css';
const sourceSans3 = Source_Sans_3({
    subsets: ['latin'],
    weight: ['400', '500'],
    variable: '--font-source-sans-3',
});
const lora = Lora({
    subsets: ['latin'],
    weight: ['400', '500'],
    style: ['normal', 'italic'],
    variable: '--font-lora',
});
export function generateMetadata() {
    // Self-hosters can set NEXT_PUBLIC_FAVICON_URL to point to their own favicon.
    // e.g. NEXT_PUBLIC_FAVICON_URL=https://your-domain.com/favicon.ico
    const customFavicon = process.env.NEXT_PUBLIC_FAVICON_URL;
    return {
        title: 'HelpNest',
        description: 'The open-source help center for developer tools',
        icons: customFavicon
            ? { icon: customFavicon, shortcut: customFavicon }
            : {
                icon: [
                    { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
                    { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
                ],
                apple: { url: '/apple-touch-icon.png' },
                shortcut: '/favicon.ico',
            },
        manifest: '/manifest.json',
    };
}
export default function RootLayout({ children, }) {
    return (<html lang="en" suppressHydrationWarning>
      <body className={`${sourceSans3.variable} ${lora.variable} font-sans bg-cream text-ink antialiased`} suppressHydrationWarning>
        {children}
      </body>
    </html>);
}
