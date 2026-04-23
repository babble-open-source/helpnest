export interface HeaderOptions {
  title: string
  showBack?: boolean
  showClose?: boolean
  showExpand?: boolean
  expandUrl?: string
}

export function renderHeader(opts: HeaderOptions): string {
  const backBtn = opts.showBack
    ? `<button class="hn-header-back" type="button" aria-label="Go back">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>`
    : ''

  const expandBtn = opts.showExpand && opts.expandUrl
    ? `<a href="${opts.expandUrl}" target="_blank" rel="noopener" class="hn-header-expand" aria-label="Open in help center">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>
        </svg>
      </a>`
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
