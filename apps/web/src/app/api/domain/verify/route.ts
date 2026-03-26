import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-api'
import { prisma } from '@/lib/db'
import { randomBytes } from 'crypto'
import { validateUrl } from '@helpnest/crawler'

export async function POST(request: Request) {
  const auth = await requireAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (auth.via === 'session' && auth.userId) {
    const member = await prisma.member.findFirst({
      where: {
        userId: auth.userId,
        workspaceId: auth.workspaceId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    })
    if (!member) return NextResponse.json({ error: 'Only owners and admins can verify domains' }, { status: 403 })
  }

  const { workspaceId } = auth
  const body = (await request.json()) as {
    action: 'initiate' | 'check'
    domain: string
  }

  const domain = body.domain?.trim().toLowerCase()
  if (!domain) return NextResponse.json({ error: 'Domain is required' }, { status: 400 })

  if (body.action === 'initiate') {
    const existing = await prisma.domainVerification.findUnique({
      where: { workspaceId_domain: { workspaceId, domain } },
    })

    if (existing?.verifiedAt) {
      return NextResponse.json({ verified: true, domain })
    }

    const token = existing?.token ?? randomBytes(16).toString('hex')

    await prisma.domainVerification.upsert({
      where: { workspaceId_domain: { workspaceId, domain } },
      create: { workspaceId, domain, method: 'META_TAG', token },
      update: { token },
    })

    return NextResponse.json({
      verified: false,
      domain,
      token,
      instructions: `Add this meta tag to your site's <head>: <meta name="helpnest-verify" content="${token}">`,
    })
  }

  if (body.action === 'check') {
    const record = await prisma.domainVerification.findUnique({
      where: { workspaceId_domain: { workspaceId, domain } },
    })

    if (!record) return NextResponse.json({ error: 'Initiate verification first' }, { status: 400 })
    if (record.verifiedAt) return NextResponse.json({ verified: true, domain })

    try {
      const domainUrl = `https://${domain}`
      const domainCheck = validateUrl(domainUrl)
      if (!domainCheck.valid) {
        return NextResponse.json({ verified: false, error: 'Invalid domain' }, { status: 400 })
      }

      const res = await fetch(domainUrl, {
        signal: AbortSignal.timeout(10000),
        headers: { 'User-Agent': 'HelpNestBot/1.0 (+https://helpnest.cloud/bot)' },
      })
      if (!res.ok) {
        return NextResponse.json({ verified: false, error: `Site returned HTTP ${res.status}` })
      }

      const html = await res.text()
      const match = html.match(/<meta\s+name=["']helpnest-verify["']\s+content=["']([^"']+)["']/i)
      const metaContent = match?.[1] ?? null

      if (metaContent === record.token) {
        await prisma.domainVerification.update({
          where: { id: record.id },
          data: { verifiedAt: new Date() },
        })
        return NextResponse.json({ verified: true, domain })
      }

      return NextResponse.json({
        verified: false,
        error: 'Meta tag not found or token mismatch. Make sure the tag is in your <head>.',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ verified: false, error: `Could not reach ${domain}: ${message}` })
    }
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
