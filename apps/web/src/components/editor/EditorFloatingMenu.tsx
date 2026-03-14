'use client'

import { FloatingMenu } from '@tiptap/react/menus'
import type { Editor } from '@tiptap/react'
import type { EditorState } from '@tiptap/pm/state'

interface Props {
  editor: Editor
  active: boolean
}

const BLOCK_OPTIONS = [
  { label: '¶', title: 'Paragraph', cmd: (e: Editor) => e.chain().focus().setParagraph().run() },
  { label: 'H1', title: 'Heading 1', cmd: (e: Editor) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { label: 'H2', title: 'Heading 2', cmd: (e: Editor) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: 'H3', title: 'Heading 3', cmd: (e: Editor) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { label: '•', title: 'Bullet list', cmd: (e: Editor) => e.chain().focus().toggleBulletList().run() },
  { label: '1.', title: 'Ordered list', cmd: (e: Editor) => e.chain().focus().toggleOrderedList().run() },
  { label: '☐', title: 'Task list', cmd: (e: Editor) => e.chain().focus().toggleTaskList().run() },
  { label: '<>', title: 'Code block', cmd: (e: Editor) => e.chain().focus().toggleCodeBlock().run() },
  { label: '⊞', title: 'Table', cmd: (e: Editor) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { label: '"', title: 'Blockquote', cmd: (e: Editor) => e.chain().focus().toggleBlockquote().run() },
  { label: '—', title: 'Divider', cmd: (e: Editor) => e.chain().focus().setHorizontalRule().run() },
]

export function EditorFloatingMenu({ editor, active }: Props) {
  return (
    <FloatingMenu
      editor={editor}
      appendTo={() => document.body}
      shouldShow={({ state }: { state: EditorState }) => {
        if (!active) return false
        const { $from } = state.selection
        return $from.node().type.name === 'paragraph' && $from.node().textContent === ''
      }}
    >
      <div className="flex items-center gap-1 bg-white border border-border rounded-lg px-2 py-1 shadow-md">
        {BLOCK_OPTIONS.map(({ label, title, cmd }) => (
          <button
            key={title}
            onClick={() => cmd(editor)}
            title={title}
            className="text-xs text-muted hover:text-ink hover:bg-cream px-1.5 py-1 rounded transition-colors font-mono"
          >
            {label}
          </button>
        ))}
      </div>
    </FloatingMenu>
  )
}
