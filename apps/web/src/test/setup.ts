/**
 * Global Vitest setup — runs once before any test file is loaded.
 *
 * Responsibilities:
 *  1. Load .env.test (with override: true) so DATABASE_URL points at
 *     helpnest_test before any module that imports @/lib/db is resolved.
 *  2. Push the current Prisma schema to helpnest_test so the DB schema
 *     stays in sync without requiring a full migration history.
 *
 * Prisma notes:
 *  - The schema's datasource block has no `url = env(...)` — it uses
 *    the adapter-pg pattern. We must pass --url explicitly to prisma db push.
 *  - We use the prisma binary from packages/db (v7.5.0) because that is
 *    the version that generated the current client; the root npx prisma is
 *    an older version installed globally and is NOT compatible.
 */

import path from 'path'
import { execSync } from 'child_process'
import dotenv from 'dotenv'

// Step 1 — load test env BEFORE any module reads process.env.DATABASE_URL.
const envPath = path.resolve(__dirname, '../../.env.test')
dotenv.config({ path: envPath, override: true })

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error(`DATABASE_URL is not set after loading ${envPath}`)
}

// Step 2 — push schema to helpnest_test using the packages/db prisma binary.
// Using --url because the schema datasource block omits `url = env(...)`;
// the connection string is injected entirely at runtime via the adapter.
const schemaPath = path.resolve(__dirname, '../../../../packages/db/prisma/schema.prisma')
const prismaBin = path.resolve(__dirname, '../../../../packages/db/node_modules/.bin/prisma')

try {
  execSync(
    `"${prismaBin}" db push --schema="${schemaPath}" --url="${databaseUrl}" --accept-data-loss`,
    { stdio: 'pipe' }
  )
} catch (err) {
  // Surface the error clearly — a failed db push would break every test.
  const child = err as { stderr?: Buffer; stdout?: Buffer }
  const detail = child.stderr?.toString() ?? child.stdout?.toString() ?? String(err)
  throw new Error(`prisma db push failed during test setup:\n${detail}`)
}
