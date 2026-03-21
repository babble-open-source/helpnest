import NextAuth, { type NextAuthResult } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import GitHub from 'next-auth/providers/github'
import Google from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import { prisma } from './db'
import { redis } from './redis'
import { authConfig } from './auth.config'

const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const LOGIN_RATE_LIMIT_MAX = 10 // max attempts per window per email

async function isLoginRateLimited(email: string): Promise<boolean> {
  if (!redis) return false
  try {
    const windowSlot = Math.floor(Date.now() / LOGIN_RATE_LIMIT_WINDOW_MS)
    const key = `rl:login:${email.toLowerCase()}:${windowSlot}`
    const count = await redis.incr(key)
    if (count === 1) await redis.pexpire(key, LOGIN_RATE_LIMIT_WINDOW_MS * 2)
    return count > LOGIN_RATE_LIMIT_MAX
  } catch {
    // Redis unavailable — allow through rather than lock users out
    return false
  }
}

let authBundle: NextAuthResult | undefined

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'workspace'
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base
  let attempt = 0
  while (await prisma.workspace.findUnique({ where: { slug } })) {
    attempt++
    slug = `${base}-${attempt}`
  }
  return slug
}

function getAuthBundle(): NextAuthResult {
  authBundle ??= NextAuth({
    ...authConfig,
    callbacks: {
      ...authConfig.callbacks,
      async signIn({ user, account }) {
        // Only handle OAuth providers — credentials are validated in authorize()
        if (!account || account.provider === 'credentials') return true
        if (!user.email) return false

        // Find or create user record for this OAuth account
        let dbUser = await prisma.user.findUnique({
          where: { email: user.email },
          select: { id: true },
        })

        if (!dbUser) {
          const displayName: string = user.name || user.email!.split('@')[0] || 'User'
          dbUser = await prisma.user.create({
            data: {
              email: user.email,
              name: displayName,
              avatar: user.image ?? null,
            },
          })

          // Create a default workspace for new OAuth users
          const slug = await uniqueSlug(slugify(displayName))
          const workspace = await prisma.workspace.create({
            data: { name: `${displayName}'s Help Center`, slug },
          })
          await prisma.member.create({
            data: {
              userId: dbUser.id,
              workspaceId: workspace.id,
              role: 'OWNER',
            },
          })
        }

        // Attach the DB id so the jwt callback picks it up
        user.id = dbUser.id
        return true
      },
    },
    providers: [
      // Only register GitHub provider when credentials are present.
      // Passing empty strings would silently break OAuth without a clear error.
      ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
        ? [GitHub({
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
          })]
        : []),
      ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
        ? [Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            authorization: { params: { prompt: 'select_account' } },
          })]
        : []),
      Credentials({
        credentials: {
          email: { label: 'Email', type: 'email' },
          password: { label: 'Password', type: 'password' },
        },
        async authorize(credentials) {
          const email = credentials?.email as string | undefined
          if (!email) return null

          // Rate limit by email to prevent brute-force attacks.
          // Returns the same null as an invalid password to avoid leaking state.
          if (await isLoginRateLimited(email)) return null

          const user = await prisma.user.findUnique({
            where: { email },
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
  })

  return authBundle
}

export const handlers: NextAuthResult['handlers'] = {
  GET(req) {
    return getAuthBundle().handlers.GET(req)
  },
  POST(req) {
    return getAuthBundle().handlers.POST(req)
  },
}

export const auth = ((...args: unknown[]) =>
  (getAuthBundle().auth as (...innerArgs: unknown[]) => unknown)(...args)) as NextAuthResult['auth']

export const signIn = ((...args: unknown[]) =>
  (getAuthBundle().signIn as (...innerArgs: unknown[]) => unknown)(...args)) as NextAuthResult['signIn']

export const signOut = ((...args: unknown[]) =>
  (getAuthBundle().signOut as (...innerArgs: unknown[]) => unknown)(...args)) as NextAuthResult['signOut']

/**
 * Resolve a stable user id from session data.
 * In production, the JWT id must match a live user record — no fallback.
 * In development, falls back to email lookup to survive DB resets.
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

  // Email fallback only in development — prevents stale JWT pain after DB resets.
  // Never enabled in production: a missing id must force re-authentication.
  if (process.env.NODE_ENV !== 'production' && session.user.email) {
    const byEmail = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })
    return byEmail?.id ?? null
  }

  return null
}
