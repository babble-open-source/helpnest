import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isDemoMode } from '@/lib/demo';
/**
 * DELETE /api/api-keys/:id
 * Deletes the specified API key. The key must belong to the authenticated user's
 * workspace. Requires OWNER or ADMIN role.
 */
export async function DELETE(_req, { params: paramsPromise }) {
    const [session, params] = await Promise.all([auth(), paramsPromise]);
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const member = await prisma.member.findFirst({
        where: {
            user: { email: session.user.email },
            role: { in: ['OWNER', 'ADMIN'] },
        },
        select: { workspaceId: true },
    });
    if (!member) {
        return NextResponse.json({ error: 'Forbidden — OWNER or ADMIN required' }, { status: 403 });
    }
    if (isDemoMode()) {
        return NextResponse.json({ error: 'API key management is disabled in demo mode.' }, { status: 403 });
    }
    // Verify the key belongs to this workspace before deleting.
    const apiKey = await prisma.apiKey.findFirst({
        where: { id: params.id, workspaceId: member.workspaceId },
        select: { id: true },
    });
    if (!apiKey) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    await prisma.apiKey.delete({ where: { id: params.id } });
    return new NextResponse(null, { status: 204 });
}
