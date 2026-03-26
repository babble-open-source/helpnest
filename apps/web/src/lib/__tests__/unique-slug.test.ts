import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    collection: {
      findFirst: vi.fn(),
    },
    article: {
      findFirst: vi.fn(),
    },
  },
}))

import { uniqueCollectionSlug, uniqueArticleSlug } from '../unique-slug'
import { prisma } from '@/lib/db'

const mockCollectionFindFirst = vi.mocked(prisma.collection.findFirst)
const mockArticleFindFirst = vi.mocked(prisma.article.findFirst)

const WORKSPACE_ID = 'ws-test-123'

beforeEach(() => {
  mockCollectionFindFirst.mockReset()
  mockArticleFindFirst.mockReset()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a fake DB record (truthy — simulates a slug conflict). */
function conflict() {
  return { id: 'existing' } as never
}

/** Returns null (no conflict). */
function noConflict() {
  return null as never
}

// ---------------------------------------------------------------------------
// uniqueCollectionSlug
// ---------------------------------------------------------------------------

describe('uniqueCollectionSlug', () => {
  describe('happy path — no conflicts', () => {
    it('returns the slugified base when there is no existing record', async () => {
      mockCollectionFindFirst.mockResolvedValue(noConflict())

      const result = await uniqueCollectionSlug('Getting Started', WORKSPACE_ID)
      expect(result).toBe('getting-started')
    })

    it('queries with the correct workspaceId and candidate slug', async () => {
      mockCollectionFindFirst.mockResolvedValue(noConflict())

      await uniqueCollectionSlug('FAQs', WORKSPACE_ID)

      expect(mockCollectionFindFirst).toHaveBeenCalledWith({
        where: { workspaceId: WORKSPACE_ID, slug: 'faqs' },
      })
    })

    it('returns the base slug without a numeric suffix on the first attempt', async () => {
      mockCollectionFindFirst.mockResolvedValue(noConflict())

      const result = await uniqueCollectionSlug('release-notes', WORKSPACE_ID)
      expect(result).toBe('release-notes')
      // findFirst called exactly once — no retries needed
      expect(mockCollectionFindFirst).toHaveBeenCalledTimes(1)
    })
  })

  describe('slug conflicts — numeric suffix appended', () => {
    it('appends -1 when the base slug is taken', async () => {
      mockCollectionFindFirst
        .mockResolvedValueOnce(conflict())   // 'getting-started' exists
        .mockResolvedValue(noConflict())     // 'getting-started-1' is free

      const result = await uniqueCollectionSlug('Getting Started', WORKSPACE_ID)
      expect(result).toBe('getting-started-1')
    })

    it('increments the suffix until a free slug is found', async () => {
      mockCollectionFindFirst
        .mockResolvedValueOnce(conflict())   // -0 (base) taken
        .mockResolvedValueOnce(conflict())   // -1 taken
        .mockResolvedValueOnce(conflict())   // -2 taken
        .mockResolvedValue(noConflict())     // -3 free

      const result = await uniqueCollectionSlug('docs', WORKSPACE_ID)
      expect(result).toBe('docs-3')
    })

    it('queries the DB with the correct suffixed candidate on each attempt', async () => {
      mockCollectionFindFirst
        .mockResolvedValueOnce(conflict())
        .mockResolvedValue(noConflict())

      await uniqueCollectionSlug('general', WORKSPACE_ID)

      expect(mockCollectionFindFirst).toHaveBeenNthCalledWith(1, {
        where: { workspaceId: WORKSPACE_ID, slug: 'general' },
      })
      expect(mockCollectionFindFirst).toHaveBeenNthCalledWith(2, {
        where: { workspaceId: WORKSPACE_ID, slug: 'general-1' },
      })
    })
  })

  describe('empty / invalid base input', () => {
    it("uses 'untitled' when the base slugifies to an empty string", async () => {
      mockCollectionFindFirst.mockResolvedValue(noConflict())

      const result = await uniqueCollectionSlug('', WORKSPACE_ID)
      expect(result).toBe('untitled')
    })

    it("uses 'untitled' for a whitespace-only base", async () => {
      mockCollectionFindFirst.mockResolvedValue(noConflict())

      const result = await uniqueCollectionSlug('   ', WORKSPACE_ID)
      expect(result).toBe('untitled')
    })

    it("uses 'untitled' for a base that is only special characters", async () => {
      mockCollectionFindFirst.mockResolvedValue(noConflict())

      const result = await uniqueCollectionSlug('!!!', WORKSPACE_ID)
      expect(result).toBe('untitled')
    })
  })

  describe('UUID fallback after MAX_SLUG_ATTEMPTS (50) exhausted', () => {
    it('returns a slug with a UUID suffix when all 50 numeric candidates are taken', async () => {
      // All 50 attempts (attempt 0 = base, attempts 1-49 = suffixed) conflict.
      mockCollectionFindFirst.mockResolvedValue(conflict())

      const result = await uniqueCollectionSlug('busy', WORKSPACE_ID)

      // Must start with the slugified base
      expect(result).toMatch(/^busy-/)
      // The UUID suffix is 8 hex characters (slice(0,8) of a UUID without dashes)
      expect(result).toMatch(/^busy-[0-9a-f-]{8,}$/)
      // findFirst must have been called exactly 50 times before giving up
      expect(mockCollectionFindFirst).toHaveBeenCalledTimes(50)
    })
  })
})

// ---------------------------------------------------------------------------
// uniqueArticleSlug
// ---------------------------------------------------------------------------

describe('uniqueArticleSlug', () => {
  describe('happy path — no conflicts', () => {
    it('returns the slugified base when there is no existing record', async () => {
      mockArticleFindFirst.mockResolvedValue(noConflict())

      const result = await uniqueArticleSlug('How to Install', WORKSPACE_ID)
      expect(result).toBe('how-to-install')
    })

    it('queries with the correct workspaceId and slug', async () => {
      mockArticleFindFirst.mockResolvedValue(noConflict())

      await uniqueArticleSlug('Quick Start', WORKSPACE_ID)

      expect(mockArticleFindFirst).toHaveBeenCalledWith({
        where: { workspaceId: WORKSPACE_ID, slug: 'quick-start' },
      })
    })
  })

  describe('slug conflicts — numeric suffix appended', () => {
    it('appends -1 when the base slug is taken', async () => {
      mockArticleFindFirst
        .mockResolvedValueOnce(conflict())
        .mockResolvedValue(noConflict())

      const result = await uniqueArticleSlug('Quick Start', WORKSPACE_ID)
      expect(result).toBe('quick-start-1')
    })

    it('increments suffix until free', async () => {
      mockArticleFindFirst
        .mockResolvedValueOnce(conflict())
        .mockResolvedValueOnce(conflict())
        .mockResolvedValue(noConflict())

      const result = await uniqueArticleSlug('faq', WORKSPACE_ID)
      expect(result).toBe('faq-2')
    })
  })

  describe('empty / invalid base input', () => {
    it("uses 'untitled' when the base slugifies to empty", async () => {
      mockArticleFindFirst.mockResolvedValue(noConflict())

      const result = await uniqueArticleSlug('', WORKSPACE_ID)
      expect(result).toBe('untitled')
    })
  })

  describe('UUID fallback after MAX_SLUG_ATTEMPTS exhausted', () => {
    it('returns a UUID-suffixed slug after 50 conflicts', async () => {
      mockArticleFindFirst.mockResolvedValue(conflict())

      const result = await uniqueArticleSlug('popular', WORKSPACE_ID)

      expect(result).toMatch(/^popular-/)
      expect(mockArticleFindFirst).toHaveBeenCalledTimes(50)
    })
  })

  describe('isolation from collection mock', () => {
    it('does not call prisma.collection.findFirst for article slugs', async () => {
      mockArticleFindFirst.mockResolvedValue(noConflict())

      await uniqueArticleSlug('test', WORKSPACE_ID)

      expect(mockCollectionFindFirst).not.toHaveBeenCalled()
    })
  })
})
