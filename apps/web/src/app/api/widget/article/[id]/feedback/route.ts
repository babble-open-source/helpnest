import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  try {
    const [body, { id }] = await Promise.all([
      request.json() as Promise<{ type: 'helpful' | 'not'; voterToken?: string }>,
      paramsPromise,
    ])

    if (body.type !== 'helpful' && body.type !== 'not') {
      return NextResponse.json(
        { error: 'Invalid type' },
        { status: 400, headers: CORS_HEADERS },
      )
    }

    const article = await prisma.article.findFirst({
      where: { id, status: 'PUBLISHED' },
      select: { id: true, workspaceId: true },
    })

    if (!article) {
      return NextResponse.json(
        { error: 'Not found' },
        { status: 404, headers: CORS_HEADERS },
      )
    }

    const voterToken = body.voterToken || randomUUID()
    const dbType = body.type === 'helpful' ? 'HELPFUL' as const : 'NOT_HELPFUL' as const

    type FeedbackTx = {
      articleFeedback: {
        findUnique(args: unknown): Promise<{ id: string; type: string } | null>
        create(args: unknown): Promise<unknown>
        update(args: unknown): Promise<unknown>
        count(args: unknown): Promise<number>
      }
      article: {
        update(args: unknown): Promise<unknown>
      }
    }

    await prisma.$transaction(async (tx) => {
      const ftx = tx as unknown as FeedbackTx

      const previous = await ftx.articleFeedback.findUnique({
        where: {
          articleId_voterToken: { articleId: article.id, voterToken },
        },
        select: { id: true, type: true },
      })

      if (!previous) {
        await ftx.articleFeedback.create({
          data: {
            articleId: article.id,
            workspaceId: article.workspaceId,
            voterToken,
            type: dbType,
          },
        })
      } else if (previous.type !== dbType) {
        await ftx.articleFeedback.update({
          where: { id: previous.id },
          data: { type: dbType },
        })
      }

      const [helpful, notHelpful] = await Promise.all([
        ftx.articleFeedback.count({ where: { articleId: article.id, type: 'HELPFUL' } }),
        ftx.articleFeedback.count({ where: { articleId: article.id, type: 'NOT_HELPFUL' } }),
      ])

      await ftx.article.update({
        where: { id: article.id },
        data: { helpful, notHelpful },
      })
    })

    return NextResponse.json(
      { ok: true, voterToken },
      { headers: CORS_HEADERS },
    )
  } catch {
    return NextResponse.json(
      { error: 'Failed' },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}
