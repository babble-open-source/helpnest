import chalk from 'chalk'
import { createHash } from 'crypto'
import { resolve } from 'path'
import { walkTree, readPackageJson, fetchFilesForTopic, buildCodeBody } from '../utils.js'
import { confirmFileAccess } from '../prompts.js'

interface DraftOptions {
  apiKey?: string
  workspace?: string
  prTitle?: string
  topic?: string
  prBody?: string
  diff?: string
  collection?: string
  featureId?: string
  baseUrl: string
  local?: string
  rounds?: string
  yes?: boolean
}

export async function draftCommand(options: DraftOptions): Promise<void> {
  const apiKey = options.apiKey ?? process.env.HELPNEST_API_KEY

  if (!apiKey) {
    console.error(chalk.red('Error: API key required. Set --api-key or HELPNEST_API_KEY env var.'))
    process.exit(1)
  }

  if (!options.prTitle && !options.topic) {
    console.error(chalk.red('Error: Provide either --pr-title or --topic.'))
    process.exit(1)
  }

  const baseUrl = options.baseUrl.replace(/\/$/, '')

  const idempotencyKey = createHash('sha256')
    .update(`${(options.topic ?? options.prTitle!).trim().toLowerCase()}:${baseUrl}`)
    .digest('hex')
    .slice(0, 32)

  let endpoint: string
  let body: Record<string, unknown>

  if (options.topic && !options.prTitle) {
    // Topic mode — plain prompt with optional code context from local repo
    let codeContext: Record<string, unknown> | undefined

    if (options.local) {
      const repoPath = resolve(options.local)
      const tree = walkTree(repoPath)

      const consented = await confirmFileAccess(repoPath, tree.length, options.yes)
      if (!consented) {
        console.log(chalk.yellow('Aborted.'))
        return
      }

      const packageJson = readPackageJson(repoPath)
      const maxRounds = parseInt(options.rounds ?? '3', 10)

      try {
        const files = await fetchFilesForTopic(tree, packageJson, repoPath, options.topic, baseUrl, apiKey!, maxRounds)

        if (files.length > 0) {
          const prBody = buildCodeBody(repoPath, files)
          codeContext = { prTitle: options.topic.slice(0, 200), prBody }
          console.log(chalk.dim(`  Using ${files.length} file(s) as context: ${files.slice(0, 3).join(', ')}${files.length > 3 ? ` +${files.length - 3} more` : ''}`))
        } else {
          console.warn(chalk.yellow('Warning: No relevant files found for topic. Generating without code context.'))
        }
      } catch (err) {
        console.warn(chalk.yellow(`Warning: Could not analyze codebase: ${err instanceof Error ? err.message : String(err)}`))
        console.warn(chalk.yellow('Generating without code context.'))
      }
    } else {
      console.warn(chalk.yellow('Tip: Pass --local <path> to ground this article in your actual codebase.'))
    }

    endpoint = 'generate-article'
    body = {
      collectionId: options.collection,
      idempotencyKey,
      topic: options.topic.slice(0, 500),
      ...(codeContext ? { codeContext } : {}),
    }
  } else {
    // PR mode — existing behavior unchanged (including featureId)
    endpoint = options.featureId ? 'push-feature-context' : 'generate-article'
    const codeContext: Record<string, unknown> = {
      prTitle: options.prTitle!.slice(0, 200),
      prBody: options.prBody?.slice(0, 2000),
      diff: options.diff?.slice(0, 5000),
    }
    body = options.featureId
      ? { featureId: options.featureId, collectionId: options.collection, codeContext }
      : { collectionId: options.collection, codeContext, idempotencyKey }
  }

  const url = `${baseUrl}/api/ai/${endpoint}`

  console.log(chalk.dim(`Sending to ${baseUrl}...`))

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => `HTTP ${res.status}`)
      console.error(chalk.red(`Error: ${text}`))
      process.exit(1)
    }

    const data = (await res.json()) as {
      articleId?: string
      title?: string
      mode?: string
      queued?: boolean
      featureId?: string
      contextsCollected?: number
    }

    if (data.queued) {
      console.log(chalk.green(`Queued for feature ${data.featureId} (${data.contextsCollected ?? 1} PR${(data.contextsCollected ?? 1) === 1 ? '' : 's'} collected)`))
    } else {
      const action = data.mode === 'created' ? 'Draft created' : 'Update suggested'
      const editUrl = `${baseUrl}/dashboard/articles/${data.articleId}/edit`
      console.log(chalk.green(`${action}: "${data.title}"`))
      console.log(chalk.dim(`Edit: ${editUrl}`))
    }
  } catch (err) {
    console.error(chalk.red(`Error: ${err instanceof Error ? err.message : String(err)}`))
    process.exit(1)
  }
}
