interface FetchResult {
  html: string | null
  pageTitle: string | null
  error: string | null
}

export async function fetchPage(
  url: string,
  timeoutMs: number = 30000,
): Promise<FetchResult> {
  const { chromium } = await import('playwright-core')
  let browser = null

  try {
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (compatible; HelpNestBot/1.0; +https://helpnest.cloud/bot)',
    })
    const page = await context.newPage()

    await page.goto(url, { timeout: timeoutMs, waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle').catch(() => {
      // networkidle may not fire on some pages — proceed anyway
    })

    const html = await page.content()
    const pageTitle = await page.title()

    await context.close()

    return { html, pageTitle, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { html: null, pageTitle: null, error: message }
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}
