import type { WidgetState, TabId, ViewType, WidgetConfig, CollectionNode, ConversationSummary, ArticleSummary } from './types'

type Listener = () => void

const initialState: WidgetState = {
  activeTab: 'home',
  viewStack: [{ kind: 'home' }],
  config: null,
  collections: [],
  conversations: [],
  searchQuery: '',
  searchResults: [],
  isOpen: false,
}

let state: WidgetState = { ...initialState }
const listeners: Set<Listener> = new Set()

export function getState(): WidgetState {
  return state
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function notify() {
  for (const fn of listeners) fn()
}

export function setConfig(config: WidgetConfig) {
  state = { ...state, config }
  notify()
}

export function setOpen(isOpen: boolean) {
  state = { ...state, isOpen }
  notify()
}

export function switchTab(tab: TabId) {
  state = {
    ...state,
    activeTab: tab,
    viewStack: [{ kind: tab } as ViewType],
  }
  notify()
}

export function pushView(view: ViewType) {
  state = {
    ...state,
    viewStack: [...state.viewStack, view],
  }
  notify()
}

export function popView(): ViewType | null {
  if (state.viewStack.length <= 1) return null
  const newStack = state.viewStack.slice(0, -1)
  state = { ...state, viewStack: newStack }
  notify()
  return newStack[newStack.length - 1]!
}

export function currentView(): ViewType {
  return state.viewStack[state.viewStack.length - 1] ?? { kind: state.activeTab }
}

export function setCollections(collections: CollectionNode[]) {
  state = { ...state, collections }
  notify()
}

export function setConversations(conversations: ConversationSummary[]) {
  state = { ...state, conversations }
  notify()
}

export function setSearchQuery(query: string) {
  state = { ...state, searchQuery: query }
}

export function setSearchResults(results: ArticleSummary[]) {
  state = { ...state, searchResults: results }
  notify()
}
