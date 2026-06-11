/**
 * Vitest setupFiles — runs in every worker process before any test module
 * is imported. Responsible for:
 *  1. Loading test environment variables (DATABASE_URL → helpnest_test)
 *  2. Registering @testing-library/jest-dom matchers (toBeInTheDocument, etc.)
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
 *
 * jest-dom note:
 *  Importing @testing-library/jest-dom in a node environment is safe — it
 *  augments the global `expect` with DOM matchers. Those matchers are unused
 *  in node/DB tests but cause no failures. Component tests (jsdom environment)
 *  get the matchers for free from the same import.
 */

import '@testing-library/jest-dom'
import path from 'path'
import dotenv from 'dotenv'

// Load .env.test with override:true so DATABASE_URL points at helpnest_test
// before any module that imports @/lib/db or harness.ts is resolved.
// dotenv no-ops if the file is missing (e.g. CI, where env vars are set
// directly on the job) — the check below catches a truly absent DATABASE_URL.
const envPath = path.resolve(__dirname, '../../.env.test')
dotenv.config({ path: envPath, override: true })

if (!process.env.DATABASE_URL) {
  throw new Error(
    `DATABASE_URL is not set and ${envPath} did not provide it. ` +
      'Copy apps/web/.env.test.example to apps/web/.env.test (or run ./scripts/dev-setup.sh) and try again.'
  )
}
