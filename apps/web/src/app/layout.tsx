import type { Metadata } from 'next'
import { Source_Sans_3, Lora } from 'next/font/google'
import './globals.css'

const sourceSans3 = Source_Sans_3({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-source-sans-3',
})

const lora = Lora({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-lora',
})

export const metadata: Metadata = {
  title: 'HelpNest',
  description: 'The open-source help center for developer tools',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sourceSans3.variable} ${lora.variable} font-sans bg-cream text-ink antialiased`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
