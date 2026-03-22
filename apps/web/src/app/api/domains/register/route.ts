import { NextResponse } from 'next/server'
import { auth, resolveSessionUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { resolveWorkspaceId } from '@/lib/workspace'
import { isCloudMode, getWorkspacePlan } from '@/lib/cloud'
import { createCustomHostname, findCustomHostname, isCloudflareEnabled } from '@/lib/cloudflare-saas'

/**
 * POST /api/domains/register
 * Registers a custom domain via Cloudflare for SaaS.
 * Body: { domain }
 */
export async function POST(request: Request) {
  const session = await auth()
  const userId = await resolveSessionUserId(session)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const workspaceId = await resolveWorkspaceId(userId)
  if (!workspaceId) {
    return NextResponse.json({ error: 'No workspace' }, { status: 404 })
  }

  const member = await prisma.member.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true },
  })
  if (!member || !['OWNER', 'ADMIN'].includes(member.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  // Plan gate — custom domains require PRO or BUSINESS in cloud mode
  if (isCloudMode()) {
    const plan = await getWorkspacePlan(workspaceId)
    if (!plan || plan.plan === 'FREE') {
      return NextResponse.json({ error: 'Custom domains require a Pro or Business plan.' }, { status: 403 })
    }
  }

  const { domain } = (await request.json()) as { domain?: string }
  if (!domain?.trim()) {
    return NextResponse.json({ error: 'Domain is required' }, { status: 400 })
  }

  const cleanDomain = domain.trim().toLowerCase()

  // Basic hostname format validation
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(cleanDomain)) {
    return NextResponse.json({ error: 'Invalid domain format.' }, { status: 400 })
  }

  // Check if this domain is already registered by another workspace
  const existingWorkspace = await prisma.workspace.findFirst({
    where: { customDomain: cleanDomain, id: { not: workspaceId } },
    select: { id: true },
  })
  if (existingWorkspace) {
    return NextResponse.json({ error: 'This domain is already in use by another workspace.' }, { status: 409 })
  }

  // If Cloudflare for SaaS is enabled, register the custom hostname
  if (isCloudflareEnabled()) {
    // Check if already registered in Cloudflare
    const existing = await findCustomHostname(cleanDomain)
    if (existing) {
      // Already exists in Cloudflare — save to DB and return status
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { customDomain: cleanDomain },
      })

      return NextResponse.json({
        domain: cleanDomain,
        cloudflareId: existing.id,
        status: existing.status,
        ssl: existing.ssl,
        ownershipVerification: existing.ownershipVerification,
      })
    }

    // Create new custom hostname in Cloudflare
    const result = await createCustomHostname(cleanDomain)
    if (!result) {
      return NextResponse.json({ error: 'Failed to register domain. Please try again.' }, { status: 502 })
    }

    // Save to DB
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { customDomain: cleanDomain },
    })

    return NextResponse.json({
      domain: cleanDomain,
      cloudflareId: result.id,
      status: result.status,
      ssl: result.ssl,
      ownershipVerification: result.ownershipVerification,
    })
  }

  // No Cloudflare — just save the domain (self-hosted mode)
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { customDomain: cleanDomain },
  })

  return NextResponse.json({ domain: cleanDomain, status: 'saved' })
}
