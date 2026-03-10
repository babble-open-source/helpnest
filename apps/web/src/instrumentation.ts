/**
 * Next.js instrumentation hook — runs once when the Node.js server starts.
 * Used to validate required environment variables before the app handles any requests.
 */
export async function register() {
  // Only run validation in the Node.js runtime (not edge workers or build steps).
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const required = ['DATABASE_URL', 'AUTH_SECRET', 'NEXTAUTH_URL']
  const missing = required.filter((k) => !process.env[k]?.trim())
  if (missing.length > 0) {
    throw new Error(
      `[HelpNest] Missing required environment variables: ${missing.join(', ')}\n` +
        `Copy .env.example to .env and fill in the required values.`,
    )
  }

  const placeholder = 'run-openssl-rand-base64-32-to-generate'
  if (process.env.AUTH_SECRET === placeholder) {
    throw new Error(
      '[HelpNest] AUTH_SECRET is still the placeholder value. ' +
        'Generate a real secret: openssl rand -base64 32',
    )
  }
}
