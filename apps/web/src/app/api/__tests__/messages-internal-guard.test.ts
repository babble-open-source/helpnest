import { vi, beforeEach, describe, it, expect } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    conversation: {
      findFirst: vi.fn(),
    },
    message: {
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    workspace: { findFirst: vi.fn() },
  },
}))
vi.mock('@/lib/auth-api', () => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/ai-agent', () => ({ runAgent: vi.fn(), recordKnowledgeGap: vi.fn() }))
vi.mock('@/lib/ai/resolve-provider', () => ({ isByok: vi.fn(() => false) }))
vi.mock('@/lib/cloud', () => ({
  checkLimit: vi.fn(async () => ({ allowed: true, plan: 'SELF_HOSTED' })),
  incrementUsage: vi.fn(),
}))
vi.mock('@/lib/redis', () => ({ redis: null }))
vi.mock('@/lib/article-drafter', () => ({ draftArticle: vi.fn() }))
vi.mock('@/lib/conversation-events', () => ({ emitConversationEvent: vi.fn() }))

import { GET } from '../conversations/[id]/messages/route'
import { prisma } from '@/lib/db'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.conversation.findFirst).mockResolvedValue({ id: 'conv_1' } as never)
  vi.mocked(prisma.message.findMany).mockResolvedValue([] as never)
})

function makeRequest(sessionToken: string | null, visitorId: string | null) {
  const headers = new Headers()
  if (sessionToken) headers.set('x-session-token', sessionToken)
  if (visitorId) headers.set('x-visitor-id', visitorId)
  return new Request('http://localhost/api/conversations/conv_1/messages', { headers })
}

describe('Messages GET — widget isInternal guard', () => {
  it('filters isInternal:false when sessionToken is present', async () => {
    await GET(makeRequest('tok_abc', null), { params: Promise.resolve({ id: 'conv_1' }) })
    expect(vi.mocked(prisma.message.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isInternal: false }),
      }),
    )
  })

  it('filters isInternal:false when visitorId is present', async () => {
    await GET(makeRequest(null, 'vis_xyz'), { params: Promise.resolve({ id: 'conv_1' }) })
    expect(vi.mocked(prisma.message.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isInternal: false }),
      }),
    )
  })
})
