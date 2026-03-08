import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getTheme, themeToCSS } from '@/lib/themes'
import { redirect } from 'next/navigation'

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: '◻' },
  { href: '/dashboard/articles', label: 'Articles', icon: '◻' },
  { href: '/dashboard/collections', label: 'Collections', icon: '◻' },
  { href: '/dashboard/settings', label: 'Settings', icon: '◻' },
]

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  // Fetch the workspace theme so the admin UI reflects the same colors as the
  // public help center — what admins see matches what their users see.
  const member = await prisma.member.findFirst({
    where: { user: { email: session.user.email! } },
    select: { workspace: { select: { themeId: true } } },
  })
  const theme = getTheme(member?.workspace.themeId ?? 'default')
  const themeCSS = themeToCSS(theme)
  const fontUrls = [theme.fonts.headingUrl, theme.fonts.bodyUrl].filter(Boolean) as string[]

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `${fontUrls.map((url) => `@import url('${url}');`).join('\n')}
:root { ${themeCSS} }` }} />
    <div className="min-h-screen bg-cream flex">
      {/* Sidebar */}
      <aside className="w-60 bg-ink text-cream flex flex-col shrink-0">
        <div className="p-5 border-b border-white/10">
          <Link href="/dashboard" className="font-serif text-xl">HelpNest</Link>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-cream/70 hover:text-cream hover:bg-white/10 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-sm font-medium">
              {session.user.name?.[0] ?? session.user.email?.[0] ?? 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-cream truncate">{session.user.name ?? 'User'}</p>
              <p className="text-xs text-cream/50 truncate">{session.user.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
    </>
  )
}
