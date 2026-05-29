/**
 * Vitest globalSetup — runs ONCE per `pnpm test` invocation in a dedicated
 * process. Responsible only for schema synchronisation.
 *
 * Why globalSetup (not setupFiles):
 *  setupFiles runs in every worker process, so a heavy `prisma db push` would
 *  execute ~N times (once per test file). globalSetup runs exactly once,
 *  regardless of worker count.
 *
 * Why we don't load .env.test here:
 *  globalSetup runs in a separate child process; env mutations made here do
 *  NOT propagate to worker processes. .env.test is loaded in setup.ts instead,
 *  which runs inside each worker before any test module is imported.
 *
 * Prisma notes:
 *  - The schema's datasource block has no `url = env(...)` — it uses the
 *    adapter-pg pattern. We must pass --url explicitly to prisma db push.
 *  - We use the prisma binary from packages/db (v7.5.0) because that matches
 *    the generated client. The root `npx prisma` resolves an older globally
 *    installed version and is NOT compatible.
 */

import path from 'path'
import { execSync } from 'child_process'
import dotenv from 'dotenv'

export default function globalSetup() {
  // Load .env.test here solely to read DATABASE_URL for the --url flag.
  // This does not affect worker processes.
  const envPath = path.resolve(__dirname, '../../.env.test')
  const parsed = dotenv.config({ path: envPath, override: true })
  const databaseUrl = parsed.parsed?.DATABASE_URL ?? process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error(`DATABASE_URL not found in ${envPath} — cannot run prisma db push`)
  }

  const schemaPath = path.resolve(__dirname, '../../../../packages/db/prisma/schema.prisma')
  const prismaBin = path.resolve(
    __dirname,
    '../../../../packages/db/node_modules/.bin/prisma'
  )

  try {
    execSync(
      `"${prismaBin}" db push --schema="${schemaPath}" --url="${databaseUrl}" --accept-data-loss`,
      { stdio: 'pipe' }
    )
  } catch (err) {
    const child = err as { stderr?: Buffer; stdout?: Buffer }
    const detail = child.stderr?.toString() ?? child.stdout?.toString() ?? String(err)
    throw new Error(`prisma db push failed in globalSetup:\n${detail}`)
  }
}
