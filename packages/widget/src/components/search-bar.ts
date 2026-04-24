function escapeAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

export function renderSearchBar(placeholder?: string, value?: string): string {
  const safeValue = value ? escapeAttr(value) : ''
  return `
    <div class="hn-search-bar">
      <svg class="hn-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input
        class="hn-search-input"
        type="text"
        placeholder="${placeholder ?? 'Search for help'}"
        ${safeValue ? `value="${safeValue}"` : ''}
        autocomplete="off"
        spellcheck="false"
      />
    </div>
  `
}
