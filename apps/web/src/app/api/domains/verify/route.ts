import { NextResponse } from 'next/server'
import { auth, resolveSessionUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { resolveWorkspaceId } from '@/lib/workspace'
import dns from 'node:dns/promises'

/**
 * POST /api/domains/verify
 * Checks if a custom domain's CNAME is correctly configured.
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

  // Verify user is OWNER or ADMIN
  const member = await prisma.member.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true },
  })
  if (!member || !['OWNER', 'ADMIN'].includes(member.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { domain } = (await request.json()) as { domain?: string }
  if (!domain?.trim()) {
    return NextResponse.json({ error: 'Domain is required' }, { status: 400 })
  }

  const cleanDomain = domain.trim().toLowerCase()

  try {
    // Look up CNAME records for the domain
    const records = await dns.resolveCname(cleanDomain)
    const appHost = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')
      .replace(/^https?:\/\//, '')
      .split(':')[0]

    // Check if any CNAME record points to our app host
    const isValid = records.some((record) => {
      const normalizedRecord = record.replace(/\.$/, '').toLowerCase()
      return normalizedRecord === appHost || normalizedRecord.endsWith(`.${appHost}`)
    })

    if (isValid) {
      // Update workspace custom domain in DB
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { customDomain: cleanDomain },
      })

      return NextResponse.json({
        status: 'active',
        records,
        message: 'Domain verified successfully. Your custom domain is now active.',
      })
    }

    return NextResponse.json({
      status: 'pending',
      records,
      expected: appHost,
      message: `CNAME found but points to ${records.join(', ')} instead of ${appHost}.`,
    })
  } catch (err) {
    const code = (err as { code?: string }).code

    if (code === 'ENODATA' || code === 'ENOTFOUND') {
      return NextResponse.json({
        status: 'pending',
        records: [],
        message: 'No CNAME record found. Please add the DNS record and try again.',
      })
    }

    return NextResponse.json({
      status: 'error',
      records: [],
      message: 'DNS lookup failed. Please try again later.',
    })
  }
}
