'use client'

import { useState } from 'react'

interface Props {
  name: string
  slug: string
  customDomain: string
  helpCenterUrl: string
}

export function WorkspaceForm({ name, slug, customDomain, helpCenterUrl }: Props) {
  const [values, setValues] = useState({ name, slug, customDomain })
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  function set(field: keyof typeof values) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
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
    if (res.ok) setTimeout(() => setStatus('idle'), 2000)
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-ink mb-1">Name</label>
        <input
          value={values.name}
          onChange={set('name')}
          className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white text-ink focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-ink mb-1">Slug</label>
        <div className="flex items-center border border-border rounded-lg overflow-hidden">
          <span className="px-3 py-2 bg-cream text-muted text-sm border-r border-border shrink-0">
            helpnest.cloud/
          </span>
          <input
            value={values.slug}
            onChange={set('slug')}
            className="flex-1 px-3 py-2 text-sm bg-white text-ink focus:outline-none"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-ink mb-1">Custom Domain</label>
        <input
          value={values.customDomain}
          onChange={set('customDomain')}
          placeholder="help.yourcompany.com"
          className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

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

      <div className="pt-3 border-t border-border">
        <p className="text-xs text-muted mb-0.5">Help center URL</p>
        <p className="text-sm font-mono text-ink/70">{helpCenterUrl}</p>
      </div>
    </div>
  )
}
