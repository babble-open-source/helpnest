export interface VoiceOption {
  id: string
  provider: string
  name: string
  gender: 'female' | 'male'
  style: string
  language: string
  providerVoiceId: string
  providerModel?: string
}

export const VOICES: VoiceOption[] = [
  {
    id: 'inworld-ashley',
    provider: 'inworld',
    name: 'Ashley',
    gender: 'female',
    style: 'warm',
    language: 'en',
    providerVoiceId: 'Ashley',
    providerModel: 'inworld-tts-1.5-mini',
  },
  {
    id: 'inworld-olivia',
    provider: 'inworld',
    name: 'Olivia',
    gender: 'female',
    style: 'friendly',
    language: 'en',
    providerVoiceId: 'Olivia',
    providerModel: 'inworld-tts-1.5-mini',
  },
  {
    id: 'inworld-sarah',
    provider: 'inworld',
    name: 'Sarah',
    gender: 'female',
    style: 'professional',
    language: 'en',
    providerVoiceId: 'Sarah',
    providerModel: 'inworld-tts-1.5-mini',
  },
  {
    id: 'inworld-claire',
    provider: 'inworld',
    name: 'Claire',
    gender: 'female',
    style: 'calm',
    language: 'en',
    providerVoiceId: 'Claire',
    providerModel: 'inworld-tts-1.5-mini',
  },
  {
    id: 'inworld-priya',
    provider: 'inworld',
    name: 'Priya',
    gender: 'female',
    style: 'professional',
    language: 'en',
    providerVoiceId: 'Priya',
    providerModel: 'inworld-tts-1.5-mini',
  },
  {
    id: 'inworld-edward',
    provider: 'inworld',
    name: 'Edward',
    gender: 'male',
    style: 'professional',
    language: 'en',
    providerVoiceId: 'Edward',
    providerModel: 'inworld-tts-1.5-mini',
  },
  {
    id: 'inworld-james',
    provider: 'inworld',
    name: 'James',
    gender: 'male',
    style: 'calm',
    language: 'en',
    providerVoiceId: 'James',
    providerModel: 'inworld-tts-1.5-mini',
  },
  {
    id: 'inworld-oliver',
    provider: 'inworld',
    name: 'Oliver',
    gender: 'male',
    style: 'friendly',
    language: 'en',
    providerVoiceId: 'Oliver',
    providerModel: 'inworld-tts-1.5-mini',
  },
  {
    id: 'inworld-liam',
    provider: 'inworld',
    name: 'Liam',
    gender: 'male',
    style: 'warm',
    language: 'en',
    providerVoiceId: 'Liam',
    providerModel: 'inworld-tts-1.5-mini',
  },
  {
    id: 'inworld-ethan',
    provider: 'inworld',
    name: 'Ethan',
    gender: 'male',
    style: 'energetic',
    language: 'en',
    providerVoiceId: 'Ethan',
    providerModel: 'inworld-tts-1.5-mini',
  },
]

export function getVoiceById(id: string): VoiceOption | undefined {
  return VOICES.find((v) => v.id === id)
}

export function resolveVoiceFromSettings(
  settings: Record<string, unknown> | null
): VoiceOption | undefined {
  if (!settings) return undefined
  const provider = settings.provider as string
  const voiceId = (settings.voiceId ?? settings.voice) as string
  return VOICES.find((v) => v.provider === provider && v.providerVoiceId === voiceId)
}
