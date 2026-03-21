import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { redis } from '@/lib/redis'

const SIGNUP_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const SIGNUP_MAX = 5 // per IP per window

async function isSignupRateLimited(ip: string): Promise<boolean> {
  if (!redis) return false
  try {
    const slot = Math.floor(Date.now() / SIGNUP_WINDOW_MS)
    const key = `rl:signup:${ip}:${slot}`
    const count = await redis.incr(key)
    if (count === 1) await redis.pexpire(key, SIGNUP_WINDOW_MS * 2)
    return count > SIGNUP_MAX
  } catch {
    return false
  }
}

/**
 * POST /api/auth/signup
 * Creates a new user account. Does NOT create a workspace —
 * that happens on the /onboarding page after signup.
 */
export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (await isSignupRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many signup attempts. Try again later.' }, { status: 429 })
  }

  const { name, email, password } = (await request.json()) as {
    name?: string
    email?: string
    password?: string
  }

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const normalizedEmail = email.toLowerCase().trim()

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (existing) {
    return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 12)

  await prisma.user.create({
    data: { name, email: normalizedEmail, passwordHash },
  })

  return NextResponse.json({ ok: true })
}
