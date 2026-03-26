import { test, expect } from '@playwright/test'

// These tests assume the dev server is running with seeded data.
// Seed creates workspace slug 'HelpNest', 2 collections, 5 published articles.
//
// The app uses next-intl with localePrefix: 'always', so all page routes
// are prefixed with the locale segment (e.g. /en/HelpNest/help).

const WORKSPACE = 'HelpNest'
const HELP_BASE = `/en/${WORKSPACE}/help`

test.describe('Help Center — public pages', () => {
  test('home page loads and renders the hero section', async ({ page }) => {
    await page.goto(HELP_BASE)
    // The hero contains a heading with the workspace help center title
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 })
  })

  test('home page displays the search trigger', async ({ page }) => {
    await page.goto(HELP_BASE)
    // SearchTrigger renders a button that opens the search modal (not a raw <input>)
    // It is located inside the hero section
    const hero = page.locator('section').first()
    await expect(hero).toBeVisible({ timeout: 10000 })
    // There should be a clickable search element within the hero
    const searchEl = hero.locator('button, input[type="search"], input[placeholder*="earch"]').first()
    await expect(searchEl).toBeVisible({ timeout: 10000 })
  })

  test('home page shows collection cards linking into the workspace', async ({ page }) => {
    await page.goto(HELP_BASE)
    // Collection links follow the pattern /en/HelpNest/help/<collection-slug>
    const collectionLinks = page.locator(`a[href*="/${WORKSPACE}/help/"]`)
    await expect(collectionLinks.first()).toBeVisible({ timeout: 10000 })
    const count = await collectionLinks.count()
    // Seed creates 2 collections
    expect(count).toBeGreaterThanOrEqual(2)
  })

  test('clicking a collection navigates to that collection page', async ({ page }) => {
    await page.goto(HELP_BASE)
    const firstLink = page.locator(`a[href*="/${WORKSPACE}/help/"]`).first()
    await firstLink.waitFor({ state: 'visible', timeout: 10000 })
    const href = await firstLink.getAttribute('href')
    await firstLink.click()
    await page.waitForURL(`**${href}**`, { timeout: 10000 })
    await expect(page.locator('main')).toBeVisible()
  })

  test('home page shows the popular articles section', async ({ page }) => {
    await page.goto(HELP_BASE)
    // Seed publishes 5 articles; the page renders up to 5 popular articles
    // They link to /en/HelpNest/help/<collection>/<article>
    const articleLinks = page.locator(`a[href*="/${WORKSPACE}/help/"]`)
    await expect(articleLinks.first()).toBeVisible({ timeout: 10000 })
    // Combined collection + article links — should be well above 2
    const count = await articleLinks.count()
    expect(count).toBeGreaterThan(2)
  })

  test('unknown workspace slug returns a not-found page', async ({ page }) => {
    const response = await page.goto('/en/this-workspace-does-not-exist-xyz/help')
    // Next.js notFound() returns 404
    expect(response?.status()).toBe(404)
  })

  test('collection page renders article list', async ({ page }) => {
    // Navigate home, grab the first collection href, then visit it
    await page.goto(HELP_BASE)
    const firstLink = page.locator(`a[href*="/${WORKSPACE}/help/"]`).first()
    await firstLink.waitFor({ state: 'visible', timeout: 10000 })
    const href = await firstLink.getAttribute('href')

    await page.goto(href!)
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 })
    // Article links within the collection follow the same /help/<col>/<article> pattern
    const links = page.locator(`a[href*="/${WORKSPACE}/help/"]`)
    await expect(links.first()).toBeVisible({ timeout: 10000 })
  })
})
