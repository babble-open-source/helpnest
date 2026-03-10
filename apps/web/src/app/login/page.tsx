import { prisma } from '@/lib/db'
import { LoginForm } from './LoginForm'

const DEFAULT_EMAIL = 'admin@helpnest.cloud'
const DEFAULT_PASSWORD = 'helpnest'

export default async function LoginPage() {
  const demoMode = process.env.HELPNEST_DEMO_MODE === 'true'
  const seedEmail = process.env.ADMIN_SEED_EMAIL ?? DEFAULT_EMAIL

  let showDefaultCreds = false
  let workspaceSlug: string | null = null

  const seedUser = await prisma.user.findUnique({
    where: { email: seedEmail },
    select: {
      passwordChangedAt: true,
      members: { select: { workspace: { select: { slug: true } } }, take: 1 },
    },
  })

  workspaceSlug = seedUser?.members[0]?.workspace.slug ?? null

  if (demoMode) {
    showDefaultCreds = true
  } else {
    showDefaultCreds = seedUser !== null && seedUser.passwordChangedAt === null
  }

  return (
    <LoginForm
      defaultEmail={seedEmail}
      defaultPassword={DEFAULT_PASSWORD}
      showDefaultCreds={showDefaultCreds}
      workspaceSlug={workspaceSlug}
    />
  )
}
