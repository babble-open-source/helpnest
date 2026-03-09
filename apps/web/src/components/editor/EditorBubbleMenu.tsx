'use client'

import { BubbleMenu } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import { useState } from 'react'

interface Props {
  editor: Editor
  active: boolean
}

export function EditorBubbleMenu({ editor, active }: Props) {
  const [linkUrl, setLinkUrl] = useState('')
  const [showLinkInput, setShowLinkInput] = useState(false)

  function applyLink() {
    if (linkUrl) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run()
    } else {
      editor.chain().focus().unsetLink().run()
    }
    setShowLinkInput(false)
    setLinkUrl('')
  }

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{ duration: 100, appendTo: () => document.body }}
      shouldShow={({ from, to }) => active && from !== to}
    >
      <div className="flex items-center gap-0.5 bg-ink rounded-lg px-1.5 py-1 shadow-lg">
        {showLinkInput ? (
          <div className="flex items-center gap-1">
            <input
              type="url"
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') applyLink(); if (e.key === 'Escape') setShowLinkInput(false) }}
              placeholder="https://"
              className="text-xs bg-transparent text-cream border-b border-cream/50 outline-none w-40 px-1"
              autoFocus
            />
            <button onClick={applyLink} className="text-xs text-cream hover:text-white px-1">✓</button>
            <button onClick={() => setShowLinkInput(false)} className="text-xs text-cream/60 hover:text-cream px-1">✕</button>
          </div>
        ) : (
          <>
            {[
              { label: 'B', cmd: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold'), className: 'font-bold' },
              { label: 'I', cmd: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic'), className: 'italic' },
              { label: 'U', cmd: () => editor.chain().focus().toggleUnderline().run(), active: editor.isActive('underline'), className: 'underline' },
              { label: 'S', cmd: () => editor.chain().focus().toggleStrike().run(), active: editor.isActive('strike'), className: 'line-through' },
              { label: '`', cmd: () => editor.chain().focus().toggleCode().run(), active: editor.isActive('code'), className: 'font-mono' },
            ].map(({ label, cmd, active, className }) => (
              <button
                key={label}
                onClick={cmd}
                className={`text-xs px-1.5 py-0.5 rounded transition-colors ${className ?? ''} ${
                  active ? 'bg-cream text-ink' : 'text-cream hover:bg-white/10'
                }`}
              >
                {label}
              </button>
            ))}
            <div className="w-px h-3 bg-white/20 mx-0.5" />
            {[1, 2, 3].map(level => (
              <button
                key={level}
                onClick={() => editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 }).run()}
                className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
                  editor.isActive('heading', { level }) ? 'bg-cream text-ink' : 'text-cream hover:bg-white/10'
                }`}
              >
                H{level}
              </button>
            ))}
            <div className="w-px h-3 bg-white/20 mx-0.5" />
            <button
              onClick={() => {
                const currentUrl = editor.getAttributes('link').href ?? ''
                setLinkUrl(currentUrl)
                setShowLinkInput(true)
              }}
              className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
                editor.isActive('link') ? 'bg-cream text-ink' : 'text-cream hover:bg-white/10'
              }`}
            >
              🔗
            </button>
          </>
        )}
      </div>
    </BubbleMenu>
  )
}
