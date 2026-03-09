import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { type } = await request.json() as { type: 'helpful' | 'not' }
    if (type !== 'helpful' && type !== 'not') {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    // Only allow feedback on published articles in public collections
    const article = await prisma.article.findFirst({
      where: {
        id: params.id,
        status: 'PUBLISHED',
        collection: { isPublic: true },
      },
      select: { id: true },
    })
    if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.article.update({
      where: { id: params.id },
      data: type === 'helpful'
        ? { helpful: { increment: 1 } }
        : { notHelpful: { increment: 1 } },
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
