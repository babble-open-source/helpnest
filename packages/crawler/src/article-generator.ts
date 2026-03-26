import type { ArticleDraft } from './types'

interface PromptInput {
  markdown: string
  title: string
  url: string
  contentType: 'marketing' | 'docs' | 'app-ui' | 'other'
  workspaceName: string
  existingCollections: string[]
}

interface PromptOutput {
  system: string
  userMessage: string
}

const CONTENT_TYPE_INSTRUCTIONS: Record<string, string> = {
  marketing:
    'Transform this marketing/product page into a friendly, beginner-oriented help article. Focus on explaining what the product does and how users benefit. Use a "Getting Started" or "What is X" tone.',
  docs:
    'Clean up and restructure this existing documentation into a well-formatted help article. Preserve the original information but improve clarity and structure.',
  'app-ui':
    'Based on this application UI page, create a step-by-step "How to" guide that walks users through using this feature.',
  other:
    'Convert this web page content into a useful help article. Focus on the most actionable and informative parts.',
}

export function buildArticlePrompt(input: PromptInput): PromptOutput {
  const collectionList =
    input.existingCollections.length > 0
      ? `\n\nExisting collections in this help center: ${input.existingCollections.join(', ')}`
      : '\n\nNo existing collections yet — suggest a collection name for this article.'

  const system = `You are a help article writer for ${input.workspaceName}. ${CONTENT_TYPE_INSTRUCTIONS[input.contentType] ?? CONTENT_TYPE_INSTRUCTIONS.other}

Respond with ONLY a JSON object (no markdown wrapping) with these fields:
- title: string — clear, concise article title
- content: string — full article body in Markdown format
- excerpt: string — 1-2 sentence summary
- suggestedCollection: string | null — which collection this belongs in${collectionList}
- confidence: number — 0 to 1, how confident you are this is a useful help article`

  const userMessage = `Source URL: ${input.url}
Page title: ${input.title}
Content type: ${input.contentType}

---

${input.markdown}`

  return { system, userMessage }
}

export function parseArticleResponse(raw: string): ArticleDraft {
  // Try direct JSON parse
  try {
    const parsed = JSON.parse(raw)
    return normalizeArticle(parsed)
  } catch {
    // noop
  }

  // Try extracting JSON from code block
  const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1])
      return normalizeArticle(parsed)
    } catch {
      // noop
    }
  }

  // Fallback: use raw text as content
  return {
    title: 'Untitled Article',
    content: raw,
    excerpt: '',
    suggestedCollection: null,
    confidence: 0.3,
  }
}

function normalizeArticle(parsed: Record<string, unknown>): ArticleDraft {
  return {
    title: typeof parsed.title === 'string' ? parsed.title : 'Untitled Article',
    content: typeof parsed.content === 'string' ? parsed.content : '',
    excerpt: typeof parsed.excerpt === 'string' ? parsed.excerpt : '',
    suggestedCollection:
      typeof parsed.suggestedCollection === 'string' ? parsed.suggestedCollection : null,
    confidence: Math.min(1, Math.max(0, typeof parsed.confidence === 'number' ? parsed.confidence : 0.5)),
  }
}
