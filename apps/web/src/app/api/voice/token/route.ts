import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { redis } from '@/lib/redis'
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk'

const WIDGET_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
}

// ---------------------------------------------------------------------------
// Rate limiting — mirrors the pattern in src/app/api/ai-search/route.ts.
// Two keys are checked independently:
//   - per-session : 5 requests / minute  (prevents a single visitor from
//                                          hammering the endpoint)
//   - per-workspace: 60 requests / minute (coarse DoS protection across all
//                                          visitors of one workspace)
// ---------------------------------------------------------------------------
const VOICE_RATE_LIMIT_WINDOW_MS = 60_000
const VOICE_RATE_LIMIT_SESSION_MAX = 5
const VOICE_RATE_LIMIT_WORKSPACE_MAX = 60

type RateBucket = { count: number; resetAt: number }
const voiceRateBuckets = new Map<string, RateBucket>()

function consumeInMemoryVoiceRateLimit(
  key: string,
  max: number,
): { limited: boolean; retryAfterSeconds: number } {
  const now = Date.now()

  if (voiceRateBuckets.size > 10_000) {
    for (const [k, bucket] of voiceRateBuckets) {
      if (bucket.resetAt <= now) voiceRateBuckets.delete(k)
    }
  }

  const current = voiceRateBuckets.get(key)
  if (!current || current.resetAt <= now) {
    voiceRateBuckets.set(key, { count: 1, resetAt: now + VOICE_RATE_LIMIT_WINDOW_MS })
    return { limited: false, retryAfterSeconds: 0 }
  }

  if (current.count >= max) {
    return {
      limited: true,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    }
  }

  current.count += 1
  voiceRateBuckets.set(key, current)
  return { limited: false, retryAfterSeconds: 0 }
}

async function consumeVoiceRateLimit(
  key: string,
  max: number,
): Promise<{ limited: boolean; retryAfterSeconds: number }> {
  if (redis) {
    try {
      const windowSlot = Math.floor(Date.now() / VOICE_RATE_LIMIT_WINDOW_MS)
      const redisKey = `rl:voice:${key}:${windowSlot}`
      const [[, count]] = (await redis
        .pipeline()
        .incr(redisKey)
        .pexpire(redisKey, VOICE_RATE_LIMIT_WINDOW_MS * 2)
        .exec()) as [[null, number], [null, number]]
      if (count > max) {
        const windowEndMs = (windowSlot + 1) * VOICE_RATE_LIMIT_WINDOW_MS
        return {
          limited: true,
          retryAfterSeconds: Math.max(1, Math.ceil((windowEndMs - Date.now()) / 1000)),
        }
      }
      return { limited: false, retryAfterSeconds: 0 }
    } catch {
      // Redis error — degrade gracefully to in-memory.
    }
  }
  return consumeInMemoryVoiceRateLimit(key, max)
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: WIDGET_CORS_HEADERS })
}

