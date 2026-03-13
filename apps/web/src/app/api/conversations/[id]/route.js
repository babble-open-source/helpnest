import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth-api';
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-Token',
};
export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
// GET — Get conversation details (widget via sessionToken or dashboard via auth)
export async function GET(request, { params }) {
    const { id } = await params;
    const sessionToken = request.headers.get('x-session-token');
    if (sessionToken) {
        // Widget access via session token — scope strictly to matching conversation.
        const conversation = await prisma.conversation.findFirst({
            where: { id, sessionToken },
            include: {
                messages: { orderBy: { createdAt: 'asc' } },
                articles: {
                    include: {
                        article: {
                            select: {
                                id: true,
                                title: true,
                                slug: true,
                                collection: { select: { slug: true, title: true } },
                            },
                        },
                    },
                },
            },
        });
        if (!conversation) {
            return NextResponse.json({ error: 'Conversation not found' }, { status: 404, headers: CORS_HEADERS });
        }
        return NextResponse.json(conversation, { headers: CORS_HEADERS });
    }
    // Dashboard access requires a valid session or API key.
    const authResult = await requireAuth(request);
    if (!authResult) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const conversation = await prisma.conversation.findFirst({
        where: { id, workspaceId: authResult.workspaceId },
        include: {
            messages: { orderBy: { createdAt: 'asc' } },
            assignedTo: {
                select: { id: true, user: { select: { name: true, email: true } } },
            },
            articles: {
                include: {
                    article: {
                        select: {
                            id: true,
                            title: true,
                            slug: true,
                            collection: { select: { slug: true, title: true } },
                        },
                    },
                },
            },
        },
    });
    if (!conversation) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    return NextResponse.json(conversation);
}
// PATCH — Update conversation status or resolution summary (dashboard auth required)
export async function PATCH(request, { params }) {
    const { id } = await params;
    const authResult = await requireAuth(request);
    if (!authResult) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    let body;
    try {
        body = (await request.json());
    }
    catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const conversation = await prisma.conversation.findFirst({
        where: { id, workspaceId: authResult.workspaceId },
    });
    if (!conversation) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    const data = {};
    if (body.status !== undefined) {
        const validStatuses = ['ACTIVE', 'ESCALATED', 'RESOLVED_AI', 'RESOLVED_HUMAN', 'CLOSED'];
        if (!validStatuses.includes(body.status)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
        }
        data.status = body.status;
    }
    if (body.resolutionSummary !== undefined) {
        // Explicit null clears the field; otherwise truncate to a safe length.
        data.resolutionSummary = body.resolutionSummary
            ? body.resolutionSummary.slice(0, 2000)
            : null;
    }
    if (Object.keys(data).length === 0) {
        return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }
    const updated = await prisma.conversation.update({
        where: { id },
        data,
    });
    return NextResponse.json(updated);
}
