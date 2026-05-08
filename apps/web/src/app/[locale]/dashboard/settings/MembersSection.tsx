'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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
  const variantMap: Record<MemberRole, 'default' | 'secondary' | 'outline'> = {
    OWNER: 'default',
    ADMIN: 'secondary',
    EDITOR: 'outline',
    VIEWER: 'outline',
  }
  return (
    <Badge variant={variantMap[role]} className="text-xs">
      {tRoles(role)}
    </Badge>
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-medium">{t('title')}</CardTitle>
            <CardDescription className="mt-0.5">{t('description')}</CardDescription>
          </div>
          {canManage && (
            <Button
              type="button"
              size="sm"
              variant={showInviteForm ? 'outline' : 'default'}
              onClick={() => {
                setShowInviteForm((v) => !v)
                setInviteUrl(null)
                setInviteError('')
              }}
            >
              {showInviteForm ? tc('cancel') : t('inviteMember')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {demoMode && (
          <p className="text-xs text-muted-foreground border rounded-lg px-3 py-2 bg-muted mb-4">
            {t('demoDisabled')}
          </p>
        )}

        {/* Invite form */}
        {showInviteForm && (
          <div className="mb-6 rounded-lg border p-4 bg-muted space-y-3">
            {inviteUrl ? (
              <>
                <p className="text-sm font-medium text-foreground">{t('shareInviteLink')}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 block rounded bg-card border px-3 py-2 text-sm font-mono text-foreground break-all">
                    {inviteUrl}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleCopyInviteUrl()}
                    className="shrink-0"
                  >
                    {inviteCopied ? t('copied') : t('copy')}
                  </Button>
                </div>
                <button
                  type="button"
                  onClick={() => { setInviteUrl(null); setShowInviteForm(false) }}
                  className="text-xs text-muted-foreground underline hover:no-underline"
                >
                  {t('done')}
                </button>
              </>
            ) : (
              <form onSubmit={(e) => void handleInvite(e)} className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                    placeholder={t('emailPlaceholder')}
                    className="flex-1"
                  />
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as MemberRole)}>
                    <SelectTrigger className="w-[120px] shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_ORDER.filter((r) => ROLE_RANK[r] > ROLE_RANK[callerRole]).map((r) => (
                        <SelectItem key={r} value={r}>{tRoles(r)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}
                <Button type="submit" disabled={inviting}>
                  {inviting ? t('sending') : t('sendInvite')}
                </Button>
              </form>
            )}
          </div>
        )}

        {actionError && (
          <div className="mb-4 rounded-lg bg-muted border px-4 py-3 text-sm text-destructive">
            {actionError}
          </div>
        )}

        {/* Members list */}
        <ul className="divide-y">
          {members.map((member) => {
            const isSelf = member.user.id === currentUserId
            const isDeactivated = member.deactivatedAt !== null
            const displayName = member.user.name ?? member.user.email

            return (
              <li key={member.id} className={`flex items-center justify-between py-3 ${isDeactivated ? 'opacity-60' : ''}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-medium truncate ${isDeactivated ? 'text-muted-foreground' : 'text-foreground'}`}>
                      {displayName}
                      {isSelf && <span className="ms-1 text-xs text-muted-foreground">{t('you')}</span>}
                    </span>
                    <RoleBadge role={member.role} tRoles={tRoles} />
                    {isDeactivated && (
                      <Badge variant="outline" className="text-xs">{t('deactivated')}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{member.user.email}</p>
                </div>

                {canManage && !isSelf && ROLE_RANK[callerRole] < ROLE_RANK[member.role] && (
                  <div className="flex items-center gap-2 ms-4 shrink-0">
                    {!isDeactivated && (
                      <Select
                        value={member.role}
                        onValueChange={(v) => void handleRoleChange(member.id, v as MemberRole)}
                      >
                        <SelectTrigger className="h-7 text-xs w-[100px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_ORDER.filter((r) => ROLE_RANK[r] > ROLE_RANK[callerRole]).map((r) => (
                            <SelectItem key={r} value={r}>{tRoles(r)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => void handleToggleDeactivation(member)}
                    >
                      {isDeactivated ? t('reactivate') : t('deactivate')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
                      onClick={() => setMemberToRemove(member)}
                    >
                      {t('remove')}
                    </Button>
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
      </CardContent>
    </Card>
  )
}
