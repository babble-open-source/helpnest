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
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Youtube from '@tiptap/extension-youtube'
import { EditorToolbar } from './EditorToolbar'
import { ArticleMetaSidebar } from './ArticleMetaSidebar'
import { EditorOutline } from './EditorOutline'
import { EditorBubbleMenu } from './EditorBubbleMenu'
import { EditorFloatingMenu } from './EditorFloatingMenu'
import { fixOrderedListCounters } from '@/components/help/ArticleContent'
import { Tooltip } from '@/components/ui/Tooltip'
import { Link as LocaleLink } from '@/i18n/navigation'
import { useTranslations, useFormatter } from 'next-intl'

interface Article {
  id: string
  title: string
  slug: string
  content: string
  excerpt: string
  status: string
  collectionId: string
  collectionSlug: string
  hasDraft?: boolean
  aiGenerated?: boolean
}

interface Collection {
  id: string
  title: string
  emoji: string | null
  isArchived?: boolean
}

interface Props {
  article: Article
  collections: Collection[]
  workspaceSlug: string
  autoOpenCollectionPicker?: boolean
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

export function ArticleEditor({ article, collections, workspaceSlug, autoOpenCollectionPicker }: Props) {
  const t = useTranslations('editor')
  const tCommon = useTranslations('common')
  const format = useFormatter()
  const [hasDraft, setHasDraft] = useState(article.hasDraft ?? false)
  // dismissedAiBanner: user explicitly dismissed; bannerVisible: derives from current state
  const [dismissedAiBanner, setDismissedAiBanner] = useState(false)
  const [title, setTitle] = useState(article.title)
  const [slug, setSlug] = useState(article.slug)
  const [excerpt, setExcerpt] = useState(article.excerpt)
  const [collectionId, setCollectionId] = useState(article.collectionId)
  const [collectionSlug, setCollectionSlug] = useState(article.collectionSlug)
  // Track the last *saved* slug/collectionSlug separately — the live link must
  // point to the URL that actually exists, not the unsaved draft in the field.
  const [savedSlug, setSavedSlug] = useState(article.slug)
  const [savedCollectionSlug, setSavedCollectionSlug] = useState(article.collectionSlug)
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
      Placeholder.configure({ placeholder: t('startWriting') }),
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
      Youtube.configure({ nocookie: true, width: 640, height: 360 }),
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
      setSavedSlug(currentSlug)
      setSavedCollectionSlug(collectionSlug)
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
  }, [editor, article.id, collectionSlug])

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
          <div className="flex-1 min-w-0 flex items-center gap-2 overflow-hidden">
            <LocaleLink href="/dashboard/articles" className="text-muted hover:text-ink transition-colors text-sm shrink-0">
              {t('backToArticles')}
            </LocaleLink>
            <div className="flex items-center gap-1 border-s border-border ps-3">
              {/* Outline toggle */}
              <Tooltip content={t('toggleOutline')} side="bottom" align="start">
                <button
                  onClick={() => setShowOutline((v) => !v)}
                  aria-label={t('toggleOutline')}
                  className={`p-1.5 rounded transition-colors ${showOutline ? 'bg-ink text-cream' : 'text-muted hover:text-ink hover:bg-cream'}`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h8M4 14h12M4 18h6" />
                  </svg>
                </button>
              </Tooltip>
              {/* Meta sidebar toggle */}
              <Tooltip content={t('toggleProperties')} side="bottom" align="start">
                <button
                  onClick={() => setShowMeta((v) => !v)}
                  aria-label={t('toggleProperties')}
                  className={`p-1.5 rounded transition-colors ${showMeta ? 'bg-ink text-cream' : 'text-muted hover:text-ink hover:bg-cream'}`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                    <rect x="14" y="10" width="6" height="8" rx="1" strokeWidth={2} />
                  </svg>
                </button>
              </Tooltip>
              {/* Editor mode switch */}
              <div className="ms-1 inline-flex items-center rounded-lg border border-border bg-cream p-0.5">
                <Tooltip content={t('classicToolbar')} side="bottom" align="start">
                  <button
                    onClick={() => setAndPersistEditorMode('classic')}
                    aria-pressed={editorMode === 'classic'}
                    aria-label={t('classicToolbar')}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      editorMode === 'classic'
                        ? 'bg-white text-ink shadow-sm'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    {t('classic')}
                  </button>
                </Tooltip>
                <Tooltip content={t('notionStyle')} side="bottom" align="start">
                  <button
                    onClick={() => setAndPersistEditorMode('notion')}
                    aria-pressed={editorMode === 'notion'}
                    aria-label={t('notionStyle')}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      editorMode === 'notion'
                        ? 'bg-white text-ink shadow-sm'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    {t('notion')}
                  </button>
                </Tooltip>
              </div>
            </div>
            <span className={`min-w-0 shrink-0 text-xs px-2 py-0.5 rounded-full ${
              saveStatus === 'saved' ? 'text-green bg-green/10' :
              saveStatus === 'saving' ? 'text-muted bg-cream' :
              saveStatus === 'error' ? 'text-red-500 bg-cream' :
              'text-accent bg-accent/10'
            }`}>
              {saveStatus === 'saved' ? t('saved') :
               saveStatus === 'saving' ? tCommon('saving') :
               saveStatus === 'error' ? t('saveFailed') :
               t('unsavedChanges')}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {hasDraft && saveStatus === 'saved' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                {t('draftPendingPublish')}
              </span>
            )}
            {status === 'PUBLISHED' && (
              <>
                <LocaleLink
                  href={`/${workspaceSlug}/help/${savedCollectionSlug}/${savedSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors border border-border rounded-lg px-3 py-1.5"
                  title={
                    slug !== savedSlug || collectionSlug !== savedCollectionSlug
                      ? t('urlUnsaved')
                      : t('openArticle')
                  }
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  {t('viewLive')}
                </LocaleLink>
                <div className="w-px h-4 bg-border shrink-0" />
              </>
            )}
            <Tooltip content={t('history')} side="bottom" align="end">
              <button
                onClick={loadVersions}
                className="text-sm text-muted hover:text-ink transition-colors px-3 py-1.5"
              >
                {t('history')}
              </button>
            </Tooltip>
            <Tooltip content={t('saveDescription')} side="bottom" align="end">
              <button
                onClick={() => save()}
                className="text-sm text-muted hover:text-ink transition-colors px-3 py-1.5"
              >
                {tCommon('save')}
              </button>
            </Tooltip>
            <Tooltip
              content={status === 'PUBLISHED'
                ? t('publishDescription')
                : t('publishFirstDescription')}
              side="bottom"
              align="end"
            >
              <button
                onClick={publish}
                className="text-sm bg-accent text-white rounded-lg px-4 py-1.5 hover:bg-accent/90 transition-colors font-medium"
              >
                {status === 'PUBLISHED' ? tCommon('update') : tCommon('publish')}
              </button>
            </Tooltip>
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
          {/* AI banner: derive visibility from current state so it clears automatically after publish */}
          {!dismissedAiBanner && article.aiGenerated && (status === 'DRAFT' || (status === 'PUBLISHED' && hasDraft)) && (
            <div className="border-b border-border bg-accent/5 px-6 py-3 flex items-start justify-between gap-4">
              <p className="text-sm text-ink">
                {status === 'DRAFT'
                  ? t('aiDraftBanner')
                  : t('aiUpdateBanner')}
              </p>
              <button
                onClick={() => setDismissedAiBanner(true)}
                className="shrink-0 text-muted hover:text-ink text-xs mt-0.5"
              >
                {t('dismiss')}
              </button>
            </div>
          )}
          <div className="max-w-2xl mx-auto px-8 py-10">
            {/* Title */}
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('articleTitle')}
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
          <span>{t('words', { count: wordCount })}</span>
          <span>&middot;</span>
          <span>{t('readTime', { minutes: readTime })}</span>
        </div>
      </div>

      {/* Right metadata sidebar */}
      {showMeta && <ArticleMetaSidebar
        articleId={article.id}
        articleTitle={title}
        slug={slug}
        savedSlug={savedSlug}
        onSlugChange={setSlug}
        onSlugSave={() => save()}
        excerpt={excerpt}
        onExcerptChange={setExcerpt}
        collectionId={collectionId}
        onCollectionChange={(id) => {
          setCollectionId(id)
          const col = collections.find((c) => c.id === id)
          if (col) setCollectionSlug(col.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
        }}
        status={status}
        collections={collections}
        autoOpenPicker={autoOpenCollectionPicker}
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
              <h2 className="font-medium text-ink">{t('versionHistory')}</h2>
              <button
                onClick={() => setShowVersions(false)}
                className="text-muted hover:text-ink"
              >
                &#x2715;
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-border">
              {versions.length === 0 ? (
                <p className="p-6 text-center text-muted text-sm">{t('noVersions')}</p>
              ) : (
                versions.map((v) => (
                  <div key={v.id} className="flex items-center justify-between p-4 hover:bg-cream">
                    <div>
                      <p className="text-sm font-medium text-ink">{t('version')} {v.version}</p>
                      <p className="text-xs text-muted mt-0.5">
                        {format.dateTime(new Date(v.createdAt), { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} &middot; {v.author.name ?? v.author.email}
                      </p>
                    </div>
                    <button
                      onClick={() => restoreVersion(v.content, v.title)}
                      className="text-xs text-accent hover:underline"
                    >
                      {t('restore')}
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
