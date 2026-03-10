import { prisma } from '@/lib/db'
import { isDemoMode } from '@/lib/demo'
import { LoginForm } from './LoginForm'

export const dynamic = 'force-dynamic'

const DEFAULT_EMAIL = 'admin@helpnest.cloud'

export default async function LoginPage() {
  const demoMode = isDemoMode()
  const seedEmail = process.env.ADMIN_SEED_EMAIL ?? DEFAULT_EMAIL

  let workspaceSlug: string | null = null

  if (demoMode) {
    // In demo mode, fetch the workspace slug to show the public help center link.
    // Default email and password are shown; this is intentional for showcase use.
    const seedUser = await prisma.user.findUnique({
      where: { email: seedEmail },
      select: {
        members: { select: { workspace: { select: { slug: true } } }, take: 1 },
      },
    })
    workspaceSlug = seedUser?.members[0]?.workspace.slug ?? null
  }

  return (
    <LoginForm
      showDefaultCreds={demoMode}
      defaultEmail={demoMode ? seedEmail : ''}
      workspaceSlug={workspaceSlug}
    />
  )
}
