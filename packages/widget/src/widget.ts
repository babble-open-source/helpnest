import type { InitConfig, TabId, ViewType } from './types'
import { getState, subscribe, setConfig, setOpen, switchTab, popView, setCollections, setConversations, getTransitionDirection, clearTransitionDirection } from './state'
import { initApi, fetchConfig, fetchCollections, fetchConversations } from './api'
import { renderHome, bindHomeEvents } from './views/home'
import { renderMessages, bindMessagesEvents } from './views/messages'
import { renderHelp, bindHelpEvents } from './views/help'
import { renderChat, bindChatEvents, initChatView, setChatRerender, resetChatView } from './views/chat'
import { renderCollectionDetail, bindCollectionDetailEvents, loadCollectionDetail } from './views/collection-detail'
import { renderArticle, bindArticleEvents, loadArticle } from './views/article'
import { renderTabBar } from './components/tab-bar'
import { SESSIONS_KEY_PREFIX } from './chat'
import { widgetStyles } from './styles'

const TRANSITION_MS = 200

export class HelpNestWidget {
  private initConfig: InitConfig
  private root: HTMLElement | null = null
  private shadow: ShadowRoot | null = null
  private panel: HTMLElement | null = null
  private launcher: HTMLElement | null = null
  private isExpanded = false
  private unsubscribe: (() => void) | null = null
  private rendering = false
  private pendingRender = false
  private currentViewKind: string = ''
  private viewContainer: HTMLElement | null = null
  private floatingTooltip: HTMLElement | null = null

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
      <svg class="hn-launcher-icon hn-launcher-open" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <svg class="hn-launcher-icon hn-launcher-close" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    `
    this.shadow.appendChild(this.launcher)

    this.panel = document.createElement('div')
    this.panel.className = 'hn-panel hn-panel-hidden'
    this.shadow.appendChild(this.panel)

    // Floating tooltip — lives outside the panel to escape overflow:hidden clipping
    this.floatingTooltip = document.createElement('div')
    this.floatingTooltip.className = 'hn-floating-tooltip'
    this.shadow.appendChild(this.floatingTooltip)

    document.body.appendChild(this.root)

    this.launcher.addEventListener('click', () => this.toggle())

    // Citation badge tooltip delegation
    this.panel.addEventListener('mouseover', (e) => {
      const cite = (e.target as HTMLElement).closest('.hn-cite') as HTMLElement | null
      if (!cite || !this.floatingTooltip || !this.shadow) return
      const title = cite.dataset.citeTitle
      if (!title) return
      this.floatingTooltip.textContent = title
      this.floatingTooltip.classList.add('hn-floating-tooltip-visible')
      const rect = cite.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const ty = rect.top
      // Clamp so tooltip (max 220px) stays within the viewport width
      const clamped = Math.max(114, Math.min(cx, window.innerWidth - 114))
      this.floatingTooltip.style.left = `${clamped}px`
      this.floatingTooltip.style.top = `${ty}px`
      this.floatingTooltip.style.transform = 'translate(-50%, calc(-100% - 8px))'
    })
    this.panel.addEventListener('mouseout', (e) => {
      const rel = (e as MouseEvent).relatedTarget as HTMLElement | null
      if (rel?.closest('.hn-cite')) return
      this.floatingTooltip?.classList.remove('hn-floating-tooltip-visible')
    })

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return
      if (getState().isOpen) this.close()
    })

    this.panel.addEventListener('hn:expand', () => this.toggleExpand())
    this.panel.addEventListener('hn:close', () => this.close())

    window.addEventListener('resize', () => {
      if (this.isExpanded && window.innerWidth <= 480) {
        this.isExpanded = false
        this.root?.classList.remove('hn-expanded')
      }
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
        if (config.logo) {
          const openIcon = this.launcher.querySelector('.hn-launcher-open') as HTMLElement | null
          if (openIcon) {
            const img = document.createElement('img')
            img.className = 'hn-launcher-icon hn-launcher-open hn-launcher-logo'
            img.src = config.logo
            img.alt = config.name
            openIcon.replaceWith(img)
          }
        }
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

    const colorMap: Record<string, string> = {
      '--color-cream': '--hn-cream',
      '--color-ink': '--hn-ink',
      '--color-muted': '--hn-muted',
      '--color-border': '--hn-border',
      '--color-accent': '--hn-accent',
      '--color-green': '--hn-green',
      '--color-white': '--hn-white',
    }

    const fontMap: Record<string, string> = {
      '--font-heading': '--hn-font-heading',
      '--font-body': '--hn-font-body',
      '--font-brand': '--hn-font-brand',
    }

    const radiusMap: Record<string, string> = {
      '--radius': '--hn-radius',
    }

    const host = this.shadow.host as HTMLElement
    for (const [key, value] of Object.entries(theme.vars)) {
      if (colorMap[key]) {
        host.style.setProperty(colorMap[key], `rgb(${value})`)
      } else if (fontMap[key]) {
        host.style.setProperty(fontMap[key], value)
      } else if (radiusMap[key]) {
        host.style.setProperty(radiusMap[key], value)
      }
    }
  }

  private toggle() {
    getState().isOpen ? this.close() : this.open()
  }

  private open() {
    setOpen(true)
    this.panel?.classList.remove('hn-panel-hidden')
    this.panel?.classList.add('hn-panel-enter')
    this.launcher?.classList.add('hn-launcher-active')

    const { config, activeTab } = getState()
    if (activeTab === 'messages' && config?.aiEnabled) {
      void this.refreshConversations()
    }
  }

  private close() {
    if (!this.panel) return
    if (this.isExpanded) {
      this.root?.classList.remove('hn-expanded')
      this.isExpanded = false
    }
    this.panel.classList.add('hn-panel-exit')
    this.launcher?.classList.remove('hn-launcher-active')

    setTimeout(() => {
      setOpen(false)
      this.panel?.classList.add('hn-panel-hidden')
      this.panel?.classList.remove('hn-panel-exit', 'hn-panel-enter')
    }, TRANSITION_MS)
  }

  private toggleExpand() {
    if (!this.root || !this.panel) return
    this.isExpanded = !this.isExpanded
    if (this.isExpanded) {
      this.root.classList.add('hn-expanded')
    } else {
      this.root.classList.remove('hn-expanded')
    }
  }

  private async refreshConversations() {
    const visitorId = this.getVisitorId()
    const tokens = this.getAllSessionTokens()
    if (!visitorId && tokens.length === 0) return
    const conversations = await fetchConversations(visitorId, tokens)
    setConversations(conversations)
  }

  private getVisitorId(): string {
    const key = 'helpnest:visitor:' + this.initConfig.workspace
    let id = localStorage.getItem(key)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(key, id)
    }
    return id
  }

  private getAllSessionTokens(): string[] {
    const tokens = new Set<string>()

    const stored = localStorage.getItem(SESSIONS_KEY_PREFIX + this.initConfig.workspace)
    if (stored) {
      try {
        const arr = JSON.parse(stored) as Array<{ sessionToken: string } | string>
        if (Array.isArray(arr)) {
          arr.forEach((e) => tokens.add(typeof e === 'string' ? e : e.sessionToken))
        }
      } catch { /* ignore */ }
    }

    const chatData = localStorage.getItem('helpnest:chat:' + this.initConfig.workspace)
    if (chatData) {
      try {
        const parsed = JSON.parse(chatData) as { sessionToken?: string }
        if (parsed.sessionToken) tokens.add(parsed.sessionToken)
      } catch { /* ignore */ }
    }

    return [...tokens]
  }

  private async render() {
    if (this.rendering) {
      this.pendingRender = true
      return
    }
    if (!this.panel || !this.shadow) return
    const state = getState()
    if (!state.config) return

    this.rendering = true
    this.pendingRender = false
    const direction = getTransitionDirection()
    clearTransitionDirection()

    try {
      const view = state.viewStack[state.viewStack.length - 1] ?? { kind: state.activeTab }
      const viewKey = this.viewKey(view)
      const isViewChange = viewKey !== this.currentViewKind

      // Reset chat state when navigating away from a chat view
      if (isViewChange && this.currentViewKind.startsWith('chat:') && !viewKey.startsWith('chat:')) {
        resetChatView()
      }

      // Init chat only on actual view transition, not on re-renders within the same chat
      if (view.kind === 'chat' && isViewChange) {
        await initChatView(view.conversationId, view.forceNew)
      }

      const viewHtml = await this.renderView(view, state.config.slug)

      if (direction !== 'none' && this.viewContainer && isViewChange) {
        await this.transitionView(viewHtml, view, direction)
        this.updateTabBar(view)
      } else {
        this.swapView(viewHtml, view)
      }

      this.currentViewKind = viewKey
      this.bindTabBarEvents()
    } finally {
      this.rendering = false
      if (this.pendingRender) {
        this.pendingRender = false
        void this.render()
      }
    }
  }

  private async renderView(view: ViewType, slug: string): Promise<string> {
    switch (view.kind) {
      case 'home':
        return renderHome()
      case 'messages':
        return renderMessages()
      case 'help':
        return renderHelp()
      case 'chat':
        return renderChat()
      case 'collection-detail': {
        const data = await loadCollectionDetail(view.collectionId, getState().collections)
        return renderCollectionDetail(data)
      }
      case 'article': {
        const article = await loadArticle(view.articleId)
        if (article) {
          ;(article as unknown as Record<string, unknown>).workspaceSlug = slug
          return renderArticle(article)
        }
        return '<div class="hn-error">Article not found</div>'
      }
    }
  }

  private viewKey(view: ViewType): string {
    switch (view.kind) {
      case 'collection-detail': return `collection-detail:${view.collectionId}`
      case 'article': return `article:${view.articleId}`
      case 'chat': return `chat:${view.conversationId ?? 'new'}`
      default: return view.kind
    }
  }

  private swapView(html: string, view: ViewType) {
    if (!this.panel) return
    const state = getState()
    const showTabBar = view.kind === 'home' || view.kind === 'messages' || view.kind === 'help'

    // Preserve textarea value + focus across chat in-place re-renders (streaming)
    let savedInputValue = ''
    let inputWasFocused = false
    if (view.kind === 'chat') {
      const existingInput = this.panel.querySelector('#hn-chat-input') as HTMLTextAreaElement | null
      if (existingInput) {
        savedInputValue = existingInput.value
        inputWasFocused = this.shadow?.activeElement === existingInput
      }
    }

    const tabBarHtml = showTabBar && state.config
      ? renderTabBar(state.activeTab, state.config.aiEnabled)
      : ''
    this.panel.innerHTML = `<div class="hn-view-stack"><div class="hn-view-layer">${html}</div></div>${tabBarHtml}`
    this.viewContainer = this.panel.querySelector('.hn-view-stack')
    this.bindViewEvents(view)

    // Restore textarea value + focus after DOM replace
    if (view.kind === 'chat' && savedInputValue) {
      const newInput = this.panel.querySelector('#hn-chat-input') as HTMLTextAreaElement | null
      if (newInput) {
        newInput.value = savedInputValue
        newInput.style.height = 'auto'
        newInput.style.height = Math.min(newInput.scrollHeight, 96) + 'px'
        if (inputWasFocused) newInput.focus()
      }
    }
  }

  private transitionView(html: string, view: ViewType, direction: string): Promise<void> {
    return new Promise((resolve) => {
      if (!this.panel || !this.viewContainer) {
        this.swapView(html, view)
        resolve()
        return
      }

      const showTabBar = view.kind === 'home' || view.kind === 'messages' || view.kind === 'help'
      const existingTabBar = this.panel.querySelector('.hn-tab-bar') as HTMLElement | null

      const oldLayer = this.viewContainer.querySelector('.hn-view-layer') as HTMLElement | null
      const newLayer = document.createElement('div')
      newLayer.className = 'hn-view-layer'
      newLayer.innerHTML = html

      if (direction === 'push') {
        newLayer.classList.add('hn-enter-right')
        oldLayer?.classList.add('hn-exit-left')
      } else if (direction === 'pop') {
        newLayer.classList.add('hn-enter-left')
        oldLayer?.classList.add('hn-exit-right')
      } else {
        newLayer.classList.add('hn-enter-fade')
        oldLayer?.classList.add('hn-exit-fade')
      }

      this.viewContainer.appendChild(newLayer)

      // Scroll chat messages to bottom while the layer is still invisible (opacity:0),
      // so the user sees it already at the bottom when it fades in.
      if (view.kind === 'chat') {
        const msgArea = newLayer.querySelector('#hn-chat-messages-area') as HTMLElement | null
        if (msgArea) msgArea.scrollTop = msgArea.scrollHeight
      }

      // Tab bar is position:absolute so it never affects the view-stack's height.
      // Fade it out/in in sync with the view transition for a smooth visual.
      let preAddedTabBar: HTMLElement | null = null
      if (showTabBar && !existingTabBar) {
        const state = getState()
        if (state.config) {
          const wrapper = document.createElement('div')
          wrapper.innerHTML = renderTabBar(state.activeTab, state.config.aiEnabled)
          const tabBar = wrapper.firstElementChild as HTMLElement | null
          if (tabBar) {
            tabBar.style.opacity = '0'
            tabBar.style.transition = `opacity ${TRANSITION_MS}ms ease`
            this.panel.appendChild(tabBar)
            preAddedTabBar = tabBar
          }
        }
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          newLayer.classList.add('hn-view-active')
          if (oldLayer) oldLayer.classList.add('hn-view-leaving')

          if (!showTabBar && existingTabBar) {
            existingTabBar.style.transition = `opacity ${TRANSITION_MS}ms ease`
            existingTabBar.style.opacity = '0'
          }
          if (preAddedTabBar) {
            preAddedTabBar.style.opacity = '1'
          }
        })
      })

      setTimeout(() => {
        if (oldLayer && oldLayer.parentNode) {
          oldLayer.parentNode.removeChild(oldLayer)
        }
        newLayer.className = 'hn-view-layer'
        this.bindViewEvents(view)
        resolve()
      }, TRANSITION_MS)
    })
  }

  private updateTabBar(view: ViewType) {
    if (!this.panel) return
    const state = getState()
    const showTabBar = view.kind === 'home' || view.kind === 'messages' || view.kind === 'help'
    const existing = this.panel.querySelector('.hn-tab-bar')
    if (showTabBar && state.config) {
      // Always replace tab bar to get fresh elements with no stale listeners
      const tabBarDiv = document.createElement('div')
      tabBarDiv.innerHTML = renderTabBar(state.activeTab, state.config.aiEnabled)
      const newTabBar = tabBarDiv.firstElementChild
      if (newTabBar) {
        if (existing) {
          existing.replaceWith(newTabBar)
        } else {
          this.panel.appendChild(newTabBar)
        }
      }
    } else if (existing) {
      existing.remove()
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

}
