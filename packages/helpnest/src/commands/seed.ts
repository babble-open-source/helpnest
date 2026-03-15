import chalk from 'chalk'
import { createHash } from 'crypto'
import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join, relative, resolve, extname, basename } from 'path'
import { walkTree, readFileForContext, readPackageJson, fetchDomains, fetchFilesForTopics, buildCodeBody } from '../utils.js'
import { confirm, confirmFileAccess } from '../prompts.js'

interface SeedOptions {
  repo?: string
  token?: string
  local?: string
  source: string
  apiKey?: string
  baseUrl: string
  limit: string
  from?: string
  delay: string
  collection?: string
  dryRun?: boolean
  topics?: string
  rounds?: string
  yes?: boolean
}

interface SeedItem {
  sourceType: 'readme' | 'docs' | 'release' | 'pr' | 'code' | 'topic'
  label: string
  idempotencyKey: string
  topic?: string
  codeContext?: {
    prTitle: string
    prBody?: string
    diff?: string
    changedFiles?: string[]
    repository?: string
    prUrl?: string
  }
}

interface GitHubPR {
  number: number
  title: string
  body: string | null
  html_url: string
  merged_at: string | null
  state: string
}

interface GitHubFile {
  filename: string
  patch?: string
  status: string
}

interface GitHubRelease {
  tag_name: string
  name: string | null
  body: string | null
  published_at: string | null
  html_url: string
}

interface GitHubTreeEntry {
  name: string
  path: string
  type: 'file' | 'dir' | 'symlink' | 'submodule'
  url: string
  download_url: string | null
}

interface GitHubContentBlob {
  content: string
  encoding: string
}

const LOW_SIGNAL_PREFIXES = ['chore', 'ci', 'deps', 'bump', 'revert', 'merge', 'wip', 'release', 'version']
const SEMVER_RE = /^v?\d+\.\d+\.\d+/

// ---------------------------------------------------------------------------
// Core utilities
// ---------------------------------------------------------------------------

function makeKey(scope: string, type: string, unique: string): string {
  return createHash('sha256').update(`${scope}:${type}:${unique}`).digest('hex').slice(0, 24)
}

function isLowSignalTitle(title: string, body?: string | null): boolean {
  const t = title.toLowerCase().trim()
  if (LOW_SIGNAL_PREFIXES.some((p) => t.startsWith(p))) return true
  if (SEMVER_RE.test(t)) return true
  if (!body?.trim() && t.split(/\s+/).length < 5) return true
  return false
}

function msUntilNextHour(): number {
  return Math.ceil(Date.now() / 3_600_000) * 3_600_000 + 5_000 - Date.now()
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms))
}

function normalizeFromDate(date: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return `${date}T00:00:00Z`
  return date
}

// ---------------------------------------------------------------------------
// README helpers
// ---------------------------------------------------------------------------

