'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

export interface GeneratedTheme {
  themeId: string
  customCreamColor: string
  customInkColor: string
  customMutedColor: string
  customBorderColor: string
  customAccentColor: string
  customGreenColor: string
  customWhiteColor: string
  customRadius: string
  reasoning: string
}

interface Props {
  onApply: (theme: GeneratedTheme) => void
}

const RADIUS_PX: Record<string, string> = {
  none: '0px',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
}

export function AIThemeGenerator({ onApply }: Props) {
  const t = useTranslations('aiThemeGenerator')
  const tc = useTranslations('common')
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<GeneratedTheme | null>(null)

  async function generate() {
    if (!prompt.trim() || generating) return
    setGenerating(true)
    setError('')
    setResult(null)

    try {
      const res = await fetch('/api/ai/generate-theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })

      const data = await res.json() as GeneratedTheme & { error?: string }

      if (!res.ok) {
        setError(data.error ?? tc('somethingWentWrong'))
        return
      }

      setResult(data)
    } catch {
      setError(tc('networkError'))
    } finally {
      setGenerating(false)
    }
  }

  const radiusPx = result ? (RADIUS_PX[result.customRadius] ?? '8px') : '8px'

  return (
    <div className="rounded-xl border border-border bg-cream/50 p-4 mb-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-medium text-ink">
          <span aria-hidden="true">✦</span> {t('title')}
        </span>
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">
          {t('beta')}
        </span>
      </div>
      <p className="text-xs text-muted mb-3">
        {t('description')}
      </p>

      {/* Textarea + controls */}
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={t('placeholder')}
        maxLength={500}
        rows={3}
        className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent resize-none mb-2"
      />
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted">{prompt.length}/500</span>
        <button
          onClick={generate}
          disabled={!prompt.trim() || generating}
          className="flex items-center gap-1.5 bg-ink text-cream px-3 py-1.5 rounded-lg text-sm disabled:opacity-50 transition-opacity"
        >
          {generating ? (
            <>
              <svg
                className="animate-spin h-3.5 w-3.5 shrink-0"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              {t('generating')}
            </>
          ) : (
            <>
              <svg
                className="h-3.5 w-3.5 shrink-0"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 2a.75.75 0 01.671.415l1.92 3.836 4.23.615a.75.75 0 01.416 1.279l-3.06 2.982.722 4.21a.75.75 0 01-1.088.791L10 14.01l-3.811 2.128a.75.75 0 01-1.088-.79l.722-4.211-3.06-2.982a.75.75 0 01.416-1.28l4.23-.614L9.329 2.415A.75.75 0 0110 2z"
                  clipRule="evenodd"
                />
              </svg>
              {t('generate')}
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-500 mb-2">{error}</p>
      )}

      {/* Result card */}
      {result && (
        <div className="rounded-xl border border-border bg-white p-4 mt-2">
          {/* Color swatches */}
          <div className="flex gap-1 mb-3">
            {[
              result.customCreamColor,
              result.customInkColor,
              result.customMutedColor,
              result.customBorderColor,
              result.customAccentColor,
              result.customGreenColor,
              result.customWhiteColor,
            ].map((color, i) => (
              <div
                key={i}
                className="flex-1 h-8 rounded border border-border/50"
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>

          {/* Mini mockup */}
          <div
            className="overflow-hidden rounded-lg border text-xs mb-3"
            style={{
              borderColor: result.customBorderColor,
            }}
          >
            {/* Nav bar */}
            <div
              className="px-3 py-2 font-medium"
              style={{
                backgroundColor: result.customInkColor,
                color: result.customCreamColor,
              }}
            >
              {t('yourHelpCenter')}
            </div>

            {/* Body */}
            <div
              className="grid grid-cols-2 gap-2 p-3"
              style={{ backgroundColor: result.customCreamColor }}
            >
              {/* Article card */}
              <div
                className="border p-2"
                style={{
                  backgroundColor: result.customWhiteColor,
                  borderColor: result.customBorderColor,
                  borderRadius: radiusPx,
                }}
              >
                <p className="font-medium mb-0.5" style={{ color: result.customInkColor }}>
                  {t('articleTitle')}
                </p>
                <p style={{ color: result.customMutedColor }}>{t('articlePreview')}</p>
              </div>

              {/* CTA button */}
              <div className="flex items-center">
                <button
                  type="button"
                  className="px-2 py-1 text-xs font-medium"
                  style={{
                    backgroundColor: result.customAccentColor,
                    color: result.customWhiteColor,
                    borderRadius: radiusPx,
                  }}
                >
                  {t('getInTouch')}
                </button>
              </div>
            </div>
          </div>

          {/* Reasoning */}
          {result.reasoning && (
            <p className="text-xs text-muted italic mb-3">{result.reasoning}</p>
          )}

          {/* Apply button */}
          <button
            onClick={() => onApply(result)}
            className="w-full bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            {t('applyToDesigner')}
          </button>
        </div>
      )}
    </div>
  )
}
