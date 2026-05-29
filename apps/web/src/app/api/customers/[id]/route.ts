import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth-api'

// GET /api/customers/[id]
// Returns contact + orgs + recent 5 conversations
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authResult = await requireAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const contact = await prisma.contact.findFirst({
    where: { id, workspaceId: authResult.workspaceId },
    include: {
      organizations: {
        include: {
          organization: {
            select: { id: true, name: true, plan: true, domains: true, ownerId: true },
          },
        },
      },
      conversations: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          number: true,
          status: true,
          subject: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  })

  if (!contact) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  return NextResponse.json(contact)
}

// PATCH /api/customers/[id]
// Accepts: fullName, phone, externalId, customFields
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authResult = await requireAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    fullName?: string
    phone?: string
    externalId?: string
    customFields?: Record<string, unknown>
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const contact = await prisma.contact.findFirst({
    where: { id, workspaceId: authResult.workspaceId },
  })
  if (!contact) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  if (contact.mergedIntoId) {
    return NextResponse.json(
      { error: 'Cannot update a merged contact. Update the survivor instead.' },
      { status: 409 }
    )
  }

  const data: Record<string, unknown> = {}
  if (body.fullName !== undefined) data.fullName = body.fullName?.slice(0, 200) ?? null
  if (body.phone !== undefined) data.phone = body.phone?.slice(0, 50) ?? null
  if (body.externalId !== undefined) data.externalId = body.externalId?.slice(0, 255) ?? null
  if (body.customFields !== undefined) data.customFields = body.customFields

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const updated = await prisma.contact.update({
    where: { id, workspaceId: authResult.workspaceId },
    data,
    include: {
      organizations: {
        include: {
          organization: { select: { id: true, name: true, plan: true } },
        },
      },
    },
  })

  return NextResponse.json(updated)
}

// DELETE /api/customers/[id]
// Body (optional): { mergeIntoId: string }
// With mergeIntoId: soft-merge — re-points conversations to survivor, sets mergedIntoId
// Without mergeIntoId: hard-delete only if no conversations; else 409
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authResult = await requireAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { mergeIntoId?: string } = {}
  try {
    const text = await request.text()
    if (text.trim()) body = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const contact = await prisma.contact.findFirst({
    where: { id, workspaceId: authResult.workspaceId },
  })
  if (!contact) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  // Reject any operation on a contact that has already been merged: it is a
  // source record kept for audit purposes only. Hard-deleting it would remove
  // the mergedFrom back-reference on the survivor (onDelete: SetNull), silently
  // destroying the merge audit trail.
  if (contact.mergedIntoId) {
    return NextResponse.json(
      {
        error: 'Cannot delete a merged contact. The merge record is required for audit history.',
      },
      { status: 409 }
    )
  }

  if (body.mergeIntoId) {
    const survivor = await prisma.contact.findFirst({
      where: { id: body.mergeIntoId, workspaceId: authResult.workspaceId },
    })
    if (!survivor) {
      return NextResponse.json({ error: 'Merge target contact not found' }, { status: 404 })
    }
    if (survivor.mergedIntoId) {
      return NextResponse.json(
        { error: 'Merge target is itself a merged contact. Use the survivor directly.' },
        { status: 409 }
      )
    }

    await prisma.$transaction(async (tx) => {
      // Re-point all conversations to the survivor
      await tx.conversation.updateMany({
        where: { contactId: id, workspaceId: authResult.workspaceId },
        data: { contactId: body.mergeIntoId },
      })
      // Mark source as merged — include workspaceId in the predicate to prevent
      // a TOCTOU race from mutating a record whose workspace was changed concurrently.
      await tx.contact.update({
        where: { id, workspaceId: authResult.workspaceId },
        data: { mergedIntoId: body.mergeIntoId },
      })
    })

    return NextResponse.json({ merged: true, survivorId: body.mergeIntoId })
  }

  // Hard delete — only safe when no conversations exist
  const conversationCount = await prisma.conversation.count({
    where: { contactId: id, workspaceId: authResult.workspaceId },
  })
  if (conversationCount > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete contact with ${conversationCount} conversation(s). Use mergeIntoId to merge instead.`,
      },
      { status: 409 }
    )
  }

  // Include workspaceId in the delete predicate to match the established pattern
  // in the conversation PATCH route and prevent TOCTOU races on workspace scope.
  await prisma.contact.delete({ where: { id, workspaceId: authResult.workspaceId } })
  return NextResponse.json({ deleted: true })
}
