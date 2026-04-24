export interface HeaderOptions {
  title: string
  showBack?: boolean
  showClose?: boolean
  showExpand?: boolean
}

export function renderHeader(opts: HeaderOptions): string {
  const backBtn = opts.showBack
    ? `<button class="hn-header-back" type="button" aria-label="Go back">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>`
    : ''

  const expandBtn = opts.showExpand
    ? `<button type="button" class="hn-header-expand" aria-label="Expand">
        <svg class="hn-icon-expand" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
        </svg>
        <svg class="hn-icon-compress" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
        </svg>
      </button>`
    : ''

  const closeBtn = opts.showClose !== false
    ? `<button class="hn-header-close" type="button" aria-label="Close">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>`
    : ''

  return `
    <div class="hn-header">
      <div class="hn-header-left">${backBtn}</div>
      <span class="hn-header-title">${opts.title}</span>
      <div class="hn-header-right">${expandBtn}${closeBtn}</div>
    </div>
  `
}
