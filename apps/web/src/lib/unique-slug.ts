import { prisma } from '@/lib/db'
import { slugify } from '@/lib/slugify'

const MAX_SLUG_ATTEMPTS = 50

/**
 * Generates a unique collection slug by appending numeric suffixes.
 * Falls back to a random suffix after MAX_SLUG_ATTEMPTS to guarantee termination.
 */
export async function uniqueCollectionSlug(base: string, workspaceId: string): Promise<string> {
  const slug = slugify(base) || 'untitled'
  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const candidate = attempt === 0 ? slug : `${slug}-${attempt}`
    const existing = await prisma.collection.findFirst({ where: { workspaceId, slug: candidate } })
    if (!existing) return candidate
  }
  return `${slug}-${crypto.randomUUID().slice(0, 8)}`
}

/**
 * Generates a unique article slug by appending numeric suffixes.
 * Falls back to a random suffix after MAX_SLUG_ATTEMPTS to guarantee termination.
 */
export async function uniqueArticleSlug(base: string, workspaceId: string): Promise<string> {
  const slug = slugify(base) || 'untitled'
  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const candidate = attempt === 0 ? slug : `${slug}-${attempt}`
    const existing = await prisma.article.findFirst({ where: { workspaceId, slug: candidate } })
    if (!existing) return candidate
  }
  return `${slug}-${crypto.randomUUID().slice(0, 8)}`
}
