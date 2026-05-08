'use client'

import type { ChangeEvent } from 'react'
import { useRouter, Link } from '@/i18n/navigation'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import NextImage from 'next/image'
import { normalizeAssetUrl, looksLikeFaviconAsset } from '@/lib/workspace-utils'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { isAllowedFontUrl } from '@/lib/font-url'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

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
  const [deleteError, setDeleteError] = useState('')
  const [showRemoveDomainConfirm, setShowRemoveDomainConfirm] = useState(false)

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
    setShowRemoveDomainConfirm(false)
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
      } else {
        const data = await res.json().catch(() => ({})) as { error?: string }
        setDnsStatus('error')
        setDnsMessage(data.error ?? t('dnsCheckFailed'))
      }
    } catch {
      setDnsStatus('error')
      setDnsMessage(t('dnsCheckFailed'))
    } finally {
      setStatus('idle')
    }
  }

  async function handleDeleteWorkspace() {
    if (!workspaceId) return
    setDeleting(true)
    setDeleteError('')
    try {
      const res = await fetch('/api/workspaces/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, confirmName: deleteConfirmName }),
      })
      if (res.ok) {
        router.push('/dashboard')
      } else {
        const data = await res.json()
        setDeleteError(data.error || 'Failed to delete workspace')
      }
    } catch {
      setDeleteError('Failed to delete workspace')
    } finally {
      setDeleting(false)
    }
  }

  const brandFontUrlInvalid = values.customBrandFontUrl.trim().length > 0 && !isAllowedFontUrl(values.customBrandFontUrl)

  useEffect(() => {
    const trimmedBrandFontUrl = values.customBrandFontUrl.trim()
    if (trimmedBrandFontUrl.length === 0) return
    if (!isAllowedFontUrl(trimmedBrandFontUrl)) return

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

  return (
    <div className="space-y-4">
      {demoMode && (
        <p className="text-sm text-muted-foreground">{t('demoDisabled')}</p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="ws-name">{t('name')}</Label>
        <Input id="ws-name" value={values.name} onChange={set('name')} disabled={demoMode} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ws-slug">{t('slug')}</Label>
        <div className={`flex items-center border border-input rounded-md overflow-hidden${demoMode ? ' opacity-60' : ''}`}>
          {!helpCenterDomain && (
            <span className="px-3 py-2 bg-muted text-muted-foreground text-sm border-e border-input shrink-0">
              {appUrl.replace(/^https?:\/\//, '')}/
            </span>
          )}
          <input
            id="ws-slug"
            value={values.slug}
            onChange={set('slug')}
            readOnly={demoMode}
            className={`flex-1 px-3 py-2 text-sm bg-background text-foreground focus:outline-none${demoMode ? ' cursor-not-allowed select-none' : ''}`}
          />
          {helpCenterDomain && (
            <span className="px-3 py-2 bg-muted text-muted-foreground text-sm border-s border-input shrink-0">
              .{helpCenterDomain}
            </span>
          )}
        </div>
      </div>
      {/* Custom Domain — cloud: paid feature, self-hosted: hidden (use env vars) */}
      {cloudMode && (
        <div className="space-y-1.5">
          <Label htmlFor="ws-custom-domain">
            {t('customDomain')}
            {planTier === 'FREE' && (
              <span className="ms-2 text-xs font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">PRO</span>
            )}
          </Label>

          {planTier === 'FREE' ? (
            /* Locked state for FREE users */
            <div className="rounded-lg border bg-muted/50 p-5 text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-muted mb-3">
                <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-foreground mb-1">{t('customDomainLocked')}</p>
              <p className="text-xs text-muted-foreground mb-3">{t('customDomainLockedDesc')}</p>
              <Link
                href="/dashboard/billing"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
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
              <Input
                id="ws-custom-domain"
                value={values.customDomain}
                onChange={set('customDomain')}
                placeholder={t('customDomainPlaceholder')}
                disabled={demoMode}
              />
              <p className="text-xs text-muted-foreground">
                {t('customDomainHelp')}
              </p>
              {values.customDomain.trim().length > 0 && (
                <div className="mt-3 rounded-lg border bg-muted p-4 text-sm space-y-3">
                  <div className="flex items-center justify-between min-h-[24px]">
                    <p className="font-medium text-foreground">{t('dnsSetup')}</p>
                    {dnsStatus === 'active' ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800">
                        {t('dnsActive')}
                      </span>
                    ) : dnsStatus === 'pending' ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                        {t('dnsPending')}
                      </span>
                    ) : dnsStatus === 'error' ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                        {t('dnsError')}
                      </span>
                    ) : null}
                  </div>

                  <p className="text-xs text-muted-foreground">{t('dnsSteps')}</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-muted-foreground">
                          <th className="pb-2 pe-4 font-medium">{t('dnsType')}</th>
                          <th className="pb-2 pe-4 font-medium">{t('dnsName')}</th>
                          <th className="pb-2 pe-4 font-medium">{t('dnsValue')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="py-1.5 pe-4 font-mono text-foreground">CNAME</td>
                          <td className="py-1.5 pe-4 font-mono text-foreground">{values.customDomain.trim()}</td>
                          <td className="py-1.5 pe-4 font-mono text-primary select-all">{cnameTarget || 'proxy.helpnest.cloud'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 min-h-[30px]">
                    {dnsStatus === 'idle' || dnsStatus === 'not_registered' ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={registerDomain}
                      >
                        {t('dnsRegister')}
                      </Button>
                    ) : (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={verifyDns}
                          disabled={dnsStatus === 'checking' || dnsStatus === 'registering'}
                        >
                          {dnsStatus === 'checking' ? t('dnsChecking') : t('dnsVerify')}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowRemoveDomainConfirm(true)}
                          disabled={status === 'saving'}
                          className="border-destructive/40 text-destructive hover:bg-destructive/10"
                        >
                          Remove domain
                        </Button>
                      </>
                    )}
                  </div>

                  <div className="min-h-[16px]">
                    {dnsMessage && (
                      <p className={`text-xs ${
                        dnsStatus === 'active' ? 'text-emerald-600 dark:text-emerald-400'
                        : dnsStatus === 'error' ? 'text-destructive'
                        : 'text-muted-foreground'
                      }`}>
                        {dnsMessage}
                      </p>
                    )}
                  </div>

                  <p className={`text-xs text-muted-foreground ${dnsStatus === 'active' ? 'invisible' : ''}`}>
                    {t('dnsNote')}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="ws-logo">{t('companyLogo')}</Label>
        <Input
          id="ws-logo"
          value={values.logo}
          onChange={set('logo')}
          placeholder={t('logoPlaceholder')}
          disabled={demoMode}
        />
        <p className="text-xs text-muted-foreground">{t('logoHelp')}</p>
        {logoWarning && (
          <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {logoWarning}
          </div>
        )}
        {values.logo.trim().length > 0 && (
          <div className="mt-3 inline-flex items-center gap-3 rounded-xl border bg-muted px-3 py-2">
            <div className="relative flex h-12 min-w-[3rem] max-w-[12rem] items-center justify-start overflow-hidden rounded-lg border bg-card px-2 py-1.5">
              <NextImage
                src={values.logo.trim()}
                alt={`${values.name} logo preview`}
                fill
                unoptimized
                className="object-contain object-left"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{t('logoPreview')}</p>
              <p className="text-xs text-muted-foreground">{t('logoPreviewHelp')}</p>
            </div>
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ws-brand-text">{t('brandWordmark')}</Label>
        <Input
          id="ws-brand-text"
          value={values.brandText}
          onChange={set('brandText')}
          placeholder={values.name || 'Acme'}
          disabled={demoMode}
        />
        <p className="text-xs text-muted-foreground">{t('brandWordmarkHelp')}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ws-brand-font">{t('brandFontFamily')}</Label>
        <Input
          id="ws-brand-font"
          value={values.customBrandFontFamily}
          onChange={set('customBrandFontFamily')}
          placeholder="Sohne, DM Sans, Avenir Next"
          disabled={demoMode}
        />
        <p className="text-xs text-muted-foreground">{t('brandFontFamilyHelp')}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ws-brand-font-url">{t('brandFontUrl')}</Label>
        <Input
          id="ws-brand-font-url"
          value={values.customBrandFontUrl}
          onChange={set('customBrandFontUrl')}
          placeholder="https://fonts.googleapis.com/css2?family=Your+Brand+Font"
          disabled={demoMode}
        />
        <p className="text-xs text-muted-foreground">{t('brandFontUrlHelp')}</p>
        {brandFontUrlInvalid && (
          <p className="text-xs text-destructive">
            Only HTTPS URLs from Google Fonts, Bunny Fonts, Typekit, or cdnfonts are supported.
          </p>
        )}
        {(values.brandText.trim().length > 0 || values.customBrandFontFamily.trim().length > 0) && (
          <div className="mt-3 inline-flex items-center gap-3 rounded-xl border bg-muted px-3 py-2">
            <div className="rounded-lg border bg-card px-4 py-2">
              <span
                className="block text-2xl text-foreground"
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
              <p className="text-sm font-medium text-foreground">{t('wordmarkPreview')}</p>
              <p className="text-xs text-muted-foreground">{t('wordmarkPreviewHelp')}</p>
            </div>
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ws-favicon">{t('favicon')}</Label>
        <Input
          id="ws-favicon"
          value={values.favicon}
          onChange={set('favicon')}
          placeholder={t('faviconPlaceholder')}
          disabled={demoMode}
        />
        <p className="text-xs text-muted-foreground">{t('faviconHelp')}</p>
        {values.favicon.trim().length > 0 && (
          <div className="mt-3 inline-flex items-center gap-3 rounded-xl border bg-muted px-3 py-2">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border bg-card p-1">
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
              <p className="text-sm font-medium text-foreground">{t('faviconPreview')}</p>
              <p className="text-xs text-muted-foreground">{t('faviconPreviewHelp')}</p>
            </div>
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ws-meta-title">{t('metaTitle')}</Label>
        <Input
          id="ws-meta-title"
          value={values.metaTitle}
          onChange={set('metaTitle')}
          placeholder={t('metaTitlePlaceholder', { name: values.name })}
          disabled={demoMode}
        />
        <p className="text-xs text-muted-foreground">{t('metaTitleHelp')}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ws-meta-description">{t('metaDescription')}</Label>
        <textarea
          id="ws-meta-description"
          value={values.metaDescription}
          onChange={set('metaDescription')}
          placeholder={t('metaDescriptionPlaceholder', { name: values.name })}
          rows={4}
          disabled={demoMode}
          className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <p className="text-xs text-muted-foreground">{t('metaDescriptionHelp')}</p>
      </div>

      {!demoMode && (
        <div className="flex items-center gap-3 pt-1">
          <Button onClick={save} disabled={status === 'saving'}>
            {status === 'saving' ? tc('saving') : t('saveChanges')}
          </Button>
          {status === 'saved' && <span className="text-sm text-emerald-600 dark:text-emerald-400">{t('saved')}</span>}
          {status === 'error' && <span className="text-sm text-destructive">{t('saveFailed')}</span>}
        </div>
      )}

      <div className="pt-3">
        <Separator className="mb-3" />
        <p className="text-xs text-muted-foreground mb-0.5">{t('helpCenterUrl')}</p>
        {values.customDomain.trim() ? (
          <div className="space-y-1">
            <a
              href={`https://${values.customDomain.trim()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm font-mono text-primary hover:underline break-all"
            >
              {values.customDomain.trim()}
            </a>
            {helpCenterDomain && (
              <a
                href={`https://${values.slug}.${helpCenterDomain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs font-mono text-muted-foreground hover:underline break-all"
              >
                {values.slug}.{helpCenterDomain}
              </a>
            )}
          </div>
        ) : (
          <a
            href={helpCenterDomain ? `https://${values.slug}.${helpCenterDomain}` : `${appUrl}/${values.slug}/help`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-mono text-primary hover:underline break-all"
          >
            {helpCenterDomain ? `${values.slug}.${helpCenterDomain}` : `${appUrl}/${values.slug}/help`}
          </a>
        )}
      </div>

      {isOwner && !demoMode && (
        <div className="mt-10 pt-6 border-t border-destructive/30">
          <h3 className="text-sm font-medium text-destructive mb-1">Danger zone</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Deleting a workspace removes all articles, collections, conversations, and members.
            You have 30 days to restore it before data is permanently deleted.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteModal(true)}
            className="border-destructive/40 text-destructive hover:bg-destructive/10"
          >
            Delete workspace
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={showRemoveDomainConfirm}
        title="Remove custom domain"
        message={`Are you sure you want to remove ${values.customDomain}? It will stop working immediately.`}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        destructive
        onConfirm={handleRemove}
        onCancel={() => setShowRemoveDomainConfirm(false)}
      />

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card rounded-xl border shadow-lg p-6 max-w-md mx-4">
            <h3 className="font-semibold text-lg text-foreground mb-2">Delete workspace</h3>
            <p className="text-sm text-muted-foreground mb-4">
              This will soft-delete <span className="font-medium text-foreground">{values.name}</span>.
              All content will be inaccessible. You have 30 days to restore it.
            </p>
            <p className="text-sm text-muted-foreground mb-2">
              Type <span className="font-medium text-foreground">{values.name}</span> to confirm:
            </p>
            <Input
              type="text"
              value={deleteConfirmName}
              onChange={(e) => { setDeleteConfirmName(e.target.value); setDeleteError('') }}
              placeholder={values.name}
              className="mb-4"
            />
            {deleteError && (
              <p className="text-sm text-destructive mb-3">{deleteError}</p>
            )}
            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setShowDeleteModal(false); setDeleteConfirmName('') }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDeleteWorkspace}
                disabled={deleting || deleteConfirmName.toLowerCase() !== values.name.toLowerCase()}
              >
                {deleting ? 'Deleting…' : 'Delete workspace'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
