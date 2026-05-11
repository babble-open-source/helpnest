import { renderOrb } from '../voice/orb'
import { getState, setVoiceState } from '../state'
import type { VoiceState } from '../types'

export function renderVoice(): string {
  const state = getState()
  const voiceState = state.voiceState
  const greeting = state.config?.voiceGreeting ?? 'Ask me anything'

  return `
    <div class="hn-voice-view">
      ${renderOrb(voiceState)}
      <div class="hn-voice-transcript" role="log" aria-live="polite">
        <div class="hn-voice-transcript__messages"></div>
      </div>
      <div class="hn-voice-sources"></div>
      <div class="hn-voice-text-fallback">
        <input
          type="text"
          class="hn-voice-text-input"
          placeholder="Type a message instead..."
          aria-label="Type a message instead of speaking"
        />
      </div>
    </div>
  `
}

export function bindVoiceEvents(panel: HTMLElement) {
  const orbButton = panel.querySelector('.hn-voice-orb') as HTMLButtonElement | null
  if (!orbButton) return

  orbButton.addEventListener('click', () => {
    const currentState = getState().voiceState
    if (currentState === 'idle' || currentState === 'error') {
      setVoiceState('connecting')
      panel.dispatchEvent(new CustomEvent('hn-voice-start'))
    } else {
      setVoiceState('idle')
      panel.dispatchEvent(new CustomEvent('hn-voice-stop'))
    }
  })

  const textInput = panel.querySelector('.hn-voice-text-input') as HTMLInputElement | null
  if (textInput) {
    textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && textInput.value.trim()) {
        panel.dispatchEvent(
          new CustomEvent('hn-voice-text-fallback', {
            detail: { message: textInput.value.trim() },
          })
        )
        textInput.value = ''
      }
    })
  }
}

export function appendTranscript(panel: HTMLElement, role: 'user' | 'agent', text: string) {
  const container = panel.querySelector('.hn-voice-transcript__messages')
  if (!container) return
  const div = document.createElement('div')
  div.className = `hn-voice-transcript__msg hn-voice-transcript__msg--${role}`
  div.textContent = role === 'user' ? `You: ${text}` : `AI: ${text}`
  container.appendChild(div)
  container.scrollTop = container.scrollHeight
}

export function setSourceChips(
  panel: HTMLElement,
  sources: { id: string; title: string; slug: string }[]
) {
  const container = panel.querySelector('.hn-voice-sources')
  if (!container) return
  container.innerHTML = sources
    .map(
      (s) =>
        `<button class="hn-voice-source-chip" data-article-id="${s.id}" data-slug="${s.slug}">${s.title}</button>`
    )
    .join('')
}
