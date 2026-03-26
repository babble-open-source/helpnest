import { test, expect } from '@playwright/test'

// The app uses next-intl with localePrefix: 'always'.
// Auth pages live at /en/login, /en/signup, etc.
// Dashboard is at /en/dashboard (middleware redirects unauthenticated users to /en/login).
//
// Seed credentials: admin@helpnest.cloud / password123

test.describe('Authentication — unauthenticated flows', () => {
  test('login page loads with email and password fields', async ({ page }) => {
    await page.goto('/en/login')
    await expect(page).toHaveURL(/\/en\/login/)

    const emailInput = page.locator('input[type="email"], input[name="email"]').first()
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first()
    await expect(emailInput).toBeVisible({ timeout: 10000 })
    await expect(passwordInput).toBeVisible({ timeout: 10000 })
  })

  test('signup page loads with registration form', async ({ page }) => {
    await page.goto('/en/signup')
    const emailInput = page.locator('input[type="email"], input[name="email"]').first()
    await expect(emailInput).toBeVisible({ timeout: 10000 })
  })

  test('dashboard redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/en/dashboard')
    // Middleware issues a redirect to /en/login
    await page.waitForURL(/\/en\/login/, { timeout: 10000 })
    await expect(page).toHaveURL(/\/en\/login/)
  })

  test('workspaces page redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/en/workspaces')
    await page.waitForURL(/\/en\/login/, { timeout: 10000 })
    await expect(page).toHaveURL(/\/en\/login/)
  })

  test('login with invalid credentials shows an error', async ({ page }) => {
    await page.goto('/en/login')

    const emailInput = page.locator('input[type="email"], input[name="email"]').first()
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first()
    await emailInput.waitFor({ state: 'visible', timeout: 10000 })

    await emailInput.fill('notauser@example.com')
    await passwordInput.fill('wrongpassword')
    await page.locator('button[type="submit"]').first().click()

    // Should remain on login page (no redirect to dashboard)
    // next-auth will reject the credentials; the form shows an error or stays put
    await page.waitForTimeout(2000)
    await expect(page).toHaveURL(/\/en\/login/)
  })

  test('login with valid seed credentials redirects to dashboard', async ({ page }) => {
    await page.goto('/en/login')

    const emailInput = page.locator('input[type="email"], input[name="email"]').first()
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first()
    await emailInput.waitFor({ state: 'visible', timeout: 10000 })

    await emailInput.fill('admin@helpnest.cloud')
    await passwordInput.fill('password123')
    await page.locator('button[type="submit"]').first().click()

    // On success next-auth redirects to /dashboard (the middleware resolves the locale)
    await page.waitForURL(/\/dashboard/, { timeout: 15000 })
  })
})
