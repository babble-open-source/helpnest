import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getTheme, themeToCSS } from '@/lib/themes'
import { redirect } from 'next/navigation'
import { DashboardSidebar } from './DashboardSidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const member = await prisma.member.findFirst({
    where: { user: { email: session.user.email! } },
    select: { workspace: { select: { themeId: true } } },
  })
  const theme = getTheme(member?.workspace.themeId ?? 'default')
  const themeCSS = themeToCSS(theme)
  const fontUrls = [theme.fonts.headingUrl, theme.fonts.bodyUrl].filter(Boolean) as string[]
  const userInitial = session.user.name?.[0] ?? session.user.email?.[0] ?? 'U'

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `${fontUrls.map((url) => `@import url('${url}');`).join('\n')}
:root { ${themeCSS} }` }} />
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
