import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { execSync } from 'child_process'
import { join, relative, basename } from 'path'
import ora from 'ora'

// ---------------------------------------------------------------------------
// Skip patterns for test/generated files (used by buildCodeBody)
// ---------------------------------------------------------------------------

const SKIP_FILE_PATTERNS = ['.test.', '.spec.', '.d.ts', '.stories.', '__tests__', '__mocks__',
  '.min.', '.bundle.', '.generated.', '.pb.']

function isSkippableFile(filename: string): boolean {
  return SKIP_FILE_PATTERNS.some((p) => filename.includes(p))
}

// ---------------------------------------------------------------------------
// walkTreeFs — fs fallback for non-git repos
// ---------------------------------------------------------------------------

const SKIP_DIRS = new Set([
  'node_modules', '.next', 'dist', 'build', '.git', '__pycache__', 'vendor',
  'target', 'venv', '.venv', 'env', '.env', '.cache', 'coverage', '.turbo',
  'out', '.vercel', '.idea', '.vscode', '.pytest_cache', 'Pods', '.gradle',
  'obj', 'bin', 'pkg',
])

function walkTreeFs(repoPath: string, maxEntries: number): string[] {
  const paths: string[] = []

  function walk(currentPath: string, depth: number): void {
    if (depth > 8 || paths.length >= maxEntries) return
    let entries: string[]
    try { entries = readdirSync(currentPath) } catch { return }

    for (const entry of entries) {
      if (paths.length >= maxEntries) return
      if (SKIP_DIRS.has(entry) || entry.startsWith('.')) continue

      const fullPath = join(currentPath, entry)
      let stat
      try { stat = statSync(fullPath) } catch { continue }

      const relPath = relative(repoPath, fullPath)
      if (stat.isDirectory()) {
        walk(fullPath, depth + 1)
      } else if (stat.isFile()) {
        paths.push(relPath)
      }
    }
  }

  walk(repoPath, 0)
  return paths
}

// ---------------------------------------------------------------------------
// walkTree — git ls-files primary path, fs fallback for non-git repos
// ---------------------------------------------------------------------------

export function walkTree(repoPath: string, maxEntries = 5000): string[] {
  try {
    const out = execSync('git ls-files --cached --others --exclude-standard', {
      cwd: repoPath,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 10_000,
      maxBuffer: 10 * 1024 * 1024, // 10 MB cap — prevents unbounded buffer for huge repos
    })
    const files: string[] = []
    for (const line of out.split('\n')) {
      if (!line) continue
      files.push(line)
      if (files.length >= maxEntries) break
    }
    return files
  } catch {
    // Not a git repo or git not available — fall back to fs walk
    return walkTreeFs(repoPath, maxEntries)
  }
}

// ---------------------------------------------------------------------------
// readFileForContext — read a file, strip import lines, truncate
// ---------------------------------------------------------------------------

