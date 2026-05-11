// packages/widget/src/voice/orb.ts
import type { VoiceState } from '../types'

export function renderOrb(state: VoiceState): string {
  const stateLabel: Record<VoiceState, string> = {
    idle: 'Start voice assistant',
    connecting: 'Connecting...',
    listening: 'Listening...',
    thinking: 'Thinking...',
    speaking: 'Speaking...',
    error: 'Voice unavailable',
  }

  const statusText: Record<VoiceState, string> = {
    idle: 'Tap to start speaking',
    connecting: 'Connecting to voice...',
    listening: 'Listening...',
    thinking: 'Finding an answer...',
    speaking: '',
    error: 'Something went wrong. Try text chat.',
  }

  return `
    <div class="hn-voice-orb-container">
      <button
        class="hn-voice-orb hn-voice-orb--${state}"
        aria-label="${stateLabel[state]}"
        type="button"
      >
        <div class="hn-voice-orb__glow"></div>
        <div class="hn-voice-orb__core"></div>
        <div class="hn-voice-orb__ring"></div>
      </button>
      <p class="hn-voice-status" aria-live="assertive">${statusText[state]}</p>
    </div>
  `
}

export function getOrbStyles(): string {
  return `
    .hn-voice-orb-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 24px 0;
    }

    .hn-voice-orb {
      position: relative;
      width: 96px;
      height: 96px;
      border-radius: 50%;
      border: none;
      background: none;
      cursor: pointer;
      padding: 0;
      outline: none;
    }

    .hn-voice-orb:focus-visible {
      box-shadow: 0 0 0 3px var(--hn-accent);
      border-radius: 50%;
    }

    .hn-voice-orb__glow {
      position: absolute;
      inset: -8px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(200,98,42,0.3) 0%, transparent 70%);
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .hn-voice-orb__core {
      position: absolute;
      inset: 8px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--hn-accent) 0%, #e8854a 50%, var(--hn-accent) 100%);
      background-size: 200% 200%;
      transition: transform 0.3s ease;
    }

    .hn-voice-orb__ring {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 2px solid var(--hn-accent);
      opacity: 0.3;
      transition: opacity 0.3s ease, transform 0.3s ease;
    }

    .hn-voice-orb--idle .hn-voice-orb__core {
      animation: hn-orb-idle-pulse 3s ease-in-out infinite;
    }

    .hn-voice-orb--connecting .hn-voice-orb__ring {
      opacity: 0.8;
      animation: hn-orb-spin 1.5s linear infinite;
    }

    .hn-voice-orb--listening .hn-voice-orb__glow {
      opacity: 1;
      animation: hn-orb-breathe 1.5s ease-in-out infinite;
    }
    .hn-voice-orb--listening .hn-voice-orb__core {
      animation: hn-orb-listen-pulse 0.8s ease-in-out infinite;
      transform: scale(calc(1 + var(--hn-audio-level, 0) * 0.15));
    }

    .hn-voice-orb--thinking .hn-voice-orb__core {
      animation: hn-orb-gradient-rotate 1.2s linear infinite;
    }
    .hn-voice-orb--thinking .hn-voice-orb__ring {
      opacity: 0.6;
      animation: hn-orb-spin 2s linear infinite;
    }

    .hn-voice-orb--speaking .hn-voice-orb__glow {
      opacity: calc(0.4 + var(--hn-audio-level, 0) * 0.6);
    }
    .hn-voice-orb--speaking .hn-voice-orb__core {
      transform: scale(calc(1 + var(--hn-audio-level, 0) * 0.1));
      animation: hn-orb-gradient-rotate 2s linear infinite;
    }

    .hn-voice-orb--error .hn-voice-orb__core {
      background: var(--hn-muted);
      animation: none;
    }

    .hn-voice-status {
      font-size: 13px;
      color: var(--hn-muted);
      text-align: center;
      margin: 0;
      min-height: 18px;
    }

    @keyframes hn-orb-idle-pulse {
      0%, 100% { transform: scale(1); opacity: 0.85; }
      50% { transform: scale(1.04); opacity: 1; }
    }

    @keyframes hn-orb-breathe {
      0%, 100% { transform: scale(1); opacity: 0.5; }
      50% { transform: scale(1.1); opacity: 1; }
    }

    @keyframes hn-orb-listen-pulse {
      0%, 100% { opacity: 0.9; }
      50% { opacity: 1; }
    }

    @keyframes hn-orb-spin {
      to { transform: rotate(360deg); }
    }

    @keyframes hn-orb-gradient-rotate {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
  `
}
