import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk'

const WIDGET_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: WIDGET_CORS_HEADERS })
}

export async function POST(request: Request) {
  const sessionToken = request.headers.get('x-session-token')
  if (!sessionToken) {
    return NextResponse.json(
      { error: 'Session token required' },
      { status: 401, headers: WIDGET_CORS_HEADERS },
    )
  }

  const conversation = await prisma.conversation.findFirst({
    where: { sessionToken },
    select: { workspaceId: true },
  })
  if (!conversation) {
    return NextResponse.json(
      { error: 'Invalid session' },
      { status: 401, headers: WIDGET_CORS_HEADERS },
    )
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: conversation.workspaceId },
    select: {
      id: true,
      voiceEnabled: true,
      aiEnabled: true,
      aiApiKey: true,
      aiProvider: true,
      voiceSettings: true,
      voiceGreeting: true,
      voiceLanguage: true,
      voiceMinutesUsed: true,
    },
  })

  if (!workspace) {
    return NextResponse.json(
      { error: 'Workspace not found' },
      { status: 404, headers: WIDGET_CORS_HEADERS },
    )
  }

  if (!workspace.voiceEnabled) {
    return NextResponse.json(
      { error: 'Voice is not enabled for this workspace' },
      { status: 422, headers: WIDGET_CORS_HEADERS },
    )
  }

  if (!workspace.aiEnabled) {
    return NextResponse.json(
      { error: 'AI must be enabled for voice. Configure in Settings > AI.' },
      { status: 422, headers: WIDGET_CORS_HEADERS },
    )
  }

  const hasKey =
    workspace.aiApiKey ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY
  if (!hasKey) {
    return NextResponse.json(
      { error: 'AI API key required for voice. Configure in Settings > AI.' },
      { status: 422, headers: WIDGET_CORS_HEADERS },
    )
  }

  const livekitUrl = process.env.LIVEKIT_URL
  const livekitApiKey = process.env.LIVEKIT_API_KEY
  const livekitApiSecret = process.env.LIVEKIT_API_SECRET

  if (!livekitUrl || !livekitApiKey || !livekitApiSecret) {
    return NextResponse.json(
      { error: 'Voice service not configured' },
      { status: 503, headers: WIDGET_CORS_HEADERS },
    )
  }

  const roomName = `helpnest-${workspace.id}-${Date.now()}`
  const participantIdentity = `widget-${crypto.randomUUID().slice(0, 10)}`

  const voiceConversation = await prisma.conversation.create({
    data: { workspaceId: workspace.id },
    select: { id: true, sessionToken: true },
  })

  const roomMetadata = JSON.stringify({
    workspaceId: workspace.id,
    conversationId: voiceConversation.id,
    voiceSettings: workspace.voiceSettings ?? {
      provider: 'inworld',
      voice: 'Ashley',
      voiceId: 'Ashley',
      model: 'inworld-tts-1.5-mini',
    },
    greeting: workspace.voiceGreeting,
    language: workspace.voiceLanguage ?? 'en',
  })

  const roomService = new RoomServiceClient(livekitUrl, livekitApiKey, livekitApiSecret)
  await roomService.createRoom({
    name: roomName,
    emptyTimeout: 30,
    maxParticipants: 2,
    metadata: roomMetadata,
  })

  await prisma.voiceSession.create({
    data: {
      workspaceId: workspace.id,
      conversationId: voiceConversation.id,
      roomName,
      status: 'active',
    },
  })

  const token = new AccessToken(livekitApiKey, livekitApiSecret, {
    identity: participantIdentity,
    name: 'Customer',
  })
  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  })

  return NextResponse.json(
    {
      token: await token.toJwt(),
      livekitUrl,
      roomName,
      participantIdentity,
      conversationId: voiceConversation.id,
    },
    { headers: WIDGET_CORS_HEADERS },
  )
}
