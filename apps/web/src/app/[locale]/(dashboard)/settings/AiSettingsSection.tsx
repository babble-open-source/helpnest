'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Props {
  aiEnabled: boolean
  aiProvider: string | null
  aiModel: string | null
  aiGreeting: string | null
  aiInstructions: string | null
  aiEscalationThreshold: number
  hasApiKey: boolean
  cloudMode?: boolean
  billingEnabled?: boolean
  planTier?: string
  demoMode: boolean
  productContext: string | null
  autoDraftGapsEnabled: boolean
  autoDraftGapThreshold: number
  autoDraftExternalEnabled: boolean
  batchWindowMinutes: number
  aiDraftRateLimit: number
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
  billingEnabled = false,
  planTier = 'FREE',
  demoMode,
  productContext: initProductContext,
  autoDraftGapsEnabled: initAutoDraftGapsEnabled,
  autoDraftGapThreshold: initAutoDraftGapThreshold,
  autoDraftExternalEnabled: initAutoDraftExternalEnabled,
  batchWindowMinutes: initBatchWindowMinutes,
  aiDraftRateLimit: initAiDraftRateLimit,
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
  const [autoDraftExternalEnabled, setAutoDraftExternalEnabled] = useState(
    initAutoDraftExternalEnabled
  )
  const [batchWindowMinutes, setBatchWindowMinutes] = useState(initBatchWindowMinutes)
  const [aiDraftRateLimit, setAiDraftRateLimit] = useState(initAiDraftRateLimit)
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
        aiDraftRateLimit,
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
        const data = (await res.json()) as { error?: string }
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-medium">{t('title')}</CardTitle>
            <CardDescription className="mt-0.5">{t('description')}</CardDescription>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={setEnabled}
            disabled={demoMode}
            aria-label={t('title')}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Separator />

          {enabled && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="ai-provider">{t('provider')}</Label>
                <Select
                  value={provider}
                  onValueChange={(v) => {
                    setProvider(v)
                    setModel('')
                  }}
                  disabled={demoMode}
                >
                  <SelectTrigger id="ai-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ai-model">{t('model')}</Label>
                <Input
                  id="ai-model"
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
                />
                <p className="text-xs text-muted-foreground">{t('modelHelp')}</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ai-api-key">
                  {t('apiKey')}
                  {cloudMode && planTier === 'FREE' && (
                    <span className="ms-2 text-xs font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      PRO
                    </span>
                  )}
                </Label>
                {cloudMode && planTier === 'FREE' ? (
                  <div className="rounded-lg border bg-muted/50 p-4 text-center">
                    <p className="text-sm text-foreground mb-1">
                      Bring your own API key is a Pro feature
                    </p>
                    <p className="text-xs text-muted-foreground mb-2">
                      Upgrade to use your own API key for unlimited AI — search, agent, and drafts.
                    </p>
                    {billingEnabled && (
                      <Link
                        href="/billing"
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Upgrade to Pro →
                      </Link>
                    )}
                  </div>
                ) : (
                  <>
                    {removeApiKey ? (
                      <div className="flex items-center gap-2 px-3 py-2 border border-destructive/30 rounded-md bg-destructive/5 text-sm text-destructive">
                        <span className="flex-1">{t('keyRemoved')}</span>
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          onClick={() => setRemoveApiKey(false)}
                          className="h-auto p-0 text-destructive underline hover:no-underline shrink-0"
                        >
                          {t('undo')}
                        </Button>
                      </div>
                    ) : (
                      <Input
                        id="ai-api-key"
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        disabled={demoMode}
                        placeholder={hasApiKey ? t('apiKeyConfigured') : t('apiKeyEnter')}
                      />
                    )}
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {hasApiKey && !removeApiKey
                          ? 'Powers all AI features (search, agent, drafts). Unlimited usage with your own key.'
                          : !hasApiKey
                            ? 'Add your API key for unlimited AI. Leave empty to use included AI credits.'
                            : ''}
                      </p>
                      {hasApiKey && !removeApiKey && (
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          onClick={() => {
                            setRemoveApiKey(true)
                            setApiKey('')
                          }}
                          disabled={demoMode}
                          className="h-auto p-0 text-destructive hover:text-destructive/80"
                        >
                          {t('removeKey')}
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ai-greeting">{t('greeting')}</Label>
                <Input
                  id="ai-greeting"
                  type="text"
                  value={greeting}
                  onChange={(e) => setGreeting(e.target.value)}
                  disabled={demoMode}
                  placeholder={t('greetingPlaceholder')}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ai-instructions">{t('instructions')}</Label>
                <Textarea
                  id="ai-instructions"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  disabled={demoMode}
                  rows={4}
                  placeholder={t('instructionsPlaceholder')}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">{t('instructionsHelp')}</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{t('escalationThreshold')}</Label>
                  <span className="text-sm text-muted-foreground">
                    {t('confidenceRequired', { value: Math.round(threshold * 100) })}
                  </span>
                </div>
                <Slider
                  min={0}
                  max={1}
                  step={0.05}
                  value={[threshold]}
                  onValueChange={([v]) => setThreshold(v!)}
                  disabled={demoMode}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{t('handleEverything')}</span>
                  <span>{t('alwaysEscalate')}</span>
                </div>
                <p className="text-xs text-muted-foreground">{t('escalationHelp')}</p>
              </div>

              <Separator />
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">{t('productContext')}</h3>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="ai-product-context"
                    className="text-sm text-muted-foreground font-normal"
                  >
                    {t('productContextLabel')}
                  </Label>
                  <Textarea
                    id="ai-product-context"
                    value={productContext}
                    onChange={(e) => setProductContext(e.target.value)}
                    disabled={demoMode}
                    rows={4}
                    maxLength={4000}
                    placeholder={t('productContextPlaceholder')}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">{t('productContextHelp')}</p>
                </div>
              </div>

              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-foreground">
                      {t('autoDraftQuestions')}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('autoDraftQuestionsHelp')}
                    </p>
                  </div>
                  <Switch
                    checked={autoDraftGapsEnabled}
                    onCheckedChange={setAutoDraftGapsEnabled}
                    disabled={demoMode}
                  />
                </div>
                {autoDraftGapsEnabled && (
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-foreground">
                      {t('draftAfter')}{' '}
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={autoDraftGapThreshold}
                        onChange={(e) =>
                          setAutoDraftGapThreshold(Math.max(1, parseInt(e.target.value, 10) || 1))
                        }
                        disabled={demoMode}
                        className="inline-block w-16 mx-1 h-7 py-0.5 text-sm"
                      />{' '}
                      {t('orMoreOccurrences')}
                    </Label>
                    <p className="text-xs text-muted-foreground">{t('autoDraftThresholdHelp')}</p>
                  </div>
                )}
              </div>

              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-foreground">{t('autoDraftCode')}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('autoDraftCodeHelp')}</p>
                  </div>
                  <Switch
                    checked={autoDraftExternalEnabled}
                    onCheckedChange={setAutoDraftExternalEnabled}
                    disabled={demoMode}
                  />
                </div>
                {autoDraftExternalEnabled && (
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-foreground">
                      {t('batchWindow')}{' '}
                      <Input
                        type="number"
                        min={1}
                        max={1440}
                        value={batchWindowMinutes}
                        onChange={(e) =>
                          setBatchWindowMinutes(Math.max(1, parseInt(e.target.value, 10) || 60))
                        }
                        disabled={demoMode}
                        className="inline-block w-20 mx-1 h-7 py-0.5 text-sm"
                      />{' '}
                      {t('minutes')}
                    </Label>
                    <p className="text-xs text-muted-foreground">{t('batchWindowHelp')}</p>
                  </div>
                )}
              </div>

              <Separator />
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-medium text-foreground">{t('draftRateLimit')}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('draftRateLimitHelp')}</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-foreground">
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      value={aiDraftRateLimit}
                      onChange={(e) =>
                        setAiDraftRateLimit(
                          Math.max(1, Math.min(500, parseInt(e.target.value, 10) || 50))
                        )
                      }
                      disabled={demoMode}
                      className="inline-block w-20 me-1 h-7 py-0.5 text-sm"
                    />{' '}
                    {t('perHour')}
                  </Label>
                </div>
              </div>
            </>
          )}

          {saveError && <p className="text-sm text-destructive">{saveError}</p>}
          <Button onClick={handleSave} disabled={saving || demoMode}>
            {saving ? tc('saving') : saved ? t('saved') : t('saveAiSettings')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
