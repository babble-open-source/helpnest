import Link from 'next/link'
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

  if (invite === null) {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-full max-w-sm px-6 text-center">
          <h1 className="font-serif text-3xl text-ink mb-2">Invite not found</h1>
          <p className="text-muted text-sm">
            This invite link is invalid or does not exist.
          </p>
        </div>
      </main>
    )
  }

  if (invite === 'expired') {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-full max-w-sm px-6 text-center">
          <h1 className="font-serif text-3xl text-ink mb-2">Invite expired</h1>
          <p className="text-muted text-sm">
            This invite link has expired. Please ask your workspace admin to send a new invite.
          </p>
        </div>
      </main>
    )
  }

  if (invite === 'accepted') {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-full max-w-sm px-6 text-center">
          <h1 className="font-serif text-3xl text-ink mb-2">Already accepted</h1>
          <p className="text-muted text-sm mb-4">
            This invite has already been accepted. You can sign in to your account.
          </p>
          <Link
            href="/login"
            className="inline-block bg-ink text-cream px-4 py-2 rounded-lg text-sm font-medium hover:bg-ink/90 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </main>
    )
  }

  const roleLabel: Record<string, string> = {
    OWNER: 'Owner',
    ADMIN: 'Admin',
    EDITOR: 'Editor',
    VIEWER: 'Viewer',
  }

  return (
    <main className="min-h-screen bg-cream flex items-center justify-center">
      <div className="w-full max-w-sm px-6">
        <h1 className="font-serif text-3xl text-ink mb-2 text-center">You&apos;re invited</h1>
        <p className="text-muted text-sm text-center mb-6">
          <span className="font-medium text-ink">{invite.inviterName}</span> invited you to join{' '}
          <span className="font-medium text-ink">{invite.workspaceName}</span> as{' '}
          <span className="font-medium text-ink">{roleLabel[invite.role] ?? invite.role}</span>.
        </p>

        <div className="bg-white rounded-xl border border-border p-6">
          <AcceptForm token={params.token} email={invite.email} />
        </div>

        <p className="text-xs text-muted text-center mt-4">
          Already have an account?{' '}
          <Link href="/login" className="underline hover:no-underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
