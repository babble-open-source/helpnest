import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth-api'
import { emitConversationEvent } from '@/lib/conversation-events'
import type { EventActorType, ConversationEventVerb } from '@helpnest/db'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-Token',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

// GET — Get conversation details (widget via sessionToken or dashboard via auth)
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sessionToken = request.headers.get('x-session-token')

  if (sessionToken) {
    // Widget access via session token — scope strictly to matching conversation.
    // Internal notes must never be exposed to the widget: the response is sent
    // with Access-Control-Allow-Origin: * so any JS on the host page (or an XSS
    // payload) that has the sessionToken can read the full body.
    const conversation = await prisma.conversation.findFirst({
      where: { id, sessionToken },
      include: {
        messages: { where: { isInternal: false }, orderBy: { createdAt: 'asc' } },
        articles: {
          include: {
            article: {
              select: {
                id: true,
                title: true,
                slug: true,
                collection: { select: { slug: true, title: true } },
              },
            },
          },
        },
      },
    })
    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404, headers: CORS_HEADERS }
      )
    }
    return NextResponse.json(conversation, { headers: CORS_HEADERS })
  }

  // Dashboard access requires a valid session or API key.
  const authResult = await requireAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id, workspaceId: authResult.workspaceId },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      assignedTo: {
        select: { id: true, user: { select: { name: true, email: true } } },
      },
      contact: {
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          avatarUrl: true,
          organizations: {
            select: {
              organization: {
                select: { id: true, name: true, plan: true },
              },
            },
          },
        },
      },
      organization: {
        select: { id: true, name: true, plan: true },
      },
      articles: {
        include: {
          article: {
            select: {
              id: true,
              title: true,
              slug: true,
              collection: { select: { slug: true, title: true } },
            },
          },
        },
      },
      events: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          verb: true,
          actorType: true,
          actorMemberId: true,
          actorLabel: true,
          payload: true,
          durationSeconds: true,
          createdAt: true,
        },
      },
    },
  })
  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  return NextResponse.json(conversation)
}

// PATCH — Update conversation (status, resolutionSummary, contactId, organizationId)
// Dashboard auth required.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authResult = await requireAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    status?: string
    resolutionSummary?: string
    contactId?: string | null
    organizationId?: string | null
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id, workspaceId: authResult.workspaceId },
  })
  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  const data: Record<string, unknown> = {}
  // Collect post-update events to emit sequentially after the DB write.
  const pendingEvents: Array<{
    verb: ConversationEventVerb
    payload: Record<string, unknown>
  }> = []

  // ── status ──────────────────────────────────────────────────────────────
  if (body.status !== undefined) {
    // HUMAN_ACTIVE intentionally included; WAITING is deferred to K3.
    const validStatuses: string[] = [
      'ACTIVE',
      'ESCALATED',
      'HUMAN_ACTIVE',
      'RESOLVED_AI',
      'RESOLVED_HUMAN',
      'CLOSED',
    ]
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    data.status = body.status
  }

  // ── resolutionSummary ────────────────────────────────────────────────────
  if (body.resolutionSummary !== undefined) {
    // Explicit null clears the field; otherwise truncate to a safe length.
    data.resolutionSummary = body.resolutionSummary ? body.resolutionSummary.slice(0, 2000) : null
  }

  // ── contactId ────────────────────────────────────────────────────────────
  if (body.contactId !== undefined) {
    if (body.contactId === null) {
      data.contactId = null
    } else {
      const contact = await prisma.contact.findFirst({
        where: { id: body.contactId, workspaceId: authResult.workspaceId },
      })
      if (!contact) {
        return NextResponse.json({ error: 'Contact not found in this workspace' }, { status: 400 })
      }
      data.contactId = contact.id
      pendingEvents.push({
        verb: 'CONTACT_LINKED',
        payload: { contactId: contact.id, source: 'MANUAL' },
      })
    }
  }

  // ── organizationId ───────────────────────────────────────────────────────
  if (body.organizationId !== undefined) {
    if (body.organizationId === null) {
      data.organizationId = null
    } else {
      const organization = await prisma.organization.findFirst({
        where: { id: body.organizationId, workspaceId: authResult.workspaceId },
      })
      if (!organization) {
        return NextResponse.json(
          { error: 'Organization not found in this workspace' },
          { status: 400 }
        )
      }
      data.organizationId = organization.id
      pendingEvents.push({
        verb: 'ORG_LINKED',
        payload: { organizationId: organization.id, source: 'MANUAL' },
      })
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  // Resolve member for actor label before the transaction so we can use the
  // label inside it. Best-effort: null is acceptable.
  const member = authResult.userId
    ? await prisma.member.findFirst({
        where: { userId: authResult.userId, workspaceId: authResult.workspaceId },
        select: { id: true, user: { select: { name: true, email: true } } },
      })
    : null

  const actorType: EventActorType = 'AGENT'
  const actorMemberId = member?.id ?? undefined
  const actorLabel = member?.user.name ?? member?.user.email ?? undefined

  // Execute the DB write and all event emissions in a single atomic transaction.
  // STATUS_CHANGED and RESOLVED are SLA-critical verbs (spec §3) — they must be
  // written in the same transaction as the conversation mutation so they are never
  // persisted without the corresponding status change, or vice-versa.
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.conversation.update({
      where: { id, workspaceId: authResult.workspaceId },
      data,
    })

    // ── STATUS_CHANGED (spec §3: SLA-critical, must be transactional) ────────
    if (body.status !== undefined && body.status !== conversation.status) {
      await emitConversationEvent({
        tx,
        workspaceId: authResult.workspaceId,
        conversationId: id,
        actorType,
        actorMemberId,
        actorLabel,
        verb: 'STATUS_CHANGED',
        payload: { from: conversation.status, to: body.status },
      })

      // ── RESOLVED (emitted alongside STATUS_CHANGED for terminal statuses) ──
      if (body.status === 'RESOLVED_AI' || body.status === 'RESOLVED_HUMAN') {
        const durationSeconds = Math.floor(
          (Date.now() - new Date(conversation.createdAt).getTime()) / 1000
        )
        await emitConversationEvent({
          tx,
          workspaceId: authResult.workspaceId,
          conversationId: id,
          actorType,
          actorMemberId,
          actorLabel,
          verb: 'RESOLVED',
          payload: { status: body.status },
          durationSeconds,
        })
      }
    }

    // ── Contact/Org link events ───────────────────────────────────────────────
    for (const ev of pendingEvents) {
      await emitConversationEvent({
        tx,
        workspaceId: authResult.workspaceId,
        conversationId: id,
        actorType,
        actorMemberId,
        actorLabel,
        verb: ev.verb,
        payload: ev.payload,
      })
    }

    return result
  })

  return NextResponse.json(updated)
}
