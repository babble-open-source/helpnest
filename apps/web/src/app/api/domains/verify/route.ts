import { NextResponse } from 'next/server'
import { auth, resolveSessionUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { resolveWorkspaceId } from '@/lib/workspace'
import { findCustomHostname, isCloudflareEnabled } from '@/lib/cloudflare-saas'
import dns from 'node:dns/promises'

/**
 * POST /api/domains/verify
 * Checks custom domain status — via Cloudflare API if enabled, or DNS lookup fallback.
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

  const { domain } = (await request.json()) as { domain?: string }
  if (!domain?.trim()) {
    return NextResponse.json({ error: 'Domain is required' }, { status: 400 })
  }

  const cleanDomain = domain.trim().toLowerCase()

  // If Cloudflare for SaaS is enabled, check via Cloudflare API
  if (isCloudflareEnabled()) {
    const hostname = await findCustomHostname(cleanDomain)

    if (!hostname) {
      return NextResponse.json({
        status: 'not_registered',
        message: 'This domain is not registered. Please register it first.',
      })
    }

    if (hostname.status === 'active' && hostname.ssl.status === 'active') {
      return NextResponse.json({
        status: 'active',
        message: 'Domain verified. SSL is active. Your custom domain is live.',
        ssl: hostname.ssl,
      })
    }

    if (hostname.status === 'pending' || hostname.ssl.status === 'pending_validation') {
      return NextResponse.json({
        status: 'pending',
        message: 'Waiting for DNS propagation and SSL verification.',
        ssl: hostname.ssl,
        ownershipVerification: hostname.ownershipVerification,
      })
    }

    return NextResponse.json({
      status: 'pending',
      message: `Domain status: ${hostname.status}, SSL: ${hostname.ssl.status}`,
      ssl: hostname.ssl,
      ownershipVerification: hostname.ownershipVerification,
      verificationErrors: hostname.verificationErrors,
    })
  }

  // Fallback: DNS lookup for self-hosted mode
  try {
    const records = await dns.resolveCname(cleanDomain)
    const appHost = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')
      .replace(/^https?:\/\//, '')
      .split(':')[0]

    const isValid = records.some((record) => {
      const normalized = record.replace(/\.$/, '').toLowerCase()
      return normalized === appHost || normalized.endsWith(`.${appHost}`)
    })

    if (isValid) {
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
