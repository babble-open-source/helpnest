'use client'

import type { ChangeEvent } from 'react'
import { useRouter, Link } from '@/i18n/navigation'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import NextImage from 'next/image'
import { normalizeAssetUrl, looksLikeFaviconAsset } from '@/lib/workspace-utils'

interface Props {
  name: string
  slug: string
  customDomain: string
  logo: string
  brandText: string
  customBrandFontFamily: string
  customBrandFontUrl: string
  favicon: string
  metaTitle: string
  metaDescription: string
  appUrl: string
  helpCenterDomain: string
  cloudMode?: boolean
  planTier?: string
  cnameTarget?: string
  demoMode?: boolean
  isOwner?: boolean
  workspaceId?: string
}

export function WorkspaceForm({
  name,
  slug,
  customDomain,
  logo,
  brandText,
  customBrandFontFamily,
  customBrandFontUrl,
  favicon,
  metaTitle,
  metaDescription,
  appUrl,
  helpCenterDomain,
  cloudMode = false,
  planTier = 'FREE',
  cnameTarget = '',
  demoMode = false,
  isOwner = false,
  workspaceId = '',
}: Props) {
  const router = useRouter()
  const t = useTranslations('workspace')
  const tc = useTranslations('common')
  const [values, setValues] = useState({
    name,
    slug,
    customDomain,
    logo,
    brandText,
    customBrandFontFamily,
    customBrandFontUrl,
    favicon,
    metaTitle,
    metaDescription,
  })
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const normalizedLogo = normalizeAssetUrl(values.logo)
  const normalizedFavicon = normalizeAssetUrl(values.favicon)
  const logoLooksLikeFavicon = normalizedLogo.length > 0 && looksLikeFaviconAsset(normalizedLogo)
  const logoMatchesFavicon =
    normalizedLogo.length > 0 &&
    normalizedFavicon.length > 0 &&
    normalizedLogo === normalizedFavicon
  const logoWarning = logoLooksLikeFavicon
    ? t('logoFaviconWarning')
    : logoMatchesFavicon
      ? t('logoMatchesFavicon')
      : null
  const previewBrandText = values.brandText.trim() || values.name.trim() || 'Brand'
  const [dnsStatus, setDnsStatus] = useState<'idle' | 'checking' | 'registering' | 'active' | 'pending' | 'not_registered' | 'error'>('idle')
  const [dnsMessage, setDnsMessage] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')
  const [deleting, setDeleting] = useState(false)

  async function registerDomain() {
    if (!values.customDomain.trim()) return
    setDnsStatus('registering')
    setDnsMessage('')
    try {
      const res = await fetch('/api/domains/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: values.customDomain.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setDnsStatus('error')
        setDnsMessage(data.error ?? t('dnsCheckFailed'))
        return
      }
      setDnsStatus(data.status === 'active' ? 'active' : 'pending')
      setDnsMessage(data.status === 'active' ? t('dnsActiveMessage') : t('dnsPendingMessage'))
    } catch {
      setDnsStatus('error')
      setDnsMessage(t('dnsCheckFailed'))
    }
  }

  async function verifyDns() {
    if (!values.customDomain.trim()) return
    setDnsStatus('checking')
    setDnsMessage('')
    try {
      const res = await fetch('/api/domains/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: values.customDomain.trim() }),
      })
      const data = await res.json()
      setDnsStatus(data.status ?? 'error')
      setDnsMessage(data.message ?? '')
    } catch {
      setDnsStatus('error')
      setDnsMessage(t('dnsCheckFailed'))
    }
  }

  async function handleRemove() {
    if (!confirm('Are you sure you want to remove your custom domain? It will stop working immediately.')) return
    setStatus('saving')
    try {
      const res = await fetch('/api/domains/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: values.customDomain.trim() }),
      })
      if (res.ok) {
        setDnsStatus('idle')
        setDnsMessage('')
        setValues((prev) => ({ ...prev, customDomain: '' }))
        router.refresh()
      }
    } catch {
      // ignore
    } finally {
      setStatus('idle')
    }
  }

  async function handleDeleteWorkspace() {
    if (!workspaceId) return
    setDeleting(true)
    try {
      const res = await fetch('/api/workspaces/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, confirmName: deleteConfirmName }),
      })
      if (res.ok) {
        router.push('/onboarding')
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to delete workspace')
      }
    } catch {
      alert('Failed to delete workspace')
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    const trimmedBrandFontUrl = values.customBrandFontUrl.trim()
    if (trimmedBrandFontUrl.length === 0) return

    const existing = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).find(
      (link) => (link as HTMLLinkElement).href === trimmedBrandFontUrl
    )
    if (existing) return

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = trimmedBrandFontUrl
    document.head.appendChild(link)
  }, [values.customBrandFontUrl])

  function set(field: keyof typeof values) {
    return (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((v) => ({ ...v, [field]: e.target.value }))
  }

  async function save() {
    setStatus('saving')
    const res = await fetch('/api/workspace/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    setStatus(res.ok ? 'saved' : 'error')
    if (res.ok) {
      router.refresh()
      setTimeout(() => setStatus('idle'), 2000)
    }
  }

  const inputClass = `w-full px-3 py-2 border border-border rounded-lg text-sm bg-white text-ink focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed`

  return (
    <div className="space-y-4">
      {demoMode && (
        <p className="text-sm text-muted">{t('demoDisabled')}</p>
      )}
      <div>
        <label className="block text-sm font-medium text-ink mb-1">{t('name')}</label>
        <input
          value={values.name}
          onChange={set('name')}
          disabled={demoMode}
          className={inputClass}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-ink mb-1">{t('slug')}</label>
        <div className={`flex items-center border border-border rounded-lg overflow-hidden${demoMode ? ' opacity-60' : ''}`}>
          {!helpCenterDomain && (
            <span className="px-3 py-2 bg-cream text-muted text-sm border-e border-border shrink-0">
              {appUrl.replace(/^https?:\/\//, '')}/
            </span>
          )}
          <input
            value={values.slug}
            onChange={set('slug')}
            readOnly={demoMode}
            className={`flex-1 px-3 py-2 text-sm bg-white text-ink focus:outline-none${demoMode ? ' cursor-not-allowed select-none' : ''}`}
          />
          {helpCenterDomain && (
            <span className="px-3 py-2 bg-cream text-muted text-sm border-s border-border shrink-0">
              .{helpCenterDomain}
            </span>
          )}
        </div>
      </div>
      {/* Custom Domain — cloud: paid feature, self-hosted: hidden (use env vars) */}
      {cloudMode && (
        <div>
          <label className="block text-sm font-medium text-ink mb-1">
            {t('customDomain')}
            {planTier === 'FREE' && (
              <span className="ms-2 text-xs font-normal text-muted bg-border px-1.5 py-0.5 rounded">PRO</span>
            )}
          </label>

          {planTier === 'FREE' ? (
            /* Locked state for FREE users */
            <div className="rounded-lg border border-border bg-cream/50 p-5 text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-border mb-3">
                <svg className="w-5 h-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-ink mb-1">{t('customDomainLocked')}</p>
              <p className="text-xs text-muted mb-3">{t('customDomainLockedDesc')}</p>
              <Link
                href="/dashboard/billing"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
              >
                {t('upgradeToPro')}
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          ) : (
            /* Full domain UI for PRO/BUSINESS */
            <>
              <input
                value={values.customDomain}
                onChange={set('customDomain')}
                placeholder={t('customDomainPlaceholder')}
                disabled={demoMode}
                className={inputClass + ' placeholder:text-muted'}
              />
              <p className="mt-1 text-xs text-muted">
                {t('customDomainHelp')}
              </p>
              {values.customDomain.trim().length > 0 && (
                <div className="mt-3 rounded-lg border border-border bg-cream p-4 text-sm space-y-3">
                  <div className="flex items-center justify-between min-h-[24px]">
                    <p className="font-medium text-ink">{t('dnsSetup')}</p>
                    {dnsStatus === 'active' ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green/10 text-green border border-green/20">
                        {t('dnsActive')}
                      </span>
                    ) : dnsStatus === 'pending' ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                        {t('dnsPending')}
                      </span>
                    ) : dnsStatus === 'error' ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-200">
                        {t('dnsError')}
                      </span>
                    ) : null}
                  </div>

                  <p className="text-xs text-muted">{t('dnsSteps')}</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-muted">
                          <th className="pb-2 pe-4 font-medium">{t('dnsType')}</th>
                          <th className="pb-2 pe-4 font-medium">{t('dnsName')}</th>
                          <th className="pb-2 pe-4 font-medium">{t('dnsValue')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="py-1.5 pe-4 font-mono text-ink">CNAME</td>
                          <td className="py-1.5 pe-4 font-mono text-ink">{values.customDomain.trim()}</td>
                          <td className="py-1.5 pe-4 font-mono text-accent select-all">{cnameTarget || 'proxy.helpnest.cloud'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 min-h-[30px]">
                    {dnsStatus === 'idle' || dnsStatus === 'not_registered' ? (
                      <button
                        type="button"
                        onClick={registerDomain}
                        className="text-xs font-medium bg-ink text-cream px-3 py-1.5 rounded-lg hover:bg-ink/90 transition-colors disabled:opacity-50 shrink-0"
                      >
                        {t('dnsRegister')}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={verifyDns}
                          disabled={dnsStatus === 'checking' || dnsStatus === 'registering'}
                          className="text-xs font-medium border border-border text-ink px-3 py-1.5 rounded-lg hover:bg-white transition-colors disabled:opacity-50 shrink-0"
                        >
                          {dnsStatus === 'checking' ? t('dnsChecking') : t('dnsVerify')}
                        </button>
                        <button
                          type="button"
                          onClick={handleRemove}
                          disabled={status === 'saving'}
                          className="text-xs font-medium px-3 py-1.5 rounded-md border border-red-200 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          Remove domain
                        </button>
                      </>
                    )}
                  </div>

                  <div className="min-h-[16px]">
                    {dnsMessage && (
                      <p className={`text-xs ${
                        dnsStatus === 'active' ? 'text-green'
                        : dnsStatus === 'error' ? 'text-red-500'
                        : 'text-muted'
                      }`}>
                        {dnsMessage}
                      </p>
                    )}
                  </div>

                  <p className={`text-xs text-muted ${dnsStatus === 'active' ? 'invisible' : ''}`}>
                    {t('dnsNote')}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-ink mb-1">{t('companyLogo')}</label>
        <input
          value={values.logo}
          onChange={set('logo')}
          placeholder={t('logoPlaceholder')}
          disabled={demoMode}
          className={inputClass + ' placeholder:text-muted'}
        />
        <p className="mt-1 text-xs text-muted">
          {t('logoHelp')}
        </p>
        {logoWarning && (
          <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {logoWarning}
          </div>
        )}
        {values.logo.trim().length > 0 && (
          <div className="mt-3 inline-flex items-center gap-3 rounded-xl border border-border bg-cream px-3 py-2">
            <div className="relative flex h-12 min-w-[3rem] max-w-[12rem] items-center justify-start overflow-hidden rounded-lg border border-border bg-white px-2 py-1.5">
              <NextImage
                src={values.logo.trim()}
                alt={`${values.name} logo preview`}
                fill
                unoptimized
                className="object-contain object-left"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-ink">{t('logoPreview')}</p>
              <p className="text-xs text-muted">
                {t('logoPreviewHelp')}
              </p>
            </div>
          </div>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-ink mb-1">{t('brandWordmark')}</label>
        <input
          value={values.brandText}
          onChange={set('brandText')}
          placeholder={values.name || 'Acme'}
          disabled={demoMode}
          className={inputClass + ' placeholder:text-muted'}
        />
        <p className="mt-1 text-xs text-muted">
          {t('brandWordmarkHelp')}
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-ink mb-1">{t('brandFontFamily')}</label>
        <input
          value={values.customBrandFontFamily}
          onChange={set('customBrandFontFamily')}
          placeholder="Sohne, DM Sans, Avenir Next"
          disabled={demoMode}
          className={inputClass + ' placeholder:text-muted'}
        />
        <p className="mt-1 text-xs text-muted">
          {t('brandFontFamilyHelp')}
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-ink mb-1">{t('brandFontUrl')}</label>
        <input
          value={values.customBrandFontUrl}
          onChange={set('customBrandFontUrl')}
          placeholder="https://fonts.googleapis.com/css2?family=Your+Brand+Font"
          disabled={demoMode}
          className={inputClass + ' placeholder:text-muted'}
        />
        <p className="mt-1 text-xs text-muted">
          {t('brandFontUrlHelp')}
        </p>
        {(values.brandText.trim().length > 0 || values.customBrandFontFamily.trim().length > 0) && (
          <div className="mt-3 inline-flex items-center gap-3 rounded-xl border border-border bg-cream px-3 py-2">
            <div className="rounded-lg border border-border bg-white px-4 py-2">
              <span
                className="block text-2xl text-ink"
                style={
                  values.customBrandFontFamily.trim().length > 0
                    ? { fontFamily: values.customBrandFontFamily.trim() }
                    : undefined
                }
              >
                {previewBrandText}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-ink">{t('wordmarkPreview')}</p>
              <p className="text-xs text-muted">
                {t('wordmarkPreviewHelp')}
              </p>
            </div>
          </div>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-ink mb-1">{t('favicon')}</label>
        <input
          value={values.favicon}
          onChange={set('favicon')}
          placeholder={t('faviconPlaceholder')}
          disabled={demoMode}
          className={inputClass + ' placeholder:text-muted'}
        />
        <p className="mt-1 text-xs text-muted">
          {t('faviconHelp')}
        </p>
        {values.favicon.trim().length > 0 && (
          <div className="mt-3 inline-flex items-center gap-3 rounded-xl border border-border bg-cream px-3 py-2">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-border bg-white p-1">
              <NextImage
                src={values.favicon.trim()}
                alt={`${values.name} favicon preview`}
                width={32}
                height={32}
                unoptimized
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-ink">{t('faviconPreview')}</p>
              <p className="text-xs text-muted">{t('faviconPreviewHelp')}</p>
            </div>
          </div>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-ink mb-1">{t('metaTitle')}</label>
        <input
          value={values.metaTitle}
          onChange={set('metaTitle')}
          placeholder={t('metaTitlePlaceholder', { name: values.name })}
          disabled={demoMode}
          className={inputClass + ' placeholder:text-muted'}
        />
        <p className="mt-1 text-xs text-muted">{t('metaTitleHelp')}</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-ink mb-1">{t('metaDescription')}</label>
        <textarea
          value={values.metaDescription}
          onChange={set('metaDescription')}
          placeholder={t('metaDescriptionPlaceholder', { name: values.name })}
          rows={4}
          disabled={demoMode}
          className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent resize-y disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <p className="mt-1 text-xs text-muted">
          {t('metaDescriptionHelp')}
        </p>
      </div>

      {!demoMode && (
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={save}
            disabled={status === 'saving'}
            className="bg-ink text-cream px-4 py-2 rounded-lg text-sm hover:bg-ink/90 transition-colors disabled:opacity-50"
          >
            {status === 'saving' ? tc('saving') : t('saveChanges')}
          </button>
          {status === 'saved' && <span className="text-sm text-green">{t('saved')}</span>}
          {status === 'error' && <span className="text-sm text-red-500">{t('saveFailed')}</span>}
        </div>
      )}

      <div className="pt-3 border-t border-border">
        <p className="text-xs text-muted mb-0.5">{t('helpCenterUrl')}</p>
        <a
          href={helpCenterDomain ? `https://${values.slug}.${helpCenterDomain}` : `${appUrl}/${values.slug}/help`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-mono text-accent hover:underline break-all"
        >
          {helpCenterDomain ? `${values.slug}.${helpCenterDomain}` : `${appUrl}/${values.slug}/help`}
        </a>
      </div>

      {isOwner && !demoMode && (
        <div className="mt-10 pt-6 border-t border-red-200">
          <h3 className="text-sm font-medium text-red-600 mb-1">Danger zone</h3>
          <p className="text-xs text-muted mb-3">
            Deleting a workspace removes all articles, collections, conversations, and members.
            You have 30 days to restore it before data is permanently deleted.
          </p>
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="text-xs font-medium px-3 py-1.5 rounded-md border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
          >
            Delete workspace
          </button>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40">
          <div className="bg-white rounded-xl border border-border shadow-lg p-6 max-w-md mx-4">
            <h3 className="font-serif text-lg text-ink mb-2">Delete workspace</h3>
            <p className="text-sm text-muted mb-4">
              This will soft-delete <span className="font-medium text-ink">{values.name}</span>.
              All content will be inaccessible. You have 30 days to restore it.
            </p>
            <p className="text-sm text-muted mb-2">
              Type <span className="font-medium text-ink">{values.name}</span> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder={values.name}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg mb-4 focus:outline-none focus:ring-1 focus:ring-red-300"
            />
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => { setShowDeleteModal(false); setDeleteConfirmName('') }}
                className="text-sm font-medium px-4 py-2 rounded-lg border border-border text-ink hover:bg-cream transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteWorkspace}
                disabled={deleting || deleteConfirmName.toLowerCase() !== values.name.toLowerCase()}
                className="text-sm font-medium px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting\u2026' : 'Delete workspace'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
