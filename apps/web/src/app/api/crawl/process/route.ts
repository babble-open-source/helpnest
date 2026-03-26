import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { redis } from '@/lib/redis'
import { resolveProvider } from '@/lib/ai/resolve-provider'
import { uniqueCollectionSlug, uniqueArticleSlug } from '@/lib/unique-slug'
import {
  fetchPage,
  extractContent,
  analyzeContent,
  detectLoginWall,
  buildGoalPrompt,
  parseArticleResponse,
} from '@helpnest/crawler'
import { checkArticleSimilarity } from '@/lib/crawl-similarity'

const MAX_CONCURRENT_WORKERS = 3
const DELAY_BETWEEN_PAGES_MS = 2000
const MAX_CONSECUTIVE_FAILURES = 5
const MAX_AI_CONTENT_LENGTH = 16000

export async function POST(request: Request) {
  // Auth: internal secret or admin session
  const internalSecret = request.headers.get('x-internal-secret')
  const isInternal = internalSecret && internalSecret === process.env.INTERNAL_SECRET

  if (!isInternal) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!redis) {
    return NextResponse.json({ error: 'Redis not configured' }, { status: 503 })
  }

  // Find pending crawl jobs in Redis
  const keys = await redis.keys('crawl-job:*')
  if (keys.length === 0) {
    return NextResponse.json({ processed: 0, message: 'No pending jobs' })
  }

  // Check global concurrency
  const activeLocks = await redis.keys('crawl-lock:*')
  if (activeLocks.length >= MAX_CONCURRENT_WORKERS) {
    return NextResponse.json({ processed: 0, message: 'Max concurrent workers reached' })
  }

  let totalProcessed = 0

  for (const key of keys) {
    const jobData = await redis.get(key)
    if (!jobData) continue

    const { crawlJobId, workspaceId } = JSON.parse(jobData)

    // Try to acquire lock
    const lockKey = `crawl-lock:${crawlJobId}`
    const lockAcquired = await redis.set(lockKey, '1', 'EX', 600, 'NX') // 10 min TTL
    if (!lockAcquired) continue // Another worker has this job

    try {
      await processDeepCrawlJob(crawlJobId, workspaceId, lockKey)
      totalProcessed++
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await prisma.crawlJob.update({
        where: { id: crawlJobId },
        data: { status: 'FAILED', error: message, completedAt: new Date() },
      }).catch(() => {})
    } finally {
      // Clean up
      await redis.del(key).catch(() => {})
      await redis.del(lockKey).catch(() => {})
    }
  }

  return NextResponse.json({ processed: totalProcessed })
}

