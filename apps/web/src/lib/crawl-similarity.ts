import { prisma } from '@/lib/db'
import { embedText } from '@/lib/embeddings'

interface SimilarityResult {
  isDuplicate: boolean
  isSuspicious: boolean
  similarArticleId: string | null
  similarArticleTitle: string | null
  score: number
}

/**
 * Check if article content is semantically similar to existing workspace articles.
 * Uses cosine similarity on OpenAI text-embedding-3-small vectors.
 *
 * Returns:
 * - isDuplicate (score > 0.85): skip this article
 * - isSuspicious (score 0.7-0.85): flag for review
 * - neither: create normally
 */
export async function checkArticleSimilarity(
  content: string,
  workspaceId: string,
): Promise<SimilarityResult> {
  const noMatch: SimilarityResult = {
    isDuplicate: false,
    isSuspicious: false,
    similarArticleId: null,
    similarArticleTitle: null,
    score: 0,
  }

  // Skip if OpenAI not configured (self-hosted without AI)
  let embedding: number[]
  try {
    embedding = await embedText(content.slice(0, 8000))
  } catch {
    return noMatch
  }

  if (embedding.length === 0) return noMatch

  // Get all article embeddings for this workspace with article titles
  const searchIndexes = await prisma.searchIndex.findMany({
    where: { workspaceId },
    include: {
      article: { select: { title: true } },
    },
  })

  if (searchIndexes.length === 0) return noMatch

  // Find most similar article by cosine similarity
  let bestScore = 0
  let bestMatch: { articleId: string; title: string } | null = null

  for (const index of searchIndexes) {
    if (!index.embedding) continue
    const storedEmbedding = index.embedding as number[]
    const score = cosineSimilarity(embedding, storedEmbedding)
    if (score > bestScore) {
      bestScore = score
      bestMatch = { articleId: index.articleId, title: index.article.title }
    }
  }

  if (!bestMatch) return noMatch

  return {
    isDuplicate: bestScore > 0.85,
    isSuspicious: bestScore > 0.7 && bestScore <= 0.85,
    similarArticleId: bestScore > 0.7 ? bestMatch.articleId : null,
    similarArticleTitle: bestScore > 0.7 ? bestMatch.title : null,
    score: bestScore,
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dotProduct = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!
    normA += a[i]! * a[i]!
    normB += b[i]! * b[i]!
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  return denominator === 0 ? 0 : dotProduct / denominator
}
