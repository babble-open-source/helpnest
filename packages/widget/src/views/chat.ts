import { getState, popView } from '../state'
import { renderHeader } from '../components/header'
import { renderMessage, renderTypingIndicator } from '../components/message-bubble'
import { ChatManager } from '../chat'
import type { ConversationMessage } from '../types'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function getBaseUrl(): string {
  const { config } = getState()
  if (config) {
    const baseUrl = (config as unknown as Record<string, unknown>)._baseUrl as string | undefined
    if (baseUrl) return baseUrl
  }
  return window.location.origin
}

// Module-level state
let chatManager: ChatManager | null = null
let messages: ConversationMessage[] = []
let isStreaming = false
let streamingContent = ''
let rerender: (() => void) | null = null

export function setChatRerender(fn: () => void): void {
  rerender = fn
}

export function getChatManager(): ChatManager | null {
  return chatManager
}

export async function initChatView(conversationId?: string): Promise<void> {
  const { config } = getState()
  if (!config) return

  const baseUrl = getBaseUrl()

  chatManager = new ChatManager({ workspace: config.slug, baseUrl })

  if (conversationId) {
    chatManager.setSession(conversationId)
    const loaded = await chatManager.loadMessages()
    messages = loaded
  } else {
    const resumed = await chatManager.resumeSession()
    if (resumed) {
      const loaded = await chatManager.loadMessages()
      messages = loaded
    }
  }

  chatManager.setOnNewMessages((newMsgs) => {
    messages = [...messages, ...newMsgs]
    rerender?.()
  })
}

export function renderChat(): string {
  const { config } = getState()
  if (!config) return ''

  const workspaceName = escapeHtml(config.name)
  const baseUrl = getBaseUrl()

  const messagesHtml = messages
    .map((msg) => renderMessage(msg, config.slug, baseUrl))
    .join('')

  const showTyping = isStreaming && streamingContent === ''
  const streamingBubble = isStreaming && streamingContent !== ''
    ? `<div class="hn-msg hn-msg-ai hn-msg-left">
        <div class="hn-msg-bubble">${escapeHtml(streamingContent)}</div>
      </div>`
    : ''

  const customerMsgCount = messages.filter((m) => m.role === 'CUSTOMER').length
  const showEscalate = !isStreaming && customerMsgCount >= 3
    && chatManager?.getState() === 'CHAT_AI'

  const escalateBtn = showEscalate
    ? `<div class="hn-chat-escalate-wrap">
        <button class="hn-chat-escalate-btn" type="button" data-action="escalate">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
          </svg>
          Talk to a human
        </button>
      </div>`
    : ''

  const composerDisabled = isStreaming || chatManager?.getState() === 'RESOLVED' ? 'disabled' : ''
  const composerPlaceholder = chatManager?.getState() === 'RESOLVED'
    ? 'This conversation is resolved.'
    : 'Type a message…'

  return `
    <div class="hn-view hn-view-chat">
      ${renderHeader({ title: workspaceName, showBack: true, showClose: true })}
      <div class="hn-chat-messages" id="hn-chat-messages-area">
        ${messagesHtml}
        ${showTyping ? renderTypingIndicator() : ''}
        ${streamingBubble}
      </div>
      ${escalateBtn}
      <div class="hn-chat-composer">
        <textarea
          class="hn-chat-input"
          id="hn-chat-input"
          rows="1"
          maxlength="1000"
          placeholder="${escapeHtml(composerPlaceholder)}"
          autocomplete="off"
          spellcheck="false"
          ${composerDisabled}
        ></textarea>
        <button class="hn-chat-send" id="hn-chat-send" type="button" aria-label="Send" ${composerDisabled}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="18" height="18">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
          </svg>
        </button>
      </div>
    </div>
  `
}

