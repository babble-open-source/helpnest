import chalk from 'chalk'
import { createHash } from 'crypto'

interface DraftOptions {
  apiKey?: string
  workspace?: string
  prTitle: string
  prBody?: string
  diff?: string
  collection?: string
  featureId?: string
  baseUrl: string
}

export async function draftCommand(options: DraftOptions): Promise<void> {
  const apiKey = options.apiKey ?? process.env.HELPNEST_API_KEY

  if (!apiKey) {
    console.error(chalk.red('Error: API key required. Set --api-key or HELPNEST_API_KEY env var.'))
    process.exit(1)
  }

  const baseUrl = options.baseUrl.replace(/\/$/, '')
  const endpoint = options.featureId ? 'push-feature-context' : 'generate-article'
  const url = `${baseUrl}/api/ai/${endpoint}`

  const codeContext: Record<string, unknown> = {
    prTitle: options.prTitle.slice(0, 200),
    prBody: options.prBody?.slice(0, 2000),
    diff: options.diff?.slice(0, 5000),
  }

  const idempotencyKey = createHash('sha256')
    .update(`${options.prTitle.trim().toLowerCase()}:${baseUrl}`)
    .digest('hex')
    .slice(0, 32)

  const body = options.featureId
    ? { featureId: options.featureId, collectionId: options.collection, codeContext }
    : { collectionId: options.collection, codeContext, idempotencyKey }

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
