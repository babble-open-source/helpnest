import { test, expect, type BrowserContext, type Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// Auth helper — logs in once and returns a context with the session cookie.
// Reused across tests that require an authenticated session.
// ---------------------------------------------------------------------------

async function loginAs(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto('/en/login')
  const emailInput = page.locator('input[type="email"], input[name="email"]').first()
  await emailInput.waitFor({ state: 'visible', timeout: 10000 })
  await emailInput.fill(email)
  await page.locator('input[type="password"], input[name="password"]').first().fill(password)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL(/\/dashboard/, { timeout: 15000 })
}

test.describe('Dashboard — authenticated flows', () => {
  // Use a shared browser context so login is performed once per describe block.
  // Each test receives the same context and therefore the same session cookie.
  let context: BrowserContext
  let page: Page

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext()
    page = await context.newPage()
    await loginAs(page, 'admin@helpnest.cloud', 'password123')
  })

  test.afterAll(async () => {
    await context.close()
  })

  test('dashboard overview page loads after login', async () => {
    await page.goto('/en/dashboard')
    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 })
  })

  test('articles list page is accessible', async () => {
    await page.goto('/en/dashboard/articles')
    await expect(page).toHaveURL(/\/dashboard\/articles/)
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 })
  })

  test('collections page is accessible', async () => {
    await page.goto('/en/dashboard/collections')
    await expect(page).toHaveURL(/\/dashboard\/collections/)
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 })
  })

  test('settings page is accessible', async () => {
    await page.goto('/en/dashboard/settings')
    await expect(page).toHaveURL(/\/dashboard\/settings/)
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 })
  })
})
