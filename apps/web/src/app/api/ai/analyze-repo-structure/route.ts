import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-api'
import { prisma } from '@/lib/db'
import { redis } from '@/lib/redis'
import { resolveProvider } from '@/lib/ai/resolve-provider'

// Lower limit than generate-article: each call makes a 4096-token LLM request
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour

async function checkRateLimit(workspaceId: string): Promise<{ limited: boolean }> {
  if (redis) {
    try {
      const slot = Math.floor(Date.now() / RATE_LIMIT_WINDOW_MS)
      const key = `rl:analyze-repo-structure:${workspaceId}:${slot}`
      const count = await redis.incr(key)
      if (count === 1) await redis.pexpire(key, RATE_LIMIT_WINDOW_MS * 2)
      return { limited: count > RATE_LIMIT_MAX }
    } catch {
      // Redis unavailable — fall through to in-memory fallback below
    }
  }
  // In-memory fallback: apply a conservative per-process limit when Redis is down
  const now = Date.now()
  const slot = Math.floor(now / RATE_LIMIT_WINDOW_MS)
  const memKey = `${workspaceId}:${slot}`
  const current = _memFallback.get(memKey) ?? 0
  if (current >= RATE_LIMIT_MAX) return { limited: true }
  _memFallback.set(memKey, current + 1)
  // Prune stale slots to avoid unbounded memory growth
  for (const k of _memFallback.keys()) {
    if (!k.endsWith(`:${slot}`)) _memFallback.delete(k)
  }
  return { limited: false }
}

const _memFallback = new Map<string, number>()

export async function POST(request: Request) {
  // 1. Auth
  const authResult = await requireAuth(request)
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Rate limit
  const rate = await checkRateLimit(authResult.workspaceId)
  if (rate.limited) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Maximum 5 repository analyses per hour per workspace.' },
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

  const { tree, packageJson, readmeExcerpt } = body as {
    tree?: unknown
    packageJson?: unknown
    readmeExcerpt?: unknown
  }

  if (!Array.isArray(tree)) {
    return NextResponse.json({ error: 'tree must be an array of file paths' }, { status: 400 })
  }

  const normalizedTree = tree
    .filter((f): f is string => typeof f === 'string')
    .slice(0, 5000)

  const normalizedPackageJson =
    typeof packageJson === 'string' ? packageJson.slice(0, 1000) : undefined

  const normalizedReadmeExcerpt =
    typeof readmeExcerpt === 'string' ? readmeExcerpt.slice(0, 500) : undefined

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

  // 5. Build prompt
  const system = [
    'You are a software architect analyzing a repository to identify feature domains for knowledge base article generation.',
    '',
    workspace.productContext ? `Product context: ${workspace.productContext}` : '',
    '',
    'Identify 3-15 meaningful feature domains from this codebase.',
    'For each domain, list the most relevant files (max 10 files).',
    '',
    'Rules:',
    '- Focus on user-facing features, not infrastructure or tooling',
    '- Relevant files: API routes, controllers, services, main components, schema/models',
    '- Skip: test files, config files, migration files, lockfiles, generated files, node_modules',
    '- Domain names should be lowercase, hyphenated, descriptive (e.g. "conversations", "article-editor", "auth")',
    '- Each file should appear in at most one domain',
    '- If the repo has a schema file (prisma, SQL, etc.), include it as a "data-model" domain',
    '',
    'Return JSON only, no explanation:',
    '{"domains": {"domain-name": ["path/to/file.ts", ...], ...}}',
  ]
    .filter((line) => line !== undefined)
    .join('\n')
    .trim()

  const userContent = [
    'Repository file tree:',
    normalizedTree.slice(0, 2000).join('\n'),
    '',
    normalizedPackageJson ? `package.json:\n${normalizedPackageJson}` : '',
    '',
    normalizedReadmeExcerpt ? `README excerpt:\n${normalizedReadmeExcerpt}` : '',
    '',
    'Identify the feature domains.',
  ]
    .join('\n')
    .trim()

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
    console.error('[analyze-repo-structure] LLM call failed:', message)
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
    console.error('[analyze-repo-structure] Failed to parse LLM response:', cleaned.slice(0, 200))
    return NextResponse.json(
      { error: 'Failed to parse LLM response as JSON', raw: cleaned.slice(0, 200) },
      { status: 500 },
    )
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).domains !== 'object' ||
    (parsed as Record<string, unknown>).domains === null ||
    Array.isArray((parsed as Record<string, unknown>).domains)
  ) {
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

  // 8. Return domains
  return NextResponse.json({ domains })
}
