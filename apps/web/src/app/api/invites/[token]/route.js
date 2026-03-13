import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
export async function GET(_request, { params: paramsPromise }) {
    const { token } = await paramsPromise;
    if (!token) {
        return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }
    const invite = await prisma.invite.findUnique({
        where: { token },
        include: {
            workspace: { select: { name: true } },
            invitedBy: { select: { name: true, email: true } },
        },
    });
    if (!invite) {
        return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }
    if (invite.acceptedAt) {
        return NextResponse.json({ error: 'This invite has already been accepted' }, { status: 410 });
    }
    if (invite.expiresAt < new Date()) {
        return NextResponse.json({ error: 'This invite has expired' }, { status: 410 });
    }
    return NextResponse.json({
        invite: {
            email: invite.email,
            role: invite.role,
            workspaceName: invite.workspace.name,
            inviterName: invite.invitedBy.name ?? invite.invitedBy.email,
            expiresAt: invite.expiresAt,
        },
    });
}
