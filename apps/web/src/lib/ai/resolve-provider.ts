import type { ModelProvider } from './types'
import { AnthropicProvider } from './providers/anthropic'
import { OpenAIProvider } from './providers/openai'
import { GoogleProvider } from './providers/google'

interface WorkspaceAiSettings {
  aiProvider: string | null
  aiApiKey: string | null
  aiModel?: string | null
}

/**
 * Returns true if the workspace has its own API key configured (BYOK).
 * When BYOK is active, AI actions are not metered by credits.
 */
export function isByok(workspace: Pick<WorkspaceAiSettings, 'aiApiKey'>): boolean {
  return !!workspace.aiApiKey
}

/**
 * Decrypts an AES-256-GCM encrypted API key stored in the database.
 *
 * Supported formats:
 *   v2 (current): `<iv-hex>:<salt-hex>:<authTag-hex>:<ciphertext-hex>` — random salt per call
 *   v1 (legacy):  `<iv-hex>:<authTag-hex>:<ciphertext-hex>` — static salt (migration path)
 *
 * If the value matches neither format it is returned unchanged — this covers
 * plaintext keys stored in development or before encryption was enabled.
 */
function decryptApiKey(encrypted: string): string {
  const secret = process.env.AI_KEY_ENCRYPTION_SECRET
  if (!secret) {
    // No encryption secret configured — return as-is, consistent with encryptApiKey
    // which stores plaintext when the secret is absent.
    return encrypted
  }

  try {
    // require() is used here intentionally: the crypto module is only needed
    // on the server. Using require() avoids a webpack bundling issue with the
    // native `crypto` module in some Next.js configs.
    const crypto = require('crypto') as typeof import('crypto')
    const parts = encrypted.split(':')

    if (parts.length === 4) {
      // v2: iv:salt:authTag:ciphertext — unique salt per encryption call
      const [ivHex, saltHex, authTagHex, cipherHex] = parts as [string, string, string, string]
      const key = crypto.scryptSync(secret, Buffer.from(saltHex, 'hex'), 32)
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
      decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
      let decrypted = decipher.update(cipherHex, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      return decrypted
    }

    if (parts.length === 3) {
      // v1 legacy: iv:authTag:ciphertext — static salt, kept for backward compat
      const [ivHex, authTagHex, cipherHex] = parts as [string, string, string]
      const key = crypto.scryptSync(secret, 'helpnest-ai-key-salt', 32)
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
      decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
      let decrypted = decipher.update(cipherHex, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      return decrypted
    }

    // Not in any recognised format — treat as plaintext (dev / legacy)
    return encrypted
  } catch {
    // Decryption failed — assume plaintext key (dev / migration scenario)
    return encrypted
  }
}

/**
 * Encrypts a plaintext API key for storage in the database using AES-256-GCM
 * with a unique random salt per call (v2 format: iv:salt:authTag:ciphertext).
 *
 * Returns the raw plaintext when AI_KEY_ENCRYPTION_SECRET is not configured
 * (development / self-hosted without encryption). Operators must configure
 * this secret before going to production.
 */
export function encryptApiKey(plaintext: string): string {
  const secret = process.env.AI_KEY_ENCRYPTION_SECRET
  if (!secret) {
    return plaintext
  }

  const crypto = require('crypto') as typeof import('crypto')
  const salt = crypto.randomBytes(16) // unique salt per encryption call
  const key = crypto.scryptSync(secret, salt, 32)
  const iv = crypto.randomBytes(12) // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')
  // v2 format: iv:salt:authTag:ciphertext
  return `${iv.toString('hex')}:${salt.toString('hex')}:${authTag}:${encrypted}`
}

/**
 * Resolves the correct ModelProvider implementation for a workspace.
 *
 * Resolution order for the API key:
 *   1. Workspace-level key stored in the DB (decrypted on the fly)
 *   2. Server environment variable (ANTHROPIC_API_KEY / OPENAI_API_KEY /
 *      GOOGLE_AI_API_KEY) — used when the workspace has not configured its
 *      own key, which is the typical self-hosted scenario
 *
 * Providers are loaded via require() so that unused SDKs are not bundled into
 * routes that never invoke them.
 */
export function resolveProvider(workspace: WorkspaceAiSettings): ModelProvider {
  const provider = (workspace.aiProvider ?? 'anthropic').toLowerCase()

  let apiKey: string | null = null

  if (workspace.aiApiKey) {
    apiKey = decryptApiKey(workspace.aiApiKey)
  } else {
    // Fall back to environment variables — allows operator-level configuration
    // without requiring every workspace to supply its own key
    switch (provider) {
      case 'anthropic':
        apiKey = process.env.ANTHROPIC_API_KEY ?? null
        break
      case 'openai':
        apiKey = process.env.OPENAI_API_KEY ?? null
        break
      case 'google':
        apiKey = process.env.GOOGLE_AI_API_KEY ?? null
        break
      case 'mistral':
        apiKey = process.env.MISTRAL_API_KEY ?? null
        break
      default:
        apiKey = process.env.ANTHROPIC_API_KEY ?? null
    }
  }

  if (!apiKey) {
    throw new Error(
      `No API key configured for AI provider "${provider}". ` +
        `Set it in workspace settings or via the corresponding environment variable.`,
    )
  }

  switch (provider) {
    case 'openai':
      return new OpenAIProvider(apiKey)
    case 'google':
      return new GoogleProvider(apiKey)
    case 'anthropic':
    default:
      return new AnthropicProvider(apiKey)
  }
}
