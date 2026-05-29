import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth-api'

const VALID_ROLES = ['MEMBER', 'ADMIN', 'TECHNICAL', 'BILLING'] as const
type OrgRole = (typeof VALID_ROLES)[number]

// GET /api/customers/[id]/organizations
// List all org memberships for a contact
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authResult = await requireAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const contact = await prisma.contact.findFirst({
    where: { id, workspaceId: authResult.workspaceId },
    select: { id: true },
  })
  if (!contact) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  const memberships = await prisma.contactOrganization.findMany({
    where: { contactId: id, workspaceId: authResult.workspaceId },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          plan: true,
          domains: true,
          tags: true,
          ownerId: true,
        },
      },
    },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
  })

  return NextResponse.json({ data: memberships })
}

// POST /api/customers/[id]/organizations
// Body: { organizationId: string, isPrimary?: boolean, role?: string }
// Adds or updates the org membership (upsert by contactId+organizationId)
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authResult = await requireAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { organizationId?: string; isPrimary?: boolean; role?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.organizationId) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
  }

  if (body.role && !VALID_ROLES.includes(body.role as OrgRole)) {
    return NextResponse.json(
      { error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` },
      { status: 400 }
    )
  }

  // Verify contact belongs to workspace
  const contact = await prisma.contact.findFirst({
    where: { id, workspaceId: authResult.workspaceId },
    select: { id: true },
  })
  if (!contact) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  // Verify org belongs to workspace
  const org = await prisma.organization.findFirst({
    where: { id: body.organizationId, workspaceId: authResult.workspaceId },
    select: { id: true },
  })
  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  }

  const existing = await prisma.contactOrganization.findFirst({
    where: { contactId: id, organizationId: body.organizationId, workspaceId: authResult.workspaceId },
  })

  let membership
  if (existing) {
    membership = await prisma.contactOrganization.update({
      where: { id: existing.id },
      data: {
        isPrimary: body.isPrimary ?? existing.isPrimary,
        role: (body.role as OrgRole) ?? existing.role,
        source: 'MANUAL',
      },
      include: {
        organization: { select: { id: true, name: true, plan: true } },
      },
    })
  } else {
    membership = await prisma.contactOrganization.create({
      data: {
        workspaceId: authResult.workspaceId,
        contactId: id,
        organizationId: body.organizationId,
        isPrimary: body.isPrimary ?? false,
        role: (body.role as OrgRole) ?? null,
        source: 'MANUAL',
      },
      include: {
        organization: { select: { id: true, name: true, plan: true } },
      },
    })
  }

  return NextResponse.json(membership, { status: existing ? 200 : 201 })
}

// DELETE /api/customers/[id]/organizations
// Body: { organizationId: string }
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authResult = await requireAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { organizationId?: string } = {}
  try {
    const text = await request.text()
    if (text.trim()) body = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.organizationId) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 })
  }

  // Verify contact belongs to workspace
  const contact = await prisma.contact.findFirst({
    where: { id, workspaceId: authResult.workspaceId },
    select: { id: true },
  })
  if (!contact) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  const membership = await prisma.contactOrganization.findFirst({
    where: {
      contactId: id,
      organizationId: body.organizationId,
      workspaceId: authResult.workspaceId,
    },
  })
  if (!membership) {
    return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
  }

  await prisma.contactOrganization.delete({ where: { id: membership.id } })
  return NextResponse.json({ removed: true })
}