function splitReadme(content: string): Array<{ title: string; body: string }> {
  const sections: Array<{ title: string; body: string }> = []

  // Split on H2 headings — the delimiter is "\n## "
  const parts = content.split(/\n(?=## )/)

  for (let i = 0; i < parts.length; i++) {
    let title: string
    let body: string

    if (i === 0) {
      // Content before the first H2 heading is "Overview"
      title = 'Overview'
      // Strip any leading H1 heading from the overview body
      body = parts[0].replace(/^#\s[^\n]*\n?/, '').trim()
    } else {
      const part = parts[i]
      const newlineIdx = part.indexOf('\n')
      if (newlineIdx === -1) {
        title = part.replace(/^##\s*/, '').trim()
        body = ''
      } else {
        title = part.slice(0, newlineIdx).replace(/^##\s*/, '').trim()
        body = part.slice(newlineIdx + 1).trim()
      }
    }

    if (body.length < 100) continue
    sections.push({ title, body: body.slice(0, 2000) })
  }

  return sections
}

function collectReadmeLocal(repoPath: string): SeedItem[] {
  const candidates = ['README.md', 'README.MD', 'readme.md']
  let content: string | null = null

  for (const name of candidates) {
    const fullPath = join(repoPath, name)
    if (existsSync(fullPath)) {
      content = readFileSync(fullPath, 'utf8')
      break
    }
  }

  if (content === null) return []

  const scope = resolve(repoPath)
  const sections = splitReadme(content)

  return sections.map((section) => ({
    sourceType: 'readme',
    label: `README: ${section.title}`,
    idempotencyKey: makeKey(scope, 'readme', section.title),
    codeContext: {
      prTitle: section.title,
      prBody: section.body,
    },
  }))
}

async function collectReadmeGitHub(repo: string, token: string): Promise<SeedItem[]> {
  const candidates = ['README.md', 'readme.md', 'README.MD']
  let content: string | null = null

  for (const name of candidates) {
    const url = `https://api.github.com/repos/${repo}/contents/${name}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' },
    })
    if (res.status === 404) continue
    if (!res.ok) {
      const text = await res.text().catch(() => `HTTP ${res.status}`)
      throw new Error(`GitHub API error fetching ${name}: ${text}`)
    }
    const data = (await res.json()) as GitHubContentBlob
    content = Buffer.from(data.content, 'base64').toString('utf8')
    break
  }

  if (content === null) return []

  const sections = splitReadme(content)

  return sections.map((section) => ({
    sourceType: 'readme',
    label: `README: ${section.title}`,
    idempotencyKey: makeKey(repo, 'readme', section.title),
    codeContext: {
      prTitle: section.title,
      prBody: section.body,
      repository: repo,
    },
  }))
}

// ---------------------------------------------------------------------------
// Docs helpers
// ---------------------------------------------------------------------------

function findDocsDir(repoPath: string): string | null {
  const candidates = ['docs', 'documentation', 'doc', 'wiki']
  for (const name of candidates) {
    const fullPath = join(repoPath, name)
    if (existsSync(fullPath) && statSync(fullPath).isDirectory()) {
      return fullPath
    }
  }
  return null
}

function collectMdFiles(dirPath: string, baseDir: string): Array<{ relPath: string; content: string }> {
  const results: Array<{ relPath: string; content: string }> = []

  function walk(currentPath: string): void {
    let entries: string[]
    try {
      entries = readdirSync(currentPath)
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = join(currentPath, entry)
      let stat
      try {
        stat = statSync(fullPath)
      } catch {
        continue
      }

      if (stat.isDirectory()) {
        walk(fullPath)
      } else if (stat.isFile()) {
        const ext = extname(entry).toLowerCase()
        if (ext === '.md' || ext === '.mdx') {
          try {
            const content = readFileSync(fullPath, 'utf8')
            if (content.length < 100) continue
            results.push({ relPath: relative(baseDir, fullPath), content })
          } catch {
            // skip unreadable files
          }
        }
      }
    }
  }

  walk(dirPath)
  return results
}

function collectDocsLocal(repoPath: string, scope: string): SeedItem[] {
  const docsDir = findDocsDir(repoPath)
  if (!docsDir) return []

  const files = collectMdFiles(docsDir, repoPath)

  return files.map((file) => {
    const title = basename(file.relPath, extname(file.relPath))
    return {
      sourceType: 'docs' as const,
      label: file.relPath,
      idempotencyKey: makeKey(scope, 'docs', file.relPath),
      codeContext: {
        prTitle: title,
        prBody: file.content.slice(0, 2000),
      },
    }
  })
}

async function fetchGitHubDirContents(
  repo: string,
  token: string,
  dirPath: string,
  depth: number
): Promise<SeedItem[]> {
  if (depth > 3) return []

  const url = `https://api.github.com/repos/${repo}/contents/${dirPath}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' },
  })

  if (res.status === 404) return []
  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`)
    throw new Error(`GitHub API error fetching ${dirPath}: ${text}`)
  }

  const entries = (await res.json()) as GitHubTreeEntry[]
  const items: SeedItem[] = []

  for (const entry of entries) {
    const ext = extname(entry.name).toLowerCase()

    if (entry.type === 'dir') {
      const nested = await fetchGitHubDirContents(repo, token, entry.path, depth + 1)
      items.push(...nested)
    } else if (entry.type === 'file' && (ext === '.md' || ext === '.mdx')) {
      // Fetch file content via blob URL (returns base64)
      const fileRes = await fetch(entry.url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' },
      })
      if (!fileRes.ok) continue

      const blob = (await fileRes.json()) as GitHubContentBlob
      const content = Buffer.from(blob.content, 'base64').toString('utf8')
      if (content.length < 100) continue

      const title = basename(entry.path, ext)
      items.push({
        sourceType: 'docs',
        label: entry.path,
        idempotencyKey: makeKey(repo, 'docs', entry.path),
        codeContext: {
          prTitle: title,
          prBody: content.slice(0, 2000),
          repository: repo,
        },
      })
    }
  }

  return items
}

async function collectDocsGitHub(repo: string, token: string): Promise<SeedItem[]> {
  const candidates = ['docs', 'documentation', 'doc', 'wiki']

  for (const dir of candidates) {
    const url = `https://api.github.com/repos/${repo}/contents/${dir}`
    const probe = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' },
    })
    if (probe.status === 404) continue

    // This dir exists — delegate to recursive fetcher (starting at depth 1)
    return fetchGitHubDirContents(repo, token, dir, 1)
  }

  return []
}

// ---------------------------------------------------------------------------
// Releases (GitHub only)
// ---------------------------------------------------------------------------

async function collectReleasesGitHub(
  repo: string,
  token: string,
  fromDate?: string,
  limit = 50
): Promise<SeedItem[]> {
  const url = `https://api.github.com/repos/${repo}/releases?per_page=100`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`)
    throw new Error(`GitHub API error fetching releases: ${text}`)
  }

  const releases = (await res.json()) as GitHubRelease[]

  const filtered = releases.filter((r) => {
    if (!r.body || r.body.length < 50) return false
    if (fromDate && r.published_at && r.published_at < fromDate) return false
    return true
  })

  return filtered.slice(0, limit).map((r) => ({
    sourceType: 'release' as const,
    label: `Release ${r.name ?? r.tag_name}`,
    idempotencyKey: makeKey(repo, 'release', r.tag_name),
    codeContext: {
      prTitle: r.name ?? r.tag_name,
      prBody: r.body!.slice(0, 2000),
      repository: repo,
      prUrl: r.html_url,
    },
  }))
}

// ---------------------------------------------------------------------------
// PRs (GitHub only)
// ---------------------------------------------------------------------------

async function fetchGitHubPRs(repo: string, token: string, fromDate?: string, limit = 50): Promise<GitHubPR[]> {
  const prs: GitHubPR[] = []
  let page = 1

  while (prs.length < limit) {
    const url = `https://api.github.com/repos/${repo}/pulls?state=closed&per_page=100&page=${page}&sort=updated&direction=desc`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' },
    })

    if (!res.ok) {
      const text = await res.text().catch(() => `HTTP ${res.status}`)
      throw new Error(`GitHub API error fetching PRs: ${text}`)
    }

    const batch = (await res.json()) as GitHubPR[]
    if (batch.length === 0) break

    for (const pr of batch) {
      if (!pr.merged_at) continue
      if (fromDate && pr.merged_at < fromDate) continue
      prs.push(pr)
      if (prs.length >= limit) break
    }

    if (batch.length < 100) break
    page++
  }

  return prs
}

