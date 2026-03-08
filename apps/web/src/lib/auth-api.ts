import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { validateApiKey } from '@/lib/api-key'

export interface ApiAuthResult {
  workspaceId: string
  userId?: string // only present for session auth
  via: 'session' | 'apikey'
}

/**
 * Unified authentication for API routes that accept both session cookies and
 * Bearer API key tokens.
 *
 * Resolution order:
 *   1. `Authorization: Bearer <key>` header → API key lookup
 *   2. NextAuth session cookie
 *
 * Returns null if neither mechanism produces a valid identity.
 */
export async function requireAuth(request: Request): Promise<ApiAuthResult | null> {
  // --- 1. Try Bearer token ---
  const authHeader = request.headers.get('authorization') ?? ''
  if (authHeader.startsWith('Bearer ')) {
    const rawKey = authHeader.slice(7).trim()
    const result = await validateApiKey(rawKey)
    if (result) {
      return { workspaceId: result.workspaceId, via: 'apikey' }
    }
    // An Authorization header was present but invalid — reject immediately.
    // Do not fall through to session auth; a client that sends a Bearer token
    // should not silently succeed via cookies.
    return null
  }

  // --- 2. Fall back to NextAuth session ---
  const session = await auth()
  if (!session?.user?.email) return null

  const member = await prisma.member.findFirst({
    where: { user: { email: session.user.email } },
    select: { workspaceId: true, userId: true },
  })
  if (!member) return null

  return {
    workspaceId: member.workspaceId,
    userId: member.userId,
    via: 'session',
  }
}
