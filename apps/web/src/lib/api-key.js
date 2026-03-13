import crypto from 'crypto';
import { prisma } from '@/lib/db';
/**
 * Returns the SHA-256 hex digest of a raw API key string.
 * Only the hash is persisted — the raw key is never stored.
 */
export function hashKey(rawKey) {
    return crypto.createHash('sha256').update(rawKey).digest('hex');
}
/**
 * Generates a new raw API key in the format `hn_live_<32 hex chars>`.
 * The caller is responsible for hashing and persisting it immediately.
 */
export function generateKey() {
    const rand = crypto.randomBytes(16).toString('hex'); // 16 bytes → 32 hex chars
    return `hn_live_${rand}`;
}
/**
 * Validates a raw API key by hashing it and looking up the hash in the database.
 * On success, updates `lastUsedAt` in a fire-and-forget update (non-blocking).
 * Returns `{ workspaceId }` on success, or `null` if the key is invalid.
 */
export async function validateApiKey(rawKey) {
    if (!rawKey || !rawKey.startsWith('hn_live_'))
        return null;
    const keyHash = hashKey(rawKey);
    const apiKey = await prisma.apiKey.findUnique({
        where: { keyHash },
        select: { id: true, workspaceId: true },
    });
    if (!apiKey)
        return null;
    // Non-blocking update — a failure here must not deny the request.
    prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
    }).catch(() => {
        // Intentionally swallowed: lastUsedAt tracking is best-effort.
    });
    return { workspaceId: apiKey.workspaceId };
}
