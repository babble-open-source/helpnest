import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { encode } from 'next-auth/jwt'
import { prisma } from '@/lib/db'

/**
 * Cloud Login — receives a short-lived JWT from helpnest-cloud's auth bridge
 * and creates a NextAuth session for the user in the OSS app.
 *
 * GET /api/auth/cloud-login?token=xxx&redirect=/dashboard
 *
 * The JWT contains { email, name, workspaceSlug } and is signed with
 * SHARED_AUTH_SECRET (same value in both apps).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  const rawRedirect = searchParams.get('redirect') ?? '/dashboard'
  // Only allow relative paths — prevent open redirect to external sites
  const redirect = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//')
    ? rawRedirect
    : '/dashboard'

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  const sharedSecret = process.env.SHARED_AUTH_SECRET
  if (!sharedSecret) {
    return NextResponse.json(
      { error: 'SHARED_AUTH_SECRET is not configured' },
      { status: 500 },
    )
  }

  // Verify the JWT
  let payload: { email?: string; name?: string; workspaceSlug?: string }
  try {
    const secret = new TextEncoder().encode(sharedSecret)
    const { payload: verified } = await jwtVerify(token, secret, {
      issuer: 'helpnest-cloud',
    })
    payload = verified as typeof payload
  } catch {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }

  if (!payload.email) {
    return NextResponse.json({ error: 'Token missing email' }, { status: 400 })
  }

  // Find or create the user in the OSS database
  let user = await prisma.user.findUnique({
    where: { email: payload.email },
  })

  if (!user) {
    // User doesn't exist yet — the provision-workspace endpoint should have
    // created them, but handle the race gracefully
    const bcrypt = await import('bcryptjs')
    user = await prisma.user.create({
      data: {
        email: payload.email,
        name: payload.name ?? null,
        passwordHash: await bcrypt.hash(crypto.randomUUID(), 10),
      },
    })
  }

  // Create a NextAuth-compatible session token
  const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
  if (!authSecret) {
    return NextResponse.json({ error: 'Auth secret not configured' }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const isSecure = appUrl.startsWith('https')
  const cookieName = isSecure
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token'

  const sessionToken = await encode({
    token: {
      sub: user.id,
      email: user.email,
      name: user.name,
      id: user.id,
    },
    secret: authSecret,
    salt: cookieName,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  })

  const cookieStore = await cookies()
  cookieStore.set(cookieName, sessionToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  })

  return NextResponse.redirect(new URL(redirect, appUrl))
}
