/**
 * signup-gate.ts — whether this deployment accepts new public accounts.
 *
 * Two different things get confused here, so the distinction is worth stating:
 * hiding a "Sign up" link is a UI change, and it stops nobody. The signup endpoint
 * is a public HTTP route, and anyone who knows the URL can POST to it directly.
 * Closing signup means the SERVER refuses, which is what this gate is for.
 *
 * Defaults to OPEN. HelpNest is open-source and self-hosted; an install that
 * refused to create its first account because of an unset environment variable
 * would be broken out of the box. The hosted deployment is the one that opts out,
 * by setting PUBLIC_SIGNUP_ENABLED=false.
 */

const FALSEY = new Set(['false', '0', 'no', 'off'])

/**
 * True when this deployment accepts new public signups.
 *
 * Read at call time, not at module load, so the value can be changed without a
 * rebuild — and so tests can exercise both states.
 */
export function isPublicSignupEnabled(): boolean {
  const raw = process.env['PUBLIC_SIGNUP_ENABLED']
  if (raw === undefined) return true

  // Only an explicit, recognisable "no" closes signup. An unrecognised value
  // leaves it open rather than silently locking an operator out of their own
  // install — the failure we want on a typo is "signup still works", not "nobody
  // can ever create an account and the reason is invisible".
  return !FALSEY.has(raw.trim().toLowerCase())
}

/** Message returned to a client when signup is closed. */
export const SIGNUP_CLOSED_MESSAGE = 'This HelpNest instance is not accepting new signups.'
