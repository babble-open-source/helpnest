import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { recordKnowledgeGap } from '@/lib/ai-agent';
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
};
export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
// POST — Record helpful/not-helpful feedback on an AI message.
//
// When feedback is negative, we look up the preceding customer question and
// record it as a knowledge gap. This creates the learning loop: unhelpful
// AI responses bubble up as gaps that the support team can resolve by writing
// new articles.
export async function POST(request, { params }) {
    const { id } = await params;
    const sessionToken = request.headers.get('x-session-token');
    if (!sessionToken) {
        return NextResponse.json({ error: 'Session token required' }, { status: 401, headers: CORS_HEADERS });
    }
    let body;
    try {
        body = (await request.json());
    }
    catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: CORS_HEADERS });
    }
    if (!body.messageId || typeof body.helpful !== 'boolean') {
        return NextResponse.json({ error: 'messageId and helpful (boolean) are required' }, { status: 400, headers: CORS_HEADERS });
    }
    // Verify session ownership.
    const conversation = await prisma.conversation.findFirst({
        where: { id, sessionToken },
        select: { id: true, workspaceId: true },
    });
    if (!conversation) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404, headers: CORS_HEADERS });
    }
    // Only AI messages can receive feedback — reject attempts on CUSTOMER/AGENT/SYSTEM roles.
    const message = await prisma.message.findFirst({
        where: { id: body.messageId, conversationId: id, role: 'AI' },
    });
    if (!message) {
        return NextResponse.json({ error: 'Message not found' }, { status: 404, headers: CORS_HEADERS });
    }
    await prisma.message.update({
        where: { id: body.messageId },
        data: { feedbackHelpful: body.helpful },
    });
    // On negative feedback, trace back to the triggering customer question and
    // record a knowledge gap so it surfaces in the dashboard learning loop.
    if (!body.helpful && message.content) {
        const prevMessages = await prisma.message.findMany({
            where: {
                conversationId: id,
                createdAt: { lt: message.createdAt },
                role: 'CUSTOMER',
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
        });
        const customerQuery = prevMessages[0]?.content;
        if (customerQuery) {
            await recordKnowledgeGap(conversation.workspaceId, customerQuery).catch(() => { });
        }
    }
    return NextResponse.json({ message: 'Feedback recorded' }, { headers: CORS_HEADERS });
}
