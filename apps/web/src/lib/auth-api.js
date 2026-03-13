import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { validateApiKey } from '@/lib/api-key';
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
export async function requireAuth(request) {
    // --- 1. Try Bearer token ---
    const authHeader = request.headers.get('authorization') ?? '';
    if (authHeader.startsWith('Bearer ')) {
        const rawKey = authHeader.slice(7).trim();
        const result = await validateApiKey(rawKey);
        if (result) {
            return { workspaceId: result.workspaceId, via: 'apikey' };
        }
        // An Authorization header was present but invalid — reject immediately.
        // Do not fall through to session auth; a client that sends a Bearer token
        // should not silently succeed via cookies.
        return null;
    }
    // --- 2. Fall back to NextAuth session ---
    const session = await auth();
    if (!session?.user)
        return null;
    // 2a) Try membership lookup with session user id first.
    // After DB resets, stale JWTs can carry an old user id that no longer exists.
    const sessionUserId = session.user.id;
    if (sessionUserId) {
        const member = await prisma.member.findFirst({
            where: { userId: sessionUserId, deactivatedAt: null },
            select: { workspaceId: true, userId: true },
        });
        if (member) {
            return {
                workspaceId: member.workspaceId,
                userId: member.userId,
                via: 'session',
            };
        }
    }
    // 2b) Fallback: resolve by email and retry membership lookup.
    // This keeps valid credentials working even when a stale JWT id is present.
    if (!session.user.email)
        return null;
    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
    });
    if (!user)
        return null;
    const member = await prisma.member.findFirst({
        where: { userId: user.id, deactivatedAt: null },
        select: { workspaceId: true, userId: true },
    });
    if (!member)
        return null;
    return {
        workspaceId: member.workspaceId,
        userId: member.userId,
        via: 'session',
    };
}
