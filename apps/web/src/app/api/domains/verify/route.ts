import { NextResponse } from 'next/server'
import { auth, resolveSessionUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { resolveWorkspaceId } from '@/lib/workspace'
import dns from 'node:dns/promises'

/**
 * POST /api/domains/verify
 * Checks if a custom domain is correctly configured.
 *
 * Supports both:
 * - Direct CNAME (DNS only / gray cloud in Cloudflare)
 * - Proxied CNAME (orange cloud in Cloudflare) — verified via HTTP probe
 *
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
  const appHost = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')
    .replace(/^https?:\/\//, '')
    .split(':')[0]

  // Strategy 1: Check CNAME records (works for non-proxied DNS)
  const cnameResult = await checkCname(cleanDomain, appHost!)
  if (cnameResult === 'valid') {
    await activateDomain(workspaceId, cleanDomain)
    return NextResponse.json({
      status: 'active',
      message: 'Domain verified successfully. Your custom domain is now active.',
    })
  }

  // Strategy 2: HTTP probe — works even with Cloudflare proxy
  // Fetch the domain and check if our app responds
  const httpResult = await checkHttp(cleanDomain)
  if (httpResult === 'valid') {
    await activateDomain(workspaceId, cleanDomain)
    return NextResponse.json({
      status: 'active',
      message: 'Domain verified successfully. Your custom domain is now active.',
    })
  }

  // Strategy 3: Check if domain resolves at all (A/AAAA records)
  const resolves = await checkResolves(cleanDomain)

  if (resolves) {
    return NextResponse.json({
      status: 'pending',
      message: 'Domain resolves but could not verify it points to your help center. DNS may still be propagating — try again in a few minutes.',
    })
  }

  return NextResponse.json({
    status: 'pending',
    message: 'No DNS records found for this domain. Please add the CNAME record and try again.',
  })
}

async function activateDomain(workspaceId: string, domain: string) {
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { customDomain: domain },
  })
}

async function checkCname(domain: string, expectedHost: string): Promise<'valid' | 'invalid' | 'none'> {
  try {
    const records = await dns.resolveCname(domain)
    const isValid = records.some((r) => {
      const normalized = r.replace(/\.$/, '').toLowerCase()
      return normalized === expectedHost || normalized.endsWith(`.${expectedHost}`)
    })
    return isValid ? 'valid' : 'invalid'
  } catch {
    return 'none'
  }
}

async function checkHttp(domain: string): Promise<'valid' | 'invalid'> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(`https://${domain}/api/health`, {
      signal: controller.signal,
      redirect: 'manual',
    })
    clearTimeout(timeout)
    // Our health endpoint returns 200 with a known response
    if (res.ok) {
      const data = await res.json().catch(() => null)
      if (data && (data.status === 'ok' || data.ok === true)) {
        return 'valid'
      }
    }
    return 'invalid'
  } catch {
    return 'invalid'
  }
}

async function checkResolves(domain: string): Promise<boolean> {
  try {
    const addresses = await dns.resolve4(domain)
    return addresses.length > 0
  } catch {
    try {
      const addresses = await dns.resolve6(domain)
      return addresses.length > 0
    } catch {
      return false
    }
  }
}