async function fetchPRDiff(repo: string, prNumber: number, token: string): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3.diff' },
  })
  if (!res.ok) {
    console.warn(chalk.dim(`  Warning: could not fetch diff for PR #${prNumber} (HTTP ${res.status})`))
    return ''
  }
  return (await res.text()).slice(0, 5000)
}

async function fetchPRChangedFiles(repo: string, prNumber: number, token: string): Promise<string[]> {
  const res = await fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}/files?per_page=50`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' },
  })
  if (!res.ok) {
    console.warn(chalk.dim(`  Warning: could not fetch files for PR #${prNumber} (HTTP ${res.status})`))
    return []
  }
  return ((await res.json()) as GitHubFile[]).map((f) => f.filename)
}

async function collectPRsGitHub(
  repo: string,
  token: string,
  fromDate?: string,
  limit = 50
): Promise<SeedItem[]> {
  const prs = await fetchGitHubPRs(repo, token, fromDate, limit)
  const relevant = prs.filter((pr) => !isLowSignalTitle(pr.title, pr.body))

  const items: SeedItem[] = []

  for (const pr of relevant) {
    const [diff, changedFiles] = await Promise.all([
      fetchPRDiff(repo, pr.number, token),
      fetchPRChangedFiles(repo, pr.number, token),
    ])

    items.push({
      sourceType: 'pr',
      label: `PR #${pr.number}: ${pr.title}`,
      idempotencyKey: makeKey(repo, 'pr', String(pr.number)),
      codeContext: {
        prTitle: pr.title.slice(0, 200),
        prBody: (pr.body ?? '').slice(0, 2000),
        diff,
        changedFiles,
        repository: repo,
        prUrl: pr.html_url,
      },
    })
  }

  return items
}

