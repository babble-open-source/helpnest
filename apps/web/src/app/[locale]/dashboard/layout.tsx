import { auth, resolveSessionUserId } from '@/lib/auth'
import { resolveWorkspaceId } from '@/lib/workspace'
import { isCloudMode } from '@/lib/cloud'
import { getWorkspaceColumnSet, prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { isDemoMode } from '@/lib/demo'
import { ThemeProvider } from '@/components/theme-provider'
import { DashboardSidebar } from './DashboardSidebar'
import { DefaultPasswordBanner } from './DefaultPasswordBanner'
import { Toaster } from '@/components/ui/sonner'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const userId = await resolveSessionUserId(session)
  if (!userId || !session?.user) redirect('/login')

  const [workspaceId, currentUser] = await Promise.all([
    resolveWorkspaceId(userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: { passwordChangedAt: true, passwordHash: true },
    }),
  ])
  if (!workspaceId) redirect('/onboarding')

  const member = { workspaceId }

  const demoMode = isDemoMode()
  const showDefaultPasswordBanner =
    !demoMode &&
    currentUser?.passwordHash !== null &&
    currentUser?.passwordChangedAt === null

  const columns = await getWorkspaceColumnSet()

  const workspace = await prisma.workspace.findUnique({
    where: { id: member.workspaceId },
    select: {
      name: true,
      logo: true,
      ...(columns.has('brandText') ? { brandText: true } : {}),
    },
  })
  if (!workspace) redirect('/login')

  const userInitial = session.user.name?.[0] ?? session.user.email?.[0] ?? 'U'

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <div className="dashboard h-screen bg-background text-foreground flex flex-col overflow-hidden">
        {demoMode && (
          <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
            <a
              href="https://github.com/babble-open-source/helpnest"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-card border text-foreground text-xs font-medium px-2.5 py-1 rounded-full shadow hover:bg-muted transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              GitHub
            </a>
            <span className="bg-amber-500 text-white text-xs font-semibold px-3 py-1 rounded-full shadow pointer-events-none">
              DEMO
            </span>
          </div>
        )}
        {showDefaultPasswordBanner && <DefaultPasswordBanner />}
        <div className="flex flex-1 overflow-hidden">
          <DashboardSidebar
            workspaceId={member.workspaceId}
            workspaceName={workspace.name}
            workspaceLogo={workspace.logo}
            workspaceBrandText={workspace.brandText ?? null}
            userName={session.user.name ?? 'User'}
            userEmail={session.user.email ?? ''}
            userInitial={userInitial}
            cloudMode={isCloudMode()}
          />
          <main className="flex-1 overflow-auto pt-14 lg:pt-0 bg-muted/30">
            {children}
          </main>
        </div>
      </div>
      <Toaster />
    </ThemeProvider>
  )
}
