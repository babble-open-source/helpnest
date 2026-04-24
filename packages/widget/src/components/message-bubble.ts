import type { ConversationMessage } from '../types'
import { renderMarkdown } from './markdown'

export function renderMessage(msg: ConversationMessage, helpCenterUrl: string, baseUrl: string): string {
  const roleClass = `hn-msg-${msg.role.toLowerCase()}`
  const alignment = msg.role === 'CUSTOMER' ? 'hn-msg-right' : 'hn-msg-left'

  if (msg.role === 'SYSTEM') {
    return `<div class="hn-msg hn-msg-system hn-msg-center"><div class="hn-msg-bubble">${escapeHtml(msg.content)}</div></div>`
  }

  const sources = msg.sources ?? []

  const contentHtml = msg.role === 'CUSTOMER'
    ? `<p>${escapeHtml(msg.content)}</p>`
    : renderMarkdown(msg.content)

  // Inject cite badges inline inside the last paragraph so they flow with the text
  const contentWithCites = sources.length
    ? (() => {
        const badges = sources.map((s, i) =>
          `<a href="${helpCenterUrl}/${s.collection.slug}/${s.slug}" target="_blank" class="hn-cite" data-cite-title="${escapeHtml(s.title)}">${i + 1}</a>`
        ).join('')
        const group = `<span class="hn-cite-group">${badges}</span>`
        const lastP = contentHtml.lastIndexOf('</p>')
        return lastP !== -1
          ? contentHtml.slice(0, lastP) + group + contentHtml.slice(lastP)
          : contentHtml + group
      })()
    : contentHtml

  const feedbackHtml = msg.role === 'AI'
    ? `<div class="hn-msg-feedback" data-message-id="${msg.id}">
        <button class="hn-msg-fb-btn ${msg.feedbackHelpful === true ? 'active' : ''}" data-fb="true" type="button" aria-label="Helpful">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
        </button>
        <button class="hn-msg-fb-btn ${msg.feedbackHelpful === false ? 'active' : ''}" data-fb="false" type="button" aria-label="Not helpful">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>
        </button>
      </div>`
    : ''

  return `
    <div class="hn-msg ${roleClass} ${alignment}">
      <div class="hn-msg-bubble">${contentWithCites}</div>
      ${feedbackHtml}
    </div>
  `
}

export function renderTypingIndicator(): string {
  return `
    <div class="hn-msg hn-msg-left">
      <div class="hn-typing-indicator">
        <span class="hn-typing-dot"></span>
        <span class="hn-typing-dot"></span>
        <span class="hn-typing-dot"></span>
      </div>
    </div>
  `
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
