import type { NextAuthConfig } from 'next-auth'

/**
 * Edge-compatible NextAuth configuration.
 *
 * This file must NOT import any Node.js-only modules (ioredis, bcrypt,
 * Prisma, etc.) because it is imported by middleware which runs in the
 * Edge Runtime. Providers that require Node.js are added in auth.ts.
 */
export const authConfig: NextAuthConfig = {
  trustHost: true,
  pages: {
    signIn: '/login',
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
