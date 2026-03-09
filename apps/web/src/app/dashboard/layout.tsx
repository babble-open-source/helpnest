import { auth, resolveSessionUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getTheme, themeToCSS } from '@/lib/themes'
import { redirect } from 'next/navigation'
import { DashboardSidebar } from './DashboardSidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const userId = await resolveSessionUserId(session)
  if (!userId || !session?.user) redirect('/login')

  const member = await prisma.member.findFirst({
    where: { userId, deactivatedAt: null },
    select: { workspace: { select: { themeId: true } } },
  })
  if (!member) redirect('/login')

  const theme = getTheme(member?.workspace.themeId ?? 'default')
  const themeCSS = themeToCSS(theme)
  const fontUrls = [theme.fonts.headingUrl, theme.fonts.bodyUrl].filter(Boolean) as string[]
  const userInitial = session.user.name?.[0] ?? session.user.email?.[0] ?? 'U'

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {fontUrls.map((url) => (
        <link key={url} rel="stylesheet" href={url} />
      ))}
      <style dangerouslySetInnerHTML={{ __html: `:root { ${themeCSS} }` }} />
      <div className="h-screen bg-cream flex overflow-hidden">
        <DashboardSidebar
          userName={session.user.name ?? 'User'}
          userEmail={session.user.email ?? ''}
          userInitial={userInitial}
        />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </>
  )
}
