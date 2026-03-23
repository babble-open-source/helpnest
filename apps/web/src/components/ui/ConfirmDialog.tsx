'use client'

import { useEffect, useRef, useCallback } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) cancelRef.current?.focus()
  }, [open])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel()
      return
    }
    // Focus trap — cycle between cancel and confirm buttons
    if (e.key === 'Tab') {
      const focusable = [cancelRef.current, confirmRef.current].filter(Boolean) as HTMLElement[]
      if (focusable.length === 0) return
      const activeIndex = focusable.indexOf(document.activeElement as HTMLElement)
      if (e.shiftKey) {
        e.preventDefault()
        focusable[activeIndex <= 0 ? focusable.length - 1 : activeIndex - 1]?.focus()
      } else {
        e.preventDefault()
        focusable[activeIndex >= focusable.length - 1 ? 0 : activeIndex + 1]?.focus()
      }
    }
  }, [onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="bg-white rounded-xl border border-border shadow-lg p-6 max-w-md mx-4 outline-none"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        onKeyDown={handleKeyDown}
      >
        <h3 id="confirm-dialog-title" className="font-serif text-lg text-ink mb-2">{title}</h3>
        <p id="confirm-dialog-message" className="text-sm text-muted mb-5">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="text-sm font-medium px-4 py-2 rounded-lg border border-border text-ink hover:bg-cream transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
              destructive
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-ink text-cream hover:bg-ink/90'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