export function readFileForContext(repoPath: string, relPath: string, maxChars = 10000): string {
  try {
    const fullPath = join(repoPath, relPath)
    // Skip files larger than 500 KB — avoids loading large binaries or data dumps into memory
    const stat = statSync(fullPath)
    if (stat.size > 512 * 1024) return ''
    const content = readFileSync(fullPath, 'utf8')
    // Strip import lines — noise for KB generation
    const stripped = content
      .split('\n')
      .filter((line) => {
        const t = line.trim()
        if (/^import\s/.test(t)) return false
        if (/^from\s+['"]/.test(t)) return false
        if (/^const\s+\w+\s*=\s*require\(/.test(t)) return false
        return true
      })
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
    return stripped.slice(0, maxChars)
  } catch {
    return ''
  }
}

// ---------------------------------------------------------------------------
// readPackageJson — read the primary manifest file for project context
// ---------------------------------------------------------------------------

export function readPackageJson(repoPath: string): string | undefined {
  for (const name of ['package.json', 'pyproject.toml', 'go.mod', 'Gemfile']) {
    const p = join(repoPath, name)
    if (existsSync(p)) {
      try { return readFileSync(p, 'utf8').slice(0, 1000) } catch { /* skip */ }
      break
    }
  }
  return undefined
}

// ---------------------------------------------------------------------------
// fetchDomains — POST to analyze-repo-structure, return domain→files map
// Runs up to 3 rounds: each round reads previously identified files and sends
// their contents back so the server can refine domain groupings.
// ---------------------------------------------------------------------------

export async function fetchDomains(
  tree: string[],
  packageJson: string | undefined,
  repoPath: string,
  baseUrl: string,
  apiKey: string,
  maxRounds = 3,
): Promise<Record<string, string[]>> {
  const MAX_ROUNDS = maxRounds
  let domains: Record<string, string[]> = {}

  const seenContents = new Map<string, string>() // path → content, accumulates across rounds
  const spinner = ora('Identifying feature domains...').start()

  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      // On round 1+, read any new files not yet in seenContents
      if (round > 0) {
        const newFiles = Object.values(domains).flat().filter((p) => !seenContents.has(p))
        for (const p of newFiles) {
          const content = readFileForContext(repoPath, p)
          if (content.length > 0) seenContents.set(p, content)
        }
      }
      const fileContents = seenContents.size > 0
        ? Array.from(seenContents.entries()).map(([path, content]) => ({ path, content }))
        : []

      const remainingRounds = MAX_ROUNDS - round - 1

      const res = await fetch(`${baseUrl}/api/ai/analyze-repo-structure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          tree,
          packageJson,
          remainingRounds,
          ...(fileContents.length > 0 ? { fileContents } : {}),
        }),
      })

      if (!res.ok) {
        const contentType = res.headers.get('content-type') ?? ''
        if (contentType.includes('text/html')) {
          throw new Error(
            `analyze-repo-structure returned HTML (HTTP ${res.status}). ` +
              `Is the server running at ${baseUrl}? Try passing --base-url http://localhost:3000`,
          )
        }
        const text = await res.text().catch(() => `HTTP ${res.status}`)
        throw new Error(`analyze-repo-structure failed (HTTP ${res.status}): ${text}`)
      }

      const data = (await res.json()) as { domains?: Record<string, string[]>; needsMore?: boolean }

      if (!data.domains || typeof data.domains !== 'object') {
        throw new Error('Invalid response from analyze-repo-structure')
      }

      domains = data.domains

      if (round === 0 && MAX_ROUNDS > 1 && Object.keys(domains).length > 0) {
        spinner.text = `Round ${round + 1}: ${Object.keys(domains).length} domain(s) identified, reading contents...`
        continue
      }

      if (!data.needsMore || Object.keys(domains).length === 0) {
        spinner.succeed(`${Object.keys(domains).length} domain(s) identified`)
        break
      }

      spinner.text = `Round ${round + 1}: ${Object.keys(domains).length} domain(s) identified, refining...`
    }

    // If loop completed without break (all rounds used), succeed with final count
    if (spinner.isSpinning) {
      spinner.succeed(`${Object.keys(domains).length} domain(s) identified`)
    }
  } catch (err) {
    spinner.fail('Domain identification failed')
    throw err
  }

  return domains
}

// ---------------------------------------------------------------------------
// fetchFilesForTopic — single topic mode: POST topic, returns relevant files
// Runs up to 3 rounds: each round reads the previously identified files and
// sends their contents back so the server can refine the selection.
// ---------------------------------------------------------------------------

export async function fetchFilesForTopic(
  tree: string[],
  packageJson: string | undefined,
  repoPath: string,
  topic: string,
  baseUrl: string,
  apiKey: string,
  maxRounds = 3,
): Promise<string[]> {
  const MAX_ROUNDS = maxRounds
  let files: string[] = []

  const seenContents = new Map<string, string>() // path → content, accumulates across rounds
  const spinner = ora(`Matching files for "${topic}"...`).start()

  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      // On round 1+, read any new files not yet in seenContents
      if (round > 0) {
        const newFiles = files.filter((p) => !seenContents.has(p))
        for (const p of newFiles) {
          const content = readFileForContext(repoPath, p)
          if (content.length > 0) seenContents.set(p, content)
        }
      }
      const fileContents = seenContents.size > 0
        ? Array.from(seenContents.entries()).map(([path, content]) => ({ path, content }))
        : []

      const remainingRounds = MAX_ROUNDS - round - 1

      const res = await fetch(`${baseUrl}/api/ai/analyze-repo-structure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          tree,
          packageJson,
          topic,
          remainingRounds,
          ...(fileContents.length > 0 ? { fileContents } : {}),
        }),
      })

      if (!res.ok) {
        const contentType = res.headers.get('content-type') ?? ''
        if (contentType.includes('text/html')) {
          throw new Error(
            `analyze-repo-structure returned HTML (HTTP ${res.status}). ` +
              `Is the server running at ${baseUrl}? Try passing --base-url http://localhost:3000`,
          )
        }
        const text = await res.text().catch(() => `HTTP ${res.status}`)
        throw new Error(`analyze-repo-structure failed (HTTP ${res.status}): ${text}`)
      }

      const data = (await res.json()) as { files?: string[]; needsMore?: boolean }
      files = Array.isArray(data.files) ? data.files : []

      // Round 0 is filename-only candidate selection — always proceed to round 1
      // to read actual file contents, regardless of needsMore.
      if (round === 0 && MAX_ROUNDS > 1 && files.length > 0) {
        spinner.text = `Round ${round + 1}: ${files.length} file(s) identified, reading contents...`
        continue
      }

      if (!data.needsMore || files.length === 0) {
        spinner.succeed(`${files.length} file(s) matched for "${topic}"`)
        break
      }

      spinner.text = `Round ${round + 1}: ${files.length} file(s) identified, refining...`
    }

    if (spinner.isSpinning) {
      spinner.succeed(`${files.length} file(s) matched for "${topic}"`)
    }
  } catch (err) {
    spinner.fail(`File matching failed for "${topic}"`)
    throw err
  }

  return files
}

