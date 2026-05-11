// apps/web/src/lib/voice/internal-auth.ts
import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'

export function validateInternalSecret(request: Request): NextResponse | null {
  const configuredSecret = process.env.INTERNAL_SECRET
  if (!configuredSecret) return null

  const provided = request.headers.get('x-internal-secret')
  if (!provided) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const maxLen = Math.max(provided.length, configuredSecret.length) || 1
  const a = Buffer.alloc(maxLen)
  const b = Buffer.alloc(maxLen)
  Buffer.from(provided).copy(a)
  Buffer.from(configuredSecret).copy(b)
  const valid = provided.length === configuredSecret.length && timingSafeEqual(a, b)

  if (!valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}
