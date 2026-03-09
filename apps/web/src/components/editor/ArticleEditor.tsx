'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { EditorToolbar } from './EditorToolbar'
import { ArticleMetaSidebar } from './ArticleMetaSidebar'
import { EditorOutline } from './EditorOutline'
import { EditorBubbleMenu } from './EditorBubbleMenu'
import { EditorFloatingMenu } from './EditorFloatingMenu'
import { fixOrderedListCounters } from '@/components/help/ArticleContent'

interface Article {
  id: string
  title: string
  slug: string
  content: string
  excerpt: string
  status: string
  collectionId: string
  hasDraft?: boolean
}

interface Collection {
  id: string
  title: string
  emoji: string | null
}

interface Props {
  article: Article
  collections: Collection[]
}

interface ArticleVersion {
  id: string
  version: number
  title: string
  content: string
  createdAt: string
  author: { name: string | null; email: string }
}

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'

export function ArticleEditor({ article, collections }: Props) {
  const [hasDraft, setHasDraft] = useState(article.hasDraft ?? false)
  const [title, setTitle] = useState(article.title)
  const [slug, setSlug] = useState(article.slug)
  const [excerpt, setExcerpt] = useState(article.excerpt)
  const [collectionId, setCollectionId] = useState(article.collectionId)
  const [status, setStatus] = useState(article.status)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [showVersions, setShowVersions] = useState(false)
  const [showOutline, setShowOutline] = useState(false)
  const [showMeta, setShowMeta] = useState(true)
  const [versions, setVersions] = useState<ArticleVersion[]>([])
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Refs for values needed inside stable callbacks to avoid stale closures.
  const titleRef = useRef(title)
  const slugRef = useRef(slug)
  const excerptRef = useRef(excerpt)
  const collectionIdRef = useRef(collectionId)
  const statusRef = useRef(status)

  useEffect(() => { titleRef.current = title }, [title])
  useEffect(() => { slugRef.current = slug }, [slug])
  useEffect(() => { excerptRef.current = excerpt }, [excerpt])
  useEffect(() => { collectionIdRef.current = collectionId }, [collectionId])
  useEffect(() => { statusRef.current = status }, [status])

  const lastSaved = useRef({
    title,
    content: article.content,
    excerpt,
    collectionId,
    status,
  })

  // A stable ref to always hold the latest scheduleAutoSave so it can be
  // called from the useEditor onUpdate closure which is captured on mount.
  const scheduleAutoSaveRef = useRef<() => void>(() => undefined)

  const [editorMode, setEditorMode] = useState<'classic' | 'notion'>('classic')
  useEffect(() => {
    const stored = localStorage.getItem('helpnest:editor-mode') as 'classic' | 'notion' | null
    if (stored) setEditorMode(stored)
  }, [])
  function setAndPersistEditorMode(next: 'classic' | 'notion') {
    setEditorMode(next)
    localStorage.setItem('helpnest:editor-mode', next)
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Image,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: 'Start writing your article...' }),
      CharacterCount,
      CodeBlockLowlight.configure({ lowlight: createLowlight(common) }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: article.content?.trimStart().startsWith('<')
      ? fixOrderedListCounters(article.content)
      : article.content || '',
    onUpdate: () => {
      setSaveStatus('unsaved')
      scheduleAutoSaveRef.current()
    },
  })

  const save = useCallback(async (opts?: { saveVersion?: boolean; publishDraft?: boolean }) => {
    if (!editor) return
    const content = editor.getHTML()
    const currentTitle = titleRef.current
    const currentSlug = slugRef.current
    const currentExcerpt = excerptRef.current
    const currentCollectionId = collectionIdRef.current
    const currentStatus = statusRef.current

    setSaveStatus('saving')
    try {
      const res = await fetch(`/api/articles/${article.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: currentTitle,
          slug: currentSlug,
          content,
          excerpt: currentExcerpt,
          collectionId: currentCollectionId,
          status: currentStatus,
          publishDraft: opts?.publishDraft ?? false,
        }),
      })
      if (!res.ok) throw new Error(`Save failed: ${res.status}`)
      lastSaved.current = {
        title: currentTitle,
        content,
        excerpt: currentExcerpt,
        collectionId: currentCollectionId,
        status: currentStatus,
      }
      setSaveStatus('saved')
      if (opts?.publishDraft) setHasDraft(false)
      else if (statusRef.current === 'PUBLISHED') setHasDraft(true)

      if (opts?.saveVersion) {
        await fetch(`/api/articles/${article.id}/versions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: currentTitle, content }),
        })
      }
    } catch {
      setSaveStatus('error')
    }
  }, [editor, article.id])

  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => save(), 30000)
  }, [save])

  // Keep the ref in sync with the latest scheduleAutoSave.
  useEffect(() => {
    scheduleAutoSaveRef.current = scheduleAutoSave
  }, [scheduleAutoSave])

  // Trigger auto-save when metadata changes.
  useEffect(() => {
    const changed =
      title !== lastSaved.current.title ||
      excerpt !== lastSaved.current.excerpt ||
      collectionId !== lastSaved.current.collectionId ||
      status !== lastSaved.current.status
    if (changed) {
      setSaveStatus('unsaved')
      scheduleAutoSave()
    }
    // scheduleAutoSave is intentionally omitted — it's stable via useCallback
    // and including it would cause this effect to re-run on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, excerpt, collectionId, status])

  async function publish() {
    setStatus('PUBLISHED')
    statusRef.current = 'PUBLISHED'
    await save({ saveVersion: true, publishDraft: true })
  }

  async function loadVersions() {
    try {
      const res = await fetch(`/api/articles/${article.id}/versions`)
      if (!res.ok) throw new Error('Failed to load versions')
      const data = await res.json() as ArticleVersion[]
      setVersions(data)
      setShowVersions(true)
    } catch {
      // fail silently — button just doesn't open the modal
    }
  }

  function restoreVersion(versionContent: string, versionTitle: string) {
    editor?.commands.setContent(versionContent)
    setTitle(versionTitle)
    titleRef.current = versionTitle
    setShowVersions(false)
    setSaveStatus('unsaved')
    scheduleAutoSave()
  }

  const wordCount = editor?.storage.characterCount?.words() ?? 0
  const readTime = Math.max(1, Math.round(wordCount / 200))

  return (
    <div className="flex h-screen bg-cream overflow-hidden">
      {/* Left outline panel */}
      {showOutline && editor && <EditorOutline editor={editor} />}

      {/* Editor area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <a href="/dashboard/articles" className="text-muted hover:text-ink transition-colors text-sm">
              &larr; Articles
            </a>
            <div className="flex items-center gap-1 border-l border-border pl-3">
              {/* Outline toggle */}
              <button
                onClick={() => setShowOutline((v) => !v)}
                title="Toggle outline"
                className={`p-1.5 rounded transition-colors ${showOutline ? 'bg-ink text-cream' : 'text-muted hover:text-ink hover:bg-cream'}`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h8M4 14h12M4 18h6" />
                </svg>
              </button>
              {/* Meta sidebar toggle */}
              <button
                onClick={() => setShowMeta((v) => !v)}
                title="Toggle properties panel"
                className={`p-1.5 rounded transition-colors ${showMeta ? 'bg-ink text-cream' : 'text-muted hover:text-ink hover:bg-cream'}`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                  <rect x="14" y="10" width="6" height="8" rx="1" strokeWidth={2} />
                </svg>
              </button>
              {/* Editor mode switch */}
              <div className="ml-1 inline-flex items-center rounded-lg border border-border bg-cream p-0.5">
                <button
                  onClick={() => setAndPersistEditorMode('classic')}
                  aria-pressed={editorMode === 'classic'}
                  title="Classic editor"
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    editorMode === 'classic'
                      ? 'bg-white text-ink shadow-sm'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  Classic
                </button>
                <button
                  onClick={() => setAndPersistEditorMode('notion')}
                  aria-pressed={editorMode === 'notion'}
                  title="Notion-style editor"
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    editorMode === 'notion'
                      ? 'bg-white text-ink shadow-sm'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  Notion
                </button>
              </div>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              saveStatus === 'saved' ? 'text-green bg-green/10' :
              saveStatus === 'saving' ? 'text-muted bg-cream' :
              saveStatus === 'error' ? 'text-red-500 bg-cream' :
              'text-muted bg-cream'
            }`}>
              {saveStatus === 'saved' ? '✓ Saved' :
               saveStatus === 'saving' ? 'Saving...' :
               saveStatus === 'error' ? 'Save failed' :
               'Unsaved changes'}
            </span>
            {hasDraft && saveStatus === 'saved' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                Unpublished changes
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadVersions}
              className="text-sm text-muted hover:text-ink transition-colors px-3 py-1.5"
            >
              History
            </button>
            <button
              onClick={() => save()}
              className="text-sm text-muted hover:text-ink transition-colors border border-border rounded-lg px-3 py-1.5"
            >
              Save draft
            </button>
            <button
              onClick={publish}
              className="text-sm bg-accent text-white rounded-lg px-4 py-1.5 hover:bg-accent/90 transition-colors font-medium"
            >
              {status === 'PUBLISHED' ? 'Update' : 'Publish'}
            </button>
          </div>
        </div>

        {/* Toolbar: always in the DOM, hidden in notion mode via CSS to keep
            ProseMirror's sibling node references stable */}
        {editor && (
          <div className={editorMode === 'notion' ? 'hidden' : ''}>
            <EditorToolbar editor={editor} />
          </div>
        )}

        {/* Bubble + floating menus: always mounted, hidden in classic mode via shouldShow */}
        {editor && (
          <>
            <EditorBubbleMenu editor={editor} active={editorMode === 'notion'} />
            <EditorFloatingMenu editor={editor} active={editorMode === 'notion'} />
          </>
        )}

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-8 py-10">
            {/* Title */}
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Article title"
              className="w-full font-serif text-4xl text-ink bg-transparent outline-none placeholder:text-muted/40 mb-6 leading-tight"
            />
            {/* Editor body */}
            <EditorContent
              editor={editor}
              className="prose-editor hn-prose min-h-[400px] focus:outline-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-2 border-t border-border bg-white flex items-center gap-4 text-xs text-muted shrink-0">
          <span>{wordCount} words</span>
          <span>&middot;</span>
          <span>{readTime} min read</span>
        </div>
      </div>

      {/* Right metadata sidebar */}
      {showMeta && <ArticleMetaSidebar
        articleId={article.id}
        articleTitle={title}
        slug={slug}
        onSlugChange={setSlug}
        excerpt={excerpt}
        onExcerptChange={setExcerpt}
        collectionId={collectionId}
        onCollectionChange={setCollectionId}
        status={status}
        collections={collections}
      />}

      {/* Version history modal */}
      {showVersions && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40"
          onClick={() => setShowVersions(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-medium text-ink">Version History</h2>
              <button
                onClick={() => setShowVersions(false)}
                className="text-muted hover:text-ink"
              >
                &#x2715;
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-border">
              {versions.length === 0 ? (
                <p className="p-6 text-center text-muted text-sm">No versions saved yet.</p>
              ) : (
                versions.map((v) => (
                  <div key={v.id} className="flex items-center justify-between p-4 hover:bg-cream">
                    <div>
                      <p className="text-sm font-medium text-ink">Version {v.version}</p>
                      <p className="text-xs text-muted mt-0.5">
                        {new Date(v.createdAt).toLocaleString()} &middot; {v.author.name ?? v.author.email}
                      </p>
                    </div>
                    <button
                      onClick={() => restoreVersion(v.content, v.title)}
                      className="text-xs text-accent hover:underline"
                    >
                      Restore
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
