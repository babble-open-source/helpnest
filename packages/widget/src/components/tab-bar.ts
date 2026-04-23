import type { TabId } from '../types'

const TABS: { id: TabId; label: string; icon: string }[] = [
  {
    id: 'home',
    label: 'Home',
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>`,
  },
  {
    id: 'messages',
    label: 'Messages',
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>`,
  },
  {
    id: 'help',
    label: 'Help',
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>`,
  },
]

export function renderTabBar(activeTab: TabId, aiEnabled: boolean): string {
  const visibleTabs = aiEnabled ? TABS : TABS.filter((t) => t.id !== 'messages')

  return `
    <div class="hn-tab-bar">
      ${visibleTabs
        .map(
          (tab) => `
        <button
          class="hn-tab ${tab.id === activeTab ? 'hn-tab-active' : ''}"
          data-tab="${tab.id}"
          type="button"
          aria-label="${tab.label}"
        >
          ${tab.icon}
          <span class="hn-tab-label">${tab.label}</span>
        </button>
      `
        )
        .join('')}
    </div>
  `
}
