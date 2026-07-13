/**
 * calibrate-retrieval-floor.ts — measure, don't guess.
 *
 * The AI agent escalates when an answer is not grounded in the knowledge base.
 * "Grounded" is decided by a floor on the retriever's score, and that floor CANNOT
 * be picked from thin air: it depends on the embedding model, and it depends on your
 * corpus. The usual "0.75 means a good match" folklore comes from the ada-002 era;
 * HelpNest uses text-embedding-3-small, whose similarities run far lower and wider.
 * Transplanting a number between embedding models is how you end up escalating
 * everything, or nothing.
 *
 * So this script measures the floor against YOUR articles, and reports the two
 * failure modes SEPARATELY, because they trade off against each other:
 *
 *   over-abstention — the bot escalated while a perfectly good article existed.
 *                     Costs you: a human answers a question the bot could have.
 *                     A bot that escalates everything is safe and useless.
 *
 *   wrong-answer    — the bot answered confidently from articles that did not
 *                     support the answer. Costs you: a customer is misinformed and
 *                     nobody finds out.
 *
 * A single "accuracy" number hides that trade-off. You have to pick the floor
 * against the cost of each in YOUR support operation, so this prints both at every
 * candidate floor and lets you choose.
 *
 * Usage:
 *   pnpm calibrate:retrieval -- --workspace <slug>
 *   pnpm calibrate:retrieval -- --workspace <slug> --queries ./labelled.jsonl
 *   pnpm calibrate:retrieval -- --workspace <slug> --max-wrong-answer-rate 0.05
 *
 * The --queries file is JSONL, one probe per line, and is BY FAR the most
 * trustworthy input:
 *   {"query": "how do I reset my password", "answerable": true}
 *   {"query": "do you ship to Chile",       "answerable": false}
 *
 * Without it, the script falls back to a weak proxy (see the caveat it prints).
 */

import path from 'node:path'
import fs from 'node:fs'
import { config } from 'dotenv'

config({ path: path.resolve(__dirname, '../../../.env') })
config({ path: path.resolve(__dirname, '../.env.local') })

import { PrismaClient } from '@helpnest/db'
import { PrismaPg } from '@prisma/adapter-pg'
import OpenAI from 'openai'
import { COLLECTION_NAME, VECTOR_SIZE, chunkText, buildPointId } from '../src/lib/qdrant'

/**
 * Qdrant over raw fetch rather than @qdrant/js-client-rest.
 *
 * The client bundles its own undici dispatcher, which recent Node runtimes reject
 * ("InvalidArgumentError: invalid onError method") — every call then fails with an
 * opaque `fetch failed`. A calibration script that dies on a dependency clash is
 * useless, and the REST surface we need here is three endpoints. chunkText and
 * buildPointId are still imported from the app so the vectors this writes are
 * byte-for-byte what production would write.
 */
const QDRANT_URL = (process.env.QDRANT_URL ?? 'http://127.0.0.1:6333').replace(/\/$/, '')

