'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

interface Props {
  name: string
  demoMode: boolean
}

export function ProfileForm({ name: initialName, demoMode }: Props) {
  const t = useTranslations('profile')
  const tc = useTranslations('common')
  const [name, setName] = useState(initialName)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setErrorMessage('')

    const changingPassword = newPassword.length > 0 || confirmPassword.length > 0

    if (changingPassword) {
      if (newPassword.length < 12) {
        setErrorMessage(t('passwordMinLength'))
        return
      }
      if (newPassword !== confirmPassword) {
        setErrorMessage(t('passwordsMismatch'))
        return
      }
    }

    const body: Record<string, string> = {}
    if (name.trim() !== initialName) body.name = name.trim()
    if (changingPassword) {
      if (currentPassword) body.currentPassword = currentPassword
      body.newPassword = newPassword
    }

    if (Object.keys(body).length === 0) {
      setErrorMessage(t('noChanges'))
      return
    }

    setStatus('saving')

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setErrorMessage(data.error ?? t('saveFailed'))
        setStatus('error')
        return
      }

      setStatus('saved')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setStatus('idle'), 2000)
    } catch {
      setErrorMessage(tc('networkError'))
      setStatus('error')
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-ink mb-1">{t('name')}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={demoMode}
          className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white text-ink focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
          placeholder={t('namePlaceholder')}
        />
      </div>

      {demoMode ? (
        <div className="pt-2 border-t border-border">
          <p className="text-sm text-muted">{t('demoDisabled')}</p>
        </div>
      ) : (
        <div className="pt-2 border-t border-border">
          <p className="text-sm font-medium text-ink mb-3">{t('changePassword')}</p>
          <div className="space-y-3">
            <div suppressHydrationWarning>
              <label className="block text-sm text-ink mb-1">{t('currentPassword')}</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder={t('currentPasswordPlaceholder')}
              />
            </div>
            <div suppressHydrationWarning>
              <label className="block text-sm text-ink mb-1">{t('newPassword')}</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder={t('newPasswordPlaceholder')}
              />
            </div>
            <div suppressHydrationWarning>
              <label className="block text-sm text-ink mb-1">{t('confirmNewPassword')}</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder={t('confirmNewPasswordPlaceholder')}
              />
            </div>
          </div>
        </div>
      )}

      {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}

      {!demoMode && (
        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={status === 'saving'}
            className="bg-ink text-cream px-4 py-2 rounded-lg text-sm hover:bg-ink/90 transition-colors disabled:opacity-50"
          >
            {status === 'saving' ? tc('saving') : t('saveChanges')}
          </button>
          {status === 'saved' && <span className="text-sm text-green">{t('saved')}</span>}
          {status === 'error' && !errorMessage && (
            <span className="text-sm text-red-500">{t('saveFailed')}</span>
          )}
        </div>
      )}
    </form>
  )
}
