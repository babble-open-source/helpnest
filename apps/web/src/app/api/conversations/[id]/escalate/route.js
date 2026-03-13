import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
};
export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
// POST — Customer-initiated escalation to human support.
//
// Only callable via session token (widget). Dashboard agents use PATCH
// /conversations/:id with { status: 'ESCALATED' } for manual overrides.
// Keeping customer-triggered escalation as a dedicated endpoint makes the
// intent explicit in logs and analytics.
export async function POST(request, { params }) {
    const { id } = await params;
    const sessionToken = request.headers.get('x-session-token');
    if (!sessionToken) {
        return NextResponse.json({ error: 'Session token required' }, { status: 401, headers: CORS_HEADERS });
    }
    const conversation = await prisma.conversation.findFirst({
        where: { id, sessionToken },
        select: { id: true, status: true },
    });
    if (!conversation) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404, headers: CORS_HEADERS });
    }
    // Idempotent — a customer may tap the button multiple times.
    if (conversation.status === 'ESCALATED') {
        return NextResponse.json({ message: 'Already escalated' }, { headers: CORS_HEADERS });
    }
    await prisma.conversation.update({
        where: { id },
        data: {
            status: 'ESCALATED',
            escalationReason: 'Customer requested human support',
        },
    });
    await prisma.message.create({
        data: {
            conversationId: id,
            role: 'SYSTEM',
            content: 'Customer requested to speak with a human support agent.',
        },
    });
    return NextResponse.json({ message: 'Escalated to human support' }, { headers: CORS_HEADERS });
}
