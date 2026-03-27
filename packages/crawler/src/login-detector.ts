import * as cheerio from 'cheerio'

const LOGIN_URL_PATTERNS = [/\/login/i, /\/signin/i, /\/sign-in/i, /\/auth\//i, /\/sso\//i, /\/oauth\//i, /\/cas\/login/i]
const LOGIN_BUTTON_PATTERNS = [/^log\s*in$/i, /^sign\s*in$/i, /^submit$/i]

export function detectLoginWall(html: string, url: string): boolean {
  try {
    const pathname = new URL(url).pathname
    if (LOGIN_URL_PATTERNS.some((p) => p.test(pathname))) return true
  } catch {}

  if (!html) return false

  const $ = cheerio.load(html)
  if ($('input[type="password"]').length > 0) return true

  const forms = $('form')
  for (let i = 0; i < forms.length; i++) {
    const form = $(forms[i])
    const hasEmailInput = form.find('input[type="email"]').length > 0
    const formAction = (form.attr('action') ?? '').toLowerCase()
    const hasLoginAction = LOGIN_URL_PATTERNS.some((p) => p.test(formAction))

    if (hasEmailInput) {
      const buttons = form.find('button, input[type="submit"]')
      for (let j = 0; j < buttons.length; j++) {
        const btnText = $(buttons[j]).text().trim()
        if (LOGIN_BUTTON_PATTERNS.some((p) => p.test(btnText))) return true
      }
      if (hasLoginAction) return true
    }
  }

  return false
}
