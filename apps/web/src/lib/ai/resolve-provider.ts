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
 * Decrypts an AES-256-GCM encrypted API key stored in the database.
 *
 * Format on disk: `<iv-hex>:<authTag-hex>:<ciphertext-hex>`
 *
 * If the value does not match this format (e.g. a plaintext key stored
 * during development or before encryption was enabled), the raw value is
 * returned unchanged. This provides a safe migration path: existing
 * plaintext keys continue to work and new keys will be stored encrypted.
 */
function decryptApiKey(encrypted: string): string {
  const secret = process.env.AI_KEY_ENCRYPTION_SECRET
  if (!secret) {
    throw new Error(
      'AI_KEY_ENCRYPTION_SECRET environment variable is required for AI features',
    )
  }

  try {
    // require() is used here intentionally: the crypto module is only needed
    // on the server and this file is only ever imported from server-side code
    // (API routes / server components). Using require() avoids a webpack
    // bundling issue with the native `crypto` module in some Next.js configs.
    const crypto = require('crypto') as typeof import('crypto')
    const parts = encrypted.split(':')
    if (parts.length !== 3) {
      // Not in the expected encrypted format — treat as plaintext (dev / legacy)
      return encrypted
    }
    const [ivHex, authTagHex, cipherHex] = parts as [string, string, string]
    const key = crypto.scryptSync(secret, 'helpnest-ai-key-salt', 32)
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivHex, 'hex'),
    )
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
    let decrypted = decipher.update(cipherHex, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch {
    // Decryption failed — assume plaintext key (dev / migration scenario)
    return encrypted
  }
}

/**
 * Encrypts a plaintext API key for storage in the database.
 *
 * Returns the raw plaintext when AI_KEY_ENCRYPTION_SECRET is not configured
 * (development / self-hosted without encryption). This means the key is
 * functional but unencrypted at rest — operators should set the secret in
 * production.
 */
export function encryptApiKey(plaintext: string): string {
  const secret = process.env.AI_KEY_ENCRYPTION_SECRET
  if (!secret) {
    // No encryption configured — store as-is (acceptable for local dev;
    // operators should configure this secret before going to production)
    return plaintext
  }

  const crypto = require('crypto') as typeof import('crypto')
  const key = crypto.scryptSync(secret, 'helpnest-ai-key-salt', 32)
  const iv = crypto.randomBytes(12) // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')
  return `${iv.toString('hex')}:${authTag}:${encrypted}`
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
