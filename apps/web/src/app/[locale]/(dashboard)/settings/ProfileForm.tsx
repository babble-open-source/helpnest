'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

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
      <div className="space-y-1.5">
        <Label htmlFor="profile-name">{t('name')}</Label>
        <Input
          id="profile-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={demoMode}
          placeholder={t('namePlaceholder')}
        />
      </div>

      {demoMode ? (
        <div className="pt-2">
          <Separator className="mb-3" />
          <p className="text-sm text-muted-foreground">{t('demoDisabled')}</p>
        </div>
      ) : (
        <div className="pt-2">
          <Separator className="mb-3" />
          <p className="text-sm font-medium text-foreground mb-3">{t('changePassword')}</p>
          <div className="space-y-3">
            <div suppressHydrationWarning className="space-y-1.5">
              <Label htmlFor="profile-current-password">{t('currentPassword')}</Label>
              <Input
                id="profile-current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                placeholder={t('currentPasswordPlaceholder')}
              />
            </div>
            <div suppressHydrationWarning className="space-y-1.5">
              <Label htmlFor="profile-new-password">{t('newPassword')}</Label>
              <Input
                id="profile-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                placeholder={t('newPasswordPlaceholder')}
              />
            </div>
            <div suppressHydrationWarning className="space-y-1.5">
              <Label htmlFor="profile-confirm-password">{t('confirmNewPassword')}</Label>
              <Input
                id="profile-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                placeholder={t('confirmNewPasswordPlaceholder')}
              />
            </div>
          </div>
        </div>
      )}

      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

      {!demoMode && (
        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" disabled={status === 'saving'}>
            {status === 'saving' ? tc('saving') : t('saveChanges')}
          </Button>
          {status === 'saved' && <span className="text-sm text-emerald-600 dark:text-emerald-400">{t('saved')}</span>}
          {status === 'error' && !errorMessage && (
            <span className="text-sm text-destructive">{t('saveFailed')}</span>
          )}
        </div>
      )}
    </form>
  )
}
