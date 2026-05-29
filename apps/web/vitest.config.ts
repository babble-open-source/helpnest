import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    // Default environment for DB / integration tests (they import Prisma, pg, etc.).
    // Component tests opt-in to jsdom via the // @vitest-environment jsdom pragma
    // at the top of each file — no config change required for those files.
    // environmentMatchGlobs provides the same opt-in declaratively for any file
    // placed under src/**/__tests__/components/ or ending in .component.test.tsx.
    environment: 'node',
    environmentMatchGlobs: [
      ['src/**/__tests__/components/**', 'jsdom'],
      ['src/**/*.component.test.tsx', 'jsdom'],
    ],
    globalSetup: ['./src/test/global-setup.ts'],
    setupFiles: ['./src/test/setup.ts'],
    // Run all test files sequentially in a single thread.
    // The integration tests share a single helpnest_test Postgres database; parallel
    // workers cause cross-file races where one file's TRUNCATE deletes rows another
    // file's test just created, producing FK violations and false failures.
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    // Exclude Playwright e2e specs — they use @playwright/test, not vitest.
    // Playwright has its own runner configured via playwright.config.ts.
    exclude: ['**/node_modules/**', '**/e2e/**'],
    coverage: {
      provider: 'v8',
      include: [
        'src/lib/slugify.ts',
        'src/lib/unique-slug.ts',
        'src/lib/content.ts',
        'src/lib/api-key.ts',
        'src/lib/font-url.ts',
        'src/lib/help-url.ts',
        'src/lib/html-to-markdown.ts',
        'src/lib/request-host.ts',
        'src/lib/workspace-utils.ts',
        'src/lib/auth-api.ts',
        'src/lib/branding.ts',
        'src/lib/help-visibility.ts',
        'src/app/api/articles/route.ts',
        'src/app/api/collections/route.ts',
        'src/app/api/health/route.ts',
        'src/app/api/search/route.ts',
        'src/app/api/members/*/route.ts',
        // Ticketing foundation (K1+K2) — added in Task 1
        'src/lib/ticket-number.ts',
        'src/lib/conversation-events.ts',
        'src/lib/contact-resolver.ts',
        'src/lib/org-associator.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
