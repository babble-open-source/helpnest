'use client'

import { useState } from 'react'
import type { HelpNestTheme } from '@/lib/themes'

interface Props {
  themes: HelpNestTheme[]
  currentThemeId: string
  workspaceSlug: string
}

export function ThemePicker({ themes, currentThemeId, workspaceSlug }: Props) {
  const [selected, setSelected] = useState(currentThemeId)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    await fetch('/api/workspace/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ themeId: selected }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {themes.map((theme) => (
          <button
            key={theme.id}
            onClick={() => setSelected(theme.id)}
            className={`text-left rounded-xl border-2 overflow-hidden transition-all ${
              selected === theme.id
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
                <span className="text-[10px] bg-ink text-cream px-1.5 py-0.5 rounded-full">Dark</span>
              )}
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={save}
        disabled={saving || selected === currentThemeId}
        className="bg-ink text-cream px-4 py-2 rounded-lg text-sm hover:bg-ink/90 transition-colors disabled:opacity-50"
      >
        {saving ? 'Saving…' : saved ? 'Saved!' : 'Apply theme'}
      </button>
    </div>
  )
}
