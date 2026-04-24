import { getState, pushView } from '../state'
import { renderHeader } from '../components/header'

import type { ConversationSummary } from '../types'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)
  const diffWeek = Math.floor(diffDay / 7)

  if (diffSec < 60) return 'now'
  if (diffMin < 60) return `${diffMin}m`
  if (diffHour < 24) return `${diffHour}h`
  if (diffDay < 7) return `${diffDay}d`
  return `${diffWeek}w`
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'ACTIVE':
    case 'RESOLVED_AI':
      return 'green'
    case 'ESCALATED':
    case 'HUMAN_ACTIVE':
      return 'orange'
    default:
      return 'muted'
  }
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,4} /gm, '')
}

function renderConversationRow(conv: ConversationSummary): string {
  const statusColor = getStatusColor(conv.status)
  const rawContent = conv.lastMessage ? stripMarkdown(conv.lastMessage.content) : ''
  const preview = conv.lastMessage
    ? escapeHtml(rawContent.slice(0, 80) + (rawContent.length > 80 ? '…' : ''))
    : 'No messages yet'
  const time = conv.lastMessage
    ? formatRelativeTime(conv.lastMessage.createdAt)
    : formatRelativeTime(conv.createdAt)
  const subject = conv.subject
    ? escapeHtml(conv.subject)
    : 'Conversation'

  return `
    <button class="hn-conv-row" type="button" data-conversation-id="${escapeHtml(conv.id)}">
      <span class="hn-conv-status-dot hn-conv-status-${escapeHtml(statusColor)}"></span>
      <div class="hn-conv-info">
        <div class="hn-conv-top">
          <span class="hn-conv-subject">${subject}</span>
          <span class="hn-conv-time">${escapeHtml(time)}</span>
        </div>
        <span class="hn-conv-preview">${preview}</span>
      </div>
    </button>
  `
}

export function renderMessages(): string {
  const { config, conversations } = getState()
  if (!config) return ''

  const bodyHtml = conversations.length > 0
    ? `<div class="hn-conv-list">
        ${conversations.map(renderConversationRow).join('')}
      </div>`
    : `<div class="hn-conv-empty">
        <div class="hn-conv-empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <p class="hn-conv-empty-text">No messages yet</p>
      </div>`

  const ctaHtml = config.aiEnabled
    ? `<div class="hn-messages-cta-wrap">
        <button class="hn-messages-cta" type="button" data-action="new-message">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Send us a message
        </button>
      </div>`
    : ''

  return `
    <div class="hn-view hn-view-messages">
      ${renderHeader({ title: 'Messages', showClose: true, showExpand: true })}
      <div class="hn-view-body hn-view-body-flush">
        ${bodyHtml}
      </div>
      ${ctaHtml}
    </div>
  `
}

export function bindMessagesEvents(container: HTMLElement): void {
  container.querySelector('[data-action="new-message"]')?.addEventListener('click', () => {
    pushView({ kind: 'chat', forceNew: true }, 'fade')
  })

  container.querySelectorAll('.hn-conv-row').forEach((row) => {
    row.addEventListener('click', () => {
      const conversationId = (row as HTMLElement).dataset.conversationId
      if (conversationId) {
        pushView({ kind: 'chat', conversationId }, 'fade')
      }
    })
  })

  container.querySelector('.hn-header-close')?.addEventListener('click', () => {
    container.dispatchEvent(new CustomEvent('hn:close', { bubbles: true }))
  })

  container.querySelector('.hn-header-expand')?.addEventListener('click', () => {
    container.dispatchEvent(new CustomEvent('hn:expand', { bubbles: true }))
  })
}
