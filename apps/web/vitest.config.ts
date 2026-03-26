import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
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
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
