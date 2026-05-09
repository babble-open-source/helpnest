import type { Metadata } from 'next'
import { Source_Sans_3, Lora } from 'next/font/google'
import Script from 'next/script'
import './globals.css'

const sourceSans3 = Source_Sans_3({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-source-sans-3',
  display: 'optional',
})

const lora = Lora({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-lora',
  display: 'optional',
})

export function generateMetadata(): Metadata {
  // Self-hosters can set NEXT_PUBLIC_FAVICON_URL to point to their own favicon.
  // e.g. NEXT_PUBLIC_FAVICON_URL=https://your-domain.com/favicon.ico
  const customFavicon = process.env.NEXT_PUBLIC_FAVICON_URL

  return {
    title: 'HelpNest',
    description: 'The open-source help center platform',
    icons: customFavicon
      ? { icon: customFavicon, shortcut: customFavicon }
      : {
          icon: [
            { url: '/favicon-32.svg', type: 'image/svg+xml' },
            { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
            { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
          ],
          apple: { url: '/apple-touch-icon.png' },
          shortcut: '/favicon.ico',
        },
    manifest: '/manifest.json',
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html suppressHydrationWarning>
      <body className={`${sourceSans3.variable} ${lora.variable} font-sans bg-cream text-ink antialiased`} suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var d=document.documentElement,b=document.body,m=document.cookie.match(/dashboard_theme=([^;]+)/);if(m&&m[1]==='dark'){d.classList.add('dark');if(b)b.classList.add('dark')}var p=location.pathname.replace(/^\\/[a-z]{2}(?=\\/|$)/,'');if(p==='/'||p===''||/^\\/(articles|inbox|collections|knowledge-gaps|imports|settings|billing|workspaces|onboarding)/.test(p)){d.classList.add('dashboard-root');if(b){b.classList.add('dashboard-root');b.style.setProperty('--color-background','255 255 255');b.style.setProperty('--color-foreground','9 9 11');b.style.setProperty('--color-card','255 255 255');b.style.setProperty('--color-card-foreground','9 9 11');b.style.setProperty('--color-popover','255 255 255');b.style.setProperty('--color-popover-foreground','9 9 11');b.style.setProperty('--color-primary','24 24 27');b.style.setProperty('--color-primary-foreground','250 250 250');b.style.setProperty('--color-muted','244 244 245');b.style.setProperty('--color-muted-foreground','113 113 122');b.style.setProperty('--color-accent','244 244 245');b.style.setProperty('--color-accent-foreground','24 24 27');b.style.setProperty('--color-border','229 229 232');b.style.setProperty('--color-input','229 229 232');b.style.setProperty('--color-ring','24 24 27');if(m&&m[1]==='dark'){b.style.setProperty('--color-background','10 10 12');b.style.setProperty('--color-foreground','237 237 237');b.style.setProperty('--color-card','23 23 26');b.style.setProperty('--color-card-foreground','237 237 237');b.style.setProperty('--color-popover','23 23 26');b.style.setProperty('--color-popover-foreground','237 237 237');b.style.setProperty('--color-primary','237 237 237');b.style.setProperty('--color-primary-foreground','10 10 12');b.style.setProperty('--color-muted','32 32 36');b.style.setProperty('--color-muted-foreground','140 140 150');b.style.setProperty('--color-accent','32 32 36');b.style.setProperty('--color-accent-foreground','237 237 237');b.style.setProperty('--color-border','35 35 39');b.style.setProperty('--color-input','35 35 39');b.style.setProperty('--color-ring','100 100 110')}}}}catch(e){}})()` }} />
        {children}
        {process.env.NODE_ENV === 'development' && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
      </body>
    </html>
  )
}
