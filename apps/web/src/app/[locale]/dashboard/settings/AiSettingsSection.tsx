'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

interface Props {
  aiEnabled: boolean
  aiProvider: string | null
  aiModel: string | null
  aiGreeting: string | null
  aiInstructions: string | null
  aiEscalationThreshold: number
  hasApiKey: boolean
  cloudMode?: boolean
  planTier?: string
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
  cloudMode = false,
  planTier = 'FREE',
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
  const t = useTranslations('aiSettings')
  const tc = useTranslations('common')
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
        setSaveError(data.error ?? tc('somethingWentWrong'))
      }
    } catch {
      setSaveError(tc('networkError'))
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
          <h2 className="font-medium text-ink">{t('title')}</h2>
          <p className="text-sm text-muted mt-0.5">
            {t('description')}
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
            <label className="block text-sm font-medium text-ink mb-1">{t('provider')}</label>
            <div className="relative">
              <select
                value={provider}
                onChange={(e) => { setProvider(e.target.value); setModel('') }}
                disabled={demoMode}
                className="w-full appearance-none px-3 py-2 pe-8 border border-border rounded-lg text-sm bg-white text-ink focus:outline-none focus:border-green disabled:opacity-50 cursor-pointer"
              >
                {providers.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              <svg className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">{t('model')}</label>
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
            <p className="text-xs text-muted mt-1">{t('modelHelp')}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">
              {t('apiKey')}
              {cloudMode && planTier === 'FREE' && (
                <span className="ms-2 text-xs font-normal text-muted bg-border px-1.5 py-0.5 rounded">PRO</span>
              )}
            </label>
            {cloudMode && planTier === 'FREE' ? (
              <div className="rounded-lg border border-border bg-cream/50 p-4 text-center">
                <p className="text-sm text-ink mb-1">Bring your own API key is a Pro feature</p>
                <p className="text-xs text-muted mb-2">Upgrade to use your own API key for unlimited AI — search, agent, and drafts.</p>
                <a href="/dashboard/billing" className="text-xs font-medium text-accent hover:underline">Upgrade to Pro →</a>
              </div>
            ) : (
              <>
                {removeApiKey ? (
                  <div className="flex items-center gap-2 px-3 py-2 border border-red-200 rounded-lg bg-red-50 text-sm text-red-600">
                    <span className="flex-1">{t('keyRemoved')}</span>
                    <button type="button" onClick={() => setRemoveApiKey(false)} className="underline hover:no-underline shrink-0">{t('undo')}</button>
                  </div>
                ) : (
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    disabled={demoMode}
                    placeholder={hasApiKey ? t('apiKeyConfigured') : t('apiKeyEnter')}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white text-ink focus:outline-none focus:border-green disabled:opacity-50"
                  />
                )}
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted">
                    {hasApiKey && !removeApiKey
                      ? 'Powers all AI features (search, agent, drafts). Unlimited usage with your own key.'
                      : !hasApiKey
                        ? 'Add your API key for unlimited AI. Leave empty to use included AI credits.'
                        : ''}
                  </p>
                  {hasApiKey && !removeApiKey && (
                    <button
                      type="button"
                      onClick={() => { setRemoveApiKey(true); setApiKey('') }}
                      disabled={demoMode}
                      className="text-xs text-red-500 hover:underline disabled:opacity-50"
                    >
                      {t('removeKey')}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">{t('greeting')}</label>
            <input
              type="text"
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              disabled={demoMode}
              placeholder={t('greetingPlaceholder')}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white text-ink focus:outline-none focus:border-green disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">{t('instructions')}</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              disabled={demoMode}
              rows={4}
              placeholder={t('instructionsPlaceholder')}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white text-ink resize-none focus:outline-none focus:border-green disabled:opacity-50"
            />
            <p className="text-xs text-muted mt-1">{t('instructionsHelp')}</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-ink">{t('escalationThreshold')}</label>
              <span className="text-sm text-muted">{t('confidenceRequired', { value: Math.round(threshold * 100) })}</span>
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
              <span>{t('handleEverything')}</span>
              <span>{t('alwaysEscalate')}</span>
            </div>
            <p className="text-xs text-muted mt-1">
              {t('escalationHelp')}
            </p>
          </div>

          <div className="border-t border-border pt-4 space-y-4">
            <h3 className="text-sm font-medium text-ink">{t('productContext')}</h3>
            <div>
              <label className="block text-sm text-muted mb-1">
                {t('productContextLabel')}
              </label>
              <textarea
                value={productContext}
                onChange={(e) => setProductContext(e.target.value)}
                disabled={demoMode}
                rows={4}
                maxLength={4000}
                placeholder={t('productContextPlaceholder')}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white text-ink resize-none focus:outline-none focus:border-green disabled:opacity-50"
              />
              <p className="text-xs text-muted mt-1">
                {t('productContextHelp')}
              </p>
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-ink">{t('autoDraftQuestions')}</h3>
                <p className="text-xs text-muted mt-0.5">
                  {t('autoDraftQuestionsHelp')}
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
                  {t('draftAfter')} <input
                    type="number"
                    min={1}
                    max={100}
                    value={autoDraftGapThreshold}
                    onChange={(e) => setAutoDraftGapThreshold(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    disabled={demoMode}
                    className="inline-block w-16 mx-1 px-2 py-0.5 border border-border rounded text-sm bg-white text-ink focus:outline-none focus:border-green disabled:opacity-50"
                  /> {t('orMoreOccurrences')}
                </label>
                <p className="text-xs text-muted mt-1">
                  {t('autoDraftThresholdHelp')}
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-border pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-ink">{t('autoDraftCode')}</h3>
                <p className="text-xs text-muted mt-0.5">
                  {t('autoDraftCodeHelp')}
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
                  {t('batchWindow')} <input
                    type="number"
                    min={1}
                    max={1440}
                    value={batchWindowMinutes}
                    onChange={(e) => setBatchWindowMinutes(Math.max(1, parseInt(e.target.value, 10) || 60))}
                    disabled={demoMode}
                    className="inline-block w-20 mx-1 px-2 py-0.5 border border-border rounded text-sm bg-white text-ink focus:outline-none focus:border-green disabled:opacity-50"
                  /> {t('minutes')}
                </label>
                <p className="text-xs text-muted mt-1">
                  {t('batchWindowHelp')}
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
        {saving ? tc('saving') : saved ? t('saved') : t('saveAiSettings')}
      </button>
      </div>
    </div>
  )
}
