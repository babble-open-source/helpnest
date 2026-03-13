import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth-api';
export async function GET(request) {
    const auth = await requireAuth(request);
    if (!auth)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const escalated = await prisma.conversation.count({
        where: { workspaceId: auth.workspaceId, status: 'ESCALATED' },
    });
    return NextResponse.json({ escalated });
}
