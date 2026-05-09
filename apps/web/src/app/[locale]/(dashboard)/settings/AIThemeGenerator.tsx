'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

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
    <div className="rounded-xl border bg-muted/30 p-4 mb-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-medium text-foreground">
          <span aria-hidden="true">✦</span> {t('title')}
        </span>
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
          {t('beta')}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">{t('description')}</p>

      {/* Textarea + controls */}
      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={t('placeholder')}
        maxLength={500}
        rows={3}
        className="resize-none mb-2"
      />
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{prompt.length}/500</span>
        <Button
          onClick={generate}
          disabled={!prompt.trim() || generating}
          size="sm"
        >
          {generating ? (
            <>
              <svg
                className="animate-spin h-3.5 w-3.5 shrink-0 mr-1.5"
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
                className="h-3.5 w-3.5 shrink-0 mr-1.5"
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
        </Button>
      </div>

      {/* Error */}
      {error && <p className="text-xs text-destructive mb-2">{error}</p>}

      {/* Result card — keep all inline styles for the preview mockup */}
      {result && (
        <div className="rounded-xl border bg-card p-4 mt-2">
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

          {/* Mini mockup — inline styles intentional (help center preview) */}
          <div
            className="overflow-hidden rounded-lg border text-xs mb-3"
            style={{ borderColor: result.customBorderColor }}
          >
            <div
              className="px-3 py-2 font-medium"
              style={{ backgroundColor: result.customInkColor, color: result.customCreamColor }}
            >
              {t('yourHelpCenter')}
            </div>
            <div
              className="grid grid-cols-2 gap-2 p-3"
              style={{ backgroundColor: result.customCreamColor }}
            >
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
              <div className="flex items-center">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto px-2 py-1 text-xs font-medium"
                  style={{
                    backgroundColor: result.customAccentColor,
                    color: result.customWhiteColor,
                    borderRadius: radiusPx,
                  }}
                >
                  {t('getInTouch')}
                </Button>
              </div>
            </div>
          </div>

          {/* Reasoning */}
          {result.reasoning && (
            <p className="text-xs text-muted-foreground italic mb-3">{result.reasoning}</p>
          )}

          {/* Apply button */}
          <Button
            onClick={() => onApply(result)}
            className="w-full"
          >
            {t('applyToDesigner')}
          </Button>
        </div>
      )}
    </div>
  )
}
