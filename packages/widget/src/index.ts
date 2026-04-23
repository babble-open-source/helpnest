import { HelpNestWidget } from './widget'

function init() {
  const script = document.currentScript as HTMLScriptElement | null
    ?? document.querySelector('script[data-workspace]') as HTMLScriptElement | null

  if (!script) return

  const workspace = script.dataset['workspace']
  if (!workspace) {
    console.warn('[HelpNest] Missing data-workspace attribute')
    return
  }

  const baseUrl = script.dataset['baseUrl']
    ?? (typeof window !== 'undefined' ? window.location.origin : '')

  const position = (script.dataset['position'] as 'bottom-right' | 'bottom-left') ?? 'bottom-right'

  const widget = new HelpNestWidget({ workspace, baseUrl, position })

  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => widget.mount(), { timeout: 2000 })
  } else {
    setTimeout(() => widget.mount(), 0)
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
