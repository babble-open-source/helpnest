import { auth, resolveSessionUserId } from '@/lib/auth'
import { resolveWorkspaceId } from '@/lib/workspace'
import { redirect } from 'next/navigation'
import { OnboardingForm } from './OnboardingForm'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const session = await auth()
  const userId = await resolveSessionUserId(session)
  if (!userId || !session?.user) redirect('/login')

  // If user already has a workspace, skip onboarding
  const workspaceId = await resolveWorkspaceId(userId)
  if (workspaceId) redirect('/dashboard')

  // Build the URL prefix for the slug preview
  const helpCenterDomain = process.env.NEXT_PUBLIC_HELP_CENTER_DOMAIN
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  let urlPrefix: string
  if (helpCenterDomain) {
    // Cloud or subdomain mode: slug.helpnest.cloud
    urlPrefix = helpCenterDomain + '/'
  } else {
    // Self-hosted: localhost:3000/slug/help
    urlPrefix = appUrl.replace(/^https?:\/\//, '').replace(/\/$/, '') + '/'
  }

  return (
    <main className="min-h-screen bg-cream flex items-center justify-center">
      <div className="w-full max-w-md px-6 py-10">
        <h1 className="font-serif text-3xl text-ink mb-2 text-center">
          Create your help center
        </h1>
        <p className="text-muted text-sm text-center mb-8">
          Choose a name and URL for your knowledge base.
        </p>
        <OnboardingForm userName={session.user.name ?? ''} urlPrefix={urlPrefix} />
      </div>
    </main>
  )
}