export function bindChatEvents(container: HTMLElement, rerenderFn: () => void): void {
  rerender = rerenderFn

  const input = container.querySelector('#hn-chat-input') as HTMLTextAreaElement | null
  const sendBtn = container.querySelector('#hn-chat-send') as HTMLButtonElement | null

  const submit = () => {
    const text = input?.value.trim() ?? ''
    if (!text || isStreaming) return
    void sendMessage(text, input)
  }

  sendBtn?.addEventListener('click', submit)

  input?.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return
    e.preventDefault()
    submit()
  })

  input?.addEventListener('input', () => {
    if (!input) return
    input.style.height = 'auto'
    input.style.height = Math.min(input.scrollHeight, 96) + 'px'
  })

  container.querySelector('[data-action="escalate"]')?.addEventListener('click', () => {
    void handleEscalate(rerenderFn)
  })

  container.querySelector('.hn-header-back')?.addEventListener('click', () => {
    popView()
  })

  container.querySelector('.hn-header-close')?.addEventListener('click', () => {
    container.dispatchEvent(new CustomEvent('hn:close', { bubbles: true }))
  })

  // Feedback buttons on AI messages
  container.querySelectorAll('.hn-msg-feedback').forEach((feedbackEl) => {
    const messageId = (feedbackEl as HTMLElement).dataset.messageId
    if (!messageId) return
    feedbackEl.querySelectorAll('.hn-msg-fb-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const helpful = (btn as HTMLElement).dataset.fb === 'true'
        void chatManager?.sendFeedback(messageId, helpful)
        feedbackEl.querySelectorAll('.hn-msg-fb-btn').forEach((b) => {
          (b as HTMLButtonElement).disabled = true
        })
      })
    })
  })

  scrollToBottom(container)
}

function scrollToBottom(container: HTMLElement): void {
  const area = container.querySelector('#hn-chat-messages-area') as HTMLElement | null
  if (!area) return
  requestAnimationFrame(() => {
    area.scrollTop = area.scrollHeight
  })
}

async function sendMessage(text: string, input: HTMLTextAreaElement | null): Promise<void> {
  if (!chatManager) return

  if (input) {
    input.value = ''
    input.style.height = 'auto'
  }

  isStreaming = true
  streamingContent = ''

  // Add customer message to local list immediately
  const customerMsg: ConversationMessage = {
    id: `local_${Date.now()}`,
    role: 'CUSTOMER',
    content: text,
    createdAt: new Date().toISOString(),
  }
  messages = [...messages, customerMsg]
  rerender?.()

  try {
    if (!chatManager.getSession()) {
      await chatManager.createConversation()
    }

    for await (const event of chatManager.sendMessage(text)) {
      if (event.type === 'text') {
        streamingContent += event.text
        rerender?.()
      } else if (event.type === 'sources') {
        // sources will be included when we reload messages after done
      } else if (event.type === 'done') {
        chatManager.advanceLastMessageAt()
        // Reload full messages from server to get proper IDs and sources
        const loaded = await chatManager.loadMessages()
        messages = loaded
        isStreaming = false
        streamingContent = ''
        rerender?.()

        if (event.shouldEscalate) {
          rerender?.()
        }
        return
      } else if (event.type === 'error') {
        const errorMsg: ConversationMessage = {
          id: `error_${Date.now()}`,
          role: 'SYSTEM',
          content: event.message ?? 'Something went wrong. Please try again.',
          createdAt: new Date().toISOString(),
        }
        messages = [...messages, errorMsg]
        isStreaming = false
        streamingContent = ''
        rerender?.()
        return
      }
    }
  } catch (err) {
    const errorMsg: ConversationMessage = {
      id: `error_${Date.now()}`,
      role: 'SYSTEM',
      content: err instanceof Error ? err.message : 'Failed to send message',
      createdAt: new Date().toISOString(),
    }
    messages = [...messages, errorMsg]
    isStreaming = false
    streamingContent = ''
    rerender?.()
  }
}

async function handleEscalate(rerenderFn: () => void): Promise<void> {
  if (!chatManager) return

  if (!chatManager.getSession()) {
    try {
      await chatManager.createConversation()
    } catch {
      const errorMsg: ConversationMessage = {
        id: `error_${Date.now()}`,
        role: 'SYSTEM',
        content: 'Unable to connect. Please try again.',
        createdAt: new Date().toISOString(),
      }
      messages = [...messages, errorMsg]
      rerenderFn()
      return
    }
  }

  const connectingMsg: ConversationMessage = {
    id: `sys_${Date.now()}`,
    role: 'SYSTEM',
    content: 'Connecting you to a support agent…',
    createdAt: new Date().toISOString(),
  }
  messages = [...messages, connectingMsg]
  rerenderFn()

  try {
    await chatManager.escalate()
    rerenderFn()
  } catch {
    const errorMsg: ConversationMessage = {
      id: `error_${Date.now()}`,
      role: 'SYSTEM',
      content: 'Failed to connect to support. Please try again.',
      createdAt: new Date().toISOString(),
    }
    messages = [...messages, errorMsg]
    rerenderFn()
  }
}
