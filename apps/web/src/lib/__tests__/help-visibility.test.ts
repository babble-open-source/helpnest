import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: {
    member: { findFirst: vi.fn() },
  },
}))
vi.mock('@/lib/auth-api', () => ({ requireAuth: vi.fn() }))

import { getHelpCenterVisibility, getApiVisibility } from '../help-visibility'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth-api'

const mockAuth = vi.mocked(auth)
const mockMemberFindFirst = vi.mocked(prisma.member.findFirst)
const mockRequireAuth = vi.mocked(requireAuth)

function makeRequest(authHeader?: string): Request {
  const headers = new Headers()
  if (authHeader) headers.set('authorization', authHeader)
  return new Request('https://example.com/api/test', { headers })
}

beforeEach(() => {
  mockAuth.mockReset()
  mockMemberFindFirst.mockReset()
  mockRequireAuth.mockReset()
})

// ---------------------------------------------------------------------------
// getHelpCenterVisibility
// ---------------------------------------------------------------------------

describe('getHelpCenterVisibility', () => {
  it("returns ['PUBLIC'] when there is no active session", async () => {
    mockAuth.mockResolvedValue(null as never)

    const result = await getHelpCenterVisibility('ws-abc')

    expect(result).toEqual(['PUBLIC'])
    expect(mockMemberFindFirst).not.toHaveBeenCalled()
  })

  it("returns ['PUBLIC'] when session exists but user has no id", async () => {
    mockAuth.mockResolvedValue({ user: { id: null, email: 'user@example.com' } } as never)

    const result = await getHelpCenterVisibility('ws-abc')

    expect(result).toEqual(['PUBLIC'])
    expect(mockMemberFindFirst).not.toHaveBeenCalled()
  })

  it("returns ['PUBLIC'] when session user is not a member of the workspace", async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never)
    mockMemberFindFirst.mockResolvedValue(null)

    const result = await getHelpCenterVisibility('ws-abc')

    expect(result).toEqual(['PUBLIC'])
  })

  it("returns ['PUBLIC', 'INTERNAL'] when the session user is an active member of the workspace", async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-2' } } as never)
    mockMemberFindFirst.mockResolvedValue({ id: 'member-1' } as never)

    const result = await getHelpCenterVisibility('ws-abc')

    expect(result).toEqual(['PUBLIC', 'INTERNAL'])
  })

  it('passes the correct workspaceId and userId to the membership query', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-3' } } as never)
    mockMemberFindFirst.mockResolvedValue({ id: 'member-2' } as never)

    await getHelpCenterVisibility('ws-target')

    expect(mockMemberFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-3',
          workspaceId: 'ws-target',
          deactivatedAt: null,
        }),
      }),
    )
  })

  it("returns ['PUBLIC'] when session user object is entirely absent", async () => {
    mockAuth.mockResolvedValue({ user: undefined } as never)

    const result = await getHelpCenterVisibility('ws-abc')

    expect(result).toEqual(['PUBLIC'])
  })
})

// ---------------------------------------------------------------------------
// getApiVisibility
// ---------------------------------------------------------------------------

describe('getApiVisibility', () => {
  it("returns ['PUBLIC', 'INTERNAL'] when auth succeeds and workspaceId matches", async () => {
    mockRequireAuth.mockResolvedValue({ workspaceId: 'ws-match', via: 'session' })

    const result = await getApiVisibility(makeRequest(), 'ws-match')

    expect(result).toEqual(['PUBLIC', 'INTERNAL'])
  })

  it("returns ['PUBLIC'] when requireAuth returns null", async () => {
    mockRequireAuth.mockResolvedValue(null)

    const result = await getApiVisibility(makeRequest(), 'ws-abc')

    expect(result).toEqual(['PUBLIC'])
  })

  it("returns ['PUBLIC'] when auth workspace does not match the requested workspace", async () => {
    mockRequireAuth.mockResolvedValue({ workspaceId: 'ws-other', via: 'session' })

    const result = await getApiVisibility(makeRequest(), 'ws-abc')

    expect(result).toEqual(['PUBLIC'])
  })

  it("returns ['PUBLIC'] when requireAuth throws (non-throwing guarantee)", async () => {
    mockRequireAuth.mockRejectedValue(new Error('Auth service unavailable'))

    const result = await getApiVisibility(makeRequest(), 'ws-abc')

    expect(result).toEqual(['PUBLIC'])
  })

  it("returns ['PUBLIC', 'INTERNAL'] for apikey auth when workspace matches", async () => {
    mockRequireAuth.mockResolvedValue({ workspaceId: 'ws-api', via: 'apikey' })

    const result = await getApiVisibility(
      makeRequest('Bearer hn_live_validkey'),
      'ws-api',
    )

    expect(result).toEqual(['PUBLIC', 'INTERNAL'])
  })

  it('forwards the request object to requireAuth', async () => {
    mockRequireAuth.mockResolvedValue(null)

    const request = makeRequest('Bearer hn_live_test')
    await getApiVisibility(request, 'ws-abc')

    expect(mockRequireAuth).toHaveBeenCalledWith(request)
  })
})
