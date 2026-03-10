'use client'

import type { ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

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
  demoMode?: boolean
}

function normalizeAssetUrl(value: string): string {
  return value.trim().replace(/\/+$/, '')
}

function looksLikeFaviconAsset(value: string): boolean {
  const lower = value.toLowerCase()
  return (
    lower.includes('.ico') ||
    lower.includes('favicon') ||
    lower.includes('apple-touch-icon') ||
    lower.includes('mask-icon')
  )
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
  demoMode = false,
}: Props) {
  const router = useRouter()
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
    ? 'This looks like a favicon or icon asset. Use a fuller company logo here if you have one.'
    : logoMatchesFavicon
      ? 'Logo and favicon are using the same asset. That usually makes the main brand feel too small.'
      : null
  const previewBrandText = values.brandText.trim() || values.name.trim() || 'Brand'

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
        <p className="text-sm text-muted">Workspace settings cannot be changed in demo mode.</p>
      )}
      <div>
        <label className="block text-sm font-medium text-ink mb-1">Name</label>
        <input
          value={values.name}
          onChange={set('name')}
          disabled={demoMode}
          className={inputClass}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-ink mb-1">Slug</label>
        <div className={`flex items-center border border-border rounded-lg overflow-hidden${demoMode ? ' opacity-60' : ''}`}>
          <span className="px-3 py-2 bg-cream text-muted text-sm border-r border-border shrink-0">
            {appUrl.replace(/^https?:\/\//, '')}/
          </span>
          <input
            value={values.slug}
            onChange={set('slug')}
            readOnly={demoMode}
            className={`flex-1 px-3 py-2 text-sm bg-white text-ink focus:outline-none${demoMode ? ' cursor-not-allowed select-none' : ''}`}
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-ink mb-1">Custom Domain</label>
        <input
          value={values.customDomain}
          onChange={set('customDomain')}
          placeholder="support.yourcompany.com"
          disabled={demoMode}
          className={inputClass + ' placeholder:text-muted'}
        />
        <p className="mt-1 text-xs text-muted">
          Point a CNAME record at this server, then enter the domain here. Routing activates automatically once DNS propagates.
        </p>
        {values.customDomain.trim().length > 0 && (
          <div className="mt-2 rounded-lg border border-border bg-cream px-3 py-2 text-xs text-muted space-y-0.5">
            <p className="font-medium text-ink">DNS setup required</p>
            <p>Add a CNAME record: <span className="font-mono">{values.customDomain.trim()}</span> → <span className="font-mono">{appUrl.replace(/^https?:\/\//, '')}</span></p>
          </div>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-ink mb-1">Company Logo</label>
        <input
          value={values.logo}
          onChange={set('logo')}
          placeholder="https://cdn.yourcompany.com/logo.svg"
          disabled={demoMode}
          className={inputClass + ' placeholder:text-muted'}
        />
        <p className="mt-1 text-xs text-muted">
          Supports `https://`, `http://`, root-relative paths, or data image URLs. Square logos are
          fine; they render without cropping. If your logo already includes a wordmark, we use that
          artwork directly instead of typesetting the name beside it.
        </p>
        {logoWarning && (
          <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {logoWarning}
          </div>
        )}
        {values.logo.trim().length > 0 && (
          <div className="mt-3 inline-flex items-center gap-3 rounded-xl border border-border bg-cream px-3 py-2">
            <div className="flex h-12 min-w-[3rem] max-w-[12rem] items-center justify-start overflow-hidden rounded-lg border border-border bg-white px-2 py-1.5">
              <img
                src={values.logo.trim()}
                alt={`${values.name} logo preview`}
                className="block h-full w-auto max-w-full object-contain object-left"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-ink">Logo preview</p>
              <p className="text-xs text-muted">
                Displayed across your help center, dashboard, and widget surfaces.
              </p>
            </div>
          </div>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-ink mb-1">Brand Wordmark</label>
        <input
          value={values.brandText}
          onChange={set('brandText')}
          placeholder={values.name || 'Acme'}
          disabled={demoMode}
          className={inputClass + ' placeholder:text-muted'}
        />
        <p className="mt-1 text-xs text-muted">
          Optional. Use this when you don&apos;t have a logo image and want to render branded text
          instead. If left blank, we use the workspace name.
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-ink mb-1">Brand Font Family</label>
        <input
          value={values.customBrandFontFamily}
          onChange={set('customBrandFontFamily')}
          placeholder="Sohne, DM Sans, Avenir Next"
          disabled={demoMode}
          className={inputClass + ' placeholder:text-muted'}
        />
        <p className="mt-1 text-xs text-muted">
          Used only for the text wordmark when no logo image is uploaded.
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-ink mb-1">Brand Font Stylesheet URL</label>
        <input
          value={values.customBrandFontUrl}
          onChange={set('customBrandFontUrl')}
          placeholder="https://fonts.googleapis.com/css2?family=Your+Brand+Font"
          disabled={demoMode}
          className={inputClass + ' placeholder:text-muted'}
        />
        <p className="mt-1 text-xs text-muted">
          Optional. Required only when the brand font is not already available on the page.
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
              <p className="text-sm font-medium text-ink">Wordmark preview</p>
              <p className="text-xs text-muted">
                Used when a workspace prefers text branding over an image logo.
              </p>
            </div>
          </div>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-ink mb-1">Favicon</label>
        <input
          value={values.favicon}
          onChange={set('favicon')}
          placeholder="https://cdn.yourcompany.com/favicon.png"
          disabled={demoMode}
          className={inputClass + ' placeholder:text-muted'}
        />
        <p className="mt-1 text-xs text-muted">
          Used for the browser tab icon. Falls back to your company logo if empty.
        </p>
        {values.favicon.trim().length > 0 && (
          <div className="mt-3 inline-flex items-center gap-3 rounded-xl border border-border bg-cream px-3 py-2">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-border bg-white p-1">
              <img
                src={values.favicon.trim()}
                alt={`${values.name} favicon preview`}
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-ink">Favicon preview</p>
              <p className="text-xs text-muted">Shown in browser tabs and bookmarks.</p>
            </div>
          </div>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-ink mb-1">Meta Title</label>
        <input
          value={values.metaTitle}
          onChange={set('metaTitle')}
          placeholder={`${values.name} Help Center`}
          disabled={demoMode}
          className={inputClass + ' placeholder:text-muted'}
        />
        <p className="mt-1 text-xs text-muted">Displayed in browser tabs and search results.</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-ink mb-1">Meta Description</label>
        <textarea
          value={values.metaDescription}
          onChange={set('metaDescription')}
          placeholder={`Support docs, guides, and answers for ${values.name}.`}
          rows={4}
          disabled={demoMode}
          className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent resize-y disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <p className="mt-1 text-xs text-muted">
          Used by search engines and link previews for your public help center.
        </p>
      </div>

      {!demoMode && (
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={save}
            disabled={status === 'saving'}
            className="bg-ink text-cream px-4 py-2 rounded-lg text-sm hover:bg-ink/90 transition-colors disabled:opacity-50"
          >
            {status === 'saving' ? 'Saving…' : 'Save changes'}
          </button>
          {status === 'saved' && <span className="text-sm text-green">✓ Saved</span>}
          {status === 'error' && <span className="text-sm text-red-500">Save failed</span>}
        </div>
      )}

      <div className="pt-3 border-t border-border">
        <p className="text-xs text-muted mb-0.5">Help center URL</p>
        <a
          href={`${appUrl}/${values.slug}/help`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-mono text-accent hover:underline break-all"
        >
          {appUrl}/{values.slug}/help
        </a>
      </div>
    </div>
  )
}
