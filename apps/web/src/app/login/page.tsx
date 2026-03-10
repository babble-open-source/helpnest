import { prisma } from '@/lib/db'
import { LoginForm } from './LoginForm'

const DEFAULT_EMAIL = 'admin@helpnest.cloud'
const DEFAULT_PASSWORD = 'helpnest'

export default async function LoginPage() {
  const demoMode = process.env.HELPNEST_DEMO_MODE === 'true'
  const seedEmail = process.env.ADMIN_SEED_EMAIL ?? DEFAULT_EMAIL

  let showDefaultCreds = false

  if (demoMode) {
    // Always show default creds in demo/showcase mode
    showDefaultCreds = true
  } else {
    // Show only while the seed admin hasn't changed their password
    const seedUser = await prisma.user.findUnique({
      where: { email: seedEmail },
      select: { passwordChangedAt: true },
    })
    showDefaultCreds = seedUser !== null && seedUser.passwordChangedAt === null
  }

  return (
    <LoginForm
      defaultEmail={seedEmail}
      defaultPassword={DEFAULT_PASSWORD}
      showDefaultCreds={showDefaultCreds}
    />
  )
}
