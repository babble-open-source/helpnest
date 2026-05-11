'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { VOICES, resolveVoiceFromSettings } from '@/lib/voices'

interface Props {
  voiceEnabled: boolean
  voiceGreeting: string | null
  voiceLanguage: string | null
  voiceSettings: Record<string, unknown> | null
  demoMode: boolean
}

export function VoiceSettingsSection({
  voiceEnabled: initialEnabled,
  voiceGreeting: initialGreeting,
  voiceLanguage: initialLanguage,
  voiceSettings: initialSettings,
  demoMode,
}: Props) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [greeting, setGreeting] = useState(initialGreeting ?? '')
  const [language, setLanguage] = useState(initialLanguage ?? 'en')
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(() => {
    const matched = resolveVoiceFromSettings(initialSettings)
    return matched?.id ?? 'inworld-ashley'
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function handleSave() {
    if (demoMode) return
    setSaving(true)
    setSaved(false)
    setSaveError(null)
    try {
      const voice = VOICES.find((v) => v.id === selectedVoiceId)
      const res = await fetch('/api/workspace/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceEnabled: enabled,
          voiceGreeting: greeting || null,
          voiceLanguage: language,
          voiceSettings: voice
            ? {
                provider: voice.provider,
                voice: voice.providerVoiceId,
                voiceId: voice.providerVoiceId,
                model: voice.providerModel,
              }
            : null,
        }),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } else {
        const data = (await res.json()) as { error?: string }
        setSaveError(data.error ?? 'Something went wrong')
      }
    } catch {
      setSaveError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-medium">Voice Assistant</CardTitle>
            <CardDescription className="mt-0.5">
              Let customers ask questions using their voice.
            </CardDescription>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={setEnabled}
            disabled={demoMode}
            aria-label="Enable voice assistant"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Separator />

          {enabled && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="voice-greeting">Greeting</Label>
                <Input
                  id="voice-greeting"
                  type="text"
                  value={greeting}
                  onChange={(e) => setGreeting(e.target.value)}
                  disabled={demoMode}
                  placeholder="Hi! Ask me anything about your product."
                />
                <p className="text-xs text-muted-foreground">
                  The first thing the voice assistant says when a customer opens it.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="voice-language">Language</Label>
                <Select value={language} onValueChange={setLanguage} disabled={demoMode}>
                  <SelectTrigger id="voice-language" className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="de">German</SelectItem>
                    <SelectItem value="hi">Hindi</SelectItem>
                    <SelectItem value="ta">Tamil</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Voice</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {VOICES.map((voice) => (
                    <button
                      key={voice.id}
                      type="button"
                      disabled={demoMode}
                      onClick={() => setSelectedVoiceId(voice.id)}
                      className={`flex flex-col items-start rounded-lg border p-3 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        selectedVoiceId === voice.id
                          ? 'border-accent bg-accent/5'
                          : 'border-border hover:border-muted'
                      }`}
                    >
                      <span className="font-medium">{voice.name}</span>
                      <span className="text-xs text-muted-foreground capitalize">
                        {voice.gender} &middot; {voice.style}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {saveError && <p className="text-sm text-destructive">{saveError}</p>}
          <Button onClick={handleSave} disabled={saving || demoMode}>
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save voice settings'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
