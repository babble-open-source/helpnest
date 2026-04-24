import { getState, switchTabAndPush, switchTab } from '../state'
import type { CollectionNode } from '../types'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderHome(): string {
  const { config, collections } = getState()
  if (!config) return ''

  const logoHtml = config.logo
    ? `<img class="hn-home-logo" src="${escapeHtml(config.logo)}" alt="${escapeHtml(config.name)}" />`
    : `<div class="hn-home-logo-fallback">${escapeHtml(config.name.charAt(0).toUpperCase())}</div>`

  const ctaCard = config.aiEnabled
    ? `<button class="hn-home-cta" type="button" data-action="send-message">
        <div class="hn-home-cta-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <div class="hn-home-cta-text">
          <span class="hn-home-cta-title">Send us a message</span>
          ${config.widgetResponseTime ? `<span class="hn-home-cta-subtitle">${escapeHtml(config.widgetResponseTime)}</span>` : ''}
        </div>
        <svg class="hn-home-cta-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>`
    : ''

  const topCollections = collections.slice(0, 3)

  const collectionsHtml = topCollections.length > 0
    ? `<div class="hn-home-section">
        <div class="hn-home-section-header">
          <span class="hn-home-section-title">Collections</span>
          <button class="hn-home-view-all" type="button" data-action="view-all">View all</button>
        </div>
        <div class="hn-home-collections">
          ${topCollections.map((col) => renderCollectionCard(col)).join('')}
        </div>
      </div>`
    : ''

  return `
    <div class="hn-view hn-view-home">
      <div class="hn-home-hero">
        <button class="hn-home-close" type="button" aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        ${logoHtml}
        <h2 class="hn-home-greeting">${escapeHtml(config.aiGreeting)}</h2>
      </div>

      <div class="hn-home-body">
        ${ctaCard}
        ${collectionsHtml}
      </div>

      <div class="hn-home-footer">
        <span class="hn-powered-by">Powered by <a href="https://helpnest.cloud" target="_blank" rel="noopener">HelpNest</a></span>
      </div>

    </div>
  `
}

function renderCollectionCard(col: CollectionNode): string {
  return `
    <button class="hn-home-collection-card" type="button" data-action="open-collection" data-collection-id="${escapeHtml(col.id)}" data-collection-title="${escapeHtml(col.title)}">
      <div class="hn-home-collection-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
        </svg>
      </div>
      <div class="hn-home-collection-info">
        <span class="hn-home-collection-title">${escapeHtml(col.title)}</span>
        <span class="hn-home-collection-count">${col.articleCount} article${col.articleCount !== 1 ? 's' : ''}</span>
      </div>
      <svg class="hn-home-collection-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </button>
  `
}

export function bindHomeEvents(container: HTMLElement): void {
  container.querySelector('.hn-home-close')?.addEventListener('click', () => {
    container.dispatchEvent(new CustomEvent('hn:close', { bubbles: true }))
  })

  container.querySelector('[data-action="send-message"]')?.addEventListener('click', () => {
    switchTabAndPush('messages', { kind: 'chat', forceNew: true })
  })

  container.querySelector('[data-action="view-all"]')?.addEventListener('click', () => {
    switchTab('help')
  })

  container.querySelectorAll('[data-action="open-collection"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const collectionId = (btn as HTMLElement).dataset.collectionId
      const title = (btn as HTMLElement).dataset.collectionTitle
      if (collectionId && title) {
        switchTabAndPush('help', { kind: 'collection-detail', collectionId, title })
      }
    })
  })
}
