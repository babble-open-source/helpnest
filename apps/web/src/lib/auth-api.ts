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
  if (!session?.user) return null

  // Parse the preferred workspace from the helpnest-workspace cookie.
  // This ensures multi-workspace users target the intended workspace.
  const preferredWorkspaceId = parseCookie(request.headers.get('cookie') ?? '', 'helpnest-workspace')

  // 2a) Try membership lookup with session user id first.
  // After DB resets, stale JWTs can carry an old user id that no longer exists.
  const sessionUserId = session.user.id
  const resolvedUserId = sessionUserId ?? await resolveUserIdByEmail(session.user.email)
  if (!resolvedUserId) return null

  // If a preferred workspace is set, verify the user is a member of it.
  if (preferredWorkspaceId) {
    const member = await prisma.member.findFirst({
      where: { userId: resolvedUserId, workspaceId: preferredWorkspaceId, deactivatedAt: null },
      select: { workspaceId: true, userId: true },
    })
    if (member) {
      return { workspaceId: member.workspaceId, userId: member.userId, via: 'session' }
    }
  }

  // Fallback: first active workspace (deterministic order).
  const member = await prisma.member.findFirst({
    where: { userId: resolvedUserId, deactivatedAt: null },
    select: { workspaceId: true, userId: true },
    orderBy: { id: 'asc' },
  })
  if (!member) return null

  return {
    workspaceId: member.workspaceId,
    userId: member.userId,
    via: 'session',
  }
}

function parseCookie(cookieHeader: string, name: string): string | undefined {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match?.[1] ? decodeURIComponent(match[1]) : undefined
}

async function resolveUserIdByEmail(email: string | null | undefined): Promise<string | null> {
  if (!email) return null
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })
  return user?.id ?? null
}
