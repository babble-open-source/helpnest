import type { NextAuthConfig } from 'next-auth'

/**
 * Edge-compatible NextAuth configuration.
 *
 * This file must NOT import any Node.js-only modules (ioredis, bcrypt,
 * Prisma, etc.) because it is imported by middleware which runs in the
 * Edge Runtime. Providers that require Node.js are added in auth.ts.
 */

// Behind a TLS-terminating proxy (ALB → ECS), next-auth auto-detects the
// protocol from x-forwarded-proto to decide whether to prefix cookies with
// `__Secure-`.  If that header is missing or inconsistent between the
// initial OAuth redirect and the callback, the PKCE / state / callbackUrl
// cookie names flip and the verifier "could not be parsed".
//
// Pinning `useSecureCookies` at module load time (runtime, not build-time —
// these are non-NEXT_PUBLIC_ vars) removes the per-request detection.
//
// AUTH_URL is the next-auth v5 canonical variable; NEXTAUTH_URL is kept as
// a fallback for self-hosters who haven't migrated.
const authUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? ''

/**
 * Whether to use `__Secure-` prefixed, HTTPS-only cookies.
 * Exported so `cloud-login` and other modules that manually set auth cookies
 * can use the same source of truth — avoids split-brain cookie names.
 */
export const useSecureCookies = authUrl.startsWith('https://')

const cookiePrefix = useSecureCookies ? '__Secure-' : ''

export const authConfig: NextAuthConfig = {
  trustHost: true,
  useSecureCookies,
  pages: {
    signIn: '/login',
  },
  cookies: {
    pkceCodeVerifier: {
      name: `${cookiePrefix}authjs.pkce.code_verifier`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
        maxAge: 60 * 15, // 15 minutes — matches next-auth default
      },
    },
    state: {
      name: `${cookiePrefix}authjs.state`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
        maxAge: 60 * 15,
      },
    },
    callbackUrl: {
      name: `${cookiePrefix}authjs.callback-url`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
      },
    },
  },
  callbacks: {
    jwt({ token, user, account }) {
      if (user?.id) token.id = user.id
      // Flag OAuth sign-ins so the full auth.ts signIn callback can
      // distinguish them from credentials logins.
      if (account?.provider && account.provider !== 'credentials') {
        token.oauthProvider = account.provider
      }
      return token
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string
      }
      return session
    },
  },
  // Providers requiring Node.js modules (bcrypt, Prisma, ioredis) are
  // registered in auth.ts — not here. This list intentionally stays empty.
  providers: [],
}