// ---------------------------------------------------------------------------
// Code source (local only) — AI-driven feature domain discovery
// ---------------------------------------------------------------------------

async function collectCodeLocal(
  repoPath: string,
  scope: string,
  baseUrl: string,
  apiKey: string,
  maxRounds = 3,
  precomputedTree?: string[],
): Promise<{ items: SeedItem[]; domains: Record<string, string[]> }> {
  // 1. Build the file tree (paths only — no contents sent in pass 1)
  console.log(chalk.dim('  Scanning repository structure...'))
  const tree = precomputedTree ?? walkTree(repoPath, 5000)

  // 2. Read package manifest for context
  const packageJson = readPackageJson(repoPath)

  // 3. Ask the server's LLM to identify feature domains
  console.log(chalk.dim('  Asking AI to identify feature domains...'))
  const domains = await fetchDomains(tree, packageJson, repoPath, baseUrl, apiKey, maxRounds)

  // 4. For each domain, read the actual file contents and build a SeedItem
  const items: SeedItem[] = []

  for (const [domainName, filePaths] of Object.entries(domains)) {
    const prBody = buildCodeBody(repoPath, filePaths)
    if (!prBody) continue

    items.push({
      sourceType: 'code',
      label: `Code: ${domainName}`,
      idempotencyKey: makeKey(scope, 'code', domainName),
      codeContext: {
        prTitle: domainName,
        prBody,
      },
    })
  }

  return { items, domains }
}

// ---------------------------------------------------------------------------
// Main command
// ---------------------------------------------------------------------------

