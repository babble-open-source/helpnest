import { submitArticleFeedback } from '../api'

export function renderArticleFeedback(articleId: string): string {
  return `
    <div class="hn-feedback" data-article-id="${articleId}">
      <p class="hn-feedback-label">Did this answer your question?</p>
      <div class="hn-feedback-buttons">
        <button class="hn-feedback-btn" data-feedback="helpful" type="button" aria-label="Helpful">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
          </svg>
        </button>
        <button class="hn-feedback-btn" data-feedback="not" type="button" aria-label="Not helpful">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
          </svg>
        </button>
      </div>
      <p class="hn-feedback-thanks" style="display:none">Thanks for your feedback!</p>
    </div>
  `
}

export function bindFeedbackEvents(container: HTMLElement) {
  container.querySelectorAll('.hn-feedback').forEach((el) => {
    const articleId = (el as HTMLElement).dataset.articleId
    if (!articleId) return
    el.querySelectorAll('.hn-feedback-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = (btn as HTMLElement).dataset.feedback as 'helpful' | 'not'
        void submitArticleFeedback(articleId, type)
        const buttonsDiv = el.querySelector('.hn-feedback-buttons') as HTMLElement
        const thanks = el.querySelector('.hn-feedback-thanks') as HTMLElement
        if (buttonsDiv) buttonsDiv.style.display = 'none'
        if (thanks) thanks.style.display = 'block'
      })
    })
  })
}
