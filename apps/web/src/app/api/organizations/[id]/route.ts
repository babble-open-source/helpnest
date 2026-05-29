import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth-api'

// Statuses considered "open" for the delete-block guard.
const OPEN_STATUSES = ['ACTIVE', 'ESCALATED', 'HUMAN_ACTIVE'] as const

// GET /api/organizations/[id]
// Returns full org detail + paginated contact list + openConversationCount
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authResult = await requireAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const contactPage = Math.max(1, parseInt(searchParams.get('contactPage') || '1', 10))
  const contactLimit = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get('contactLimit') || '20', 10))
  )
  const contactSkip = (contactPage - 1) * contactLimit

  const org = await prisma.organization.findFirst({
    where: { id, workspaceId: authResult.workspaceId },
    include: {
      owner: {
        select: { id: true, user: { select: { name: true, email: true } } },
      },
      contacts: {
        skip: contactSkip,
        take: contactLimit,
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        include: {
          contact: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
              avatarUrl: true,
              createdAt: true,
            },
          },
        },
      },
      _count: { select: { contacts: true, conversations: true } },
    },
  })

  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  const openConversationCount = await prisma.conversation.count({
    where: {
      organizationId: id,
      workspaceId: authResult.workspaceId,
      status: { in: [...OPEN_STATUSES] },
    },
  })

  return NextResponse.json({
    ...org,
    openConversationCount,
  })
}

// PATCH /api/organizations/[id]
// Accepted fields: name, domains, plan, tags, ownerId, notes, customFields
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authResult = await requireAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    name?: string
    domains?: string[]
    plan?: string | null
    tags?: string[]
    ownerId?: string | null
    notes?: string | null
    customFields?: Record<string, unknown>
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const org = await prisma.organization.findFirst({
    where: { id, workspaceId: authResult.workspaceId },
  })
  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  const data: Record<string, unknown> = {}
  if (body.name !== undefined) {
    if (!body.name.trim()) {
      return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 })
    }
    data.name = body.name.slice(0, 255)
  }
  if (body.domains !== undefined) data.domains = body.domains
  if (body.plan !== undefined) data.plan = body.plan?.slice(0, 100) ?? null
  if (body.tags !== undefined) data.tags = body.tags
  if (body.ownerId !== undefined) data.ownerId = body.ownerId ?? null
  if (body.notes !== undefined) data.notes = body.notes?.slice(0, 5000) ?? null
  if (body.customFields !== undefined) data.customFields = body.customFields

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const updated = await prisma.organization.update({
    where: { id },
    data,
    include: {
      owner: {
        select: { id: true, user: { select: { name: true, email: true } } },
      },
      _count: { select: { contacts: true, conversations: true } },
    },
  })

  return NextResponse.json(updated)
}

// DELETE /api/organizations/[id]
// Blocks with 409 if any open conversations exist; otherwise hard-deletes.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authResult = await requireAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const org = await prisma.organization.findFirst({
    where: { id, workspaceId: authResult.workspaceId },
  })
  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  const openCount = await prisma.conversation.count({
    where: {
      organizationId: id,
      workspaceId: authResult.workspaceId,
      status: { in: [...OPEN_STATUSES] },
    },
  })

  if (openCount > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete organization with ${openCount} open conversation(s). Resolve or close them first.`,
      },
      { status: 409 }
    )
  }

  await prisma.organization.delete({ where: { id } })
  return NextResponse.json({ deleted: true })
}
