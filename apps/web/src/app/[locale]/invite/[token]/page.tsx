import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'
import { AcceptForm } from './AcceptForm'

interface InviteDetails {
  email: string
  role: string
  workspaceName: string
  inviterName: string
  expiresAt: string
}

async function fetchInvite(token: string): Promise<InviteDetails | null | 'expired' | 'accepted'> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  try {
    const res = await fetch(`${appUrl}/api/invites/${token}`, {
      cache: 'no-store',
    })
    if (res.status === 404) return null
    if (res.status === 410) {
      const body = await res.json() as { error?: string }
      if (body.error?.includes('accepted')) return 'accepted'
      return 'expired'
    }
    if (!res.ok) return null
    const data = await res.json() as { invite: InviteDetails }
    return data.invite
  } catch {
    return null
  }
}

export default async function InvitePage(props: { params: Promise<{ token: string }> }) {
  const params = await props.params
  const invite = await fetchInvite(params.token)
  const t = await getTranslations('invite')
  const tRoles = await getTranslations('roles')
  const tCommon = await getTranslations('common')

  if (invite === null) {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-full max-w-sm px-6 text-center">
          <h1 className="font-serif text-3xl text-ink mb-2">{t('notFound')}</h1>
          <p className="text-muted text-sm">
            {t('notFoundDescription')}
          </p>
        </div>
      </main>
    )
  }

  if (invite === 'expired') {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-full max-w-sm px-6 text-center">
          <h1 className="font-serif text-3xl text-ink mb-2">{t('expired')}</h1>
          <p className="text-muted text-sm">
            {t('expiredDescription')}
          </p>
        </div>
      </main>
    )
  }

  if (invite === 'accepted') {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-full max-w-sm px-6 text-center">
          <h1 className="font-serif text-3xl text-ink mb-2">{t('alreadyAccepted')}</h1>
          <p className="text-muted text-sm mb-4">
            {t('alreadyAcceptedDescription')}
          </p>
          <Link
            href="/login"
            className="inline-block bg-ink text-cream px-4 py-2 rounded-lg text-sm font-medium hover:bg-ink/90 transition-colors"
          >
            {tCommon('signIn')}
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-cream flex items-center justify-center">
      <div className="w-full max-w-sm px-6">
        <h1 className="font-serif text-3xl text-ink mb-2 text-center">{t('youreInvited')}</h1>
        <p className="text-muted text-sm text-center mb-6">
          {t('invitedBy', {
            inviterName: invite.inviterName,
            workspaceName: invite.workspaceName,
            role: tRoles(invite.role as 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER'),
          })}
        </p>

        <div className="bg-white rounded-xl border border-border p-6">
          <AcceptForm token={params.token} email={invite.email} />
        </div>

        <p className="text-xs text-muted text-center mt-4">
          {t('alreadyHaveAccount')}{' '}
          <Link href="/login" className="underline hover:no-underline">
            {tCommon('signIn')}
          </Link>
        </p>
      </div>
    </main>
  )
}
