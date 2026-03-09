import { styles } from './styles'
import { searchArticles } from './search'
import type { SearchResult } from './search'

export interface WidgetConfig {
  workspace: string
  baseUrl: string
  position: 'bottom-right' | 'bottom-left'
  title: string
}

export class HelpPanel {
  private config: WidgetConfig
  private container: HTMLElement | null = null
  private panel: HTMLElement | null = null
  private isOpen = false
  private searchTimer: ReturnType<typeof setTimeout> | null = null

  constructor(config: WidgetConfig) {
    this.config = config
  }

  mount() {
    // Inject styles via shadow-safe style tag in head
    if (!document.getElementById('helpnest-styles')) {
      const style = document.createElement('style')
      style.id = 'helpnest-styles'
      style.textContent = styles
      document.head.appendChild(style)
    }

    // Create launcher container
    this.container = document.createElement('div')
    this.container.id = 'helpnest-launcher'
    if (this.config.position === 'bottom-left') {
      this.container.classList.add('position-left')
    }

    this.container.innerHTML = this.renderPanel() + this.renderButton()
    document.body.appendChild(this.container)

    this.panel = this.container.querySelector('#helpnest-panel')
    this.bindEvents()
  }

  private renderButton(): string {
    return `
      <button id="helpnest-btn" aria-label="Help">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
    `
  }

  private renderPanel(): string {
    const helpCenterUrl = `${this.config.baseUrl}/${this.config.workspace}/help`
    return `
      <div id="helpnest-panel" class="hidden">
        <div class="hn-panel-header">
          <h3>${this.config.title}</h3>
          <div class="hn-search-wrap">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              class="hn-search-input"
              placeholder="Search for answers..."
              autocomplete="off"
              spellcheck="false"
            />
          </div>
        </div>
        <div class="hn-panel-body">
          <ul class="hn-results-list">
            <li class="hn-empty">Type to search or browse our help center</li>
          </ul>
        </div>
        <div class="hn-panel-footer">
          <a href="${helpCenterUrl}" target="_blank" class="hn-footer-btn">
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Browse all articles
          </a>
          <button class="hn-footer-btn hn-ai-btn" disabled title="Coming soon">
            ✦ Ask AI
          </button>
        </div>
        <p class="hn-powered">Powered by <a href="https://helpnest.cloud" target="_blank">HelpNest</a></p>
      </div>
    `
  }

  private bindEvents() {
    const btn = this.container?.querySelector('#helpnest-btn')
    const input = this.container?.querySelector('.hn-search-input') as HTMLInputElement | null

    btn?.addEventListener('click', () => this.toggle())

    input?.addEventListener('input', () => {
      if (this.searchTimer) clearTimeout(this.searchTimer)
      this.searchTimer = setTimeout(() => {
        this.handleSearch(input.value.trim())
      }, 300)
    })

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (this.isOpen && !this.container?.contains(e.target as Node)) {
        this.close()
      }
    })

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close()
    })
  }

  private toggle() {
    this.isOpen ? this.close() : this.open()
  }

  private open() {
    this.isOpen = true
    this.panel?.classList.remove('hidden')
    const input = this.container?.querySelector('.hn-search-input') as HTMLInputElement | null
    setTimeout(() => input?.focus(), 100)
  }

  private close() {
    this.isOpen = false
    this.panel?.classList.add('hidden')
  }

  private async handleSearch(query: string) {
    const list = this.panel?.querySelector('.hn-results-list')
    if (!list) return

    if (query.length < 2) {
      list.innerHTML = '<li class="hn-empty">Type to search or browse our help center</li>'
      return
    }

    // Show skeleton
    list.innerHTML = `
      <li style="padding:8px 12px"><div class="hn-skeleton" style="width:80%"></div><div class="hn-skeleton" style="width:50%"></div></li>
      <li style="padding:8px 12px"><div class="hn-skeleton" style="width:70%"></div><div class="hn-skeleton" style="width:40%"></div></li>
    `

    const results = await searchArticles(query, this.config.workspace, this.config.baseUrl)

    if (results.length === 0) {
      list.innerHTML = `<li class="hn-empty">No results for "<strong>${this.escapeHtml(query)}</strong>"</li>`
      return
    }

    list.innerHTML = results.map((r) => `
      <li class="hn-result-item" data-url="${this.config.baseUrl}/${this.config.workspace}/help/${r.collection.slug}/${r.slug}">
        <p class="hn-result-title">${this.escapeHtml(r.title)}</p>
        <p class="hn-result-meta">${this.escapeHtml(r.collection.title)} · ${r.readTime} min read</p>
      </li>
    `).join('')

    list.querySelectorAll('.hn-result-item').forEach((item) => {
      item.addEventListener('click', () => {
        const url = (item as HTMLElement).dataset['url']
        if (url) window.open(url, '_blank')
      })
    })
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }
}
