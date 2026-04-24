import { getState, popView } from '../state'
import { fetchArticle } from '../api'
import { renderHeader } from '../components/header'
import { renderMarkdown } from '../components/markdown'
import { renderArticleFeedback, bindFeedbackEvents } from '../components/feedback'
import type { ArticleDetail } from '../types'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<\/?(iframe|object|embed|base)\b[^>]*>/gi, '')
    .replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
    .replace(/\bhref\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, '')
    .replace(/\bsrc\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, '')
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const articleDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((today.getTime() - articleDate.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 30) return `${diffDays} days ago`
  const diffMonths = Math.round(diffDays / 30)
  return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`
}

export async function loadArticle(articleId: string): Promise<ArticleDetail | null> {
  return fetchArticle(articleId)
}

export function renderArticle(article: ArticleDetail): string {
  const { config } = getState()
  const baseUrl = (config as unknown as Record<string, unknown>)._baseUrl as string | undefined
    ?? window.location.origin
  const helpCenterUrl = `${baseUrl}/${article.workspaceSlug}/help/${article.collection.slug}/${article.slug}`

  const avatarHtml = article.author.avatar
    ? `<img class="hn-article-author-avatar" src="${escapeHtml(article.author.avatar)}" alt="${escapeHtml(article.author.name ?? '')}" />`
    : `<div class="hn-article-author-avatar-fallback">${escapeHtml((article.author.name ?? '?').charAt(0).toUpperCase())}</div>`

  return `
    <div class="hn-view hn-view-article">
      ${renderHeader({
        title: '',
        showBack: true,
        showClose: true,
        showExpand: true,
      })}
      <div class="hn-view-body hn-article-body">
        <h2 class="hn-article-title">${escapeHtml(article.title)}</h2>
        <div class="hn-article-meta">
          ${avatarHtml}
          <div class="hn-article-meta-text">
            <span class="hn-article-author-name">Written by ${escapeHtml(article.author.name ?? 'Support')}</span>
            <span class="hn-article-updated">Updated ${escapeHtml(formatRelativeDate(article.updatedAt))}</span>
          </div>
        </div>
        <div class="hn-article-content">
          ${article.content.trimStart().startsWith('<') ? sanitizeHtml(article.content) : renderMarkdown(article.content)}
        </div>
        ${renderArticleFeedback(article.id)}
        <a class="hn-article-open-link" href="${escapeHtml(helpCenterUrl)}" target="_blank" rel="noopener">
          Open in help center
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>
          </svg>
        </a>
      </div>
    </div>
  `
}

export function renderArticleLoading(): string {
  return `
    <div class="hn-view hn-view-article">
      ${renderHeader({ title: '', showBack: true, showClose: true })}
      <div class="hn-view-body hn-article-body">
        <div class="hn-loading">
          <div class="hn-skeleton" style="width: 90%; height: 24px; margin-bottom: 16px;"></div>
          <div class="hn-skeleton" style="width: 40%; height: 14px; margin-bottom: 24px;"></div>
          <div class="hn-skeleton" style="width: 100%; height: 14px; margin-bottom: 8px;"></div>
          <div class="hn-skeleton" style="width: 100%; height: 14px; margin-bottom: 8px;"></div>
          <div class="hn-skeleton" style="width: 80%; height: 14px;"></div>
        </div>
      </div>
    </div>
  `
}

export function bindArticleEvents(container: HTMLElement): void {
  container.querySelector('.hn-header-back')?.addEventListener('click', () => {
    popView()
  })

  container.querySelector('.hn-header-close')?.addEventListener('click', () => {
    container.dispatchEvent(new CustomEvent('hn:close', { bubbles: true }))
  })

  container.querySelector('.hn-header-expand')?.addEventListener('click', () => {
    container.dispatchEvent(new CustomEvent('hn:expand', { bubbles: true }))
  })

  bindFeedbackEvents(container)
}
