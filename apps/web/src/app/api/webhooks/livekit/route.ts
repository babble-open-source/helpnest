import { NextResponse } from 'next/server'
import { WebhookReceiver } from 'livekit-server-sdk'
import { prisma } from '@/lib/db'

const receiver = new WebhookReceiver(
  process.env.LIVEKIT_API_KEY ?? '',
  process.env.LIVEKIT_API_SECRET ?? ''
)

export async function POST(request: Request) {
  const body = await request.text()
  const authHeader = request.headers.get('Authorization') ?? ''

  let event: Awaited<ReturnType<typeof receiver.receive>>
  try {
    event = await receiver.receive(body, authHeader)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const roomName = event.room?.name
  if (!roomName?.startsWith('helpnest-')) {
    return NextResponse.json({ ok: true })
  }

  // Only finalize once the room is actually finished. participant_left fires
  // for individual disconnects and can happen before the session is over.
  if (event.event === 'room_finished') {
    await finalizeVoiceSession(roomName)
  }

  return NextResponse.json({ ok: true })
}

async function finalizeVoiceSession(roomName: string) {
  const session = await prisma.voiceSession.findUnique({
    where: { roomName },
    select: { id: true, workspaceId: true, startedAt: true, status: true },
  })

  if (!session || session.status === 'completed') return

  const now = new Date()
  const durationSeconds = Math.round((now.getTime() - session.startedAt.getTime()) / 1000)
  const durationMinutes = Math.ceil(durationSeconds / 60)

  await prisma.$transaction([
    prisma.voiceSession.update({
      where: { id: session.id },
      data: { endedAt: now, durationSeconds, status: 'completed' },
    }),
    prisma.workspace.update({
      where: { id: session.workspaceId },
      data: { voiceMinutesUsed: { increment: durationMinutes } },
    }),
  ])
}
