import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth-api'
import { autoAssociateContactToOrg } from '@/lib/org-associator'
import type { Prisma } from '@helpnest/db'

// GET /api/customers
// Query params: q (email/name search), organizationId, page, limit
export async function GET(request: Request) {
  const authResult = await requireAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() || undefined
  const organizationId = searchParams.get('organizationId') || undefined
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {
    workspaceId: authResult.workspaceId,
    mergedIntoId: null,
  }

  if (q) {
    where.OR = [
      { email: { contains: q, mode: 'insensitive' } },
      { fullName: { contains: q, mode: 'insensitive' } },
    ]
  }

  if (organizationId) {
    where.organizations = { some: { organizationId } }
  }

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        organizations: {
          include: {
            organization: { select: { id: true, name: true, plan: true } },
          },
        },
        _count: { select: { conversations: true } },
      },
    }),
    prisma.contact.count({ where }),
  ])

  return NextResponse.json({
    data: contacts.map((c) => ({
      id: c.id,
      email: c.email,
      fullName: c.fullName,
      phone: c.phone,
      externalId: c.externalId,
      visitorId: c.visitorId,
      avatarUrl: c.avatarUrl,
      customFields: c.customFields,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      organizations: c.organizations,
      conversationCount: c._count.conversations,
    })),
    total,
    page,
    limit,
  })
}

// POST /api/customers
// Body: { email?, externalId?, visitorId?, fullName?, phone?, organizationId?, customFields? }
// At least one of email / externalId / visitorId is required.
export async function POST(request: Request) {
  const authResult = await requireAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    email?: string
    externalId?: string
    visitorId?: string
    fullName?: string
    phone?: string
    organizationId?: string
    customFields?: Record<string, unknown>
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { email, externalId, visitorId, fullName, phone, organizationId, customFields } = body

  if (!email && !externalId && !visitorId) {
    return NextResponse.json(
      { error: 'At least one of email, externalId, or visitorId is required' },
      { status: 400 }
    )
  }

  const contact = await prisma.$transaction(async (tx) => {
    const created = await tx.contact.create({
      data: {
        workspaceId: authResult.workspaceId,
        email: email?.slice(0, 320) || null,
        externalId: externalId?.slice(0, 255) || null,
        visitorId: visitorId?.slice(0, 128) || null,
        fullName: fullName?.slice(0, 200) || null,
        phone: phone?.slice(0, 50) || null,
        customFields: (customFields ?? {}) as Prisma.InputJsonValue,
      },
      include: {
        organizations: {
          include: {
            organization: { select: { id: true, name: true, plan: true } },
          },
        },
      },
    })

    // Link to a specific org if provided, then run domain auto-association
    if (organizationId) {
      const org = await tx.organization.findFirst({
        where: { id: organizationId, workspaceId: authResult.workspaceId },
      })
      if (org) {
        await tx.contactOrganization.create({
          data: {
            workspaceId: authResult.workspaceId,
            contactId: created.id,
            organizationId,
            isPrimary: true,
            source: 'MANUAL',
          },
        })
      }
    }

    // Domain auto-association (skips free-mail domains, no-ops if no match)
    await autoAssociateContactToOrg(tx, authResult.workspaceId, created)

    return created
  })

  return NextResponse.json(contact, { status: 201 })
}
