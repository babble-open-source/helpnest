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
  productContext: string | null
  autoDraftGapsEnabled: boolean
  autoDraftGapThreshold: number
  autoDraftExternalEnabled: boolean
  batchWindowMinutes: number
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
  productContext: initProductContext,
  autoDraftGapsEnabled: initAutoDraftGapsEnabled,
  autoDraftGapThreshold: initAutoDraftGapThreshold,
  autoDraftExternalEnabled: initAutoDraftExternalEnabled,
  batchWindowMinutes: initBatchWindowMinutes,
}: Props) {
  const [enabled, setEnabled] = useState(initEnabled)
  const [provider, setProvider] = useState((initProvider || 'anthropic').toLowerCase())
  const [model, setModel] = useState(initModel || '')
  const [apiKey, setApiKey] = useState('')
  const [removeApiKey, setRemoveApiKey] = useState(false)
  const [greeting, setGreeting] = useState(initGreeting || '')
  const [instructions, setInstructions] = useState(initInstructions || '')
  const [threshold, setThreshold] = useState(initThreshold)
  const [productContext, setProductContext] = useState(initProductContext || '')
  const [autoDraftGapsEnabled, setAutoDraftGapsEnabled] = useState(initAutoDraftGapsEnabled)
  const [autoDraftGapThreshold, setAutoDraftGapThreshold] = useState(initAutoDraftGapThreshold)
  const [autoDraftExternalEnabled, setAutoDraftExternalEnabled] = useState(initAutoDraftExternalEnabled)
  const [batchWindowMinutes, setBatchWindowMinutes] = useState(initBatchWindowMinutes)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function handleSave() {
    if (demoMode) return
    setSaving(true)
    setSaved(false)
    setSaveError(null)
    try {
      const body: Record<string, unknown> = {
        aiEnabled: enabled,
        aiProvider: provider,
        aiModel: model || null,
        aiGreeting: greeting || null,
        aiInstructions: instructions || null,
        aiEscalationThreshold: threshold,
        productContext: productContext || null,
        autoDraftGapsEnabled,
        autoDraftGapThreshold,
        autoDraftExternalEnabled,
        batchWindowMinutes,
      }
      if (removeApiKey) body.aiApiKey = null
      else if (apiKey) body.aiApiKey = apiKey
      const res = await fetch('/api/workspace/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setSaved(true)
        setApiKey('')
        setRemoveApiKey(false)
        setTimeout(() => setSaved(false), 3000)
      } else {
        const data = await res.json() as { error?: string }
        setSaveError(data.error ?? 'Failed to save settings.')
      }
    } catch {
      setSaveError('Network error. Please try again.')
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

      <div className="space-y-4 border-t border-border pt-4">
      {enabled && (
        <>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">AI Provider</label>
            <div className="relative">
              <select
                value={provider}
                onChange={(e) => { setProvider(e.target.value); setModel('') }}
                disabled={demoMode}
                className="w-full appearance-none px-3 py-2 pr-8 border border-border rounded-lg text-sm bg-white text-ink focus:outline-none focus:border-green disabled:opacity-50 cursor-pointer"
              >
                {providers.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
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
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white text-ink focus:outline-none focus:border-green disabled:opacity-50"
            />
            <p className="text-xs text-muted mt-1">Leave blank to use the provider default.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">API Key</label>
            {removeApiKey ? (
              <div className="flex items-center gap-2 px-3 py-2 border border-red-200 rounded-lg bg-red-50 text-sm text-red-600">
                <span className="flex-1">Key will be removed on save — AI will use server environment variables.</span>
                <button type="button" onClick={() => setRemoveApiKey(false)} className="underline hover:no-underline shrink-0">Undo</button>
              </div>
            ) : (
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={demoMode}
                placeholder={hasApiKey ? '••••••••• (configured — enter new key to replace)' : 'Enter API key...'}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white text-ink focus:outline-none focus:border-green disabled:opacity-50"
              />
            )}
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-muted">
                {hasApiKey && !removeApiKey
                  ? 'Encrypted at rest.'
                  : !hasApiKey
                    ? 'Encrypted at rest. Leave blank to use server environment variables.'
                    : ''}
              </p>
              {hasApiKey && !removeApiKey && (
                <button
                  type="button"
                  onClick={() => { setRemoveApiKey(true); setApiKey('') }}
                  disabled={demoMode}
                  className="text-xs text-red-500 hover:underline disabled:opacity-50"
                >
                  Remove key
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Greeting Message</label>
            <input
              type="text"
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              disabled={demoMode}
              placeholder="Hi! How can I help you today?"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white text-ink focus:outline-none focus:border-green disabled:opacity-50"
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
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white text-ink resize-none focus:outline-none focus:border-green disabled:opacity-50"
            />
            <p className="text-xs text-muted mt-1">Prepended to the AI system prompt.</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-ink">Escalation Threshold</label>
              <span className="text-sm text-muted">{Math.round(threshold * 100)}% confidence required</span>
            </div>
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
            <div className="flex justify-between text-xs text-muted mt-0.5">
              <span>AI handles everything</span>
              <span>Always escalate</span>
            </div>
            <p className="text-xs text-muted mt-1">
              Hand off to a human agent when AI confidence is below this level.
            </p>
          </div>

          <div className="border-t border-border pt-4 space-y-4">
            <h3 className="text-sm font-medium text-ink">Product Context</h3>
            <div>
              <label className="block text-sm text-muted mb-1">
                Describe your product for AI article generation
              </label>
              <textarea
                value={productContext}
                onChange={(e) => setProductContext(e.target.value)}
                disabled={demoMode}
                rows={4}
                maxLength={4000}
                placeholder="We build a project management tool for remote teams. Key features: boards, sprints, tasks. Users: developers and PMs. Tone: friendly, concise, action-oriented."
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white text-ink resize-none focus:outline-none focus:border-green disabled:opacity-50"
              />
              <p className="text-xs text-muted mt-1">
                AI uses this when drafting KB articles automatically.
              </p>
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-ink">Auto-Draft: From Unanswered Questions</h3>
                <p className="text-xs text-muted mt-0.5">
                  Draft articles when customers ask questions AI cannot answer.
                </p>
              </div>
              <button
                onClick={() => setAutoDraftGapsEnabled(!autoDraftGapsEnabled)}
                disabled={demoMode}
                aria-checked={autoDraftGapsEnabled}
                role="switch"
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${autoDraftGapsEnabled ? 'bg-green' : 'bg-border'}`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${autoDraftGapsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            {autoDraftGapsEnabled && (
              <div>
                <label className="block text-sm font-medium text-ink mb-1">
                  Draft after <input
                    type="number"
                    min={1}
                    max={100}
                    value={autoDraftGapThreshold}
                    onChange={(e) => setAutoDraftGapThreshold(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    disabled={demoMode}
                    className="inline-block w-16 mx-1 px-2 py-0.5 border border-border rounded text-sm bg-white text-ink focus:outline-none focus:border-green disabled:opacity-50"
                  /> or more occurrences
                </label>
                <p className="text-xs text-muted mt-1">
                  Minimum number of times a question must be asked before an article is drafted.
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-border pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-ink">Auto-Draft: From Code Changes</h3>
                <p className="text-xs text-muted mt-0.5">
                  Allow GitHub Actions and CI pipelines to draft articles via API key.
                </p>
              </div>
              <button
                onClick={() => setAutoDraftExternalEnabled(!autoDraftExternalEnabled)}
                disabled={demoMode}
                aria-checked={autoDraftExternalEnabled}
                role="switch"
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${autoDraftExternalEnabled ? 'bg-green' : 'bg-border'}`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${autoDraftExternalEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            {autoDraftExternalEnabled && (
              <div>
                <label className="block text-sm font-medium text-ink mb-1">
                  Multi-repo batch window: <input
                    type="number"
                    min={1}
                    max={1440}
                    value={batchWindowMinutes}
                    onChange={(e) => setBatchWindowMinutes(Math.max(1, parseInt(e.target.value, 10) || 60))}
                    disabled={demoMode}
                    className="inline-block w-20 mx-1 px-2 py-0.5 border border-border rounded text-sm bg-white text-ink focus:outline-none focus:border-green disabled:opacity-50"
                  /> minutes
                </label>
                <p className="text-xs text-muted mt-1">
                  When using a shared feature ID across repos, wait this long after the last PR before generating.
                </p>
              </div>
            )}
          </div>

        </>
      )}

      {saveError && (
        <p className="text-sm text-red-500">{saveError}</p>
      )}
      <button
        onClick={handleSave}
        disabled={saving || demoMode}
        className="px-4 py-2 bg-green text-white rounded-lg text-sm font-medium hover:bg-green/90 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving...' : saved ? 'Saved!' : 'Save AI Settings'}
      </button>
      </div>
    </div>
  )
}
