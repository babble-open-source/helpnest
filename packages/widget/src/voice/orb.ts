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
        class="hn-voice-orb siri-orb hn-voice-orb--${state}"
        aria-label="${stateLabel[state]}"
        type="button"
        style="width:120px;height:120px;--bg:oklch(95% 0.02 264.695);--c1:oklch(75% 0.15 25);--c2:oklch(80% 0.12 200);--c3:oklch(78% 0.14 280);--animation-duration:20s;--blur-amount:4px;--contrast-amount:1.5;--dot-size:0.5px;--shadow-spread:2px;--mask-radius:25%"
      ></button>
      <p class="hn-voice-status" aria-live="assertive">${statusText[state]}</p>
    </div>
  `
}

export function getOrbStyles(): string {
  return `
    @property --angle {
      syntax: "<angle>";
      inherits: false;
      initial-value: 0deg;
    }

    .hn-voice-orb-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 24px 0;
    }

    .siri-orb {
      display: grid;
      grid-template-areas: "stack";
      overflow: hidden;
      border-radius: 50%;
      position: relative;
      border: none;
      padding: 0;
      cursor: pointer;
      outline: none;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }

    .siri-orb:focus-visible {
      box-shadow: 0 0 0 3px var(--hn-accent);
    }

    .siri-orb::before,
    .siri-orb::after {
      content: "";
      display: block;
      grid-area: stack;
      width: 100%;
      height: 100%;
      border-radius: 50%;
    }

    .siri-orb::before {
      background:
        conic-gradient(from calc(var(--angle) * 2) at 25% 70%, var(--c3), transparent 20% 80%, var(--c3)),
        conic-gradient(from calc(var(--angle) * 2) at 45% 75%, var(--c2), transparent 30% 60%, var(--c2)),
        conic-gradient(from calc(var(--angle) * -3) at 80% 20%, var(--c1), transparent 40% 60%, var(--c1)),
        conic-gradient(from calc(var(--angle) * 2) at 15% 5%, var(--c2), transparent 10% 90%, var(--c2)),
        conic-gradient(from calc(var(--angle) * 1) at 20% 80%, var(--c1), transparent 10% 90%, var(--c1)),
        conic-gradient(from calc(var(--angle) * -2) at 85% 10%, var(--c3), transparent 20% 80%, var(--c3));
      box-shadow: inset var(--bg) 0 0 var(--shadow-spread) calc(var(--shadow-spread) * 0.2);
      filter: blur(var(--blur-amount)) contrast(var(--contrast-amount));
      animation: hn-siri-rotate var(--animation-duration) linear infinite;
    }

    .siri-orb::after {
      background-image: radial-gradient(circle at center, var(--bg) var(--dot-size), transparent var(--dot-size));
      background-size: calc(var(--dot-size) * 2) calc(var(--dot-size) * 2);
      backdrop-filter: blur(calc(var(--blur-amount) * 2)) contrast(calc(var(--contrast-amount) * 2));
      mix-blend-mode: overlay;
      mask-image: radial-gradient(black var(--mask-radius), transparent 75%);
    }

    @keyframes hn-siri-rotate {
      to { --angle: 360deg; }
    }

    .hn-voice-orb--idle {
      --animation-duration: 20s;
    }

    .hn-voice-orb--connecting {
      --animation-duration: 8s;
      opacity: 0.7;
    }

    .hn-voice-orb--listening {
      --animation-duration: 6s;
      --c1: oklch(70% 0.2 25);
      --c2: oklch(75% 0.18 200);
      --c3: oklch(72% 0.2 280);
      transform: scale(1.05);
    }

    .hn-voice-orb--thinking {
      --animation-duration: 4s;
      --c1: oklch(65% 0.22 25);
      --c2: oklch(70% 0.2 200);
      --c3: oklch(68% 0.22 280);
    }

    .hn-voice-orb--speaking {
      --animation-duration: 3s;
      --c1: oklch(70% 0.25 25);
      --c2: oklch(75% 0.22 200);
      --c3: oklch(72% 0.25 280);
      transform: scale(1.08);
      box-shadow: 0 0 30px rgba(200, 98, 42, 0.2);
    }

    .hn-voice-orb--error {
      --animation-duration: 40s;
      --c1: oklch(70% 0.05 0);
      --c2: oklch(75% 0.05 0);
      --c3: oklch(72% 0.05 0);
      opacity: 0.5;
    }

    .hn-voice-status {
      font-size: 13px;
      color: var(--hn-muted);
      text-align: center;
      margin: 0;
      min-height: 18px;
    }

    @media (prefers-reduced-motion: reduce) {
      .siri-orb::before {
        animation: none;
      }
    }
  `
}
