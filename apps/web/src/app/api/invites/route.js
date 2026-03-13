import { NextResponse } from 'next/server';
import { auth, resolveSessionUserId } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isDemoMode } from '@/lib/demo';
const VALID_ROLES = ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER'];
export async function POST(request) {
    const session = await auth();
    const userId = await resolveSessionUserId(session);
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Verify caller is OWNER or ADMIN in some workspace
    const callerMember = await prisma.member.findFirst({
        where: {
            userId,
            role: { in: ['OWNER', 'ADMIN'] },
            deactivatedAt: null,
        },
        select: { workspaceId: true },
    });
    if (!callerMember) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (isDemoMode()) {
        return NextResponse.json({ error: 'Inviting members is disabled in demo mode.' }, { status: 403 });
    }
    let body;
    try {
        body = await request.json();
    }
    catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    if (typeof body !== 'object' || body === null) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const { email, role } = body;
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
    }
    const normalizedEmail = email.toLowerCase().trim();
    const inviteRole = typeof role === 'string' && VALID_ROLES.includes(role)
        ? role
        : 'EDITOR';
    // Prevent inviting someone who is already an active member
    const existingMember = await prisma.member.findFirst({
        where: {
            workspaceId: callerMember.workspaceId,
            user: { email: normalizedEmail },
            deactivatedAt: null,
        },
    });
    if (existingMember) {
        return NextResponse.json({ error: 'This person is already a member of the workspace' }, { status: 409 });
    }
    // Prevent creating a duplicate invite while one is still pending
    const pendingInvite = await prisma.invite.findFirst({
        where: {
            workspaceId: callerMember.workspaceId,
            email: normalizedEmail,
            acceptedAt: null,
            expiresAt: { gt: new Date() },
        },
        select: { id: true },
    });
    if (pendingInvite) {
        return NextResponse.json({ error: 'A pending invite for this email already exists' }, { status: 409 });
    }
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invite = await prisma.invite.create({
        data: {
            workspaceId: callerMember.workspaceId,
            email: normalizedEmail,
            role: inviteRole,
            invitedById: userId,
            expiresAt,
        },
    });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const inviteUrl = `${appUrl}/invite/${invite.token}`;
    return NextResponse.json({ invite: { id: invite.id, email: invite.email, role: invite.role, expiresAt: invite.expiresAt }, inviteUrl }, { status: 201 });
}
