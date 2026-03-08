import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { type } = await request.json() as { type: 'helpful' | 'not' }

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
