import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-api'
import { prisma } from '@/lib/db'
import { redis } from '@/lib/redis'
import { resolveProvider } from '@/lib/ai/resolve-provider'

// Shares the same per-workspace rate limit as generate-article (aiDraftRateLimit)
const DEFAULT_RATE_LIMIT = 50
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour

const _memFallback = new Map<string, number>()

async function checkRateLimit(workspaceId: string, max: number): Promise<{ limited: boolean }> {
  if (max <= 0) return { limited: false }
  if (redis) {
    try {
      const slot = Math.floor(Date.now() / RATE_LIMIT_WINDOW_MS)
      // Shared key with generate-article so both count toward the same limit
      const key = `rl:generate-article:${workspaceId}:${slot}`
      const count = await redis.incr(key)
      if (count === 1) await redis.pexpire(key, RATE_LIMIT_WINDOW_MS * 2)
      return { limited: count > max }
    } catch {
      // Redis unavailable — fall through to in-memory fallback below
    }
  }
  const now = Date.now()
  const slot = Math.floor(now / RATE_LIMIT_WINDOW_MS)
  const memKey = `${workspaceId}:${slot}`
  const current = _memFallback.get(memKey) ?? 0
  if (current >= max) return { limited: true }
  _memFallback.set(memKey, current + 1)
  for (const k of _memFallback.keys()) {
    if (!k.endsWith(`:${slot}`)) _memFallback.delete(k)
  }
  if (_memFallback.size > 1000) _memFallback.clear()
  return { limited: false }
}

