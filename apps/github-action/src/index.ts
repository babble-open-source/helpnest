import * as core from '@actions/core'
import * as github from '@actions/github'
import crypto from 'crypto'

async function run(): Promise<void> {
  try {
    const context = github.context
    const { pull_request } = context.payload

    // Only run on merged PRs
    if (!pull_request?.merged) {
      core.info('Not a merged PR — skipping HelpNest draft.')
      return
    }

    // Check skip labels
    const skipLabels = core.getInput('skip-labels')
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean)

    const prLabels = (pull_request.labels as Array<{ name: string }>) ?? []
    if (prLabels.some((l) => skipLabels.includes(l.name))) {
      core.info('PR has a skip label — skipping HelpNest draft.')
      return
    }

    const apiKey = core.getInput('api-key', { required: true })
    const workspace = core.getInput('workspace') // optional — only used for idempotency key deduplication
    const baseUrl = core.getInput('base-url').replace(/\/$/, '')
    const collection = core.getInput('collection') || undefined
    const featureId = core.getInput('feature-id') || undefined
    const sendDiff = core.getInput('send-diff') === 'true'
    const diffMaxLines = parseInt(core.getInput('diff-max-lines'), 10) || 150
    const sendFileContent = core.getInput('send-file-content') === 'true'
    const fileContentMaxFiles = parseInt(core.getInput('file-content-max-files'), 10) || 5

    const repo = context.repo

    // Resolve github token — required only for send-diff / send-file-content
    const token = core.getInput('github-token') || process.env.GITHUB_TOKEN || ''
    const octokit = token ? github.getOctokit(token) : null

    // Build codeContext
    const codeContext: Record<string, unknown> = {
      prTitle: String(pull_request.title).slice(0, 200),
      prBody: pull_request.body ? String(pull_request.body).slice(0, 2000) : undefined,
      repository: `${repo.owner}/${repo.repo}`,
      prUrl: pull_request.html_url as string,
    }

    // Commit subjects — always included when token is available (text only, no code)
    if (octokit) {
      try {
        const commitsRes = await octokit.rest.pulls.listCommits({
          owner: repo.owner,
          repo: repo.repo,
          pull_number: pull_request.number as number,
        })
        const commitMessages = commitsRes.data
          .map((c) => c.commit.message.split('\n')[0].trim())
          .filter(Boolean)
        if (commitMessages.length > 0) {
          codeContext.commitMessages = commitMessages
        }
      } catch (err) {
        core.warning(`Could not fetch PR commits: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    // Shared file list — fetched once when either send-diff or send-file-content is enabled
    type PrFile = { filename: string; status: string; patch?: string }
    let prFiles: PrFile[] | null = null
    if ((sendDiff || sendFileContent) && octokit) {
      try {
        const files = await octokit.rest.pulls.listFiles({
          owner: repo.owner,
          repo: repo.repo,
          pull_number: pull_request.number as number,
        })
        prFiles = files.data
        codeContext.changedFiles = prFiles.map((f) => f.filename)
      } catch (err) {
        core.warning(`Could not fetch PR files: ${err instanceof Error ? err.message : String(err)}`)
      }
    } else if (sendDiff || sendFileContent) {
      core.warning('send-diff or send-file-content is true but no github-token provided — skipping')
    }

    if (sendDiff && prFiles) {
      const diffLines: string[] = []
      for (const f of prFiles) {
        if (f.patch) {
          for (const line of f.patch.split('\n')) {
            if (diffLines.length >= diffMaxLines) break
            diffLines.push(line)
          }
        }
        if (diffLines.length >= diffMaxLines) break
      }
      if (diffLines.length > 0) {
        codeContext.diff = diffLines.join('\n')
      }
    }

    if (sendFileContent && prFiles && octokit) {
      const SKIP_PATTERNS = /\.(test|spec)\.|\.json$|\.yaml$|\.yml$|\.toml$|\.lock$|\.d\.ts$|Dockerfile/i
      const eligible = prFiles
        .filter((f) => f.status !== 'removed' && !SKIP_PATTERNS.test(f.filename))
        .slice(0, fileContentMaxFiles)

      const currentFiles: Array<{ path: string; content: string }> = []
      for (const f of eligible) {
        try {
          const res = await octokit.rest.repos.getContent({
            owner: repo.owner,
            repo: repo.repo,
            path: f.filename,
          })
          const data = res.data as { content?: string; encoding?: string }
          if (data.content && data.encoding === 'base64') {
            const raw = Buffer.from(data.content, 'base64').toString('utf8')
            const stripped = raw
              .split('\n')
              .filter((line) => !/^(import\s|from\s['"]|require\()/.test(line.trim()))
              .join('\n')
              .slice(0, 1000)
            currentFiles.push({ path: f.filename, content: stripped })
          }
        } catch {
          // skip files that can't be fetched
        }
      }

      if (currentFiles.length > 0) {
        codeContext.currentFiles = currentFiles
      }
    }

    // Idempotency key based on PR URL + workspace to prevent duplicate drafts on re-runs
    const idempotencyKey = crypto
      .createHash('sha256')
      .update(`${pull_request.html_url as string}:${workspace}`)
      .digest('hex')
      .slice(0, 32)

    const endpoint = featureId ? 'push-feature-context' : 'generate-article'
    const url = `${baseUrl}/api/ai/${endpoint}`

    const requestBody = featureId
      ? { featureId, collectionId: collection, codeContext }
      : { collectionId: collection, codeContext, idempotencyKey }

    // Call with retry + exponential backoff
    let lastError: Error | null = null
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 30_000)

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        })

        clearTimeout(timeout)

        if (res.ok) {
          const data = (await res.json()) as { articleId?: string; title?: string; mode?: string; queued?: boolean; featureId?: string }
          if (featureId) {
            core.info(`Queued for feature ${data.featureId ?? featureId} (contexts collected)`)
          } else {
            core.info(`Draft ${data.mode}: "${data.title}" — article ID: ${data.articleId}`)
          }
          return
        }

        const errorText = await res.text().catch(() => `HTTP ${res.status}`)
        lastError = new Error(`HelpNest API returned ${res.status}: ${errorText}`)

        if (res.status < 500) break // client error, no point retrying
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
      }

      if (attempt < 3) {
        const delay = attempt * 5000
        core.info(`Attempt ${attempt} failed, retrying in ${delay / 1000}s...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    // Never fail CI — only warn
    core.warning(
      `HelpNest draft action failed (non-blocking): ${lastError?.message ?? 'Unknown error'}`,
    )
  } catch (err) {
    // Top-level catch — still never fail CI
    core.warning(
      `HelpNest draft action error (non-blocking): ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

run()
