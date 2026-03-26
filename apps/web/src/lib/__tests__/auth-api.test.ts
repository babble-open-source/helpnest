import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: {
    member: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}))
vi.mock('@/lib/api-key', () => ({ validateApiKey: vi.fn() }))

import { requireAuth } from '../auth-api'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { validateApiKey } from '@/lib/api-key'

const mockAuth = vi.mocked(auth)
const mockValidateApiKey = vi.mocked(validateApiKey)
const mockMemberFindFirst = vi.mocked(prisma.member.findFirst)
const mockUserFindUnique = vi.mocked(prisma.user.findUnique)

function makeRequest(options: {
  authorization?: string
  cookie?: string
} = {}): Request {
  const headers = new Headers()
  if (options.authorization) headers.set('authorization', options.authorization)
  if (options.cookie) headers.set('cookie', options.cookie)
  return new Request('https://example.com/api/test', { headers })
}

beforeEach(() => {
  mockAuth.mockReset()
  mockValidateApiKey.mockReset()
  mockMemberFindFirst.mockReset()
  mockUserFindUnique.mockReset()
})

// ---------------------------------------------------------------------------
// Bearer token path
// ---------------------------------------------------------------------------

describe('requireAuth — Bearer token', () => {
  it('returns apikey auth result when Bearer token is valid', async () => {
    mockValidateApiKey.mockResolvedValue({ workspaceId: 'ws-123' })

    const result = await requireAuth(makeRequest({ authorization: 'Bearer hn_live_abc' }))

    expect(result).toEqual({ workspaceId: 'ws-123', via: 'apikey' })
    expect(mockValidateApiKey).toHaveBeenCalledWith('hn_live_abc')
    // Must not fall through to session auth
    expect(mockAuth).not.toHaveBeenCalled()
  })

  it('returns null when Bearer token is invalid and does not fall through to session auth', async () => {
    mockValidateApiKey.mockResolvedValue(null)

    const result = await requireAuth(makeRequest({ authorization: 'Bearer hn_live_bad' }))

    expect(result).toBeNull()
    // A client sending a Bearer token that is invalid must not silently succeed via cookies
    expect(mockAuth).not.toHaveBeenCalled()
  })

  it('trims whitespace from the raw token before validation', async () => {
    mockValidateApiKey.mockResolvedValue({ workspaceId: 'ws-999' })

    await requireAuth(makeRequest({ authorization: 'Bearer   hn_live_spaced   ' }))

    expect(mockValidateApiKey).toHaveBeenCalledWith('hn_live_spaced')
  })
})

// ---------------------------------------------------------------------------
// Session path — no auth header
// ---------------------------------------------------------------------------

describe('requireAuth — session auth', () => {
  it('returns null when there is no auth header and no active session', async () => {
    mockAuth.mockResolvedValue(null)

    const result = await requireAuth(makeRequest())

    expect(result).toBeNull()
    expect(mockMemberFindFirst).not.toHaveBeenCalled()
  })

  it('returns null when session exists but user object is absent', async () => {
    mockAuth.mockResolvedValue({ user: null } as never)

    const result = await requireAuth(makeRequest())

    expect(result).toBeNull()
  })

  it('returns session auth with preferred workspace when cookie matches a membership', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1', email: 'user@example.com' } } as never)
    mockMemberFindFirst.mockResolvedValue({ workspaceId: 'ws-preferred', userId: 'user-1' } as never)

    const result = await requireAuth(
      makeRequest({ cookie: 'helpnest-workspace=ws-preferred' }),
    )

    expect(result).toEqual({ workspaceId: 'ws-preferred', userId: 'user-1', via: 'session' })
    expect(mockMemberFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspaceId: 'ws-preferred' }),
      }),
    )
  })

  it('falls back to first active workspace when no preferred workspace cookie is set', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-2', email: 'user2@example.com' } } as never)
    // No preferred workspace cookie — single findFirst call for fallback path
    mockMemberFindFirst.mockResolvedValue({ workspaceId: 'ws-first', userId: 'user-2' } as never)

    const result = await requireAuth(makeRequest())

    expect(result).toEqual({ workspaceId: 'ws-first', userId: 'user-2', via: 'session' })
  })

  it('falls back to first active workspace when preferred workspace cookie does not match any membership', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-3', email: 'user3@example.com' } } as never)
    // First call: preferred workspace lookup returns no match; second call: fallback
    mockMemberFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ workspaceId: 'ws-fallback', userId: 'user-3' } as never)

    const result = await requireAuth(
      makeRequest({ cookie: 'helpnest-workspace=ws-nonexistent' }),
    )

    expect(result).toEqual({ workspaceId: 'ws-fallback', userId: 'user-3', via: 'session' })
    expect(mockMemberFindFirst).toHaveBeenCalledTimes(2)
  })

  it('returns null when session user has no active memberships', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-4', email: 'user4@example.com' } } as never)
    mockMemberFindFirst.mockResolvedValue(null)

    const result = await requireAuth(makeRequest())

    expect(result).toBeNull()
  })

  it('resolves userId by email when session.user.id is missing', async () => {
    // JWT can lack an id when it was minted without one
    mockAuth.mockResolvedValue({ user: { id: undefined, email: 'lookup@example.com' } } as never)
    mockUserFindUnique.mockResolvedValue({ id: 'user-resolved' } as never)
    mockMemberFindFirst.mockResolvedValue({ workspaceId: 'ws-email', userId: 'user-resolved' } as never)

    const result = await requireAuth(makeRequest())

    expect(mockUserFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'lookup@example.com' } }),
    )
    expect(result).toEqual({ workspaceId: 'ws-email', userId: 'user-resolved', via: 'session' })
  })

  it('returns null when session.user.id is missing and email lookup finds no user', async () => {
    mockAuth.mockResolvedValue({ user: { id: undefined, email: 'notfound@example.com' } } as never)
    mockUserFindUnique.mockResolvedValue(null)

    const result = await requireAuth(makeRequest())

    expect(result).toBeNull()
    expect(mockMemberFindFirst).not.toHaveBeenCalled()
  })

  it('returns null when session.user.id and email are both absent', async () => {
    mockAuth.mockResolvedValue({ user: { id: undefined, email: null } } as never)

    const result = await requireAuth(makeRequest())

    expect(result).toBeNull()
    expect(mockUserFindUnique).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Cookie parsing edge cases
// ---------------------------------------------------------------------------

describe('requireAuth — cookie parsing', () => {
  it('correctly parses the helpnest-workspace cookie from a multi-cookie header', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-5', email: 'user5@example.com' } } as never)
    mockMemberFindFirst.mockResolvedValue({ workspaceId: 'ws-multi', userId: 'user-5' } as never)

    await requireAuth(
      makeRequest({ cookie: 'other=value; helpnest-workspace=ws-multi; another=cookie' }),
    )

    expect(mockMemberFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspaceId: 'ws-multi' }),
      }),
    )
  })

  it('handles URL-encoded workspace ids in the cookie', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-6', email: 'user6@example.com' } } as never)
    mockMemberFindFirst.mockResolvedValue({ workspaceId: 'ws encoded', userId: 'user-6' } as never)

    await requireAuth(
      makeRequest({ cookie: 'helpnest-workspace=ws%20encoded' }),
    )

    expect(mockMemberFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspaceId: 'ws encoded' }),
      }),
    )
  })
})
