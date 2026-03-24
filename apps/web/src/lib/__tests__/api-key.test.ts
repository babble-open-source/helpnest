import { describe, it, expect, vi, beforeEach } from 'vitest'
import { hashKey, generateKey, validateApiKey } from '../api-key'

// Mock the prisma module
vi.mock('@/lib/db', () => ({
  prisma: {
    apiKey: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/db'

describe('api-key utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('hashKey()', () => {
    it('should generate SHA256 hash for input string', () => {
      const key = 'test_key_123'
      const hash = hashKey(key)

      expect(typeof hash).toBe('string')
      expect(hash.length).toBe(64) // SHA256 hex is 64 chars
    })

    it('should produce consistent hash for same input', () => {
      const key = 'hn_live_abc123xyz789'
      const hash1 = hashKey(key)
      const hash2 = hashKey(key)

      expect(hash1).toBe(hash2)
    })

    it('should produce different hash for different input', () => {
      const hash1 = hashKey('key1')
      const hash2 = hashKey('key2')

      expect(hash1).not.toBe(hash2)
    })

    it('should produce lowercase hex characters', () => {
      const hash = hashKey('test')
      expect(hash).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should handle long input strings', () => {
      const longKey = 'hn_live_' + 'a'.repeat(100)
      const hash = hashKey(longKey)

      expect(hash.length).toBe(64)
      expect(hash).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should handle special characters', () => {
      const keys = [
        'hn_live_with-dashes',
        'hn_live_with_underscores',
        'hn_live_with.dots',
        'hn_live_with@symbols',
      ]

      keys.forEach((key) => {
        const hash = hashKey(key)
        expect(hash).toMatch(/^[a-f0-9]{64}$/)
      })
    })

    it('should be sensitive to whitespace', () => {
      const hash1 = hashKey('key')
      const hash2 = hashKey('key ')
      const hash3 = hashKey(' key')

      expect(hash1).not.toBe(hash2)
      expect(hash1).not.toBe(hash3)
      expect(hash2).not.toBe(hash3)
    })

    it('should be sensitive to case', () => {
      const hash1 = hashKey('TEST')
      const hash2 = hashKey('test')

      expect(hash1).not.toBe(hash2)
    })
  })

  describe('generateKey()', () => {
    it('should generate keys with hn_live_ prefix', () => {
      const key = generateKey()
      expect(key).toMatch(/^hn_live_/)
    })

    it('should generate keys of correct length', () => {
      const key = generateKey()
      // hn_live_ (8 chars) + 32 hex chars = 40 chars total
      expect(key.length).toBe(40)
    })

    it('should generate unique keys', () => {
      const keys = new Set()
      const iterations = 100

      for (let i = 0; i < iterations; i++) {
        keys.add(generateKey())
      }

      expect(keys.size).toBe(iterations)
    })

    it('should only use hex characters in random part', () => {
      for (let i = 0; i < 20; i++) {
        const key = generateKey()
        const randomPart = key.substring(8) // Remove 'hn_live_'
        expect(randomPart).toMatch(/^[a-f0-9]{32}$/)
      }
    })

    it('should generate cryptographically random keys', () => {
      const key1 = generateKey()
      const key2 = generateKey()
      const key3 = generateKey()

      // All keys should be different
      expect(key1).not.toBe(key2)
      expect(key2).not.toBe(key3)
      expect(key1).not.toBe(key3)
    })

    it('should include consistent prefix', () => {
      const keys = Array.from({ length: 50 }, () => generateKey())

      keys.forEach((key) => {
        expect(key.startsWith('hn_live_')).toBe(true)
      })
    })
  })

  describe('validateApiKey()', () => {
    it('should return null for invalid key prefix', async () => {
      const result = await validateApiKey('invalid_key')
      expect(result).toBeNull()
      expect(prisma.apiKey.findUnique).not.toHaveBeenCalled()
    })

    it('should return null for empty key', async () => {
      const result = await validateApiKey('')
      expect(result).toBeNull()
      expect(prisma.apiKey.findUnique).not.toHaveBeenCalled()
    })

    it('should return null for undefined key', async () => {
      const result = await validateApiKey(undefined as any)
      expect(result).toBeNull()
      expect(prisma.apiKey.findUnique).not.toHaveBeenCalled()
    })

    it('should return null when key not found in database', async () => {
      vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(null)

      const result = await validateApiKey('hn_live_abc123def456')

      expect(result).toBeNull()
      expect(prisma.apiKey.findUnique).toHaveBeenCalledWith({
        where: { keyHash: expect.stringMatching(/^[a-f0-9]{64}$/) },
        select: expect.any(Object),
      })
    })

    it('should return workspace info when valid key found', async () => {
      const mockApiKey = {
        id: 'key_123',
        workspaceId: 'ws_456',
        workspace: { deletedAt: null },
      }
      vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(mockApiKey)
      vi.mocked(prisma.apiKey.update).mockResolvedValue({} as any)

      const result = await validateApiKey('hn_live_abc123def456')

      expect(result).toEqual({ workspaceId: 'ws_456' })
    })

    it('should hash the key before database lookup', async () => {
      vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(null)

      const rawKey = 'hn_live_test_key_1234567890'
      await validateApiKey(rawKey)

      const callArg = vi.mocked(prisma.apiKey.findUnique).mock.calls[0][0]
      const expectedHash = hashKey(rawKey)

      expect(callArg.where.keyHash).toBe(expectedHash)
    })

    it('should request specific fields from database', async () => {
      vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(null)

      await validateApiKey('hn_live_test')

      const callArg = vi.mocked(prisma.apiKey.findUnique).mock.calls[0][0]
      expect(callArg.select).toEqual({
        id: true,
        workspaceId: true,
        workspace: { select: { deletedAt: true } },
      })
    })

    it('should return null when workspace is deleted', async () => {
      const mockApiKey = {
        id: 'key_123',
        workspaceId: 'ws_456',
        workspace: { deletedAt: new Date('2024-01-01') },
      }
      vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(mockApiKey)

      const result = await validateApiKey('hn_live_abc123def456')

      expect(result).toBeNull()
    })

    it('should trigger lastUsedAt update when key is valid', async () => {
      const mockApiKey = {
        id: 'key_123',
        workspaceId: 'ws_456',
        workspace: { deletedAt: null },
      }
      vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(mockApiKey)
      vi.mocked(prisma.apiKey.update).mockResolvedValue({} as any)

      await validateApiKey('hn_live_abc123def456')

      expect(prisma.apiKey.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'key_123' },
          data: expect.objectContaining({
            lastUsedAt: expect.any(Date),
          }),
        })
      )
    })

    it('should not fail if lastUsedAt update fails', async () => {
      const mockApiKey = {
        id: 'key_123',
        workspaceId: 'ws_456',
        workspace: { deletedAt: null },
      }
      vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(mockApiKey)
      vi.mocked(prisma.apiKey.update).mockRejectedValue(new Error('DB error'))

      // Should not throw despite update error
      const result = await validateApiKey('hn_live_abc123def456')

      expect(result).toEqual({ workspaceId: 'ws_456' })
    })

    it('should return only workspaceId in successful response', async () => {
      const mockApiKey = {
        id: 'key_123',
        workspaceId: 'ws_456',
        workspace: { deletedAt: null },
      }
      vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(mockApiKey)

      const result = await validateApiKey('hn_live_abc123def456')

      // Should only have workspaceId, not id or other fields
      expect(Object.keys(result!)).toEqual(['workspaceId'])
    })

    it('should handle valid keys with matching workspace', async () => {
      const apiKeys = [
        { workspaceId: 'ws_1', id: 'key_1' },
        { workspaceId: 'ws_2', id: 'key_2' },
        { workspaceId: 'ws_3', id: 'key_3' },
      ]

      for (const mockKey of apiKeys) {
        vi.mocked(prisma.apiKey.findUnique).mockResolvedValueOnce({
          ...mockKey,
          workspace: { deletedAt: null },
        })

        const result = await validateApiKey('hn_live_test')
        expect(result?.workspaceId).toBe(mockKey.workspaceId)
      }
    })
  })

  describe('integration scenarios', () => {
    it('should generate, hash, and lookup workflow', async () => {
      // Generate a key
      const rawKey = generateKey()
      expect(rawKey).toMatch(/^hn_live_[a-f0-9]{32}$/)

      // Hash it
      const hash = hashKey(rawKey)
      expect(hash).toMatch(/^[a-f0-9]{64}$/)

      // Set up mock for lookup
      const mockApiKey = {
        id: 'key_123',
        workspaceId: 'ws_456',
        workspace: { deletedAt: null },
      }
      vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(mockApiKey)

      // Validate with original key
      const result = await validateApiKey(rawKey)

      expect(result).toEqual({ workspaceId: 'ws_456' })
      expect(prisma.apiKey.findUnique).toHaveBeenCalledWith({
        where: { keyHash: hash },
        select: expect.any(Object),
      })
    })

    it('should distinguish between valid and invalid keys', async () => {
      const validKey = 'hn_live_abc123def456'
      const invalidKey = 'invalid_prefix_123'

      vi.mocked(prisma.apiKey.findUnique).mockResolvedValue({
        id: 'key_123',
        workspaceId: 'ws_456',
        workspace: { deletedAt: null },
      })

      const validResult = await validateApiKey(validKey)
      expect(validResult).toEqual({ workspaceId: 'ws_456' })

      const invalidResult = await validateApiKey(invalidKey)
      expect(invalidResult).toBeNull()

      // Database should only be called once (for valid key)
      expect(prisma.apiKey.findUnique).toHaveBeenCalledTimes(1)
    })

    it('should handle multiple sequential validations', async () => {
      vi.mocked(prisma.apiKey.findUnique)
        .mockResolvedValueOnce({
          id: 'key_1',
          workspaceId: 'ws_1',
          workspace: { deletedAt: null },
        })
        .mockResolvedValueOnce({
          id: 'key_2',
          workspaceId: 'ws_2',
          workspace: { deletedAt: null },
        })
        .mockResolvedValueOnce(null)

      const result1 = await validateApiKey('hn_live_key1')
      const result2 = await validateApiKey('hn_live_key2')
      const result3 = await validateApiKey('hn_live_key3')

      expect(result1).toEqual({ workspaceId: 'ws_1' })
      expect(result2).toEqual({ workspaceId: 'ws_2' })
      expect(result3).toBeNull()
    })
  })
})
