import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { themes } from '@/lib/themes'
import { redirect } from 'next/navigation'
import { ApiKeysSection } from './ApiKeysSection'
import { MembersSection } from './MembersSection'
import { ProfileForm } from './ProfileForm'
import { SyncEmbeddingsButton } from './SyncEmbeddingsButton'
import { ThemePicker } from './ThemePicker'
import { WorkspaceForm } from './WorkspaceForm'

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const member = await prisma.member.findFirst({
    where: { user: { email: session.user.email! } },
    include: { workspace: true, user: true },
  })
  if (!member) redirect('/dashboard')

  const members = await prisma.member.findMany({
    where: { workspaceId: member.workspaceId },
    include: { user: { select: { id: true, email: true, name: true } } },
    orderBy: [{ role: 'asc' }, { user: { name: 'asc' } }],
  })

  // Serialize deactivatedAt to string so the client component receives a plain object
  const serializedMembers = members.map((m) => ({
    ...m,
    deactivatedAt: m.deactivatedAt ? m.deactivatedAt.toISOString() : null,
  }))

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="font-serif text-3xl text-ink mb-8">Settings</h1>

      <div className="space-y-6">
        {/* Profile */}
        <div className="bg-white rounded-xl border border-border p-6">
          <h2 className="font-medium text-ink mb-4">Your profile</h2>
          <ProfileForm name={member.user.name ?? ''} />
        </div>

        {/* Workspace */}
        <div className="bg-white rounded-xl border border-border p-6">
          <h2 className="font-medium text-ink mb-4">Workspace</h2>
          <WorkspaceForm
            name={member.workspace.name}
            slug={member.workspace.slug}
            customDomain={member.workspace.customDomain ?? ''}
            helpCenterUrl={`/${member.workspace.slug}/help`}
          />
        </div>

        {/* Members */}
        <MembersSection
          members={serializedMembers}
          currentUserId={member.userId}
          callerRole={member.role}
        />

        {/* Theme */}
        <div className="bg-white rounded-xl border border-border p-6">
          <h2 className="font-medium text-ink mb-1">Help Center Theme</h2>
          <p className="text-sm text-muted mb-4">
            Choose a theme for your public-facing help center. Applied instantly, no redeploy needed.
          </p>
          <ThemePicker
            themes={themes}
            currentThemeId={member.workspace.themeId}
            workspaceSlug={member.workspace.slug}
          />
        </div>

        {/* AI Search */}
        <div className="bg-white rounded-xl border border-border p-6">
          <h2 className="font-medium text-ink mb-1">AI Search</h2>
          <p className="text-sm text-muted mb-4">
            Index your articles for AI-powered search. Requires OpenAI API key and Qdrant.
          </p>
          <SyncEmbeddingsButton workspaceId={member.workspaceId} />
        </div>

        {/* API Keys */}
        <ApiKeysSection />
      </div>
    </div>
  )
}
