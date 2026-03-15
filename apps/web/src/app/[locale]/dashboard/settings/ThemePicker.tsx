'use client'

import { getAllFontPresetUrls, type FontPreset } from '@/lib/branding'
import { useRouter } from '@/i18n/navigation'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { HelpNestTheme } from '@/lib/themes'
import { AIThemeGenerator } from './AIThemeGenerator'

interface Props {
  themes: HelpNestTheme[]
  fontPresets: FontPreset[]
  radiusOptions: HelpNestTheme['radius'][]
  currentThemeId: string
  currentFontPresetId: string | null
  currentCustomCreamColor: string
  currentCustomInkColor: string
  currentCustomMutedColor: string
  currentCustomBorderColor: string
  currentCustomAccentColor: string
  currentCustomGreenColor: string
  currentCustomWhiteColor: string
  currentCustomRadius: string
  currentCustomHeadingFontFamily: string
  currentCustomHeadingFontUrl: string
  currentCustomBodyFontFamily: string
  currentCustomBodyFontUrl: string
  workspaceSlug: string
  demoMode?: boolean
}

export function ThemePicker({
  themes,
  fontPresets,
  radiusOptions,
  currentThemeId,
  currentFontPresetId,
  currentCustomCreamColor,
  currentCustomInkColor,
  currentCustomMutedColor,
  currentCustomBorderColor,
  currentCustomAccentColor,
  currentCustomGreenColor,
  currentCustomWhiteColor,
  currentCustomRadius,
  currentCustomHeadingFontFamily,
  currentCustomHeadingFontUrl,
  currentCustomBodyFontFamily,
  currentCustomBodyFontUrl,
  workspaceSlug,
  demoMode = false,
}: Props) {
  const router = useRouter()
  const t = useTranslations('themePicker')
  const tc = useTranslations('common')
  const [selectedThemeId, setSelectedThemeId] = useState(currentThemeId)
  const [selectedFontPresetId, setSelectedFontPresetId] = useState(currentFontPresetId ?? '')
  const [customCreamColor, setCustomCreamColor] = useState(currentCustomCreamColor)
  const [customInkColor, setCustomInkColor] = useState(currentCustomInkColor)
  const [customMutedColor, setCustomMutedColor] = useState(currentCustomMutedColor)
  const [customBorderColor, setCustomBorderColor] = useState(currentCustomBorderColor)
  const [customAccentColor, setCustomAccentColor] = useState(currentCustomAccentColor)
  const [customGreenColor, setCustomGreenColor] = useState(currentCustomGreenColor)
  const [customWhiteColor, setCustomWhiteColor] = useState(currentCustomWhiteColor)
  const [customRadius, setCustomRadius] = useState(currentCustomRadius)
  const [customHeadingFontFamily, setCustomHeadingFontFamily] = useState(currentCustomHeadingFontFamily)
  const [customHeadingFontUrl, setCustomHeadingFontUrl] = useState(currentCustomHeadingFontUrl)
  const [customBodyFontFamily, setCustomBodyFontFamily] = useState(currentCustomBodyFontFamily)
  const [customBodyFontUrl, setCustomBodyFontUrl] = useState(currentCustomBodyFontUrl)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    for (const url of getAllFontPresetUrls()) {
      const existing = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).find(
        (link) => (link as HTMLLinkElement).href === url,
      )

      if (existing) continue

      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = url
      document.head.appendChild(link)
    }
  }, [])

  useEffect(() => {
    for (const trimmedUrl of [customHeadingFontUrl, customBodyFontUrl].map((url) => url.trim())) {
      if (trimmedUrl.length === 0) continue

      const existing = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).find(
        (link) => (link as HTMLLinkElement).href === trimmedUrl,
      )
      if (existing) continue

      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = trimmedUrl
      document.head.appendChild(link)
    }
  }, [customHeadingFontUrl, customBodyFontUrl])

  const isDirty =
    selectedThemeId !== currentThemeId ||
    selectedFontPresetId !== (currentFontPresetId ?? '') ||
    customCreamColor !== currentCustomCreamColor ||
    customInkColor !== currentCustomInkColor ||
    customMutedColor !== currentCustomMutedColor ||
    customBorderColor !== currentCustomBorderColor ||
    customAccentColor !== currentCustomAccentColor ||
    customGreenColor !== currentCustomGreenColor ||
    customWhiteColor !== currentCustomWhiteColor ||
    customRadius !== currentCustomRadius ||
    customHeadingFontFamily !== currentCustomHeadingFontFamily ||
    customHeadingFontUrl !== currentCustomHeadingFontUrl ||
    customBodyFontFamily !== currentCustomBodyFontFamily ||
    customBodyFontUrl !== currentCustomBodyFontUrl

  const selectedTheme = themes.find((theme) => theme.id === selectedThemeId) ?? themes[0]!
  const visibleFontPresets = fontPresets.filter(
    (p) => JSON.stringify(p.fonts) !== JSON.stringify(selectedTheme.fonts)
  )
  const previewColors = {
    cream: customCreamColor.trim() || selectedTheme.colors.cream,
    ink: customInkColor.trim() || selectedTheme.colors.ink,
    muted: customMutedColor.trim() || selectedTheme.colors.muted,
    border: customBorderColor.trim() || selectedTheme.colors.border,
    accent: customAccentColor.trim() || selectedTheme.colors.accent,
    green: customGreenColor.trim() || selectedTheme.colors.green,
    white: customWhiteColor.trim() || selectedTheme.colors.white,
  }
  const previewRadius = customRadius || selectedTheme.radius
  const previewRadiusClass = previewRadius === 'none'
    ? '0px'
    : previewRadius === 'sm'
      ? '4px'
      : previewRadius === 'md'
        ? '8px'
        : previewRadius === 'lg'
          ? '12px'
          : '16px'
  const colorFields = [
    { label: t('background'), value: customCreamColor, setValue: setCustomCreamColor, placeholder: '#F7F4EE' },
    { label: t('text'), value: customInkColor, setValue: setCustomInkColor, placeholder: '#1A1814' },
    { label: t('muted'), value: customMutedColor, setValue: setCustomMutedColor, placeholder: '#7A756C' },
    { label: t('border'), value: customBorderColor, setValue: setCustomBorderColor, placeholder: '#E2DDD5' },
    { label: t('accent'), value: customAccentColor, setValue: setCustomAccentColor, placeholder: '#C8622A' },
    { label: t('success'), value: customGreenColor, setValue: setCustomGreenColor, placeholder: '#2D6A4F' },
    { label: t('surface'), value: customWhiteColor, setValue: setCustomWhiteColor, placeholder: '#FFFFFF' },
  ] as const

  async function save() {
    setSaving(true)
    setError('')
    const res = await fetch('/api/workspace/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        themeId: selectedThemeId,
        fontPresetId: selectedFontPresetId || null,
        customCreamColor: customCreamColor.trim() || null,
        customInkColor: customInkColor.trim() || null,
        customMutedColor: customMutedColor.trim() || null,
        customBorderColor: customBorderColor.trim() || null,
        customAccentColor: customAccentColor.trim() || null,
        customGreenColor: customGreenColor.trim() || null,
        customWhiteColor: customWhiteColor.trim() || null,
        customRadius: customRadius || null,
        customHeadingFontFamily: customHeadingFontFamily.trim() || null,
        customHeadingFontUrl: customHeadingFontUrl.trim() || null,
        customBodyFontFamily: customBodyFontFamily.trim() || null,
        customBodyFontUrl: customBodyFontUrl.trim() || null,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const body = await res.json().catch(() => null) as { error?: string } | null
      setError(body?.error ?? tc('somethingWentWrong'))
      return
    }

    setSaved(true)
    router.refresh()
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <AIThemeGenerator
        onApply={(generated) => {
          setSaved(false)
          setSelectedThemeId(generated.themeId)
          setCustomCreamColor(generated.customCreamColor)
          setCustomInkColor(generated.customInkColor)
          setCustomMutedColor(generated.customMutedColor)
          setCustomBorderColor(generated.customBorderColor)
          setCustomAccentColor(generated.customAccentColor)
          setCustomGreenColor(generated.customGreenColor)
          setCustomWhiteColor(generated.customWhiteColor)
          setCustomRadius(generated.customRadius)
        }}
      />
      <p className="text-sm font-medium text-ink mb-3">{t('theme')}</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {themes.map((theme) => (
          <button
            key={theme.id}
            onClick={() => {
              setSaved(false)
              setSelectedThemeId(theme.id)
            }}
            className={`text-left rounded-xl border-2 overflow-hidden transition-all ${
              selectedThemeId === theme.id
                ? 'border-accent shadow-sm'
                : 'border-border hover:border-muted'
            }`}
          >
            {/* Color swatch strip */}
            <div className="h-1.5 flex">
              {Object.values(theme.colors).map((color, i) => (
                <div key={i} className="flex-1" style={{ backgroundColor: color }} />
              ))}
            </div>

            {/* Mini mockup */}
            <div className="p-2" style={{ backgroundColor: theme.colors.cream }}>
              <div
                className="rounded overflow-hidden border text-[10px]"
                style={{ borderColor: theme.colors.border }}
              >
                <div
                  className="px-2 py-1 font-medium"
                  style={{ backgroundColor: theme.colors.ink, color: theme.colors.cream }}
                >
                  {workspaceSlug} help
                </div>
                <div className="px-2 py-1.5 grid grid-cols-3 gap-1" style={{ backgroundColor: theme.colors.cream }}>
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="rounded p-1 border"
                      style={{ backgroundColor: theme.colors.white, borderColor: theme.colors.border }}
                    >
                      <div className="w-2 h-2 rounded-sm mb-0.5" style={{ backgroundColor: theme.colors.accent }} />
                      <div className="h-0.5 rounded" style={{ backgroundColor: theme.colors.muted, opacity: 0.4 }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Name */}
            <div className="px-3 py-2 bg-white flex items-center justify-between">
              <span className="text-sm font-medium text-ink">{theme.name}</span>
              {theme.dark && (
                <span className="text-[10px] bg-ink text-cream px-1.5 py-0.5 rounded-full">{t('dark')}</span>
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1 mb-3">
        <p className="text-sm font-medium text-ink">{t('font')}</p>
        <span className="group relative flex items-center">
          <svg className="w-3.5 h-3.5 text-muted cursor-default" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <circle cx="12" cy="12" r="10" strokeWidth={2} />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16v-4m0-4h.01" />
          </svg>
          <span className="pointer-events-none absolute bottom-full left-0 mb-2 w-56 rounded-lg bg-ink px-3 py-2 text-xs text-cream opacity-0 group-hover:opacity-100 transition-opacity z-10">
            {t('fontTooltip')}
          </span>
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <button
          onClick={() => {
            setSaved(false)
            setSelectedFontPresetId('')
          }}
          className={`text-left rounded-xl border-2 overflow-hidden transition-all ${
            selectedFontPresetId.length === 0
              ? 'border-accent shadow-sm'
              : 'border-border hover:border-muted'
          }`}
        >
          <div className="border-b border-border bg-cream px-4 py-3">
            <p className="text-lg text-ink font-serif" style={{ fontFamily: selectedTheme.fonts.heading }}>Aa</p>
            <p className="text-sm text-ink mt-1" style={{ fontFamily: selectedTheme.fonts.body }}>
              Help articles, search, and AI answers
            </p>
          </div>
          <div className="bg-white px-4 py-3">
            <p className="text-sm font-medium text-ink">{t('matchTheme')}</p>
            <p className="text-xs text-muted">
              {selectedTheme.fonts.heading.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '')} / {selectedTheme.fonts.body.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '')}
            </p>
          </div>
        </button>

        {visibleFontPresets.map((preset) => (
          <button
            key={preset.id}
            onClick={() => {
              setSaved(false)
              setSelectedFontPresetId(preset.id)
            }}
            className={`text-left rounded-xl border-2 overflow-hidden transition-all ${
              selectedFontPresetId === preset.id
                ? 'border-accent shadow-sm'
                : 'border-border hover:border-muted'
            }`}
          >
            <div className="border-b border-border bg-cream px-4 py-3">
              <p className="text-lg text-ink" style={{ fontFamily: preset.fonts.heading }}>
                Aa
              </p>
              <p className="text-sm text-ink mt-1" style={{ fontFamily: preset.fonts.body }}>
                {t('fontPreview')}
              </p>
            </div>
            <div className="bg-white px-4 py-3">
              <p className="text-sm font-medium text-ink">{preset.headingLabel}</p>
              <p className="text-xs text-muted">{preset.bodyLabel}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-cream/50 p-4 mb-4">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <p className="text-sm font-medium text-ink">{t('companyColors')}</p>
            <p className="text-xs text-muted mt-1">
              {t('companyColorsHelp')}
            </p>
          </div>
          {(customCreamColor.length > 0 ||
            customInkColor.length > 0 ||
            customMutedColor.length > 0 ||
            customBorderColor.length > 0 ||
            customAccentColor.length > 0 ||
            customGreenColor.length > 0 ||
            customWhiteColor.length > 0 ||
            customRadius.length > 0) && (
            <button
              onClick={() => {
                setSaved(false)
                setCustomCreamColor('')
                setCustomInkColor('')
                setCustomMutedColor('')
                setCustomBorderColor('')
                setCustomAccentColor('')
                setCustomGreenColor('')
                setCustomWhiteColor('')
                setCustomRadius('')
              }}
              className="shrink-0 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-ink hover:bg-cream transition-colors"
            >
              {t('clearColors')}
            </button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {colorFields.map((field) => (
            <div key={field.label}>
              <label className="block text-xs font-medium text-ink mb-1">{field.label}</label>
              <div className="flex items-center gap-2">
                <input
                  value={field.value}
                  onChange={(event) => {
                    setSaved(false)
                    field.setValue(event.target.value)
                  }}
                  placeholder={field.placeholder}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <span
                  className="h-9 w-9 shrink-0 rounded-lg border border-border bg-white"
                  style={{ backgroundColor: (field.value.trim() || field.placeholder) }}
                />
              </div>
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-ink mb-1">{t('cornerRadius')}</label>
            <div className="relative">
            <select
              value={customRadius}
              onChange={(event) => {
                setSaved(false)
                setCustomRadius(event.target.value)
              }}
              className="w-full appearance-none rounded-lg border border-border bg-white px-3 py-2 pr-8 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
            >
              <option value="">{t('useThemeRadius')}</option>
              {radiusOptions.map((option) => (
                <option key={option} value={option}>
                  {option.toUpperCase()}
                </option>
              ))}
            </select>
            <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-border bg-white p-4">
          <p className="text-xs text-muted mb-2">{t('colorPreview')}</p>
          <div
            className="overflow-hidden border"
            style={{ backgroundColor: previewColors.cream, borderColor: previewColors.border, borderRadius: previewRadiusClass }}
          >
            <div
              className="px-4 py-3"
              style={{ backgroundColor: previewColors.ink, color: previewColors.cream }}
            >
              <p className="text-sm font-medium">{workspaceSlug} help</p>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <div
                className="border p-3"
                style={{ backgroundColor: previewColors.white, borderColor: previewColors.border, borderRadius: previewRadiusClass }}
              >
                <p style={{ color: previewColors.ink }} className="text-sm font-medium">{t('popularArticle')}</p>
                <p style={{ color: previewColors.muted }} className="text-xs mt-1">{t('previewBody')}</p>
              </div>
              <div
                className="p-3"
                style={{ backgroundColor: previewColors.green, color: previewColors.white, borderRadius: previewRadiusClass }}
              >
                <p className="text-sm font-medium">{t('aiEnabled')}</p>
                <p className="text-xs mt-1 opacity-80">{t('aiEnabledHelp')}</p>
              </div>
            </div>
            <div className="px-4 pb-4">
              <button
                type="button"
                className="px-3 py-2 text-sm font-medium"
                style={{ backgroundColor: previewColors.accent, color: previewColors.white, borderRadius: previewRadiusClass }}
              >
                {t('accentAction')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-cream/50 p-4 mb-4">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <p className="text-sm font-medium text-ink">{t('customFontOverride')}</p>
            <p className="text-xs text-muted mt-1">
              {t('customFontOverrideHelp')}
            </p>
          </div>
          {(customHeadingFontFamily.length > 0 ||
            customHeadingFontUrl.length > 0 ||
            customBodyFontFamily.length > 0 ||
            customBodyFontUrl.length > 0) && (
            <button
              onClick={() => {
                setSaved(false)
                setCustomHeadingFontFamily('')
                setCustomHeadingFontUrl('')
                setCustomBodyFontFamily('')
                setCustomBodyFontUrl('')
              }}
              className="shrink-0 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-ink hover:bg-cream transition-colors"
            >
              {t('clearCustomFont')}
            </button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 mt-3">
          <div>
            <label className="block text-xs font-medium text-ink mb-1">{t('headingFontFamily')}</label>
            <input
              value={customHeadingFontFamily}
              onChange={(event) => {
                setSaved(false)
                setCustomHeadingFontFamily(event.target.value)
              }}
              placeholder={'e.g. "Sohne", "Helvetica Neue", sans-serif'}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink mb-1">{t('headingStylesheetUrl')}</label>
            <input
              value={customHeadingFontUrl}
              onChange={(event) => {
                setSaved(false)
                setCustomHeadingFontUrl(event.target.value)
              }}
              placeholder="https://fonts.googleapis.com/css2?family=Heading+Font"
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink mb-1">{t('bodyFontFamily')}</label>
            <input
              value={customBodyFontFamily}
              onChange={(event) => {
                setSaved(false)
                setCustomBodyFontFamily(event.target.value)
              }}
              placeholder={'e.g. "Inter", system-ui, sans-serif'}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink mb-1">{t('bodyStylesheetUrl')}</label>
            <input
              value={customBodyFontUrl}
              onChange={(event) => {
                setSaved(false)
                setCustomBodyFontUrl(event.target.value)
              }}
              placeholder="https://fonts.googleapis.com/css2?family=Body+Font"
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        {(customHeadingFontFamily.trim().length > 0 ||
          customBodyFontFamily.trim().length > 0) && (
          <div className="mt-3 rounded-xl border border-border bg-white px-4 py-3">
            <p className="text-xs text-muted mb-1">{t('customFontPreview')}</p>
            <p
              className="text-xl text-ink"
              style={{ fontFamily: customHeadingFontFamily || undefined }}
            >
              {workspaceSlug} help center
            </p>
            <p
              className="text-sm text-muted mt-1"
              style={{ fontFamily: customBodyFontFamily || undefined }}
            >
              {t('bodyFontPreview')}
            </p>
          </div>
        )}
      </div>

      {demoMode ? (
        <p className="text-sm text-muted">{t('demoBranding')}</p>
      ) : (
        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving || !isDirty}
            className="bg-ink text-cream px-4 py-2 rounded-lg text-sm hover:bg-ink/90 transition-colors disabled:opacity-50"
          >
            {saving ? tc('saving') : saved ? tc('saved') : t('applyBranding')}
          </button>
          {error && <span className="text-sm text-red-500">{error}</span>}
        </div>
      )}
    </div>
  )
}