async function processDeepCrawlJob(
  crawlJobId: string,
  workspaceId: string,
  lockKey: string,
): Promise<void> {
  const crawlJob = await prisma.crawlJob.findUnique({
    where: { id: crawlJobId },
    include: {
      pages: { where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' } },
      workspace: { select: { name: true, aiProvider: true, aiApiKey: true, aiModel: true } },
    },
  })

  if (!crawlJob || crawlJob.status !== 'CRAWLING') return
  if (!crawlJob.workspace) return

  const provider = resolveProvider({
    aiProvider: crawlJob.workspace.aiProvider,
    aiApiKey: crawlJob.workspace.aiApiKey,
    aiModel: crawlJob.workspace.aiModel,
  })

  const existingCollections = await prisma.collection.findMany({
    where: { workspaceId },
    select: { id: true, title: true },
  })

  // Track generated article titles for series context
  const generatedTitles: string[] = []
  let consecutiveFailures = 0
  let articlesCreated = 0

  for (let i = 0; i < crawlJob.pages.length; i++) {
    const page = crawlJob.pages[i]!

    // Refresh lock TTL
    if (redis) await redis.expire(lockKey, 600)

    try {
      // Fetch page
      const fetchResult = await fetchPage(page.url)
      if (fetchResult.error || !fetchResult.html) {
        await prisma.crawlPage.update({
          where: { id: page.id },
          data: { status: 'FAILED', skipReason: fetchResult.error ?? 'No HTML returned' },
        })
        consecutiveFailures++
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          await prisma.crawlJob.update({
            where: { id: crawlJobId },
            data: { status: 'FAILED', error: 'Too many consecutive failures', completedAt: new Date() },
          })
          return
        }
        continue
      }

      consecutiveFailures = 0

      // Detect login wall
      if (detectLoginWall(fetchResult.html, page.url)) {
        await prisma.crawlPage.update({
          where: { id: page.id },
          data: { status: 'SKIPPED', skipReason: 'Authentication required' },
        })
        await updateJobProgress(crawlJobId, articlesCreated)
        continue
      }

      // Extract content
      const extracted = extractContent(fetchResult.html, page.url)
      const analysis = analyzeContent(extracted.markdown, page.url)

      if (analysis.tooShort) {
        await prisma.crawlPage.update({
          where: { id: page.id },
          data: { status: 'SKIPPED', skipReason: 'Content too short' },
        })
        await updateJobProgress(crawlJobId, articlesCreated)
        continue
      }

      // Truncate for AI
      const truncated = extracted.markdown.length > MAX_AI_CONTENT_LENGTH
        ? extracted.markdown.slice(0, MAX_AI_CONTENT_LENGTH)
        : extracted.markdown

      // Generate article with goal + series context
      const prompt = buildGoalPrompt({
        markdown: truncated,
        title: extracted.title,
        url: page.url,
        contentType: analysis.contentType as 'marketing' | 'docs' | 'app-ui' | 'other',
        workspaceName: crawlJob.workspace.name,
        existingCollections: existingCollections.map((c) => c.title),
        goal: crawlJob.goalPrompt,
        seriesContext: crawlJob.pages.length > 1
          ? {
              articleNumber: i + 1,
              totalArticles: crawlJob.pages.length,
              previousTitles: generatedTitles,
            }
          : undefined,
      })

      let aiResponse = ''
      for await (const event of provider.streamChat({
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.userMessage }],
        maxTokens: 4096,
      })) {
        if (event.type === 'text') aiResponse += event.text
        if (event.type === 'error') throw new Error(event.message)
      }

      const draft = parseArticleResponse(aiResponse)

      // Embedding similarity check
      const similarity = await checkArticleSimilarity(draft.content, workspaceId)
      if (similarity.isDuplicate) {
        await prisma.crawlPage.update({
          where: { id: page.id },
          data: {
            status: 'SKIPPED',
            skipReason: `Similar article exists: ${similarity.similarArticleTitle}`,
            similarArticleId: similarity.similarArticleId,
          },
        })
        await updateJobProgress(crawlJobId, articlesCreated)
        continue
      }

      // Resolve collection
      let collectionId: string | null = null
      if (draft.suggestedCollection) {
        const match = existingCollections.find(
          (c) => c.title.toLowerCase() === draft.suggestedCollection!.toLowerCase()
        )
        if (match) {
          collectionId = match.id
        } else {
          const slug = await uniqueCollectionSlug(draft.suggestedCollection, workspaceId)
          const newCol = await prisma.collection.create({
            data: { workspaceId, title: draft.suggestedCollection, slug },
          })
          collectionId = newCol.id
          existingCollections.push({ id: newCol.id, title: draft.suggestedCollection })
        }
      }
      if (!collectionId) {
        const fallback = existingCollections[0]
        if (fallback) {
          collectionId = fallback.id
        } else {
          const slug = await uniqueCollectionSlug('Help Articles', workspaceId)
          const newCol = await prisma.collection.create({
            data: { workspaceId, title: 'Help Articles', slug },
          })
          collectionId = newCol.id
          existingCollections.push({ id: newCol.id, title: 'Help Articles' })
        }
      }

      // Create article
      const articleSlug = await uniqueArticleSlug(draft.title, workspaceId)
      const article = await prisma.article.create({
        data: {
          workspaceId,
          collectionId,
          authorId: crawlJob.userId,
          title: draft.title,
          slug: articleSlug,
          content: draft.content,
          excerpt: draft.excerpt || undefined,
          status: 'DRAFT',
          aiGenerated: true,
          aiPrompt: prompt.userMessage,
        },
      })

      // Update CrawlPage
      await prisma.crawlPage.update({
        where: { id: page.id },
        data: {
          status: 'GENERATED',
          articleId: article.id,
          contentType: analysis.contentType,
          rawContent: null,
          ...(similarity.isSuspicious ? { similarArticleId: similarity.similarArticleId } : {}),
        },
      })

      generatedTitles.push(draft.title)
      articlesCreated++
      await updateJobProgress(crawlJobId, articlesCreated)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await prisma.crawlPage.update({
        where: { id: page.id },
        data: { status: 'FAILED', skipReason: message },
      }).catch(() => {})
      consecutiveFailures++
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        await prisma.crawlJob.update({
          where: { id: crawlJobId },
          data: { status: 'FAILED', error: 'Too many consecutive failures', completedAt: new Date() },
        })
        return
      }
    }

    // Delay between pages
    if (i < crawlJob.pages.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_PAGES_MS))
    }
  }

  // Mark job completed
  await prisma.crawlJob.update({
    where: { id: crawlJobId },
    data: { status: 'COMPLETED', articlesCreated, completedAt: new Date() },
  })
}

async function updateJobProgress(crawlJobId: string, articlesCreated: number): Promise<void> {
  await prisma.crawlJob.update({
    where: { id: crawlJobId },
    data: { processedPages: { increment: 1 }, articlesCreated },
  })
}
