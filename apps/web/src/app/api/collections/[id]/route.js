import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-api';
import { isDemoMode } from '@/lib/demo';
/** For session-authenticated callers, verify they hold at least EDITOR role. */
async function ensureEditorRole(userId, workspaceId) {
    const member = await prisma.member.findFirst({
        where: {
            userId,
            workspaceId,
            role: { in: ['OWNER', 'ADMIN', 'EDITOR'] },
        },
        select: { id: true },
    });
    return member !== null;
}
export async function PATCH(request, { params: paramsPromise }) {
    const [authResult, params] = await Promise.all([requireAuth(request), paramsPromise]);
    if (!authResult)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { workspaceId, userId, via } = authResult;
    if (via === 'session' && userId) {
        if (!(await ensureEditorRole(userId, workspaceId))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
    }
    const col = await prisma.collection.findFirst({
        where: { id: params.id, workspaceId },
        select: { id: true, slug: true },
    });
    if (!col)
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const body = await request.json();
    // Regenerate slug when title changes, ensuring uniqueness (excluding this collection)
    let newSlug;
    if (body.title !== undefined) {
        const baseSlug = body.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        let slug = baseSlug;
        let i = 1;
        while (await prisma.collection.findFirst({ where: { workspaceId, slug, id: { not: params.id } } })) {
            slug = `${baseSlug}-${i++}`;
        }
        newSlug = slug;
    }
    const updated = await prisma.collection.update({
        where: { id: params.id },
        data: {
            ...(body.title !== undefined && { title: body.title, slug: newSlug }),
            ...(body.description !== undefined && { description: body.description || null }),
            ...(body.emoji !== undefined && { emoji: body.emoji }),
            ...(body.isPublic !== undefined && { isPublic: body.isPublic }),
            ...(body.isArchived !== undefined && { isArchived: body.isArchived }),
        },
    });
    return NextResponse.json(updated);
}
export async function DELETE(request, { params: paramsPromise }) {
    const [authResult, params] = await Promise.all([requireAuth(request), paramsPromise]);
    if (!authResult)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (isDemoMode()) {
        return NextResponse.json({ error: 'Deleting collections is disabled in demo mode.' }, { status: 403 });
    }
    const { workspaceId, userId, via } = authResult;
    if (via === 'session' && userId) {
        if (!(await ensureEditorRole(userId, workspaceId))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
    }
    const col = await prisma.collection.findFirst({
        where: { id: params.id, workspaceId },
        select: { id: true, _count: { select: { articles: true } } },
    });
    if (!col)
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (col._count.articles > 0) {
        return NextResponse.json({ error: `Cannot delete — this collection has ${col._count.articles} article${col._count.articles !== 1 ? 's' : ''}. Move or delete them first.` }, { status: 409 });
    }
    await prisma.collection.delete({ where: { id: params.id } });
    return new NextResponse(null, { status: 204 });
}