export async function POST(request: Request) {
  const sessionToken = request.headers.get('x-session-token')
  if (!sessionToken) {
    return NextResponse.json(
      { error: 'Session token required' },
      { status: 401, headers: WIDGET_CORS_HEADERS }
    )
  }

  const conversation = await prisma.conversation.findFirst({
    where: { sessionToken },
    select: {
      workspaceId: true,
      visitorId: true,
      customerName: true,
      customerEmail: true,
    },
  })
  if (!conversation) {
    return NextResponse.json(
      { error: 'Invalid session' },
      { status: 401, headers: WIDGET_CORS_HEADERS }
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
      { status: 404, headers: WIDGET_CORS_HEADERS }
    )
  }

  // Explicit workspace-scope guard: the session must belong to this workspace.
  if (conversation.workspaceId !== workspace.id) {
    return NextResponse.json(
      { error: 'Session does not belong to this workspace' },
      { status: 403, headers: WIDGET_CORS_HEADERS }
    )
  }

  if (!workspace.voiceEnabled) {
    return NextResponse.json(
      { error: 'Voice is not enabled for this workspace' },
      { status: 422, headers: WIDGET_CORS_HEADERS }
    )
  }

  if (!workspace.aiEnabled) {
    return NextResponse.json(
      { error: 'AI must be enabled for voice. Configure in Settings > AI.' },
      { status: 422, headers: WIDGET_CORS_HEADERS }
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
      { status: 422, headers: WIDGET_CORS_HEADERS }
    )
  }

  const livekitUrl = process.env.LIVEKIT_URL
  const livekitApiKey = process.env.LIVEKIT_API_KEY
  const livekitApiSecret = process.env.LIVEKIT_API_SECRET

  if (!livekitUrl || !livekitApiKey || !livekitApiSecret) {
    return NextResponse.json(
      { error: 'Voice service not configured' },
      { status: 503, headers: WIDGET_CORS_HEADERS }
    )
  }

  // Rate-limit checks — per session and per workspace.
  const sessionRateResult = await consumeVoiceRateLimit(
    `session:${sessionToken}`,
    VOICE_RATE_LIMIT_SESSION_MAX,
  )
  if (sessionRateResult.limited) {
    return NextResponse.json(
      { error: 'Too many voice requests. Please try again shortly.' },
      {
        status: 429,
        headers: { ...WIDGET_CORS_HEADERS, 'Retry-After': String(sessionRateResult.retryAfterSeconds) },
      }
    )
  }

  const workspaceRateResult = await consumeVoiceRateLimit(
    `workspace:${workspace.id}`,
    VOICE_RATE_LIMIT_WORKSPACE_MAX,
  )
  if (workspaceRateResult.limited) {
    return NextResponse.json(
      { error: 'Too many voice requests for this workspace. Please try again shortly.' },
      {
        status: 429,
        headers: { ...WIDGET_CORS_HEADERS, 'Retry-After': String(workspaceRateResult.retryAfterSeconds) },
      }
    )
  }

  // NOTE: voiceMinutesUsed is tracked but there is no voiceMinutesLimit column
  // in the Workspace model yet. Once a limit column is added via migration,
  // enforce it here before proceeding (e.g. return 429 when
  // voiceMinutesUsed >= voiceMinutesLimit).

  // Generate the room name before the transaction so both records can reference it.
  // Using randomUUID avoids the timestamp collision that occurs when two callers
  // arrive within the same millisecond.
  const roomName = `helpnest-${workspace.id}-${crypto.randomUUID()}`
  const participantIdentity = `widget-${crypto.randomUUID().slice(0, 10)}`

  // Create the conversation + voiceSession atomically. LiveKit room creation
  // happens after the commit so that a LiveKit failure does not leave the
  // transaction in a half-committed state. If LiveKit fails we compensate by
  // deleting the committed records and returning an appropriate error.
  const { voiceConversation, voiceSession } = await prisma.$transaction(async (tx) => {
    const newConversation = await tx.conversation.create({
      data: {
        workspaceId: workspace.id,
        visitorId: conversation.visitorId,
        customerName: conversation.customerName,
        customerEmail: conversation.customerEmail,
      },
      select: { id: true, sessionToken: true },
    })

    const newVoiceSession = await tx.voiceSession.create({
      data: {
        workspaceId: workspace.id,
        conversationId: newConversation.id,
        roomName,
        status: 'active',
      },
      select: { id: true },
    })

    return { voiceConversation: newConversation, voiceSession: newVoiceSession }
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
  try {
    await roomService.createRoom({
      name: roomName,
      emptyTimeout: 30,
      maxParticipants: 2,
      metadata: roomMetadata,
    })
  } catch (err) {
    // LiveKit room creation failed after the DB records were committed.
    // Compensate by cleaning up the orphaned rows so the workspace stays consistent.
    await prisma.voiceSession.delete({ where: { id: voiceSession.id } }).catch(() => {})
    await prisma.conversation.delete({ where: { id: voiceConversation.id } }).catch(() => {})

    const message = err instanceof Error ? err.message : 'Unknown LiveKit error'
    return NextResponse.json(
      { error: `Voice room could not be created: ${message}` },
      { status: 502, headers: WIDGET_CORS_HEADERS }
    )
  }

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
      sessionToken: voiceConversation.sessionToken,
    },
    { headers: WIDGET_CORS_HEADERS }
  )
}
