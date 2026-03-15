'use client'

import { useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'

interface Props {
  token: string
  email: string
}

export function AcceptForm({ token, email }: Props) {
  const router = useRouter()
  const t = useTranslations('invite')
  const tAuth = useTranslations('auth')
  const tCommon = useTranslations('common')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError(t('passwordMinLength'))
      return
    }

    if (password !== confirmPassword) {
      setError(t('passwordsMismatch'))
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch(`/api/invites/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), password }),
      })

      if (!res.ok) {
        const body = await res.json() as { error?: string }
        setError(body.error ?? tCommon('somethingWentWrong'))
        return
      }

      router.push('/login')
    } catch {
      setError(tCommon('networkError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-ink mb-1">{tAuth('email')}</label>
        <input
          type="email"
          value={email}
          disabled
          className="w-full px-3 py-2 border border-border rounded-lg bg-cream text-muted text-sm cursor-not-allowed"
        />
      </div>
      <div suppressHydrationWarning>
        <label className="block text-sm font-medium text-ink mb-1">{t('yourName')}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="name"
          className="w-full px-3 py-2 border border-border rounded-lg bg-white text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent text-sm"
          placeholder={t('namePlaceholder')}
        />
      </div>
      <div suppressHydrationWarning>
        <label className="block text-sm font-medium text-ink mb-1">{tAuth('password')}</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          minLength={8}
          className="w-full px-3 py-2 border border-border rounded-lg bg-white text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent text-sm"
          placeholder={t('atLeast8Chars')}
        />
      </div>
      <div suppressHydrationWarning>
        <label className="block text-sm font-medium text-ink mb-1">{t('confirmPassword')}</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
          className="w-full px-3 py-2 border border-border rounded-lg bg-white text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent text-sm"
          placeholder={t('repeatPassword')}
        />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-ink text-cream py-2 px-4 rounded-lg hover:bg-ink/90 transition-colors font-medium text-sm disabled:opacity-60"
      >
        {submitting ? t('creatingAccount') : t('acceptInvitation')}
      </button>
    </form>
  )
}
