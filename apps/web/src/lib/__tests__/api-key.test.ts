import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'

// Mock the Prisma client before importing the module under test so that
// the module receives the mock at import time.
vi.mock('@/lib/db', () => ({
  prisma: {
    apiKey: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { hashKey, generateKey, validateApiKey } from '../api-key'
import { prisma } from '@/lib/db'

// Typed shorthand for the mocked Prisma methods.
const mockFindUnique = vi.mocked(prisma.apiKey.findUnique)
const mockUpdate = vi.mocked(prisma.apiKey.update)

beforeEach(() => {
  mockFindUnique.mockReset()
  mockUpdate.mockReset()
  // Default: update resolves silently (fire-and-forget path).
  mockUpdate.mockResolvedValue({} as never)
})

// ---------------------------------------------------------------------------
// hashKey
// ---------------------------------------------------------------------------

describe('hashKey', () => {
  it('returns a 64-character lowercase hex string (SHA-256 digest)', () => {
    const result = hashKey('hn_live_abc123')
    expect(result).toHaveLength(64)
    expect(result).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic — same input always produces the same hash', () => {
    const key = 'hn_live_test_key_determinism'
    expect(hashKey(key)).toBe(hashKey(key))
  })

  it('produces different hashes for different inputs', () => {
    expect(hashKey('hn_live_aaa')).not.toBe(hashKey('hn_live_bbb'))
  })

  it('matches Node crypto SHA-256 output directly', () => {
    const raw = 'hn_live_known_value'
    const expected = crypto.createHash('sha256').update(raw).digest('hex')
    expect(hashKey(raw)).toBe(expected)
  })

  it('handles an empty string without throwing', () => {
    expect(() => hashKey('')).not.toThrow()
    expect(hashKey('')).toHaveLength(64)
  })
})

// ---------------------------------------------------------------------------
// generateKey
// ---------------------------------------------------------------------------

describe('generateKey', () => {
  it('returns a key with the hn_live_ prefix', () => {
    expect(generateKey()).toMatch(/^hn_live_/)
  })

  it('appends exactly 32 hex characters after the prefix', () => {
    // 16 random bytes → 32 hex chars
    const key = generateKey()
    const suffix = key.slice('hn_live_'.length)
    expect(suffix).toHaveLength(32)
    expect(suffix).toMatch(/^[0-9a-f]{32}$/)
  })

  it('produces unique keys on successive calls', () => {
    const keys = new Set(Array.from({ length: 20 }, () => generateKey()))
    expect(keys.size).toBe(20)
  })

  it('total key length is 40 characters (8 prefix + 32 random hex)', () => {
    expect(generateKey()).toHaveLength(40)
  })
})

// ---------------------------------------------------------------------------
// validateApiKey — guard clauses (no DB hit)
// ---------------------------------------------------------------------------

describe('validateApiKey — invalid inputs rejected before DB lookup', () => {
  it('returns null for an empty string', async () => {
    expect(await validateApiKey('')).toBeNull()
    expect(mockFindUnique).not.toHaveBeenCalled()
  })

  it('returns null when the key does not start with hn_live_', async () => {
    expect(await validateApiKey('sk_live_somethingelse')).toBeNull()
    expect(mockFindUnique).not.toHaveBeenCalled()
  })

  it('returns null for a key with only the prefix and no suffix', async () => {
    // "hn_live_" starts with hn_live_ so it passes the prefix check —
    // the DB lookup will be called but should return null.
    mockFindUnique.mockResolvedValue(null)
    expect(await validateApiKey('hn_live_')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// validateApiKey — DB-backed success path
// ---------------------------------------------------------------------------

describe('validateApiKey — valid key for an active workspace', () => {
  const RAW_KEY = 'hn_live_' + 'a'.repeat(32)

  it('returns { workspaceId } when the key exists and the workspace is active', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'key-id-1',
      workspaceId: 'ws-abc',
      workspace: { deletedAt: null },
    } as never)

    const result = await validateApiKey(RAW_KEY)
    expect(result).toEqual({ workspaceId: 'ws-abc' })
  })

  it('queries the DB with the SHA-256 hash of the raw key, not the raw key itself', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'key-id-1',
      workspaceId: 'ws-abc',
      workspace: { deletedAt: null },
    } as never)

    await validateApiKey(RAW_KEY)

    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { keyHash: hashKey(RAW_KEY) },
      })
    )
  })

  it('fires a non-blocking lastUsedAt update after a successful validation', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'key-id-99',
      workspaceId: 'ws-xyz',
      workspace: { deletedAt: null },
    } as never)

    await validateApiKey(RAW_KEY)

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'key-id-99' },
        data: expect.objectContaining({ lastUsedAt: expect.any(Date) }),
      })
    )
  })

  it('does not await the lastUsedAt update — a rejection must not propagate', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'key-id-1',
      workspaceId: 'ws-abc',
      workspace: { deletedAt: null },
    } as never)
    // Simulate an update failure; the validation result should still be valid.
    mockUpdate.mockRejectedValue(new Error('DB write failed'))

    await expect(validateApiKey(RAW_KEY)).resolves.toEqual({ workspaceId: 'ws-abc' })
  })
})

// ---------------------------------------------------------------------------
// validateApiKey — DB-backed failure paths
// ---------------------------------------------------------------------------

describe('validateApiKey — key not found in DB', () => {
  it('returns null when findUnique returns null', async () => {
    mockFindUnique.mockResolvedValue(null)
    expect(await validateApiKey('hn_live_' + 'b'.repeat(32))).toBeNull()
  })

  it('does not call update when the key is not found', async () => {
    mockFindUnique.mockResolvedValue(null)
    await validateApiKey('hn_live_' + 'c'.repeat(32))
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})

describe('validateApiKey — deleted workspace', () => {
  it('returns null when the workspace has a non-null deletedAt', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'key-id-2',
      workspaceId: 'ws-deleted',
      workspace: { deletedAt: new Date('2024-01-01') },
    } as never)

    expect(await validateApiKey('hn_live_' + 'd'.repeat(32))).toBeNull()
  })

  it('does not call update when the workspace is deleted', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'key-id-2',
      workspaceId: 'ws-deleted',
      workspace: { deletedAt: new Date('2024-01-01') },
    } as never)

    await validateApiKey('hn_live_' + 'e'.repeat(32))
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