// ---------------------------------------------------------------------------
// fetchFilesForTopics — multi-topic mode: POST topics[], returns topic→files map
// Runs up to 3 rounds: each round reads all unique files identified across all
// topics in the previous round and sends their contents back for refinement.
// ---------------------------------------------------------------------------

export async function fetchFilesForTopics(
  tree: string[],
  packageJson: string | undefined,
  repoPath: string,
  topics: string[],
  baseUrl: string,
  apiKey: string,
  maxRounds = 3,
): Promise<Record<string, string[]>> {
  const MAX_ROUNDS = maxRounds
  let topicFiles: Record<string, string[]> = {}

  const seenContents = new Map<string, string>() // path → content, accumulates across rounds
  const spinner = ora(`Matching files for ${topics.length} topic(s)...`).start()

  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      // On round 1+, read any new files not yet in seenContents
      if (round > 0) {
        const newFiles = Object.values(topicFiles).flat().filter((p) => !seenContents.has(p))
        for (const p of newFiles) {
          const content = readFileForContext(repoPath, p)
          if (content.length > 0) seenContents.set(p, content)
        }
      }
      const fileContents = seenContents.size > 0
        ? Array.from(seenContents.entries()).map(([path, content]) => ({ path, content }))
        : []

      const remainingRounds = MAX_ROUNDS - round - 1

      const res = await fetch(`${baseUrl}/api/ai/analyze-repo-structure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          tree,
          packageJson,
          topics,
          remainingRounds,
          ...(fileContents.length > 0 ? { fileContents } : {}),
        }),
      })

      if (!res.ok) {
        const contentType = res.headers.get('content-type') ?? ''
        if (contentType.includes('text/html')) {
          throw new Error(
            `analyze-repo-structure returned HTML (HTTP ${res.status}). ` +
              `Is the server running at ${baseUrl}? Try passing --base-url http://localhost:3000`,
          )
        }
        const text = await res.text().catch(() => `HTTP ${res.status}`)
        throw new Error(`analyze-repo-structure failed (HTTP ${res.status}): ${text}`)
      }

      const data = (await res.json()) as { topicFiles?: Record<string, string[]>; needsMore?: boolean }
      topicFiles = data.topicFiles && typeof data.topicFiles === 'object' ? data.topicFiles : {}
      const totalFiles = new Set(Object.values(topicFiles).flat()).size

      if (round === 0 && MAX_ROUNDS > 1 && totalFiles > 0) {
        spinner.text = `Round ${round + 1}: ${totalFiles} file(s) identified, reading contents...`
        continue
      }

      if (!data.needsMore || Object.keys(topicFiles).length === 0) {
        spinner.succeed(`${totalFiles} file(s) matched across ${topics.length} topic(s)`)
        break
      }

      spinner.text = `Round ${round + 1}: ${totalFiles} file(s) identified, refining...`
    }

    if (spinner.isSpinning) {
      const totalFiles = new Set(Object.values(topicFiles).flat()).size
      spinner.succeed(`${totalFiles} file(s) matched across ${topics.length} topic(s)`)
    }
  } catch (err) {
    spinner.fail('Topic file matching failed')
    throw err
  }

  return topicFiles
}

// ---------------------------------------------------------------------------
// buildCodeBody — read matched files and concatenate into a context string
// ---------------------------------------------------------------------------

export function buildCodeBody(repoPath: string, filePaths: string[], maxChars = 1000000): string {
  const parts: string[] = []
  let totalChars = 0

  for (const relPath of filePaths) {
    if (totalChars >= maxChars) break
    if (isSkippableFile(basename(relPath))) continue

    const content = readFileForContext(repoPath, relPath, maxChars - totalChars)
    if (content.length < 30) continue

    parts.push(`// ${relPath}\n${content}`)
    totalChars += content.length
  }

  return parts.join('\n\n')
}
