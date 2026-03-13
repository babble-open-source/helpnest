import { randomUUID } from 'crypto';
import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
const FEEDBACK_COOKIE = 'hn_feedback_voter';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
function feedbackTypeToDb(type) {
    return type === 'helpful' ? 'HELPFUL' : 'NOT_HELPFUL';
}
export async function POST(request, { params: paramsPromise }) {
    try {
        const [{ type }, params] = await Promise.all([
            request.json(),
            paramsPromise,
        ]);
        if (type !== 'helpful' && type !== 'not') {
            return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
        }
        const article = await prisma.article.findFirst({
            where: {
                id: params.id,
                status: 'PUBLISHED',
                collection: { isPublic: true },
            },
            select: { id: true, workspaceId: true },
        });
        if (!article)
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        const cookieStore = await cookies();
        const existingToken = cookieStore.get(FEEDBACK_COOKIE)?.value?.trim();
        const voterToken = existingToken && existingToken.length > 0 ? existingToken : randomUUID();
        const nextType = feedbackTypeToDb(type);
        const userAgent = (await headers()).get('user-agent')?.slice(0, 500) ?? null;
        const prismaWithFeedback = prisma;
        await prisma.$transaction(async (tx) => {
            const previous = await tx.articleFeedback.findUnique({
                where: {
                    articleId_voterToken: {
                        articleId: article.id,
                        voterToken,
                    },
                },
                select: { id: true, type: true },
            });
            if (!previous) {
                await tx.articleFeedback.create({
                    data: {
                        articleId: article.id,
                        workspaceId: article.workspaceId,
                        voterToken,
                        type: nextType,
                        userAgent,
                    },
                });
            }
            else if (previous.type === nextType) {
                await tx.articleFeedback.update({
                    where: { id: previous.id },
                    data: { userAgent },
                });
            }
            else {
                await tx.articleFeedback.update({
                    where: { id: previous.id },
                    data: {
                        type: nextType,
                        userAgent,
                    },
                });
            }
            const [helpfulCount, notHelpfulCount] = await Promise.all([
                tx.articleFeedback.count({
                    where: {
                        articleId: article.id,
                        type: 'HELPFUL',
                    },
                }),
                tx.articleFeedback.count({
                    where: {
                        articleId: article.id,
                        type: 'NOT_HELPFUL',
                    },
                }),
            ]);
            await tx.article.update({
                where: { id: article.id },
                data: {
                    helpful: helpfulCount,
                    notHelpful: notHelpfulCount,
                },
            });
        });
        const response = NextResponse.json({ ok: true, type: nextType });
        if (!existingToken) {
            response.cookies.set({
                name: FEEDBACK_COOKIE,
                value: voterToken,
                httpOnly: true,
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
                path: '/',
                maxAge: COOKIE_MAX_AGE,
            });
        }
        return response;
    }
    catch {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
