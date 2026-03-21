import { redirect } from 'next/navigation'
import { auth, resolveSessionUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getWorkspacePlan, isCloudMode } from '@/lib/cloud'
import { BillingContent } from './BillingContent'

export default async function BillingPage() {
  if (!isCloudMode()) redirect('/dashboard')

  const session = await auth()
  const userId = await resolveSessionUserId(session)
  if (!userId || !session?.user) redirect('/login')

  const member = await prisma.member.findFirst({
    where: { userId, deactivatedAt: null },
    select: { workspaceId: true, role: true },
  })
  if (!member) redirect('/dashboard')

  const plan = await getWorkspacePlan(member.workspaceId)

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-ink">Billing &amp; Plans</h1>
        <p className="text-muted mt-1">Manage your subscription and track usage.</p>
      </div>

      <BillingContent
        workspaceId={member.workspaceId}
        userEmail={session.user.email ?? ''}
        role={member.role}
        plan={plan}
      />
    </div>
  )
}
