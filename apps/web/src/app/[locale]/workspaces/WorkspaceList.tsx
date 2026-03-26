'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { RestoreModal } from './RestoreModal'

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
}

const RESTORE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

export function WorkspaceList({ active, deleted, currentWorkspaceId, cloudMode }: Props) {
  const t = useTranslations('workspaces')
  const locale = useLocale()
  const router = useRouter()
  const [restoreTarget, setRestoreTarget] = useState<Workspace | null>(null)
  const [switching, setSwitching] = useState<string | null>(null)

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
        window.location.assign(`/${locale}/dashboard`)
      }
    } catch {
      // Network error
    } finally {
      setSwitching(null)
    }
  }

  function handleRestoreSuccess() {
    setRestoreTarget(null)
    window.location.assign(`/${locale}/dashboard`)
  }

  if (active.length === 0 && restorable.length === 0 && expired.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-border p-12 text-center">
        <p className="text-4xl mb-3">🏢</p>
        <p className="font-medium text-ink mb-1">{t('emptyTitle')}</p>
        <p className="text-muted text-sm mb-6">{t('emptyDescription')}</p>
        <button
          onClick={() => window.location.assign(`/${locale}/onboarding`)}
          className="bg-ink text-cream px-4 py-2 rounded-lg text-sm hover:bg-ink/90 transition-colors font-medium"
        >
          {t('createWorkspace')}
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="flex justify-end mb-6">
        <button
          onClick={() => window.location.assign(`/${locale}/onboarding`)}
          className="bg-ink text-cream px-4 py-2 rounded-lg text-sm hover:bg-ink/90 transition-colors font-medium"
        >
          {t('createWorkspace')}
        </button>
      </div>

      {active.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xs font-medium text-muted uppercase tracking-wide mb-3">{t('activeSection')}</h2>
          <div className="grid gap-3">
            {active.map((ws) => (
              <div
                key={ws.id}
                className="bg-white rounded-xl border border-border p-5 flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-lg bg-cream border border-border flex items-center justify-center text-lg shrink-0">
                  {ws.name[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-ink truncate">{ws.name}</p>
                    {ws.id === currentWorkspaceId && (
                      <span className="rounded-full bg-green/10 text-green border border-green/20 px-2 py-0.5 text-[11px] font-medium">
                        {t('current')}
                      </span>
                    )}
                    <span className="rounded-full bg-cream border border-border px-2 py-0.5 text-[11px] text-muted">
                      {ws.role}
                    </span>
                  </div>
                  <p className="text-sm text-muted truncate">{ws.slug}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {ws.id !== currentWorkspaceId && (
                    <button
                      onClick={() => switchWorkspace(ws.id)}
                      disabled={switching === ws.id}
                      className="text-xs font-medium text-muted hover:text-accent transition-colors disabled:opacity-50"
                    >
                      {switching === ws.id ? '…' : t('switch')}
                    </button>
                  )}
                  {ws.id === currentWorkspaceId && (
                    <button
                      onClick={() => window.location.assign(`/${locale}/dashboard/settings`)}
                      className="text-xs font-medium text-muted hover:text-accent transition-colors"
                    >
                      {t('settings')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {restorable.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xs font-medium text-muted uppercase tracking-wide mb-3">{t('deletedSection')}</h2>
          <div className="grid gap-3">
            {restorable.map((ws) => (
              <div
                key={ws.id}
                className="bg-stone-50 rounded-xl border border-border/80 p-5 flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-lg bg-border/50 flex items-center justify-center text-lg shrink-0 opacity-60">
                  {ws.name[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-ink/70 truncate">{ws.name}</p>
                  <p className="text-xs text-muted">
                    {t('daysRemaining', { days: daysRemaining(ws.deletedAt!) })}
                  </p>
                </div>
                <div className="shrink-0">
                  {ws.role === 'OWNER' ? (
                    <button
                      onClick={() => setRestoreTarget(ws)}
                      className="text-xs font-medium text-accent hover:text-accent/80 transition-colors"
                    >
                      {t('restore')}
                    </button>
                  ) : (
                    <span className="text-xs text-muted">{t('contactOwner')}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {expired.length > 0 && (
        <section>
          <div className="grid gap-3">
            {expired.map((ws) => (
              <div
                key={ws.id}
                className="bg-stone-50 rounded-xl border border-border/60 p-5 flex items-center gap-4 opacity-50"
              >
                <div className="w-10 h-10 rounded-lg bg-border/30 flex items-center justify-center text-lg shrink-0">
                  {ws.name[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-ink/50 truncate">{ws.name}</p>
                  <p className="text-xs text-muted">{t('expired')}</p>
                </div>
              </div>
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
    </>
  )
}
