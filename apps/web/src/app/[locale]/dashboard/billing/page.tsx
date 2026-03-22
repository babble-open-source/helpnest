import { redirect } from 'next/navigation'
import { auth, resolveSessionUserId } from '@/lib/auth'
import { resolveWorkspaceId } from '@/lib/workspace'
import { getWorkspaceColumnSet, prisma } from '@/lib/db'
import { getWorkspacePlan, isCloudMode } from '@/lib/cloud'
import { BillingContent } from './BillingContent'

export default async function BillingPage() {
  if (!isCloudMode()) redirect('/dashboard')

  const session = await auth()
  const userId = await resolveSessionUserId(session)
  if (!userId || !session?.user) redirect('/login')

  const workspaceId = await resolveWorkspaceId(userId)
  if (!workspaceId) redirect('/dashboard')

  const member = await prisma.member.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true },
  })
  if (!member) redirect('/dashboard')

  const [plan, workspace] = await Promise.all([
    getWorkspacePlan(workspaceId),
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { customDomain: true },
    }),
  ])

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-ink">Billing &amp; Plans</h1>
        <p className="text-muted mt-1">Manage your subscription and track usage.</p>
      </div>

      <BillingContent
        workspaceId={workspaceId}
        userEmail={session.user.email ?? ''}
        role={member.role}
        plan={plan}
        customDomain={workspace?.customDomain ?? null}
      />
    </div>
  )
}
