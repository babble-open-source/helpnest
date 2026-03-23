'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

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

const ROLE_ORDER: MemberRole[] = ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']
const ROLE_RANK: Record<MemberRole, number> = { OWNER: 0, ADMIN: 1, EDITOR: 2, VIEWER: 3 }

function RoleBadge({ role, tRoles }: { role: MemberRole; tRoles: (key: string) => string }) {
  const colors: Record<MemberRole, string> = {
    OWNER: 'bg-accent/10 text-accent',
    ADMIN: 'bg-ink/10 text-ink',
    EDITOR: 'bg-green/10 text-green',
    VIEWER: 'bg-muted/10 text-muted',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[role]}`}>
      {tRoles(role)}
    </span>
  )
}

export function MembersSection({ members: initialMembers, currentUserId, callerRole, demoMode = false }: Props) {
  const t = useTranslations('members')
  const tRoles = useTranslations('roles')
  const tc = useTranslations('common')
  const [members, setMembers] = useState<Member[]>(initialMembers)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<MemberRole>('EDITOR')
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [inviteCopied, setInviteCopied] = useState(false)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [actionError, setActionError] = useState('')
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null)

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
        setInviteError(body.error ?? t('failedCreateInvite'))
        return
      }

      const data = await res.json() as { inviteUrl: string }
      setInviteUrl(data.inviteUrl)
      setInviteEmail('')
    } catch {
      setInviteError(tc('networkError'))
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
        setActionError(body.error ?? t('failedUpdateRole'))
        return
      }

      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)),
      )
    } catch {
      setActionError(tc('networkError'))
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
        setActionError(data.error ?? t('failedUpdateMember'))
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
      setActionError(tc('networkError'))
    }
  }

  async function handleRemove(member: Member) {
    setMemberToRemove(null)
    setActionError('')

    try {
      const res = await fetch(`/api/members/${member.id}`, { method: 'DELETE' })

      if (!res.ok) {
        const body = await res.json() as { error?: string }
        setActionError(body.error ?? t('failedRemoveMember'))
        return
      }

      setMembers((prev) => prev.filter((m) => m.id !== member.id))
    } catch {
      setActionError(tc('networkError'))
    }
  }

  return (
    <div className="bg-white rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-medium text-ink">{t('title')}</h2>
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
            {showInviteForm ? tc('cancel') : t('inviteMember')}
          </button>
        )}
      </div>
      <p className="text-sm text-muted mb-4">{t('description')}</p>
      {demoMode && (
        <p className="text-xs text-muted border border-border rounded-lg px-3 py-2 bg-cream mb-4">
          {t('demoDisabled')}
        </p>
      )}

      {/* Invite form */}
      {showInviteForm && (
        <div className="mb-6 rounded-lg border border-border p-4 bg-cream space-y-3">
          {inviteUrl ? (
            <>
              <p className="text-sm font-medium text-ink">{t('shareInviteLink')}</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 block rounded bg-white border border-border px-3 py-2 text-sm font-mono text-ink break-all">
                  {inviteUrl}
                </code>
                <button
                  type="button"
                  onClick={() => void handleCopyInviteUrl()}
                  className="shrink-0 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-cream transition-colors"
                >
                  {inviteCopied ? t('copied') : t('copy')}
                </button>
              </div>
              <button
                type="button"
                onClick={() => { setInviteUrl(null); setShowInviteForm(false) }}
                className="text-xs text-muted underline hover:no-underline"
              >
                {t('done')}
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
                  placeholder={t('emailPlaceholder')}
                  className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-white text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <div className="relative shrink-0">
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as MemberRole)}
                    className="appearance-none ps-3 pe-8 py-2 border border-border rounded-lg text-sm bg-white text-ink focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
                  >
                    {ROLE_ORDER.filter((r) => ROLE_RANK[r] > ROLE_RANK[callerRole]).map((r) => (
                      <option key={r} value={r}>{tRoles(r)}</option>
                    ))}
                  </select>
                  <svg className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                {inviting ? t('sending') : t('sendInvite')}
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
                    {isSelf && <span className="ms-1 text-xs text-muted">{t('you')}</span>}
                  </span>
                  <RoleBadge role={member.role} tRoles={tRoles} />
                  {isDeactivated && (
                    <span className="text-xs text-muted border border-border rounded-full px-2 py-0.5">
                      {t('deactivated')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted mt-0.5 truncate">{member.user.email}</p>
              </div>

              {canManage && !isSelf && ROLE_RANK[callerRole] < ROLE_RANK[member.role] && (
                <div className="flex items-center gap-2 ms-4 shrink-0">
                  {!isDeactivated && (
                    <div className="relative">
                      <select
                        value={member.role}
                        onChange={(e) => void handleRoleChange(member.id, e.target.value as MemberRole)}
                        className="appearance-none ps-2 pe-6 py-1 border border-border rounded text-xs bg-white text-ink focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
                      >
                        {ROLE_ORDER.filter((r) => ROLE_RANK[r] > ROLE_RANK[callerRole]).map((r) => (
                          <option key={r} value={r}>{tRoles(r)}</option>
                        ))}
                      </select>
                      <svg className="pointer-events-none absolute end-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleToggleDeactivation(member)}
                    className="text-xs border border-border px-2 py-1 rounded hover:bg-cream transition-colors text-muted hover:text-ink"
                  >
                    {isDeactivated ? t('reactivate') : t('deactivate')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMemberToRemove(member)}
                    className="text-xs border border-border px-2 py-1 rounded text-red-500 hover:bg-cream transition-colors"
                  >
                    {t('remove')}
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <ConfirmDialog
        open={!!memberToRemove}
        title={t('remove')}
        message={memberToRemove ? t('confirmRemove', { name: memberToRemove.user.name ?? memberToRemove.user.email }) : ''}
        confirmLabel={t('remove')}
        cancelLabel={tc('cancel')}
        destructive
        onConfirm={() => { if (memberToRemove) void handleRemove(memberToRemove) }}
        onCancel={() => setMemberToRemove(null)}
      />
    </div>
  )
}
