'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { RestoreModal } from './RestoreModal'
import { CreateWorkspaceModal } from './CreateWorkspaceModal'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Workspace {
  id: string
  name: string
  slug: string
  logo: string | null
  role: string
  deletedAt: string | null
}

interface Props {
  active: Workspace[]
  deleted: Workspace[]
  currentWorkspaceId: string | null
  cloudMode: boolean
  slugPrefix: string
  slugSuffix: string
}

const RESTORE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

export function WorkspaceList({ active, deleted, currentWorkspaceId, cloudMode, slugPrefix, slugSuffix }: Props) {
  const t = useTranslations('workspaces')
  const locale = useLocale()
  const [restoreTarget, setRestoreTarget] = useState<Workspace | null>(null)
  const [switching, setSwitching] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const now = Date.now()
  const restorable = deleted.filter((w) => {
    const elapsed = now - new Date(w.deletedAt!).getTime()
    return elapsed <= RESTORE_WINDOW_MS
  })
  const expired = deleted.filter((w) => {
    const elapsed = now - new Date(w.deletedAt!).getTime()
    return elapsed > RESTORE_WINDOW_MS
  })

  function daysRemaining(deletedAt: string): number {
    const elapsed = now - new Date(deletedAt).getTime()
    return Math.max(0, Math.ceil((RESTORE_WINDOW_MS - elapsed) / (24 * 60 * 60 * 1000)))
  }

  async function switchWorkspace(targetId: string) {
    if (targetId === currentWorkspaceId) return
    setSwitching(targetId)
    try {
      const res = await fetch('/api/workspaces/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: targetId }),
      })
      if (res.ok) {
        window.location.assign(`/${locale}`)
      }
    } catch {
      // Network error
    } finally {
      setSwitching(null)
    }
  }

  function handleRestoreSuccess() {
    setRestoreTarget(null)
    window.location.assign(`/${locale}`)
  }

  if (active.length === 0 && restorable.length === 0 && expired.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-4xl mb-3">🏢</p>
        <p className="font-medium text-foreground mb-1">{t('emptyTitle')}</p>
        <p className="text-muted-foreground text-sm mb-6">{t('emptyDescription')}</p>
        <Button onClick={() => setShowCreateModal(true)}>
          {t('createWorkspace')}
        </Button>
      </Card>
    )
  }

  return (
    <>
      <div className="flex justify-end mb-6">
        <Button onClick={() => setShowCreateModal(true)}>
          {t('createWorkspace')}
        </Button>
      </div>

      {active.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">{t('activeSection')}</h2>
          <div className="grid gap-3">
            {active.map((ws) => (
              <Card
                key={ws.id}
                className="p-5 flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-lg bg-muted border flex items-center justify-center text-lg shrink-0">
                  {ws.name[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground truncate">{ws.name}</p>
                    {ws.id === currentWorkspaceId && (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                        {t('current')}
                      </Badge>
                    )}
                    <Badge variant="secondary">
                      {ws.role}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{ws.slug}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {ws.id !== currentWorkspaceId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => switchWorkspace(ws.id)}
                      disabled={switching === ws.id}
                      className="text-xs"
                    >
                      {switching === ws.id ? '…' : t('switch')}
                    </Button>
                  )}
                  {ws.id === currentWorkspaceId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.location.assign(`/${locale}/settings`)}
                      className="text-xs"
                    >
                      {t('settings')}
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {restorable.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">{t('deletedSection')}</h2>
          <div className="grid gap-3">
            {restorable.map((ws) => (
              <Card
                key={ws.id}
                className="p-5 flex items-center gap-4 bg-muted"
              >
                <div className="w-10 h-10 rounded-lg bg-muted-foreground/10 flex items-center justify-center text-lg shrink-0 opacity-60">
                  {ws.name[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground/70 truncate">{ws.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('daysRemaining', { days: daysRemaining(ws.deletedAt!) })}
                  </p>
                </div>
                <div className="shrink-0">
                  {ws.role === 'OWNER' ? (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setRestoreTarget(ws)}
                      className="text-xs"
                    >
                      {t('restore')}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">{t('contactOwner')}</span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {expired.length > 0 && (
        <section>
          <div className="grid gap-3">
            {expired.map((ws) => (
              <Card
                key={ws.id}
                className="p-5 flex items-center gap-4 opacity-50 bg-muted"
              >
                <div className="w-10 h-10 rounded-lg bg-muted-foreground/10 flex items-center justify-center text-lg shrink-0">
                  {ws.name[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground/50 truncate">{ws.name}</p>
                  <p className="text-xs text-muted-foreground">{t('expired')}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {restoreTarget && (
        <RestoreModal
          workspace={restoreTarget}
          cloudMode={cloudMode}
          onClose={() => setRestoreTarget(null)}
          onSuccess={handleRestoreSuccess}
        />
      )}

      {showCreateModal && (
        <CreateWorkspaceModal
          slugPrefix={slugPrefix}
          slugSuffix={slugSuffix}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </>
  )
}
