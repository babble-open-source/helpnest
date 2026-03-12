'use client'

import { useState } from 'react'

interface Props {
  aiEnabled: boolean
  aiProvider: string | null
  aiModel: string | null
  aiGreeting: string | null
  aiInstructions: string | null
  aiEscalationThreshold: number
  hasApiKey: boolean
  demoMode: boolean
}

export function AiSettingsSection({
  aiEnabled: initEnabled,
  aiProvider: initProvider,
  aiModel: initModel,
  aiGreeting: initGreeting,
  aiInstructions: initInstructions,
  aiEscalationThreshold: initThreshold,
  hasApiKey,
  demoMode,
}: Props) {
  const [enabled, setEnabled] = useState(initEnabled)
  const [provider, setProvider] = useState((initProvider || 'anthropic').toLowerCase())
  const [model, setModel] = useState(initModel || '')
  const [apiKey, setApiKey] = useState('')
  const [greeting, setGreeting] = useState(initGreeting || '')
  const [instructions, setInstructions] = useState(initInstructions || '')
  const [threshold, setThreshold] = useState(initThreshold)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    if (demoMode) return
    setSaving(true)
    setSaved(false)
    try {
      const body: Record<string, unknown> = {
        aiEnabled: enabled,
        aiProvider: provider,
        aiModel: model || null,
        aiGreeting: greeting || null,
        aiInstructions: instructions || null,
        aiEscalationThreshold: threshold,
      }
      if (apiKey) body.aiApiKey = apiKey
      const res = await fetch('/api/workspace/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setSaved(true)
        setApiKey('')
        setTimeout(() => setSaved(false), 3000)
      }
    } finally {
      setSaving(false)
    }
  }

  const providers = [
    { value: 'anthropic', label: 'Anthropic (Claude)' },
    { value: 'openai', label: 'OpenAI (GPT)' },
    { value: 'google', label: 'Google (Gemini)' },
    { value: 'mistral', label: 'Mistral' },
  ]

  return (
    <div className="bg-white rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-medium text-ink">AI Agent</h2>
          <p className="text-sm text-muted mt-0.5">
            Configure the AI that answers customer questions automatically.
          </p>
        </div>
        <button
          onClick={() => setEnabled(!enabled)}
          disabled={demoMode}
          aria-checked={enabled}
          role="switch"
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
            enabled ? 'bg-green' : 'bg-border'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {enabled && (
        <div className="space-y-4 border-t border-border pt-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">AI Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              disabled={demoMode}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:border-green disabled:opacity-50"
            >
              {providers.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Model (optional)</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={demoMode}
              placeholder={
                provider === 'anthropic'
                  ? 'claude-haiku-4-5-20251001'
                  : provider === 'openai'
                    ? 'gpt-4o-mini'
                    : provider === 'google'
                      ? 'gemini-1.5-flash'
                      : 'mistral-small-latest'
              }
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-green disabled:opacity-50"
            />
            <p className="text-xs text-muted mt-1">Leave blank to use the provider default.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={demoMode}
              placeholder={hasApiKey ? '••••••••• (configured)' : 'Enter API key...'}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-green disabled:opacity-50"
            />
            <p className="text-xs text-muted mt-1">
              {hasApiKey
                ? 'Enter a new key to replace the existing one.'
                : 'Encrypted at rest. Leave blank to use server environment variables.'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Greeting Message</label>
            <input
              type="text"
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              disabled={demoMode}
              placeholder="Hi! How can I help you today?"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-green disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Custom Instructions</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              disabled={demoMode}
              rows={4}
              placeholder="e.g. Always suggest contacting sales for pricing questions."
              className="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none focus:outline-none focus:border-green disabled:opacity-50"
            />
            <p className="text-xs text-muted mt-1">Prepended to the AI system prompt.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">
              Escalation Threshold: {Math.round(threshold * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              disabled={demoMode}
              className="w-full accent-green disabled:opacity-50"
            />
            <p className="text-xs text-muted mt-1">
              Auto-escalate to a human when AI confidence falls below this threshold.
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || demoMode}
            className="px-4 py-2 bg-green text-white rounded-lg text-sm font-medium hover:bg-green/90 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save AI Settings'}
          </button>
        </div>
      )}
    </div>
  )
}
