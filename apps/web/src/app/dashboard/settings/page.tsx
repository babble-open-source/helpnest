import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { SyncEmbeddingsButton } from './SyncEmbeddingsButton'

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const member = await prisma.member.findFirst({
    where: { user: { email: session.user.email! } },
    include: { workspace: true },
  })
  if (!member) redirect('/dashboard')

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="font-serif text-3xl text-ink mb-8">Settings</h1>

      <div className="space-y-6">
        {/* Workspace */}
        <div className="bg-white rounded-xl border border-border p-6">
          <h2 className="font-medium text-ink mb-4">Workspace</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Name</label>
              <input
                defaultValue={member.workspace.name}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Slug</label>
              <div className="flex items-center border border-border rounded-lg overflow-hidden">
                <span className="px-3 py-2 bg-cream text-muted text-sm border-r border-border">
                  helpnest.io/
                </span>
                <input
                  defaultValue={member.workspace.slug}
                  className="flex-1 px-3 py-2 text-sm focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                Custom Domain
              </label>
              <input
                defaultValue={member.workspace.customDomain ?? ''}
                placeholder="help.yourcompany.com"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <button className="bg-ink text-cream px-4 py-2 rounded-lg text-sm hover:bg-ink/90 transition-colors">
              Save changes
            </button>
          </div>
        </div>

        {/* Help center URL */}
        <div className="bg-cream rounded-xl border border-border p-5">
          <p className="text-sm font-medium text-ink mb-1">Your help center URL</p>
          <p className="text-sm text-muted font-mono">/{member.workspace.slug}/help</p>
        </div>

        {/* AI Search */}
        <div className="bg-white rounded-xl border border-border p-6">
          <h2 className="font-medium text-ink mb-1">AI Search</h2>
          <p className="text-sm text-muted mb-4">
            Index your articles for AI-powered search. Requires OpenAI API key and Qdrant.
          </p>
          <SyncEmbeddingsButton workspaceId={member.workspaceId} />
        </div>
      </div>
    </div>
  )
}
