import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-api'
import { prisma } from '@/lib/db'
import { redis } from '@/lib/redis'
import { validateUrl } from '@helpnest/crawler'

export async function POST(request: Request) {
  const auth = await requireAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { workspaceId } = auth
  const body = (await request.json()) as {
    crawlJobId: string
    approvedUrls: string[]
  }

  if (!body.crawlJobId) return NextResponse.json({ error: 'crawlJobId is required' }, { status: 400 })
  if (!body.approvedUrls?.length) return NextResponse.json({ error: 'approvedUrls must not be empty' }, { status: 400 })

  const crawlJob = await prisma.crawlJob.findFirst({
    where: { id: body.crawlJobId, workspaceId, status: 'PENDING' },
  })
  if (!crawlJob) return NextResponse.json({ error: 'Crawl job not found or not pending' }, { status: 404 })

  // Issue 5: Domain verification enforcement
  const jobDomain = new URL(crawlJob.sourceUrl).hostname
  const verification = await prisma.domainVerification.findUnique({
    where: { workspaceId_domain: { workspaceId, domain: jobDomain } },
  })
  if (!verification?.verifiedAt) {
    return NextResponse.json({ error: 'Domain must be verified before starting deep crawl' }, { status: 403 })
  }

  // Issue 3: Filter approved URLs to only those passing SSRF validation and present in discoveredUrls
  const discoveredUrls = crawlJob.discoveredUrls as string[] | null
  const validatedUrls = body.approvedUrls.filter((u) => {
    const check = validateUrl(u)
    if (!check.valid) return false
    if (discoveredUrls && discoveredUrls.length > 0 && !discoveredUrls.includes(u)) return false
    return true
  })

  if (validatedUrls.length === 0) {
    return NextResponse.json({ error: 'No valid approved URLs after validation' }, { status: 400 })
  }

  const activeCrawl = await prisma.crawlJob.findFirst({
    where: { workspaceId, mode: 'DEEP', status: { in: ['CRAWLING', 'EXTRACTING', 'GENERATING'] } },
  })
  if (activeCrawl) {
    return NextResponse.json(
      { error: 'Another deep crawl is already running for this workspace. Wait for it to complete.' },
      { status: 409 },
    )
  }

  const urls = validatedUrls.slice(0, 50)

  await prisma.crawlPage.createMany({
    data: urls.map((url) => ({
      crawlJobId: body.crawlJobId,
      url,
      status: 'PENDING' as const,
    })),
  })

  await prisma.crawlJob.update({
    where: { id: body.crawlJobId },
    data: { status: 'CRAWLING', approvedUrls: urls, totalPages: urls.length },
  })

  if (redis) {
    await redis.set(`crawl-job:${body.crawlJobId}`, JSON.stringify({
      crawlJobId: body.crawlJobId,
      workspaceId,
      queuedAt: Date.now(),
    }), 'EX', 86400)
  }

  return NextResponse.json({ crawlJobId: body.crawlJobId, totalPages: urls.length, status: 'CRAWLING' })
}
