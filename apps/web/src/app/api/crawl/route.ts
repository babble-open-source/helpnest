import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-api'
import { prisma } from '@/lib/db'
import { uniqueCollectionSlug, uniqueArticleSlug } from '@/lib/unique-slug'
import { resolveProvider } from '@/lib/ai/resolve-provider'
import { checkArticleSimilarity } from '@/lib/crawl-similarity'
import { checkAiCredits, incrementAiCredits } from '@/lib/ai-credits'
import {
  validateUrl,
  fetchPage,
  extractContent,
  analyzeContent,
  discoverLinks,
  buildLinkFilterPrompt,
  parseLinkFilterResponse,
  detectLoginWall,
  buildGoalPrompt,
  parseArticleResponse,
} from '@helpnest/crawler'

export async function POST(request: Request) {
  // 1. Auth check
  const auth = await requireAuth(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (auth.via === 'session' && auth.userId) {
    const member = await prisma.member.findFirst({
      where: {
        userId: auth.userId,
        workspaceId: auth.workspaceId,
        role: { in: ['OWNER', 'ADMIN', 'EDITOR'] },
      },
    })
    if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { workspaceId, userId } = auth

  // Resolve authorId (API key auth may not carry userId)
  let authorId = userId
  if (!authorId) {
    const member = await prisma.member.findFirst({
      where: { workspaceId },
      select: { userId: true },
      orderBy: { id: 'asc' },
    })
    if (!member) return NextResponse.json({ error: 'No workspace member found' }, { status: 500 })
    authorId = member.userId
  }

  const body = await request.json() as {
    url?: string
    goal?: string
    collectionId?: string
  }

  // 2. Validate goal and URL
  const goal = body.goal?.trim()
  if (!goal) return NextResponse.json({ error: 'Goal prompt is required' }, { status: 400 })

  const rawUrl = body.url?.trim()
  if (!rawUrl) return NextResponse.json({ error: 'URL is required' }, { status: 400 })

  const validation = validateUrl(rawUrl)
  if (!validation.valid || !validation.url) {
    return NextResponse.json({ error: validation.error ?? 'Invalid URL' }, { status: 400 })
  }
  const url = validation.url

  // Rate limit: max 20 crawls per workspace per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const recentCrawls = await prisma.crawlJob.count({
    where: { workspaceId, createdAt: { gte: oneHourAgo } },
  })
  if (recentCrawls >= 20) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Max 20 crawls per hour per workspace.' },
      { status: 429 },
    )
  }

  // Check AI credits
  const credits = await checkAiCredits(workspaceId)
  if (!credits.allowed) {
    return NextResponse.json({
      error: 'AI credits exhausted. Configure your own AI key in workspace settings or upgrade your plan.',
      credits: { used: credits.used, limit: credits.limit, remaining: 0 },
    }, { status: 402 })
  }

  // 3. Get workspace AI settings
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      name: true,
      aiProvider: true,
      aiApiKey: true,
      aiModel: true,
    },
  })
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  let provider
  try {
    provider = resolveProvider({
      aiProvider: workspace.aiProvider,
      aiApiKey: workspace.aiApiKey,
      aiModel: workspace.aiModel,
    })
  } catch {
    return NextResponse.json(
      { error: 'No AI provider configured. Set up an AI provider in workspace settings.' },
      { status: 422 },
    )
  }

  try {
    // 4. Fetch starting page with Playwright
    const fetchResult = await fetchPage(url)
    if (fetchResult.error || !fetchResult.html) {
      return NextResponse.json(
        { error: `Failed to fetch page: ${fetchResult.error ?? 'No HTML returned'}` },
        { status: 502 },
      )
    }

    const startingHtml = fetchResult.html

    // 5. Discover same-domain links on the page
    const domain = new URL(url).hostname
    const discoveredLinks = discoverLinks(startingHtml, url)

    // 6. Build AI link filter prompt with the goal, send to AI provider
    const filterPrompt = buildLinkFilterPrompt(discoveredLinks, goal, domain)

    let filterResponseText = ''
    for await (const event of provider.streamChat({
      system: filterPrompt.system,
      messages: [{ role: 'user', content: filterPrompt.userMessage }],
      maxTokens: 4096,
    })) {
      if (event.type === 'text') {
        filterResponseText += event.text
      } else if (event.type === 'error') {
        throw new Error(`AI provider error: ${event.message}`)
      }
    }

    // 7. Parse AI response to get filtered links + mode recommendation
    const filterResult = parseLinkFilterResponse(filterResponseText)
    const { mode, selectedLinks } = filterResult

    if (mode === 'focused') {
      // ── FOCUSED MODE (≤5 pages) ──────────────────────────────────────

      // 8. Create CrawlJob
      const crawlJob = await prisma.crawlJob.create({
        data: {
          workspaceId,
          userId: authorId,
          sourceUrl: url,
          goalPrompt: goal,
          mode: 'SINGLE',
          status: 'CRAWLING',
          totalPages: 1 + selectedLinks.length,
        },
      })

      const existingCollections = await prisma.collection.findMany({
        where: { workspaceId },
        select: { title: true },
      })

      const MAX_AI_CONTENT_LENGTH = 16000
      const articles: Array<{
        id: string
        title: string
        slug: string
        collectionId: string | null
        excerpt: string
        confidence: number
      }> = []
      const previousTitles: string[] = []
      let processedPages = 0

      // Build a list of pages to process: starting page first, then selected links
      const pagesToProcess = [
        { url, html: startingHtml },
        ...selectedLinks.map((link) => ({ url: link.url, html: null as string | null })),
      ]

      for (let i = 0; i < pagesToProcess.length; i++) {
        const page = pagesToProcess[i]!
        processedPages++

        try {
          // a. Fetch (skip starting page — already fetched)
          let html = page.html
          if (!html) {
            const result = await fetchPage(page.url)
            if (result.error || !result.html) {
              await prisma.crawlPage.create({
                data: {
                  crawlJobId: crawlJob.id,
                  url: page.url,
                  status: 'FAILED',
                  skipReason: `Fetch failed: ${result.error ?? 'No HTML'}`,
                },
              })
              continue
            }
            html = result.html
          }

          // b. Detect login wall → skip
          if (detectLoginWall(html, page.url)) {
            await prisma.crawlPage.create({
              data: {
                crawlJobId: crawlJob.id,
                url: page.url,
                status: 'SKIPPED',
                skipReason: 'Login wall detected',
              },
            })
            continue
          }

          // c. Extract content
          const extracted = extractContent(html, page.url)

          // d. Analyze content → skip if too short
          const analysis = analyzeContent(extracted.markdown, page.url)
          if (analysis.tooShort) {
            await prisma.crawlPage.create({
              data: {
                crawlJobId: crawlJob.id,
                url: page.url,
                status: 'SKIPPED',
                contentType: analysis.contentType,
                language: analysis.language,
                skipReason: 'Content too short (less than 100 characters)',
              },
            })
            continue
          }

          // e. Truncate to 16k chars
          const truncatedMarkdown = extracted.markdown.length > MAX_AI_CONTENT_LENGTH
            ? extracted.markdown.slice(0, MAX_AI_CONTENT_LENGTH)
            : extracted.markdown

          // f. Build goal-aware prompt with series context
          const prompt = buildGoalPrompt({
            markdown: truncatedMarkdown,
            title: extracted.title,
            url: page.url,
            contentType: analysis.contentType,
            workspaceName: workspace.name,
            existingCollections: existingCollections.map((c) => c.title),
            goal,
            seriesContext: i > 0
              ? {
                  articleNumber: i + 1,
                  totalArticles: pagesToProcess.length,
                  previousTitles,
                }
              : undefined,
          })

          // g. Stream AI response, parse article draft
          let aiResponseText = ''
          for await (const event of provider.streamChat({
            system: prompt.system,
            messages: [{ role: 'user', content: prompt.userMessage }],
            maxTokens: 4096,
          })) {
            if (event.type === 'text') {
              aiResponseText += event.text
            } else if (event.type === 'error') {
              throw new Error(`AI provider error: ${event.message}`)
            }
          }

          const articleDraft = parseArticleResponse(aiResponseText)

          // h. Check embedding similarity → skip if duplicate, flag if suspicious
          const similarity = await checkArticleSimilarity(extracted.markdown, workspaceId)
          if (similarity.isDuplicate) {
            await prisma.crawlPage.create({
              data: {
                crawlJobId: crawlJob.id,
                url: page.url,
                status: 'SKIPPED',
                contentType: analysis.contentType,
                language: analysis.language,
                similarArticleId: similarity.similarArticleId,
                skipReason: `Duplicate content (similarity: ${similarity.score.toFixed(2)})`,
              },
            })
            continue
          }

          // i. Resolve collection
          let collectionId = body.collectionId ?? null

          if (!collectionId && articleDraft.suggestedCollection) {
            const match = await prisma.collection.findFirst({
              where: {
                workspaceId,
                title: { equals: articleDraft.suggestedCollection, mode: 'insensitive' },
              },
            })
            if (match) {
              collectionId = match.id
            } else {
              const colSlug = await uniqueCollectionSlug(articleDraft.suggestedCollection, workspaceId)
              const newCol = await prisma.collection.create({
                data: { workspaceId, title: articleDraft.suggestedCollection, slug: colSlug },
              })
              collectionId = newCol.id
            }
          }

          if (!collectionId) {
            const fallback = await prisma.collection.findFirst({
              where: { workspaceId, slug: 'crawled-pages' },
            })
            if (fallback) {
              collectionId = fallback.id
            } else {
              const colSlug = await uniqueCollectionSlug('Crawled Pages', workspaceId)
              const newCol = await prisma.collection.create({
                data: { workspaceId, title: 'Crawled Pages', slug: colSlug },
              })
              collectionId = newCol.id
            }
          }

          // j. Create Article as DRAFT with aiGenerated=true
          const articleSlug = await uniqueArticleSlug(articleDraft.title, workspaceId)
          const article = await prisma.article.create({
            data: {
              workspaceId,
              collectionId,
              authorId,
              title: articleDraft.title,
              slug: articleSlug,
              content: articleDraft.content,
              excerpt: articleDraft.excerpt,
              status: 'DRAFT',
              aiGenerated: true,
              aiPrompt: prompt.userMessage,
            },
          })

          // k. Create CrawlPage
          await prisma.crawlPage.create({
            data: {
              crawlJobId: crawlJob.id,
              url: page.url,
              status: 'GENERATED',
              contentType: analysis.contentType,
              language: analysis.language,
              articleId: article.id,
              similarArticleId: similarity.isSuspicious ? similarity.similarArticleId : null,
            },
          })

          await incrementAiCredits(workspaceId)

          previousTitles.push(articleDraft.title)
          articles.push({
            id: article.id,
            title: article.title,
            slug: article.slug,
            collectionId: article.collectionId,
            excerpt: articleDraft.excerpt,
            confidence: articleDraft.confidence,
          })
        } catch (pageErr) {
          const pageMessage = pageErr instanceof Error ? pageErr.message : String(pageErr)
          await prisma.crawlPage.create({
            data: {
              crawlJobId: crawlJob.id,
              url: page.url,
              status: 'FAILED',
              skipReason: pageMessage,
            },
          })
        }
      }

      // 10. Update CrawlJob as COMPLETED
      await prisma.crawlJob.update({
        where: { id: crawlJob.id },
        data: {
          status: 'COMPLETED',
          processedPages,
          articlesCreated: articles.length,
          completedAt: new Date(),
        },
      })

      // 11. Return results immediately
      // Re-check credits after generation for the response
      const updatedCredits = await checkAiCredits(workspaceId)
      return NextResponse.json({
        crawlJobId: crawlJob.id,
        mode: 'focused',
        articles,
        totalPages: pagesToProcess.length,
        processedPages,
        articlesCreated: articles.length,
        credits: { used: updatedCredits.used, limit: updatedCredits.limit, remaining: updatedCredits.remaining },
      })
    } else {
      // ── DISCOVERY MODE (>5 pages) ────────────────────────────────────

      // 8. Check domain verification for this domain
      const verification = await prisma.domainVerification.findFirst({
        where: {
          workspaceId,
          domain,
          verifiedAt: { not: null },
        },
      })
      const requiresVerification = !verification

      // 9. Create CrawlJob (mode=DEEP, status=PENDING)
      const crawlJob = await prisma.crawlJob.create({
        data: {
          workspaceId,
          userId: authorId,
          sourceUrl: url,
          goalPrompt: goal,
          mode: 'DEEP',
          status: 'PENDING',
          totalPages: selectedLinks.length + 1,
          discoveredUrls: [url, ...selectedLinks.map((l) => l.url)],
        },
      })

      // 10. Return page list for approval
      return NextResponse.json({
        crawlJobId: crawlJob.id,
        mode: 'discovery',
        pages: selectedLinks,
        totalPages: selectedLinks.length + 1,
        requiresVerification,
      })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: `Crawl failed: ${message}` },
      { status: 500 },
    )
  }
}