export async function POST(request: Request) {
  // 1. Auth
  const authResult = await requireAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Rate limit (shares budget with generate-article)
  const rate = await checkRateLimit(authResult.workspaceId, DEFAULT_RATE_LIMIT)
  if (rate.limited) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Maximum ${DEFAULT_RATE_LIMIT} AI operations per hour per workspace.` },
      { status: 429 },
    )
  }

  // 2. Parse + validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { tree, packageJson, topic, topics, fileContents, remainingRounds } = body as {
    tree?: unknown
    packageJson?: unknown
    topic?: unknown
    topics?: unknown
    fileContents?: unknown
    remainingRounds?: unknown
  }

  const normalizedRemainingRounds =
    typeof remainingRounds === 'number' && remainingRounds >= 0 ? Math.floor(remainingRounds) : 0

  const normalizedFileContents: Array<{ path: string; content: string }> =
    Array.isArray(fileContents)
      ? fileContents
          .filter(
            (f): f is { path: string; content: string } =>
              typeof f === 'object' &&
              f !== null &&
              typeof (f as Record<string, unknown>).path === 'string' &&
              typeof (f as Record<string, unknown>).content === 'string',
          )
          .slice(0, 60)
          .map((f) => ({ path: f.path, content: f.content.slice(0, 1000000) }))
      : []

  if (!Array.isArray(tree)) {
    return NextResponse.json({ error: 'tree must be an array of file paths' }, { status: 400 })
  }

  const normalizedTree = tree
    .filter((f): f is string => typeof f === 'string')
    .slice(0, 5000)

  const normalizedPackageJson =
    typeof packageJson === 'string' ? packageJson.slice(0, 1000) : undefined

  // Mode detection
  const singleTopic = typeof topic === 'string' && topic.trim().length > 0
    ? topic.trim().slice(0, 500)
    : undefined

  const multiTopics = Array.isArray(topics)
    ? topics.filter((t): t is string => typeof t === 'string' && t.trim().length > 0).slice(0, 50)
    : []

  // 3. Fetch workspace
  const workspace = await prisma.workspace.findUnique({
    where: { id: authResult.workspaceId },
    select: {
      autoDraftExternalEnabled: true,
      aiEnabled: true,
      aiProvider: true,
      aiApiKey: true,
      aiModel: true,
      productContext: true,
    },
  })

  // 4. Auth gates
  if (!workspace?.aiEnabled) {
    return NextResponse.json({ error: 'AI is not enabled for this workspace' }, { status: 403 })
  }

  if (authResult.via === 'apikey' && !workspace.autoDraftExternalEnabled) {
    return NextResponse.json(
      { error: 'External API drafting is disabled for this workspace' },
      { status: 403 },
    )
  }

  // 5. Build prompt based on mode
  let system: string
  let userContent: string

  if (singleTopic !== undefined) {
    // Single topic mode
    system = [
      'You are a technical writer identifying which source files are most relevant for writing a customer-facing help center article about a specific topic.',
      'The final article will be read by end-users and customers — not developers. It explains what users can do and how, not how the code works internally.',
      '',
      workspace.productContext ? `Product context: ${workspace.productContext}` : '',
      '',
      'Rules:',
      '- Return 5-10 files where the topic is the PRIMARY subject of that file',
      '- Prioritise the interface layer (UI components, screens, pages) — these show what users actually see and do',
      '- Also include logic-layer files (handlers, controllers, services, models) only when needed to understand the available capabilities',
      '- Include client-layer files (SDK modules, API clients) when end-users interact with those directly',
      '- Sibling directory rule: when you identify a logic-layer file, also check for interface-layer files in parallel directories for the same resource. Pattern varies by stack — MVC: controllers/articles → views/articles; Next.js: app/api/articles → app/(ui)/articles; Go: handlers/articles.go → templates/articles/; React SPA: services/articles.ts → components/Articles/. The UI file often shares the resource name but not the action name.',
      '- Skip: files that merely use or depend on the topic as a secondary concern',
      '- Skip: test files, config files, migration files, lockfiles, generated files',
      '- Skip: internal infrastructure files that are invisible to end-users',
      normalizedRemainingRounds > 0
        ? `- You have ${normalizedRemainingRounds} more round(s) available after this one. Set "needsMore" to true if reading more file contents would improve the selection — e.g. the current files reference other files that seem relevant but haven't been read yet. Set to false only when you are confident the selection is complete.`
        : '- This is the final round. Set "needsMore" to false.',
      '',
      'Return JSON only, no explanation:',
      '{"files": ["path/to/file", ...], "needsMore": false}',
    ]
      .filter((line) => line !== undefined)
      .join('\n')
      .trim()

    userContent = [
      'Repository file tree:',
      normalizedTree.slice(0, 2000).join('\n'),
      '',
      normalizedPackageJson ? `package.json:\n${normalizedPackageJson}` : '',
      '',
      `Topic: "${singleTopic}"`,
      '',
      'Identify the files most relevant to this topic. The goal is a customer-facing help article — prioritise files that reveal what users can see and do:',
      '- Interface layer (highest priority): views, screens, templates, UI components, pages that users interact with',
      '- Logic layer (include when needed to understand capabilities): handlers, controllers, services, models, repositories',
      '- Client layer (include when end-users use these directly): SDK modules, API clients',
      'A customer help article documents user workflows, not internal code architecture.',
      '',
      normalizedFileContents.length > 0
        ? [
            'File contents from previous round:',
            '',
            ...normalizedFileContents.map((f) => `// ${f.path}\n${f.content}`),
            '',
            'Review these contents and update your file selection. For each logic-layer file already selected, look in the file tree for interface-layer files in parallel directories for the same resource. Pattern varies by stack — MVC: controllers/articles → views/articles; Next.js: app/api/articles → app/(ui)/articles; Go: handlers/articles.go → templates/articles/; React SPA: services/articles.ts → components/Articles/. The UI file often shares the resource name but not the action name — add it if present. Also check for client-layer files (SDK modules, API clients).',
          ].join('\n')
        : '',
    ]
      .join('\n')
      .trim()
  } else if (multiTopics.length > 0) {
    // Multi-topic mode
    system = [
      'You are a technical writer identifying which source files are most relevant for writing customer-facing help center articles about a list of topics.',
      'The final articles will be read by end-users and customers — not developers. They explain what users can do and how, not how the code works internally.',
      '',
      workspace.productContext ? `Product context: ${workspace.productContext}` : '',
      '',
      'Rules:',
      '- For each topic, return 5-10 files where that topic is the PRIMARY subject of the file',
      '- Prioritise interface-layer files (views, screens, UI components, pages) — these show what users see and do',
      '- Include logic-layer files (handlers, controllers, services, models) only when needed to understand the available capabilities',
      '- Include client-layer files (SDK modules, API clients) when end-users interact with them directly',
      '- Skip: files that merely use or depend on the topic as a secondary concern',
      '- Skip: test files, config files, migration files, lockfiles, generated files, internal infrastructure',
      '- A file may appear under multiple topics if genuinely relevant to both',
      normalizedRemainingRounds > 0
        ? `- You have ${normalizedRemainingRounds} more round(s) available after this one. Set "needsMore" to true if reading more file contents would improve the per-topic selections — e.g. files that reference other relevant files not yet read. Set to false only when all topic selections are complete.`
        : '- This is the final round. Set "needsMore" to false.',
      '',
      'Return JSON only, no explanation:',
      '{"topicFiles": {"topic name": ["path/to/file", ...], ...}, "needsMore": false}',
    ]
      .filter((line) => line !== undefined)
      .join('\n')
      .trim()

    userContent = [
      'Repository file tree:',
      normalizedTree.slice(0, 2000).join('\n'),
      '',
      normalizedPackageJson ? `package.json:\n${normalizedPackageJson}` : '',
      '',
      'Topics:',
      multiTopics.map((t) => `- ${t}`).join('\n'),
      '',
      'For each topic, identify files that will help write a customer-facing help article. Prioritise interface-layer files (what users see and do), then logic-layer files (to understand capabilities), then client-layer files (SDK, API clients used directly by end-users).',
      '',
      normalizedFileContents.length > 0
        ? [
            'File contents from previous round:',
            '',
            ...normalizedFileContents.map((f) => `// ${f.path}\n${f.content}`),
            '',
            'Review these contents and refine your per-topic selections. For each logic-layer file already selected, look in the file tree for interface-layer files in parallel directories for the same resource. Pattern varies by stack — MVC: controllers/articles → views/articles; Next.js: app/api/articles → app/(ui)/articles; Go: handlers/articles.go → templates/articles/; React SPA: services/articles.ts → components/Articles/. Also check for missing client-layer files (SDK modules, API clients) for any topic.',
          ].join('\n')
        : '',
    ]
      .join('\n')
      .trim()
  } else {
    // Domain analysis mode (existing behavior)
    system = [
      'You are a technical writer analyzing a repository to identify feature domains for customer-facing help center article generation.',
      'The goal is to find domains that correspond to features end-users can actually use — not internal infrastructure or developer tooling.',
      '',
      workspace.productContext ? `Product context: ${workspace.productContext}` : '',
      '',
      'Identify 3-15 meaningful feature domains from this codebase.',
      'For each domain, list the most relevant files (max 10 files).',
      '',
      'Rules:',
      '- Focus exclusively on user-facing features — what customers can see and do in the product',
      '- Prioritise interface-layer files (views, screens, UI components, pages); include logic-layer files (handlers, controllers, services, models) to understand capabilities',
      '- Skip: internal infrastructure, deployment tooling, CI/CD, test files, config files, migration files, lockfiles, generated files, node_modules',
      '- Domain names should be lowercase, hyphenated, descriptive (e.g. "conversations", "article-editor", "auth")',
      '- Each file should appear in at most one domain',
      '- If the repo has a schema file (prisma, SQL, etc.), include it as a "data-model" domain',
      normalizedRemainingRounds > 0
        ? `- You have ${normalizedRemainingRounds} more round(s) available after this one. Set "needsMore" to true if reading more file contents would improve domain groupings — e.g. files that reference other relevant files not yet read. Set to false only when all domains are correctly identified and grouped.`
        : '- This is the final round. Set "needsMore" to false.',
      '',
      'Return JSON only, no explanation:',
      '{"domains": {"domain-name": ["path/to/file", ...], ...}, "needsMore": false}',
    ]
      .filter((line) => line !== undefined)
      .join('\n')
      .trim()

    userContent = [
      'Repository file tree:',
      normalizedTree.slice(0, 2000).join('\n'),
      '',
      normalizedPackageJson ? `package.json:\n${normalizedPackageJson}` : '',
      '',
      'Identify user-facing feature domains. For each domain, include files that will help write a customer help article: interface layer (views, screens, UI components) first, then logic layer (handlers, services, models) to understand capabilities, then client layer (SDK, API clients) if end-users interact with them directly.',
      '',
      normalizedFileContents.length > 0
        ? [
            'File contents from previous round:',
            '',
            ...normalizedFileContents.map((f) => `// ${f.path}\n${f.content}`),
            '',
            'Review these contents and correct your domain groupings: reassign files to the right domain, add any missing domains, and remove any incorrectly grouped files.',
          ].join('\n')
        : '',
    ]
      .join('\n')
      .trim()
  }

  // 6. LLM call
  const provider = resolveProvider({
    aiProvider: workspace.aiProvider as string | null,
    aiApiKey: workspace.aiApiKey,
    aiModel: workspace.aiModel,
  })

  let raw = ''
  try {
    for await (const event of provider.streamChat({
      system,
      messages: [{ role: 'user', content: userContent }],
      maxTokens: 4096,
    })) {
      if (event.type === 'text') raw += event.text
      if (event.type === 'error') throw new Error(event.message)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const mode = singleTopic !== undefined ? 'topic' : multiTopics.length > 0 ? 'topics' : 'domains'
    console.error(`[analyze-repo-structure:${mode}] LLM call failed:`, message)
    return NextResponse.json(
      { error: `LLM call failed: ${message}` },
      { status: 500 },
    )
  }

  // 7. Parse + validate response
  const cleaned = raw
    .replace(/^```json?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    const mode = singleTopic !== undefined ? 'topic' : multiTopics.length > 0 ? 'topics' : 'domains'
    console.error(`[analyze-repo-structure:${mode}] Failed to parse LLM response:`, cleaned.slice(0, 200))
    return NextResponse.json(
      { error: 'Failed to parse LLM response as JSON', raw: cleaned.slice(0, 200) },
      { status: 500 },
    )
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return NextResponse.json(
      { error: 'Failed to analyze repository structure' },
      { status: 500 },
    )
  }

  // 8. Mode-specific response parsing and return
  if (singleTopic !== undefined) {
    // Single topic mode
    const p = parsed as Record<string, unknown>
    if (!Array.isArray(p.files)) {
      console.error('[analyze-repo-structure:topic] Response missing files array:', cleaned.slice(0, 200))
      return NextResponse.json({ error: 'Failed to analyze repository structure' }, { status: 500 })
    }

    const p2 = parsed as { files?: unknown[]; needsMore?: unknown }
    const files = (Array.isArray(p2.files) ? p2.files : [])
      .filter((f): f is string => typeof f === 'string')
      .slice(0, 15)
    const needsMore = p2.needsMore === true

    return NextResponse.json({ files, needsMore })
  }

  if (multiTopics.length > 0) {
    // Multi-topic mode
    const p = parsed as Record<string, unknown>
    if (typeof p.topicFiles !== 'object' || p.topicFiles === null || Array.isArray(p.topicFiles)) {
      console.error('[analyze-repo-structure:topics] Response missing topicFiles object:', cleaned.slice(0, 200))
      return NextResponse.json({ error: 'Failed to analyze repository structure' }, { status: 500 })
    }

    const rawTopicFiles = (parsed as { topicFiles: Record<string, unknown> }).topicFiles
    const topicFiles: Record<string, string[]> = {}
    for (const [t, fs] of Object.entries(rawTopicFiles).slice(0, 50)) {
      if (!Array.isArray(fs)) continue
      topicFiles[t] = fs.filter((f): f is string => typeof f === 'string').slice(0, 10)
    }
    const needsMoreTopics = (parsed as { needsMore?: unknown }).needsMore === true

    return NextResponse.json({ topicFiles, needsMore: needsMoreTopics })
  }

  // Domain mode (existing)
  if (
    typeof (parsed as Record<string, unknown>).domains !== 'object' ||
    (parsed as Record<string, unknown>).domains === null ||
    Array.isArray((parsed as Record<string, unknown>).domains)
  ) {
    console.error('[analyze-repo-structure:domains] Response missing domains object:', cleaned.slice(0, 200))
    return NextResponse.json(
      { error: 'Failed to analyze repository structure' },
      { status: 500 },
    )
  }

  const rawDomains = (parsed as { domains: Record<string, unknown> }).domains

  // Cap at 20 domains, ensure each value is a string array capped at 10 files
  const domains: Record<string, string[]> = {}
  for (const [name, files] of Object.entries(rawDomains).slice(0, 20)) {
    if (!Array.isArray(files)) continue
    const validFiles = files
      .filter((f): f is string => typeof f === 'string')
      .slice(0, 10)
    domains[name] = validFiles
  }

  const needsMoreDomains = (parsed as { needsMore?: unknown }).needsMore === true

  // 8. Return domains
  return NextResponse.json({ domains, needsMore: needsMoreDomains })
}
