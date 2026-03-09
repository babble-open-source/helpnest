import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import GitHub from 'next-auth/providers/github'
import bcrypt from 'bcryptjs'
import { prisma } from './db'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
    }),
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          select: { id: true, email: true, name: true, passwordHash: true },
        })

        if (!user) return null

        // Users without a password hash must log in via OAuth.
        // This protects OAuth-only accounts from credentials-based impersonation.
        if (!user.passwordHash) return null

        const password = credentials.password as string | undefined
        if (!password) return null

        const valid = await bcrypt.compare(password, user.passwordHash)
        if (!valid) return null

        return { id: user.id, email: user.email, name: user.name }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.id = user.id
      return token
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
})

/**
 * Resolve a stable user id from session data.
 * Handles stale JWT ids after DB resets by falling back to email lookup.
 */
export async function resolveSessionUserId(session: { user?: { id?: string | null; email?: string | null } } | null): Promise<string | null> {
  if (!session?.user) return null

  if (session.user.id) {
    const byId = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true },
    })
    if (byId) return byId.id
  }

  if (!session.user.email) return null
  const byEmail = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  })
  return byEmail?.id ?? null
}