export async function seedCommand(options: SeedOptions): Promise<void> {
  const apiKey = options.apiKey ?? process.env.HELPNEST_API_KEY
  const githubToken = options.token ?? process.env.GITHUB_TOKEN
  const isLocalMode = !!options.local
  const limit = parseInt(options.limit, 10) || 50
  const delay = parseInt(options.delay, 10) || 200
  const maxRounds = parseInt(options.rounds ?? '3', 10)
  const baseUrl = options.baseUrl.replace(/\/$/, '')
  const fromDate = options.from ? normalizeFromDate(options.from) : undefined
  const dryRun = options.dryRun ?? false

  // Determine which sources to collect
  const requestedSources =
    options.source === 'all'
      ? isLocalMode
        ? ['readme', 'docs', 'code']
        : ['readme', 'docs', 'releases', 'prs']
      : options.source.split(',').map((s) => s.trim().toLowerCase())

  // Validation: need --local, --repo, or --topics
  if (!isLocalMode && !options.repo && !options.topics) {
    console.error(chalk.red('Error: Provide --local <path>, --repo <owner/repo>, or --topics <topics>.'))
    process.exit(1)
  }

  if (!apiKey) {
    console.error(chalk.red('Error: API key required. Set --api-key or HELPNEST_API_KEY env var.'))
    process.exit(1)
  }

  const localPath = isLocalMode ? resolve(options.local!) : undefined

  if (localPath && !existsSync(localPath)) {
    console.error(chalk.red(`Error: Local path does not exist: ${localPath}`))
    process.exit(1)
  }

  // Consent gate: walk tree once (paths only) and prompt before reading contents
  let cachedTree: string[] | undefined
  if (localPath) {
    cachedTree = walkTree(localPath, 5000)
    const consented = await confirmFileAccess(localPath, cachedTree.length, options.yes)
    if (!consented) {
      console.log(chalk.yellow('Aborted.'))
      return
    }
  }

  // Scope is used as the namespace for idempotency key generation
  const scope = options.repo ?? localPath ?? undefined

  // GitHub token validation: only required when using GitHub sources with a repo
  if (!isLocalMode && options.repo) {
    const githubNeeded = requestedSources.some((s) => ['readme', 'docs', 'releases', 'prs'].includes(s))
    if (githubNeeded && !githubToken) {
      console.error(chalk.red('Error: GitHub token required for GitHub mode. Set --token or GITHUB_TOKEN env var.'))
      process.exit(1)
    }
  }

  // Warn about sources that are incompatible with the current mode
  if (isLocalMode) {
    for (const s of requestedSources) {
      if (s === 'prs') {
        console.warn(chalk.yellow('Warning: "prs" source requires GitHub mode (--repo + --token), skipping'))
      }
      if (s === 'releases') {
        console.warn(chalk.yellow('Warning: "releases" source requires GitHub mode (--repo + --token), skipping'))
      }
    }
  } else {
    if (requestedSources.includes('code')) {
      console.warn(chalk.yellow('Warning: "code" source is only available in local mode (--local), skipping'))
    }
  }

  // -------------------------------------------------------------------------
  // Collect all items from each requested source
  // -------------------------------------------------------------------------

  const allItems: SeedItem[] = []
  const sourceCounts: Record<string, number> = {}

  // README
  if (requestedSources.includes('readme')) {
    console.log(chalk.dim('Collecting README sections...'))
    try {
      const items = isLocalMode
        ? collectReadmeLocal(localPath!)
        : await collectReadmeGitHub(options.repo!, githubToken!)
      allItems.push(...items)
      sourceCounts['readme'] = items.length
      console.log(chalk.dim(`  Found ${items.length} README sections`))
    } catch (err) {
      console.warn(chalk.yellow(`  Warning: Could not collect README: ${err instanceof Error ? err.message : String(err)}`))
      sourceCounts['readme'] = 0
    }
  }

  // Docs
  if (requestedSources.includes('docs')) {
    console.log(chalk.dim('Collecting docs files...'))
    try {
      const items = isLocalMode
        ? collectDocsLocal(localPath!, scope!)
        : await collectDocsGitHub(options.repo!, githubToken!)
      allItems.push(...items)
      sourceCounts['docs'] = items.length
      console.log(chalk.dim(`  Found ${items.length} docs files`))
    } catch (err) {
      console.warn(chalk.yellow(`  Warning: Could not collect docs: ${err instanceof Error ? err.message : String(err)}`))
      sourceCounts['docs'] = 0
    }
  }

  // Releases (GitHub only)
  if (requestedSources.includes('releases') && !isLocalMode) {
    console.log(chalk.dim('Collecting releases...'))
    try {
      const items = await collectReleasesGitHub(options.repo!, githubToken!, fromDate, limit)
      allItems.push(...items)
      sourceCounts['releases'] = items.length
      console.log(chalk.dim(`  Found ${items.length} releases`))
    } catch (err) {
      console.warn(chalk.yellow(`  Warning: Could not collect releases: ${err instanceof Error ? err.message : String(err)}`))
      sourceCounts['releases'] = 0
    }
  }

  // PRs (GitHub only)
  if (requestedSources.includes('prs') && !isLocalMode) {
    console.log(chalk.dim('Collecting merged PRs...'))
    try {
      const items = await collectPRsGitHub(options.repo!, githubToken!, fromDate, limit)
      allItems.push(...items)
      sourceCounts['prs'] = items.length
      console.log(chalk.dim(`  Found ${items.length} relevant PRs`))
    } catch (err) {
      console.error(chalk.red(`Error collecting PRs: ${err instanceof Error ? err.message : String(err)}`))
      process.exit(1)
    }
  }

  // Code source (local only) — AI-driven feature domain discovery
  if (requestedSources.includes('code') && isLocalMode) {
    console.log(chalk.dim('Analyzing codebase for feature domains...'))
    try {
      const { items } = await collectCodeLocal(localPath!, scope!, baseUrl, apiKey!, maxRounds, cachedTree)
      allItems.push(...items)
      sourceCounts['code'] = items.length
      console.log(chalk.dim(`  Found ${items.length} feature domains`))
    } catch (err) {
      console.warn(chalk.yellow(`  Warning: Could not analyze codebase: ${err instanceof Error ? err.message : String(err)}`))
      sourceCounts['code'] = 0
    }
  }

  // Topics — plain text prompts, optionally grounded in local codebase via LLM file matching
  if (options.topics) {
    const topicList = options.topics
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 50)

    let topicFilesMap: Record<string, string[]> = {}

    if (isLocalMode && localPath) {
      console.log(chalk.dim('  Matching topics to codebase files...'))
      try {
        const tree = cachedTree ?? walkTree(localPath)
        const packageJson = readPackageJson(localPath)
        topicFilesMap = await fetchFilesForTopics(tree, packageJson, localPath, topicList, baseUrl, apiKey!, maxRounds)
      } catch (err) {
        console.warn(chalk.yellow(`  Warning: Could not analyze codebase: ${err instanceof Error ? err.message : String(err)}`))
      }
    } else {
      console.warn(chalk.yellow('  Tip: Pass --local <path> alongside --topics to ground articles in your codebase.'))
    }

    const items: SeedItem[] = topicList.map((t) => {
      const files = topicFilesMap[t] ?? []
      const codeContext = files.length > 0
        ? { prTitle: t.slice(0, 200), prBody: buildCodeBody(localPath!, files) }
        : undefined

      if (files.length === 0 && Object.keys(topicFilesMap).length > 0) {
        console.warn(chalk.dim(`  No files matched topic "${t}" — generating without code context`))
      }

      return {
        sourceType: 'topic' as const,
        label: `Topic: ${t}`,
        idempotencyKey: makeKey(scope ?? 'topics', 'topic', t.toLowerCase()),
        topic: t,
        codeContext,
      }
    })

    allItems.push(...items)
    sourceCounts['topics'] = items.length
    console.log(chalk.dim(`  Added ${items.length} topics`))
  }

  if (allItems.length === 0) {
    console.log(chalk.yellow('No items found matching your criteria.'))
    return
  }

  // Summary line
  const summaryParts = Object.entries(sourceCounts)
    .filter(([, count]) => count > 0)
    .map(([src, count]) => `${count} ${src}`)
  console.log(chalk.bold(`\nFound ${allItems.length} items: ${summaryParts.join(', ')}`))

  // Dry run: just print what would be generated
  if (dryRun) {
    console.log(chalk.bold('\nDry run -- items that would be generated:\n'))
    for (const item of allItems) {
      const typeLabel = chalk.cyan(`[${item.sourceType}]`)
      console.log(`  ${typeLabel} ${item.label}`)
    }
    return
  }

  // Pre-submit confirmation
  const proceed = await confirm(`Generate ${allItems.length} article(s)?`, options.yes)
  if (!proceed) {
    console.log(chalk.yellow('Aborted.'))
    return
  }

  // -------------------------------------------------------------------------
  // Submit all items to the HelpNest API
  // -------------------------------------------------------------------------

  let drafted = 0
  let skippedDuplicates = 0
  let rateLimitRetries = 0
  const total = allItems.length

  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i]
    const index = i + 1

    process.stdout.write(chalk.dim(`[${index}/${total}] ${item.label}... `))

    const body: Record<string, unknown> = {
      collectionId: options.collection,
      idempotencyKey: item.idempotencyKey,
    }
    if (item.sourceType === 'topic') {
      body.topic = item.topic
      // codeContext may be present when --local grounds the topic in source files
      if (item.codeContext) body.codeContext = item.codeContext
    } else {
      body.codeContext = item.codeContext
    }

    try {
      const res = await fetch(`${baseUrl}/api/ai/generate-article`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
      })

      if (res.status === 429) {
        if (rateLimitRetries >= 2) {
          console.log(chalk.red(`\n[${index}/${total}] Rate limit persists after 2 retries. Stopping.`))
          break
        }
        rateLimitRetries++
        const waitMs = msUntilNextHour()
        const waitMin = Math.ceil(waitMs / 60_000)
        console.log(chalk.yellow(`\n[${index}/${total}] Rate limit reached. Resuming in ${waitMin} minutes...`))
        await sleep(waitMs)
        // Retry the same item
        i--
        continue
      }

      if (res.status === 409) {
        console.log(chalk.dim('duplicate'))
        skippedDuplicates++
        await sleep(delay)
        continue
      }

      if (!res.ok) {
        const text = await res.text().catch(() => `HTTP ${res.status}`)
        console.log(chalk.red(`error: ${text}`))
        await sleep(delay)
        continue
      }

      const data = (await res.json()) as { articleId: string; title: string; mode: string }
      const action = data.mode === 'created' ? 'Draft created' : 'Update suggested'
      console.log(chalk.green(`${action}: "${data.title}"`))
      drafted++
      rateLimitRetries = 0
    } catch (err) {
      console.log(chalk.red(`error: ${err instanceof Error ? err.message : String(err)}`))
    }

    await sleep(delay)
  }

  console.log(chalk.bold(`\nDone: ${drafted} drafted, ${skippedDuplicates} skipped (duplicates)`))
}
