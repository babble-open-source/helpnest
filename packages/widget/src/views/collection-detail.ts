import { getState, pushView, popView } from '../state'
import { fetchArticles } from '../api'
import { renderHeader } from '../components/header'
import type { CollectionNode, ArticleSummary } from '../types'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function findNode(nodes: CollectionNode[], id: string): CollectionNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    const found = findNode(node.subCollections, id)
    if (found) return found
  }
  return null
}

interface CollectionDetailData {
  collectionTitle: string
  collectionDescription: string | null
  subCollections: CollectionNode[]
  articles: ArticleSummary[]
}

export async function loadCollectionDetail(
  collectionId: string,
  allCollections: CollectionNode[]
): Promise<CollectionDetailData> {
  const node = findNode(allCollections, collectionId)
  const subCollections = node?.subCollections ?? []

  const { collection, articles } = await fetchArticles(collectionId)

  return {
    collectionTitle: collection.title || node?.title || 'Collection',
    collectionDescription: collection.description ?? node?.description ?? null,
    subCollections,
    articles,
  }
}

export function renderCollectionDetail(data: CollectionDetailData): string {
  const subCollectionsHtml = data.subCollections.length > 0
    ? `<div class="hn-col-detail-subcols">
        ${data.subCollections.map((sub) => `
          <button class="hn-col-card" type="button" data-action="open-subcollection" data-collection-id="${escapeHtml(sub.id)}" data-collection-title="${escapeHtml(sub.title)}">
            <div class="hn-col-card-body">
              <span class="hn-col-card-title">${escapeHtml(sub.title)}</span>
              ${sub.description ? `<span class="hn-col-card-desc">${escapeHtml(sub.description.slice(0, 80))}${sub.description.length > 80 ? '…' : ''}</span>` : ''}
              <span class="hn-col-card-count">${sub.articleCount} article${sub.articleCount !== 1 ? 's' : ''}</span>
            </div>
            <svg class="hn-col-card-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        `).join('')}
      </div>`
    : ''

  const articlesHtml = data.articles.length > 0
    ? `<div class="hn-col-detail-articles">
        ${data.articles.map((article) => `
          <button class="hn-article-row" type="button" data-action="open-article" data-article-id="${escapeHtml(article.id)}">
            <span class="hn-article-row-title">${escapeHtml(article.title)}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        `).join('')}
      </div>`
    : `<p class="hn-col-detail-empty">No articles in this collection.</p>`

  return `
    <div class="hn-view hn-view-collection-detail">
      ${renderHeader({ title: 'Help', showBack: true, showClose: true })}
      <div class="hn-col-detail-header">
        <h3 class="hn-col-detail-title">${escapeHtml(data.collectionTitle)}</h3>
        ${data.collectionDescription ? `<p class="hn-col-detail-desc">${escapeHtml(data.collectionDescription)}</p>` : ''}
      </div>
      <div class="hn-view-body">
        ${subCollectionsHtml}
        ${articlesHtml}
      </div>
    </div>
  `
}

export function renderCollectionDetailLoading(title: string): string {
  return `
    <div class="hn-view hn-view-collection-detail">
      ${renderHeader({ title: 'Help', showBack: true, showClose: true })}
      <div class="hn-col-detail-header">
        <h3 class="hn-col-detail-title">${escapeHtml(title)}</h3>
      </div>
      <div class="hn-view-body">
        <div class="hn-loading">
          <div class="hn-skeleton" style="width: 70%; height: 18px; margin-bottom: 8px;"></div>
          <div class="hn-skeleton" style="width: 50%; height: 18px; margin-bottom: 8px;"></div>
          <div class="hn-skeleton" style="width: 60%; height: 18px;"></div>
        </div>
      </div>
    </div>
  `
}

export function bindCollectionDetailEvents(container: HTMLElement): void {
  container.querySelector('.hn-header-back')?.addEventListener('click', () => {
    popView()
  })

  container.querySelector('.hn-header-close')?.addEventListener('click', () => {
    container.dispatchEvent(new CustomEvent('hn:close', { bubbles: true }))
  })

  container.querySelectorAll('[data-action="open-subcollection"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const collectionId = (btn as HTMLElement).dataset.collectionId
      const title = (btn as HTMLElement).dataset.collectionTitle
      if (collectionId && title) {
        pushView({ kind: 'collection-detail', collectionId, title })
      }
    })
  })

  container.querySelectorAll('[data-action="open-article"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const articleId = (btn as HTMLElement).dataset.articleId
      if (articleId) {
        pushView({ kind: 'article', articleId })
      }
    })
  })
}
