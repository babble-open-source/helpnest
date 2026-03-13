'use client'

import { useState } from 'react'

type MemberRole = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER'

interface Member {
  id: string
  role: MemberRole
  deactivatedAt: string | null
  user: {
    id: string
    email: string
    name: string | null
  }
}

interface Props {
  members: Member[]
  currentUserId: string
  callerRole: MemberRole
  demoMode?: boolean
}

const ROLE_LABELS: Record<MemberRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  EDITOR: 'Editor',
  VIEWER: 'Viewer',
}

const ROLE_ORDER: MemberRole[] = ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']

function RoleBadge({ role }: { role: MemberRole }) {
  const colors: Record<MemberRole, string> = {
    OWNER: 'bg-accent/10 text-accent',
    ADMIN: 'bg-ink/10 text-ink',
    EDITOR: 'bg-green/10 text-green',
    VIEWER: 'bg-muted/10 text-muted',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  )
}

export function MembersSection({ members: initialMembers, currentUserId, callerRole, demoMode = false }: Props) {
  const [members, setMembers] = useState<Member[]>(initialMembers)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<MemberRole>('EDITOR')
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [inviteCopied, setInviteCopied] = useState(false)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [actionError, setActionError] = useState('')

  const canManage = !demoMode && (callerRole === 'OWNER' || callerRole === 'ADMIN')

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteError('')
    setInviting(true)

    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })

      if (!res.ok) {
        const body = await res.json() as { error?: string }
        setInviteError(body.error ?? 'Failed to create invite.')
        return
      }

      const data = await res.json() as { inviteUrl: string }
      setInviteUrl(data.inviteUrl)
      setInviteEmail('')
    } catch {
      setInviteError('Network error. Please try again.')
    } finally {
      setInviting(false)
    }
  }

  async function handleCopyInviteUrl() {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setInviteCopied(true)
    setTimeout(() => setInviteCopied(false), 2000)
  }

  async function handleRoleChange(memberId: string, newRole: MemberRole) {
    setActionError('')
    try {
      const res = await fetch(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })

      if (!res.ok) {
        const body = await res.json() as { error?: string }
        setActionError(body.error ?? 'Failed to update role.')
        return
      }

      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)),
      )
    } catch {
      setActionError('Network error. Please try again.')
    }
  }

  async function handleToggleDeactivation(member: Member) {
    setActionError('')
    const isDeactivated = member.deactivatedAt !== null
    const body = isDeactivated
      ? { deactivatedAt: null }
      : { deactivatedAt: new Date().toISOString() }

    try {
      const res = await fetch(`/api/members/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setActionError(data.error ?? 'Failed to update member.')
        return
      }

      setMembers((prev) =>
        prev.map((m) =>
          m.id === member.id
            ? { ...m, deactivatedAt: isDeactivated ? null : new Date().toISOString() }
            : m,
        ),
      )
    } catch {
      setActionError('Network error. Please try again.')
    }
  }

  async function handleRemove(member: Member) {
    const displayName = member.user.name ?? member.user.email
    if (!confirm(`Remove ${displayName} from the workspace? This cannot be undone.`)) return

    setActionError('')

    try {
      const res = await fetch(`/api/members/${member.id}`, { method: 'DELETE' })

      if (!res.ok) {
        const body = await res.json() as { error?: string }
        setActionError(body.error ?? 'Failed to remove member.')
        return
      }

      setMembers((prev) => prev.filter((m) => m.id !== member.id))
    } catch {
      setActionError('Network error. Please try again.')
    }
  }

  return (
    <div className="bg-white rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-medium text-ink">Members</h2>
        {canManage && (
          <button
            type="button"
            onClick={() => {
              setShowInviteForm((v) => !v)
              setInviteUrl(null)
              setInviteError('')
            }}
            className="text-sm bg-ink text-cream px-3 py-1.5 rounded-lg hover:bg-ink/90 transition-colors"
          >
            {showInviteForm ? 'Cancel' : 'Invite member'}
          </button>
        )}
      </div>
      <p className="text-sm text-muted mb-4">Manage who has access to this workspace.</p>
      {demoMode && (
        <p className="text-xs text-muted border border-border rounded-lg px-3 py-2 bg-cream mb-4">
          Member management is disabled in demo mode.
        </p>
      )}

      {/* Invite form */}
      {showInviteForm && (
        <div className="mb-6 rounded-lg border border-border p-4 bg-cream space-y-3">
          {inviteUrl ? (
            <>
              <p className="text-sm font-medium text-ink">Share this invite link:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 block rounded bg-white border border-border px-3 py-2 text-sm font-mono text-ink break-all">
                  {inviteUrl}
                </code>
                <button
                  type="button"
                  onClick={() => void handleCopyInviteUrl()}
                  className="shrink-0 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-cream transition-colors"
                >
                  {inviteCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <button
                type="button"
                onClick={() => { setInviteUrl(null); setShowInviteForm(false) }}
                className="text-xs text-muted underline hover:no-underline"
              >
                Done
              </button>
            </>
          ) : (
            <form onSubmit={(e) => void handleInvite(e)} className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  placeholder="colleague@example.com"
                  className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-white text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <div className="relative shrink-0">
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as MemberRole)}
                    className="appearance-none pl-3 pr-8 py-2 border border-border rounded-lg text-sm bg-white text-ink focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
                  >
                    {ROLE_ORDER.map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                  <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              {inviteError && <p className="text-sm text-red-500">{inviteError}</p>}
              <button
                type="submit"
                disabled={inviting}
                className="bg-ink text-cream px-4 py-2 rounded-lg text-sm hover:bg-ink/90 transition-colors disabled:opacity-50"
              >
                {inviting ? 'Sending…' : 'Send invite'}
              </button>
            </form>
          )}
        </div>
      )}

      {actionError && (
        <div className="mb-4 rounded-lg bg-cream border border-border px-4 py-3 text-sm text-red-500">
          {actionError}
        </div>
      )}

      {/* Members list */}
      <ul className="divide-y divide-border">
        {members.map((member) => {
          const isSelf = member.user.id === currentUserId
          const isDeactivated = member.deactivatedAt !== null
          const displayName = member.user.name ?? member.user.email

          return (
            <li key={member.id} className={`flex items-center justify-between py-3 ${isDeactivated ? 'opacity-60' : ''}`}>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-medium truncate ${isDeactivated ? 'text-muted' : 'text-ink'}`}>
                    {displayName}
                    {isSelf && <span className="ml-1 text-xs text-muted">(you)</span>}
                  </span>
                  <RoleBadge role={member.role} />
                  {isDeactivated && (
                    <span className="text-xs text-muted border border-border rounded-full px-2 py-0.5">
                      Deactivated
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted mt-0.5 truncate">{member.user.email}</p>
              </div>

              {canManage && !isSelf && (
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  {!isDeactivated && (
                    <div className="relative">
                      <select
                        value={member.role}
                        onChange={(e) => void handleRoleChange(member.id, e.target.value as MemberRole)}
                        className="appearance-none pl-2 pr-6 py-1 border border-border rounded text-xs bg-white text-ink focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
                      >
                        {ROLE_ORDER.map((r) => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                      <svg className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleToggleDeactivation(member)}
                    className="text-xs border border-border px-2 py-1 rounded hover:bg-cream transition-colors text-muted hover:text-ink"
                  >
                    {isDeactivated ? 'Reactivate' : 'Deactivate'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRemove(member)}
                    className="text-xs border border-border px-2 py-1 rounded text-red-500 hover:bg-cream transition-colors"
                  >
                    Remove
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
