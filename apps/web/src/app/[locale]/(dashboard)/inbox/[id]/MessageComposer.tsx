'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { Lock, MessageSquare } from 'lucide-react'

type ComposerMode = 'reply' | 'note'

interface SentMessage {
  id: string
  role: string
  content: string
  isInternal: boolean
  authorMemberId: string | null
  sources: unknown
  confidence: number | null
  feedbackHelpful: boolean | null
  createdAt: string
}

interface MessageComposerProps {
  conversationId: string
  disabled?: boolean
  onMessageSent: (message: SentMessage) => void
}

export function MessageComposer({
  conversationId,
  disabled = false,
  onMessageSent,
}: MessageComposerProps) {
  const [mode, setMode] = useState<ComposerMode>('reply')
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const isNote = mode === 'note'

  async function handleSend() {
    if (!content.trim() || sending || disabled) return
    setSending(true)
    setSendError(null)
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), isInternal: isNote }),
      })
      if (res.ok) {
        const data = (await res.json()) as { message: SentMessage }
        onMessageSent({
          ...data.message,
          createdAt:
            typeof data.message.createdAt === 'string'
              ? data.message.createdAt
              : new Date(data.message.createdAt as unknown as string).toISOString(),
        })
        setContent('')
      } else {
        setSendError('Failed to send. Please try again.')
      }
    } catch {
      setSendError('Failed to send. Please try again.')
    } finally {
      setSending(false)
    }
  }

  function handleTabKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setMode('reply')
      ;(e.currentTarget.querySelector('[data-tab="reply"]') as HTMLElement | null)?.focus()
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      setMode('note')
      ;(e.currentTarget.querySelector('[data-tab="note"]') as HTMLElement | null)?.focus()
    }
  }

  return (
    <div
      className={cn(
        'border-t p-4 shrink-0 transition-colors',
        isNote && 'bg-amber-50 border-amber-200'
      )}
    >
      {/* Mode tabs — WAI-ARIA tabs pattern (roving tabIndex + arrow-key navigation) */}
      <div
        className="flex gap-1 mb-2"
        role="tablist"
        aria-label="Message mode"
        onKeyDown={handleTabKeyDown}
      >
        <button
          type="button"
          role="tab"
          data-tab="reply"
          aria-selected={!isNote}
          aria-controls="composer-panel"
          tabIndex={!isNote ? 0 : -1}
          onClick={() => setMode('reply')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1 text-xs rounded-md transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            !isNote
              ? 'bg-background border text-foreground font-medium shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <MessageSquare className="w-3 h-3" aria-hidden="true" />
          Reply
        </button>
        <button
          type="button"
          role="tab"
          data-tab="note"
          aria-selected={isNote}
          aria-controls="composer-panel"
          tabIndex={isNote ? 0 : -1}
          onClick={() => setMode('note')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1 text-xs rounded-md transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isNote
              ? 'bg-amber-100 border border-amber-300 text-amber-800 font-medium shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Lock className="w-3 h-3" aria-hidden="true" />
          Internal Note
        </button>
      </div>

      {/* Tab panel */}
      <div id="composer-panel" role="tabpanel">
        {/* Error feedback — announced immediately to screen readers */}
        {sendError && (
          <p role="alert" className="text-xs text-destructive mb-2">
            {sendError}
          </p>
        )}

        {/* Composer area */}
        <div className="flex gap-3">
          <Textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value)
              if (sendError) setSendError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleSend()
              }
            }}
            placeholder={isNote ? 'Leave an internal note…' : 'Reply to customer…'}
            rows={2}
            disabled={disabled}
            className={cn(
              'flex-1 resize-none transition-colors',
              isNote && 'bg-amber-50 border-amber-200 focus-visible:ring-amber-300'
            )}
            aria-label={isNote ? 'Internal note content' : 'Reply content'}
          />
          <Button
            onClick={() => void handleSend()}
            disabled={!content.trim() || sending || disabled}
            aria-label="Send"
            className={cn(
              'self-end transition-colors',
              isNote
                ? 'bg-amber-600 hover:bg-amber-600/90 text-white'
                : 'bg-emerald-600 hover:bg-emerald-600/90 text-white'
            )}
          >
            {sending ? 'Sending…' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  )
}
