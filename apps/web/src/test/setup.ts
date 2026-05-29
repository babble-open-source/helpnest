/**
 * Vitest setupFiles — runs in every worker process before any test module
 * is imported. Responsible only for loading the test environment variables.
 *
 * Schema synchronisation (prisma db push) is intentionally NOT here — it
 * belongs in global-setup.ts, which runs once per test invocation. Doing
 * it here would execute the push in every worker (~one per test file).
 *
 * Prisma notes:
 *  - The schema's datasource block has no `url = env(...)` — it uses the
 *    adapter-pg pattern. We must pass --url explicitly to prisma db push.
 *  - We use the prisma binary from packages/db (v7.5.0) because that matches
 *    the generated client. The root `npx prisma` resolves an older globally
 *    installed version and is NOT compatible.
 */

import path from 'path'
import dotenv from 'dotenv'

// Load .env.test with override:true so DATABASE_URL points at helpnest_test
// before any module that imports @/lib/db or harness.ts is resolved.
const envPath = path.resolve(__dirname, '../../.env.test')
dotenv.config({ path: envPath, override: true })

if (!process.env.DATABASE_URL) {
  throw new Error(`DATABASE_URL is not set after loading ${envPath}`)
}
