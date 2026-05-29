import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth-api'
import type { Prisma } from '@helpnest/db'

// GET /api/organizations
// Query params: q (name/domain search), ownerId, page, limit
export async function GET(request: Request) {
  const authResult = await requireAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() || undefined
  const ownerId = searchParams.get('ownerId') || undefined
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = { workspaceId: authResult.workspaceId }

  if (q) {
    where.OR = [{ name: { contains: q, mode: 'insensitive' } }, { domains: { has: q } }]
  }

  if (ownerId) {
    where.ownerId = ownerId
  }

  const [organizations, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        owner: {
          select: { id: true, user: { select: { name: true, email: true } } },
        },
        _count: { select: { contacts: true, conversations: true } },
      },
    }),
    prisma.organization.count({ where }),
  ])

  return NextResponse.json({
    data: organizations.map((org) => ({
      id: org.id,
      name: org.name,
      domains: org.domains,
      plan: org.plan,
      tags: org.tags,
      notes: org.notes,
      externalId: org.externalId,
      customFields: org.customFields,
      ownerId: org.ownerId,
      owner: org.owner
        ? { id: org.owner.id, name: org.owner.user.name, email: org.owner.user.email }
        : null,
      contactCount: org._count.contacts,
      conversationCount: org._count.conversations,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    })),
    total,
    page,
    limit,
  })
}

// POST /api/organizations
// Body: { name (required), domains?, plan?, tags?, ownerId?, externalId?, notes?, customFields? }
export async function POST(request: Request) {
  const authResult = await requireAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    name?: string
    domains?: string[]
    plan?: string
    tags?: string[]
    ownerId?: string
    externalId?: string
    notes?: string
    customFields?: Record<string, unknown>
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const org = await prisma.organization.create({
    data: {
      workspaceId: authResult.workspaceId,
      name: body.name.slice(0, 255),
      domains: body.domains ?? [],
      plan: body.plan?.slice(0, 100) || null,
      tags: body.tags ?? [],
      ownerId: body.ownerId || null,
      externalId: body.externalId?.slice(0, 255) || null,
      notes: body.notes?.slice(0, 5000) || null,
      customFields: (body.customFields ?? {}) as Prisma.InputJsonValue,
    },
    include: {
      owner: {
        select: { id: true, user: { select: { name: true, email: true } } },
      },
      _count: { select: { contacts: true, conversations: true } },
    },
  })

  return NextResponse.json(org, { status: 201 })
}
