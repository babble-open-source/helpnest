import { getState, pushView, setSearchQuery, setSearchResults } from '../state'
import { searchArticles } from '../api'
import { renderHeader } from '../components/header'
import { renderSearchBar } from '../components/search-bar'

import type { CollectionNode } from '../types'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  return str.slice(0, max) + '…'
}

function renderCollectionCard(col: CollectionNode): string {
  return `
    <button class="hn-col-card" type="button" data-action="open-collection" data-collection-id="${escapeHtml(col.id)}" data-collection-title="${escapeHtml(col.title)}">
      <div class="hn-col-card-body">
        <span class="hn-col-card-title">${escapeHtml(col.title)}</span>
        ${col.description ? `<span class="hn-col-card-desc">${escapeHtml(truncate(col.description, 80))}</span>` : ''}
        <span class="hn-col-card-count">${col.articleCount} article${col.articleCount !== 1 ? 's' : ''}</span>
      </div>
      <svg class="hn-col-card-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </button>
  `
}

export function renderHelp(): string {
  const { config, searchQuery } = getState()
  if (!config) return ''

  return `
    <div class="hn-view hn-view-help">
      ${renderHeader({ title: 'Help', showClose: true })}
      <div class="hn-help-search-wrap">
        ${renderSearchBar('Search articles…')}
        <button class="hn-search-clear" type="button" aria-label="Clear search" ${searchQuery ? '' : 'style="display:none"'}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="hn-view-body hn-view-body-flush">
        ${renderBodyContent()}
      </div>
    </div>
  `
}

function renderBodyContent(): string {
  const { collections, searchQuery, searchResults } = getState()
  const isSearching = searchQuery.length >= 2

  if (isSearching) {
    return searchResults.length > 0
      ? `<div class="hn-help-results">
          ${searchResults.map((article) => `
            <button class="hn-article-row" type="button" data-action="open-article" data-article-id="${escapeHtml(article.id)}">
              <span class="hn-article-row-title">${escapeHtml(article.title)}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          `).join('')}
        </div>`
      : `<div class="hn-help-no-results">
          <p>No results for "<strong>${escapeHtml(searchQuery)}</strong>"</p>
        </div>`
  }

  return `<div class="hn-help-collections">
    <p class="hn-help-count">${collections.length} collection${collections.length !== 1 ? 's' : ''}</p>
    ${collections.map(renderCollectionCard).join('')}
  </div>`
}

function updateBody(container: HTMLElement) {
  const body = container.querySelector('.hn-view-body') as HTMLElement | null
  if (!body) return
  body.innerHTML = renderBodyContent()
  bindResultEvents(container)
}

function bindResultEvents(container: HTMLElement) {
  container.querySelectorAll('[data-action="open-collection"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const collectionId = (btn as HTMLElement).dataset.collectionId
      const title = (btn as HTMLElement).dataset.collectionTitle
      if (collectionId && title) {
        pushView({ kind: 'collection-detail', collectionId, title })
      }
    })
  })

  container.querySelectorAll('[data-action="open-article"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const articleId = (btn as HTMLElement).dataset.articleId
      if (articleId) {
        pushView({ kind: 'article', articleId })
      }
    })
  })
}

export function bindHelpEvents(container: HTMLElement, _rerenderFn: () => void): void {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  const searchWrap = container.querySelector('.hn-help-search-wrap')
  searchWrap?.addEventListener('input', (e) => {
    const input = e.target as HTMLInputElement
    if (!input.classList.contains('hn-search-input')) return
    const query = input.value.trim()
    setSearchQuery(query)

    if (debounceTimer) clearTimeout(debounceTimer)

    if (query.length < 2) {
      setSearchResults([])
      updateBody(container)
      return
    }

    debounceTimer = setTimeout(async () => {
      const results = await searchArticles(query)
      setSearchResults(results)
      updateBody(container)
    }, 300)
  })

  container.querySelector('.hn-search-clear')?.addEventListener('click', () => {
    setSearchQuery('')
    setSearchResults([])
    const searchInput = container.querySelector('.hn-search-input') as HTMLInputElement | null
    if (searchInput) searchInput.value = ''
    updateBody(container)
  })

  bindResultEvents(container)

  container.querySelector('.hn-header-close')?.addEventListener('click', () => {
    container.dispatchEvent(new CustomEvent('hn:close', { bubbles: true }))
  })
}
