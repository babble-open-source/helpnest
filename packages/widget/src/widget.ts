import type { InitConfig, TabId, ViewType } from './types'
import { getState, subscribe, setConfig, setOpen, switchTab, popView, setCollections, setConversations } from './state'
import { initApi, fetchConfig, fetchCollections, fetchConversations } from './api'
import { renderHome, bindHomeEvents } from './views/home'
import { renderMessages, bindMessagesEvents } from './views/messages'
import { renderHelp, bindHelpEvents } from './views/help'
import { renderChat, bindChatEvents, initChatView, setChatRerender } from './views/chat'
import { renderCollectionDetail, bindCollectionDetailEvents, loadCollectionDetail } from './views/collection-detail'
import { renderArticle, bindArticleEvents, loadArticle } from './views/article'
import { widgetStyles } from './styles'

const STORAGE_SESSION_KEY = 'helpnest:session:'

export class HelpNestWidget {
  private initConfig: InitConfig
  private root: HTMLElement | null = null
  private shadow: ShadowRoot | null = null
  private panel: HTMLElement | null = null
  private launcher: HTMLElement | null = null
  private unsubscribe: (() => void) | null = null
  private rendering = false

  constructor(config: InitConfig) {
    this.initConfig = config
  }

  mount() {
    this.root = document.createElement('div')
    this.root.id = 'helpnest-widget-root'
    this.shadow = this.root.attachShadow({ mode: 'open' })

    const style = document.createElement('style')
    style.textContent = widgetStyles
    this.shadow.appendChild(style)

    this.launcher = document.createElement('button')
    this.launcher.className = `hn-launcher ${this.initConfig.position === 'bottom-left' ? 'hn-launcher-left' : ''}`
    this.launcher.setAttribute('aria-label', 'Open help')
    this.launcher.innerHTML = `
      <svg class="hn-launcher-open" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <svg class="hn-launcher-close" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    `
    this.shadow.appendChild(this.launcher)

    this.panel = document.createElement('div')
    this.panel.className = 'hn-panel hn-panel-hidden'
    this.shadow.appendChild(this.panel)

    document.body.appendChild(this.root)

    this.launcher.addEventListener('click', () => this.toggle())

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && getState().isOpen) this.close()
    })

    this.unsubscribe = subscribe(() => void this.render())

    void this.initialize()
  }

  private async initialize() {
    initApi(this.initConfig.baseUrl, this.initConfig.workspace)

    try {
      const config = await fetchConfig()
      ;(config as unknown as Record<string, unknown>)._baseUrl = this.initConfig.baseUrl
      setConfig(config)

      const collections = await fetchCollections()
      setCollections(collections)

      this.applyTheme(config.theme)

      if (this.launcher) {
        this.launcher.style.opacity = '1'
      }
    } catch (err) {
      console.error('[HelpNest] Failed to initialize widget:', err)
    }
  }

  private applyTheme(theme: { vars: Record<string, string>; fontUrls: string[] }) {
    if (!this.shadow) return

    for (const url of theme.fontUrls) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = url
      this.shadow.appendChild(link)
    }

    const host = this.shadow.host as HTMLElement
    for (const [key, value] of Object.entries(theme.vars)) {
      host.style.setProperty(key, value)
    }
  }

  private toggle() {
    getState().isOpen ? this.close() : this.open()
  }

  private open() {
    setOpen(true)
    this.panel?.classList.remove('hn-panel-hidden')
    const openIcon = this.launcher?.querySelector('.hn-launcher-open') as HTMLElement | null
    const closeIcon = this.launcher?.querySelector('.hn-launcher-close') as HTMLElement | null
    if (openIcon) openIcon.style.display = 'none'
    if (closeIcon) closeIcon.style.display = ''

    const { config, activeTab } = getState()
    if (activeTab === 'messages' && config?.aiEnabled) {
      void this.refreshConversations()
    }
  }

  private close() {
    setOpen(false)
    this.panel?.classList.add('hn-panel-hidden')
    const openIcon = this.launcher?.querySelector('.hn-launcher-open') as HTMLElement | null
    const closeIcon = this.launcher?.querySelector('.hn-launcher-close') as HTMLElement | null
    if (openIcon) openIcon.style.display = ''
    if (closeIcon) closeIcon.style.display = 'none'
  }

  private async refreshConversations() {
    const sessionToken = this.getSessionToken()
    if (!sessionToken) return
    const conversations = await fetchConversations(sessionToken)
    setConversations(conversations)
  }

  private getSessionToken(): string | null {
    return localStorage.getItem(STORAGE_SESSION_KEY + this.initConfig.workspace) ?? null
  }

  private async render() {
    if (this.rendering || !this.panel || !this.shadow) return
    const state = getState()
    if (!state.config) return

    this.rendering = true

    try {
      const view = state.viewStack[state.viewStack.length - 1] ?? { kind: state.activeTab }
      let viewHtml = ''

      switch (view.kind) {
        case 'home':
          viewHtml = renderHome()
          break
        case 'messages':
          viewHtml = renderMessages()
          break
        case 'help':
          viewHtml = renderHelp()
          break
        case 'chat':
          await initChatView(view.conversationId)
          viewHtml = renderChat()
          break
        case 'collection-detail': {
          const data = await loadCollectionDetail(view.collectionId, state.collections)
          viewHtml = renderCollectionDetail(data)
          break
        }
        case 'article': {
          const article = await loadArticle(view.articleId)
          if (article) {
            ;(article as unknown as Record<string, unknown>).workspaceSlug = state.config.slug
            viewHtml = renderArticle(article)
          } else {
            viewHtml = '<div class="hn-error">Article not found</div>'
          }
          break
        }
      }

      this.panel.innerHTML = `<div class="hn-view-stack">${viewHtml}</div>`

      this.bindViewEvents(view)
      this.bindHeaderEvents()
    } finally {
      this.rendering = false
    }
  }

  private bindViewEvents(view: ViewType) {
    if (!this.panel) return
    switch (view.kind) {
      case 'home':
        bindHomeEvents(this.panel)
        break
      case 'messages':
        bindMessagesEvents(this.panel)
        break
      case 'help':
        bindHelpEvents(this.panel, () => void this.render())
        break
      case 'chat':
        bindChatEvents(this.panel, () => void this.render())
        setChatRerender(() => void this.render())
        break
      case 'collection-detail':
        bindCollectionDetailEvents(this.panel)
        break
      case 'article':
        bindArticleEvents(this.panel)
        break
    }
  }

  private bindTabBarEvents() {
    if (!this.panel) return
    this.panel.querySelectorAll('.hn-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const tabId = (tab as HTMLElement).dataset.tab as TabId
        switchTab(tabId)
        if (tabId === 'messages') void this.refreshConversations()
      })
    })
  }

  private bindHeaderEvents() {
    if (!this.panel) return
    const backBtn = this.panel.querySelector('.hn-header-back')
    backBtn?.addEventListener('click', () => popView())

    const closeBtn = this.panel.querySelector('.hn-header-close')
    closeBtn?.addEventListener('click', () => this.close())
  }
}