async function qdrantFetch<T>(method: string, endpoint: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (process.env.QDRANT_API_KEY) headers['api-key'] = process.env.QDRANT_API_KEY

  const response = await fetch(`${QDRANT_URL}${endpoint}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error(`Qdrant ${method} ${endpoint} -> ${response.status} ${await response.text()}`)
  }
  return (await response.json()) as T
}

interface QdrantHit {
  score: number
  payload?: Record<string, unknown> | null
}

async function qdrantSearch(vector: number[], workspaceId: string): Promise<QdrantHit[]> {
  const body = {
    vector,
    limit: 5,
    with_payload: true,
    filter: {
      must: [{ key: 'workspaceId', match: { value: workspaceId } }],
      must_not: [{ key: 'visibility', match: { value: 'INTERNAL' } }],
    },
  }
  const res = await qdrantFetch<{ result: QdrantHit[] }>(
    'POST',
    `/collections/${COLLECTION_NAME}/points/search`,
    body
  )
  return res.result ?? []
}

/**
 * Off-domain questions: no help center on earth should ground these. They give us a
 * true-negative distribution — what the retriever scores when the answer genuinely
 * is not in the corpus.
 */
const OFF_DOMAIN_PROBES = [
  'what is the weather in Lisbon tomorrow',
  'how do I bake sourdough bread',
  'who won the world cup in 1998',
  'what is the capital of Mongolia',
  'recommend a good science fiction novel',
  'how do I change a flat bicycle tyre',
  'what is the square root of 4096',
  'translate good morning into Japanese',
  'when did the Roman empire fall',
  'how long should I boil an egg',
  'what are the symptoms of the flu',
  'how do I train for a marathon',
]

interface Probe {
  query: string
  /** True if a good article for this query exists in the corpus. */
  answerable: boolean
}

interface Measurement extends Probe {
  cosine: number | null
  coverage: number | null
}

function parseArgs(): {
  workspace: string
  queriesFile: string | null
  maxWrongAnswerRate: number
  sync: boolean
} {
  const argv = process.argv.slice(2)
  const get = (flag: string): string | null => {
    const i = argv.indexOf(flag)
    return i >= 0 && argv[i + 1] ? (argv[i + 1] as string) : null
  }
  const workspace = get('--workspace')
  if (!workspace) {
    console.error('Usage: pnpm calibrate:retrieval -- --workspace <slug> [--queries file.jsonl]')
    process.exit(1)
  }
  return {
    workspace,
    queriesFile: get('--queries'),
    maxWrongAnswerRate: Number(get('--max-wrong-answer-rate') ?? '0.10'),
    // --sync embeds the corpus into Qdrant first. Calibrating against a stale or
    // empty index measures the index, not the floor.
    sync: argv.includes('--sync'),
  }
}

function loadProbeFile(file: string): Probe[] {
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line, i) => {
      const parsed = JSON.parse(line) as { query?: unknown; answerable?: unknown }
      if (typeof parsed.query !== 'string' || typeof parsed.answerable !== 'boolean') {
        throw new Error(
          `${file}:${i + 1} — each line needs {"query": string, "answerable": boolean}`
        )
      }
      return { query: parsed.query, answerable: parsed.answerable }
    })
}

async function main() {
  const args = parseArgs()

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' })
  const prisma = new PrismaClient({ adapter })
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const workspace = await prisma.workspace.findUnique({
    where: { slug: args.workspace },
    select: { id: true, name: true },
  })
  if (!workspace) throw new Error(`No workspace with slug "${args.workspace}"`)

  const articles = await prisma.article.findMany({
    where: {
      workspaceId: workspace.id,
      status: 'PUBLISHED',
      collection: { is: { visibility: 'PUBLIC', isArchived: false } },
    },
    select: { id: true, title: true, content: true, slug: true, collectionId: true },
  })

  console.log(`\nWorkspace: ${workspace.name} (${args.workspace})`)
  console.log(`Published public articles: ${articles.length}`)

  if (args.sync) {
    console.log('\nSyncing embeddings to Qdrant…')
    try {
      await qdrantFetch('GET', `/collections/${COLLECTION_NAME}`)
    } catch {
      await qdrantFetch('PUT', `/collections/${COLLECTION_NAME}`, {
        vectors: { size: VECTOR_SIZE, distance: 'Cosine' },
      })
      console.log(`  created collection ${COLLECTION_NAME}`)
    }

    for (const article of articles) {
      const chunks = chunkText(`${article.title}\n\n${article.content}`)
      const embedded = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: chunks.map((c) => c.slice(0, 8000)),
      })
      await qdrantFetch('PUT', `/collections/${COLLECTION_NAME}/points?wait=true`, {
        points: chunks.map((_chunk, i) => ({
          id: buildPointId(article.id, i),
          vector: embedded.data[i]?.embedding ?? [],
          payload: {
            articleId: article.id,
            workspaceId: workspace.id,
            collectionId: article.collectionId,
            visibility: 'PUBLIC',
            slug: article.slug,
          },
        })),
      })
    }
    console.log(`  synced ${articles.length} article(s)\n`)
  }

  // --- Build the probe set ---
  let probes: Probe[]
  if (args.queriesFile) {
    probes = loadProbeFile(args.queriesFile)
    console.log(`Probes: ${probes.length} from ${args.queriesFile} (labelled — trustworthy)\n`)
  } else {
    probes = [
      ...articles.map((a) => ({ query: a.title, answerable: true })),
      ...OFF_DOMAIN_PROBES.map((q) => ({ query: q, answerable: false })),
    ]
    console.log(
      `Probes: ${probes.length} synthesised (${articles.length} positive, ${OFF_DOMAIN_PROBES.length} negative)`
    )
    console.log(
      '\n  ⚠  CAVEAT — READ THIS BEFORE TRUSTING THE NUMBER BELOW.\n' +
        '     With no --queries file, positives are article TITLES, which are themselves\n' +
        '     part of the text that was embedded. They therefore score much higher than a\n' +
        '     real customer question ever will, which makes the recommended floor TOO HIGH\n' +
        '     — i.e. biased toward over-abstention. Treat it as an upper bound, not a\n' +
        '     recommendation. To get a floor you can actually ship, label 30-50 real\n' +
        '     customer questions and pass them with --queries.\n'
    )
  }

  if (articles.length < 5) {
    console.log('  ⚠  Fewer than 5 articles. Any floor derived from this corpus is noise.\n')
  }

  // --- Measure every probe against both retrievers ---
  const measurements: Measurement[] = []
  for (const probe of probes) {
    let cosine: number | null = null
    try {
      const embedding = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: probe.query.slice(0, 8000),
      })
      const vector = embedding.data[0]?.embedding
      if (vector) {
        const hits = await qdrantSearch(vector, workspace.id)
        // No hits at all is a real measurement (zero grounding), not a failure.
        cosine = hits.length > 0 ? Math.max(...hits.map((h) => h.score ?? 0)) : 0
      }
    } catch (err) {
      console.error(`  vector probe failed for "${probe.query}": ${(err as Error).message}`)
    }

    // The same lexical coverage the agent's full-text fallback computes.
    const rows = await prisma.$queryRaw<Array<{ coverage: number }>>`
      WITH q AS (
        SELECT tsvector_to_array(to_tsvector('english', ${probe.query})) AS terms
      )
      SELECT CASE
               WHEN COALESCE(array_length(q.terms, 1), 0) = 0 THEN 0::float8
               ELSE (
                 SELECT COUNT(*)::float8
                 FROM   unnest(q.terms) AS term
                 WHERE  term = ANY(
                          tsvector_to_array(to_tsvector('english', a.title || ' ' || a.content))
                        )
               ) / array_length(q.terms, 1)::float8
             END AS coverage
      FROM   "Article" a
      JOIN   "Collection" c ON a."collectionId" = c.id
      CROSS  JOIN q
      WHERE  a."workspaceId" = ${workspace.id}
        AND  a.status = 'PUBLISHED'
        AND  c."visibility"::text = 'PUBLIC'
        AND  c."isArchived" = false
      ORDER  BY coverage DESC
      LIMIT  1
    `
    const coverage = rows[0]?.coverage ?? 0

    measurements.push({ ...probe, cosine, coverage })
  }

  reportSweep('VECTOR (cosine similarity)', measurements, (m) => m.cosine, args.maxWrongAnswerRate)
  reportSweep(
    'LEXICAL (keyword coverage)',
    measurements,
    (m) => m.coverage,
    args.maxWrongAnswerRate
  )

  await prisma.$disconnect()
}

/**
 * Sweeps candidate floors and prints both error rates at each.
 *
 * At floor f:
 *   over-abstention = answerable probes scoring BELOW f  (we'd escalate a question we could answer)
 *   wrong-answer    = unanswerable probes scoring AT/ABOVE f (we'd answer a question we can't)
 */
function reportSweep(
  label: string,
  measurements: Measurement[],
  score: (m: Measurement) => number | null,
  maxWrongAnswerRate: number
) {
  const usable = measurements.filter((m) => score(m) !== null)
  const positives = usable.filter((m) => m.answerable)
  const negatives = usable.filter((m) => !m.answerable)

  console.log(`\n${'='.repeat(64)}`)
  console.log(label)
  console.log('='.repeat(64))

  if (positives.length === 0 || negatives.length === 0) {
    console.log('  Not enough probes on both sides to calibrate. Skipping.')
    return
  }

  console.log('\n  floor   over-abstention   wrong-answer')
  console.log('  -----   ---------------   ------------')

  const candidates: Array<{ floor: number; over: number; wrong: number }> = []
  for (let floor = 0; floor <= 0.8001; floor += 0.02) {
    const over = positives.filter((m) => (score(m) as number) < floor).length / positives.length
    const wrong = negatives.filter((m) => (score(m) as number) >= floor).length / negatives.length
    candidates.push({ floor, over, wrong })
    console.log(
      `  ${floor.toFixed(2)}    ${(over * 100).toFixed(0).padStart(11)}%   ${(wrong * 100).toFixed(0).padStart(9)}%`
    )
  }

  // Recommend the LOWEST floor that keeps the wrong-answer rate under the target.
  // Lowest, not "best separation": the whole point of a conservative default is that
  // when we are unsure we would rather answer than escalate, because an escalation
  // storm is what makes people turn the feature off entirely.
  const acceptable = candidates.filter((c) => c.wrong <= maxWrongAnswerRate)
  const pick = acceptable[0]

  console.log('')
  if (!pick) {
    console.log(
      `  ✗ No floor achieves a wrong-answer rate <= ${(maxWrongAnswerRate * 100).toFixed(0)}%.\n` +
        '    Your positives and negatives are not separable by this retriever. That is a\n' +
        '    corpus problem, not a threshold problem — most likely the embeddings are stale\n' +
        '    (re-run the embedding sync) or the knowledge base is too thin to answer the\n' +
        '    questions being asked of it. Do not paper over this with a threshold.'
    )
    return
  }

  const bestSeparation = candidates.reduce((a, b) => (a.over + a.wrong <= b.over + b.wrong ? a : b))
  console.log(
    `  → Recommended floor: ${pick.floor.toFixed(2)}\n` +
      `    over-abstention ${(pick.over * 100).toFixed(0)}%, wrong-answer ${(pick.wrong * 100).toFixed(0)}%\n` +
      `    (lowest floor holding wrong-answer <= ${(maxWrongAnswerRate * 100).toFixed(0)}%; ` +
      `raise --max-wrong-answer-rate to abstain less, lower it to abstain more)\n` +
      `\n    For reference, best raw separation is at ${bestSeparation.floor.toFixed(2)} ` +
      `(over ${(bestSeparation.over * 100).toFixed(0)}%, wrong ${(bestSeparation.wrong * 100).toFixed(0)}%).`
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
